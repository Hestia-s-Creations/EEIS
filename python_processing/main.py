#!/usr/bin/env python3
"""Main entry point for the satellite data processing pipeline."""

import asyncio
import logging
import argparse
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent))

from config import Settings, get_data_source_configs
from workflows import ProcessingPipeline, WorkflowManager, CronScheduler
from database import DatabaseManager


def setup_logging(debug: bool = False) -> None:
    """Setup logging configuration."""
    
    log_level = logging.DEBUG if debug else logging.INFO
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('satellite_pipeline.log')
        ]
    )


async def process_single_scene(args) -> None:
    """Process a single satellite scene."""
    
    settings = Settings.from_env()
    pipeline = ProcessingPipeline(settings)
    
    # Load scene configuration
    if args.config_file:
        with open(args.config_file, 'r') as f:
            import json
            scene_config = json.load(f)
    else:
        # Create configuration from command line arguments
        scene_config = {
            'source': args.source,
            'start_date': args.start_date,
            'end_date': args.end_date,
            'output_dir': args.output_dir,
            'scene_id': args.scene_id
        }
        
        if args.source.lower() == 'usgs':
            scene_config.update({
                'latitude': args.latitude,
                'longitude': args.longitude,
                'cloud_cover_max': args.cloud_cover_max
            })
        elif args.source.lower() == 'esa':
            scene_config.update({
                'bbox': (args.west, args.south, args.east, args.north),
                'cloud_cover_max': args.cloud_cover_max
            })
    
    # Process the scene
    result = await pipeline.process_single_scene(scene_config)
    
    # Print results
    print(f"\nProcessing completed!")
    print(f"Scene ID: {result['scene_id']}")
    print(f"Status: {result['processing_status']}")
    print(f"Steps completed: {result['steps_completed']}")
    
    if result['errors']:
        print(f"Errors: {result['errors']}")
    
    if result['processing_status'] == 'completed':
        print(f"Duration: {result.get('duration_minutes', 'N/A'):.1f} minutes")
        print(f"Quality score: {result['confidence_scores'].get('data_quality', 'N/A'):.2f}")


async def process_time_series(args) -> None:
    """Process time series analysis for a location."""
    
    settings = Settings.from_env()
    pipeline = ProcessingPipeline(settings)
    
    location_config = {
        'location_id': args.location_id,
        'bbox': (args.west, args.south, args.east, args.north),
        'start_date': args.start_date,
        'end_date': args.end_date
    }
    
    result = await pipeline.process_time_series(location_config, args.index)
    
    print(f"\nTime series processing completed!")
    print(f"Location ID: {result['location_id']}")
    print(f"Index: {result['index_name']}")
    print(f"Status: {result['processing_status']}")
    
    if 'analysis_results' in result:
        summary = result['analysis_results'].get('summary', {})
        print(f"Key findings: {summary.get('key_findings', [])}")


async def run_batch_processing(args) -> None:
    """Run batch processing for multiple scenes."""
    
    settings = Settings.from_env()
    pipeline = ProcessingPipeline(settings)
    
    # Load batch configuration
    with open(args.batch_config, 'r') as f:
        import json
        batch_config = json.load(f)
    
    result = await pipeline.run_batch_processing(batch_config)
    
    print(f"\nBatch processing completed!")
    print(f"Total scenes: {result['total_scenes']}")
    print(f"Successful: {result['successful']}")
    print(f"Failed: {result['failed']}")
    print(f"Success rate: {result['success_rate']:.1%}")


def start_automated_processing(args) -> None:
    """Start automated processing with cron scheduling."""
    
    settings = Settings.from_env()
    cron_scheduler = CronScheduler(settings)
    workflow_manager = WorkflowManager(settings)
    
    if args.start:
        # Start the cron scheduler
        cron_scheduler.start()
        print("Automated processing started. Press Ctrl+C to stop.")
        
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            cron_scheduler.stop()
            print("Automated processing stopped.")
    
    elif args.add_job:
        # Add a new cron job
        job_config = {
            'name': args.job_name,
            'command': args.command,
            'schedule': args.schedule,
            'parameters': args.parameters
        }
        
        cron_scheduler.add_job(job_config)
        print(f"Added cron job: {args.job_name}")
    
    elif args.list_jobs:
        # List all jobs
        jobs = cron_scheduler.list_jobs()
        print(f"Active jobs: {len(jobs)}")
        for job in jobs:
            print(f"- {job['name']}: {job['schedule']} -> {job['command']}")


def show_status(args) -> None:
    """Show system status and database statistics."""
    
    settings = Settings.from_env()
    database = DatabaseManager(settings)
    
    stats = database.get_statistics()
    
    print("\nSystem Status:")
    print(f"Processing results: {stats.get('processing_results_count', 0)}")
    print(f"Change detection results: {stats.get('change_detection_results_count', 0)}")
    print(f"Time series results: {stats.get('time_series_results_count', 0)}")
    print(f"Quality metrics: {stats.get('quality_metrics_count', 0)}")
    
    date_range = stats.get('date_range', {})
    if date_range['earliest'] and date_range['latest']:
        print(f"Data range: {date_range['earliest']} to {date_range['latest']}")
    
    print("\nPlatform distribution:")
    for platform, count in stats.get('platform_distribution', {}).items():
        print(f"  {platform}: {count} scenes")


def cleanup_database(args) -> None:
    """Clean up old database records."""
    
    settings = Settings.from_env()
    database = DatabaseManager(settings)
    
    database.delete_old_results(args.days_old)
    print(f"Cleaned up records older than {args.days_old} days")


def main():
    """Main entry point."""
    
    parser = argparse.ArgumentParser(
        description="Satellite Data Processing Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process a single Landsat scene
  python main.py process-single --source usgs --latitude 40.0 --longitude -105.0 --start-date 2023-01-01 --end-date 2023-01-31

  # Process Sentinel-2 data
  python main.py process-single --source esa --west -105.0 --south 40.0 --east -104.0 --north 41.0 --start-date 2023-06-01 --end-date 2023-06-30

  # Process time series
  python main.py process-timeseries --location-id test_site --west -105.0 --south 40.0 --east -104.0 --north 41.0 --start-date 2020-01-01 --end-date 2023-12-31

  # Batch processing
  python main.py batch-processing --batch-config batch_config.json

  # Start automated processing
  python main.py automated --start

  # Show system status
  python main.py status
        """
    )
    
    parser.add_argument('--debug', action='store_true', help='Enable debug logging')
    parser.set_defaults(func=lambda args: parser.print_help())
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Single scene processing
    process_parser = subparsers.add_parser('process-single', help='Process a single satellite scene')
    process_parser.add_argument('--source', required=True, choices=['usgs', 'esa'], help='Data source')
    process_parser.add_argument('--scene-id', help='Scene identifier')
    process_parser.add_argument('--config-file', help='Configuration file (JSON format)')
    
    # USGS specific arguments
    process_parser.add_argument('--latitude', type=float, help='Center latitude (for USGS)')
    process_parser.add_argument('--longitude', type=float, help='Center longitude (for USGS)')
    
    # ESA specific arguments
    process_parser.add_argument('--west', type=float, help='Western boundary (for ESA)')
    process_parser.add_argument('--south', type=float, help='Southern boundary (for ESA)')
    process_parser.add_argument('--east', type=float, help='Eastern boundary (for ESA)')
    process_parser.add_argument('--north', type=float, help='Northern boundary (for ESA)')
    
    # Common arguments
    process_parser.add_argument('--start-date', required=True, help='Start date (YYYY-MM-DD)')
    process_parser.add_argument('--end-date', required=True, help='End date (YYYY-MM-DD)')
    process_parser.add_argument('--output-dir', help='Output directory')
    process_parser.add_argument('--cloud-cover-max', type=float, default=30.0, help='Maximum cloud coverage (%)')
    
    # Time series processing
    ts_parser = subparsers.add_parser('process-timeseries', help='Process time series analysis')
    ts_parser.add_argument('--location-id', required=True, help='Location identifier')
    ts_parser.add_argument('--west', type=float, required=True, help='Western boundary')
    ts_parser.add_argument('--south', type=float, required=True, help='Southern boundary')
    ts_parser.add_argument('--east', type=float, required=True, help='Eastern boundary')
    ts_parser.add_argument('--north', type=float, required=True, help='Northern boundary')
    ts_parser.add_argument('--start-date', required=True, help='Start date (YYYY-MM-DD)')
    ts_parser.add_argument('--end-date', required=True, help='End date (YYYY-MM-DD)')
    ts_parser.add_argument('--index', default='NDVI', help='Spectral index to analyze')
    
    # Batch processing
    batch_parser = subparsers.add_parser('batch-processing', help='Run batch processing')
    batch_parser.add_argument('--batch-config', required=True, help='Batch configuration file (JSON)')
    
    # Automated processing
    auto_parser = subparsers.add_parser('automated', help='Automated processing management')
    auto_group = auto_parser.add_mutually_exclusive_group(required=True)
    auto_group.add_argument('--start', action='store_true', help='Start automated processing')
    auto_group.add_argument('--add-job', action='store_true', help='Add a new cron job')
    auto_group.add_argument('--list-jobs', action='store_true', help='List all cron jobs')
    
    auto_parser.add_argument('--job-name', help='Job name (for --add-job)')
    auto_parser.add_argument('--command', help='Command to execute (for --add-job)')
    auto_parser.add_argument('--schedule', help='Cron schedule expression (for --add-job)')
    auto_parser.add_argument('--parameters', help='Job parameters (JSON string)')
    
    # Status and maintenance
    subparsers.add_parser('status', help='Show system status')
    
    cleanup_parser = subparsers.add_parser('cleanup', help='Clean up old database records')
    cleanup_parser.add_argument('--days-old', type=int, default=365, help='Delete records older than N days')
    
    args = parser.parse_args()
    
    # Setup logging
    setup_logging(args.debug)
    
    # Execute command
    if args.command == 'process-single':
        asyncio.run(process_single_scene(args))
    elif args.command == 'process-timeseries':
        asyncio.run(process_time_series(args))
    elif args.command == 'batch-processing':
        asyncio.run(run_batch_processing(args))
    elif args.command == 'automated':
        start_automated_processing(args)
    elif args.command == 'status':
        show_status(args)
    elif args.command == 'cleanup':
        cleanup_database(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()