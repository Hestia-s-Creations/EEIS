# Watershed Disturbance Mapping System — RESTful API Architecture and Specification Blueprint

## Executive Summary and Narrative Context

The Watershed Disturbance Mapping System enables conservation organizations, environmental analysts, watershed managers, and software developers to monitor, analyze, and act on environmental changes across watersheds. Its core purpose is to detect and map disturbances such as logging, clearing, fire, flooding, and infrastructure development using multi-temporal satellite imagery, and to make those detections available through a robust, secure, and scalable application programming interface (API).

This blueprint defines the RESTful API architecture and endpoint specifications that support the full lifecycle from data ingestion and processing to results retrieval, alerting, and export. It also codifies operational concerns—authentication, authorization, rate limiting, idempotency, pagination, filtering, and webhook security—together with error handling, observability, and versioning strategy.

API access follows OAuth 2.0 bearer tokens for authentication, with role-based access control (RBAC) distinguishing roles such as admin, analyst, and viewer. Data resources—watersheds, processing jobs, detections, alerts, exports, and webhooks—are modeled explicitly with standard REST semantics, while geospatial endpoints return GeoJSON for spatial features and provide bbox filtering and temporal predicates. The API intentionally balances clarity for client developers with the constraints of cloud scale, multi-tenant safety, and operational resilience.

Guiding principles shape this design:
- Clarity and consistency in endpoint naming, resource representation, and error reporting.
- Least privilege access through scoped OAuth 2.0 tokens and RBAC enforcement across endpoints.
- Predictability via idempotency for long-running operations and standardized pagination and filtering.
- Scalability through pagination, filtering, asynchronous job processing, and rate limiting.
- Traceability using correlation IDs and structured logs, supporting problem diagnosis and audit needs.

The narrative arc moves from foundations to the API contract: we start with the data and processing context that informs the resource model; we then define the architecture and security posture; we detail the endpoints, formats, and job orchestration; and finally specify operational policies, validation expectations, and a practical implementation roadmap. The result is a specification that client developers and API engineers can implement against, and that operators and product managers can use to plan rollout, monitoring, and lifecycle management.

### Assumptions and Constraints

A few baseline assumptions and constraints are baked into this blueprint:

- Cloud processing runs on Google Earth Engine (GEE) for algorithm execution and scale. The API abstracts job orchestration and persistence while GEE handles heavy compute.
- The reference backend stack uses Python/Django with a PostgreSQL/PostGIS database for geospatial indexing and time-series storage. Celery manages asynchronous processing, and Redis provides caching.
- The frontend is built with React and Leaflet, which informs how GeoJSON features and time series are represented.
- Alerts are delivered over email and SMS and via webhooks. Delivery semantics include retries and signature verification for webhooks.
- Rate limiting is tiered by role. Anonymous access is restricted, and clients are expected to implement exponential backoff and respect Retry-After headers.

These assumptions are reflected in the resource model and endpoint design. Where details remain to be finalized—such as exact rate limits, OAuth provider configuration, and delivery SLAs—this blueprint flags them as information gaps to be resolved prior to production release.

## Data and Processing Foundations

The API is grounded in remote sensing workflows that ingest, harmonize, and analyze satellite imagery at scale. These workflows are the source of truth for detection results, confidence scoring, and time-series baselines.

### Supported Satellites and Products

The system leverages well-established optical satellite constellations—Landsat and Sentinel-2—and can optionally incorporate Synthetic Aperture Radar (SAR) from Sentinel-1 to address persistent cloud cover.

- Landsat 8/9: 30-meter spatial resolution; 16-day revisit; long historical archive; suitable for baselines and trend analysis.
- Sentinel-2: 10–20 meter resolution; 5-day revisit with combined constellation; suited for higher-frequency monitoring and gap filling.
- Sentinel-1 SAR (optional): C-band; all-weather monitoring; 12-day revisit; complements optical in cloudy regions.

Inputs include Landsat Collections and Sentinel-2 Level-2A (atmospherically corrected surface reflectance), with cloud masking (s2cloudless for Sentinel-2; CFMask for Landsat) and quality filters applied.

### Algorithms and Indices

Two complementary algorithm families drive detection:

- LandTrendr: Temporal segmentation of pixel trajectories to identify disturbance and recovery patterns; strong for historical analysis and disturbance type classification.
- Multi-Sensor Fusion (FNRT): Rapid detection by combining Landsat and Sentinel-2 (and optionally Sentinel-1), normalizing indices and applying statistical outlier detection tuned for early warnings.

Core spectral indices computed per acquisition:
- NDVI (Normalized Difference Vegetation Index): vegetation health and density.
- NBR (Normalized Burn Ratio): burn scar and fire-related change detection.
- TCG (Tasseled Cap Greenness): green vegetation signal emphasizing forest disturbance.

Confidence scoring integrates model probability, number of confirming observations, magnitude of spectral change, and spatial pattern consistency, with thresholds separating automated alerts, manual review, and rejection.

### Quality Control and Validation

Quality controls stabilize detection quality under challenging conditions such as clouds and turbid waters. The system applies cloud probability thresholds, requires a minimum number of valid observations per window, and enforces spatial and temporal persistence rules. Validation combines automated cross-algorithm checks with user feedback loops and scheduled field surveys. This ensures the API’s outputs remain calibrated to real-world conditions and improves over time through continuous learning.

To illustrate how inputs and indices inform the API’s output structures, the following table summarizes the detection inputs and outputs that the API exposes and that client applications can rely on.

Table 1: Detection Inputs and Outputs Overview

| Component | Source | Resolution | Temporal Cadence | Indices/Features | Outputs Exposed via API |
|---|---|---|---|---|---|
| Landsat 8/9 | Landsat Collections | 30 m | 16-day revisit | NDVI, NBR, TCG | Detections (GeoJSON), time series (JSON), baselines |
| Sentinel-2 L2A | Sentinel-2A/B | 10–20 m | 5-day revisit | NDVI, NBR, TCG | Detections (GeoJSON), time series (JSON), baselines |
| Sentinel-1 SAR (optional) | Sentinel-1 C-band | ~10 m (ground range) | 12-day revisit | Coherence/intensity features | Supplemental detections, context (metadata) |
| Algorithm Suite | LandTrendr, FNRT (multi-sensor fusion) | Pixel-wise | Monthly with 5-day cadence | Model features, change magnitude, persistence | Detection confidence, disturbance type, status, area |
| Confidence Scoring | Composite weights | N/A | Per detection | Model probability, confirming observations, magnitude, spatial coherence | Alert thresholds, review queue, filterable fields |
| Quality Controls | Cloud masking, spatial filters, persistence | N/A | Per window and observation | Cloud probability, minimum valid observations, patch size | API filters: confidence, area, bbox, time range |

The significance of this overview is twofold: it informs the shape of API responses—particularly for detections and time series—and it clarifies how filtering parameters (e.g., confidence, time range, bbox, disturbance_type) map to upstream processing logic and quality controls.

## API Architecture Overview

The API follows a consistent, resource-oriented design that mirrors how the underlying system operates. It leverages asynchronous job orchestration for satellite data processing and change detection, while providing direct retrieval for curated datasets and views.

- Base URL versioning: The initial version is v1, exposed as a URL prefix (e.g., /api/v1).
- Content types: JSON for general resources; GeoJSON for spatial features; CSV for exports; optionally Parquet via signed URLs.
- Idempotency: Clients must provide an idempotency key for POST requests that create long-running jobs; servers store and reuse prior results for identical keys.
- Pagination and filtering: List endpoints support pagination (limit/offset or cursor) and filtering using query parameters such as bbox, time ranges, confidence, area, and disturbance_type.
- Asynchronous job processing: Endpoints that trigger processing (e.g., ingesting new imagery, running detection algorithms) create jobs with status endpoints for polling and webhooks for completion callbacks.

To situate the reader, the following table presents an endpoint index at a high level. The full specification appears later.

Table 2: Endpoint Index (High-Level)

| Method | Path | Purpose | Auth Required |
|---|---|---|---|
| POST | /api/v1/auth/token | Obtain OAuth 2.0 access token | Yes (client credentials) |
| POST | /api/v1/auth/token/refresh | Refresh access token | Yes (refresh token) |
| POST | /api/v1/auth/logout | Revoke token/session | Yes |
| GET | /api/v1/users/me | Current user profile and roles | Yes |
| GET | /api/v1/watersheds | List watersheds | Yes (viewer+) |
| POST | /api/v1/watersheds | Create watershed | Yes (admin) |
| GET | /api/v1/watersheds/{id} | Retrieve watershed details | Yes (viewer+) |
| PATCH | /api/v1/watersheds/{id} | Update watershed metadata | Yes (admin) |
| DELETE | /api/v1/watersheds/{id} | Delete watershed (logical) | Yes (admin) |
| GET | /api/v1/watersheds/{id}/detections | List detections for watershed | Yes (viewer+) |
| POST | /api/v1/processing-jobs | Submit processing job (idempotent) | Yes (analyst+) |
| GET | /api/v1/processing-jobs/{id} | Retrieve job status | Yes (submitter+) |
| GET | /api/v1/detections | List detections (multi-filter) | Yes (viewer+) |
| GET | /api/v1/detections/{id} | Retrieve detection details | Yes (viewer+) |
| GET | /api/v1/detections/{id}/time-series | Retrieve spectral time series | Yes (viewer+) |
| GET | /api/v1/detections/{id}/thumbnail | Map thumbnail of detection | Yes (viewer+) |
| GET | /api/v1/alerts | List alerts | Yes (viewer+) |
| POST | /api/v1/alerts | Create or update alert rule | Yes (analyst+) |
| GET | /api/v1/alerts/{id} | Retrieve alert details | Yes (viewer+) |
| PATCH | /api/v1/alerts/{id} | Update alert rule | Yes (analyst+) |
| DELETE | /api/v1/alerts/{id} | Delete alert rule | Yes (admin) |
| POST | /api/v1/alerts/{id}/test | Send test notification | Yes (analyst+) |
| POST | /api/v1/exports | Create export job (CSV/GeoJSON/Parquet) | Yes (viewer+) |
| GET | /api/v1/exports/{id} | Retrieve export job status | Yes (submitter+) |
| GET | /api/v1/exports/{id}/download | Download exported file (signed URL) | Yes (submitter+) |
| POST | /api/v1/webhooks/register | Register or update webhook | Yes (analyst+) |
| GET | /api/v1/webhooks | List registered webhooks | Yes (owner/admin) |
| GET | /api/v1/webhooks/{id} | Retrieve webhook details | Yes (owner/admin) |
| DELETE | /api/v1/webhooks/{id} | Delete webhook registration | Yes (owner/admin) |

The table underscores the consistent pattern: authentication precedes all operations; roles gate sensitive actions; and asynchronous patterns support heavy compute.

### Resource Model

Core resources are modeled to match user workflows and system components:

- Watershed: A spatial unit with boundary geometry, metadata, and associated detections.
- ProcessingJobs: Asynchronous tasks that ingest data, compute indices, run algorithms, and produce detections.
- Detections: The atomic results of change detection, including geometry, date, confidence, type, area, and spectral change summaries.
- Alerts: Rules and instances governing and describing notifications, including channels and recipients.
- Exports: Asynchronous jobs that produce downloadable files; supports GeoJSON, CSV, and Parquet.
- Webhooks: Registration of callback URLs for event notifications (e.g., job completion, alert triggered).
- TimeSeries: Historical spectral index values for pixels or regions used for baselines and trend analysis.
- Users/Roles: Accounts, profiles, and RBAC role assignments.

### Versioning and Deprecation Policy

The API uses URL-based versioning (e.g., /api/v1). Breaking changes require a new version (v2), with dual support during a deprecation window. Advance notice, compatibility guidance, and a public deprecation timeline are provided before retiring old versions. This approach prevents disruption for existing clients and ensures predictable migration paths.

## Security and Authentication

Security is a first-class design concern. All communications use HTTPS/TLS 1.3. Authentication is handled via OAuth 2.0 bearer tokens, and authorization is enforced through role-based access control (RBAC).

Token acquisition supports client credentials for service-to-service integrations, with refresh tokens for long-lived sessions. Scope-based authorization allows least-privilege access for specific resources and actions. For webhooks and exports, the system uses signed URLs to delegate secure downloads without exposing broad credentials. All inbound webhooks must be verified with HMAC signatures and replay protection using timestamps and nonces.

The following table summarizes RBAC permissions across roles. The intent is to make clear which endpoints are accessible and what actions each role may perform.

Table 3: RBAC Permissions Matrix

| Resource | Action | Admin | Analyst | Viewer |
|---|---|---|---|---|
| Watersheds | list, read | Yes | Yes | Yes |
| Watersheds | create, update, delete | Yes | No | No |
| Detections | list, read | Yes | Yes | Yes |
| Detections | bulk export | Yes | Yes | Yes |
| Processing Jobs | create, read own | Yes | Yes | Read (limited) |
| Alerts | list, read | Yes | Yes | Yes |
| Alerts | create, update, delete | Yes | Yes (own) | No |
| Webhooks | register, list, delete | Yes | Yes (own) | Read (own) |
| Exports | create, read own | Yes | Yes | Yes |
| Time Series | read | Yes | Yes | Yes |
| Users/Roles | manage roles | Yes | No | No |

#### Data Protection and Privacy

- Encryption: TLS 1.3 for data in transit; encryption at rest for databases and object storage.
- Secrets Management: OAuth client secrets and signing keys stored securely with strict access controls and rotation policies.
- Retention: The system maintains detection history and time-series baselines with status flags (new, confirmed, false_positive, resolved). Precise retention durations and audit log retention policies are to be finalized; clients should not rely on implied data lifecycle behavior beyond what is documented per resource.

## API Specification by Domain

This section details endpoints, request/response schemas, filters, and operational behaviors by domain. Error handling uses standard HTTP status codes with a machine-readable problem+json structure, including a correlation_id for traceability. Rate limiting follows tiered policies per role; clients must back off on 429 responses and respect Retry-After.

### Watershed Management

Watersheds are the organizing unit for spatial analyses. The API supports CRUD operations and geospatial queries. Geometries are stored server-side, and clients can provide GeoJSON or well-known text (WKT) on creation and updates. Spatial indexing supports efficient bbox queries and time-window filtering for detections within each watershed.

Table 4: Watershed Endpoints

| Method | Path | Description | Auth Role |
|---|---|---|---|
| GET | /api/v1/watersheds | List watersheds with pagination and filters | viewer+ |
| POST | /api/v1/watersheds | Create a watershed | admin |
| GET | /api/v1/watersheds/{id} | Retrieve watershed details | viewer+ |
| PATCH | /api/v1/watersheds/{id} | Update watershed metadata | admin |
| DELETE | /api/v1/watersheds/{id} | Delete watershed (logical) | admin |
| GET | /api/v1/watersheds/{id}/detections | List detections within watershed | viewer+ |

Example: Create Watershed (request, GeoJSON geometry)

```
POST /api/v1/watersheds
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "name": "Upper River Basin",
  "description": "Monitoring riparian disturbances",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [-122.7, 45.6],
        [-122.5, 45.6],
        [-122.5, 45.7],
        [-122.7, 45.7],
        [-122.7, 45.6]
      ]
    ]
  },
  "tags": ["riparian", "priority"]
}
```

Response: Watershed resource

```
{
  "id": "ws_123",
  "name": "Upper River Basin",
  "description": "Monitoring riparian disturbances",
  "geometry": {
    "type": "Polygon",
    "coordinates": [ /* ... */ ]
  },
  "tags": ["riparian", "priority"],
  "created_at": "2025-10-01T12:00:00Z",
  "updated_at": "2025-10-01T12:00:00Z"
}
```

Validation rules:
- geometry must be a valid GeoJSON polygon or multipolygon.
- name is required; tags are optional; description is功效 optional string.

### Satellite Data Processing

Processing jobs encapsulate ingestion, index computation, change detection, and persistence. All submissions must include an idempotency key, enabling safe retries without duplicate work. Jobs include status, progress, and logs. The API exposes artifact metadata (e.g., number of scenes processed, detections created) upon completion.

Table 5: Processing Job Fields

| Field | Type | Description |
|---|---|---|
| id | string | Unique job identifier |
| type | string | Job type (e.g., ingest, detect) |
| watershed_id | string | Associated watershed |
| parameters | object | Sensor selection, thresholds, algorithm options |
| status | string | queued, running, succeeded, failed |
| status_reason | string | Error message or note |
| progress | number | 0–100 |
| created_at | timestamp | Submission time |
| updated_at | timestamp | Last update |
| submitted_by | string | User ID who submitted |
| artifacts | object | Summary metrics post-completion |

Endpoints:
- POST /api/v1/processing-jobs: Submit job (idempotent).
- GET /api/v1/processing-jobs/{id}: Retrieve job status.
- GET /api/v1/processing-jobs: List jobs with filters (status, watershed_id, created_at).

Example: Submit Processing Job

```
POST /api/v1/processing-jobs
Content-Type: application/json
Authorization: Bearer {access_token}
Idempotency-Key: {uuid}

{
  "type": "detect",
  "watershed_id": "ws_123",
  "parameters": {
    "sensors": ["landsat8", "landsat9", "sentinel2"],
    "use_sentinel1": false,
    "indices": ["NDVI", "NBR", "TCG"],
    "cloud_threshold_pct": 30,
    "min_valid_observations": 3,
    "baseline_years": 3,
    "change_threshold_sd": 2.5,
    "algorithm": "FNRT",
    "job_window_days": 90
  },
  "note": "Monthly monitoring run"
}
```

Response: Job accepted

```
{
  "id": "job_456",
  "type": "detect",
  "watershed_id": "ws_123",
  "parameters": { /* echo */ },
  "status": "queued",
  "status_reason": null,
  "progress": 0,
  "created_at": "2025-10-01T12:05:00Z",
  "updated_at": "2025-10-01T12:05:00Z",
  "submitted_by": "user_789"
}
```

Polling status:

```
GET /api/v1/processing-jobs/job_456
Authorization: Bearer {access_token}

{
  "id": "job_456",
  "status": "running",
  "progress": 42,
  "updated_at": "2025-10-01T12:10:00Z",
  "status_reason": null
}
```

On completion, status becomes succeeded with artifacts summary; failed includes status_reason. Clients receive webhook callbacks when registered.

### Change Detection Results

Detections are exposed as GeoJSON FeatureCollections with server-side filtering. The API supports geospatial bbox, temporal filtering, and attribute filters such as confidence and disturbance type.

Table 6: Detection Schema Overview

| Field | Type | Description |
|---|---|---|
| id | string | Unique detection ID |
| watershed_id | string | Associated watershed |
| geometry | GeoJSON Polygon/MultiPolygon | Spatial extent |
| detection_date | date | First detection date |
| last_update | timestamp | Latest status change |
| confidence_score | number (0–1) | Composite confidence |
| disturbance_type | string | Enum: fire, harvest, clearing, flood, infrastructure |
| area_hectares | number | Area in hectares |
| status | string | new, confirmed, false_positive, resolved |
| spectral_magnitude | object | NDVI/NBR/TCG delta summary |
| confirming_observations | integer | Number of confirmations |
| baseline_window | object | Baseline window used (years) |
| related_detections | array | Linked detection IDs |

Endpoints:
- GET /api/v1/detections: List with filters.
- GET /api/v1/detections/{id}: Retrieve detection details.
- GET /api/v1/detections/{id}/time-series: Retrieve NDVI/NBR/TCG time series.
- GET /api/v1/detections/{id}/thumbnail: Map thumbnail image.

Example: Retrieve Detection

```
GET /api/v1/detections/det_987
Authorization: Bearer {access_token}

{
  "id": "det_987",
  "watershed_id": "ws_123",
  "geometry": {
    "type": "Polygon",
    "coordinates": [ /* ... */ ]
  },
  "detection_date": "2025-09-28",
  "last_update": "2025-10-01T11:30:00Z",
  "confidence_score": 0.87,
  "disturbance_type": "fire",
  "area_hectares": 1.4,
  "status": "new",
  "spectral_magnitude": {
    "NDVI": -0.42,
    "NBR": -0.55,
    "TCG": -0.31
  },
  "confirming_observations": 2,
  "baseline_window": { "years": 3 },
  "related_detections": ["det_985", "det_986"]
}
```

Example: Time Series

```
GET /api/v1/detections/det_987/time-series
Authorization: Bearer {access_token}

{
  "pixel_or_region": "region_centroid",
  "indices": ["NDVI", "NBR", "TCG"],
  "series": [
    { "date": "2025-06-01", "NDVI": 0.61, "NBR": 0.31, "TCG": 0.22 },
    { "date": "2025-07-01", "NDVI": 0.58, "NBR": 0.28, "TCG": 0.20 },
    { "date": "2025-08-01", "NDVI": 0.35, "NBR": 0.05, "TCG": 0.12 }
  ],
  "baseline_reference": "rolling_3yr_median"
}
```

Filtering:
- bbox=minLon,minLat,maxLon,maxLat for spatial constraints.
- time_range=start_date,end_date or start_date..end_date for temporal constraints.
- confidence=min,max for quality thresholds.
- area_hectares=gte,lte for patch size filtering.
- disturbance_type=fire,harvest,clearing,flood,infrastructure for event type filtering.

### User Authentication and Accounts

Authentication follows OAuth 2.0 with client credentials and token refresh. Session management enables logout and revocation. RBAC is surfaced via the user profile endpoint. Tokens carry scopes (e.g., detections:read, jobs:write, alerts:manage), enabling least-privilege access.

Table 7: Auth Endpoints

| Method | Path | Description | Scopes |
|---|---|---|---|
| POST | /api/v1/auth/token | Obtain access token | none |
| POST | /api/v1/auth/token/refresh | Refresh access token | none |
| POST | /api/v1/auth/logout | Revoke refresh token | none |
| GET | /api/v1/users/me | Current user profile and roles | profile:read |

Example: Token Request (client credentials)

```
POST /api/v1/auth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id={client_id}&client_secret={client_secret}&scope=detections:read+watersheds:read
```

Response:

```
{
  "access_token": "{access_token}",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "{refresh_token}",
  "scope": "detections:read watersheds:read"
}
```

User profile:

```
GET /api/v1/users/me
Authorization: Bearer {access_token}

{
  "id": "user_789",
  "email": "analyst@example.org",
  "roles": ["analyst"],
  "scopes": ["detections:read", "watersheds:read", "jobs:write", "alerts:manage"],
  "created_at": "2024-01-15T00:00:00Z"
}
```

### Alert Management

Alerts are generated automatically by thresholding on confidence, area, and spatial context (e.g., proximity to streams or riparian zones). Users can create and manage alert rules, configure channels (email, SMS, webhook), and track notification outcomes. Delivery uses email and SMS providers, with webhooks for integration. The API provides history and audit trail per alert rule.

Table 8: Alert Rule Schema and Channels

| Field | Type | Description |
|---|---|---|
| id | string | Alert rule ID |
| name | string | Human-readable name |
| criteria | object | confidence_min, area_min_hectares, proximity_rules |
| channels | object | email (addresses), sms (numbers), webhook_url |
| geography | object | watersheds, bbox, or named areas |
| mute | boolean | Temporarily suppress notifications |
| created_by | string | Owner user ID |
| created_at | timestamp | Rule creation |
| updated_at | timestamp | Last update |

Endpoints:
- GET /api/v1/alerts: List alert rules and recent notifications.
- POST /api/v1/alerts: Create alert rule.
- GET /api/v1/alerts/{id}: Retrieve alert details and history.
- PATCH /api/v1/alerts/{id}: Update rule.
- DELETE /api/v1/alerts/{id}: Delete rule.
- POST /api/v1/alerts/{id}/test: Send test notification.

Example: Create Alert Rule

```
POST /api/v1/alerts
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "name": "High-confidence fire near streams",
  "criteria": {
    "confidence_min": 0.8,
    "area_min_hectares": 0.5,
    "proximity_rules": [
      { "feature": "streams", "max_distance_m": 100 },
      { "feature": "riparian_zones", "within": true }
    ]
  },
  "channels": {
    "email": ["alerts@example.org"],
    "sms": ["+15551234567"],
    "webhook_url": "https://partner.example.org/webhooks/alerts"
  },
  "geography": {
    "watersheds": ["ws_123"]
  },
  "mute": false
}
```

Response:

```
{
  "id": "alert_321",
  "name": "High-confidence fire near streams",
  "criteria": { /* echo */ },
  "channels": { /* echo */ },
  "geography": { "watersheds": ["ws_123"] },
  "mute": false,
  "created_by": "user_789",
  "created_at": "2025-10-01T12:15:00Z",
  "updated_at": "2025-10-01T12:15:00Z"
}
```

Notification audit:
- GET /api/v1/alerts/{id} includes a history of delivery attempts, statuses, and any errors.

### Data Export

Export operations run asynchronously and produce downloadable files in GeoJSON, CSV, or Parquet. Exports support filters that mirror detection queries (bbox, time range, confidence, area, disturbance type). Clients receive a signed URL upon completion. Metadata includes record counts and checksum.

Table 9: Export Endpoints and Formats

| Method | Path | Description |
|---|---|---|
| POST | /api/v1/exports | Create export job with filters and format |
| GET | /api/v1/exports/{id} | Retrieve export status and metadata |
| GET | /api/v1/exports/{id}/download | Download via signed URL |

Example: Request Export

```
POST /api/v1/exports
Content-Type: application/json
Authorization: Bearer {access_token}
Idempotency-Key: {uuid}

{
  "format": "geojson",
  "filters": {
    "bbox": [-122.7, 45.6, -122.5, 45.7],
    "time_range": "2025-06-01..2025-10-01",
    "confidence": [0.8, 1.0],
    "area_hectares": [0.5, null],
    "disturbance_type": ["fire", "harvest"]
  },
  "include_time_series": false
}
```

Response:

```
{
  "id": "export_654",
  "status": "queued",
  "created_at": "2025-10-01T12:20:00Z",
  "updated_at": "2025-10-01T12:20:00Z",
  "filters": { /* echo */ },
  "format": "geojson",
  "download_url": null
}
```

Completion:

```
{
  "id": "export_654",
  "status": "succeeded",
  "updated_at": "2025-10-01T12:22:00Z",
  "download_url": "https://cdn.example.org/exports/export_654.geojson?signature=...",
  "metadata": {
    "record_count": 1024,
    "checksum_sha256": "a1b2c3..."
  }
}
```

### Webhooks

Webhooks deliver event notifications such as job completion and alert triggers. Registration requires a URL and a secret. The system validates HMAC signatures and includes timestamps and event IDs to prevent replay. Retries follow exponential backoff with jitter for transient failures; clients should respond quickly to avoid timeouts and ensure reliable delivery.

Table 10: Webhook Event Payloads

| Event | Description | Core Fields |
|---|---|---|
| job.completed | Processing job succeeded | event_id, timestamp, job_id, watershed_id, artifacts_summary |
| job.failed | Processing job failed | event_id, timestamp, job_id, status_reason |
| alert.triggered | New alert generated | event_id, timestamp, alert_id, rule_id, detection_id, channels |
| export.completed | Export finished | event_id, timestamp, export_id, download_url, metadata |

Example: Webhook Delivery (alert.triggered)

```
POST /partner/webhook_url
Content-Type: application/json
X-Signature: HMAC-SHA256={base64_signature}
X-Event-ID: evt_12345
X-Timestamp: 1696156800

{
  "event": "alert.triggered",
  "event_id": "evt_12345",
  "timestamp": "2025-10-01T12:25:00Z",
  "alert_id": "alert_321",
  "rule_id": "alert_321",
  "detection_id": "det_987",
  "data": {
    "confidence_score": 0.87,
    "disturbance_type": "fire",
    "area_hectares": 1.4,
    "watershed_id": "ws_123"
  }
}
```

Client verification:
- Compute HMAC over raw body using shared secret; compare to X-Signature.
- Reject messages with timestamps outside a short acceptance window to prevent replay.

## Common Request/Response Formats, Filtering, and Error Handling

The API standardizes envelopes and behaviors to promote predictability across endpoints.

- Request headers: Authorization: Bearer {access_token}; Idempotency-Key: {uuid} for POST jobs/exports; Content-Type: application/json or application/geo+json for GeoJSON.
- Response envelope: All resources include id, created_at, updated_at, and relevant domain fields. Time fields are ISO 8601 in UTC (e.g., 2025-10-01T12:00:00Z).
- Pagination: List endpoints support either limit/offset or cursor tokens. Default page size is 50, with a maximum of 500.
- Filtering: Query parameters follow a consistent pattern; bbox uses comma-separated values; time ranges use start..end; numeric ranges use gte,lte semantics via separate keys.
- Error format: problem+json includes type, title, detail, status, instance, correlation_id; validation errors include field-specific details.

Table 11: Standard Error Codes

| HTTP Status | Meaning | Typical Use |
|---|---|---|
| 400 | Bad Request | Malformed JSON, invalid parameters |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient role/scope |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Idempotency key conflict or state violation |
| 413 | Payload Too Large | Export specification exceeds limits |
| 415 | Unsupported Media Type | Wrong Content-Type |
| 422 | Unprocessable Entity | Validation failure |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unhandled server faults |

Example: Validation error

```
{
  "type": "https://api.example.org/problems/validation",
  "title": "Validation Failed",
  "status": 422,
  "detail": "geometry must be a valid GeoJSON polygon",
  "instance": "/api/v1/watersheds",
  "correlation_id": "b36ad3d0-3f87-4f6a-9d66-7b38f1a9c7d1",
  "errors": [
    { "field": "geometry", "message": "Invalid coordinates" }
  ]
}
```

### Rate Limiting and Backoff

Rate limits are tiered by role and endpoint class. Anonymous access is disallowed for most endpoints; bearer tokens are required. Exact numerical limits are an information gap to be finalized. Clients must implement exponential backoff on 429 responses and respect Retry-After headers.

Table 12: Rate Limiting Tiers (Indicative)

| Role | Endpoint Class | Indicative Limit |
|---|---|---|
| admin | Detection reads | 120 requests/min |
| analyst | Job submissions | 60 requests/min |
| viewer | Exports | 30 requests/min |
| service | Webhooks delivery | Depends on provider SLAs |

These tiers are placeholders to guide planning. The production configuration will define exact numbers and burst behaviors. Observability metrics will report per-tenant and per-endpoint usage to inform tuning.

## Operational Observability, Scalability, and Resilience

Operational excellence depends on robust monitoring, structured logging, and scalable infrastructure patterns:

- Monitoring and Logging: CloudWatch or equivalent captures logs and metrics. Each request includes a correlation_id for end-to-end tracing across services, job queues, and webhooks. Audit logs record security-relevant events and sensitive operations.
- Scalability: The web tier scales horizontally behind a load balancer. Database read replicas handle reporting queries, while caching with Redis accelerates responses for frequently accessed data. A CDN serves static assets for the frontend.
- Resilience: Retries with exponential backoff cover transient failures in job execution and webhook delivery. Health checks and readiness probes enable proactive routing away from unhealthy instances. Queue-based processing provides buffering under load spikes.

The net effect is a platform that can grow with usage and withstand partial failures without compromising data integrity or user experience.

## Validation, Quality Thresholds, and Manual Review Queue

Quality controls are embedded in the API’s behavior and shape the client experience:

- Confidence thresholds: Automated alerts are generated for detections above 0.8 confidence; detections between 0.6 and 0.8 are routed to manual review; below 0.6 are filtered out.
- Spatial filtering: Minimum patch size of 0.04 hectares removes spurious single-pixel detections.
- Temporal persistence: Detections must appear across two or more observations; this stabilizes alerts and reduces false positives.
- Manual review queue: API endpoints expose reviewable detections and allow status updates to confirmed, false_positive, or resolved.

Table 13: Confidence Thresholds and Actions

| Threshold | Action | API Behavior |
|---|---|---|
| > 0.8 | Automated alert | Alert rule triggers; notification channels engaged |
| 0.6–0.8 | Manual review | Detection exposed in review endpoints; status = new |
| < 0.6 | Rejection | Detection excluded from alerts and exports by default |

These thresholds align with the system’s quality control framework and allow operators to calibrate alert volumes and review capacity based on regional conditions and seasonal variability.

## Implementation Roadmap and Delivery Plan

The delivery plan sets a pragmatic path from specification to implementation, testing, and documentation:

1. Endpoints Development: Implement authentication, watershed management, processing jobs, detections, alerts, exports, and webhooks with standardized envelopes, validation, and error handling.
2. Asynchronous Orchestration: Wire job submission, status polling, completion callbacks, and webhook deliveries with idempotency keys and HMAC signatures.
3. Testing: Conduct unit, integration, and performance testing; validate geospatial filtering, rate limiting, and RBAC enforcement; execute security audits to verify TLS, OAuth, and secret handling.
4. Documentation: Provide API reference and client examples; publish versioning and deprecation policy; document rate limits and webhook signing; publish operational SLAs.
5. Monitoring Setup: Configure CloudWatch metrics and alerts; implement audit logging for sensitive operations; establish dashboards for latency, error rates, and queue depths.

To align expectations, the following table maps API capabilities to modules and schedules.

Table 14: Implementation Milestones

| Milestone | Scope | Owner | Timeline |
|---|---|---|---|
| Core Auth & RBAC | OAuth 2.0, token refresh, users/me | Backend | Month 1 |
| Watersheds & Detections | CRUD, GeoJSON, filters | Backend + GIS | Month 2 |
| Processing Jobs | Submission, status, logs, webhooks | Backend + Processing | Month 2–3 |
| Alerts | Rules, channels, audit history | Backend + Alerts | Month 3 |
| Exports | Async jobs, signed URLs, metadata | Backend + Storage | Month 3 |
| Observability | Correlation IDs, logs, metrics | DevOps | Month 3 |
| Security Review | TLS, secrets, OAuth scopes, HMAC | Security | Month 4 |
| Documentation | API reference, client guides | Tech Writing | Month 4 |

### Information Gaps

A few items remain unspecified and must be resolved before general availability:
- Exact OAuth 2.0 provider configuration (authorization code vs. client credentials flow, token lifetimes, and scope naming).
- Definitive rate limits per role and endpoint tiering.
- Geospatial API specifics (projection handling beyond EPSG:4326 for GeoJSON, detailed spatial query language).
- Data export format finalization (maximum dataset size, multi-part download strategy, signed URL TTL).
- Delivery SLAs and retry policies for email/SMS/webhooks, including delivery tracking fields.
- Pagination defaults, maximum limits, and cursor semantics for high-volume endpoints.
- Webhook signature header standard (e.g., header names, timestamp format) and replay protection window.
- Search and filter capabilities for detections (full-text search, spatial predicate details, advanced query operators).
- Retention durations, archival policy, and audit log retention for detection data and time-series.
- Finalized disturbance type taxonomy and classification codes exposed via API.

Resolving these gaps ensures clients can integrate with confidence and operators can run the system reliably at scale.

---

This blueprint translates the system’s remote sensing foundations into a clear, pragmatic API design. It preserves the fidelity of geospatial data while providing modern, secure access patterns. By adhering to these specifications, implementers can build clients that monitor watersheds effectively, respond to changes quickly, and contribute to long-term conservation goals.# Watershed Disturbance Mapping System — RESTful API Architecture and Specification Blueprint

## Executive Summary and Narrative Context

The Watershed Disturbance Mapping System enables conservation organizations, environmental analysts, watershed managers, and software developers to monitor, analyze, and act on environmental changes across watersheds. Its core purpose is to detect and map disturbances such as logging, clearing, fire, flooding, and infrastructure development using multi-temporal satellite imagery, and to make those detections available through a robust, secure, and scalable application programming interface (API).

This blueprint defines the RESTful API architecture and endpoint specifications that support the full lifecycle from data ingestion and processing to results retrieval, alerting, and export. It also codifies operational concerns—authentication, authorization, rate limiting, idempotency, pagination, filtering, and webhook security—together with error handling, observability, and versioning strategy.

API access follows OAuth 2.0 bearer tokens for authentication, with role-based access control (RBAC) distinguishing roles such as admin, analyst, and viewer. Data resources—watersheds, processing jobs, detections, alerts, exports, and webhooks—are modeled explicitly with standard REST semantics, while geospatial endpoints return GeoJSON for spatial features and provide bbox filtering and temporal predicates. The API intentionally balances clarity for client developers with the constraints of cloud scale, multi-tenant safety, and operational resilience.

Guiding principles shape this design:
- Clarity and consistency in endpoint naming, resource representation, and error reporting.
- Least privilege access through scoped OAuth 2.0 tokens and RBAC enforcement across endpoints.
- Predictability via idempotency for long-running operations and standardized pagination and filtering.
- Scalability through pagination, filtering, asynchronous job processing, and rate limiting.
- Traceability using correlation IDs and structured logs, supporting problem diagnosis and audit needs.

The narrative arc moves from foundations to the API contract: we start with the data and processing context that informs the resource model; we then define the architecture and security posture; we detail the endpoints, formats, and job orchestration; and finally specify operational policies, validation expectations, and a practical implementation roadmap. The result is a specification that client developers and API engineers can implement against, and that operators and product managers can use to plan rollout, monitoring, and lifecycle management.

### Assumptions and Constraints

A few baseline assumptions and constraints are baked into this blueprint:

- Cloud processing runs on Google Earth Engine (GEE) for algorithm execution and scale. The API abstracts job orchestration and persistence while GEE handles heavy compute.
- The reference backend stack uses Python/Django with a PostgreSQL/PostGIS database for geospatial indexing and time-series storage. Celery manages asynchronous processing, and Redis provides caching.
- The frontend is built with React and Leaflet, which informs how GeoJSON features and time series are represented.
- Alerts are delivered over email and SMS and via webhooks. Delivery semantics include retries and signature verification for webhooks.
- Rate limiting is tiered by role. Anonymous access is restricted, and clients are expected to implement exponential backoff and respect Retry-After headers.

These assumptions are reflected in the resource model and endpoint design. Where details remain to be finalized—such as exact rate limits, OAuth provider configuration, and delivery SLAs—this blueprint flags them as information gaps to be resolved prior to production release.

## Data and Processing Foundations

The API is grounded in remote sensing workflows that ingest, harmonize, and analyze satellite imagery at scale. These workflows are the source of truth for detection results, confidence scoring, and time-series baselines.

### Supported Satellites and Products

The system leverages well-established optical satellite constellations—Landsat and Sentinel-2—and can optionally incorporate Synthetic Aperture Radar (SAR) from Sentinel-1 to address persistent cloud cover.

- Landsat 8/9: 30-meter spatial resolution; 16-day revisit; long historical archive; suitable for baselines and trend analysis.
- Sentinel-2: 10–20 meter resolution; 5-day revisit with combined constellation; suited for higher-frequency monitoring and gap filling.
- Sentinel-1 SAR (optional): C-band; all-weather monitoring; 12-day revisit; complements optical in cloudy regions.

Inputs include Landsat Collections and Sentinel-2 Level-2A (atmospherically corrected surface reflectance), with cloud masking (s2cloudless for Sentinel-2; CFMask for Landsat) and quality filters applied.

### Algorithms and Indices

Two complementary algorithm families drive detection:

- LandTrendr: Temporal segmentation of pixel trajectories to identify disturbance and recovery patterns; strong for historical analysis and disturbance type classification.
- Multi-Sensor Fusion (FNRT): Rapid detection by combining Landsat and Sentinel-2 (and optionally Sentinel-1), normalizing indices and applying statistical outlier detection tuned for early warnings.

Core spectral indices computed per acquisition:
- NDVI (Normalized Difference Vegetation Index): vegetation health and density.
- NBR (Normalized Burn Ratio): burn scar and fire-related change detection.
- TCG (Tasseled Cap Greenness): green vegetation signal emphasizing forest disturbance.

Confidence scoring integrates model probability, number of confirming observations, magnitude of spectral change, and spatial pattern consistency, with thresholds separating automated alerts, manual review, and rejection.

### Quality Control and Validation

Quality controls stabilize detection quality under challenging conditions such as clouds and turbid waters. The system applies cloud probability thresholds, requires a minimum number of valid observations per window, and enforces spatial and temporal persistence rules. Validation combines automated cross-algorithm checks with user feedback loops and scheduled field surveys. This ensures the API’s outputs remain calibrated to real-world conditions and improves over time through continuous learning.

To illustrate how inputs and indices inform the API’s output structures, the following table summarizes the detection inputs and outputs that the API exposes and that client applications can rely on.

Table 1: Detection Inputs and Outputs Overview

| Component | Source | Resolution | Temporal Cadence | Indices/Features | Outputs Exposed via API |
|---|---|---|---|---|---|
| Landsat 8/9 | Landsat Collections | 30 m | 16-day revisit | NDVI, NBR, TCG | Detections (GeoJSON), time series (JSON), baselines |
| Sentinel-2 L2A | Sentinel-2A/B | 10–20 m | 5-day revisit | NDVI, NBR, TCG | Detections (GeoJSON), time series (JSON), baselines |
| Sentinel-1 SAR (optional) | Sentinel-1 C-band | ~10 m (ground range) | 12-day revisit | Coherence/intensity features | Supplemental detections, context (metadata) |
| Algorithm Suite | LandTrendr, FNRT (multi-sensor fusion) | Pixel-wise | Monthly with 5-day cadence | Model features, change magnitude, persistence | Detection confidence, disturbance type, status, area |
| Confidence Scoring | Composite weights | N/A | Per detection | Model probability, confirming observations, magnitude, spatial coherence | Alert thresholds, review queue, filterable fields |
| Quality Controls | Cloud masking, spatial filters, persistence | N/A | Per window and observation | Cloud probability, minimum valid observations, patch size | API filters: confidence, area, bbox, time range |

The significance of this overview is twofold: it informs the shape of API responses—particularly for detections and time series—and it clarifies how filtering parameters (e.g., confidence, time range, bbox, disturbance_type) map to upstream processing logic and quality controls.

## API Architecture Overview

The API follows a consistent, resource-oriented design that mirrors how the underlying system operates. It leverages asynchronous job orchestration for satellite data processing and change detection, while providing direct retrieval for curated datasets and views.

- Base URL versioning: The initial version is v1, exposed as a URL prefix (e.g., /api/v1).
- Content types: JSON for general resources; GeoJSON for spatial features; CSV for exports; optionally Parquet via signed URLs.
- Idempotency: Clients must provide an idempotency key for POST requests that create long-running jobs; servers store and reuse prior results for identical keys.
- Pagination and filtering: List endpoints support pagination (limit/offset or cursor) and filtering using query parameters such as bbox, time ranges, confidence, area, and disturbance_type.
- Asynchronous job processing: Endpoints that trigger processing (e.g., ingesting new imagery, running detection algorithms) create jobs with status endpoints for polling and webhooks for completion callbacks.

To situate the reader, the following table presents an endpoint index at a high level. The full specification appears later.

Table 2: Endpoint Index (High-Level)

| Method | Path | Purpose | Auth Required |
|---|---|---|---|
| POST | /api/v1/auth/token | Obtain OAuth 2.0 access token | Yes (client credentials) |
| POST | /api/v1/auth/token/refresh | Refresh access token | Yes (refresh token) |
| POST | /api/v1/auth/logout | Revoke token/session | Yes |
| GET | /api/v1/users/me | Current user profile and roles | Yes |
| GET | /api/v1/watersheds | List watersheds | Yes (viewer+) |
| POST | /api/v1/watersheds | Create watershed | Yes (admin) |
| GET | /api/v1/watersheds/{id} | Retrieve watershed details | Yes (viewer+) |
| PATCH | /api/v1/watersheds/{id} | Update watershed metadata | Yes (admin) |
| DELETE | /api/v1/watersheds/{id} | Delete watershed (logical) | Yes (admin) |
| GET | /api/v1/watersheds/{id}/detections | List detections for watershed | Yes (viewer+) |
| POST | /api/v1/processing-jobs | Submit processing job (idempotent) | Yes (analyst+) |
| GET | /api/v1/processing-jobs/{id} | Retrieve job status | Yes (submitter+) |
| GET | /api/v1/detections | List detections (multi-filter) | Yes (viewer+) |
| GET | /api/v1/detections/{id} | Retrieve detection details | Yes (viewer+) |
| GET | /api/v1/detections/{id}/time-series | Retrieve spectral time series | Yes (viewer+) |
| GET | /api/v1/detections/{id}/thumbnail | Map thumbnail of detection | Yes (viewer+) |
| GET | /api/v1/alerts | List alerts | Yes (viewer+) |
| POST | /api/v1/alerts | Create or update alert rule | Yes (analyst+) |
| GET | /api/v1/alerts/{id} | Retrieve alert details | Yes (viewer+) |
| PATCH | /api/v1/alerts/{id} | Update alert rule | Yes (analyst+) |
| DELETE | /api/v1/alerts/{id} | Delete alert rule | Yes (admin) |
| POST | /api/v1/alerts/{id}/test | Send test notification | Yes (analyst+) |
| POST | /api/v1/exports | Create export job (CSV/GeoJSON/Parquet) | Yes (viewer+) |
| GET | /api/v1/exports/{id} | Retrieve export job status | Yes (submitter+) |
| GET | /api/v1/exports/{id}/download | Download exported file (signed URL) | Yes (submitter+) |
| POST | /api/v1/webhooks/register | Register or update webhook | Yes (analyst+) |
| GET | /api/v1/webhooks | List registered webhooks | Yes (owner/admin) |
| GET | /api/v1/webhooks/{id} | Retrieve webhook details | Yes (owner/admin) |
| DELETE | /api/v1/webhooks/{id} | Delete webhook registration | Yes (owner/admin) |

The table underscores the consistent pattern: authentication precedes all operations; roles gate sensitive actions; and asynchronous patterns support heavy compute.

### Resource Model

Core resources are modeled to match user workflows and system components:

- Watershed: A spatial unit with boundary geometry, metadata, and associated detections.
- ProcessingJobs: Asynchronous tasks that ingest data, compute indices, run algorithms, and produce detections.
- Detections: The atomic results of change detection, including geometry, date, confidence, type, area, and spectral change summaries.
- Alerts: Rules and instances governing and describing notifications, including channels and recipients.
- Exports: Asynchronous jobs that produce downloadable files; supports GeoJSON, CSV, and Parquet.
- Webhooks: Registration of callback URLs for event notifications (e.g., job completion, alert triggered).
- TimeSeries: Historical spectral index values for pixels or regions used for baselines and trend analysis.
- Users/Roles: Accounts, profiles, and RBAC role assignments.

### Versioning and Deprecation Policy

The API uses URL-based versioning (e.g., /api/v1). Breaking changes require a new version (v2), with dual support during a deprecation window. Advance notice, compatibility guidance, and a public deprecation timeline are provided before retiring old versions. This approach prevents disruption for existing clients and ensures predictable migration paths.

## Security and Authentication

Security is a first-class design concern. All communications use HTTPS/TLS 1.3. Authentication is handled via OAuth 2.0 bearer tokens, and authorization is enforced through role-based access control (RBAC).

Token acquisition supports client credentials for service-to-service integrations, with refresh tokens for long-lived sessions. Scope-based authorization allows least-privilege access for specific resources and actions. For webhooks and exports, the system uses signed URLs to delegate secure downloads without exposing broad credentials. All inbound webhooks must be verified with HMAC signatures and replay protection using timestamps and nonces.

The following table summarizes RBAC permissions across roles. The intent is to make clear which endpoints are accessible and what actions each role may perform.

Table 3: RBAC Permissions Matrix

| Resource | Action | Admin | Analyst | Viewer |
|---|---|---|---|---|
| Watersheds | list, read | Yes | Yes | Yes |
| Watersheds | create, update, delete | Yes | No | No |
| Detections | list, read | Yes | Yes | Yes |
| Detections | bulk export | Yes | Yes | Yes |
| Processing Jobs | create, read own | Yes | Yes | Read (limited) |
| Alerts | list, read | Yes | Yes | Yes |
| Alerts | create, update, delete | Yes | Yes (own) | No |
| Webhooks | register, list, delete | Yes | Yes (own) | Read (own) |
| Exports | create, read own | Yes | Yes | Yes |
| Time Series | read | Yes | Yes | Yes |
| Users/Roles | manage roles | Yes | No | No |

#### Data Protection and Privacy

- Encryption: TLS 1.3 for data in transit; encryption at rest for databases and object storage.
- Secrets Management: OAuth client secrets and signing keys stored securely with strict access controls and rotation policies.
- Retention: The system maintains detection history and time-series baselines with status flags (new, confirmed, false_positive, resolved). Precise retention durations and audit log retention policies are to be finalized; clients should not rely on implied data lifecycle behavior beyond what is documented per resource.

## API Specification by Domain

This section details endpoints, request/response schemas, filters, and operational behaviors by domain. Error handling uses standard HTTP status codes with a machine-readable problem+json structure, including a correlation_id for traceability. Rate limiting follows tiered policies per role; clients must back off on 429 responses and respect Retry-After.

### Watershed Management

Watersheds are the organizing unit for spatial analyses. The API supports CRUD operations and geospatial queries. Geometries are stored server-side, and clients can provide GeoJSON or well-known text (WKT) on creation and updates. Spatial indexing supports efficient bbox queries and time-window filtering for detections within each watershed.

Table 4: Watershed Endpoints

| Method | Path | Description | Auth Role |
|---|---|---|---|
| GET | /api/v1/watersheds | List watersheds with pagination and filters | viewer+ |
| POST | /api/v1/watersheds | Create a watershed | admin |
| GET | /api/v1/watersheds/{id} | Retrieve watershed details | viewer+ |
| PATCH | /api/v1/watersheds/{id} | Update watershed metadata | admin |
| DELETE | /api/v1/watersheds/{id} | Delete watershed (logical) | admin |
| GET | /api/v1/watersheds/{id}/detections | List detections within watershed | viewer+ |

Example: Create Watershed (request, GeoJSON geometry)

```
POST /api/v1/watersheds
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "name": "Upper River Basin",
  "description": "Monitoring riparian disturbances",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [-122.7, 45.6],
        [-122.5, 45.6],
        [-122.5, 45.7],
        [-122.7, 45.7],
        [-122.7, 45.6]
      ]
    ]
  },
  "tags": ["riparian", "priority"]
}
```

Response: Watershed resource

```
{
  "id": "ws_123",
  "name": "Upper River Basin",
  "description": "Monitoring riparian disturbances",
  "geometry": {
    "type": "Polygon",
    "coordinates": [ /* ... */ ]
  },
  "tags": ["riparian", "priority"],
  "created_at": "2025-10-01T12:00:00Z",
  "updated_at": "2025-10-01T12:00:00Z"
}
```

Validation rules:
- geometry must be a valid GeoJSON polygon or multipolygon.
- name is required; tags are optional; description is功效 optional string.

### Satellite Data Processing

Processing jobs encapsulate ingestion, index computation, change detection, and persistence. All submissions must include an idempotency key, enabling safe retries without duplicate work. Jobs include status, progress, and logs. The API exposes artifact metadata (e.g., number of scenes processed, detections created) upon completion.

Table 5: Processing Job Fields

| Field | Type | Description |
|---|---|---|
| id | string | Unique job identifier |
| type | string | Job type (e.g., ingest, detect) |
| watershed_id | string | Associated watershed |
| parameters | object | Sensor selection, thresholds, algorithm options |
| status | string | queued, running, succeeded, failed |
| status_reason | string | Error message or note |
| progress | number | 0–100 |
| created_at | timestamp | Submission time |
| updated_at | timestamp | Last update |
| submitted_by | string | User ID who submitted |
| artifacts | object | Summary metrics post-completion |

Endpoints:
- POST /api/v1/processing-jobs: Submit job (idempotent).
- GET /api/v1/processing-jobs/{id}: Retrieve job status.
- GET /api/v1/processing-jobs: List jobs with filters (status, watershed_id, created_at).

Example: Submit Processing Job

```
POST /api/v1/processing-jobs
Content-Type: application/json
Authorization: Bearer {access_token}
Idempotency-Key: {uuid}

{
  "type": "detect",
  "watershed_id": "ws_123",
  "parameters": {
    "sensors": ["landsat8", "landsat9", "sentinel2"],
    "use_sentinel1": false,
    "indices": ["NDVI", "NBR", "TCG"],
    "cloud_threshold_pct": 30,
    "min_valid_observations": 3,
    "baseline_years": 3,
    "change_threshold_sd": 2.5,
    "algorithm": "FNRT",
    "job_window_days": 90
  },
  "note": "Monthly monitoring run"
}
```

Response: Job accepted

```
{
  "id": "job_456",
  "type": "detect",
  "watershed_id": "ws_123",
  "parameters": { /* echo */ },
  "status": "queued",
  "status_reason": null,
  "progress": 0,
  "created_at": "2025-10-01T12:05:00Z",
  "updated_at": "2025-10-01T12:05:00Z",
  "submitted_by": "user_789"
}
```

Polling status:

```
GET /api/v1/processing-jobs/job_456
Authorization: Bearer {access_token}

{
  "id": "job_456",
  "status": "running",
  "progress": 42,
  "updated_at": "2025-10-01T12:10:00Z",
  "status_reason": null
}
```

On completion, status becomes succeeded with artifacts summary; failed includes status_reason. Clients receive webhook callbacks when registered.

### Change Detection Results

Detections are exposed as GeoJSON FeatureCollections with server-side filtering. The API supports geospatial bbox, temporal filtering, and attribute filters such as confidence and disturbance type.

Table 6: Detection Schema Overview

| Field | Type | Description |
|---|---|---|
| id | string | Unique detection ID |
| watershed_id | string | Associated watershed |
| geometry | GeoJSON Polygon/MultiPolygon | Spatial extent |
| detection_date | date | First detection date |
| last_update | timestamp | Latest status change |
| confidence_score | number (0–1) | Composite confidence |
| disturbance_type | string | Enum: fire, harvest, clearing, flood, infrastructure |
| area_hectares | number | Area in hectares |
| status | string | new, confirmed, false_positive, resolved |
| spectral_magnitude | object | NDVI/NBR/TCG delta summary |
| confirming_observations | integer | Number of confirmations |
| baseline_window | object | Baseline window used (years) |
| related_detections | array | Linked detection IDs |

Endpoints:
- GET /api/v1/detections: List with filters.
- GET /api/v1/detections/{id}: Retrieve detection details.
- GET /api/v1/detections/{id}/time-series: Retrieve NDVI/NBR/TCG time series.
- GET /api/v1/detections/{id}/thumbnail: Map thumbnail image.

Example: Retrieve Detection

```
GET /api/v1/detections/det_987
Authorization: Bearer {access_token}

{
  "id": "det_987",
  "watershed_id": "ws_123",
  "geometry": {
    "type": "Polygon",
    "coordinates": [ /* ... */ ]
  },
  "detection_date": "2025-09-28",
  "last_update": "2025-10-01T11:30:00Z",
  "confidence_score": 0.87,
  "disturbance_type": "fire",
  "area_hectares": 1.4,
  "status": "new",
  "spectral_magnitude": {
    "NDVI": -0.42,
    "NBR": -0.55,
    "TCG": -0.31
  },
  "confirming_observations": 2,
  "baseline_window": { "years": 3 },
  "related_detections": ["det_985", "det_986"]
}
```

Example: Time Series

```
GET /api/v1/detections/det_987/time-series
Authorization: Bearer {access_token}

{
  "pixel_or_region": "region_centroid",
  "indices": ["NDVI", "NBR", "TCG"],
  "series": [
    { "date": "2025-06-01", "NDVI": 0.61, "NBR": 0.31, "TCG": 0.22 },
    { "date": "2025-07-01", "NDVI": 0.58, "NBR": 0.28, "TCG": 0.20 },
    { "date": "2025-08-01", "NDVI": 0.35, "NBR": 0.05, "TCG": 0.12 }
  ],
  "baseline_reference": "rolling_3yr_median"
}
```

Filtering:
- bbox=minLon,minLat,maxLon,maxLat for spatial constraints.
- time_range=start_date,end_date or start_date..end_date for temporal constraints.
- confidence=min,max for quality thresholds.
- area_hectares=gte,lte for patch size filtering.
- disturbance_type=fire,harvest,clearing,flood,infrastructure for event type filtering.

### User Authentication and Accounts

Authentication follows OAuth 2.0 with client credentials and token refresh. Session management enables logout and revocation. RBAC is surfaced via the user profile endpoint. Tokens carry scopes (e.g., detections:read, jobs:write, alerts:manage), enabling least-privilege access.

Table 7: Auth Endpoints

| Method | Path | Description | Scopes |
|---|---|---|---|
| POST | /api/v1/auth/token | Obtain access token | none |
| POST | /api/v1/auth/token/refresh | Refresh access token | none |
| POST | /api/v1/auth/logout | Revoke refresh token | none |
| GET | /api/v1/users/me | Current user profile and roles | profile:read |

Example: Token Request (client credentials)

```
POST /api/v1/auth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id={client_id}&client_secret={client_secret}&scope=detections:read+watersheds:read
```

Response:

```
{
  "access_token": "{access_token}",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "{refresh_token}",
  "scope": "detections:read watersheds:read"
}
```

User profile:

```
GET /api/v1/users/me
Authorization: Bearer {access_token}

{
  "id": "user_789",
  "email": "analyst@example.org",
  "roles": ["analyst"],
  "scopes": ["detections:read", "watersheds:read", "jobs:write", "alerts:manage"],
  "created_at": "2024-01-15T00:00:00Z"
}
```

### Alert Management

Alerts are generated automatically by thresholding on confidence, area, and spatial context (e.g., proximity to streams or riparian zones). Users can create and manage alert rules, configure channels (email, SMS, webhook), and track notification outcomes. Delivery uses email and SMS providers, with webhooks for integration. The API provides history and audit trail per alert rule.

Table 8: Alert Rule Schema and Channels

| Field | Type | Description |
|---|---|---|
| id | string | Alert rule ID |
| name | string | Human-readable name |
| criteria | object | confidence_min, area_min_hectares, proximity_rules |
| channels | object | email (addresses), sms (numbers), webhook_url |
| geography | object | watersheds, bbox, or named areas |
| mute | boolean | Temporarily suppress notifications |
| created_by | string | Owner user ID |
| created_at | timestamp | Rule creation |
| updated_at | timestamp | Last update |

Endpoints:
- GET /api/v1/alerts: List alert rules and recent notifications.
- POST /api/v1/alerts: Create alert rule.
- GET /api/v1/alerts/{id}: Retrieve alert details and history.
- PATCH /api/v1/alerts/{id}: Update rule.
- DELETE /api/v1/alerts/{id}: Delete rule.
- POST /api/v1/alerts/{id}/test: Send test notification.

Example: Create Alert Rule

```
POST /api/v1/alerts
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "name": "High-confidence fire near streams",
  "criteria": {
    "confidence_min": 0.8,
    "area_min_hectares": 0.5,
    "proximity_rules": [
      { "feature": "streams", "max_distance_m": 100 },
      { "feature": "riparian_zones", "within": true }
    ]
  },
  "channels": {
    "email": ["alerts@example.org"],
    "sms": ["+15551234567"],
    "webhook_url": "https://partner.example.org/webhooks/alerts"
  },
  "geography": {
    "watersheds": ["ws_123"]
  },
  "mute": false
}
```

Response:

```
{
  "id": "alert_321",
  "name": "High-confidence fire near streams",
  "criteria": { /* echo */ },
  "channels": { /* echo */ },
  "geography": { "watersheds": ["ws_123"] },
  "mute": false,
  "created_by": "user_789",
  "created_at": "2025-10-01T12:15:00Z",
  "updated_at": "2025-10-01T12:15:00Z"
}
```

Notification audit:
- GET /api/v1/alerts/{id} includes a history of delivery attempts, statuses, and any errors.

### Data Export

Export operations run asynchronously and produce downloadable files in GeoJSON, CSV, or Parquet. Exports support filters that mirror detection queries (bbox, time range, confidence, area, disturbance type). Clients receive a signed URL upon completion. Metadata includes record counts and checksum.

Table 9: Export Endpoints and Formats

| Method | Path | Description |
|---|---|---|
| POST | /api/v1/exports | Create export job with filters and format |
| GET | /api/v1/exports/{id} | Retrieve export status and metadata |
| GET | /api/v1/exports/{id}/download | Download via signed URL |

Example: Request Export

```
POST /api/v1/exports
Content-Type: application/json
Authorization: Bearer {access_token}
Idempotency-Key: {uuid}

{
  "format": "geojson",
  "filters": {
    "bbox": [-122.7, 45.6, -122.5, 45.7],
    "time_range": "2025-06-01..2025-10-01",
    "confidence": [0.8, 1.0],
    "area_hectares": [0.5, null],
    "disturbance_type": ["fire", "harvest"]
  },
  "include_time_series": false
}
```

Response:

```
{
  "id": "export_654",
  "status": "queued",
  "created_at": "2025-10-01T12:20:00Z",
  "updated_at": "2025-10-01T12:20:00Z",
  "filters": { /* echo */ },
  "format": "geojson",
  "download_url": null
}
```

Completion:

```
{
  "id": "export_654",
  "status": "succeeded",
  "updated_at": "2025-10-01T12:22:00Z",
  "download_url": "https://cdn.example.org/exports/export_654.geojson?signature=...",
  "metadata": {
    "record_count": 1024,
    "checksum_sha256": "a1b2c3..."
  }
}
```

### Webhooks

Webhooks deliver event notifications such as job completion and alert triggers. Registration requires a URL and a secret. The system validates HMAC signatures and includes timestamps and event IDs to prevent replay. Retries follow exponential backoff with jitter for transient failures; clients should respond quickly to avoid timeouts and ensure reliable delivery.

Table 10: Webhook Event Payloads

| Event | Description | Core Fields |
|---|---|---|
| job.completed | Processing job succeeded | event_id, timestamp, job_id, watershed_id, artifacts_summary |
| job.failed | Processing job failed | event_id, timestamp, job_id, status_reason |
| alert.triggered | New alert generated | event_id, timestamp, alert_id, rule_id, detection_id, channels |
| export.completed | Export finished | event_id, timestamp, export_id, download_url, metadata |

Example: Webhook Delivery (alert.triggered)

```
POST /partner/webhook_url
Content-Type: application/json
X-Signature: HMAC-SHA256={base64_signature}
X-Event-ID: evt_12345
X-Timestamp: 1696156800

{
  "event": "alert.triggered",
  "event_id": "evt_12345",
  "timestamp": "2025-10-01T12:25:00Z",
  "alert_id": "alert_321",
  "rule_id": "alert_321",
  "detection_id": "det_987",
  "data": {
    "confidence_score": 0.87,
    "disturbance_type": "fire",
    "area_hectares": 1.4,
    "watershed_id": "ws_123"
  }
}
```

Client verification:
- Compute HMAC over raw body using shared secret; compare to X-Signature.
- Reject messages with timestamps outside a short acceptance window to prevent replay.

## Common Request/Response Formats, Filtering, and Error Handling

The API standardizes envelopes and behaviors to promote predictability across endpoints.

- Request headers: Authorization: Bearer {access_token}; Idempotency-Key: {uuid} for POST jobs/exports; Content-Type: application/json or application/geo+json for GeoJSON.
- Response envelope: All resources include id, created_at, updated_at, and relevant domain fields. Time fields are ISO 8601 in UTC (e.g., 2025-10-01T12:00:00Z).
- Pagination: List endpoints support either limit/offset or cursor tokens. Default page size is 50, with a maximum of 500.
- Filtering: Query parameters follow a consistent pattern; bbox uses comma-separated values; time ranges use start..end; numeric ranges use gte,lte semantics via separate keys.
- Error format: problem+json includes type, title, detail, status, instance, correlation_id; validation errors include field-specific details.

Table 11: Standard Error Codes

| HTTP Status | Meaning | Typical Use |
|---|---|---|
| 400 | Bad Request | Malformed JSON, invalid parameters |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient role/scope |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Idempotency key conflict or state violation |
| 413 | Payload Too Large | Export specification exceeds limits |
| 415 | Unsupported Media Type | Wrong Content-Type |
| 422 | Unprocessable Entity | Validation failure |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unhandled server faults |

Example: Validation error

```
{
  "type": "https://api.example.org/problems/validation",
  "title": "Validation Failed",
  "status": 422,
  "detail": "geometry must be a valid GeoJSON polygon",
  "instance": "/api/v1/watersheds",
  "correlation_id": "b36ad3d0-3f87-4f6a-9d66-7b38f1a9c7d1",
  "errors": [
    { "field": "geometry", "message": "Invalid coordinates" }
  ]
}
```

### Rate Limiting and Backoff

Rate limits are tiered by role and endpoint class. Anonymous access is disallowed for most endpoints; bearer tokens are required. Exact numerical limits are an information gap to be finalized. Clients must implement exponential backoff on 429 responses and respect Retry-After headers.

Table 12: Rate Limiting Tiers (Indicative)

| Role | Endpoint Class | Indicative Limit |
|---|---|---|
| admin | Detection reads | 120 requests/min |
| analyst | Job submissions | 60 requests/min |
| viewer | Exports | 30 requests/min |
| service | Webhooks delivery | Depends on provider SLAs |

These tiers are placeholders to guide planning. The production configuration will define exact numbers and burst behaviors. Observability metrics will report per-tenant and per-endpoint usage to inform tuning.

## Operational Observability, Scalability, and Resilience

Operational excellence depends on robust monitoring, structured logging, and scalable infrastructure patterns:

- Monitoring and Logging: CloudWatch or equivalent captures logs and metrics. Each request includes a correlation_id for end-to-end tracing across services, job queues, and webhooks. Audit logs record security-relevant events and sensitive operations.
- Scalability: The web tier scales horizontally behind a load balancer. Database read replicas handle reporting queries, while caching with Redis accelerates responses for frequently accessed data. A CDN serves static assets for the frontend.
- Resilience: Retries with exponential backoff cover transient failures in job execution and webhook delivery. Health checks and readiness probes enable proactive routing away from unhealthy instances. Queue-based processing provides buffering under load spikes.

The net effect is a platform that can grow with usage and withstand partial failures without compromising data integrity or user experience.

## Validation, Quality Thresholds, and Manual Review Queue

Quality controls are embedded in the API’s behavior and shape the client experience:

- Confidence thresholds: Automated alerts are generated for detections above 0.8 confidence; detections between 0.6 and 0.8 are routed to manual review; below 0.6 are filtered out.
- Spatial filtering: Minimum patch size of 0.04 hectares removes spurious single-pixel detections.
- Temporal persistence: Detections must appear across two or more observations; this stabilizes alerts and reduces false positives.
- Manual review queue: API endpoints expose reviewable detections and allow status updates to confirmed, false_positive, or resolved.

Table 13: Confidence Thresholds and Actions

| Threshold | Action | API Behavior |
|---|---|---|
| > 0.8 | Automated alert | Alert rule triggers; notification channels engaged |
| 0.6–0.8 | Manual review | Detection exposed in review endpoints; status = new |
| < 0.6 | Rejection | Detection excluded from alerts and exports by default |

These thresholds align with the system’s quality control framework and allow operators to calibrate alert volumes and review capacity based on regional conditions and seasonal variability.

## Implementation Roadmap and Delivery Plan

The delivery plan sets a pragmatic path from specification to implementation, testing, and documentation:

1. Endpoints Development: Implement authentication, watershed management, processing jobs, detections, alerts, exports, and webhooks with standardized envelopes, validation, and error handling.
2. Asynchronous Orchestration: Wire job submission, status polling, completion callbacks, and webhook deliveries with idempotency keys and HMAC signatures.
3. Testing: Conduct unit, integration, and performance testing; validate geospatial filtering, rate limiting, and RBAC enforcement; execute security audits to verify TLS, OAuth, and secret handling.
4. Documentation: Provide API reference and client examples; publish versioning and deprecation policy; document rate limits and webhook signing; publish operational SLAs.
5. Monitoring Setup: Configure CloudWatch metrics and alerts; implement audit logging for sensitive operations; establish dashboards for latency, error rates, and queue depths.

To align expectations, the following table maps API capabilities to modules and schedules.

Table 14: Implementation Milestones

| Milestone | Scope | Owner | Timeline |
|---|---|---|---|
| Core Auth & RBAC | OAuth 2.0, token refresh, users/me | Backend | Month 1 |
| Watersheds & Detections | CRUD, GeoJSON, filters | Backend + GIS | Month 2 |
| Processing Jobs | Submission, status, logs, webhooks | Backend + Processing | Month 2–3 |
| Alerts | Rules, channels, audit history | Backend + Alerts | Month 3 |
| Exports | Async jobs, signed URLs, metadata | Backend + Storage | Month 3 |
| Observability | Correlation IDs, logs, metrics | DevOps | Month 3 |
| Security Review | TLS, secrets, OAuth scopes, HMAC | Security | Month 4 |
| Documentation | API reference, client guides | Tech Writing | Month 4 |

### Information Gaps

A few items remain unspecified and must be resolved before general availability:
- Exact OAuth 2.0 provider configuration (authorization code vs. client credentials flow, token lifetimes, and scope naming).
- Definitive rate limits per role and endpoint tiering.
- Geospatial API specifics (projection handling beyond EPSG:4326 for GeoJSON, detailed spatial query language).
- Data export format finalization (maximum dataset size, multi-part download strategy, signed URL TTL).
- Delivery SLAs and retry policies for email/SMS/webhooks, including delivery tracking fields.
- Pagination defaults, maximum limits, and cursor semantics for high-volume endpoints.
- Webhook signature header standard (e.g., header names, timestamp format) and replay protection window.
- Search and filter capabilities for detections (full-text search, spatial predicate details, advanced query operators).
- Retention durations, archival policy, and audit log retention for detection data and time-series.
- Finalized disturbance type taxonomy and classification codes exposed via API.

Resolving these gaps ensures clients can integrate with confidence and operators can run the system reliably at scale.

---

This blueprint translates the system’s remote sensing foundations into a clear, pragmatic API design. It preserves the fidelity of geospatial data while providing modern, secure access patterns. By adhering to these specifications, implementers can build clients that monitor watersheds effectively, respond to changes quickly, and contribute to long-term conservation goals.