# EEIS - Environmental Early Impact Scanner

A satellite-based watershed disturbance mapping system that detects and monitors environmental changes using multi-temporal remote sensing data, machine learning, and automated processing workflows.

## What It Does

EEIS ingests imagery from Landsat 8/9, Sentinel-2, and MODIS satellites to automatically detect watershed disturbances including logging, clearing, fire, flooding, and infrastructure development. It provides early warning alerts (69.8% detection within 30 days) and continuous monitoring of habitat-impacting changes.

### Key Capabilities

- **Multi-satellite integration** - Landsat 8/9, Sentinel-2, MODIS data acquisition and processing
- **Change detection algorithms** - LandTrendr, spectral change analysis, time-series analysis, BEAST, EWMA/CUSUM
- **U-Net deep learning model** - Pixel-wise disturbance probability (89% precision, 84% recall)
- **Spectral indices** - NDVI, NBR, Tasseled Cap Greenness
- **Real-time monitoring** - WebSocket-based progress tracking and alert notifications
- **Spatial analytics** - PostGIS-powered queries with spatial indexing
- **Data export** - GeoJSON, Shapefile, KML, CSV, NetCDF, COG formats

## Architecture

```
                    +------------------+
                    |   React Frontend |
                    |  (Leaflet Maps)  |
                    +--------+---------+
                             |
                    +--------+---------+
                    |  Node.js/Express |
                    |    API Server    |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
    +---------+----------+    +-------------+-----------+
    | PostgreSQL/PostGIS  |    |  Python Processing      |
    |   + TimescaleDB     |    |  Pipeline               |
    +--------------------+    |  (USGS/ESA clients,     |
                              |   LandTrendr, U-Net,    |
                              |   spectral analysis)    |
                              +-------------------------+
```

### Components

| Component | Technology | Directory |
|-----------|-----------|-----------|
| Frontend | React 18 + TypeScript + Vite + Redux + Leaflet + Tailwind | `frontend-fresh/` |
| API Server | Node.js + Express + Sequelize + Socket.IO + JWT | `api_server/` |
| Processing Pipeline | Python + Xarray + Dask + Rasterio + GeoPandas | `python_processing/` |
| Database | PostgreSQL 14 + PostGIS 3.2 + TimescaleDB | `database_setup/` |
| VPN | WireGuard + OpenVPN | `vpn_setup/` |

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+
- Python 3.9+
- PostgreSQL 14+ with PostGIS

### Docker (fastest)

```bash
# Start PostgreSQL + API server + Redis
cd quick-start
docker-compose up -d

# Wait for services, then check
curl http://localhost:5000/api/health
```

Services:
- API Server: http://localhost:5000
- API Docs: http://localhost:5000/api-docs
- Database: localhost:5432

Default credentials: `admin@watershedmapping.com` / `AdminPassword123!`

### Manual Setup

**Database:**
```bash
cd database_setup
# See README.md for PostgreSQL + PostGIS installation
./database_scripts/init_database.sh
```

**API Server:**
```bash
cd api_server
npm install
cp .env.example .env  # Configure database connection
npm start
```

**Processing Pipeline:**
```bash
cd python_processing
pip install -r requirements.txt
# Configure USGS/ESA API credentials in config/settings.py
python main.py
```

**Frontend:**
```bash
cd frontend-fresh/watershed-mapping-frontend
pnpm install
pnpm dev
```

## Project Structure

```
EEIS/
+-- api_server/           # Node.js REST API + WebSocket server
|   +-- routes/           # API endpoints (watersheds, satellites, alerts, auth)
|   +-- models/           # Sequelize ORM models
|   +-- middleware/        # Auth, validation, error handling
|   +-- services/         # Socket.IO service
+-- frontend-fresh/       # React + TypeScript frontend (current)
|   +-- src/
|       +-- components/   # Map, dashboard, UI components
|       +-- pages/        # Dashboard, MapView, Alerts, Analytics
|       +-- services/     # API client services
|       +-- store/        # Redux slices
+-- python_processing/    # Satellite data processing pipeline
|   +-- data_acquisition/ # USGS Earth Explorer + ESA Copernicus clients
|   +-- preprocessing/    # Cloud masking, spectral indices, raster processing
|   +-- change_detection/ # LandTrendr, spectral change, time-series analysis
|   +-- quality_control/  # Confidence scoring, validation
|   +-- workflows/        # Pipeline orchestration, scheduling
+-- database_setup/       # PostgreSQL/PostGIS setup, migrations, backups
+-- vpn_setup/            # WireGuard + OpenVPN configuration
+-- quick-start/          # Docker Compose for fast local setup
+-- docs/                 # Architecture docs, research plans, guides
+-- code/                 # Original API spec and database schema
```

## Processing Pipeline

The system runs a 9-step automated workflow on a 5-day cycle (matching Sentinel-2 revisit):

1. **Imagery Acquisition** - Pull Sentinel-2 L2A + Landsat Collection 2 Level-2
2. **Atmospheric Correction** - Sen2Cor for Sentinel-2, USGS standard for Landsat
3. **Cloud Masking** - s2cloudless / CFMask with 30% threshold
4. **Spectral Index Calculation** - NDVI, NBR, TCG with Z-score normalization
5. **U-Net Inference** - Pixel-wise disturbance probability from multi-temporal features
6. **Change Detection** - Baseline comparison (rolling 3-year median, 2.5 SD threshold)
7. **Validation & Confidence Scoring** - Weighted score from U-Net + observations + magnitude + spatial consistency
8. **PostGIS Update** - Store detections with geometry, confidence, type classification
9. **Alert Generation** - Notify on high-confidence detections near sensitive habitats

## Data Sources

| Satellite | Resolution | Revisit | Best For |
|-----------|-----------|---------|----------|
| Landsat 8/9 | 30m | 16 days | Historical analysis, long-term monitoring |
| Sentinel-2 | 10-20m | 5 days | High-frequency monitoring, cloud gap filling |
| Sentinel-1 SAR | - | 12 days | Cloud-penetrating, all-weather (optional) |
| MODIS | 250-1000m | 1-2 days | Broad coverage, rapid response |

## Performance Targets

- LandTrendr: 86.2% accuracy distinguishing disturbance types
- Multi-sensor fusion: 69.8% detection within 30 days, 84.6% within 60 days
- U-Net: 89% precision, 84% recall
- Minimum detectable patch: 0.04 hectares (400 m^2)
- Confidence threshold: >0.8 for automated alerts, 0.6-0.8 for manual review

## Documentation

- [System Architecture](docs/system_architecture.md)
- [Database Schema](docs/database_schema.md)
- [API Documentation](docs/api_documentation_summary.md)
- [Satellite Processing Stack](docs/satellite_processing_stack.md)
- [Change Detection Methods](docs/change_detection_methods.md)
- [Deployment Guide](docs/deployment_guide.md)
- [User Guide](docs/user_guide.md)
- [VPN Networking](docs/vpn_networking.md)

## License

Copyright 2025-2026 Hestia's Creations

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.
