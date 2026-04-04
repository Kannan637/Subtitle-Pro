import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
MONGODB_URL = os.getenv("MONGODB_URL")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME")

async def reset_project_subtitles(project_id: str):
    print(f"Connecting to MongoDB...")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[MONGODB_DB_NAME]
    
    # 1. Delete all tracks for this project
    tracks_result = await db.subtitle_tracks.delete_many({"project_id": project_id})
    print(f"Deleted {tracks_result.deleted_count} subtitle tracks.")
    
    # 2. Delete all transcription jobs for this project
    jobs_result = await db.transcription_jobs.delete_many({"project_id": project_id})
    print(f"Deleted {jobs_result.deleted_count} transcription jobs.")
    
    # 3. We didn't delete the cues directly by track_id because the tracks are gone, 
    # but we can clean up orphaned cues or just leave them (they won't show up without a track).
    # To be safe, we can delete any cues matching the deleted track IDs.
    
    # 4. Reset project status so it can be re-transcribed
    from bson import ObjectId
    try:
        obj_id = ObjectId(project_id)
        # We don't change 'ready' back to processing, because the frontend video editor 
        # requires status 'ready' to show the editor page. We just leave it 'ready'.
        # The frontend will show "Generate Subtitles" if there are 0 tracks.
        print(f"Project '{project_id}' subtitles reset and ready for re-transcription.")
    except Exception as e:
        print(f"Error: {e}")
        
    client.close()

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python fix_subtitles.py <project_id>")
        sys.exit(1)
    
    project_id = sys.argv[1]
    asyncio.run(reset_project_subtitles(project_id))
