"""Data acquisition modules for satellite data sources."""

from .usgs_client import USGSClient
from .esa_client import ESAClient
from .download_manager import DownloadManager

__all__ = ['USGSClient', 'ESAClient', 'DownloadManager']