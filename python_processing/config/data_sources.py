"""Configuration for data sources (USGS Earth Explorer, ESA Copernicus)."""

from typing import Dict, Any
from dataclasses import dataclass
import os


@dataclass
class DataSourceConfig:
    """Configuration for satellite data sources."""
    
    name: str
    base_url: str
    api_key: str = ""
    timeout: int = 300
    max_retries: int = 3
    batch_size: int = 100
    supported_platforms: list = None
    default_bands: list = None
    
    def __post_init__(self):
        if self.supported_platforms is None:
            self.supported_platforms = []
        if self.default_bands is None:
            self.default_bands = []


class USGSConfig(DataSourceConfig):
    """USGS Earth Explorer configuration."""
    
    def __init__(self):
        api_key = os.getenv('USGS_API_KEY', '')
        super().__init__(
            name="USGS Earth Explorer",
            base_url="https://ers.cr.usgs.gov/register/",
            api_key=api_key,
            timeout=300,
            supported_platforms=[
                "Landsat-8", "Landsat-9", "Landsat-7", "Landsat-5", 
                "Landsat-4", "Landsat-1", "Landsat-2", "Landsat-3"
            ],
            default_bands=[
                "B1", "B2", "B3", "B4", "B5", "B6", "B7", "BQA"
            ]
        )


class ESAConfig(DataSourceConfig):
    """ESA Copernicus configuration."""
    
    def __init__(self):
        api_key = os.getenv('ESA_API_KEY', '')
        super().__init__(
            name="ESA Copernicus",
            base_url="https://scihub.copernicus.eu/apihub/",
            api_key=api_key,
            timeout=600,
            supported_platforms=[
                "Sentinel-2", "Sentinel-1", "Sentinel-3", "ERS-1", 
                "ERS-2", "Envisat", "SMOS", "CryoSat"
            ],
            default_bands=[
                "B01", "B02", "B03", "B04", "B05", "B06", "B07", 
                "B08", "B8A", "B09", "B10", "B11", "B12"
            ]
        )


class LandsatConfig:
    """Landsat-specific configuration."""
    
    # Band definitions for Landsat 8/9
    LANDSAT8_BANDS = {
        "B1": {"name": "Coastal/Aerosol", "wavelength": "0.43-0.45 μm", "resolution": 30},
        "B2": {"name": "Blue", "wavelength": "0.45-0.52 μm", "resolution": 30},
        "B3": {"name": "Green", "wavelength": "0.52-0.60 μm", "resolution": 30},
        "B4": {"name": "Red", "wavelength": "0.63-0.68 μm", "resolution": 30},
        "B5": {"name": "NIR", "wavelength": "0.84-0.87 μm", "resolution": 30},
        "B6": {"name": "SWIR1", "wavelength": "1.56-1.66 μm", "resolution": 30},
        "B7": {"name": "SWIR2", "wavelength": "2.10-2.30 μm", "resolution": 30},
        "B8": {"name": "PAN", "wavelength": "0.50-0.68 μm", "resolution": 15},
        "B9": {"name": "Cirrus", "wavelength": "1.36-1.38 μm", "resolution": 30},
        "B10": {"name": "TIRS-1", "wavelength": "10.6-11.2 μm", "resolution": 100},
        "B11": {"name": "TIRS-2", "wavelength": "11.5-12.5 μm", "resolution": 100},
    }
    
    # Processing levels
    LANDSAT_PROCESSING_LEVELS = [
        "L1TP", "L1GT", "L1GS", "L2SP", "L2GS", "L2SR"
    ]
    
    # Band combinations for different applications
    BAND_COMBINATIONS = {
        "natural_color": ["B4", "B3", "B2"],
        "false_color": ["B5", "B4", "B3"],
        "ndvi": ["B5", "B4"],
        "nbr": ["B7", "B5"],
        "tcg": ["B5", "B3", "B2"],
        "urban": ["B7", "B5", "B4"],
        "water": ["B5", "B3", "B2"],
        "agriculture": ["B6", "B5", "B2"],
        "geology": ["B7", "B4", "B2"]
    }


class SentinelConfig:
    """Sentinel-specific configuration."""
    
    # Band definitions for Sentinel-2
    SENTINEL2_BANDS = {
        "B01": {"name": "Coastal/Aerosol", "wavelength": "0.443 μm", "resolution": 60},
        "B02": {"name": "Blue", "wavelength": "0.490 μm", "resolution": 10},
        "B03": {"name": "Green", "wavelength": "0.560 μm", "resolution": 10},
        "B04": {"name": "Red", "wavelength": "0.665 μm", "resolution": 10},
        "B05": {"name": "Red Edge 1", "wavelength": "0.705 μm", "resolution": 20},
        "B06": {"name": "Red Edge 2", "wavelength": "0.740 μm", "resolution": 20},
        "B07": {"name": "Red Edge 3", "wavelength": "0.783 μm", "resolution": 20},
        "B08": {"name": "NIR", "wavelength": "0.842 μm", "resolution": 10},
        "B8A": {"name": "Red Edge 4", "wavelength": "0.865 μm", "resolution": 20},
        "B09": {"name": "Water Vapor", "wavelength": "0.945 μm", "resolution": 60},
        "B10": {"name": "Cirrus", "wavelength": "1.375 μm", "resolution": 60},
        "B11": {"name": "SWIR1", "wavelength": "1.610 μm", "resolution": 20},
        "B12": {"name": "SWIR2", "wavelength": "2.190 μm", "resolution": 20},
    }
    
    # Processing levels
    SENTINEL_PROCESSING_LEVELS = [
        "L1C", "L2A"
    ]
    
    # Tile size and projection
    TILE_SIZE_KM = 100
    PROJECTION = "EPSG:3857"


def get_data_source_configs() -> Dict[str, DataSourceConfig]:
    """Get all configured data sources."""
    return {
        "usgs": USGSConfig(),
        "esa": ESAConfig()
    }