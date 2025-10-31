"""Cron scheduler for automated processing jobs."""

import logging
import asyncio
import schedule
import time
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, timedelta
import threading
from pathlib import Path
import json
import os

from ..config import Settings
from .workflow_manager import WorkflowManager


logger = logging.getLogger(__name__)


class CronScheduler:
    """Scheduler for automated processing jobs using cron-like expressions."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.workflow_manager = WorkflowManager(settings)
        self.scheduled_jobs = {}
        self.running_jobs = {}
        self.is_running = False
        self.scheduler_thread = None
        self._job_counter = 0
    
    def add_job(self, job_config: Dict[str, Any]) -> str:
        """Add a new scheduled job."""
        
        job_id = f"job_{self._job_counter}"
        self._job_counter += 1
        
        # Validate job configuration
        required_fields = ['name', 'command', 'schedule']
        for field in required_fields:
            if field not in job_config:
                raise ValueError(f"Job configuration missing required field: {field}")
        
        # Parse schedule expression
        schedule_obj = self._parse_schedule(job_config['schedule'])
        
        job_info = {
            'id': job_id,
            'name': job_config['name'],
            'command': job_config['command'],
            'schedule': job_config['schedule'],
            'schedule_obj': schedule_obj,
            'parameters': job_config.get('parameters', {}),
            'created_at': datetime.now(),
            'last_run': None,
            'next_run': self._calculate_next_run(schedule_obj),
            'run_count': 0,
            'success_count': 0,
            'failure_count': 0,
            'status': 'scheduled',
            'enabled': job_config.get('enabled', True)
        }
        
        self.scheduled_jobs[job_id] = job_info
        
        # Schedule the job
        schedule_obj.do(self._execute_job_wrapper, job_id=job_id)
        
        logger.info(f"Added scheduled job: {job_config['name']} (ID: {job_id})")
        logger.info(f"Next run scheduled for: {job_info['next_run']}")
        
        return job_id
    
    def _parse_schedule(self, schedule_expression: str) -> schedule:
        """Parse cron-like schedule expression into schedule object."""
        
        # Handle common cron patterns
        if schedule_expression == '0 2 * * *':  # Daily at 2 AM
            return schedule.every().day.at("02:00")
        elif schedule_expression == '0 6 * * *':  # Daily at 6 AM
            return schedule.every().day.at("06:00")
        elif schedule_expression == '0 0 * * 1':  # Weekly on Monday at midnight
            return schedule.every().monday.at("00:00")
        elif schedule_expression == '0 0 1 * *':  # Monthly on 1st at midnight
            return schedule.every().month.do(self._monthly_job)
        elif schedule_expression == '0 0 1 1 *':  # Yearly on Jan 1st at midnight
            return schedule.every().year.on(datetime.now().month, datetime.now().day).at("00:00")
        elif schedule_expression.startswith('0') and schedule_expression.count(' ') == 4:
            # Handle basic 5-field cron expression
            return self._parse_cron_expression(schedule_expression)
        else:
            # For custom schedules, try to parse as time string
            try:
                return schedule.every().day.at(schedule_expression)
            except:
                raise ValueError(f"Invalid schedule expression: {schedule_expression}")
    
    def _parse_cron_expression(self, cron_expr: str) -> schedule:
        """Parse 5-field cron expression (minute hour day month weekday)."""
        
        fields = cron_expr.split()
        if len(fields) != 5:
            raise ValueError(f"Invalid cron expression: {cron_expr}")
        
        minute, hour, day, month, weekday = fields
        
        # This is a simplified implementation
        # For full cron support, you would need a more robust parser
        
        if day == '*' and month == '*' and weekday != '*':
            # Weekly scheduling
            weekday_map = {
                '0': 'sunday', '1': 'monday', '2': 'tuesday', '3': 'wednesday',
                '4': 'thursday', '5': 'friday', '6': 'saturday'
            }
            if weekday in weekday_map:
                if hour == '*':
                    return getattr(schedule.every(), weekday_map[weekday])
                else:
                    return getattr(schedule.every(), weekday_map[weekday]).at(f"{hour.zfill(2)}:00")
        
        elif weekday == '*' and month == '*' and day != '*':
            # Monthly scheduling
            if day.isdigit():
                return schedule.every().month.do(self._monthly_job).on(day)
        
        elif day == '*' and weekday == '*' and month != '*':
            # Yearly scheduling
            if month.isdigit():
                return schedule.every().year.on(int(month), 1).at("00:00")
        
        # For other cases, default to daily
        if hour != '*':
            return schedule.every().day.at(f"{hour.zfill(2)}:00")
        else:
            return schedule.every().day.at("02:00")
    
    def _monthly_job(self):
        """Handler for monthly jobs - will be called with job_id."""
        pass
    
    def _calculate_next_run(self, schedule_obj: schedule) -> datetime:
        """Calculate next run time for a scheduled job."""
        
        # This is a simplified calculation
        # The actual implementation would depend on the schedule library
        return datetime.now() + timedelta(hours=24)  # Default to 24 hours
    
    def _execute_job_wrapper(self, job_id: str):
        """Wrapper for job execution with error handling."""
        
        try:
            self._execute_job(job_id)
        except Exception as e:
            logger.error(f"Error executing job {job_id}: {e}")
    
    def _execute_job(self, job_id: str):
        """Execute a scheduled job."""
        
        if job_id not in self.scheduled_jobs:
            logger.error(f"Job not found: {job_id}")
            return
        
        job_info = self.scheduled_jobs[job_id]
        
        if not job_info['enabled']:
            logger.info(f"Job {job_info['name']} is disabled, skipping execution")
            return
        
        # Check if job is already running
        if job_id in self.running_jobs:
            logger.warning(f"Job {job_info['name']} is already running, skipping")
            return
        
        # Mark job as running
        self.running_jobs[job_id] = {
            'start_time': datetime.now(),
            'status': 'running'
        }
        
        logger.info(f"Starting scheduled job: {job_info['name']} (ID: {job_id})")
        
        try:
            # Execute the job based on command type
            if job_info['command'] == 'process-monthly-data':
                result = self._execute_monthly_processing(job_info)
            elif job_info['command'] == 'process-weekly-changes':
                result = self._execute_weekly_change_detection(job_info)
            elif job_info['command'] == 'update-time-series':
                result = self._execute_time_series_update(job_info)
            elif job_info['command'] == 'generate-reports':
                result = self._execute_report_generation(job_info)
            else:
                # Default workflow execution
                result = self.workflow_manager.execute_workflow(
                    job_info['command'], 
                    job_info['parameters']
                )
            
            # Update job statistics
            job_info['last_run'] = datetime.now()
            job_info['run_count'] += 1
            job_info['success_count'] += 1
            job_info['status'] = 'completed'
            
            logger.info(f"Job completed successfully: {job_info['name']}")
            
        except Exception as e:
            # Update job statistics for failure
            job_info['last_run'] = datetime.now()
            job_info['run_count'] += 1
            job_info['failure_count'] += 1
            job_info['status'] = 'failed'
            
            logger.error(f"Job failed: {job_info['name']} - {e}")
        
        finally:
            # Remove from running jobs
            if job_id in self.running_jobs:
                del self.running_jobs[job_id]
    
    def _execute_monthly_processing(self, job_info: Dict[str, Any]) -> Dict[str, Any]:
        """Execute monthly data processing job."""
        
        parameters = job_info['parameters']
        
        # Define areas to process
        areas = parameters.get('areas', [
            {'name': 'Colorado', 'bbox': [-109.0, 37.0, -102.0, 41.0]}
        ])
        
        results = []
        for area in areas:
            scene_config = {
                'source': parameters.get('source', 'usgs'),
                'area_name': area['name'],
                'bbox': area['bbox'],
                'start_date': (datetime.now() - timedelta(days=30)).strftime('%Y-%m-01'),
                'end_date': datetime.now().strftime('%Y-%m-%d'),
                'cloud_cover_max': parameters.get('cloud_cover_max', 30)
            }
            
            # Execute workflow
            result = self.workflow_manager.execute_workflow(
                'monthly_landsat_processing', 
                scene_config
            )
            results.append(result)
        
        return {'monthly_results': results}
    
    def _execute_weekly_change_detection(self, job_info: Dict[str, Any]) -> Dict[str, Any]:
        """Execute weekly change detection job."""
        
        parameters = job_info['parameters']
        
        # Define monitoring areas
        monitoring_areas = parameters.get('monitoring_areas', [
            {'name': 'Forest_Region_1', 'bbox': [-105.0, 40.0, -104.0, 41.0]}
        ])
        
        results = []
        for area in monitoring_areas:
            change_config = {
                'area_name': area['name'],
                'bbox': area['bbox'],
                'change_detection_method': parameters.get('method', 'spectral_change'),
                'indices': parameters.get('indices', ['NDVI', 'NBR', 'TCG'])
            }
            
            result = self.workflow_manager.execute_workflow(
                'sentinel2_change_detection',
                change_config
            )
            results.append(result)
        
        return {'change_detection_results': results}
    
    def _execute_time_series_update(self, job_info: Dict[str, Any]) -> Dict[str, Any]:
        """Execute time series update job."""
        
        parameters = job_info['parameters']
        
        # Define locations for time series analysis
        locations = parameters.get('locations', [
            {'location_id': 'watershed_001', 'bbox': [-105.0, 40.0, -104.0, 41.0]}
        ])
        
        results = []
        for location in locations:
            ts_config = {
                'location_id': location['location_id'],
                'bbox': location['bbox'],
                'analysis_period': parameters.get('analysis_period', 'annual'),
                'indices': parameters.get('indices', ['NDVI'])
            }
            
            result = self.workflow_manager.execute_workflow(
                'watershed_monitoring',
                ts_config
            )
            results.append(result)
        
        return {'time_series_results': results}
    
    def _execute_report_generation(self, job_info: Dict[str, Any]) -> Dict[str, Any]:
        """Execute report generation job."""
        
        parameters = job_info['parameters']
        
        report_types = parameters.get('report_types', ['monthly_summary'])
        
        results = []
        for report_type in report_types:
            if report_type == 'monthly_summary':
                # Generate monthly summary report
                report_config = {
                    'report_type': 'monthly_summary',
                    'period': 'last_month',
                    'include_maps': True,
                    'include_trends': True
                }
            elif report_type == 'change_analysis':
                # Generate change analysis report
                report_config = {
                    'report_type': 'change_analysis',
                    'detection_methods': ['spectral_change', 'landtrendr'],
                    'confidence_threshold': 0.8
                }
            else:
                report_config = {'report_type': report_type}
            
            result = self.workflow_manager.execute_workflow(
                'annual_time_series',
                report_config
            )
            results.append(result)
        
        return {'report_results': results}
    
    def start(self):
        """Start the scheduler."""
        
        if self.is_running:
            logger.warning("Scheduler is already running")
            return
        
        self.is_running = True
        logger.info("Starting automated processing scheduler")
        
        def run_scheduler():
            while self.is_running:
                schedule.run_pending()
                time.sleep(1)
        
        self.scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
        self.scheduler_thread.start()
        
        logger.info("Scheduler started successfully")
    
    def stop(self):
        """Stop the scheduler."""
        
        if not self.is_running:
            logger.warning("Scheduler is not running")
            return
        
        self.is_running = False
        logger.info("Stopping automated processing scheduler")
        
        if self.scheduler_thread and self.scheduler_thread.is_alive():
            self.scheduler_thread.join(timeout=5)
        
        logger.info("Scheduler stopped")
    
    def pause_job(self, job_id: str) -> bool:
        """Pause a scheduled job."""
        
        if job_id in self.scheduled_jobs:
            self.scheduled_jobs[job_id]['enabled'] = False
            logger.info(f"Paused job: {self.scheduled_jobs[job_id]['name']}")
            return True
        
        return False
    
    def resume_job(self, job_id: str) -> bool:
        """Resume a paused job."""
        
        if job_id in self.scheduled_jobs:
            self.scheduled_jobs[job_id]['enabled'] = True
            logger.info(f"Resumed job: {self.scheduled_jobs[job_id]['name']}")
            return True
        
        return False
    
    def remove_job(self, job_id: str) -> bool:
        """Remove a scheduled job."""
        
        if job_id in self.scheduled_jobs:
            job_name = self.scheduled_jobs[job_id]['name']
            del self.scheduled_jobs[job_id]
            logger.info(f"Removed job: {job_name}")
            return True
        
        return False
    
    def list_jobs(self) -> List[Dict[str, Any]]:
        """List all scheduled jobs."""
        
        return list(self.scheduled_jobs.values())
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific job."""
        
        job_info = self.scheduled_jobs.get(job_id)
        if job_info:
            # Add running status if applicable
            if job_id in self.running_jobs:
                job_info = {**job_info, 'current_status': 'running'}
            else:
                job_info = {**job_info, 'current_status': job_info['status']}
        
        return job_info
    
    def get_scheduler_status(self) -> Dict[str, Any]:
        """Get overall scheduler status."""
        
        return {
            'is_running': self.is_running,
            'total_jobs': len(self.scheduled_jobs),
            'enabled_jobs': len([j for j in self.scheduled_jobs.values() if j['enabled']]),
            'running_jobs': len(self.running_jobs),
            'jobs_summary': {
                'total_runs': sum(j['run_count'] for j in self.scheduled_jobs.values()),
                'successful_runs': sum(j['success_count'] for j in self.scheduled_jobs.values()),
                'failed_runs': sum(j['failure_count'] for j in self.scheduled_jobs.values())
            },
            'upcoming_jobs': [
                {
                    'job_id': job_id,
                    'name': job['name'],
                    'next_run': job['next_run']
                }
                for job_id, job in self.scheduled_jobs.items() 
                if job['enabled'] and job['next_run']
            ][:10]  # Next 10 jobs
        }
    
    def save_jobs_config(self, filepath: str):
        """Save scheduled jobs configuration to file."""
        
        config_data = {
            'jobs': self.scheduled_jobs,
            'saved_at': datetime.now().isoformat(),
            'version': '1.0'
        }
        
        with open(filepath, 'w') as f:
            json.dump(config_data, f, indent=2, default=str)
        
        logger.info(f"Jobs configuration saved to {filepath}")
    
    def load_jobs_config(self, filepath: str):
        """Load scheduled jobs configuration from file."""
        
        if not Path(filepath).exists():
            logger.warning(f"Configuration file not found: {filepath}")
            return
        
        with open(filepath, 'r') as f:
            config_data = json.load(f)
        
        jobs = config_data.get('jobs', {})
        for job_id, job_info in jobs.items():
            try:
                # Recreate schedule object (simplified)
                schedule_obj = self._parse_schedule(job_info['schedule'])
                job_info['schedule_obj'] = schedule_obj
                job_info['next_run'] = self._calculate_next_run(schedule_obj)
                self.scheduled_jobs[job_id] = job_info
                
                # Reschedule the job
                schedule_obj.do(self._execute_job_wrapper, job_id=job_id)
                
            except Exception as e:
                logger.error(f"Error loading job {job_id}: {e}")
        
        logger.info(f"Loaded {len(jobs)} jobs from configuration")