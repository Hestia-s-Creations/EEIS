"""USGS Earth Explorer API client for satellite data acquisition."""

import requests
import time
import logging
from typing import Dict, List, Optional, Any
from pathlib import Path
from datetime import datetime, timedelta
from urllib.parse import urlencode
import json

from ..config import Settings


logger = logging.getLogger(__name__)


class USGSClient:
    """Client for interacting with USGS Earth Explorer API."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = "https://m2m.cr.usgs.gov/api/api/json/stable"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': f'SatellitePipeline/{settings.VERSION}',
            'Accept': 'application/json'
        })
        self._authenticated = False
        self._token = None
    
    def authenticate(self) -> bool:
        """Authenticate with USGS API."""
        if not self.settings.USGS_API_KEY:
            logger.error("USGS API key not provided")
            return False
        
        try:
            # Login to get session token
            login_data = {
                'username': 'earthexplorer_user',
                'password': self.settings.USGS_API_KEY
            }
            
            response = self.session.post(
                f"{self.base_url}/login",
                json=login_data,
                timeout=self.settings.USGS_REQUEST_TIMEOUT
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('code') == 'AUTH000':
                    self._token = data.get('data')
                    self._authenticated = True
                    logger.info("Successfully authenticated with USGS")
                    return True
                else:
                    logger.error(f"USGS authentication failed: {data.get('message')}")
                    return False
            else:
                logger.error(f"USGS login request failed: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"USGS authentication error: {e}")
            return False
    
    def search_scenes(self, 
                     dataset: str,
                     latitude: float,
                     longitude: float,
                     start_date: datetime,
                     end_date: datetime,
                     cloud_cover: Optional[float] = None) -> List[Dict[str, Any]]:
        """Search for satellite scenes in USGS catalog."""
        
        if not self._authenticated and not self.authenticate():
            logger.error("USGS not authenticated")
            return []
        
        try:
            # Define search criteria
            search_criteria = {
                'datasetName': dataset,
                'sceneFilter': {
                    'spatialFilter': {
                        'filterType': 'mbr',
                        'lowerLeft': {
                            'latitude': latitude,
                            'longitude': longitude
                        },
                        'upperRight': {
                            'latitude': latitude,
                            'longitude': longitude
                        }
                    },
                    'temporalFilter': {
                        'startDate': start_date.strftime('%Y-%m-%d'),
                        'endDate': end_date.strftime('%Y-%m-%d')
                    }
                }
            }
            
            if cloud_cover is not None:
                search_criteria['sceneFilter']['cloudCoverFilter'] = {
                    'max': cloud_cover,
                    'min': 0
                }
            
            # Perform search
            response = self.session.post(
                f"{self.base_url}/scene-search",
                json={'datasetName': dataset, **search_criteria},
                timeout=self.settings.USGS_REQUEST_TIMEOUT
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('code') == 'SCENES000':
                    scenes = data.get('data', {}).get('results', [])
                    logger.info(f"Found {len(scenes)} scenes for {dataset}")
                    return scenes
                else:
                    logger.error(f"Scene search failed: {data.get('message')}")
                    return []
            else:
                logger.error(f"Scene search request failed: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Scene search error: {e}")
            return []
    
    def get_download_urls(self, scene_ids: List[str], dataset: str) -> Dict[str, str]:
        """Get download URLs for scenes."""
        
        if not self._authenticated:
            logger.error("USGS not authenticated")
            return {}
        
        try:
            # Request download URLs
            download_data = {
                'datasetName': dataset,
                'sceneIds': scene_ids
            }
            
            response = self.session.post(
                f"{self.base_url}/download-request",
                json=download_data,
                timeout=self.settings.USGS_REQUEST_TIMEOUT
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('code') == 'DOWNLOAD000':
                    downloads = data.get('data', {}).get('downloadUrls', {})
                    logger.info(f"Got download URLs for {len(downloads)} scenes")
                    return downloads
                else:
                    logger.error(f"Download request failed: {data.get('message')}")
                    return {}
            else:
                logger.error(f"Download request failed: {response.status_code}")
                return {}
                
        except Exception as e:
            logger.error(f"Download request error: {e}")
            return {}
    
    def download_scene(self, 
                      download_url: str,
                      output_path: Path,
                      scene_id: str) -> bool:
        """Download a single scene."""
        
        try:
            logger.info(f"Downloading scene {scene_id}")
            
            response = self.session.get(download_url, stream=True, timeout=3600)
            response.raise_for_status()
            
            # Create output directory
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Download file
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            logger.info(f"Successfully downloaded {scene_id} to {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error downloading scene {scene_id}: {e}")
            return False
    
    def get_dataset_info(self, dataset: str) -> Dict[str, Any]:
        """Get information about a dataset."""
        
        if not self._authenticated and not self.authenticate():
            logger.error("USGS not authenticated")
            return {}
        
        try:
            response = self.session.get(
                f"{self.base_url}/dataset-categories",
                timeout=self.settings.USGS_REQUEST_TIMEOUT
            )
            
            if response.status_code == 200:
                data = response.json()
                datasets = data.get('data', {})
                
                # Find the specific dataset
                for category in datasets:
                    for ds in category.get('datasets', []):
                        if ds.get('datasetName') == dataset:
                            return ds
                
                logger.warning(f"Dataset {dataset} not found")
                return {}
            else:
                logger.error(f"Dataset info request failed: {response.status_code}")
                return {}
                
        except Exception as e:
            logger.error(f"Dataset info error: {e}")
            return {}
    
    def search_landsat_scenes(self,
                            latitude: float,
                            longitude: float,
                            start_date: datetime,
                            end_date: datetime,
                            processing_level: str = "L2SP",
                            cloud_cover: Optional[float] = None) -> List[Dict[str, Any]]:
        """Search for Landsat scenes with convenience method."""
        
        dataset = f"landsat_ot_c2_l2"  # Landsat 8-9 Collection 2 Level-2
        
        return self.search_scenes(
            dataset=dataset,
            latitude=latitude,
            longitude=longitude,
            start_date=start_date,
            end_date=end_date,
            cloud_cover=cloud_cover
        )
    
    def logout(self):
        """Logout from USGS API."""
        try:
            if self._authenticated and self._token:
                self.session.post(
                    f"{self.base_url}/logout",
                    json={'sessionId': self._token},
                    timeout=self.settings.USGS_REQUEST_TIMEOUT
                )
                logger.info("Successfully logged out from USGS")
        except Exception as e:
            logger.warning(f"Logout error: {e}")
        finally:
            self._authenticated = False
            self._token = None