"""Database manager for satellite data processing results."""

import logging
import sqlite3
import json
from typing import Dict, List, Optional, Any, Union, Tuple
from pathlib import Path
from datetime import datetime, timedelta
import pandas as pd
from contextlib import contextmanager

from ..config import Settings


logger = logging.getLogger(__name__)


class DatabaseManager:
    """Database manager for satellite processing pipeline."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.db_path = self.settings.DATA_DIR / "satellite_data.db"
        self._initialize_database()
    
    def _initialize_database(self):
        """Initialize database with required tables."""
        
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Create processing results table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS processing_results (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        scene_id TEXT NOT NULL,
                        acquisition_date TEXT NOT NULL,
                        platform TEXT NOT NULL,
                        processing_level TEXT,
                        bbox_xmin REAL,
                        bbox_ymin REAL,
                        bbox_xmax REAL,
                        bbox_ymax REAL,
                        cloud_coverage REAL,
                        processing_timestamp TEXT,
                        input_file_path TEXT,
                        output_file_path TEXT,
                        processing_status TEXT,
                        quality_score REAL,
                        metadata TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Create change detection results table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS change_detection_results (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        result_id INTEGER,
                        index_name TEXT NOT NULL,
                        change_type TEXT,
                        detection_method TEXT,
                        change_magnitude_mean REAL,
                        change_magnitude_std REAL,
                        significant_pixels INTEGER,
                        change_percentage REAL,
                        confidence_score REAL,
                        time_step INTEGER,
                        change_maps_data TEXT,
                        statistics TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (result_id) REFERENCES processing_results (id)
                    )
                ''')
                
                # Create time series results table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS time_series_results (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        location_id TEXT NOT NULL,
                        index_name TEXT NOT NULL,
                        time_series_data TEXT,
                        trend_slope REAL,
                        trend_r_value REAL,
                        trend_p_value REAL,
                        anomaly_count INTEGER,
                        regime_shifts_count INTEGER,
                        overall_confidence REAL,
                        analysis_methods TEXT,
                        summary_statistics TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Create quality metrics table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS quality_metrics (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        result_id INTEGER,
                        metric_name TEXT NOT NULL,
                        metric_value REAL,
                        metric_description TEXT,
                        threshold_value REAL,
                        passed_threshold BOOLEAN,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (result_id) REFERENCES processing_results (id)
                    )
                ''')
                
                # Create locations table for spatial queries
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS locations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        location_name TEXT UNIQUE NOT NULL,
                        bbox_xmin REAL NOT NULL,
                        bbox_ymin REAL NOT NULL,
                        bbox_xmax REAL NOT NULL,
                        bbox_ymax REAL NOT NULL,
                        description TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Create indices for better performance
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_processing_results_scene_id 
                    ON processing_results (scene_id)
                ''')
                
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_processing_results_date 
                    ON processing_results (acquisition_date)
                ''')
                
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_processing_results_platform 
                    ON processing_results (platform)
                ''')
                
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_change_results_result_id 
                    ON change_detection_results (result_id)
                ''')
                
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_change_results_index 
                    ON change_detection_results (index_name)
                ''')
                
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_time_series_location 
                    ON time_series_results (location_id)
                ''')
                
                conn.commit()
                logger.info("Database initialized successfully")
                
        except Exception as e:
            logger.error(f"Error initializing database: {e}")
            raise
    
    @contextmanager
    def get_connection(self):
        """Get database connection with proper error handling."""
        
        conn = None
        try:
            conn = sqlite3.connect(str(self.db_path))
            conn.row_factory = sqlite3.Row
            yield conn
        except Exception as e:
            logger.error(f"Database connection error: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()
    
    def store_processing_result(self, 
                              scene_id: str,
                              acquisition_date: str,
                              platform: str,
                              bbox: Optional[Tuple[float, float, float, float]] = None,
                              cloud_coverage: Optional[float] = None,
                              input_file_path: Optional[str] = None,
                              output_file_path: Optional[str] = None,
                              processing_status: str = "completed",
                              quality_score: Optional[float] = None,
                              metadata: Optional[Dict] = None) -> int:
        """Store processing result and return result ID."""
        
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Parse bbox
                xmin, ymin, xmax, ymax = (None, None, None, None)
                if bbox:
                    xmin, ymin, xmax, ymax = bbox
                
                # Serialize metadata
                metadata_json = json.dumps(metadata) if metadata else None
                
                cursor.execute('''
                    INSERT INTO processing_results (
                        scene_id, acquisition_date, platform, processing_level,
                        bbox_xmin, bbox_ymin, bbox_xmax, bbox_ymax,
                        cloud_coverage, processing_timestamp, input_file_path,
                        output_file_path, processing_status, quality_score,
                        metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    scene_id, acquisition_date, platform, metadata.get('processing_level') if metadata else None,
                    xmin, ymin, xmax, ymax, cloud_coverage, datetime.now().isoformat(),
                    input_file_path, output_file_path, processing_status, quality_score, metadata_json
                ))
                
                result_id = cursor.lastrowid
                conn.commit()
                
                logger.info(f"Stored processing result with ID: {result_id}")
                return result_id
                
        except Exception as e:
            logger.error(f"Error storing processing result: {e}")
            raise
    
    def store_change_detection_result(self,
                                    result_id: int,
                                    index_name: str,
                                    change_type: Optional[str] = None,
                                    detection_method: str = "spectral_change",
                                    change_magnitude_mean: Optional[float] = None,
                                    change_magnitude_std: Optional[float] = None,
                                    significant_pixels: Optional[int] = None,
                                    change_percentage: Optional[float] = None,
                                    confidence_score: Optional[float] = None,
                                    time_step: Optional[int] = None,
                                    change_maps_data: Optional[Dict] = None,
                                    statistics: Optional[Dict] = None) -> int:
        """Store change detection result."""
        
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Serialize complex data
                change_maps_json = json.dumps(change_maps_data) if change_maps_data else None
                statistics_json = json.dumps(statistics) if statistics else None
                
                cursor.execute('''
                    INSERT INTO change_detection_results (
                        result_id, index_name, change_type, detection_method,
                        change_magnitude_mean, change_magnitude_std,
                        significant_pixels, change_percentage, confidence_score,
                        time_step, change_maps_data, statistics
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    result_id, index_name, change_type, detection_method,
                    change_magnitude_mean, change_magnitude_std,
                    significant_pixels, change_percentage, confidence_score,
                    time_step, change_maps_json, statistics_json
                ))
                
                change_id = cursor.lastrowid
                conn.commit()
                
                logger.info(f"Stored change detection result with ID: {change_id}")
                return change_id
                
        except Exception as e:
            logger.error(f"Error storing change detection result: {e}")
            raise
    
    def store_time_series_result(self,
                               location_id: str,
                               index_name: str,
                               time_series_data: Optional[List[Dict]] = None,
                               trend_slope: Optional[float] = None,
                               trend_r_value: Optional[float] = None,
                               trend_p_value: Optional[float] = None,
                               anomaly_count: Optional[int] = None,
                               regime_shifts_count: Optional[int] = None,
                               overall_confidence: Optional[float] = None,
                               analysis_methods: Optional[List[str]] = None,
                               summary_statistics: Optional[Dict] = None) -> int:
        """Store time series analysis result."""
        
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Serialize complex data
                time_series_json = json.dumps(time_series_data) if time_series_data else None
                analysis_methods_json = json.dumps(analysis_methods) if analysis_methods else None
                summary_statistics_json = json.dumps(summary_statistics) if summary_statistics else None
                
                cursor.execute('''
                    INSERT INTO time_series_results (
                        location_id, index_name, time_series_data,
                        trend_slope, trend_r_value, trend_p_value,
                        anomaly_count, regime_shifts_count, overall_confidence,
                        analysis_methods, summary_statistics
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    location_id, index_name, time_series_json,
                    trend_slope, trend_r_value, trend_p_value,
                    anomaly_count, regime_shifts_count, overall_confidence,
                    analysis_methods_json, summary_statistics_json
                ))
                
                ts_id = cursor.lastrowid
                conn.commit()
                
                logger.info(f"Stored time series result with ID: {ts_id}")
                return ts_id
                
        except Exception as e:
            logger.error(f"Error storing time series result: {e}")
            raise
    
    def store_quality_metric(self,
                           result_id: int,
                           metric_name: str,
                           metric_value: float,
                           metric_description: Optional[str] = None,
                           threshold_value: Optional[float] = None,
                           passed_threshold: Optional[bool] = None) -> int:
        """Store quality metric."""
        
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    INSERT INTO quality_metrics (
                        result_id, metric_name, metric_value,
                        metric_description, threshold_value, passed_threshold
                    ) VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    result_id, metric_name, metric_value,
                    metric_description, threshold_value, passed_threshold
                ))
                
                metric_id = cursor.lastrowid
                conn.commit()
                
                return metric_id
                
        except Exception as e:
            logger.error(f"Error storing quality metric: {e}")
            raise
    
    def get_processing_results(self,
                             scene_id: Optional[str] = None,
                             platform: Optional[str] = None,
                             start_date: Optional[str] = None,
                             end_date: Optional[str] = None,
                             bbox: Optional[Tuple[float, float, float, float]] = None,
                             limit: Optional[int] = None) -> pd.DataFrame:
        """Retrieve processing results with optional filters."""
        
        try:
            with self.get_connection() as conn:
                query = '''
                    SELECT pr.*, 
                           GROUP_CONCAT(qm.metric_name || ':' || qm.metric_value) as quality_metrics
                    FROM processing_results pr
                    LEFT JOIN quality_metrics qm ON pr.id = qm.result_id
                    WHERE 1=1
                '''
                params = []
                
                # Add filters
                if scene_id:
                    query += ' AND pr.scene_id = ?'
                    params.append(scene_id)
                
                if platform:
                    query += ' AND pr.platform = ?'
                    params.append(platform)
                
                if start_date:
                    query += ' AND pr.acquisition_date >= ?'
                    params.append(start_date)
                
                if end_date:
                    query += ' AND pr.acquisition_date <= ?'
                    params.append(end_date)
                
                if bbox:
                    query += ' AND pr.bbox_xmin <= ? AND pr.bbox_xmax >= ? AND pr.bbox_ymin <= ? AND pr.bbox_ymax >= ?'
                    params.extend([bbox[2], bbox[0], bbox[3], bbox[1]])
                
                query += ' GROUP BY pr.id'
                
                if limit:
                    query += f' LIMIT {limit}'
                
                df = pd.read_sql_query(query, conn, params=params)
                
                logger.info(f"Retrieved {len(df)} processing results")
                return df
                
        except Exception as e:
            logger.error(f"Error retrieving processing results: {e}")
            raise
    
    def get_change_detection_results(self,
                                   result_id: Optional[int] = None,
                                   index_name: Optional[str] = None,
                                   detection_method: Optional[str] = None) -> pd.DataFrame:
        """Retrieve change detection results."""
        
        try:
            with self.get_connection() as conn:
                query = '''
                    SELECT cdr.*, pr.scene_id, pr.platform, pr.acquisition_date
                    FROM change_detection_results cdr
                    JOIN processing_results pr ON cdr.result_id = pr.id
                    WHERE 1=1
                '''
                params = []
                
                if result_id:
                    query += ' AND cdr.result_id = ?'
                    params.append(result_id)
                
                if index_name:
                    query += ' AND cdr.index_name = ?'
                    params.append(index_name)
                
                if detection_method:
                    query += ' AND cdr.detection_method = ?'
                    params.append(detection_method)
                
                df = pd.read_sql_query(query, conn, params=params)
                
                logger.info(f"Retrieved {len(df)} change detection results")
                return df
                
        except Exception as e:
            logger.error(f"Error retrieving change detection results: {e}")
            raise
    
    def get_time_series_results(self,
                              location_id: Optional[str] = None,
                              index_name: Optional[str] = None) -> pd.DataFrame:
        """Retrieve time series results."""
        
        try:
            with self.get_connection() as conn:
                query = '''
                    SELECT * FROM time_series_results
                    WHERE 1=1
                '''
                params = []
                
                if location_id:
                    query += ' AND location_id = ?'
                    params.append(location_id)
                
                if index_name:
                    query += ' AND index_name = ?'
                    params.append(index_name)
                
                df = pd.read_sql_query(query, conn, params=params)
                
                logger.info(f"Retrieved {len(df)} time series results")
                return df
                
        except Exception as e:
            logger.error(f"Error retrieving time series results: {e}")
            raise
    
    def get_quality_metrics(self, result_id: Optional[int] = None) -> pd.DataFrame:
        """Retrieve quality metrics."""
        
        try:
            with self.get_connection() as conn:
                if result_id:
                    query = '''
                        SELECT qm.*, pr.scene_id, pr.platform
                        FROM quality_metrics qm
                        JOIN processing_results pr ON qm.result_id = pr.id
                        WHERE qm.result_id = ?
                    '''
                    df = pd.read_sql_query(query, conn, params=[result_id])
                else:
                    query = '''
                        SELECT qm.*, pr.scene_id, pr.platform
                        FROM quality_metrics qm
                        JOIN processing_results pr ON qm.result_id = pr.id
                    '''
                    df = pd.read_sql_query(query, conn)
                
                logger.info(f"Retrieved {len(df)} quality metrics")
                return df
                
        except Exception as e:
            logger.error(f"Error retrieving quality metrics: {e}")
            raise
    
    def update_processing_status(self, result_id: int, status: str, error_message: Optional[str] = None):
        """Update processing status."""
        
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                if error_message:
                    metadata = {"error": error_message}
                    metadata_json = json.dumps(metadata)
                    cursor.execute('''
                        UPDATE processing_results 
                        SET processing_status = ?, metadata = ?
                        WHERE id = ?
                    ''', (status, metadata_json, result_id))
                else:
                    cursor.execute('''
                        UPDATE processing_results 
                        SET processing_status = ?
                        WHERE id = ?
                    ''', (status, result_id))
                
                conn.commit()
                logger.info(f"Updated processing status for result {result_id} to {status}")
                
        except Exception as e:
            logger.error(f"Error updating processing status: {e}")
            raise
    
    def delete_old_results(self, days_old: int = 365):
        """Delete results older than specified days."""
        
        try:
            cutoff_date = datetime.now() - timedelta(days=days_old)
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Get IDs of old results
                cursor.execute('''
                    SELECT id FROM processing_results 
                    WHERE created_at < ?
                ''', (cutoff_date.isoformat(),))
                
                old_ids = [row[0] for row in cursor.fetchall()]
                
                if old_ids:
                    # Delete related records first
                    cursor.executemany('DELETE FROM change_detection_results WHERE result_id = ?', 
                                     [(id,) for id in old_ids])
                    cursor.executemany('DELETE FROM quality_metrics WHERE result_id = ?', 
                                     [(id,) for id in old_ids])
                    
                    # Delete main results
                    cursor.executemany('DELETE FROM processing_results WHERE id = ?', 
                                     [(id,) for id in old_ids])
                    
                    conn.commit()
                    logger.info(f"Deleted {len(old_ids)} old results")
                else:
                    logger.info("No old results found to delete")
                    
        except Exception as e:
            logger.error(f"Error deleting old results: {e}")
            raise
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get database statistics."""
        
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                stats = {}
                
                # Count records in each table
                for table in ['processing_results', 'change_detection_results', 
                            'time_series_results', 'quality_metrics', 'locations']:
                    cursor.execute(f'SELECT COUNT(*) FROM {table}')
                    stats[f'{table}_count'] = cursor.fetchone()[0]
                
                # Get date range
                cursor.execute('''
                    SELECT MIN(acquisition_date), MAX(acquisition_date)
                    FROM processing_results
                ''')
                date_range = cursor.fetchone()
                stats['date_range'] = {
                    'earliest': date_range[0],
                    'latest': date_range[1]
                }
                
                # Get platform distribution
                cursor.execute('''
                    SELECT platform, COUNT(*) 
                    FROM processing_results 
                    GROUP BY platform
                ''')
                stats['platform_distribution'] = dict(cursor.fetchall())
                
                return stats
                
        except Exception as e:
            logger.error(f"Error getting statistics: {e}")
            raise