# System Testing Guide
## Watershed Disturbance Mapping System

### Table of Contents
1. [Overview](#overview)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [End-to-End Testing](#end-to-end-testing)
5. [Performance Testing](#performance-testing)
6. [Load Testing](#load-testing)
7. [Security Testing](#security-testing)
8. [Database Testing](#database-testing)
9. [VPN Connectivity Testing](#vpn-connectivity-testing)
10. [Alert System Testing](#alert-system-testing)
11. [Test Data Generation](#test-data-generation)
12. [Test Automation](#test-automation)

## Overview

This document provides comprehensive testing procedures for the Watershed Disturbance Mapping System. The testing strategy covers all system components and ensures reliability, performance, and security.

### Test Environment Setup

```bash
# Install testing dependencies
pip install pytest pytest-cov pytest-asyncio pytest-html
npm install --save-dev jest supertest cypress
```

### Test Data Locations
- Sample watershed boundaries: `/test_data/watersheds/`
- Satellite imagery samples: `/test_data/satellite/`
- Test user accounts: `/test_data/users.json`

## Unit Testing

### Python Pipeline Testing

```python
# test/test_satellite_processing.py
import pytest
import numpy as np
from python_processing.preprocessing.spectral_indices import calculate_ndvi

def test_ndvi_calculation():
    """Test NDVI calculation with known values"""
    # Red and NIR bands (Landsat 8)
    red = np.array([0.1, 0.3, 0.5, 0.7])
    nir = np.array([0.8, 0.6, 0.4, 0.2])
    
    ndvi = calculate_ndvi(red, nir)
    expected = np.array([0.777, 0.333, -0.111, -0.555])
    
    np.testing.assert_allclose(ndvi, expected, rtol=1e-3)

def test_change_detection():
    """Test change detection algorithms"""
    from python_processing.change_detection.spectral_change import detect_change
    
    # Create test time series data
    time_series = np.random.rand(10, 100, 100)  # 10 time steps, 100x100 pixels
    
    # Test change detection
    changes = detect_change(time_series, threshold=0.1)
    
    assert changes.shape == (100, 100)
    assert np.all((changes >= 0) & (changes <= 1))

def test_confidence_scoring():
    """Test confidence scoring system"""
    from python_processing.quality_control.confidence_scorer import calculate_confidence
    
    # Test data quality metrics
    data_quality = 0.8
    spectral_consistency = 0.7
    statistical_validation = 0.9
    
    confidence = calculate_confidence(
        data_quality, spectral_consistency, statistical_validation
    )
    
    assert 0 <= confidence <= 1
    assert confidence > 0.5  # Should be reasonable confidence
```

#### Running Python Tests

```bash
# Run all Python tests
cd python_processing
python -m pytest test/ -v --cov=. --cov-report=html

# Run specific test categories
python -m pytest test/test_satellite_processing.py -v
python -m pytest test/test_change_detection.py -v
python -m pytest test/test_database.py -v
```

### Node.js API Testing

```javascript
// test/api.test.js
const request = require('supertest');
const app = require('../api_server/server');

describe('API Endpoints', () => {
  let authToken;
  
  beforeAll(async () => {
    // Login and get auth token
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@watershedmapping.com',
        password: 'AdminPassword123!'
      });
    authToken = response.body.token;
  });

  test('GET /api/watersheds', async () => {
    const response = await request(app)
      .get('/api/watersheds')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('watersheds');
    expect(Array.isArray(response.body.watersheds)).toBe(true);
  });

  test('POST /api/satellite-data/search', async () => {
    const response = await request(app)
      .post('/api/satellite-data/search')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        source: 'landsat',
        west: -105.0,
        south: 40.0,
        east: -104.0,
        north: 41.0,
        startDate: '2023-01-01',
        endDate: '2023-01-31'
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('scenes');
    expect(Array.isArray(response.body.scenes)).toBe(true);
  });

  test('POST /api/change-detection', async () => {
    const response = await request(app)
      .post('/api/change-detection')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        watershedId: 'test-123',
        algorithm: 'spectral',
        startDate: '2023-01-01',
        endDate: '2023-06-01'
      });
    
    expect(response.status).toBe(202);
    expect(response.body).toHaveProperty('taskId');
    expect(response.body.status).toBe('processing');
  });
});
```

#### Running Node.js Tests

```bash
# Install testing dependencies
cd api_server
npm install --save-dev jest supertest

# Run API tests
npm test

# Run with coverage
npm run test:coverage
```

### React Frontend Testing

```javascript
// frontend/src/components/__tests__/Dashboard.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import Dashboard from '../Dashboard';
import { mockWatersheds } from '../../test/mocks/data';

describe('Dashboard Component', () => {
  test('renders dashboard header', () => {
    render(<Dashboard watersheds={mockWatersheds} />);
    expect(screen.getByText('Watershed Monitoring')).toBeInTheDocument();
  });

  test('displays watershed statistics', () => {
    render(<Dashboard watersheds={mockWatersheds} />);
    
    expect(screen.getByText('Total Watersheds')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Active Monitoring')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('filters watersheds by health status', () => {
    render(<Dashboard watersheds={mockWatersheds} />);
    
    const healthyFilter = screen.getByText('Healthy');
    fireEvent.click(healthyFilter);
    
    // Should only show healthy watersheds
    expect(screen.getByText('Columbia River')).toBeInTheDocument();
    expect(screen.queryByText('Mississippi River')).not.toBeInTheDocument();
  });
});

// frontend/src/components/__tests__/MapView.test.jsx
import { render, screen } from '@testing-library/react';
import MapView from '../MapView';
import { mockDetections } from '../../test/mocks/data';

describe('MapView Component', () => {
  test('renders map container', () => {
    render(<MapView detections={mockDetections} />);
    expect(screen.getByTestId('leaflet-map')).toBeInTheDocument();
  });

  test('displays change detection markers', () => {
    render(<MapView detections={mockDetections} />);
    
    // Should display detection markers based on confidence
    const highConfidenceMarker = screen.getByText('High Confidence');
    expect(highConfidenceMarker).toBeInTheDocument();
  });
});
```

#### Running React Tests

```bash
# Install testing dependencies
cd frontend
npm install --save-dev @testing-library/react @testing-library/jest-dom

# Run frontend tests
npm test

# Run with coverage
npm test -- --coverage
```

## Integration Testing

### Database Integration

```python
# test/test_database_integration.py
import pytest
import psycopg2
from python_processing.database.database_manager import DatabaseManager

@pytest.fixture
def db_manager():
    return DatabaseManager(
        host='localhost',
        database='watershed_mapping_test',
        user='test_user',
        password='test_password'
    )

def test_database_connection(db_manager):
    """Test database connection and basic operations"""
    assert db_manager.connect() is True
    
    # Test watershed insertion
    watershed_data = {
        'name': 'Test Watershed',
        'boundary': 'POLYGON((-105 40, -104 40, -104 41, -105 41, -105 40))',
        'area_hectares': 1000.0
    }
    
    watershed_id = db_manager.insert_watershed(watershed_data)
    assert watershed_id is not None
    
    # Test retrieval
    retrieved = db_manager.get_watershed(watershed_id)
    assert retrieved['name'] == 'Test Watershed'
    
    db_manager.disconnect()

def test_spatial_queries(db_manager):
    """Test spatial queries and operations"""
    # Create test watersheds
    watershed1 = {
        'name': 'Watershed 1',
        'boundary': 'POLYGON((-105 40, -104 40, -104 41, -105 41, -105 40))',
        'area_hectares': 1000.0
    }
    
    watershed2 = {
        'name': 'Watershed 2', 
        'boundary': 'POLYGON((-104 40, -103 40, -103 41, -104 41, -104 40))',
        'area_hectares': 1500.0
    }
    
    id1 = db_manager.insert_watershed(watershed1)
    id2 = db_manager.insert_watershed(watershed2)
    
    # Test spatial intersection
    intersections = db_manager.get_watersheds_intersecting(
        'POLYGON((-105.5 39.5, -103.5 39.5, -103.5 41.5, -105.5 41.5, -105.5 39.5))'
    )
    
    assert len(intersections) == 2
```

### API-Database Integration

```javascript
// test/integration.test.js
const request = require('supertest');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  database: 'watershed_mapping_test',
  user: 'test_user',
  password: 'test_password'
});

describe('API-Database Integration', () => {
  beforeAll(async () => {
    // Setup test database
    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_watersheds (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        boundary GEOMETRY,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
  });

  afterAll(async () => {
    // Cleanup test database
    await pool.query('DROP TABLE IF EXISTS test_watersheds');
    await pool.end();
  });

  test('POST /api/watersheds creates database record', async () => {
    const watershedData = {
      name: 'Integration Test Watershed',
      boundary: {
        type: 'Polygon',
        coordinates: [[[-105, 40], [-104, 40], [-104, 41], [-105, 41], [-105, 40]]]
      }
    };

    const response = await request(app)
      .post('/api/watersheds')
      .set('Authorization', `Bearer ${authToken}`)
      .send(watershedData)
      .expect(201);

    expect(response.body.watershed.name).toBe('Integration Test Watershed');
    expect(response.body.watershed.id).toBeDefined();

    // Verify in database
    const dbResult = await pool.query(
      'SELECT * FROM test_watersheds WHERE name = $1',
      ['Integration Test Watershed']
    );
    
    expect(dbResult.rows.length).toBe(1);
    expect(dbResult.rows[0].name).toBe('Integration Test Watershed');
  });
});
```

## End-to-End Testing

### Full Workflow Testing

```javascript
// cypress/integration/full_workflow.spec.js
describe('Complete Watershed Monitoring Workflow', () => {
  beforeEach(() => {
    cy.login('admin@watershedmapping.com', 'AdminPassword123!');
  });

  it('Complete watershed monitoring workflow', () => {
    // 1. Create new watershed
    cy.visit('/watersheds/new');
    cy.get('[data-testid="watershed-name"]').type('E2E Test Watershed');
    cy.get('[data-testid="watershed-area"]').type('5000');
    cy.get('[data-testid="upload-boundary"]').selectFile('test-data/test-watershed.geojson');
    cy.get('[data-testid="save-watershed"]').click();
    
    // Verify watershed appears in list
    cy.contains('E2E Test Watershed').should('be.visible');

    // 2. Configure monitoring
    cy.visit('/watersheds');
    cy.get('[data-testid="watershed-item"]:contains("E2E Test Watershed")').click();
    cy.get('[data-testid="configure-monitoring"]').click();
    cy.get('[data-testid="select-algorithm"]').select('spectral');
    cy.get('[data-testid="set-frequency"]').select('weekly');
    cy.get('[data-testid="save-configuration"]').click();

    // 3. Trigger satellite processing
    cy.get('[data-testid="process-data"]').click();
    cy.get('[data-testid="date-range"]').type('2023-01-01 to 2023-06-01');
    cy.get('[data-testid="start-processing"]').click();
    
    // Verify processing status
    cy.get('[data-testid="processing-status"]').should('contain', 'Processing');
    
    // Wait for completion (with timeout)
    cy.get('[data-testid="processing-status"]', { timeout: 30000 })
      .should('contain', 'Completed');

    // 4. View change detection results
    cy.get('[data-testid="view-results"]').click();
    cy.get('[data-testid="detection-list"]').should('be.visible');
    cy.get('[data-testid="detection-item"]').should('have.length.at.least', 1);
    
    // Verify confidence scoring
    cy.get('[data-testid="confidence-score"]').should('be.visible');
    
    // 5. Configure alerts
    cy.get('[data-testid="configure-alerts"]').click();
    cy.get('[data-testid="alert-threshold"]').type('0.8');
    cy.get('[data-testid="alert-email"]').type('test@example.com');
    cy.get('[data-testid="save-alerts"]').click();

    // 6. Export data
    cy.get('[data-testid="export-data"]').click();
    cy.get('[data-testid="export-format"]').select('geojson');
    cy.get('[data-testid="export-download"]').click();
    
    // Verify download
    cy.readFile('cypress/downloads/export.geojson').should('exist');
  });
});
```

### Database Performance Test

```python
# test/test_e2e_performance.py
import time
import numpy as np
from python_processing.database.database_manager import DatabaseManager

def test_large_dataset_performance():
    """Test system performance with large datasets"""
    db_manager = DatabaseManager()
    db_manager.connect()
    
    start_time = time.time()
    
    # Create 1000 test watersheds
    for i in range(1000):
        watershed_data = {
            'name': f'Test Watershed {i}',
            'boundary': f'POLYGON({-105+i*0.001} {40}, {-104+i*0.001} {40}, {-104+i*0.001} {41}, {-105+i*0.001} {41}, {-105+i*0.001} {40})',
            'area_hectares': np.random.uniform(100, 10000)
        }
        db_manager.insert_watershed(watershed_data)
    
    insertion_time = time.time() - start_time
    print(f"Inserted 1000 watersheds in {insertion_time:.2f} seconds")
    
    # Test spatial query performance
    query_start = time.time()
    results = db_manager.get_watersheds_intersecting(
        'POLYGON((-105 40, -104 40, -104 41, -105 41, -105 40))'
    )
    query_time = time.time() - query_start
    
    print(f"Spatial query completed in {query_time:.2f} seconds")
    print(f"Found {len(results)} watersheds in query area")
    
    # Performance assertions
    assert insertion_time < 30  # Should insert within 30 seconds
    assert query_time < 5  # Query should complete within 5 seconds
    assert len(results) > 0  # Should find some results
    
    db_manager.disconnect()
```

## Performance Testing

### Satellite Processing Performance

```python
# test/test_performance.py
import time
import psutil
import os
from python_processing.data_acquisition.usgs_client import USGSClient

def test_satellite_download_performance():
    """Test satellite data download performance"""
    client = USGSClient()
    
    start_time = time.time()
    start_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
    
    # Download test scenes
    scenes = client.search_scenes(
        latitude=40.0,
        longitude=-105.0,
        start_date='2023-01-01',
        end_date='2023-01-07',
        cloud_cover_max=20
    )
    
    download_start = time.time()
    for scene in scenes[:5]:  # Download first 5 scenes
        client.download_scene(scene['scene_id'], './test_downloads/')
    
    download_time = time.time() - download_start
    end_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
    memory_used = end_memory - start_memory
    
    print(f"Downloaded 5 scenes in {download_time:.2f} seconds")
    print(f"Memory used: {memory_used:.2f} MB")
    print(f"Average download speed: {5/download_time:.2f} scenes/second")
    
    # Performance assertions
    assert download_time < 300  # Should download within 5 minutes
    assert memory_used < 2048  # Should use less than 2GB memory

def test_change_detection_performance():
    """Test change detection algorithm performance"""
    from python_processing.change_detection.spectral_change import detect_change
    
    # Create large test dataset (10GB simulation)
    time_steps = 50
    width, height = 1000, 1000
    test_data = np.random.rand(time_steps, width, height)
    
    start_time = time.time()
    
    # Run change detection
    changes = detect_change(test_data, threshold=0.1)
    
    processing_time = time.time() - start_time
    pixels_per_second = (width * height) / processing_time
    
    print(f"Processed {width}x{height} image in {processing_time:.2f} seconds")
    print(f"Processing speed: {pixels_per_second:.0f} pixels/second")
    
    # Performance assertions
    assert processing_time < 60  # Should process within 1 minute
    assert changes.shape == (width, height)
```

### API Performance Testing

```javascript
// test/api-performance.test.js
const autocannon = require('autocannon');

describe('API Performance Tests', () => {
  test('GET /api/watersheds performance', async () => {
    const result = await autocannon({
      url: 'http://localhost:3001/api/watersheds',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      connections: 100,
      duration: 10
    });

    console.log('Watersheds API Performance:');
    console.log(`Requests: ${result.requests.total}`);
    console.log(`Average latency: ${result.latency.average}ms`);
    console.log(`Requests per second: ${result.requests.average}`);
    
    // Performance assertions
    expect(result.latency.average).toBeLessThan(100); // < 100ms average
    expect(result.requests.average).toBeGreaterThan(50); // > 50 RPS
  });

  test('POST /api/change-detection performance', async () => {
    const payload = {
      watershedId: 'test-123',
      algorithm: 'spectral',
      startDate: '2023-01-01',
      endDate: '2023-06-01'
    };

    const result = await autocannon({
      url: 'http://localhost:3001/api/change-detection',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      connections: 50,
      duration: 10
    });

    console.log('Change Detection API Performance:');
    console.log(`Requests: ${result.requests.total}`);
    console.log(`Average latency: ${result.latency.average}ms`);
    
    expect(result.latency.average).toBeLessThan(500); // < 500ms for processing
  });
});
```

## Load Testing

### Concurrent User Testing

```javascript
// test/load-testing.test.js
const autocannon = require('autocannon');

describe('Load Testing', () => {
  test('concurrent users accessing dashboard', async () => {
    const result = await autocannon({
      url: 'http://localhost:3000/dashboard',
      method: 'GET',
      connections: 200, // 200 concurrent users
      duration: 30,     // Test for 30 seconds
      headers: {
        'User-Agent': 'load-test-client'
      }
    });

    console.log('Dashboard Load Test Results:');
    console.log(`Total requests: ${result.requests.total}`);
    console.log(`Average latency: ${result.latency.average}ms`);
    console.log(`Requests per second: ${result.requests.average}`);
    console.log(`95th percentile latency: ${result.latency.p95}ms`);
    console.log(`Error rate: ${(result.errors / result.requests.total * 100).toFixed(2)}%`);
    
    // Load test assertions
    expect(result.requests.average).toBeGreaterThan(100); // > 100 RPS
    expect(result.latency.p95).toBeLessThan(1000); // < 1s for 95% of requests
    expect(result.errors / result.requests.total).toBeLessThan(0.01); // < 1% error rate
  });

  test('database connection pool under load', async () => {
    const promises = [];
    
    // Create 100 concurrent database queries
    for (let i = 0; i < 100; i++) {
      promises.push(
        fetch('http://localhost:3001/api/watersheds', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
      );
    }
    
    const startTime = Date.now();
    const responses = await Promise.all(promises);
    const endTime = Date.now();
    
    console.log(`100 concurrent requests completed in ${endTime - startTime}ms`);
    
    // Verify all requests succeeded
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });
});
```

## Security Testing

### Vulnerability Assessment

```python
# test/test_security.py
import requests
import hashlib
import re

def test_sql_injection_protection():
    """Test SQL injection protection"""
    sql_injection_payloads = [
        "'; DROP TABLE watersheds; --",
        "' OR '1'='1",
        "1; DELETE FROM users WHERE '1'='1",
        "UNION SELECT * FROM users"
    ]
    
    for payload in sql_injection_payloads:
        response = requests.post('http://localhost:3001/api/watersheds', 
                                json={'name': payload, 'area': 1000})
        
        # Should not return SQL errors
        assert 'SQL' not in response.text.upper()
        assert 'ERROR' not in response.text.upper()
        assert response.status_code != 500

def test_xss_protection():
    """Test XSS protection in inputs"""
    xss_payloads = [
        "<script>alert('xss')</script>",
        "javascript:alert('xss')",
        "<img src=x onerror=alert('xss')>",
        "';alert('xss');//"
    ]
    
    for payload in xss_payloads:
        response = requests.post('http://localhost:3001/api/watersheds',
                                json={'name': payload, 'area': 1000})
        
        # Should sanitize or reject XSS payloads
        if response.status_code == 200:
            assert '<script>' not in response.json().get('name', '')

def test_authentication_bypass():
    """Test authentication bypass attempts"""
    # Test without authentication
    response = requests.get('http://localhost:3001/api/watersheds')
    assert response.status_code == 401
    
    # Test with invalid token
    response = requests.get('http://localhost:3001/api/watersheds',
                           headers={'Authorization': 'Bearer invalid_token'})
    assert response.status_code == 401
    
    # Test with expired token (simulate)
    expired_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' \
                   'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMDB9.' \
                   'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    
    response = requests.get('http://localhost:3001/api/watersheds',
                           headers={'Authorization': f'Bearer {expired_token}'})
    assert response.status_code == 401

def test_rate_limiting():
    """Test rate limiting"""
    # Send many requests quickly
    responses = []
    for i in range(200):  # Exceed rate limit
        response = requests.get('http://localhost:3001/api/watersheds',
                               headers={'Authorization': f'Bearer {authToken}'})
        responses.append(response.status_code)
    
    # Should get some 429 (Too Many Requests) responses
    rate_limited = sum(1 for status in responses if status == 429)
    assert rate_limited > 0  # Should have rate limiting
```

### Security Headers Testing

```javascript
// test/security-headers.test.js
const request = require('supertest');

describe('Security Headers', () => {
  test('includes security headers', async () => {
    const response = await request(app)
      .get('/api/watersheds')
      .set('Authorization', `Bearer ${authToken}`);
    
    // Check for security headers
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    expect(response.headers['strict-transport-security']).toBeDefined();
  });

  test('HTTPS enforcement', async () => {
    // Should redirect HTTP to HTTPS (when HTTPS is available)
    const response = await request('http://localhost:3001')
      .get('/dashboard')
      .redirects(0);
    
    // In production, should redirect to HTTPS
    // expect(response.status).toBe(301);
  });
});
```

## Database Testing

### Spatial Query Testing

```sql
-- test/test_spatial_queries.sql

-- Test spatial indexing performance
EXPLAIN ANALYZE 
SELECT * FROM watersheds 
WHERE ST_Intersects(
  boundary, 
  ST_GeomFromText('POLYGON((-105 40, -104 40, -104 41, -105 41, -105 40))', 4326)
);

-- Test coordinate system transformations
SELECT 
  name,
  ST_Area(ST_Transform(boundary, 3857)) as area_web_mercator,
  ST_Area(boundary) as area_wgs84
FROM watersheds 
WHERE id = 1;

-- Test spatial joins
SELECT 
  w.name as watershed_name,
  COUNT(d.id) as detection_count,
  AVG(d.confidence_score) as avg_confidence
FROM watersheds w
LEFT JOIN detections d ON ST_Intersects(w.boundary, d.geometry)
WHERE w.created_at >= '2023-01-01'
GROUP BY w.id, w.name;
```

### Database Performance Testing

```python
# test/test_database_performance.py
import time
import psycopg2
from contextlib import contextmanager

@contextmanager
def get_connection():
    conn = psycopg2.connect(
        host='localhost',
        database='watershed_mapping_test',
        user='test_user',
        password='test_password'
    )
    try:
        yield conn
    finally:
        conn.close()

def test_spatial_index_performance():
    """Test spatial index effectiveness"""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Disable indexes temporarily
        cursor.execute("DROP INDEX IF EXISTS idx_watersheds_boundary_gist")
        
        # Run query without index
        start_time = time.time()
        cursor.execute("""
            SELECT COUNT(*) FROM watersheds 
            WHERE ST_Intersects(
                boundary, 
                ST_GeomFromText('POLYGON((-105 40, -104 40, -104 41, -105 41, -105 40))', 4326)
            )
        """)
        without_index_time = time.time() - start_time
        
        # Recreate index
        cursor.execute("""
            CREATE INDEX idx_watersheds_boundary_gist 
            ON watersheds USING GIST (boundary)
        """)
        
        # Run query with index
        start_time = time.time()
        cursor.execute("""
            SELECT COUNT(*) FROM watersheds 
            WHERE ST_Intersects(
                boundary, 
                ST_GeomFromText('POLYGON((-105 40, -104 40, -104 41, -105 41, -105 40))', 4326)
            )
        """)
        with_index_time = time.time() - start_time
        
        print(f"Query without index: {without_index_time:.3f}s")
        print(f"Query with index: {with_index_time:.3f}s")
        print(f"Speed improvement: {without_index_time/with_index_time:.1f}x")
        
        # Index should improve performance
        assert with_index_time < without_index_time

def test_connection_pooling():
    """Test database connection pooling"""
    import threading
    import queue
    
    results = queue.Queue()
    
    def query_worker():
        try:
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM watersheds")
                count = cursor.fetchone()[0]
                results.put(('success', count))
        except Exception as e:
            results.put(('error', str(e)))
    
    # Test concurrent connections
    threads = []
    for i in range(50):
        thread = threading.Thread(target=query_worker)
        threads.append(thread)
        thread.start()
    
    # Wait for all threads to complete
    for thread in threads:
        thread.join()
    
    # Check results
    success_count = 0
    error_count = 0
    
    while not results.empty():
        status, data = results.get()
        if status == 'success':
            success_count += 1
        else:
            error_count += 1
            print(f"Connection error: {data}")
    
    print(f"Successful connections: {success_count}")
    print(f"Failed connections: {error_count}")
    
    # Should handle concurrent connections
    assert success_count >= 45  # Allow for some connection limits
```

## VPN Connectivity Testing

### VPN Connection Testing

```bash
#!/bin/bash
# test/vpn_test.sh

echo "Testing VPN Connectivity..."

# Test WireGuard connection
echo "1. Testing WireGuard connection..."
wg show
if [ $? -eq 0 ]; then
    echo "✅ WireGuard interface is active"
else
    echo "❌ WireGuard interface not found"
fi

# Test VPN connectivity
echo "2. Testing VPN connectivity..."
ping -c 3 10.0.0.1  # VPN gateway
if [ $? -eq 0 ]; then
    echo "✅ VPN gateway is reachable"
else
    echo "❌ VPN gateway not reachable"
fi

# Test DNS resolution through VPN
echo "3. Testing DNS resolution..."
nslookup watershed-mapping.local
if [ $? -eq 0 ]; then
    echo "✅ DNS resolution working"
else
    echo "❌ DNS resolution failed"
fi

# Test web interface access through VPN
echo "4. Testing web interface access..."
curl -k https://localhost:3000/health
if [ $? -eq 0 ]; then
    echo "✅ Web interface accessible"
else
    echo "❌ Web interface not accessible"
fi

echo "VPN testing completed."
```

### Network Security Testing

```bash
#!/bin/bash
# test/vpn_security_test.sh

echo "Testing VPN Security..."

# Check firewall rules
echo "1. Checking firewall configuration..."
sudo iptables -L -n | grep ACCEPT
if [ $? -eq 0 ]; then
    echo "✅ Firewall rules configured"
else
    echo "❌ Firewall rules not found"
fi

# Check VPN encryption
echo "2. Checking VPN encryption..."
wg show wg0 | grep "transfer:"
if [ $? -eq 0 ]; then
    echo "✅ WireGuard encryption active"
else
    echo "❌ WireGuard encryption not active"
fi

# Check certificate validity
echo "3. Checking SSL certificates..."
openssl x509 -in /etc/ssl/certs/watershed-mapping.crt -text -noout | grep "Not After"
if [ $? -eq 0 ]; then
    echo "✅ SSL certificate is valid"
else
    echo "❌ SSL certificate issue"
fi

# Test access control
echo "4. Testing access control..."
curl -u wrong_user:wrong_pass http://localhost:3000/api/watersheds
if [ $? -ne 0 ]; then
    echo "✅ Access control working"
else
    echo "❌ Access control bypassed"
fi

echo "VPN security testing completed."
```

## Alert System Testing

### Alert Generation Testing

```python
# test/test_alerts.py
import smtplib
from unittest.mock import patch, MagicMock
from python_processing.quality_control.confidence_scorer import generate_alert

def test_alert_generation():
    """Test alert generation logic"""
    # Test high confidence detection
    high_confidence_detection = {
        'watershed_id': 'test-123',
        'confidence_score': 0.95,
        'area_hectares': 50.0,
        'detection_type': 'deforestation',
        'location': {'lat': 40.0, 'lng': -105.0}
    }
    
    alert = generate_alert(high_confidence_detection)
    
    assert alert is not None
    assert alert['priority'] == 'high'
    assert alert['confidence'] == 0.95
    assert 'deforestation' in alert['message'].lower()

def test_alert_thresholds():
    """Test alert threshold logic"""
    test_cases = [
        {'confidence': 0.95, 'area': 100, 'expected_priority': 'critical'},
        {'confidence': 0.8, 'area': 50, 'expected_priority': 'high'},
        {'confidence': 0.6, 'area': 10, 'expected_priority': 'medium'},
        {'confidence': 0.3, 'area': 1, 'expected_priority': 'low'}
    ]
    
    for case in test_cases:
        detection = {
            'confidence_score': case['confidence'],
            'area_hectares': case['area']
        }
        
        alert = generate_alert(detection)
        assert alert['priority'] == case['expected_priority']

@patch('smtplib.SMTP')
def test_email_alerts(mock_smtp):
    """Test email alert delivery"""
    mock_server = MagicMock()
    mock_smtp.return_value = mock_server
    
    from python_processing.alerts.email_alert import send_email_alert
    
    alert_data = {
        'priority': 'high',
        'message': 'High confidence deforestation detected',
        'watershed_name': 'Test Watershed'
    }
    
    send_email_alert('test@example.com', alert_data)
    
    # Verify email was sent
    mock_server.send_message.assert_called_once()
    args, kwargs = mock_server.send_message.call_args
    assert 'High confidence deforestation detected' in args[0].get_payload()
```

### Alert Delivery Testing

```javascript
// test/alerts.test.js
const request = require('supertest');

describe('Alert System Tests', () => {
  test('POST /api/alerts creates alert', async () => {
    const alertData = {
      watershedId: 'test-123',
      priority: 'high',
      message: 'Test alert message',
      email: 'admin@test.com'
    };

    const response = await request(app)
      .post('/api/alerts')
      .set('Authorization', `Bearer ${authToken}`)
      .send(alertData)
      .expect(201);

    expect(response.body.alert).toHaveProperty('id');
    expect(response.body.alert.priority).toBe('high');
    expect(response.body.alert.status).toBe('pending');
  });

  test('GET /api/alerts retrieves alerts', async () => {
    const response = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('alerts');
    expect(Array.isArray(response.body.alerts)).toBe(true);
  });

  test('POST /api/alerts/{id}/acknowledge updates status', async () => {
    // First create an alert
    const alertData = {
      watershedId: 'test-123',
      priority: 'medium',
      message: 'Test acknowledgment'
    };

    const createResponse = await request(app)
      .post('/api/alerts')
      .set('Authorization', `Bearer ${authToken}`)
      .send(alertData)
      .expect(201);

    const alertId = createResponse.body.alert.id;

    // Then acknowledge it
    const ackResponse = await request(app)
      .post(`/api/alerts/${alertId}/acknowledge`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(ackResponse.body.alert.status).toBe('acknowledged');
  });
});
```

## Test Data Generation

### Sample Data Creation

```python
# test/data_generation.py
import numpy as np
import geojson
import random
from datetime import datetime, timedelta

def generate_test_watershed(name, area_hectares=1000):
    """Generate a test watershed boundary"""
    # Create a simple rectangular boundary
    center_lat = random.uniform(35, 45)  # US region
    center_lng = random.uniform(-120, -70)
    
    # Calculate boundary from area (rough approximation)
    degrees_per_km = 1.0 / 111.0  # Approximate degrees per km
    width_deg = np.sqrt(area_hectares) * degrees_per_km / 10
    height_deg = width_deg * 0.8  # Slightly rectangular
    
    boundary = {
        "type": "Polygon",
        "coordinates": [[
            [center_lng - width_deg/2, center_lat - height_deg/2],
            [center_lng + width_deg/2, center_lat - height_deg/2],
            [center_lng + width_deg/2, center_lat + height_deg/2],
            [center_lng - width_deg/2, center_lat + height_deg/2],
            [center_lng - width_deg/2, center_lat - height_deg/2]
        ]]
    }
    
    return {
        "name": name,
        "boundary": boundary,
        "area_hectares": area_hectares,
        "created_at": datetime.now().isoformat()
    }

def generate_test_satellite_scene():
    """Generate test satellite scene metadata"""
    return {
        "scene_id": f"LC08_L1TP_{random.randint(100000, 999999)}_{random.randint(100, 999)}",
        "acquisition_date": (datetime.now() - timedelta(days=random.randint(1, 365))).isoformat(),
        "cloud_cover": random.uniform(0, 20),
        "processing_level": "L2",
        "bands": {
            "red": "B4",
            "nir": "B5",
            "swir1": "B6",
            "swir2": "B7"
        },
        "footprint": {
            "type": "Polygon",
            "coordinates": [[
                [-105.5, 40.5],
                [-104.5, 40.5],
                [-104.5, 41.5],
                [-105.5, 41.5],
                [-105.5, 40.5]
            ]]
        }
    }

def generate_test_detection(watershed_id):
    """Generate test change detection result"""
    return {
        "watershed_id": watershed_id,
        "detection_date": datetime.now().isoformat(),
        "confidence_score": random.uniform(0.3, 0.98),
        "area_hectares": random.uniform(1, 100),
        "detection_type": random.choice(["deforestation", "fire", "flooding", "urban_expansion"]),
        "algorithm": random.choice(["spectral", "temporal", "combined"]),
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [-105.1, 40.1],
                [-105.0, 40.1],
                [-105.0, 40.2],
                [-105.1, 40.2],
                [-105.1, 40.1]
            ]]
        },
        "spectral_values": {
            "ndvi_before": random.uniform(0.7, 0.9),
            "ndvi_after": random.uniform(0.1, 0.4),
            "nbr_before": random.uniform(0.6, 0.8),
            "nbr_after": random.uniform(-0.2, 0.2)
        }
    }

def create_test_dataset(num_watersheds=10, detections_per_watershed=5):
    """Create complete test dataset"""
    dataset = {
        "watersheds": [],
        "satellite_scenes": [],
        "detections": [],
        "users": [
            {
                "email": "admin@test.com",
                "password_hash": "hashed_password",
                "role": "admin",
                "created_at": datetime.now().isoformat()
            }
        ]
    }
    
    # Generate watersheds
    for i in range(num_watersheds):
        watershed = generate_test_watershed(f"Test Watershed {i+1}")
        dataset["watersheds"].append(watershed)
        
        # Generate detections for each watershed
        for j in range(detections_per_watershed):
            detection = generate_test_detection(f"watershed-{i+1}")
            dataset["detections"].append(detection)
    
    # Generate satellite scenes
    for i in range(num_watersheds * 3):  # Multiple scenes per watershed
        scene = generate_test_satellite_scene()
        dataset["satellite_scenes"].append(scene)
    
    return dataset

if __name__ == "__main__":
    # Generate test dataset
    test_data = create_test_dataset()
    
    # Save to file
    import json
    with open('test_data.json', 'w') as f:
        json.dump(test_data, f, indent=2)
    
    print(f"Generated test dataset:")
    print(f"  Watersheds: {len(test_data['watersheds'])}")
    print(f"  Satellite Scenes: {len(test_data['satellite_scenes'])}")
    print(f"  Detections: {len(test_data['detections'])}")
    print(f"  Users: {len(test_data['users'])}")
```

## Test Automation

### Automated Test Suite

```json
// package.json - test scripts
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "jest --testPathPattern=integration",
    "test:performance": "jest --testPathPattern=performance",
    "test:security": "jest --testPathPattern=security",
    "test:e2e": "cypress run",
    "test:e2e:open": "cypress open",
    "test:load": "artillery run load-test.yml",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e"
  }
}
```

### Continuous Integration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgis/postgis:14-3.2
        env:
          POSTGRES_PASSWORD: test_password
          POSTGRES_USER: test_user
          POSTGRES_DB: watershed_mapping_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: api_server/package-lock.json
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
        cache: 'pip'
        cache-dependency-path: python_processing/requirements.txt
    
    - name: Install API dependencies
      working-directory: ./api_server
      run: npm ci
    
    - name: Install Python dependencies
      working-directory: ./python_processing
      run: pip install -r requirements.txt
    
    - name: Install frontend dependencies
      working-directory: ./frontend
      run: npm ci
    
    - name: Setup database
      working-directory: ./database_setup
      run: ./setup-test-db.sh
    
    - name: Run Python tests
      working-directory: ./python_processing
      run: pytest --cov=. --cov-report=xml
    
    - name: Run API tests
      working-directory: ./api_server
      run: npm test
    
    - name: Run frontend tests
      working-directory: ./frontend
      run: npm test -- --coverage
    
    - name: Run E2E tests
      working-directory: ./
      run: npm run test:e2e
      env:
        CI: true
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
```

### Performance Monitoring

```python
# test/monitoring.py
import time
import psutil
import logging
from contextlib import contextmanager

@contextmanager
def performance_monitor(operation_name):
    """Context manager for performance monitoring"""
    start_time = time.time()
    start_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
    start_cpu = psutil.cpu_percent()
    
    try:
        yield
    finally:
        end_time = time.time()
        end_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
        end_cpu = psutil.cpu_percent()
        
        duration = end_time - start_time
        memory_used = end_memory - start_memory
        cpu_used = end_cpu - start_cpu
        
        logging.info(f"{operation_name} - Duration: {duration:.2f}s, "
                    f"Memory: {memory_used:.2f}MB, CPU: {cpu_used:.2f}%")
        
        # Performance thresholds
        if duration > 60:
            logging.warning(f"{operation_name} took longer than expected: {duration:.2f}s")
        if memory_used > 1024:
            logging.warning(f"{operation_name} used significant memory: {memory_used:.2f}MB")

# Usage example
with performance_monitor("Satellite Processing"):
    process_satellite_data()
```

This comprehensive testing guide provides complete coverage for all system components and ensures the Watershed Disturbance Mapping System meets production quality standards.
