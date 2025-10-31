# Satellite Data Processing Pipeline

A comprehensive Python pipeline for processing satellite data, performing change detection, and monitoring watershed health. This pipeline handles data acquisition from USGS Earth Explorer and ESA Copernicus, preprocessing with rasterio and xarray, change detection algorithms, quality control, and time series analysis.

## Features

### 1. Data Acquisition
- **USGS Earth Explorer**: Automated download of Landsat data
- **ESA Copernicus**: Automated download of Sentinel-2 data
- **Batch downloading**: Efficient bulk data acquisition
- **Quality filtering**: Cloud coverage and metadata filtering

### 2. Data Preprocessing
- **Radiometric calibration**: DN to surface reflectance conversion
- **Cloud masking**: Pixel QA band processing
- **Geometric correction**: Reprojection and resampling
- **Quality assessment**: Data integrity checks

### 3. Change Detection
- **Simplified LandTrendr**: Temporal change detection
- **Spectral indices**: NDVI, NBR, TCG, and other vegetation indices
- **Spectral change detection**: Multi-index change analysis
- **Disturbance detection**: Deforestation, burn scars, flooding

### 4. Quality Control
- **Confidence scoring**: Multi-criteria quality assessment
- **Pixel quality**: Automated quality flagging
- **Validation framework**: Quality metric tracking
- **Statistical validation**: Outlier detection

### 5. Time Series Analysis
- **Trend analysis**: Long-term vegetation trends
- **Anomaly detection**: Identifying unusual patterns
- **Regime shift detection**: Abrupt changes in ecosystem state
- **Watershed monitoring**: Multi-parameter time series

### 6. Database Integration
- **SQLite storage**: Efficient result storage
- **Spatial queries**: Geographic filtering
- **Quality tracking**: Metadata and statistics
- **Export capabilities**: Data retrieval and analysis

### 7. Automated Processing
- **Cron scheduling**: Automated batch processing
- **Workflow management**: End-to-end processing chains
- **Error handling**: Robust error recovery
- **Monitoring**: Status tracking and alerts

## Installation

1. **Clone or download the pipeline:**
   ```bash
   git clone <repository-url>
   cd python_processing
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables:**
   ```bash
   export USGS_API_KEY="your_usgs_api_key"
   export ESA_API_KEY="your_esa_api_key"
   export DATABASE_URL="sqlite:///satellite_data.db"
   ```

## Quick Start

### Single Scene Processing

**Process a Landsat scene:**
```bash
python main.py process-single \
  --source usgs \
  --latitude 40.0 \
  --longitude -105.0 \
  --start-date 2023-01-01 \
  --end-date 2023-01-31 \
  --scene-id "landsat_test_scene"
```

**Process Sentinel-2 data:**
```bash
python main.py process-single \
  --source esa \
  --west -105.0 \
  --south 40.0 \
  --east -104.0 \
  --north 41.0 \
  --start-date 2023-06-01 \
  --end-date 2023-06-30
```

### Time Series Analysis

```bash
python main.py process-timeseries \
  --location-id test_watershed \
  --west -105.0 \
  --south 40.0 \
  --east -104.0 \
  --north 41.0 \
  --start-date 2020-01-01 \
  --end-date 2023-12-31 \
  --index NDVI
```

### Batch Processing

Create a batch configuration file (`batch_config.json`):
```json
[
  {
    "source": "usgs",
    "scene_id": "landsat_2023_001",
    "latitude": 40.0,
    "longitude": -105.0,
    "start_date": "2023-01-01",
    "end_date": "2023-01-31",
    "output_dir": "./data/batch_2023_01"
  },
  {
    "source": "esa",
    "scene_id": "sentinel2_2023_001", 
    "bbox": [-105.0, 40.0, -104.0, 41.0],
    "start_date": "2023-01-01",
    "end_date": "2023-01-31",
    "output_dir": "./data/batch_2023_01"
  }
]
```

Run batch processing:
```bash
python main.py batch-processing --batch-config batch_config.json
```

### Automated Processing

**Start automated processing:**
```bash
python main.py automated --start
```

**Add a cron job:**
```bash
python main.py automated --add-job \
  --job-name "monthly_landsat_processing" \
  --command "process-monthly-data" \
  --schedule "0 2 1 * *" \
  --parameters '{"source": "usgs", "region": "colorado"}'
```

**List active jobs:**
```bash
python main.py automated --list-jobs
```

## Configuration

### Environment Variables

- `USGS_API_KEY`: USGS Earth Explorer API key
- `ESA_API_KEY`: ESA Copernicus API key  
- `DATABASE_URL`: Database connection string (default: SQLite)
- `MAX_WORKERS`: Maximum parallel workers (default: 4)
- `DEBUG`: Enable debug logging (default: false)

### Configuration File

Create `config/settings.py` to customize processing parameters:

```python
# Processing thresholds
CLOUD_COVERAGE_THRESHOLD = 0.3
PIXEL_QUALITY_SCORE_THRESHOLD = 0.7
CONFIDENCE_SCORE_THRESHOLD = 0.8

# Change detection parameters
LANDTRENDR_MIN_SEGMENTS = 5
LANDTRENDR_MAX_SEGMENTS = 10
NDVI_THRESHOLD = 0.2
NBR_THRESHOLD = 0.15
TCG_THRESHOLD = 0.1
```

## API Usage

### Python API Example

```python
import asyncio
from config import Settings
from workflows import ProcessingPipeline

# Initialize pipeline
settings = Settings.from_env()
pipeline = ProcessingPipeline(settings)

# Configure scene
scene_config = {
    'source': 'usgs',
    'latitude': 40.0,
    'longitude': -105.0,
    'start_date': '2023-01-01',
    'end_date': '2023-01-31',
    'scene_id': 'test_scene'
}

# Process scene
async def main():
    result = await pipeline.process_single_scene(scene_config)
    print(f"Processing completed: {result['processing_status']}")

# Run processing
asyncio.run(main())
```

### Database Operations

```python
from database import DatabaseManager

# Initialize database
db = DatabaseManager(settings)

# Store processing result
result_id = db.store_processing_result(
    scene_id='landsat_2023_001',
    acquisition_date='2023-01-15',
    platform='landsat',
    bbox=(-105.0, 40.0, -104.0, 41.0),
    quality_score=0.85
)

# Query results
results = db.get_processing_results(
    platform='landsat',
    start_date='2023-01-01',
    end_date='2023-12-31'
)

# Get change detection results
changes = db.get_change_detection_results(
    result_id=result_id,
    index_name='NDVI'
)
```

## Output Structure

```
data/
├── raw/                    # Downloaded satellite data
├── processed/              # Preprocessed datasets (.nc files)
├── results/                # Analysis outputs and change maps
└── satellite_data.db       # SQLite database

python_processing/
├── config/                 # Configuration modules
├── data_acquisition/       # API clients and downloaders
├── preprocessing/          # Data preprocessing tools
├── change_detection/       # Change detection algorithms
├── quality_control/        # Quality assessment
├── time_series/           # Time series analysis
├── database/              # Database integration
├── workflows/             # Processing workflows
├── utils/                 # Utility functions
└── main.py               # Main entry point
```

## Supported Data Sources

### USGS Earth Explorer
- **Landsat 8-9**: Collection 2 Level-2 products
- **Landsat 4-7**: Historical data
- **Processing levels**: L1TP, L2SP, L2GS
- **Bands**: Coastal, Blue, Green, Red, NIR, SWIR1, SWIR2, Pan, Cirrus, TIRS

### ESA Copernicus
- **Sentinel-2**: L1C and L2A products
- **Sentinel-1**: SAR data (future expansion)
- **Bands**: All Sentinel-2 spectral bands (B01-B12)
- **Resolution**: 10m, 20m, 60m bands

## Quality Control

### Confidence Scoring
- **Data Quality**: QA band analysis, cloud coverage
- **Spectral Consistency**: Band correlation checks
- **Statistical Validation**: Value range and outlier detection
- **Temporal Consistency**: Time series stability

### Quality Metrics
- **Cloud Coverage**: Percentage of cloudy pixels
- **Valid Data Ratio**: Usable pixel percentage
- **Spectral Quality**: Band-to-band relationships
- **Processing Quality**: Overall confidence score

## Monitoring and Status

### System Status
```bash
python main.py status
```

### Database Statistics
- Processing results count
- Change detection results
- Time series analyses
- Quality metrics
- Data coverage periods

### Log Files
- `satellite_pipeline.log`: Application logs
- Console output: Real-time processing status
- Error tracking: Failed operations and retries

## Performance Optimization

### Parallel Processing
- Multi-worker download manager
- Concurrent scene processing
- Optimized I/O operations

### Memory Management
- Chunked data loading
- Memory-mapped raster operations
- Automatic cleanup of intermediate files

### Caching
- Database result caching
- Processed data caching
- Metadata caching for repeated queries

## Troubleshooting

### Common Issues

1. **API Authentication Failures**
   - Verify API keys are set correctly
   - Check network connectivity
   - Review API quota limits

2. **Data Download Errors**
   - Check spatial/temporal constraints
   - Verify cloud coverage thresholds
   - Review available data products

3. **Processing Memory Issues**
   - Reduce batch size
   - Enable chunked processing
   - Increase available memory

4. **Database Lock Issues**
   - Check for concurrent access
   - Verify write permissions
   - Restart database connections

### Debug Mode

Enable debug logging:
```bash
python main.py --debug [command]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review log files
3. Create an issue on the repository
4. Contact the development team

## Future Enhancements

- Additional satellite platforms (MODIS, Landsat 1-7)
- Machine learning integration for improved classification
- Real-time processing capabilities
- Web interface for non-technical users
- Advanced visualization tools
- Cloud deployment options