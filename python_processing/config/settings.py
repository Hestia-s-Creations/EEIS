"""Main configuration settings for satellite processing pipeline."""

import os
from typing import Dict, Any
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Settings:
    """Global settings for the satellite processing pipeline."""
    
    # Application settings
    APP_NAME: str = "satellite_pipeline"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Data directories
    DATA_DIR: Path = Path("./data")
    RAW_DATA_DIR: Path = DATA_DIR / "raw"
    PROCESSED_DATA_DIR: Path = DATA_DIR / "processed"
    RESULTS_DIR: Path = DATA_DIR / "results"
    
    # Database settings
    DATABASE_URL: str = "sqlite:///satellite_data.db"
    
    # Processing parameters
    MAX_WORKERS: int = 4
    MEMORY_LIMIT_GB: int = 16
    DISK_CACHE_SIZE_GB: int = 50
    
    # Quality control thresholds
    CLOUD_COVERAGE_THRESHOLD: float = 0.3
    PIXEL_QUALITY_SCORE_THRESHOLD: float = 0.7
    CONFIDENCE_SCORE_THRESHOLD: float = 0.8
    
    # Time series parameters
    MIN_TIME_SERIES_LENGTH: int = 10
    MAX_TIME_GAP_DAYS: int = 365
    
    # Change detection parameters
    LANDTRENDR_MIN_SEGMENTS: int = 5
    LANDTRENDR_MAX_SEGMENTS: int = 10
    NDVI_THRESHOLD: float = 0.2
    NBR_THRESHOLD: float = 0.15
    TCG_THRESHOLD: float = 0.1
    
    # Processing intervals
    PROCESSING_INTERVAL_HOURS: int = 24
    CLEANUP_INTERVAL_DAYS: int = 7
    
    # API settings
    USGS_REQUEST_TIMEOUT: int = 300
    ESA_REQUEST_TIMEOUT: int = 600
    MAX_RETRIES: int = 3
    RETRY_DELAY: int = 30
    
    def __post_init__(self):
        """Create necessary directories after initialization."""
        for dir_path in [self.DATA_DIR, self.RAW_DATA_DIR, 
                        self.PROCESSED_DATA_DIR, self.RESULTS_DIR]:
            dir_path.mkdir(parents=True, exist_ok=True)
    
    @classmethod
    def from_env(cls) -> 'Settings':
        """Load settings from environment variables."""
        return cls(
            DEBUG=os.getenv('DEBUG', 'false').lower() == 'true',
            DATABASE_URL=os.getenv('DATABASE_URL', 'sqlite:///satellite_data.db'),
            MAX_WORKERS=int(os.getenv('MAX_WORKERS', '4')),
            MEMORY_LIMIT_GB=int(os.getenv('MEMORY_LIMIT_GB', '16'))
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert settings to dictionary."""
        return {key: value for key, value in self.__dict__.items() 
                if not key.startswith('_')}