# Watershed Disturbance Mapping System API Specifications

This directory contains comprehensive API specifications for the Watershed Disturbance Mapping System.

## Files Structure

- `core_api.py` - Main API implementation with Django REST Framework
- `endpoints/` - Individual endpoint specifications
  - `watershed.py` - Watershed management endpoints
  - `satellite_data.py` - Satellite data processing endpoints  
  - `change_detection.py` - Change detection results endpoints
  - `authentication.py` - User authentication endpoints
  - `alerts.py` - Alert management endpoints
  - `export.py` - Data export endpoints
- `schemas/` - Data schemas and models
  - `watershed_schema.py` - Watershed data models
  - `detection_schema.py` - Detection data models
  - `user_schema.py` - User and authentication models
- `examples/` - API usage examples
  - `python_client.py` - Python client example
  - `javascript_client.js` - JavaScript client example
- `tests/` - API testing examples
  - `test_endpoints.py` - Endpoint testing examples
  - `test_integration.py` - Integration testing examples

## API Version: v1.0.0

**Base URL**: `https://api.watershed-ds.com/v1/`

## Authentication

All API endpoints require authentication via JWT tokens. See `endpoints/authentication.py` for details.

## Rate Limiting

Rate limits are enforced based on user role:
- **Free tier**: 100 requests/hour
- **Analyst tier**: 1,000 requests/hour  
- **Admin tier**: 10,000 requests/hour

Rate limit headers are included in all responses.

## Content Types

- **Request/Response**: `application/json`
- **File uploads**: `multipart/form-data`
- **GeoJSON**: `application/geo+json`
- **Export formats**: `text/csv`, `application/json`

## Error Handling

All API errors follow RFC 7807 Problem Details format:

```json
{
  "type": "https://api.watershed-ds.com/errors/not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "Watershed with ID 'ws_001' not found",
  "instance": "/api/v1/watersheds/ws_001"
}
```

## Pagination

List endpoints support pagination with the following parameters:
- `page` (integer): Page number (default: 1)
- `page_size` (integer): Items per page (default: 20, max: 100)

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_items": 100,
    "items_per_page": 20,
    "has_next": true,
    "has_previous": false
  }
}
```

## API Status

**Development Status**: Currently in development
**Stability**: Beta
**Breaking Changes**: Possible until v1.0.0 release

## Getting Started

1. Register for API access
2. Obtain authentication credentials
3. Review endpoint specifications in `/endpoints/`
4. Use example code in `/examples/` to get started
5. Test integration with examples in `/tests/`

For detailed API documentation, refer to the individual endpoint specification files in the `/endpoints/` directory.