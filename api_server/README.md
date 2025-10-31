# Watershed Disturbance Mapping System - API Server

A comprehensive Node.js/Express API server for managing watershed data, satellite imagery, and change detection analysis.

## Features

- **User Authentication & Authorization** - JWT-based auth with role-based access control
- **Watershed Management** - Complete CRUD operations for watershed data
- **Satellite Data Processing** - Management of Landsat, Sentinel-2, and MODIS data
- **Change Detection Analysis** - Multiple algorithms for land cover change analysis
- **Real-time Progress Tracking** - WebSocket-based updates for processing tasks
- **Spatial Data Processing** - Upload and processing of GeoJSON, Shapefiles, and CSV data
- **File Management** - Upload, validation, and export of various data formats
- **Security Features** - Rate limiting, input validation, and comprehensive logging
- **API Documentation** - OpenAPI/Swagger documentation with interactive UI

## Technology Stack

- **Node.js** with Express.js framework
- **PostgreSQL** with Sequelize ORM
- **Socket.IO** for real-time communication
- **JWT** for authentication
- **Multer** for file uploads
- **Winston** for logging
- **Swagger/OpenAPI** for documentation
- **Express Validator** for input validation
- **Helmet** for security headers
- **CORS** and rate limiting

## Installation

### Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- npm 9+

### Setup

1. **Clone and install dependencies**
```bash
cd api_server
npm install
```

2. **Environment Configuration**
Create a `.env` file in the root directory:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=watershed_mapping
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# API Base URL
API_BASE_URL=http://localhost:5000

# Logging
LOG_LEVEL=info
```

3. **Database Setup**
```bash
# Create PostgreSQL database
createdb watershed_mapping

# The API will automatically create tables on startup
# Or run manually:
npm run sync-db
```

4. **Start the server**
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/me` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/logout` - Logout user

### Watersheds
- `GET /api/watersheds` - List watersheds with filtering
- `GET /api/watersheds/:id` - Get watershed details
- `POST /api/watersheds` - Create watershed (Admin/Researcher)
- `PUT /api/watersheds/:id` - Update watershed (Admin/Researcher)
- `DELETE /api/watersheds/:id` - Delete watershed (Admin only)
- `GET /api/watersheds/:id/statistics` - Get watershed statistics
- `GET /api/watersheds/:id/satellite-data` - Get satellite data for watershed

### Satellite Data
- `GET /api/satellites` - List satellite data with filtering
- `GET /api/satellites/:id` - Get satellite data details
- `POST /api/satellites` - Create satellite data entry (Admin/Researcher)
- `PUT /api/satellites/:id` - Update satellite data (Admin/Researcher)
- `DELETE /api/satellites/:id` - Delete satellite data (Admin only)
- `POST /api/satellites/:id/download` - Initiate download
- `GET /api/satellites/available-scenes/:watershedId` - Get available scenes
- `GET /api/satellites/statistics/overview` - Get satellite statistics

### Change Detection
- `GET /api/change-detection` - List change detections
- `GET /api/change-detection/:id` - Get change detection details
- `POST /api/change-detection` - Create change detection (Admin/Researcher/Analyst)
- `PUT /api/change-detection/:id` - Update change detection (Admin/Researcher)
- `DELETE /api/change-detection/:id` - Delete change detection (Admin only)
- `POST /api/change-detection/:id/process` - Start processing
- `POST /api/change-detection/:id/results` - Submit results
- `GET /api/change-detection/statistics/overview` - Get change detection statistics
- `GET /api/change-detection/export/:id` - Export results

### Spatial Data
- `POST /api/spatial/upload` - Upload spatial data file
- `POST /api/spatial/validate` - Validate spatial data file
- `POST /api/spatial/process` - Process spatial data
- `GET /api/spatial/watersheds/:id/boundaries` - Get watershed boundaries
- `GET /api/spatial/watersheds/:id/intersection` - Get satellite data intersection

### Progress Tracking
- `GET /api/progress/tasks` - Get user tasks
- `GET /api/progress/tasks/:id` - Get task details
- `POST /api/progress/tasks` - Create processing task
- `PUT /api/progress/tasks/:id/progress` - Update task progress
- `POST /api/progress/tasks/:id/complete` - Mark task complete
- `POST /api/progress/tasks/:id/fail` - Mark task failed
- `POST /api/progress/tasks/:id/retry` - Retry failed task
- `GET /api/progress/statistics` - Get processing statistics
- `GET /api/progress/queue` - Get processing queue (Admin only)

## Real-time Features

The API supports real-time updates via WebSocket connections using Socket.IO.

### Connecting
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Subscribing to Updates
```javascript
// Subscribe to task progress updates
socket.emit('subscribe_task', taskId);

// Subscribe to watershed updates
socket.emit('subscribe_watershed', watershedId);
```

### Listening for Events
```javascript
socket.on('progress_update', (data) => {
  console.log('Progress:', data.progress);
});

socket.on('task_completed', (data) => {
  console.log('Task completed:', data.result);
});

socket.on('notification', (notification) => {
  console.log('New notification:', notification.message);
});
```

## File Upload

Supports uploading spatial data files:
- **GeoJSON/JSON** - Geographic data in JSON format
- **Shapefile (ZIP)** - ESRI Shapefile archives
- **CSV** - Comma-separated values
- **Excel (XLSX)** - Microsoft Excel files

Max file size: 100MB

## Data Models

### User
```javascript
{
  id: UUID,
  username: String,
  email: String,
  password: String (hashed),
  firstName: String,
  lastName: String,
  role: 'admin' | 'researcher' | 'analyst' | 'viewer',
  organization: String,
  isActive: Boolean,
  lastLogin: DateTime
}
```

### Watershed
```javascript
{
  id: UUID,
  name: String,
  code: String (unique),
  description: Text,
  area: Decimal (sq km),
  centroid: Geometry Point,
  boundaries: Geometry Polygon,
  soilType: 'clay' | 'sandy' | 'loam' | 'silt' | 'mixed',
  landUse: Object,
  status: 'active' | 'archived' | 'monitoring'
}
```

### SatelliteData
```javascript
{
  id: UUID,
  watershedId: UUID (FK),
  satellite: 'landsat8' | 'landsat9' | 'sentinel2' | 'modis',
  sensor: String,
  acquisitionDate: Date,
  cloudCover: Decimal (0-100%),
  sceneId: String,
  footprint: Geometry Polygon,
  processingStatus: 'downloading' | 'processing' | 'processed' | 'failed' | 'archived'
}
```

## Security Features

- **Rate Limiting** - 100 requests per 15 minutes per IP
- **Input Validation** - Express-validator for all inputs
- **SQL Injection Protection** - Sequelize ORM parameterized queries
- **XSS Protection** - Helmet.js security headers
- **CORS Configuration** - Configurable cross-origin policies
- **File Upload Security** - Type validation and size limits
- **Authentication** - JWT-based with automatic expiration
- **Authorization** - Role-based access control

## Monitoring & Logging

- **Request Logging** - All API requests logged with details
- **Error Tracking** - Comprehensive error logging with stack traces
- **Performance Metrics** - Response time and database query monitoring
- **Security Events** - Failed authentication and suspicious activities
- **File Storage** - Logs stored in `/logs` directory

## Database Schema

The API uses PostgreSQL with PostGIS extensions for spatial data. Tables are automatically created on startup:

- `Users` - User accounts and authentication
- `Watersheds` - Watershed geographic and metadata
- `SatelliteData` - Satellite imagery records
- `ChangeDetections` - Change analysis results
- `ProcessingTasks` - Background task tracking

## API Documentation

Interactive API documentation is available at:
- Development: `http://localhost:5000/api-docs`
- Production: `https://api.watershedmapping.com/api-docs`

## Testing

```bash
# Run tests
npm test

# Run tests with watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Development

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Generate API documentation
npm run generate-docs
```

## Production Deployment

1. **Environment Setup**
   - Set `NODE_ENV=production`
   - Configure production database
   - Set secure JWT secret
   - Configure HTTPS

2. **Database Migration**
```bash
npm run sync-db
```

3. **Start Production Server**
```bash
npm start
```

4. **Process Management**
Use PM2 for production process management:
```bash
npm install -g pm2
pm2 start server.js --name watershed-api
```

## Architecture

```
api_server/
├── config/          # Configuration files
├── controllers/     # Business logic (if separated)
├── middleware/      # Express middleware
├── models/          # Sequelize models
├── routes/          # API route definitions
├── services/        # Business services
├── utils/           # Utility functions
├── tests/           # Test files
├── docs/            # Generated documentation
├── uploads/         # File uploads
├── logs/            # Application logs
└── server.js        # Main application entry
```

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation for API changes
4. Use semantic commit messages
5. Ensure all tests pass before submitting

## License

MIT License - see LICENSE file for details.

## Support

For API support and questions:
- Documentation: `/api-docs`
- Issues: GitHub repository issues
- Email: support@watershedmapping.com
