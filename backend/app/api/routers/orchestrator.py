"""Multi-Agent Orchestrator — run B-roll, music, SFX, transitions, gap-cutting and crop in parallel.

POST /{project_id}/run    → queue a parallel multi-agent job, returns job_id
GET  /{project_id}/status → per-agent progress / status
GET  /{project_id}/stream → Server-Sent Events stream for real-time progress
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, List

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.db.database import get_database
from app.core.security import get_current_active_user, get_current_active_user_from_request

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/orchestrator", tags=["Orchestrator"])

VALID_AGENTS = {"broll", "music", "gaps", "sfx", "transitions", "crop"}


class RunAgentsRequest(BaseModel):
    agents: List[str]           # e.g. ["broll", "music", "gaps", "sfx", "transitions"]
    aspect_ratio: str = "16:9"  # target aspect ratio for crop agent
    transition_style: str = "auto"


# ─── Agent runners ─────────────────────────────────────────────────────────────

async def _set_agent(db, job_id: str, agent: str, status: str, result=None) -> None:
    patch: dict = {f"agent_status.{agent}": status}
    if result is not None:
        patch[f"results.{agent}"] = result
    await db.orchestration_jobs.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": patch},
    )


async def _set_mood_profile_if_needed(
    job_id: str,
    project_id: str,
    agents: List[str],
    db: Any,
) -> dict | None:
    if "music" not in agents and "sfx" not in agents:
        return None
    try:
        from app.services.mood_service import build_mood_profile_for_project

        mood_profile = await build_mood_profile_for_project(project_id, db)
        await db.orchestration_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"results.analysis.mood_profile": mood_profile}},
        )
        return mood_profile
    except Exception as exc:
        logger.warning("Mood profile generation failed for job %s: %s", job_id, exc)
        return None


async def _run_broll_agent(job_id: str, project_id: str, db) -> None:
    try:
        await _set_agent(db, job_id, "broll", "running")
        from app.services.broll_service import suggest_broll  # type: ignore
        result = await suggest_broll(project_id, db)
        await _set_agent(db, job_id, "broll", "complete", result)
    except Exception as e:
        logger.error("B-roll agent failed for job %s: %s", job_id, e, exc_info=True)
        await _set_agent(db, job_id, "broll", "error", {"error": str(e)})


async def _run_music_agent(job_id: str, project_id: str, db, mood_profile: dict | None = None) -> None:
    try:
        await _set_agent(db, job_id, "music", "running")
        from app.services.music_service import find_music_for_project
        result = await find_music_for_project(project_id, db, mood_profile=mood_profile)
        await _set_agent(db, job_id, "music", "complete", result)
    except Exception as e:
        logger.error("Music agent failed for job %s: %s", job_id, e, exc_info=True)
        await _set_agent(db, job_id, "music", "error", {"error": str(e)})


async def _run_gap_agent(job_id: str, project_id: str, db) -> None:
    try:
        await _set_agent(db, job_id, "gaps", "running")
        from app.services.gap_service import detect_silence_gaps
        media = await db.media_files.find_one({"project_id": project_id})
        if not media or not media.get("local_path"):
            raise ValueError("No media file found for this project")
        gaps = await detect_silence_gaps(media["local_path"])
        await _set_agent(db, job_id, "gaps", "complete", gaps)
    except Exception as e:
        logger.error("Gap agent failed for job %s: %s", job_id, e, exc_info=True)
        await _set_agent(db, job_id, "gaps", "error", {"error": str(e)})


async def _run_sfx_agent(job_id: str, project_id: str, db, mood_profile: dict | None = None) -> None:
    try:
        await _set_agent(db, job_id, "sfx", "running")
        from app.services.sfx_service import suggest_sfx
        result = await suggest_sfx(project_id, db, mood_profile=mood_profile)
        await _set_agent(db, job_id, "sfx", "complete", result)
    except Exception as e:
        logger.error("SFX agent failed for job %s: %s", job_id, e, exc_info=True)
        await _set_agent(db, job_id, "sfx", "error", {"error": str(e)})


async def _run_transition_agent(job_id: str, project_id: str, db, style: str = "auto") -> None:
    try:
        await _set_agent(db, job_id, "transitions", "running")
        from app.services.transition_service import build_transitions
        result = await build_transitions(project_id, db, transition_style=style)
        await _set_agent(db, job_id, "transitions", "complete", result)
    except Exception as e:
        logger.error("Transition agent failed for job %s: %s", job_id, e, exc_info=True)
        await _set_agent(db, job_id, "transitions", "error", {"error": str(e)})


async def _run_crop_agent(
    job_id: str, project_id: str, db, aspect_ratio: str = "16:9"
) -> None:
    try:
        await _set_agent(db, job_id, "crop", "running")
        from app.services.crop_service import crop_video
        import os, tempfile

        media = await db.media_files.find_one({"project_id": project_id})
        if not media or not media.get("local_path"):
            raise ValueError("No media file found for this project")

        src = media["local_path"]
        base, ext = os.path.splitext(src)
        output_path = f"{base}_cropped_{aspect_ratio.replace(':', 'x')}{ext}"

        result = await crop_video(src, output_path, aspect_ratio)  # type: ignore[arg-type]

        # Persist cropped path back to media record
        await db.media_files.update_one(
            {"project_id": project_id},
            {"$set": {"cropped_path": output_path, "target_ratio": aspect_ratio}},
        )
        await _set_agent(db, job_id, "crop", "complete", result)
    except Exception as e:
        logger.error("Crop agent failed for job %s: %s", job_id, e, exc_info=True)
        await _set_agent(db, job_id, "crop", "error", {"error": str(e)})


def _failed_agents(agent_status: dict[str, str]) -> list[str]:
    return [name for name, status in agent_status.items() if status == "error"]


def _derive_overall_status(agent_status: dict[str, str]) -> str:
    return "error" if _failed_agents(agent_status) else "complete"


def _build_error_payload(job: dict[str, Any]) -> dict[str, Any]:
    agent_status = job.get("agent_status", {}) or {}
    results = job.get("results", {}) or {}
    failed = _failed_agents(agent_status)

    agent_errors: dict[str, str] = {}
    for agent in failed:
        result = results.get(agent)
        if isinstance(result, dict) and result.get("error"):
            agent_errors[agent] = str(result["error"])

    return {
        "message": "One or more requested agents failed",
        "failed_agents": failed,
        "agent_errors": agent_errors,
        "results": results,
        "completed_at": str(job.get("completed_at", "")),
    }


async def _run_parallel_agents(
    job_id: str,
    project_id: str,
    agents: List[str],
    aspect_ratio: str,
    transition_style: str,
    db,
) -> None:
    """Run all requested agents concurrently, then mark job complete."""
    mood_profile = await _set_mood_profile_if_needed(job_id, project_id, agents, db)

    tasks = []
    if "broll"       in agents: tasks.append(_run_broll_agent(job_id, project_id, db))
    if "music"       in agents: tasks.append(_run_music_agent(job_id, project_id, db, mood_profile))
    if "gaps"        in agents: tasks.append(_run_gap_agent(job_id, project_id, db))
    if "sfx"         in agents: tasks.append(_run_sfx_agent(job_id, project_id, db, mood_profile))
    if "transitions" in agents: tasks.append(_run_transition_agent(job_id, project_id, db, transition_style))
    if "crop"        in agents: tasks.append(_run_crop_agent(job_id, project_id, db, aspect_ratio))

    await asyncio.gather(*tasks, return_exceptions=True)

    job = await db.orchestration_jobs.find_one({"_id": ObjectId(job_id)})
    agent_status = (job or {}).get("agent_status", {}) or {}
    failed = _failed_agents(agent_status)
    overall_status = _derive_overall_status(agent_status)

    patch: dict[str, Any] = {
        "status": overall_status,
        "completed_at": datetime.now(timezone.utc),
    }
    if failed:
        patch["error"] = {
            "message": "One or more requested agents failed",
            "failed_agents": failed,
        }

    await db.orchestration_jobs.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": patch},
    )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/{project_id}/run")
async def run_agents(
    project_id: str,
    body: RunAgentsRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """Queue a multi-agent job and return the job_id immediately (202-style)."""
    user_id = current_user.get("uid")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    agents = [a for a in body.agents if a in VALID_AGENTS]
    if not agents:
        raise HTTPException(
            status_code=400,
            detail=f"No valid agents specified. Valid options: {sorted(VALID_AGENTS)}",
        )

    job = {
        "project_id": project_id,
        "agents": agents,
        "status": "running",
        "agent_status": {a: "queued" for a in agents},
        "results": {},
        "aspect_ratio": body.aspect_ratio,
        "transition_style": body.transition_style,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.orchestration_jobs.insert_one(job)
    job_id = str(result.inserted_id)

    background_tasks.add_task(
        _run_parallel_agents,
        job_id, project_id, agents,
        body.aspect_ratio, body.transition_style, db,
    )

    return {"job_id": job_id, "status": "running", "agents": agents}


@router.get("/{project_id}/status")
async def get_orchestration_status(
    project_id: str,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """Return the latest orchestration job status for a project."""
    user_id = current_user.get("uid")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    job = await db.orchestration_jobs.find_one(
        {"project_id": project_id},
        sort=[("created_at", -1)],
    )
    if not job:
        return {"status": "none", "message": "No orchestration job found for this project"}

    return {
        "job_id": str(job["_id"]),
        "status": job.get("status"),
        "agent_status": job.get("agent_status", {}),
        "results": job.get("results", {}),
        "created_at": str(job.get("created_at")),
        "completed_at": str(job.get("completed_at", "")),
    }


@router.get("/{project_id}/stream")
async def stream_orchestration_progress(
    project_id: str,
    current_user: dict = Depends(get_current_active_user_from_request),
    db=Depends(get_database),
):
    """Server-Sent Events endpoint — push per-agent status updates to the frontend.

    The client should open this URL with ``EventSource`` immediately after
    calling ``POST /{project_id}/run``. The stream closes automatically when
    the job reaches ``complete`` or ``error``.

    Events emitted:
    - ``event: progress`` — ``data: JSON { agent_status, status }``
    - ``event: complete`` — ``data: JSON { results, completed_at }``
    - ``event: error``   — ``data: JSON { message, failed_agents, agent_errors, results, completed_at }``
    """
    user_id = current_user.get("uid")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    async def event_generator() -> AsyncGenerator[str, None]:
        last_status: dict = {}
        max_polls = 360  # 3 min at 0.5s interval

        for _ in range(max_polls):
            job = await db.orchestration_jobs.find_one(
                {"project_id": project_id},
                sort=[("created_at", -1)],
            )
            if not job:
                yield f"event: error\ndata: {json.dumps({'message': 'Job not found'})}\n\n"
                break

            current_status = job.get("agent_status", {})
            overall = job.get("status", "running")

            # Only push when something changed
            if current_status != last_status:
                last_status = current_status
                payload = json.dumps({
                    "agent_status": current_status,
                    "status": overall,
                })
                yield f"event: progress\ndata: {payload}\n\n"

            if overall in ("complete", "error"):
                if overall == "complete":
                    results = job.get("results", {})
                    completed_at = str(job.get("completed_at", ""))
                    yield (
                        f"event: complete\n"
                        f"data: {json.dumps({'results': results, 'completed_at': completed_at})}\n\n"
                    )
                else:
                    payload = _build_error_payload(job)
                    yield f"event: error\ndata: {json.dumps(payload)}\n\n"
                break

            await asyncio.sleep(0.5)
        else:
            yield f"event: error\ndata: {json.dumps({'message': 'Stream timeout'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
