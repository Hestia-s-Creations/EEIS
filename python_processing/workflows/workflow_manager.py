"""Workflow manager for automated processing chains."""

import logging
import asyncio
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, timedelta
from pathlib import Path
import json

from ..config import Settings


logger = logging.getLogger(__name__)


class WorkflowManager:
    """Manager for automated processing workflows."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.active_workflows = {}
        self.workflow_registry = {}
        self._register_default_workflows()
    
    def _register_default_workflows(self):
        """Register default workflow templates."""
        
        self.workflow_registry = {
            'monthly_landsat_processing': self._create_monthly_landsat_workflow(),
            'sentinel2_change_detection': self._create_sentinel2_change_workflow(),
            'watershed_monitoring': self._create_watershed_monitoring_workflow(),
            'annual_time_series': self._create_annual_timeseries_workflow()
        }
    
    def _create_monthly_landsat_workflow(self) -> Dict[str, Any]:
        """Create monthly Landsat processing workflow."""
        
        return {
            'name': 'monthly_landsat_processing',
            'description': 'Monthly Landsat data processing for change detection',
            'steps': [
                {
                    'name': 'acquire_data',
                    'function': 'download_manager.batch_download_landsat',
                    'parameters': {
                        'cloud_cover_max': 30,
                        'processing_level': 'L2SP'
                    }
                },
                {
                    'name': 'preprocess_data',
                    'function': 'raster_processor.preprocess_landsat_scene',
                    'parameters': {
                        'normalize_reflectance': True,
                        'apply_cloud_mask': True
                    }
                },
                {
                    'name': 'calculate_indices',
                    'function': 'spectral_indices.calculate_variability_indices',
                    'parameters': {
                        'indices': ['NDVI', 'NBR', 'TCG', 'NDWI']
                    }
                },
                {
                    'name': 'quality_assessment',
                    'function': 'confidence_scorer.calculate_confidence_scores',
                    'parameters': {
                        'confidence_type': 'composite'
                    }
                },
                {
                    'name': 'store_results',
                    'function': 'database.store_processing_result',
                    'parameters': {}
                }
            ],
            'schedule': '0 2 1 * *',  # First day of each month at 2 AM
            'trigger_conditions': {
                'new_data_available': True,
                'processing_queue_empty': True
            }
        }
    
    def _create_sentinel2_change_workflow(self) -> Dict[str, Any]:
        """Create Sentinel-2 change detection workflow."""
        
        return {
            'name': 'sentinel2_change_detection',
            'description': 'Bi-weekly Sentinel-2 change detection',
            'steps': [
                {
                    'name': 'acquire_current_data',
                    'function': 'download_manager.batch_download_sentinel2',
                    'parameters': {
                        'cloud_cover_max': 20,
                        'processing_level': 'L2A'
                    }
                },
                {
                    'name': 'get_previous_scene',
                    'function': 'database.get_latest_processing_result',
                    'parameters': {
                        'platform': 'Sentinel-2',
                        'max_age_days': 15
                    }
                },
                {
                    'name': 'detect_changes',
                    'function': 'spectral_change_detector.detect_spectral_changes',
                    'parameters': {
                        'indices': ['NDVI', 'NBR', 'NDWI'],
                        'disturbance_types': ['deforestation', 'burn', 'flood']
                    }
                },
                {
                    'name': 'calculate_change_confidence',
                    'function': 'confidence_scorer.calculate_confidence_scores',
                    'parameters': {
                        'confidence_type': 'change_detection'
                    }
                },
                {
                    'name': 'store_change_results',
                    'function': 'database.store_change_detection_result',
                    'parameters': {}
                }
            ],
            'schedule': '0 4 * * 1,15',  # Every other Monday at 4 AM
            'trigger_conditions': {
                'minimum_cloud_free_days': 3,
                'data_availability': True
            }
        }
    
    def _create_watershed_monitoring_workflow(self) -> Dict[str, Any]:
        """Create watershed monitoring workflow."""
        
        return {
            'name': 'watershed_monitoring',
            'description': 'Weekly watershed health monitoring',
            'steps': [
                {
                    'name': 'collect_weekly_data',
                    'function': 'download_manager.batch_download_multi_source',
                    'parameters': {
                        'sources': ['usgs', 'esa'],
                        'cloud_cover_max': 25
                    }
                },
                {
                    'name': 'standardize_data',
                    'function': 'raster_processor.reproject_to_common_grid',
                    'parameters': {
                        'target_crs': 'EPSG:4326',
                        'target_resolution': 30
                    }
                },
                {
                    'name': 'calculate_comprehensive_indices',
                    'function': 'spectral_indices.calculate_variability_indices',
                    'parameters': {
                        'indices': ['NDVI', 'NBR', 'TCG', 'TCW', 'EVI', 'NDWI', 'NDSI', 'SAVI']
                    }
                },
                {
                    'name': 'assess_water_quality_indicators',
                    'function': 'quality_control.assess_water_quality',
                    'parameters': {
                        'indicators': ['turbidity', 'vegetation_cover', 'sediment_load']
                    }
                },
                {
                    'name': 'update_time_series',
                    'function': 'time_series_processor.update_watershed_time_series',
                    'parameters': {}
                },
                {
                    'name': 'generate_health_report',
                    'function': 'reporting.generate_watershed_health_report',
                    'parameters': {}
                }
            ],
            'schedule': '0 6 * * 1',  # Every Monday at 6 AM
            'trigger_conditions': {
                'weather_conditions': 'clear',
                'minimum_data_coverage': 80
            }
        }
    
    def _create_annual_timeseries_workflow(self) -> Dict[str, Any]:
        """Create annual time series analysis workflow."""
        
        return {
            'name': 'annual_time_series',
            'description': 'Annual comprehensive time series analysis',
            'steps': [
                {
                    'name': 'collect_annual_data',
                    'function': 'database.get_processing_results',
                    'parameters': {
                        'year': 'current',
                        'complete_year': True
                    }
                },
                {
                    'name': 'fit_landtrendr_models',
                    'function': 'landtrendr_processor.fit_landtrendr',
                    'parameters': {
                        'index_name': 'NDVI',
                        'max_segments': 10,
                        'min_segments': 5
                    }
                },
                {
                    'name': 'detect_regime_shifts',
                    'function': 'time_series_change_detector.detect_regime_shifts',
                    'parameters': {
                        'method': 'cusum'
                    }
                },
                {
                    'name': 'analyze_trends',
                    'function': 'time_series_change_detector.analyze_trends',
                    'parameters': {
                        'indices': ['NDVI', 'NBR', 'TCG']
                    }
                },
                {
                    'name': 'generate_annual_report',
                    'function': 'reporting.generate_annual_report',
                    'parameters': {}
                }
            ],
            'schedule': '0 8 1 1 *',  # January 1st at 8 AM
            'trigger_conditions': {
                'complete_year_data': True,
                'processing_completed': True
            }
        }
    
    def register_workflow(self, workflow_config: Dict[str, Any]) -> str:
        """Register a custom workflow."""
        
        workflow_name = workflow_config.get('name')
        if not workflow_name:
            raise ValueError("Workflow must have a name")
        
        self.workflow_registry[workflow_name] = workflow_config
        logger.info(f"Registered workflow: {workflow_name}")
        
        return workflow_name
    
    def execute_workflow(self, 
                        workflow_name: str,
                        parameters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute a workflow with given parameters."""
        
        if workflow_name not in self.workflow_registry:
            raise ValueError(f"Workflow not found: {workflow_name}")
        
        workflow_config = self.workflow_registry[workflow_name]
        parameters = parameters or {}
        
        workflow_id = f"{workflow_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        self.active_workflows[workflow_id] = {
            'name': workflow_name,
            'start_time': datetime.now(),
            'status': 'running',
            'steps_completed': [],
            'current_step': None,
            'errors': [],
            'results': {}
        }
        
        logger.info(f"Starting workflow: {workflow_name} (ID: {workflow_id})")
        
        try:
            # Execute workflow steps
            for step in workflow_config['steps']:
                self.active_workflows[workflow_id]['current_step'] = step['name']
                
                # Check trigger conditions
                if not self._check_trigger_conditions(step, workflow_config):
                    logger.warning(f"Skipping step {step['name']} - trigger conditions not met")
                    continue
                
                # Execute step
                step_result = self._execute_step(step, parameters)
                
                if step_result['success']:
                    self.active_workflows[workflow_id]['steps_completed'].append(step['name'])
                    self.active_workflows[workflow_id]['results'][step['name']] = step_result
                else:
                    self.active_workflows[workflow_id]['errors'].append({
                        'step': step['name'],
                        'error': step_result['error']
                    })
                    
                    # Decide whether to continue based on error severity
                    if step_result.get('critical', False):
                        break
            
            # Update workflow status
            if self.active_workflows[workflow_id]['errors']:
                self.active_workflows[workflow_id]['status'] = 'completed_with_errors'
            else:
                self.active_workflows[workflow_id]['status'] = 'completed'
            
            self.active_workflows[workflow_id]['end_time'] = datetime.now()
            
            logger.info(f"Workflow completed: {workflow_name} (ID: {workflow_id})")
            return self.active_workflows[workflow_id]
            
        except Exception as e:
            logger.error(f"Error executing workflow {workflow_name}: {e}")
            self.active_workflows[workflow_id]['status'] = 'failed'
            self.active_workflows[workflow_id]['errors'].append({
                'workflow': str(e),
                'critical': True
            })
            return self.active_workflows[workflow_id]
    
    def _execute_step(self, step: Dict[str, Any], parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single workflow step."""
        
        step_name = step['name']
        step_function = step['function']
        step_parameters = {**step['parameters'], **parameters}
        
        try:
            logger.info(f"Executing step: {step_name}")
            
            # This is a simplified implementation
            # In practice, you would need to resolve the function and execute it
            # For now, we'll simulate step execution
            
            if 'download_manager' in step_function:
                result = {'success': True, 'data': 'Download completed'}
            elif 'preprocess' in step_function:
                result = {'success': True, 'data': 'Preprocessing completed'}
            elif 'calculate' in step_function:
                result = {'success': True, 'data': 'Calculation completed'}
            elif 'store' in step_function:
                result = {'success': True, 'data': 'Storage completed'}
            else:
                result = {'success': True, 'data': 'Step completed'}
            
            result['step_name'] = step_name
            result['execution_time'] = datetime.now()
            
            return result
            
        except Exception as e:
            logger.error(f"Error in step {step_name}: {e}")
            return {
                'success': False,
                'error': str(e),
                'step_name': step_name,
                'critical': False
            }
    
    def _check_trigger_conditions(self, step: Dict[str, Any], workflow_config: Dict[str, Any]) -> bool:
        """Check if trigger conditions are met for a step."""
        
        trigger_conditions = workflow_config.get('trigger_conditions', {})
        
        # Check simple trigger conditions
        for condition, expected_value in trigger_conditions.items():
            if condition == 'processing_queue_empty':
                # Check if processing queue is empty
                continue  # Simplified
            elif condition == 'new_data_available':
                # Check for new data availability
                continue  # Simplified
            elif condition == 'weather_conditions':
                # Check weather conditions (would need weather API)
                continue  # Simplified
            elif condition == 'minimum_data_coverage':
                # Check data coverage requirements
                continue  # Simplified
            elif condition == 'complete_year_data':
                # Check if complete year data is available
                continue  # Simplified
        
        return True
    
    def get_workflow_status(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific workflow."""
        
        return self.active_workflows.get(workflow_id)
    
    def list_active_workflows(self) -> List[Dict[str, Any]]:
        """List all active workflows."""
        
        return list(self.active_workflows.values())
    
    def cancel_workflow(self, workflow_id: str) -> bool:
        """Cancel a running workflow."""
        
        if workflow_id in self.active_workflows:
            self.active_workflows[workflow_id]['status'] = 'cancelled'
            self.active_workflows[workflow_id]['end_time'] = datetime.now()
            logger.info(f"Cancelled workflow: {workflow_id}")
            return True
        
        return False
    
    def get_workflow_history(self, workflow_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get workflow execution history."""
        
        # This would typically query a database or log file
        # For now, return active workflows as demonstration
        workflows = list(self.active_workflows.values())
        
        if workflow_name:
            workflows = [w for w in workflows if w['name'] == workflow_name]
        
        return workflows