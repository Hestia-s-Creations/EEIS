#!/usr/bin/env python3
"""NASA FIRMS (Fire Information for Resource Management System) API client.

Polls the FIRMS API for active fire hotspots within watershed bounding boxes.
Uses VIIRS_SNPP_NRT (375m resolution) for near-real-time fire detection.

FIRMS API docs: https://firms.modaps.eosdis.nasa.gov/api/area/
Free MAP_KEY registration: https://firms.modaps.eosdis.nasa.gov/api/area/

Usage as standalone script (receives JSON via stdin, outputs JSON to stdout):
    echo '{"watersheds": [...], "map_key": "...", "days": 2}' | python firms_client.py

Usage as library:
    from fire_detection.firms_client import FIRMSClient
    client = FIRMSClient(map_key="YOUR_KEY")
    hotspots = client.check_watershed(bbox, days=2)
"""

import csv
import io
import json
import logging
import sys
from dataclasses import asdict, dataclass
from typing import Dict, List, Optional
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

logger = logging.getLogger(__name__)

FIRMS_BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
DEFAULT_SOURCE = "VIIRS_SNPP_NRT"


@dataclass
class FireHotspot:
    """A single fire detection from FIRMS."""
    latitude: float
    longitude: float
    brightness: float
    confidence: str  # "nominal", "high", "low"
    frp: float  # Fire Radiative Power (MW)
    acq_date: str
    acq_time: str
    satellite: str
    daynight: str  # "D" or "N"


class FIRMSClient:
    """Client for the NASA FIRMS active fire API."""

    def __init__(self, map_key: str, source: str = DEFAULT_SOURCE, timeout: int = 30):
        self.map_key = map_key
        self.source = source
        self.timeout = timeout

    def check_watershed(
        self,
        bbox: Dict[str, float],
        days: int = 2,
    ) -> List[FireHotspot]:
        """Check for active fire hotspots within a bounding box.

        Args:
            bbox: Dict with keys 'west', 'south', 'east', 'north' (decimal degrees).
            days: Number of days to look back (1-10).

        Returns:
            List of FireHotspot objects found within the bbox.
        """
        area = f"{bbox['west']},{bbox['south']},{bbox['east']},{bbox['north']}"
        url = f"{FIRMS_BASE_URL}/{self.map_key}/{self.source}/{area}/{days}"

        logger.info(f"Querying FIRMS: {url}")

        try:
            req = Request(url)
            req.add_header("User-Agent", "EEIS/1.0")
            with urlopen(req, timeout=self.timeout) as response:
                content = response.read().decode("utf-8")
        except HTTPError as e:
            logger.error(f"FIRMS API error: {e.code} {e.reason}")
            return []
        except URLError as e:
            logger.error(f"FIRMS connection error: {e.reason}")
            return []

        return self._parse_csv(content)

    def check_multiple_watersheds(
        self,
        watersheds: List[Dict],
        days: int = 2,
    ) -> Dict[str, List[FireHotspot]]:
        """Check multiple watersheds for fire hotspots.

        Args:
            watersheds: List of dicts with 'id' and 'bbox' keys.
            days: Number of days to look back.

        Returns:
            Dict mapping watershed_id to list of hotspots.
        """
        results = {}
        for ws in watersheds:
            ws_id = ws["id"]
            bbox = ws.get("bbox")
            if not bbox:
                logger.warning(f"Watershed {ws_id} has no bbox, skipping")
                continue
            hotspots = self.check_watershed(bbox, days=days)
            if hotspots:
                results[ws_id] = hotspots
                logger.info(f"Found {len(hotspots)} hotspots in watershed {ws_id}")
        return results

    def _parse_csv(self, content: str) -> List[FireHotspot]:
        """Parse FIRMS CSV response into FireHotspot objects."""
        hotspots = []
        reader = csv.DictReader(io.StringIO(content))

        for row in reader:
            try:
                hotspots.append(FireHotspot(
                    latitude=float(row.get("latitude", 0)),
                    longitude=float(row.get("longitude", 0)),
                    brightness=float(row.get("bright_ti4", row.get("brightness", 0))),
                    confidence=row.get("confidence", "nominal"),
                    frp=float(row.get("frp", 0)),
                    acq_date=row.get("acq_date", ""),
                    acq_time=row.get("acq_time", ""),
                    satellite=row.get("satellite", self.source),
                    daynight=row.get("daynight", ""),
                ))
            except (ValueError, KeyError) as e:
                logger.warning(f"Skipping malformed FIRMS row: {e}")

        return hotspots


def process(input_data: Dict) -> Dict:
    """Entry point for the job queue bridge.

    Expected input:
        {
            "map_key": "YOUR_FIRMS_MAP_KEY",
            "watersheds": [{"id": "...", "bbox": {"west": ..., "south": ..., "east": ..., "north": ...}}],
            "days": 2
        }

    Returns:
        {
            "success": true,
            "fire_events": [{"watershed_id": "...", "hotspots": [...]}],
            "total_hotspots": N
        }
    """
    map_key = input_data.get("map_key")
    if not map_key:
        return {"success": False, "error": "FIRMS map_key is required"}

    watersheds = input_data.get("watersheds", [])
    days = input_data.get("days", 2)

    print("PROGRESS:10", file=sys.stderr)

    client = FIRMSClient(map_key=map_key)
    results = client.check_multiple_watersheds(watersheds, days=days)

    print("PROGRESS:80", file=sys.stderr)

    fire_events = []
    total_hotspots = 0
    for ws_id, hotspots in results.items():
        total_hotspots += len(hotspots)
        fire_events.append({
            "watershed_id": ws_id,
            "hotspots": [asdict(h) for h in hotspots],
        })

    print("PROGRESS:100", file=sys.stderr)

    return {
        "success": True,
        "fire_events": fire_events,
        "total_hotspots": total_hotspots,
        "message": f"Found {total_hotspots} hotspots across {len(results)} watersheds",
    }


if __name__ == "__main__":
    try:
        input_str = sys.stdin.read()
        input_data = json.loads(input_str) if input_str else {}
        result = process(input_data)
        print(json.dumps(result))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
