"""
Map service for geocoding, reverse geocoding, distance calculation and geo-fencing.
"""
import math
import structlog
from typing import Optional, Dict, Any, List
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
from shapely.geometry import shape, Point

from app.core.config import settings

logger = structlog.get_logger()


class MapService:
    def __init__(self):
        # Initialize Nominatim geocoder with a unique user agent
        self.geocoder = Nominatim(user_agent="sbjiwala_backend_app")

    async def geocode(self, address: str) -> Optional[Dict[str, Any]]:
        """
        Geocode a text address to latitude, longitude and formatted address.
        """
        try:
            # Nominatim is blocking, so run it in a thread-safe wrapper or directly
            # For FastAPI async simplicity, we can do it directly. In production, wrap in run_in_executor
            import anyio.to_thread
            from functools import partial
            location = await anyio.to_thread.run_sync(
                partial(self.geocoder.geocode, address, timeout=5)
            )
            if location:
                return {
                    "latitude": location.latitude,
                    "longitude": location.longitude,
                    "formatted_address": location.address,
                }
        except (GeocoderTimedOut, GeocoderServiceError) as e:
            logger.error("Geocoding failed", error=str(e), address=address)
        return None

    async def reverse_geocode(self, latitude: float, longitude: float) -> Optional[str]:
        """
        Reverse geocode coordinates to a formatted address.
        """
        try:
            import anyio.to_thread
            from functools import partial
            location = await anyio.to_thread.run_sync(
                partial(self.geocoder.reverse, (latitude, longitude), timeout=5)
            )
            if location:
                return location.address
        except (GeocoderTimedOut, GeocoderServiceError) as e:
            logger.error("Reverse geocoding failed", error=str(e), lat=latitude, lon=longitude)
        return None

    @staticmethod
    def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate straight-line distance in kilometers using the Haversine formula.
        """
        R = 6371.0  # Earth radius in kilometers

        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = math.sin(delta_phi / 2.0) ** 2 + \
            math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

        return R * c

    async def calculate_road_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate road distance in kilometers using OSRM. Fallbacks to Haversine on failure.
        """
        import httpx
        url = f"http://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("routes"):
                        # OSRM returns distance in meters, convert to kilometers
                        return data["routes"][0]["distance"] / 1000.0
        except Exception as e:
            logger.warning("OSRM distance calculation failed, using Haversine fallback", error=str(e))
        
        return self.calculate_haversine_distance(lat1, lon1, lat2, lon2)

    @staticmethod
    def is_inside_polygon(latitude: float, longitude: float, polygon_geojson: Dict[str, Any]) -> bool:
        """
        Check if a given coordinate point is inside a GeoJSON polygon.
        """
        try:
            point = Point(longitude, latitude)  # Shapely uses (x, y) i.e. (longitude, latitude)
            polygon = shape(polygon_geojson)
            return polygon.contains(point)
        except Exception as e:
            logger.error("Polygon containment check failed", error=str(e))
            return False
