"""Download manager for handling batch satellite data downloads."""

import logging
import asyncio
import aiohttp
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime
import concurrent.futures
import threading
from queue import Queue
import time

from .usgs_client import USGSClient
from .esa_client import ESAClient
from ..config import Settings


logger = logging.getLogger(__name__)


class DownloadManager:
    """Manager for handling satellite data downloads from multiple sources."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.usgs_client = USGSClient(settings)
        self.esa_client = ESAClient(settings)
        self.download_queue = Queue()
        self.active_downloads = {}
        self.completed_downloads = []
        self.failed_downloads = []
        self._lock = threading.Lock()
    
    def add_download(self,
                    source: str,
                    scene_id: str,
                    download_url: str,
                    output_path: Path,
                    metadata: Optional[Dict[str, Any]] = None):
        """Add a download to the queue."""
        
        download_info = {
            'source': source,
            'scene_id': scene_id,
            'download_url': download_url,
            'output_path': output_path,
            'metadata': metadata or {},
            'status': 'queued',
            'start_time': None,
            'end_time': None,
            'progress': 0,
            'error_message': None
        }
        
        self.download_queue.put(download_info)
        logger.info(f"Added download to queue: {scene_id} from {source}")
    
    def start_downloads(self, max_workers: Optional[int] = None) -> Dict[str, Any]:
        """Start processing the download queue with concurrent workers."""
        
        if max_workers is None:
            max_workers = self.settings.MAX_WORKERS
        
        logger.info(f"Starting downloads with {max_workers} workers")
        
        results = {
            'total_downloads': 0,
            'successful_downloads': 0,
            'failed_downloads': 0,
            'start_time': datetime.now(),
            'end_time': None,
            'duration_seconds': 0
        }
        
        # Initialize workers
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = []
            
            # Submit download tasks
            while not self.download_queue.empty():
                download_info = self.download_queue.get()
                results['total_downloads'] += 1
                
                future = executor.submit(self._download_worker, download_info)
                futures.append((future, download_info))
            
            # Wait for all downloads to complete
            for future, download_info in futures:
                try:
                    success = future.result(timeout=3600)  # 1 hour timeout per download
                    
                    if success:
                        results['successful_downloads'] += 1
                        with self._lock:
                            self.completed_downloads.append(download_info)
                    else:
                        results['failed_downloads'] += 1
                        with self._lock:
                            self.failed_downloads.append(download_info)
                            
                except Exception as e:
                    logger.error(f"Download worker error for {download_info['scene_id']}: {e}")
                    results['failed_downloads'] += 1
                    download_info['error_message'] = str(e)
                    with self._lock:
                        self.failed_downloads.append(download_info)
        
        results['end_time'] = datetime.now()
        results['duration_seconds'] = (results['end_time'] - results['start_time']).total_seconds()
        
        logger.info(f"Download completed: {results['successful_downloads']}/{results['total_downloads']} successful")
        return results
    
    def _download_worker(self, download_info: Dict[str, Any]) -> bool:
        """Worker function for downloading a single file."""
        
        scene_id = download_info['scene_id']
        source = download_info['source']
        download_url = download_info['download_url']
        output_path = download_info['output_path']
        
        download_info['status'] = 'downloading'
        download_info['start_time'] = datetime.now()
        
        try:
            if source == 'usgs':
                success = self.usgs_client.download_scene(
                    download_url, output_path, scene_id
                )
            elif source == 'esa':
                success = self.esa_client.download_product(
                    scene_id, output_path
                )
            else:
                logger.error(f"Unknown source: {source}")
                return False
            
            download_info['status'] = 'completed' if success else 'failed'
            download_info['end_time'] = datetime.now()
            download_info['progress'] = 100 if success else 0
            
            return success
            
        except Exception as e:
            logger.error(f"Error downloading {scene_id}: {e}")
            download_info['status'] = 'failed'
            download_info['error_message'] = str(e)
            download_info['end_time'] = datetime.now()
            return False
    
    def batch_download_landsat(self,
                              latitude: float,
                              longitude: float,
                              start_date: datetime,
                              end_date: datetime,
                              output_dir: Path,
                              cloud_cover: Optional[float] = None,
                              processing_level: str = "L2SP") -> Dict[str, Any]:
        """Batch download Landsat scenes."""
        
        logger.info(f"Starting batch Landsat download for ({latitude}, {longitude})")
        
        # Search for scenes
        scenes = self.usgs_client.search_landsat_scenes(
            latitude=latitude,
            longitude=longitude,
            start_date=start_date,
            end_date=end_date,
            processing_level=processing_level,
            cloud_cover=cloud_cover
        )
        
        if not scenes:
            logger.warning("No Landsat scenes found")
            return {'total_downloads': 0, 'successful_downloads': 0, 'failed_downloads': 0}
        
        # Get download URLs
        scene_ids = [scene.get('entityId') for scene in scenes if scene.get('entityId')]
        download_urls = self.usgs_client.get_download_urls(scene_ids, "landsat_ot_c2_l2")
        
        # Add downloads to queue
        for scene_id, url in download_urls.items():
            # Create filename
            scene_info = next((s for s in scenes if s.get('entityId') == scene_id), {})
            if scene_info:
                date_str = scene_info.get('displayId', '').split('_')[-1][:8] if scene_info.get('displayId') else 'unknown'
                filename = f"{scene_id}_{date_str}.tar.gz"
            else:
                filename = f"{scene_id}.tar.gz"
            
            output_path = output_dir / filename
            
            self.add_download(
                source='usgs',
                scene_id=scene_id,
                download_url=url,
                output_path=output_path,
                metadata=scene_info
            )
        
        # Start downloads
        return self.start_downloads()
    
    def batch_download_sentinel2(self,
                               bbox: tuple,
                               start_date: datetime,
                               end_date: datetime,
                               output_dir: Path,
                               cloud_cover: Optional[float] = None,
                               processing_level: str = "L2A") -> Dict[str, Any]:
        """Batch download Sentinel-2 products."""
        
        logger.info(f"Starting batch Sentinel-2 download for bbox {bbox}")
        
        # Search for products
        products = self.esa_client.search_sentinel2_scenes(
            bbox=bbox,
            start_date=start_date,
            end_date=end_date,
            cloud_cover=cloud_cover,
            processing_level=processing_level
        )
        
        if not products:
            logger.warning("No Sentinel-2 products found")
            return {'total_downloads': 0, 'successful_downloads': 0, 'failed_downloads': 0}
        
        # Add downloads to queue
        for product in products:
            product_id = product.get('id', '')
            if product_id:
                # Create filename
                title = product.get('title', product_id)
                filename = f"{title}.zip"
                output_path = output_dir / filename
                
                self.add_download(
                    source='esa',
                    scene_id=product_id,
                    download_url=None,  # Will be generated by ESA client
                    output_path=output_path,
                    metadata=product
                )
        
        # Start downloads
        return self.start_downloads()
    
    def get_download_status(self) -> Dict[str, Any]:
        """Get current download status."""
        
        return {
            'queue_size': self.download_queue.qsize(),
            'active_downloads': len(self.active_downloads),
            'completed_downloads': len(self.completed_downloads),
            'failed_downloads': len(self.failed_downloads),
            'recent_failures': [
                {
                    'scene_id': d['scene_id'],
                    'source': d['source'],
                    'error': d['error_message'],
                    'end_time': d['end_time']
                }
                for d in self.failed_downloads[-10:]  # Last 10 failures
            ]
        }
    
    def clear_completed(self):
        """Clear completed and failed downloads from memory."""
        
        with self._lock:
            self.completed_downloads.clear()
            self.failed_downloads.clear()
        
        logger.info("Cleared download history")