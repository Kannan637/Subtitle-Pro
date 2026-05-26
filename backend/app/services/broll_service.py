"""AI B-roll service — importance-scored keyword extraction via Groq + smart Pexels search."""
import json
import logging
import random
import re
from typing import Any, Dict, List, Optional, Tuple

import requests

from app.core.config import settings
from app.services.groq_service import get_groq_client

logger = logging.getLogger(__name__)

PEXELS_VIDEO_URL = "https://api.pexels.com/videos/search"

# Importance threshold — cues below this won't get B-roll
IMPORTANCE_THRESHOLD = 0.55
MIN_BROLL_DURATION_MS = 34
MAX_BROLL_DURATION_MS = 3000


def _bounded_end_ms(start_ms: int, end_ms: int) -> int:
    """Clamp B-roll window to max 3s without extending past the audio window."""
    latest_end = start_ms + MAX_BROLL_DURATION_MS
    if end_ms > start_ms:
        return min(end_ms, latest_end)
    return min(start_ms + MIN_BROLL_DURATION_MS, latest_end)


def _normalize_text(value: str) -> str:
    return " ".join(re.findall(r"[A-Za-z0-9']+", (value or "").lower()))


def _keyword_tokens(keyword: str) -> list[str]:
    return [t for t in _normalize_text(keyword).split() if len(t) > 1]


def _cue_match_score(cue_text: str, keyword_tokens: list[str], keyword_phrase: str) -> int:
    text = _normalize_text(cue_text)
    if not text:
        return 0
    score = 0
    if keyword_phrase and keyword_phrase in text:
        score += 10
    score += sum(1 for token in keyword_tokens if token in text)
    return score


def _focus_broll_window(cue: Dict[str, Any], keyword: str, alt_keyword: str = "") -> tuple[int, int]:
    """Pick a semantically-aligned B-roll window anchored near the important words."""
    block_start = int(cue.get("start_ms", 0) or 0)
    block_end = int(cue.get("end_ms", block_start) or block_start)
    if block_end <= block_start:
        return block_start, _bounded_end_ms(block_start, block_start + MIN_BROLL_DURATION_MS)

    segments = cue.get("segments")
    if not isinstance(segments, list) or not segments:
        return block_start, _bounded_end_ms(block_start, block_end)

    keyword_phrase = _normalize_text(keyword)
    alt_phrase = _normalize_text(alt_keyword)
    tokens = _keyword_tokens(keyword)
    alt_tokens = _keyword_tokens(alt_keyword)
    all_tokens = tokens + [t for t in alt_tokens if t not in tokens]

    best_idx = -1
    best_score = 0
    for idx, segment in enumerate(segments):
        text = str(segment.get("text", ""))
        score = _cue_match_score(text, all_tokens, keyword_phrase)
        if score <= 0 and alt_phrase:
            score = _cue_match_score(text, all_tokens, alt_phrase)
        if score > best_score:
            best_score = score
            best_idx = idx

    if best_idx < 0:
        return block_start, _bounded_end_ms(block_start, block_end)

    anchor = segments[best_idx]
    start_ms = int(anchor.get("start_ms", block_start) or block_start)
    start_ms = max(block_start, min(start_ms, block_end - 1))

    meaning_end = int(anchor.get("end_ms", start_ms + MIN_BROLL_DURATION_MS) or (start_ms + MIN_BROLL_DURATION_MS))
    max_end = min(block_end, start_ms + MAX_BROLL_DURATION_MS)

    # Extend to phrase/sentence end from the anchor onward (without exceeding 3s).
    for seg in segments[best_idx:]:
        seg_end = int(seg.get("end_ms", meaning_end) or meaning_end)
        if seg_end <= start_ms:
            continue
        candidate_end = min(seg_end, max_end)
        if candidate_end > meaning_end:
            meaning_end = candidate_end
        text = str(seg.get("text", ""))
        if re.search(r"[.!?;:]\s*$", text.strip()):
            break
        if meaning_end >= max_end:
            break

    end_ms = _bounded_end_ms(start_ms, meaning_end)
    if end_ms <= start_ms:
        end_ms = _bounded_end_ms(start_ms, start_ms + MIN_BROLL_DURATION_MS)
    return start_ms, end_ms


# ---------------------------------------------------------------------------
# Step 1 — AI importance scoring + keyword extraction (single Groq call)
# ---------------------------------------------------------------------------

def analyze_cues_for_broll(cues: List[Dict[str, Any]], batch_size: int = 15) -> List[Dict[str, Any]]:
    """
    For each cue, ask Groq to:
      1. Score importance (0–1): how visually meaningfully is this moment?
         High (>0.7): key claim, statistic, product/brand, main topic, before/after
         Low  (<0.5): filler words, transitions ("um", "so"), greetings, pauses
      2. Extract a concrete Pexels-ready keyword for high-importance cues.
      3. Suggest an alternate fallback keyword.

    Returns the same list with 'importance', 'keyword', and 'alt_keyword' added.
    """
    client = get_groq_client()
    enriched: List[Dict[str, Any]] = [dict(c) for c in cues]

    for batch_start in range(0, len(enriched), batch_size):
        batch = enriched[batch_start: batch_start + batch_size]
        indexed = [{"i": batch_start + i, "text": c["text"]} for i, c in enumerate(batch)]

        prompt = (
            "You are a professional video editor deciding where to place B-roll footage.\n"
            "Given subtitle cues, for each one:\n"
            "1. Score its IMPORTANCE (0.0–1.0) for adding B-roll:\n"
            "   - 0.9+: Key statistic, strong claim, product demo, visual concept\n"
            "   - 0.7-0.9: Main topic mention, important example, actionable tip\n"
            "   - 0.4-0.7: Moderate context, background info\n"
            "   - <0.4: Filler words, transitions, greetings, 'um', 'so', 'like'\n"
            "2. For importance > 0.5: provide a SHORT, SPECIFIC Pexels search keyword\n"
            "   (e.g. 'programmer typing laptop', 'city traffic aerial', 'gym workout')\n"
            "3. Provide an alternate simpler fallback keyword.\n\n"
            f"Input cues:\n{json.dumps(indexed, ensure_ascii=False)}\n\n"
            "Output STRICT JSON array only — no markdown, no explanation:\n"
            '[{"i":0,"importance":0.8,"keyword":"specific keyword","alt":"fallback"}, ...]'
        )

        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=2048,
            )
            raw = response.choices[0].message.content.strip()

            # Robust JSON parse — strip markdown fences if present
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                raw = raw.split("```json")[-1].split("```")[0].strip()
                raw = raw.split("```")[-2].strip() if "```" in raw else raw
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    logger.warning(f"Could not parse Groq response for batch {batch_start}: {raw[:200]}")
                    continue

            for item in parsed:
                idx = item.get("i")
                if idx is not None and 0 <= idx < len(enriched):
                    enriched[idx]["importance"] = float(item.get("importance", 0.0))
                    enriched[idx]["keyword"] = str(item.get("keyword", "")).strip()
                    enriched[idx]["alt_keyword"] = str(item.get("alt", "")).strip()

        except Exception as e:
            logger.warning(f"B-roll analysis failed for batch {batch_start}: {e}")

    return enriched


# ---------------------------------------------------------------------------
# Step 2 — Smart Pexels search with fallback
# ---------------------------------------------------------------------------

def fetch_pexels_video(keyword: str, orientation: str = "landscape", alt_keyword: str = "") -> Optional[Dict[str, Any]]:
    """
    Search Pexels for B-roll footage matching the keyword.
    Falls back to alt_keyword if the main keyword returns no results.
    Returns clip metadata dict or None.
    """
    api_key = settings.pexels_api_key
    if not api_key:
        logger.error("PEXELS_API_KEY is not set in .env — B-roll fetch disabled. Add PEXELS_API_KEY to .env")
        return None

    def _search(query: str) -> Optional[Dict[str, Any]]:
        try:
            resp = requests.get(
                PEXELS_VIDEO_URL,
                headers={"Authorization": api_key},
                params={"query": query, "orientation": orientation, "size": "medium", "per_page": 8},
                timeout=10,
            )
            if not resp.ok:
                logger.error(f"Pexels API error {resp.status_code} for '{query}': {resp.text[:200]}")
                return None
            data = resp.json()
            if not data.get("total_results") or not data.get("videos"):
                return None

            # Pick the best video from top results (prefer 720-1080p)
            video = data["videos"][0]
            files = sorted(video.get("video_files", []), key=lambda f: f.get("height", 0), reverse=True)
            chosen = next((f for f in files if 480 <= f.get("height", 0) <= 1080), files[0] if files else None)
            if not chosen:
                return None

            return {
                "video_url": chosen["link"],
                "thumbnail": video.get("image", ""),
                "width": chosen.get("width", 0),
                "height": chosen.get("height", 0),
                "duration": video.get("duration", 0),
                "pexels_id": str(video.get("id", "")),
                "matched_keyword": query,
            }
        except Exception as e:
            logger.warning(f"Pexels fetch failed for '{query}': {e}")
            return None

    # Try primary keyword first, then fallback
    result = _search(keyword)
    if not result and alt_keyword and alt_keyword != keyword:
        logger.info(f"Primary keyword '{keyword}' returned no results, trying alt '{alt_keyword}'")
        result = _search(alt_keyword)

    return result


# ---------------------------------------------------------------------------
# Step 3 — Main orchestrator
# ---------------------------------------------------------------------------

def merge_cues_into_blocks(
    cues: List[Dict[str, Any]],
    min_duration_ms: int = MAX_BROLL_DURATION_MS,
    max_duration_ms: int = MAX_BROLL_DURATION_MS,
) -> List[Dict[str, Any]]:
    """Group tiny cues into blocks with a hard max window of 3 seconds."""
    blocks = []
    current_block = None

    for cue in cues:
        if not current_block:
            current_block = {
                "cue_id": str(cue.get("_id", cue.get("cue_id"))),
                "text": cue.get("text", "").strip(),
                "start_ms": int(cue.get("start_ms", 0)),
                "end_ms": int(cue.get("end_ms", 0)),
                "segments": [{
                    "cue_id": str(cue.get("_id", cue.get("cue_id"))),
                    "text": cue.get("text", "").strip(),
                    "start_ms": int(cue.get("start_ms", 0)),
                    "end_ms": int(cue.get("end_ms", 0)),
                }],
            }
            continue
        
        gap = int(cue.get("start_ms", 0)) - current_block["end_ms"]
        duration = current_block["end_ms"] - current_block["start_ms"]
        text_ends_with_punct = current_block["text"].endswith(('.', '!', '?'))
        
        if (duration >= max_duration_ms) or (gap > 1500) or (text_ends_with_punct and duration >= min_duration_ms):
            blocks.append(current_block)
            current_block = {
                "cue_id": str(cue.get("_id", cue.get("cue_id"))),
                "text": cue.get("text", "").strip(),
                "start_ms": int(cue.get("start_ms", 0)),
                "end_ms": int(cue.get("end_ms", 0)),
                "segments": [{
                    "cue_id": str(cue.get("_id", cue.get("cue_id"))),
                    "text": cue.get("text", "").strip(),
                    "start_ms": int(cue.get("start_ms", 0)),
                    "end_ms": int(cue.get("end_ms", 0)),
                }],
            }
        else:
            current_block["text"] += " " + cue.get("text", "").strip()
            current_block["end_ms"] = int(cue.get("end_ms", 0))
            current_block.setdefault("segments", []).append({
                "cue_id": str(cue.get("_id", cue.get("cue_id"))),
                "text": cue.get("text", "").strip(),
                "start_ms": int(cue.get("start_ms", 0)),
                "end_ms": int(cue.get("end_ms", 0)),
            })
            
    if current_block:
        blocks.append(current_block)
        
    return blocks

def generate_broll_suggestions(
    cues: List[Dict[str, Any]],
    coverage: float = 0.5,
    orientation: str = "landscape",
    importance_threshold: float = IMPORTANCE_THRESHOLD,
) -> List[Dict[str, Any]]:
    """
    Full pipeline:
    1. Group cues into semantic blocks (sentences).
    2. Score each block's importance + extract keywords via Groq.
    3. Fetch Pexels clips for high-importance blocks.
    4. Apply coverage limits.
    """
    if not cues:
        return []

    # Merge single-word cues into logical blocks so B-roll spans sentences
    block_cues = merge_cues_into_blocks(cues)

    logger.info(f"Analyzing {len(block_cues)} blocks (merged from {len(cues)} cues) for B-roll importance.")

    # Step 1: AI importance scoring + keyword extraction
    enriched = analyze_cues_for_broll(block_cues)

    # Step 2: Filter to important cues only
    important_indices = [
        i for i, c in enumerate(enriched)
        if c.get("importance", 0) >= importance_threshold and c.get("keyword")
    ]
    logger.info(f"Found {len(important_indices)}/{len(enriched)} important cues above threshold")

    # Step 3: Apply coverage limit on top of importance filter
    num_to_fetch = max(1, int(len(important_indices) * coverage))
    # Sort by importance descending — always pick the MOST important first
    important_indices.sort(key=lambda i: enriched[i].get("importance", 0), reverse=True)
    selected_indices = set(important_indices[:num_to_fetch])

    # Step 4: Fetch Pexels clips for selected cues
    results = []
    for i, cue in enumerate(enriched):
        start_ms = int(cue.get("start_ms", 0))
        raw_end_ms = int(cue.get("end_ms", start_ms))

        if i in selected_indices:
            focused_start, focused_end = _focus_broll_window(
                cue,
                str(cue.get("keyword", "")),
                str(cue.get("alt_keyword", "")),
            )
            start_ms = focused_start
            end_ms = focused_end
        else:
            end_ms = _bounded_end_ms(start_ms, raw_end_ms)
        entry = {
            "cue_id": str(cue.get("_id", cue.get("cue_id", str(i)))),
            "text": cue.get("text", ""),
            "start_ms": start_ms,
            "end_ms": end_ms,
            "keyword": cue.get("keyword", ""),
            "importance": round(cue.get("importance", 0.0), 2),
            "broll": None,
        }
        if i in selected_indices:
            clip = fetch_pexels_video(
                cue.get("keyword", ""),
                orientation=orientation,
                alt_keyword=cue.get("alt_keyword", ""),
            )
            entry["broll"] = clip

        results.append(entry)

    fetched = sum(1 for r in results if r.get("broll"))
    avg_importance = (
        sum(r["importance"] for r in results if r["importance"] > 0) /
        max(1, sum(1 for r in results if r["importance"] > 0))
    )
    logger.info(
        f"B-roll complete: {fetched} clips / {len(important_indices)} important cues "
        f"/ {len(results)} total | avg importance={avg_importance:.2f}"
    )
    return results
