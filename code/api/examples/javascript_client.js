/**
 * JavaScript Client for Watershed Disturbance Mapping System API
 * 
 * This module provides a comprehensive JavaScript/Node.js client for interacting with
 * the Watershed Disturbance Mapping System API.
 * 
 * Features:
 * - Authentication and session management
 * - Watershed management
 * - Change detection queries
 * - Alert configuration
 * - Data export
 * - Error handling and retry logic
 * - Support for both browser and Node.js environments
 * 
 * @author Watershed Disturbance Mapping System
 * @version 1.0.0
 */

const https = require('https');
const http = require('http');
const url = require('url');
const { EventEmitter } = require('events');

/**
 * Custom exception for API errors
 */
class WatershedAPIError extends Error {
    constructor(message, statusCode = null, responseData = null) {
        super(message);
        this.name = 'WatershedAPIError';
        this.statusCode = statusCode;
        this.responseData = responseData || {};
    }
}

/**
 * Main API client class
 */
class WatershedAPIClient extends EventEmitter {
    /**
     * Initialize the API client
     * @param {Object} options Configuration options
     * @param {string} options.baseUrl Base URL of the API
     * @param {string} options.apiKey API key for authentication (optional)
     * @param {number} options.timeout Request timeout in milliseconds
     * @param {boolean} options.secure Use HTTPS (default: true)
     */
    constructor(options = {}) {
        super();
        
        this.baseUrl = options.baseUrl?.replace(/\/$/, '') || 'https://api.watershed-ds.com';
        this.apiKey = options.apiKey;
        this.timeout = options.timeout || 30000;
        this.secure = options.secure !== false;
        
        this.accessToken = null;
        this.refreshToken = null;
        
        // Set up default headers
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'User-Agent': 'WatershedAPI/1.0.0',
            'Accept': 'application/json'
        };
        
        if (this.apiKey) {
            this.defaultHeaders['Authorization'] = `Bearer ${this.apiKey}`;
        }
    }
    
    /**
     * Make HTTP request with error handling and retry logic
     * @param {string} method HTTP method
     * @param {string} endpoint API endpoint path
     * @param {Object} data Request body data
     * @param {Object} params Query parameters
     * @param {Object} files File data for uploads
     * @returns {Promise<Object>} API response data
     */
    async _makeRequest(method, endpoint, data = null, params = null, files = null) {
        const requestUrl = `${this.baseUrl}${endpoint}`;
        const parsedUrl = url.parse(requestUrl);
        
        // Build query string
        if (params) {
            const queryParams = new URLSearchParams(params);
            parsedUrl.search = queryParams.toString();
        }
        
        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (this.secure ? 443 : 80),
            path: parsedUrl.path + (parsedUrl.search || ''),
            method: method,
            headers: { ...this.defaultHeaders },
            timeout: this.timeout
        };
        
        // Add authentication header
        if (this.accessToken) {
            requestOptions.headers['Authorization'] = `Bearer ${this.accessToken}`;
        }
        
        // Handle file uploads
        if (files) {
            delete requestOptions.headers['Content-Type'];
            const formData = new FormData();
            
            // Add data fields
            if (data) {
                Object.keys(data).forEach(key => {
                    formData.append(key, data[key]);
                });
            }
            
            // Add files
            Object.keys(files).forEach(key => {
                formData.append(key, files[key]);
            });
            
            requestOptions.headers['Content-Type'] = `multipart/form-data; boundary=${formData._boundary}`;
        } else if (data) {
            requestOptions.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
        }
        
        const maxRetries = 3;
        let retryDelay = 1000;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await this._makeHttpRequest(requestOptions, data, files);
                
                // Handle HTTP errors
                if (response.statusCode >= 400) {
                    let errorData = {};
                    try {
                        errorData = JSON.parse(response.data);
                    } catch (e) {
                        // If JSON parsing fails, use raw data
                        errorData = { message: response.data };
                    }
                    
                    const errorMsg = errorData.message || errorData.detail || `HTTP ${response.statusCode}`;
                    
                    if (response.statusCode === 429) { // Rate limited
                        const retryAfter = parseInt(response.headers['retry-after'] || retryDelay / 1000);
                        this.emit('rateLimited', { retryAfter, attempt: attempt + 1 });
                        
                        if (attempt < maxRetries - 1) {
                            await this._sleep(retryAfter * 1000);
                            retryDelay *= 2;
                            continue;
                        }
                    }
                    
                    if (response.statusCode >= 500 && attempt < maxRetries - 1) {
                        this.emit('serverError', { statusCode: response.statusCode, attempt: attempt + 1 });
                        
                        await this._sleep(retryDelay);
                        retryDelay *= 2;
                        continue;
                    }
                    
                    const error = new WatershedAPIError(errorMsg, response.statusCode, errorData);
                    error.response = response;
                    throw error;
                }
                
                // Parse response
                if (response.statusCode === 204) { // No content
                    return {};
                }
                
                try {
                    return JSON.parse(response.data);
                } catch (e) {
                    return { data: response.data };
                }
                
            } catch (error) {
                if (error instanceof WatershedAPIError) {
                    throw error;
                }
                
                if (attempt === maxRetries - 1) {
                    const wrappedError = new WatershedAPIError(`Request failed: ${error.message}`);
                    wrappedError.originalError = error;
                    throw wrappedError;
                }
                
                this.emit('requestFailed', { error: error.message, attempt: attempt + 1 });
                await this._sleep(retryDelay);
                retryDelay *= 2;
            }
        }
    }
    
    /**
     * Make HTTP request and return response
     * @private
     */
    _makeHttpRequest(options, data = null, files = null) {
        return new Promise((resolve, reject) => {
            const protocol = this.secure ? https : http;
            const req = protocol.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            // Send data
            if (data && !files) {
                req.write(JSON.stringify(data));
            } else if (files) {
                const formData = this._buildFormData(data, files);
                req.write(formData);
            }
            
            req.end();
        });
    }
    
    /**
     * Build multipart form data
     * @private
     */
    _buildFormData(data, files) {
        const boundary = '----WatershedAPI' + Date.now();
        const delimiter = `--${boundary}`;
        const closeDelim = `--${boundary}--`;
        
        let body = '';
        
        // Add data fields
        if (data) {
            Object.keys(data).forEach(key => {
                body += `${delimiter}\r\n`;
                body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
                body += `${data[key]}\r\n`;
            });
        }
        
        // Add files
        if (files) {
            Object.keys(files).forEach(key => {
                const file = files[key];
                body += `${delimiter}\r\n`;
                body += `Content-Disposition: form-data; name="${key}"; filename="${file.name}"\r\n`;
                body += `Content-Type: ${file.contentType || 'application/octet-stream'}\r\n\r\n`;
                body += file.data + '\r\n';
            });
        }
        
        body += `${closeDelim}\r\n`;
        return body;
    }
    
    /**
     * Sleep for specified milliseconds
     * @private
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Authenticate user and obtain access tokens
     * @param {string} email User email
     * @param {string} password User password
     * @param {boolean} rememberMe Whether to extend token lifetime
     * @returns {Promise<Object>} Authentication response
     */
    async authenticate(email, password, rememberMe = false) {
        const data = {
            email,
            password,
            remember_me: rememberMe
        };
        
        const response = await this._makeRequest('POST', '/api/v1/auth/login/', data);
        
        if (response.access_token) {
            this.accessToken = response.access_token;
            this.refreshToken = response.refresh_token;
            this.emit('authenticated', response.user);
        }
        
        return response;
    }
    
    /**
     * Refresh access token
     * @returns {Promise<Object>} Token refresh response
     */
    async refreshAccessToken() {
        if (!this.refreshToken) {
            throw new WatershedAPIError('No refresh token available');
        }
        
        const data = { refresh_token: this.refreshToken };
        const response = await this._makeRequest('POST', '/api/v1/auth/refresh/', data);
        
        if (response.access_token) {
            this.accessToken = response.access_token;
            if (response.refresh_token) {
                this.refreshToken = response.refresh_token;
            }
            this.emit('tokenRefreshed', response);
        }
        
        return response;
    }
    
    /**
     * Logout user
     * @returns {Promise<Object>} Logout response
     */
    async logout() {
        const data = this.refreshToken ? { refresh_token: this.refreshToken } : {};
        const response = await this._makeRequest('POST', '/api/v1/auth/logout/', data);
        
        // Clear tokens
        this.accessToken = null;
        this.refreshToken = null;
        this.emit('loggedOut');
        
        return response;
    }
    
    // Watershed Management Methods
    
    /**
     * List watersheds with filtering
     * @param {Object} options List options
     * @returns {Promise<Object>} Watersheds list response
     */
    async listWatersheds(options = {}) {
        const { page = 1, pageSize = 20, ...filters } = options;
        const params = { page, page_size: pageSize, ...filters };
        return await this._makeRequest('GET', '/api/v1/watersheds/', null, params);
    }
    
    /**
     * Create a new watershed
     * @param {Object} watershedData Watershed creation data
     * @returns {Promise<Object>} Created watershed response
     */
    async createWatershed(watershedData) {
        return await this._makeRequest('POST', '/api/v1/watersheds/', watershedData);
    }
    
    /**
     * Get watershed details
     * @param {string} watershedId Watershed identifier
     * @returns {Promise<Object>} Watershed details response
     */
    async getWatershed(watershedId) {
        return await this._makeRequest('GET', `/api/v1/watersheds/${watershedId}/`);
    }
    
    /**
     * Update watershed information
     * @param {string} watershedId Watershed identifier
     * @param {Object} updateData Update data
     * @returns {Promise<Object>} Updated watershed response
     */
    async updateWatershed(watershedId, updateData) {
        return await this._makeRequest('PUT', `/api/v1/watersheds/${watershedId}/`, updateData);
    }
    
    /**
     * Delete watershed
     * @param {string} watershedId Watershed identifier
     * @returns {Promise<Object>} Deletion response
     */
    async deleteWatershed(watershedId) {
        return await this._makeRequest('DELETE', `/api/v1/watersheds/${watershedId}/`);
    }
    
    /**
     * Get change detections for a watershed
     * @param {string} watershedId Watershed identifier
     * @param {Object} filters Detection filters
     * @returns {Promise<Object>} Detections list response
     */
    async getWatershedDetections(watershedId, filters = {}) {
        return await this._makeRequest('GET', `/api/v1/watersheds/${watershedId}/detections/`, null, filters);
    }
    
    /**
     * Configure monitoring for a watershed
     * @param {string} watershedId Watershed identifier
     * @param {Object} configData Monitoring configuration
     * @returns {Promise<Object>} Configuration response
     */
    async configureMonitoring(watershedId, configData) {
        return await this._makeRequest('POST', `/api/v1/watersheds/${watershedId}/monitoring/`, configData);
    }
    
    // Change Detection Methods
    
    /**
     * List change detections
     * @param {Object} options List options
     * @returns {Promise<Object>} Detections list response
     */
    async listDetections(options = {}) {
        const { page = 1, pageSize = 20, ...filters } = options;
        const params = { page, page_size: pageSize, ...filters };
        return await this._makeRequest('GET', '/api/v1/change-detections/', null, params);
    }
    
    /**
     * Get detection details
     * @param {string} detectionId Detection identifier
     * @returns {Promise<Object>} Detection details response
     */
    async getDetection(detectionId) {
        return await this._makeRequest('GET', `/api/v1/change-detections/${detectionId}/`);
    }
    
    /**
     * Get time series data for a detection
     * @param {string} detectionId Detection identifier
     * @param {Object} filters Time series filters
     * @returns {Promise<Object>} Time series data response
     */
    async getDetectionTimeseries(detectionId, filters = {}) {
        return await this._makeRequest('GET', `/api/v1/change-detections/${detectionId}/timeseries/`, null, filters);
    }
    
    /**
     * Submit validation feedback for a detection
     * @param {string} detectionId Detection identifier
     * @param {Object} validationData Validation feedback data
     * @returns {Promise<Object>} Validation submission response
     */
    async submitValidation(detectionId, validationData) {
        validationData.detection_id = detectionId;
        return await this._makeRequest('POST', '/api/v1/change-detections/validate/', validationData);
    }
    
    /**
     * Get detection statistics
     * @param {Object} filters Statistics filters
     * @returns {Promise<Object>} Statistics response
     */
    async getDetectionStatistics(filters = {}) {
        return await this._makeRequest('GET', '/api/v1/change-detections/statistics/', null, filters);
    }
    
    // Alert Management Methods
    
    /**
     * List alert configurations
     * @param {Object} options List options
     * @returns {Promise<Object>} Alerts list response
     */
    async listAlerts(options = {}) {
        const { page = 1, pageSize = 20, ...filters } = options;
        const params = { page, page_size: pageSize, ...filters };
        return await this._makeRequest('GET', '/api/v1/alerts/', null, params);
    }
    
    /**
     * Create a new alert configuration
     * @param {Object} alertData Alert configuration data
     * @returns {Promise<Object>} Created alert response
     */
    async createAlert(alertData) {
        return await this._makeRequest('POST', '/api/v1/alerts/', alertData);
    }
    
    /**
     * Get alert details
     * @param {string} alertId Alert identifier
     * @returns {Promise<Object>} Alert details response
     */
    async getAlert(alertId) {
        return await this._makeRequest('GET', `/api/v1/alerts/${alertId}/`);
    }
    
    /**
     * Update alert configuration
     * @param {string} alertId Alert identifier
     * @param {Object} updateData Update data
     * @returns {Promise<Object>} Updated alert response
     */
    async updateAlert(alertId, updateData) {
        return await this._makeRequest('PUT', `/api/v1/alerts/${alertId}/`, updateData);
    }
    
    /**
     * Delete alert configuration
     * @param {string} alertId Alert identifier
     * @returns {Promise<Object>} Deletion response
     */
    async deleteAlert(alertId) {
        return await this._makeRequest('DELETE', `/api/v1/alerts/${alertId}/`);
    }
    
    /**
     * Test alert notification
     * @param {string} alertId Alert identifier
     * @param {Object} testData Test data (optional)
     * @returns {Promise<Object>} Test response
     */
    async testAlert(alertId, testData = {}) {
        return await this._makeRequest('POST', `/api/v1/alerts/${alertId}/test/`, testData);
    }
    
    /**
     * Mute alert notifications
     * @param {string} alertId Alert identifier
     * @param {number} durationHours Mute duration in hours
     * @param {string} reason Mute reason
     * @returns {Promise<Object>} Mute response
     */
    async muteAlert(alertId, durationHours = 24, reason = null) {
        const data = { duration_hours: durationHours };
        if (reason) data.reason = reason;
        return await this._makeRequest('POST', `/api/v1/alerts/${alertId}/mute/`, data);
    }
    
    /**
     * Unmute alert notifications
     * @param {string} alertId Alert identifier
     * @returns {Promise<Object>} Unmute response
     */
    async unmuteAlert(alertId) {
        return await this._makeRequest('POST', `/api/v1/alerts/${alertId}/unmute/`, {});
    }
    
    // Export Methods
    
    /**
     * List export requests
     * @param {Object} options List options
     * @returns {Promise<Object>} Exports list response
     */
    async listExports(options = {}) {
        const { page = 1, pageSize = 20, ...filters } = options;
        const params = { page, page_size: pageSize, ...filters };
        return await this._makeRequest('GET', '/api/v1/exports/', null, params);
    }
    
    /**
     * Create new data export request
     * @param {Object} exportData Export configuration data
     * @returns {Promise<Object>} Created export response
     */
    async createExport(exportData) {
        return await this._makeRequest('POST', '/api/v1/exports/', exportData);
    }
    
    /**
     * Get export request details
     * @param {string} exportId Export identifier
     * @returns {Promise<Object>} Export details response
     */
    async getExport(exportId) {
        return await this._makeRequest('GET', `/api/v1/exports/${exportId}/`);
    }
    
    /**
     * Get download URL for completed export
     * @param {string} exportId Export identifier
     * @returns {Promise<Object>} Download URL response
     */
    async downloadExport(exportId) {
        return await this._makeRequest('GET', `/api/v1/exports/${exportId}/download/`);
    }
    
    /**
     * Cancel export request
     * @param {string} exportId Export identifier
     * @returns {Promise<Object>} Cancellation response
     */
    async cancelExport(exportId) {
        return await this._makeRequest('DELETE', `/api/v1/exports/${exportId}/`);
    }
    
    /**
     * Get available export format templates
     * @returns {Promise<Object>} Export templates response
     */
    async getExportTemplates() {
        return await this._makeRequest('GET', '/api/v1/exports/templates/');
    }
    
    /**
     * Wait for job completion with polling
     * @param {string} jobId Job identifier
     * @param {Object} options Polling options
     * @returns {Promise<Object>} Final job status
     */
    async waitForJobCompletion(jobId, options = {}) {
        const pollInterval = options.pollInterval || 30000;
        const maxWaitMinutes = options.maxWaitMinutes || 60;
        const maxWaitMs = maxWaitMinutes * 60 * 1000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitMs) {
            const jobStatus = await this._makeRequest('GET', `/api/v1/processing-jobs/${jobId}/`);
            const status = jobStatus.status || 'unknown';
            
            this.emit('jobStatus', { jobId, status });
            
            if (['succeeded', 'failed', 'cancelled'].includes(status)) {
                return jobStatus;
            }
            
            await this._sleep(pollInterval);
        }
        
        throw new WatershedAPIError(`Job ${jobId} did not complete within ${maxWaitMinutes} minutes`);
    }
    
    /**
     * Export detections to GeoJSON file
     * @param {Object} filters Detection filters
     * @param {string} outputPath Output file path
     * @returns {Promise<string>} Path to created file
     */
    async exportDetectionsToGeojson(filters, outputPath) {
        const exportData = {
            export_type: 'detections',
            format: 'geojson',
            ...filters
        };
        
        const exportResponse = await this.createExport(exportData);
        const exportId = exportResponse.data.id;
        
        // Wait for completion
        await this.waitForJobCompletion(exportId);
        
        // Download file (Note: This would need file system access)
        // Implementation depends on the environment (Node.js vs Browser)
        const downloadResponse = await this.downloadExport(exportId);
        
        return {
            exportId,
            downloadUrl: downloadResponse.download_url,
            outputPath
        };
    }
}

// Example usage
async function exampleUsage() {
    // Initialize client
    const client = new WatershedAPIClient({
        baseUrl: 'https://api.watershed-ds.com',
        // apiKey: 'your_api_key'  // Optional if using API key auth
    });
    
    try {
        // Set up event listeners
        client.on('authenticated', (user) => {
            console.log(`Authenticated as: ${user.email}`);
        });
        
        client.on('jobStatus', ({ jobId, status }) => {
            console.log(`Job ${jobId} status: ${status}`);
        });
        
        // Authenticate
        const authResponse = await client.authenticate(
            'user@example.com',
            'secure_password',
            true
        );
        
        // List watersheds
        const watersheds = await client.listWatersheds({ page: 1, pageSize: 10 });
        console.log(`Found ${watersheds.pagination.total_items} watersheds`);
        
        // Create a new watershed
        const watershedData = {
            name: 'Example Watershed',
            description: 'A test watershed created via API',
            boundary: {
                type: 'Polygon',
                coordinates: [[
                    [-122.5, 45.5],
                    [-122.4, 45.5],
                    [-122.4, 45.6],
                    [-122.5, 45.6],
                    [-122.5, 45.5]
                ]]
            },
            metadata: {
                region: 'Pacific Northwest',
                ecosystem_type: 'Temperate Forest'
            }
        };
        
        const createdWatershed = await client.createWatershed(watershedData);
        const watershedId = createdWatershed.data.id;
        console.log(`Created watershed: ${createdWatershed.data.name}`);
        
        // Configure monitoring
        const monitoringConfig = {
            algorithms: {
                landtrendr: {
                    enabled: true,
                    parameters: {
                        max_segments: 5,
                        spike_threshold: 0.9
                    }
                },
                fnrt: {
                    enabled: true,
                    parameters: {
                        z_score_threshold: 2.5
                    }
                }
            },
            monitoring_schedule: {
                frequency: 'monthly',
                preferred_sensors: ['sentinel2', 'landsat8'],
                cloud_threshold: 30
            },
            alert_thresholds: {
                min_confidence: 0.8,
                min_area_hectares: 0.1,
                disturbance_types: ['fire', 'harvest']
            }
        };
        
        await client.configureMonitoring(watershedId, monitoringConfig);
        console.log('Monitoring configuration updated');
        
        // Create alert
        const alertData = {
            name: 'High Confidence Fire Detection',
            description: 'Alert for fire detections above 80% confidence',
            watershed_id: watershedId,
            alert_type: 'confidence_threshold',
            conditions: {
                min_confidence: 0.8,
                disturbance_types: ['fire'],
                min_area_hectares: 0.5
            },
            channels: {
                email: {
                    addresses: ['alerts@example.com'],
                    subject_template: 'Fire Detection Alert - {watershed_name}'
                },
                dashboard: {
                    enabled: true
                }
            }
        };
        
        const alertResponse = await client.createAlert(alertData);
        const alertId = alertResponse.data.id;
        console.log(`Created alert: ${alertResponse.data.name}`);
        
        // Test alert
        await client.testAlert(alertId);
        console.log('Alert test completed');
        
        // List recent detections
        const detections = await client.listDetections({
            watershed_id: watershedId,
            start_date: '2023-01-01',
            end_date: '2023-12-31',
            min_confidence: 0.6,
            pageSize: 20
        });
        
        console.log(`Found ${detections.pagination.total_items} detections`);
        
        // Get detection statistics
        const stats = await client.getDetectionStatistics({
            watershed_id: watershedId,
            group_by: 'month'
        });
        
        console.log('Detection statistics:', stats.statistics);
        
        // Create export
        const exportData = {
            export_type: 'detections',
            format: 'csv',
            watershed_id: watershedId,
            filters: {
                start_date: '2023-01-01',
                end_date: '2023-12-31',
                min_confidence: 0.7,
                disturbance_type: ['fire', 'harvest']
            },
            options: {
                include_metadata: true,
                sort_by: 'detection_date',
                sort_order: 'desc'
            }
        };
        
        const exportResponse = await client.createExport(exportData);
        const exportId = exportResponse.data.id;
        console.log(`Created export request: ${exportId}`);
        
        // Wait for completion
        await client.waitForJobCompletion(exportId);
        
        // Get download URL
        const downloadResponse = await client.downloadExport(exportId);
        console.log(`Export available at: ${downloadResponse.download_url}`);
        
    } catch (error) {
        if (error instanceof WatershedAPIError) {
            console.error(`API Error: ${error.message}`);
            if (error.responseData) {
                console.error('Response data:', error.responseData);
            }
        } else {
            console.error('Error:', error.message);
        }
    } finally {
        // Always logout
        try {
            await client.logout();
            console.log('Logged out successfully');
        } catch (error) {
            console.error('Logout failed:', error.message);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        WatershedAPIClient,
        WatershedAPIError,
        exampleUsage
    };
}

// Run example if executed directly
if (typeof require !== 'undefined' && require.main === module) {
    exampleUsage().catch(console.error);
}