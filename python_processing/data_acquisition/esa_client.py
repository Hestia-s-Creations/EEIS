"""ESA Copernicus API client for satellite data acquisition."""

import requests
import time
import logging
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
from datetime import datetime, timedelta
from urllib.parse import urlencode, quote
import json
import os

from ..config import Settings


logger = logging.getLogger(__name__)


class ESAClient:
    """Client for interacting with ESA Copernicus Open Access Hub API."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = "https://scihub.copernicus.eu/dhus"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': f'SatellitePipeline/{settings.VERSION}',
            'Accept': 'application/json'
        })
        self._authenticated = False
    
    def authenticate(self) -> bool:
        """Authenticate with ESA API."""
        if not self.settings.ESA_API_KEY:
            logger.error("ESA API key not provided")
            return False
        
        try:
            # Setup authentication
            self.session.auth = ('sentinelhub', self.settings.ESA_API_KEY)
            
            # Test authentication by getting user info
            response = self.session.get(
                f"{self.base_url}/whoami",
                timeout=self.settings.ESA_REQUEST_TIMEOUT
            )
            
            if response.status_code == 200:
                self._authenticated = True
                logger.info("Successfully authenticated with ESA Copernicus")
                return True
            else:
                logger.error(f"ESA authentication failed: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"ESA authentication error: {e}")
            return False
    
    def search_products(self,
                       platform: str,
                       bbox: Tuple[float, float, float, float],
                       start_date: datetime,
                       end_date: datetime,
                       cloud_cover: Optional[float] = None,
                       processing_level: Optional[str] = None,
                       max_records: int = 100) -> List[Dict[str, Any]]:
        """Search for satellite products in ESA catalog."""
        
        if not self._authenticated and not self.authenticate():
            logger.error("ESA not authenticated")
            return []
        
        try:
            # Build query
            query_parts = [f'platformname:{platform}']
            
            # Add spatial filter
            if bbox:
                lon_min, lat_min, lon_max, lat_max = bbox
                query_parts.append(
                    f'footprint:"Intersects(POLYGON(({lon_min} {lat_min},{lon_max} {lat_min},{lon_max} {lat_max},{lon_min} {lat_max},{lon_min} {lat_min})))"'
                )
            
            # Add temporal filter
            query_parts.append(
                f'beginPosition:[{start_date.strftime("%Y-%m-%dT%H:%M:%S.%fZ")} TO {end_date.strftime("%Y-%m-%dT%H:%M:%S.%fZ")}]'
            )
            
            # Add cloud cover filter
            if cloud_cover is not None:
                query_parts.append(f'cloudCoverPercentage:[0 TO {cloud_cover}]')
            
            # Add processing level filter
            if processing_level:
                query_parts.append(f'processinglevel:{processing_level}')
            
            query = " AND ".join(query_parts)
            
            # Search parameters
            search_params = {
                'q': query,
                'rows': max_records,
                'format': 'json',
                'orderby': 'beginposition desc'
            }
            
            # Perform search
            response = self.session.get(
                f"{self.base_url}/search",
                params=search_params,
                timeout=self.settings.ESA_REQUEST_TIMEOUT
            )
            
            if response.status_code == 200:
                data = response.json()
                products = data.get('feed', {}).get('entry', [])
                
                if not isinstance(products, list):
                    products = [products] if products else []
                
                logger.info(f"Found {len(products)} products for {platform}")
                return products
            else:
                logger.error(f"Product search failed: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Product search error: {e}")
            return []
    
    def get_product_info(self, product_id: str) -> Dict[str, Any]:
        """Get detailed information about a product."""
        
        if not self._authenticated:
            logger.error("ESA not authenticated")
            return {}
        
        try:
            response = self.session.get(
                f"{self.base_url}/odata/v1/Products('{product_id}')",
                timeout=self.settings.ESA_REQUEST_TIMEOUT
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Got product info for {product_id}")
                return data
            else:
                logger.error(f"Product info request failed: {response.status_code}")
                return {}
                
        except Exception as e:
            logger.error(f"Product info error: {e}")
            return {}
    
    def get_product_download_url(self, product_id: str) -> Optional[str]:
        """Get download URL for a product."""
        
        try:
            # Use the OData API to get the download URL
            response = self.session.get(
                f"{self.base_url}/odata/v1/Products('{product_id}')/Value",
                timeout=self.settings.ESA_REQUEST_TIMEOUT
            )
            
            if response.status_code == 200:
                data = response.json()
                download_url = f"{self.base_url}/odata/v1/Products('{product_id}')/$value"
                logger.info(f"Got download URL for {product_id}")
                return download_url
            else:
                logger.error(f"Download URL request failed: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Download URL error: {e}")
            return None
    
    def download_product(self,
                        product_id: str,
                        output_path: Path) -> bool:
        """Download a single product."""
        
        try:
            download_url = self.get_product_download_url(product_id)
            if not download_url:
                return False
            
            logger.info(f"Downloading product {product_id}")
            
            # Create output directory
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Download file
            response = self.session.get(download_url, stream=True, timeout=3600)
            response.raise_for_status()
            
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            logger.info(f"Successfully downloaded {product_id} to {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error downloading product {product_id}: {e}")
            return False
    
    def search_sentinel2_scenes(self,
                              bbox: Tuple[float, float, float, float],
                              start_date: datetime,
                              end_date: datetime,
                              cloud_cover: Optional[float] = None,
                              processing_level: str = "L2A") -> List[Dict[str, Any]]:
        """Search for Sentinel-2 scenes with convenience method."""
        
        return self.search_products(
            platform="Sentinel-2",
            bbox=bbox,
            start_date=start_date,
            end_date=end_date,
            cloud_cover=cloud_cover,
            processing_level=processing_level
        )
    
    def search_sentinel1_scenes(self,
                              bbox: Tuple[float, float, float, float],
                              start_date: datetime,
                              end_date: datetime,
                              polarization: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search for Sentinel-1 scenes with convenience method."""
        
        return self.search_products(
            platform="Sentinel-1",
            bbox=bbox,
            start_date=start_date,
            end_date=end_date
        )
    
    def get_mission_status(self) -> Dict[str, Any]:
        """Get ESA mission status information."""
        
        try:
            response = self.session.get(
                f"{self.base_url}/status",
                timeout=self.settings.ESA_REQUEST_TIMEOUT
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Mission status request failed: {response.status_code}")
                return {}
                
        except Exception as e:
            logger.error(f"Mission status error: {e}")
            return {}
    
    def logout(self):
        """Logout from ESA API."""
        self._authenticated = False
        logger.info("Logged out from ESA Copernicus")