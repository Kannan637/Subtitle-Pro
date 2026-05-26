import logging

import cloudinary
import cloudinary.search
from app.core.config import settings

logger = logging.getLogger(__name__)


def _normalize_tags(tags: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in tags or []:
        token = str(raw or "").strip().lower()
        if not token:
            continue
        variants = {token, token.replace(" ", "_"), token.replace(" ", "-")}
        for variant in variants:
            if variant and variant not in seen:
                seen.add(variant)
                normalized.append(variant)
    return normalized

def configure_cloudinary():
    """Configure Cloudinary globally from settings if available."""
    cloud_name = getattr(settings, "cloudinary_cloud_name", "")
    api_key = getattr(settings, "cloudinary_api_key", "")
    api_secret = getattr(settings, "cloudinary_api_secret", "")

    if not cloud_name or not api_key or not api_secret:
        logger.warning("Cloudinary credentials not configured.")
        return False
    
    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True
    )
    return True

async def search_assets_by_tag(folder: str, tags: list[str], limit: int = 5) -> list[dict]:
    """
    Search Cloudinary for assets inside a specific folder matching any given tags.
    
    Example query: 'folder:music AND (tags:happy OR tags:upbeat)'
    """
    if not configure_cloudinary():
        return []

    try:
        normalized_tags = _normalize_tags(tags)
        tag_query = " OR ".join(f"tags:{tag}" for tag in normalized_tags) if normalized_tags else ""
        resource_expr = "(resource_type:video OR resource_type:raw)"
        expressions: list[str] = []
        base_folder_expr = f"folder:{folder}"
        nested_expr = f"public_id:{folder}/*"

        if tag_query:
            expressions.append(f"{base_folder_expr} AND ({tag_query}) AND {resource_expr}")
            expressions.append(f"{nested_expr} AND ({tag_query}) AND {resource_expr}")
            # Final fallback: tag-only search if folder tagging is inconsistent.
            expressions.append(f"({tag_query}) AND {resource_expr}")

        expressions.append(f"{base_folder_expr} AND {resource_expr}")
        expressions.append(f"{nested_expr} AND {resource_expr}")

        resources: list[dict] = []
        for query in expressions:
            logger.info("Cloudinary search query: %s", query)
            try:
                result = cloudinary.search.Search() \
                    .expression(query) \
                    .max_results(limit) \
                    .execute()
                resources = result.get("resources", [])
                if resources:
                    break
            except Exception as query_error:
                logger.warning("Cloudinary query failed (%s): %s", query, query_error)
                continue

        assets: list[dict] = []
        seen_names: set[str] = set()
        for res in resources:
            name = str(res.get("public_id", "Unknown"))
            if name in seen_names:
                continue
            seen_names.add(name)
            assets.append({
                "name": name,
                "file_url": res.get("secure_url") or res.get("url"),
                "duration": float(res.get("duration", 0) or 0),
                "tags": [str(tag).lower() for tag in (res.get("tags") or []) if isinstance(tag, str)],
                "type": res.get("resource_type"),  # e.g., 'video', 'raw'
                "format": res.get("format"),
            })
             
        logger.info("Found %d %s assets from Cloudinary.", len(assets), folder)
        return assets
    except Exception as e:
        logger.error("Cloudinary search failed: %s", e)
        return []
