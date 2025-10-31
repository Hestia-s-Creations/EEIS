"""
Python Client Example for Watershed Disturbance Mapping System API

This module provides a comprehensive Python client for interacting with
the Watershed Disturbance Mapping System API.

Features:
- Authentication and session management
- Watershed management
- Change detection queries
- Alert configuration
- Data export
- Error handling and retry logic

Author: Watershed Disturbance Mapping System
Version: 1.0.0
"""

import requests
import json
import time
from datetime import datetime, date
from typing import Dict, Any, List, Optional, Union
from urllib.parse import urljoin
import logging
import uuid
from pathlib import Path


class WatershedAPIError(Exception):
    """Custom exception for API errors"""
    def __init__(self, message: str, status_code: int = None, response_data: Dict = None):
        self.message = message
        self.status_code = status_code
        self.response_data = response_data or {}
        super().__init__(self.message)


class WatershedAPIClient:
    """
    Python client for the Watershed Disturbance Mapping System API.
    
    Provides methods for all API endpoints with built-in authentication,
    error handling, and data validation.
    """
    
    def __init__(self, base_url: str, api_key: str = None, timeout: int = 30):
        """
        Initialize the API client.
        
        Args:
            base_url: Base URL of the API (e.g., 'https://api.watershed-ds.com/')
            api_key: API key for authentication (optional)
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout
        self.access_token = None
        self.refresh_token = None
        self.session = requests.Session()
        
        # Set up logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        # Set default headers
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'WatershedAPI/1.0.0'
        })
        
        if self.api_key:
            self.session.headers['Authorization'] = f'Bearer {self.api_key}'
    
    def _make_request(self, method: str, endpoint: str, data: Dict = None, 
                     params: Dict = None, files: Dict = None) -> Dict:
        """
        Make HTTP request with error handling and retry logic.
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE, PATCH)
            endpoint: API endpoint path
            data: Request body data
            params: Query parameters
            files: File data for uploads
            
        Returns:
            Dict: API response data
            
        Raises:
            WatershedAPIError: If request fails
        """
        url = urljoin(self.base_url, endpoint)
        
        kwargs = {
            'timeout': self.timeout,
            'headers': self.session.headers.copy()
        }
        
        if data:
            kwargs['json'] = data
        if params:
            kwargs['params'] = params
        if files:
            kwargs['files'] = files
            # Remove Content-Type header for file uploads
            kwargs['headers'].pop('Content-Type', None)
        
        max_retries = 3
        retry_delay = 1
        
        for attempt in range(max_retries):
            try:
                self.logger.debug(f"Making {method} request to {url}")
                response = self.session.request(method, url, **kwargs)
                
                # Handle HTTP errors
                if response.status_code >= 400:
                    error_data = {}
                    try:
                        error_data = response.json()
                    except:
                        pass
                    
                    error_msg = error_data.get('message', error_data.get('detail', f'HTTP {response.status_code}'))
                    
                    if response.status_code == 429:  # Rate limited
                        retry_after = int(response.headers.get('Retry-After', retry_delay))
                        self.logger.warning(f"Rate limited. Waiting {retry_after} seconds...")
                        time.sleep(retry_after)
                        retry_delay *= 2
                        continue
                    
                    if response.status_code >= 500 and attempt < max_retries - 1:
                        self.logger.warning(f"Server error {response.status_code}. Retrying...")
                        time.sleep(retry_delay)
                        retry_delay *= 2
                        continue
                    
                    raise WatershedAPIError(error_msg, response.status_code, error_data)
                
                # Parse response
                if response.status_code == 204:  # No content
                    return {}
                
                try:
                    return response.json()
                except json.JSONDecodeError:
                    self.logger.warning("Failed to parse JSON response")
                    return {'data': response.text}
                    
            except requests.exceptions.RequestException as e:
                if attempt == max_retries - 1:
                    raise WatershedAPIError(f"Request failed: {str(e)}")
                
                self.logger.warning(f"Request failed, attempt {attempt + 1}: {str(e)}")
                time.sleep(retry_delay)
                retry_delay *= 2
    
    def authenticate(self, email: str, password: str, remember_me: bool = False) -> Dict:
        """
        Authenticate user and obtain access tokens.
        
        Args:
            email: User email address
            password: User password
            remember_me: Whether to extend token lifetime
            
        Returns:
            Dict: Authentication response data
        """
        self.logger.info(f"Authenticating user: {email}")
        
        data = {
            'email': email,
            'password': password,
            'remember_me': remember_me
        }
        
        response = self._make_request('POST', '/api/v1/auth/login/', data)
        
        if 'access_token' in response:
            self.access_token = response['access_token']
            self.refresh_token = response['refresh_token']
            
            # Update session headers
            self.session.headers['Authorization'] = f'Bearer {self.access_token}'
            
            self.logger.info("Authentication successful")
        
        return response
    
    def refresh_access_token(self) -> Dict:
        """
        Refresh access token using refresh token.
        
        Returns:
            Dict: Token refresh response data
        """
        if not self.refresh_token:
            raise WatershedAPIError("No refresh token available")
        
        self.logger.info("Refreshing access token")
        
        data = {'refresh_token': self.refresh_token}
        response = self._make_request('POST', '/api/v1/auth/refresh/', data)
        
        if 'access_token' in response:
            self.access_token = response['access_token']
            if 'refresh_token' in response:
                self.refresh_token = response['refresh_token']
            
            # Update session headers
            self.session.headers['Authorization'] = f'Bearer {self.access_token}'
            
            self.logger.info("Token refresh successful")
        
        return response
    
    def logout(self) -> Dict:
        """
        Logout user and invalidate tokens.
        
        Returns:
            Dict: Logout response data
        """
        self.logger.info("Logging out user")
        
        if self.refresh_token:
            data = {'refresh_token': self.refresh_token}
            response = self._make_request('POST', '/api/v1/auth/logout/', data)
        else:
            response = self._make_request('POST', '/api/v1/auth/logout/', {})
        
        # Clear tokens
        self.access_token = None
        self.refresh_token = None
        self.session.headers.pop('Authorization', None)
        
        self.logger.info("Logout successful")
        return response
    
    def get_profile(self) -> Dict:
        """Get current user profile."""
        return self._make_request('GET', '/api/v1/auth/profile/')
    
    def update_profile(self, profile_data: Dict) -> Dict:
        """Update user profile."""
        return self._make_request('PUT', '/api/v1/auth/profile/', profile_data)
    
    # Watershed Management Methods
    def list_watersheds(self, page: int = 1, page_size: int = 20, **filters) -> Dict:
        """
        List watersheds with filtering options.
        
        Args:
            page: Page number
            page_size: Items per page
            **filters: Additional filters (search, status, area_min, etc.)
            
        Returns:
            Dict: Watersheds list response
        """
        params = {'page': page, 'page_size': page_size}
        params.update(filters)
        
        return self._make_request('GET', '/api/v1/watersheds/', params=params)
    
    def create_watershed(self, watershed_data: Dict) -> Dict:
        """
        Create a new watershed.
        
        Args:
            watershed_data: Watershed creation data
            
        Returns:
            Dict: Created watershed response
        """
        self.logger.info(f"Creating watershed: {watershed_data.get('name')}")
        return self._make_request('POST', '/api/v1/watersheds/', watershed_data)
    
    def get_watershed(self, watershed_id: str) -> Dict:
        """
        Get watershed details.
        
        Args:
            watershed_id: Watershed identifier
            
        Returns:
            Dict: Watershed details response
        """
        return self._make_request('GET', f'/api/v1/watersheds/{watershed_id}/')
    
    def update_watershed(self, watershed_id: str, update_data: Dict) -> Dict:
        """
        Update watershed information.
        
        Args:
            watershed_id: Watershed identifier
            update_data: Update data
            
        Returns:
            Dict: Updated watershed response
        """
        return self._make_request('PUT', f'/api/v1/watersheds/{watershed_id}/', update_data)
    
    def delete_watershed(self, watershed_id: str) -> Dict:
        """
        Delete watershed.
        
        Args:
            watershed_id: Watershed identifier
            
        Returns:
            Dict: Deletion response
        """
        return self._make_request('DELETE', f'/api/v1/watersheds/{watershed_id}/')
    
    def get_watershed_detections(self, watershed_id: str, **filters) -> Dict:
        """
        Get change detections for a watershed.
        
        Args:
            watershed_id: Watershed identifier
            **filters: Detection filters
            
        Returns:
            Dict: Detections list response
        """
        return self._make_request('GET', f'/api/v1/watersheds/{watershed_id}/detections/', 
                                 params=filters)
    
    def configure_monitoring(self, watershed_id: str, config_data: Dict) -> Dict:
        """
        Configure monitoring for a watershed.
        
        Args:
            watershed_id: Watershed identifier
            config_data: Monitoring configuration
            
        Returns:
            Dict: Configuration response
        """
        return self._make_request('POST', f'/api/v1/watersheds/{watershed_id}/monitoring/', 
                                 config_data)
    
    # Change Detection Methods
    def list_detections(self, page: int = 1, page_size: int = 20, **filters) -> Dict:
        """
        List change detections with filtering.
        
        Args:
            page: Page number
            page_size: Items per page
            **filters: Detection filters
            
        Returns:
            Dict: Detections list response
        """
        params = {'page': page, 'page_size': page_size}
        params.update(filters)
        
        return self._make_request('GET', '/api/v1/change-detections/', params=params)
    
    def get_detection(self, detection_id: str) -> Dict:
        """
        Get detection details.
        
        Args:
            detection_id: Detection identifier
            
        Returns:
            Dict: Detection details response
        """
        return self._make_request('GET', f'/api/v1/change-detections/{detection_id}/')
    
    def get_detection_timeseries(self, detection_id: str, **filters) -> Dict:
        """
        Get time series data for a detection.
        
        Args:
            detection_id: Detection identifier
            **filters: Time series filters
            
        Returns:
            Dict: Time series data response
        """
        return self._make_request('GET', f'/api/v1/change-detections/{detection_id}/timeseries/',
                                 params=filters)
    
    def submit_validation(self, detection_id: str, validation_data: Dict) -> Dict:
        """
        Submit validation feedback for a detection.
        
        Args:
            detection_id: Detection identifier
            validation_data: Validation feedback data
            
        Returns:
            Dict: Validation submission response
        """
        validation_data['detection_id'] = detection_id
        return self._make_request('POST', '/api/v1/change-detections/validate/', validation_data)
    
    def get_detection_statistics(self, **filters) -> Dict:
        """
        Get detection statistics.
        
        Args:
            **filters: Statistics filters
            
        Returns:
            Dict: Statistics response
        """
        return self._make_request('GET', '/api/v1/change-detections/statistics/', params=filters)
    
    # Alert Management Methods
    def list_alerts(self, page: int = 1, page_size: int = 20, **filters) -> Dict:
        """
        List alert configurations.
        
        Args:
            page: Page number
            page_size: Items per page
            **filters: Alert filters
            
        Returns:
            Dict: Alerts list response
        """
        params = {'page': page, 'page_size': page_size}
        params.update(filters)
        
        return self._make_request('GET', '/api/v1/alerts/', params=params)
    
    def create_alert(self, alert_data: Dict) -> Dict:
        """
        Create a new alert configuration.
        
        Args:
            alert_data: Alert configuration data
            
        Returns:
            Dict: Created alert response
        """
        self.logger.info(f"Creating alert: {alert_data.get('name')}")
        return self._make_request('POST', '/api/v1/alerts/', alert_data)
    
    def get_alert(self, alert_id: str) -> Dict:
        """
        Get alert details.
        
        Args:
            alert_id: Alert identifier
            
        Returns:
            Dict: Alert details response
        """
        return self._make_request('GET', f'/api/v1/alerts/{alert_id}/')
    
    def update_alert(self, alert_id: str, update_data: Dict) -> Dict:
        """
        Update alert configuration.
        
        Args:
            alert_id: Alert identifier
            update_data: Update data
            
        Returns:
            Dict: Updated alert response
        """
        return self._make_request('PUT', f'/api/v1/alerts/{alert_id}/', update_data)
    
    def delete_alert(self, alert_id: str) -> Dict:
        """
        Delete alert configuration.
        
        Args:
            alert_id: Alert identifier
            
        Returns:
            Dict: Deletion response
        """
        return self._make_request('DELETE', f'/api/v1/alerts/{alert_id}/')
    
    def test_alert(self, alert_id: str, test_data: Dict = None) -> Dict:
        """
        Send test notification for alert.
        
        Args:
            alert_id: Alert identifier
            test_data: Test data (optional)
            
        Returns:
            Dict: Test response
        """
        if test_data is None:
            test_data = {}
        
        return self._make_request('POST', f'/api/v1/alerts/{alert_id}/test/', test_data)
    
    def mute_alert(self, alert_id: str, duration_hours: int = 24, reason: str = None) -> Dict:
        """
        Mute alert notifications.
        
        Args:
            alert_id: Alert identifier
            duration_hours: Mute duration in hours
            reason: Mute reason
            
        Returns:
            Dict: Mute response
        """
        data = {'duration_hours': duration_hours}
        if reason:
            data['reason'] = reason
        
        return self._make_request('POST', f'/api/v1/alerts/{alert_id}/mute/', data)
    
    def unmute_alert(self, alert_id: str) -> Dict:
        """
        Unmute alert notifications.
        
        Args:
            alert_id: Alert identifier
            
        Returns:
            Dict: Unmute response
        """
        return self._make_request('POST', f'/api/v1/alerts/{alert_id}/unmute/', {})
    
    # Export Methods
    def list_exports(self, page: int = 1, page_size: int = 20, **filters) -> Dict:
        """
        List export requests.
        
        Args:
            page: Page number
            page_size: Items per page
            **filters: Export filters
            
        Returns:
            Dict: Exports list response
        """
        params = {'page': page, 'page_size': page_size}
        params.update(filters)
        
        return self._make_request('GET', '/api/v1/exports/', params=params)
    
    def create_export(self, export_data: Dict) -> Dict:
        """
        Create new data export request.
        
        Args:
            export_data: Export configuration data
            
        Returns:
            Dict: Created export response
        """
        self.logger.info(f"Creating export: {export_data.get('export_type')} in {export_data.get('format')}")
        return self._make_request('POST', '/api/v1/exports/', export_data)
    
    def get_export(self, export_id: str) -> Dict:
        """
        Get export request details.
        
        Args:
            export_id: Export identifier
            
        Returns:
            Dict: Export details response
        """
        return self._make_request('GET', f'/api/v1/exports/{export_id}/')
    
    def download_export(self, export_id: str) -> Dict:
        """
        Get download URL for completed export.
        
        Args:
            export_id: Export identifier
            
        Returns:
            Dict: Download URL response
        """
        return self._make_request('GET', f'/api/v1/exports/{export_id}/download/')
    
    def download_export_file(self, export_id: str, download_path: str) -> str:
        """
        Download export file to local path.
        
        Args:
            export_id: Export identifier
            download_path: Local file path to save
            
        Returns:
            str: Path to downloaded file
        """
        # Get download URL
        download_response = self.download_export(export_id)
        download_url = download_response['download_url']
        
        # Download file
        self.logger.info(f"Downloading export file: {export_id}")
        response = requests.get(download_url, timeout=300)  # 5 minute timeout for large files
        
        if response.status_code == 200:
            # Ensure directory exists
            Path(download_path).parent.mkdir(parents=True, exist_ok=True)
            
            # Save file
            with open(download_path, 'wb') as f:
                f.write(response.content)
            
            self.logger.info(f"Export file downloaded to: {download_path}")
            return download_path
        else:
            raise WatershedAPIError(f"Failed to download file: HTTP {response.status_code}")
    
    def cancel_export(self, export_id: str) -> Dict:
        """
        Cancel export request.
        
        Args:
            export_id: Export identifier
            
        Returns:
            Dict: Cancellation response
        """
        return self._make_request('DELETE', f'/api/v1/exports/{export_id}/')
    
    def get_export_templates(self) -> Dict:
        """
        Get available export format templates.
        
        Returns:
            Dict: Export templates response
        """
        return self._make_request('GET', '/api/v1/exports/templates/')
    
    # Satellite Data Methods
    def ingest_satellite_data(self, ingest_data: Dict) -> Dict:
        """
        Initiate satellite data ingestion.
        
        Args:
            ingest_data: Ingestion configuration data
            
        Returns:
            Dict: Ingestion job response
        """
        self.logger.info("Initiating satellite data ingestion")
        return self._make_request('POST', '/api/v1/satellite-data/ingest/', ingest_data)
    
    def list_satellite_data(self, page: int = 1, page_size: int = 20, **filters) -> Dict:
        """
        List satellite data products.
        
        Args:
            page: Page number
            page_size: Items per page
            **filters: Data filters
            
        Returns:
            Dict: Satellite data list response
        """
        params = {'page': page, 'page_size': page_size}
        params.update(filters)
        
        return self._make_request('GET', '/api/v1/satellite-data/', params=params)
    
    def get_satellite_data(self, data_id: str) -> Dict:
        """
        Get satellite data details.
        
        Args:
            data_id: Satellite data identifier
            
        Returns:
            Dict: Data details response
        """
        return self._make_request('GET', f'/api/v1/satellite-data/{data_id}/')
    
    def perform_quality_check(self, data_id: str, check_config: Dict = None) -> Dict:
        """
        Perform quality assessment on satellite data.
        
        Args:
            data_id: Satellite data identifier
            check_config: Quality check configuration
            
        Returns:
            Dict: Quality assessment job response
        """
        if check_config is None:
            check_config = {}
        
        return self._make_request('POST', f'/api/v1/satellite-data/{data_id}/quality-check/', check_config)
    
    def get_spectral_indices(self, data_id: str, indices: List[str] = None) -> Dict:
        """
        Get spectral indices for satellite data.
        
        Args:
            data_id: Satellite data identifier
            indices: List of indices to retrieve
            
        Returns:
            Dict: Spectral indices response
        """
        params = {}
        if indices:
            params['indices'] = ','.join(indices)
        
        return self._make_request('GET', f'/api/v1/satellite-data/{data_id}/indices/', params=params)
    
    def bulk_process_satellite_data(self, operation: str, satellite_data_ids: List[str], 
                                  parameters: Dict = None) -> Dict:
        """
        Perform bulk processing on satellite data.
        
        Args:
            operation: Processing operation type
            satellite_data_ids: List of data identifiers
            parameters: Processing parameters
            
        Returns:
            Dict: Bulk processing job response
        """
        data = {
            'operation': operation,
            'satellite_data_ids': satellite_data_ids
        }
        
        if parameters:
            data['parameters'] = parameters
        
        return self._make_request('POST', '/api/v1/satellite-data/bulk-process/', data)
    
    # Utility Methods
    def wait_for_job_completion(self, job_id: str, poll_interval: int = 30, 
                              max_wait_minutes: int = 60) -> Dict:
        """
        Wait for job completion with polling.
        
        Args:
            job_id: Job identifier
            poll_interval: Poll interval in seconds
            max_wait_minutes: Maximum wait time in minutes
            
        Returns:
            Dict: Final job status
        """
        start_time = time.time()
        max_wait_seconds = max_wait_minutes * 60
        
        while time.time() - start_time < max_wait_seconds:
            job_status = self._make_request('GET', f'/api/v1/processing-jobs/{job_id}/')
            
            status = job_status.get('status', 'unknown')
            self.logger.info(f"Job {job_id} status: {status}")
            
            if status in ['succeeded', 'failed', 'cancelled']:
                return job_status
            
            time.sleep(poll_interval)
        
        raise WatershedAPIError(f"Job {job_id} did not complete within {max_wait_minutes} minutes")
    
    def export_detections_to_geojson(self, filters: Dict, output_path: str) -> str:
        """
        Export detections to GeoJSON file.
        
        Args:
            filters: Detection filters
            output_path: Output file path
            
        Returns:
            str: Path to created file
        """
        # Create export request
        export_data = {
            'export_type': 'detections',
            'format': 'geojson',
            **filters
        }
        
        export_response = self.create_export(export_data)
        export_id = export_response['data']['id']
        
        # Wait for completion
        self.wait_for_job_completion(export_id)
        
        # Download file
        return self.download_export_file(export_id, output_path)
    
    def export_watershed_summary_csv(self, watershed_id: str, output_path: str) -> str:
        """
        Export watershed summary to CSV file.
        
        Args:
            watershed_id: Watershed identifier
            output_path: Output file path
            
        Returns:
            str: Path to created file
        """
        # Create export request
        export_data = {
            'export_type': 'watershed_summary',
            'format': 'csv',
            'watershed_id': watershed_id
        }
        
        export_response = self.create_export(export_data)
        export_id = export_response['data']['id']
        
        # Wait for completion
        self.wait_for_job_completion(export_id)
        
        # Download file
        return self.download_export_file(export_id, output_path)


# Example usage and testing
def example_usage():
    """Example of how to use the API client."""
    
    # Initialize client
    client = WatershedAPIClient(
        base_url='https://api.watershed-ds.com',
        # api_key='your_api_key'  # Optional if using API key auth
    )
    
    try:
        # Authenticate
        auth_response = client.authenticate(
            email='user@example.com',
            password='secure_password',
            remember_me=True
        )
        
        print(f"Authenticated as: {auth_response['user']['email']}")
        
        # List watersheds
        watersheds = client.list_watersheds(page=1, page_size=10)
        print(f"Found {watersheds['pagination']['total_items']} watersheds")
        
        # Create a new watershed
        watershed_data = {
            'name': 'Example Watershed',
            'description': 'A test watershed created via API',
            'boundary': {
                'type': 'Polygon',
                'coordinates': [[
                    [-122.5, 45.5],
                    [-122.4, 45.5],
                    [-122.4, 45.6],
                    [-122.5, 45.6],
                    [-122.5, 45.5]
                ]]
            },
            'metadata': {
                'region': 'Pacific Northwest',
                'ecosystem_type': 'Temperate Forest'
            }
        }
        
        created_watershed = client.create_watershed(watershed_data)
        watershed_id = created_watershed['data']['id']
        print(f"Created watershed: {created_watershed['data']['name']}")
        
        # Configure monitoring
        monitoring_config = {
            'algorithms': {
                'landtrendr': {
                    'enabled': True,
                    'parameters': {
                        'max_segments': 5,
                        'spike_threshold': 0.9
                    }
                },
                'fnrt': {
                    'enabled': True,
                    'parameters': {
                        'z_score_threshold': 2.5
                    }
                }
            },
            'monitoring_schedule': {
                'frequency': 'monthly',
                'preferred_sensors': ['sentinel2', 'landsat8'],
                'cloud_threshold': 30
            },
            'alert_thresholds': {
                'min_confidence': 0.8,
                'min_area_hectares': 0.1,
                'disturbance_types': ['fire', 'harvest']
            }
        }
        
        config_response = client.configure_monitoring(watershed_id, monitoring_config)
        print("Monitoring configuration updated")
        
        # Create alert
        alert_data = {
            'name': 'High Confidence Fire Detection',
            'description': 'Alert for fire detections above 80% confidence',
            'watershed_id': watershed_id,
            'alert_type': 'confidence_threshold',
            'conditions': {
                'min_confidence': 0.8,
                'disturbance_types': ['fire'],
                'min_area_hectares': 0.5
            },
            'channels': {
                'email': {
                    'addresses': ['alerts@example.com'],
                    'subject_template': 'Fire Detection Alert - {watershed_name}'
                },
                'dashboard': {
                    'enabled': True
                }
            }
        }
        
        alert_response = client.create_alert(alert_data)
        alert_id = alert_response['data']['id']
        print(f"Created alert: {alert_response['data']['name']}")
        
        # Test alert
        test_response = client.test_alert(alert_id)
        print("Alert test completed")
        
        # List recent detections
        detections = client.list_detections(
            watershed_id=watershed_id,
            start_date='2023-01-01',
            end_date='2023-12-31',
            min_confidence=0.6,
            page_size=20
        )
        
        print(f"Found {detections['pagination']['total_items']} detections")
        
        # Get detection statistics
        stats = client.get_detection_statistics(
            watershed_id=watership_id,
            group_by='month'
        )
        
        print(f"Detection statistics: {stats['statistics']}")
        
        # Create export
        export_data = {
            'export_type': 'detections',
            'format': 'csv',
            'watershed_id': watershed_id,
            'filters': {
                'start_date': '2023-01-01',
                'end_date': '2023-12-31',
                'min_confidence': 0.7,
                'disturbance_type': ['fire', 'harvest']
            },
            'options': {
                'include_metadata': True,
                'sort_by': 'detection_date',
                'sort_order': 'desc'
            }
        }
        
        export_response = client.create_export(export_data)
        export_id = export_response['data']['id']
        print(f"Created export request: {export_id}")
        
        # Wait for completion and download
        file_path = client.download_export_file(export_id, 'detections_export.csv')
        print(f"Export downloaded to: {file_path}")
        
    except WatershedAPIError as e:
        print(f"API Error: {e.message}")
        if e.response_data:
            print(f"Response data: {e.response_data}")
    
    finally:
        # Always logout
        try:
            client.logout()
            print("Logged out successfully")
        except:
            pass


if __name__ == '__main__':
    # Run example
    example_usage()