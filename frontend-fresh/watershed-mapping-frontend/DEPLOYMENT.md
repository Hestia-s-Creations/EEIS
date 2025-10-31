# Watershed Disturbance Mapping System - Deployment Guide

## Overview
This is a production-ready React.js frontend for the Watershed Disturbance Mapping System. The application provides an interactive web interface for watershed analysis, monitoring, and management with real-time data visualization.

**🌐 Live Application:** https://o6fsxpgs99e5.space.minimax.io

## Features Implemented

### ✅ Core Functionality
- **Interactive Mapping**: Full Leaflet integration with watershed boundaries, satellite imagery controls, and change detection
- **Real-Time Analytics**: Chart.js integration for time-series data, health metrics, and trend analysis  
- **Alert Management**: Live alert monitoring with priority-based categorization and real-time updates
- **Watershed Management**: CRUD operations for watershed boundaries and health monitoring
- **User Authentication**: Role-based access control with JWT tokens
- **Responsive Design**: Mobile-first design using Tailwind CSS and Radix UI components

### ✅ Dashboard Components
- **System Status**: Real-time monitoring of API, database, and satellite services
- **Recent Activity**: Live feed of system events and user actions
- **Watershed Overview**: Health score analytics and status breakdown
- **Alert Summary**: Priority-based alert categorization and recent alerts

### ✅ Technical Architecture
- **React 18.3.1** with TypeScript for type-safe development
- **Redux Toolkit** for state management with 5 slices (auth, watershed, map, alert, analytics)
- **React Router** for client-side routing and protected routes
- **Axios** for REST API integration with comprehensive error handling
- **Date-fns** for date formatting and relative time display
- **Framer Motion** for smooth animations and micro-interactions

## API Integration

### Backend Requirements
The frontend expects a REST API with the following endpoints:

#### Authentication Endpoints
```bash
POST /api/auth/login - User authentication
POST /api/auth/register - User registration  
GET /api/auth/me - Get current user profile
PUT /api/auth/profile - Update user profile
PUT /api/auth/change-password - Change password
POST /api/auth/refresh - Refresh JWT token
```

#### Watershed Endpoints
```bash
GET /api/watersheds - List watersheds with pagination
POST /api/watersheds - Create new watershed
GET /api/watersheds/:id - Get watershed details
PUT /api/watersheds/:id - Update watershed
DELETE /api/watersheds/:id - Delete watershed
```

#### Map Service Endpoints
```bash
GET /api/map/layers - Get available map layers
POST /api/map/satellite - Request satellite imagery
POST /api/map/change-detection - Request change detection analysis
GET /api/map/change-detection/:taskId - Get change detection results
POST /api/map/export - Export map data
```

#### Alert System Endpoints
```bash
GET /api/alerts - List alerts with pagination
POST /api/alerts - Create alert rule
PUT /api/alerts/:id/acknowledge - Acknowledge alert
PUT /api/alerts/:id/resolve - Resolve alert
GET /api/alerts/stats - Get alert statistics
```

#### Analytics Endpoints
```bash
GET /api/analytics/trends - Get trend data
GET /api/analytics/health-scores - Get health score metrics
GET /api/analytics/real-time-metrics - Get system real-time metrics
POST /api/analytics/reports - Generate analytics reports
```

### Environment Configuration
Create a `.env` file with your backend API URL:

```env
VITE_API_BASE_URL=https://your-backend-api.com/api
VITE_APP_NAME=Watershed Mapping System
VITE_APP_VERSION=1.0.0
```

## Development Setup

### Prerequisites
- Node.js 18+ and pnpm
- Modern web browser with ES2020+ support

### Local Development
```bash
# Clone and install dependencies
cd watershed-mapping-frontend
pnpm install

# Start development server
pnpm run dev
```

### Production Build
```bash
# Build for production
pnpm run build

# Preview production build
pnpm run preview
```

## Testing Guide

### Manual Testing Checklist

#### ✅ Authentication Flow
1. **Registration**: Test new user registration with email/password
2. **Login**: Verify JWT token authentication and session management
3. **Profile**: Test profile updates and password changes
4. **Protected Routes**: Verify access control and role-based permissions

#### ✅ Dashboard Functionality  
1. **System Status**: Verify real-time metrics display and service health
2. **Recent Activity**: Check activity feed updates and chronological sorting
3. **Watershed Overview**: Test health score calculations and status breakdowns
4. **Alert Summary**: Verify alert categorization and priority sorting

#### ✅ Interactive Map
1. **Leaflet Integration**: Test map rendering, zoom, and pan functionality
2. **Watershed Boundaries**: Verify GeoJSON rendering with health-based coloring
3. **Satellite Controls**: Test date picker and imagery loading
4. **Change Detection**: Verify algorithm selection and threshold controls
5. **Layer Toggles**: Test visibility controls for different map layers

#### ✅ Analytics & Charts
1. **Time Series Charts**: Verify data visualization and chart interactions
2. **Health Score Trends**: Test trend analysis and percentage calculations  
3. **Export Functionality**: Test data export in multiple formats
4. **Real-time Updates**: Verify live data refresh and auto-refresh

#### ✅ Alert Management
1. **Alert Creation**: Test new alert rule creation and validation
2. **Priority Classification**: Verify critical/high/medium/low categorization
3. **Status Updates**: Test acknowledge and resolve workflows
4. **Real-time Notifications**: Check live alert updates and push notifications

### API Testing with cURL

Test backend connectivity:

```bash
# Health check
curl -X GET https://your-backend-api.com/api/health

# Test authentication
curl -X POST https://your-backend-api.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Test watersheds endpoint
curl -X GET https://your-backend-api.com/api/watersheds \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test analytics endpoints
curl -X GET https://your-backend-api.com/api/analytics/trends \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Deployment

### Current Deployment
- **URL**: https://o6fsxpgs99e5.space.minimax.io
- **Status**: ✅ Deployed and accessible
- **Type**: Static hosting (Vite build output)

### Production Deployment Options

#### Option 1: Static Hosting (Recommended)
Deploy the `dist` folder to any static hosting service:
- **Vercel**: `vercel --prod dist`
- **Netlify**: Drag & drop `dist` folder to Netlify
- **AWS S3**: Upload `dist` contents to S3 bucket with static hosting
- **GitHub Pages**: Push `dist` to `gh-pages` branch

#### Option 2: Container Deployment
```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN pnpm install
COPY . .
RUN pnpm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Security Considerations
- Ensure backend API uses HTTPS in production
- Configure CORS properly for your domain
- Set up proper CSP headers for security
- Use environment variables for sensitive configuration

## Troubleshooting

### Common Issues

#### API Connection Errors
```
Error: Network Error / Failed to fetch
```
**Solution**: 
- Verify backend API is running and accessible
- Check CORS configuration
- Confirm API_BASE_URL environment variable

#### Leaflet Map Not Loading
```
Error: Cannot find module 'leaflet'
```
**Solution**:
- Clear node_modules and reinstall: `rm -rf node_modules && pnpm install`
- Ensure Leaflet CSS is imported: `import 'leaflet/dist/leaflet.css'`

#### Redux State Issues
```
Error: Cannot read property 'length' of undefined
```
**Solution**:
- Check Redux slice initial states
- Verify API response data structure matches frontend expectations
- Add proper loading states and error handling

### Performance Optimization
- Enable gzip compression on your hosting platform
- Configure CDN for static assets
- Implement lazy loading for chart components
- Optimize images and use WebP format

## Support & Maintenance

### Monitoring
- Set up error tracking (Sentry, LogRocket)
- Monitor API response times and uptime
- Track user interactions and feature usage
- Set up automated testing pipeline

### Updates
- Keep dependencies updated: `pnpm update`
- Regular security audits: `pnpm audit`
- Performance monitoring and optimization
- Feature additions based on user feedback

---

**Deployment Date**: 2025-10-30  
**Version**: 1.0.0  
**Author**: MiniMax Agent  
**Status**: Production Ready ✅