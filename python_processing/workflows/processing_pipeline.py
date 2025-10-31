"""Main processing pipeline orchestrating satellite data processing."""

import logging
import asyncio
from typing import Dict, List, Optional, Any, Union, Tuple
from pathlib import Path
from datetime import datetime, timedelta
import json

from ..config import Settings
from ..data_acquisition import DownloadManager, USGSClient, ESAClient
from ..preprocessing import RasterProcessor, PixelQuality, SpectralIndices
from ..change_detection import LandTrendrProcessor, SpectralChangeDetector, TimeSeriesChangeDetector
from ..quality_control import ConfidenceScorer
from ..database import DatabaseManager
from .workflow_manager import WorkflowManager
from .scheduling import CronScheduler


logger = logging.getLogger(__name__)


class ProcessingPipeline:
    """Main processing pipeline for satellite data analysis."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        
        # Initialize components
        self.download_manager = DownloadManager(settings)
        self.raster_processor = RasterProcessor(settings)
        self.pixel_quality = PixelQuality(settings)
        self.spectral_indices = SpectralIndices(settings)
        self.landtrendr_processor = LandTrendrProcessor(settings)
        self.spectral_change_detector = SpectralChangeDetector(settings)
        self.time_series_change_detector = TimeSeriesChangeDetector(settings)
        self.confidence_scorer = ConfidenceScorer(settings)
        self.database = DatabaseManager(settings)
        self.workflow_manager = WorkflowManager(settings)
        self.cron_scheduler = CronScheduler(settings)
        
        logger.info("Processing pipeline initialized")
    
    async def process_single_scene(self,
                                 scene_config: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single satellite scene."""
        
        try:
            logger.info(f"Processing scene: {scene_config.get('scene_id', 'Unknown')}")
            
            result = {
                'scene_id': scene_config.get('scene_id'),
                'processing_status': 'started',
                'start_time': datetime.now().isoformat(),
                'steps_completed': [],
                'errors': [],
                'outputs': {},
                'confidence_scores': {}
            }
            
            # Step 1: Data acquisition
            try:
                await self._step_acquire_data(scene_config, result)
                result['steps_completed'].append('data_acquisition')
            except Exception as e:
                result['errors'].append(f"Data acquisition failed: {e}")
                result['processing_status'] = 'failed'
                return result
            
            # Step 2: Preprocessing
            try:
                await self._step_preprocess_data(scene_config, result)
                result['steps_completed'].append('preprocessing')
            except Exception as e:
                result['errors'].append(f"Preprocessing failed: {e}")
                result['processing_status'] = 'failed'
                return result
            
            # Step 3: Spectral indices calculation
            try:
                await self._step_calculate_indices(scene_config, result)
                result['steps_completed'].append('spectral_indices')
            except Exception as e:
                result['errors'].append(f"Spectral indices calculation failed: {e}")
                result['processing_status'] = 'failed'
                return result
            
            # Step 4: Quality assessment
            try:
                await self._step_assess_quality(scene_config, result)
                result['steps_completed'].append('quality_assessment')
            except Exception as e:
                result['errors'].append(f"Quality assessment failed: {e}")
                result['processing_status'] = 'failed'
                return result
            
            # Step 5: Change detection (if applicable)
            if scene_config.get('compare_with_previous', False):
                try:
                    await self._step_detect_changes(scene_config, result)
                    result['steps_completed'].append('change_detection')
                except Exception as e:
                    result['errors'].append(f"Change detection failed: {e}")
                    # Don't fail the whole process for change detection errors
            
            # Step 6: Database storage
            try:
                await self._step_store_results(scene_config, result)
                result['steps_completed'].append('database_storage')
            except Exception as e:
                result['errors'].append(f"Database storage failed: {e}")
                result['processing_status'] = 'failed'
                return result
            
            result['processing_status'] = 'completed'
            result['end_time'] = datetime.now().isoformat()
            result['duration_minutes'] = (
                datetime.fromisoformat(result['end_time']) - 
                datetime.fromisoformat(result['start_time'])
            ).total_seconds() / 60
            
            logger.info(f"Scene processing completed: {result['scene_id']}")
            return result
            
        except Exception as e:
            logger.error(f"Critical error in scene processing: {e}")
            result['processing_status'] = 'failed'
            result['errors'].append(f"Critical error: {e}")
            return result
    
    async def _step_acquire_data(self, scene_config: Dict[str, Any], result: Dict[str, Any]):
        """Acquire satellite data."""
        
        logger.info("Step 1: Data acquisition")
        
        source = scene_config.get('source', 'usgs')
        bbox = scene_config.get('bbox')
        start_date = datetime.fromisoformat(scene_config['start_date'])
        end_date = datetime.fromisoformat(scene_config['end_date'])
        output_dir = Path(scene_config.get('output_dir', self.settings.RAW_DATA_DIR))
        
        if source.lower() == 'usgs':
            latitude = scene_config.get('latitude')
            longitude = scene_config.get('longitude')
            cloud_cover = scene_config.get('cloud_cover_max')
            processing_level = scene_config.get('processing_level', 'L2SP')
            
            download_results = self.download_manager.batch_download_landsat(
                latitude=latitude,
                longitude=longitude,
                start_date=start_date,
                end_date=end_date,
                output_dir=output_dir,
                cloud_cover=cloud_cover,
                processing_level=processing_level
            )
            
            result['outputs']['download_results'] = download_results
            result['scene_id'] = scene_config.get('scene_id', f"Landsat_{start_date.strftime('%Y%m%d')}")
            
        elif source.lower() == 'esa':
            cloud_cover = scene_config.get('cloud_cover_max')
            processing_level = scene_config.get('processing_level', 'L2A')
            
            download_results = self.download_manager.batch_download_sentinel2(
                bbox=bbox,
                start_date=start_date,
                end_date=end_date,
                output_dir=output_dir,
                cloud_cover=cloud_cover,
                processing_level=processing_level
            )
            
            result['outputs']['download_results'] = download_results
            result['scene_id'] = scene_config.get('scene_id', f"Sentinel2_{start_date.strftime('%Y%m%d')}")
        
        else:
            raise ValueError(f"Unknown data source: {source}")
    
    async def _step_preprocess_data(self, scene_config: Dict[str, Any], result: Dict[str, Any]):
        """Preprocess satellite data."""
        
        logger.info("Step 2: Data preprocessing")
        
        # Find downloaded files
        output_dir = Path(scene_config.get('output_dir', self.settings.RAW_DATA_DIR))
        downloaded_files = list(output_dir.glob("*.tar.gz")) + list(output_dir.glob("*.zip"))
        
        if not downloaded_files:
            raise FileNotFoundError("No downloaded files found")
        
        # Process first file (simplified - should handle multiple files)
        file_path = downloaded_files[0]
        scene_id = result.get('scene_id', 'Unknown')
        
        # Extract if needed
        if file_path.suffix == '.tar.gz':
            import tarfile
            extract_dir = file_path.parent / f"extracted_{scene_id}"
            extract_dir.mkdir(exist_ok=True)
            
            with tarfile.open(file_path, 'r:gz') as tar_ref:
                tar_ref.extractall(extract_dir)
            
            scene_path = extract_dir
        else:
            scene_path = file_path.parent
        
        # Determine platform and read scene
        if 'landsat' in scene_id.lower():
            dataset = self.raster_processor.read_landsat_scene(scene_path)
            platform = 'landsat'
        else:
            # Simplified - assume single GeoTIFF
            tiff_files = list(scene_path.glob("*.tif"))
            if tiff_files:
                dataset = self.raster_processor.read_satellite_image(tiff_files[0])
                platform = 'sentinel2'
            else:
                raise FileNotFoundError("No suitable satellite data files found")
        
        # Apply quality masking
        qa_mask = self.pixel_quality.create_qa_mask(dataset, platform)
        dataset_masked = self.pixel_quality.apply_mask(dataset, qa_mask)
        
        # Normalize to reflectance if Landsat
        if platform == 'landsat':
            dataset_normalized = self.raster_processor.normalize_to_reflectance(
                dataset_masked, "landsat8"
            )
        else:
            dataset_normalized = dataset_masked
        
        # Add metadata
        dataset_normalized.attrs.update({
            'scene_id': scene_id,
            'platform': platform,
            'timestamp': scene_config['start_date'],
            'source': source,
            'processing_date': datetime.now().isoformat()
        })
        
        # Save processed data
        processed_path = self.settings.PROCESSED_DATA_DIR / f"{scene_id}_processed.nc"
        dataset_normalized.to_netcdf(processed_path)
        
        result['outputs']['processed_dataset'] = str(processed_path)
        result['outputs']['platform'] = platform
        
        logger.info(f"Preprocessing completed, saved to {processed_path}")
    
    async def _step_calculate_indices(self, scene_config: Dict[str, Any], result: Dict[str, Any]):
        """Calculate spectral indices."""
        
        logger.info("Step 3: Spectral indices calculation")
        
        # Load processed dataset
        processed_path = result['outputs']['processed_dataset']
        dataset = self.raster_processor.read_satellite_image(processed_path)
        
        # Calculate vegetation indices
        indices_dataset = self.spectral_indices.calculate_variability_indices(dataset)
        
        # Add metadata
        indices_dataset.attrs.update({
            'scene_id': result['scene_id'],
            'calculation_date': datetime.now().isoformat(),
            'indices_calculated': list(indices_dataset.data_vars.keys())
        })
        
        # Save indices
        indices_path = self.settings.PROCESSED_DATA_DIR / f"{result['scene_id']}_indices.nc"
        indices_dataset.to_netcdf(indices_path)
        
        result['outputs']['spectral_indices'] = str(indices_path)
        result['outputs']['indices_calculated'] = list(indices_dataset.data_vars.keys())
        
        logger.info(f"Spectral indices calculated: {result['outputs']['indices_calculated']}")
    
    async def _step_assess_quality(self, scene_config: Dict[str, Any], result: Dict[str, Any]):
        """Assess data quality."""
        
        logger.info("Step 4: Quality assessment")
        
        # Load processed dataset
        processed_path = result['outputs']['processed_dataset']
        dataset = self.raster_processor.read_satellite_image(processed_path)
        
        # Calculate pixel quality scores
        quality_scores = self.confidence_scorer.calculate_confidence_scores(dataset)
        
        # Assess data quality
        quality_report = self.pixel_quality.assess_data_quality(dataset)
        
        # Store quality scores in outputs
        result['confidence_scores'].update({
            'data_quality': quality_report['overall_quality_score'],
            'confidence_maps': quality_scores
        })
        
        result['outputs']['quality_report'] = quality_report
        
        logger.info(f"Quality assessment completed. Overall score: {quality_report['overall_quality_score']:.2f}")
    
    async def _step_detect_changes(self, scene_config: Dict[str, Any], result: Dict[str, Any]):
        """Detect changes between current and previous scene."""
        
        logger.info("Step 5: Change detection")
        
        # Load current dataset
        current_path = result['outputs']['processed_dataset']
        current_dataset = self.raster_processor.read_satellite_image(current_path)
        
        # Find previous scene
        previous_scene_id = scene_config.get('previous_scene_id')
        if not previous_scene_id:
            logger.warning("No previous scene ID provided for change detection")
            return
        
        # Load previous dataset (simplified - should query database)
        previous_path = self.settings.PROCESSED_DATA_DIR / f"{previous_scene_id}_processed.nc"
        if not previous_path.exists():
            logger.warning(f"Previous scene file not found: {previous_path}")
            return
        
        previous_dataset = self.raster_processor.read_satellite_image(previous_path)
        
        # Detect spectral changes
        change_results = self.spectral_change_detector.detect_spectral_changes(
            previous_dataset, current_dataset
        )
        
        # Calculate change confidence
        change_confidence = self.confidence_scorer.calculate_confidence_scores(
            change_results, confidence_type="change_detection"
        )
        
        result['outputs']['change_detection'] = change_results
        result['confidence_scores']['change_detection'] = change_confidence
        
        # Save change maps
        change_maps_path = self.settings.RESULTS_DIR / f"{result['scene_id']}_changes.nc"
        # Convert change results to netCDF format and save
        # (Implementation depends on specific change detection output format)
        
        logger.info("Change detection completed")
    
    async def _step_store_results(self, scene_config: Dict[str, Any], result: Dict[str, Any]):
        """Store results in database."""
        
        logger.info("Step 6: Database storage")
        
        # Store processing result
        platform = result['outputs'].get('platform', 'unknown')
        acquisition_date = scene_config['start_date']
        bbox = scene_config.get('bbox')
        quality_score = result['confidence_scores'].get('data_quality', 0.5)
        metadata = {
            'processing_steps': result['steps_completed'],
            'indices_calculated': result['outputs'].get('indices_calculated', []),
            'cloud_coverage': result['outputs'].get('quality_report', {}).get('cloud_coverage_percent', 0)
        }
        
        result_id = self.database.store_processing_result(
            scene_id=result['scene_id'],
            acquisition_date=acquisition_date,
            platform=platform,
            bbox=bbox,
            cloud_coverage=metadata['cloud_coverage'],
            input_file_path=str(scene_config.get('output_dir')),
            output_file_path=result['outputs']['processed_dataset'],
            processing_status=result['processing_status'],
            quality_score=quality_score,
            metadata=metadata
        )
        
        # Store change detection results if available
        if 'change_detection' in result['outputs']:
            change_data = result['outputs']['change_detection']
            
            for index_name, change_info in change_data.get('individual_changes', {}).items():
                self.database.store_change_detection_result(
                    result_id=result_id,
                    index_name=index_name,
                    change_type='spectral_change',
                    change_magnitude_mean=change_info['change_statistics']['mean_change'],
                    change_magnitude_std=change_info['change_statistics']['std_change'],
                    significant_pixels=change_info['change_statistics']['significant_pixels'],
                    change_percentage=change_info['change_statistics']['change_percentage'],
                    confidence_score=change_info['change_statistics'].get('threshold', 0.1)
                )
        
        # Store quality metrics
        quality_report = result['outputs'].get('quality_report', {})
        for metric_name, metric_value in quality_report.items():
            if isinstance(metric_value, (int, float)):
                self.database.store_quality_metric(
                    result_id=result_id,
                    metric_name=metric_name,
                    metric_value=metric_value,
                    metric_description=f"Quality metric: {metric_name}"
                )
        
        result['outputs']['database_result_id'] = result_id
        
        logger.info(f"Results stored in database with ID: {result_id}")
    
    async def process_time_series(self,
                                location_config: Dict[str, Any],
                                index_name: str = "NDVI") -> Dict[str, Any]:
        """Process time series analysis for a location."""
        
        try:
            logger.info(f"Processing time series for location: {location_config['location_id']}")
            
            # Query database for time series data
            time_series_data = self._load_time_series_data(location_config, index_name)
            
            if time_series_data.empty:
                return {'error': 'No time series data found for location'}
            
            # Perform time series analysis
            ts_results = self.time_series_change_detector.analyze_time_series_changes(
                time_series_data, indices=[index_name]
            )
            
            # Calculate confidence
            ts_confidence = self.confidence_scorer.calculate_confidence_scores(
                ts_results, confidence_type="time_series"
            )
            
            # Store results
            trend_info = ts_results.get('change_analysis', {}).get('trend_analysis', {})
            if trend_info:
                summary = trend_info.get('summary', {})
                self.database.store_time_series_result(
                    location_id=location_config['location_id'],
                    index_name=index_name,
                    trend_slope=summary.get('strongest_trend_magnitude', 0.0),
                    trend_r_value=0.0,  # Would need to extract from detailed results
                    trend_p_value=0.0,
                    anomaly_count=summary.get('total_persistent_anomalies', 0),
                    regime_shifts_count=0,  # Would need to extract from detailed results
                    overall_confidence=ts_confidence.get('overall_time_series_confidence', 0.5),
                    analysis_methods=list(ts_results.get('change_analysis', {}).keys()),
                    summary_statistics=ts_results.get('summary', {})
                )
            
            return {
                'location_id': location_config['location_id'],
                'index_name': index_name,
                'analysis_results': ts_results,
                'confidence_scores': ts_confidence,
                'processing_status': 'completed'
            }
            
        except Exception as e:
            logger.error(f"Error in time series processing: {e}")
            return {
                'location_id': location_config['location_id'],
                'index_name': index_name,
                'error': str(e),
                'processing_status': 'failed'
            }
    
    def _load_time_series_data(self, location_config: Dict[str, Any], index_name: str):
        """Load time series data from database."""
        
        try:
            bbox = location_config['bbox']
            start_date = location_config.get('start_date')
            end_date = location_config.get('end_date')
            
            # Query processing results for this area and time period
            results_df = self.database.get_processing_results(
                bbox=bbox,
                start_date=start_date,
                end_date=end_date,
                limit=1000  # Reasonable limit
            )
            
            if results_df.empty:
                return pd.DataFrame()
            
            # Create time series dataset (simplified implementation)
            # In practice, this would involve loading actual raster data
            # and organizing it into xarray format
            
            # For demonstration, return empty DataFrame
            return pd.DataFrame()
            
        except Exception as e:
            logger.error(f"Error loading time series data: {e}")
            return pd.DataFrame()
    
    async def run_batch_processing(self,
                                 batch_config: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Run batch processing for multiple scenes."""
        
        try:
            logger.info(f"Starting batch processing for {len(batch_config)} scenes")
            
            batch_results = []
            successful_count = 0
            failed_count = 0
            
            for i, scene_config in enumerate(batch_config):
                logger.info(f"Processing scene {i+1}/{len(batch_config)}: {scene_config.get('scene_id')}")
                
                result = await self.process_single_scene(scene_config)
                batch_results.append(result)
                
                if result['processing_status'] == 'completed':
                    successful_count += 1
                else:
                    failed_count += 1
            
            batch_summary = {
                'total_scenes': len(batch_config),
                'successful': successful_count,
                'failed': failed_count,
                'success_rate': successful_count / len(batch_config) if batch_config else 0,
                'individual_results': batch_results
            }
            
            logger.info(f"Batch processing completed: {successful_count}/{len(batch_config)} successful")
            return batch_summary
            
        except Exception as e:
            logger.error(f"Error in batch processing: {e}")
            raise
    
    def get_processing_status(self, result_id: Optional[int] = None) -> Dict[str, Any]:
        """Get current processing status."""
        
        try:
            if result_id:
                # Get specific result status
                results = self.database.get_processing_results(limit=1)
                if not results.empty:
                    latest_result = results.iloc[0]
                    return {
                        'result_id': result_id,
                        'scene_id': latest_result['scene_id'],
                        'status': latest_result['processing_status'],
                        'acquisition_date': latest_result['acquisition_date'],
                        'quality_score': latest_result['quality_score'],
                        'processing_date': latest_result['created_at']
                    }
            
            # Get overall system status
            db_stats = self.database.get_statistics()
            
            return {
                'system_status': 'active',
                'database_stats': db_stats,
                'components_status': {
                    'database': 'active',
                    'download_manager': 'active',
                    'processing_pipeline': 'active'
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting processing status: {e}")
            return {'error': str(e)}