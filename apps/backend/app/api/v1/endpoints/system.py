from fastapi import APIRouter, HTTPException
import httpx
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class ReleaseAsset(BaseModel):
    name: str
    browser_download_url: str
    size: int
    content_type: str

class LatestReleaseResponse(BaseModel):
    version: str
    name: str
    body: str
    published_at: str
    html_url: str
    assets: List[ReleaseAsset]

@router.get("/latest-release", response_model=LatestReleaseResponse)
async def get_latest_release() -> LatestReleaseResponse:
    """
    Fetch the latest release information from the Sbjiwala GitHub repository.
    This is used by the auto-updater in the mobile apps and the web download page.
    """
    url = "https://api.github.com/repos/vikukumar/sbjiwala/releases/latest"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url, 
                headers={
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "Sbjiwala-Backend-App/1.0"
                },
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()
            
            assets = [
                ReleaseAsset(
                    name=asset["name"],
                    browser_download_url=asset["browser_download_url"],
                    size=asset["size"],
                    content_type=asset["content_type"]
                ) for asset in data.get("assets", [])
            ]
            
            return LatestReleaseResponse(
                version=data.get("tag_name", "").lstrip("v"),
                name=data.get("name", ""),
                body=data.get("body", ""),
                published_at=data.get("published_at", ""),
                html_url=data.get("html_url", ""),
                assets=assets
            )
    except httpx.HTTPError as e:
        detail_msg = f"Error communicating with GitHub API: {str(e)}"
        if hasattr(e, "response") and e.response is not None:
            detail_msg += f" (Status: {e.response.status_code}, Body: {e.response.text})"
        raise HTTPException(status_code=502, detail=detail_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
