# Quick Start Guide

Get the Watershed Disturbance Mapping API up and running in minutes!

## Prerequisites

- **Node.js** 18 or higher
- **PostgreSQL** 12 or higher
- **npm** 9 or higher

## Option 1: Automated Setup (Recommended)

```bash
# Make the start script executable
chmod +x start.sh

# Run full setup
./start.sh setup

# Start development server
./start.sh dev
```

The setup script will:
1. ✅ Check Node.js and npm versions
2. 📦 Install all dependencies
3. ⚙️ Create environment configuration
4. 🗄️ Initialize database tables
5. 👤 Create admin user
6. 📚 Generate API documentation
7. 🔍 Run code quality checks

## Option 2: Manual Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your settings:
# - Database connection details
# - JWT secret (generate a secure random string)
# - Other configuration as needed
```

### 3. Initialize Database
```bash
# Create database tables
npm run db:init

# Create admin user
npm run db:admin

# (Optional) Add sample data
npm run db:seed
```

### 4. Start Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## Quick Test

Once the server is running, test it:

### Health Check
```bash
curl http://localhost:5000/health
```

### API Documentation
Open in browser: http://localhost:5000/api-docs

### Login as Admin
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@watershedmapping.com",
    "password": "AdminPassword123!"
  }'
```

## Default Admin Credentials

- **Email:** admin@watershedmapping.com
- **Password:** AdminPassword123!

⚠️ **Important:** Change the admin password immediately after first login!

## Available Scripts

```bash
# Development
npm run dev                    # Start with auto-reload
npm start                      # Production mode

# Database Management
npm run db:init               # Initialize database
npm run db:reset              # Reset database (deletes all data)
npm run db:seed               # Add sample data
npm run db:admin              # Create admin user
npm run db:setup              # Full database setup

# Quality & Documentation
npm run lint                  # Run code quality checks
npm run lint:fix              # Fix linting issues
npm run generate-docs         # Generate API documentation

# Testing
npm test                      # Run tests
npm run test:watch            # Run tests in watch mode
```

## Common Issues

### Database Connection Error
- Check PostgreSQL is running
- Verify database credentials in `.env`
- Ensure database exists: `createdb watershed_mapping`

### Port Already in Use
```bash
# Find process using port 5000
lsof -i :5000

# Kill the process (replace PID with actual process ID)
kill -9 PID
```

### Permission Denied (Linux/Mac)
```bash
chmod +x start.sh
```

### Node Version Issues
```bash
# Check Node.js version
node -v

# Use nvm to switch versions (if installed)
nvm use 18
```

## Next Steps

1. **Create Your First Watershed**
   ```bash
   curl -X POST http://localhost:5000/api/watersheds \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Watershed",
       "code": "TEST_001",
       "description": "A test watershed",
       "area": 100.5
     }'
   ```

2. **Upload Satellite Data**
   ```bash
   curl -X POST http://localhost:5000/api/spatial/upload \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -F "spatialData=@path/to/file.geojson" \
     -F "watershedId=YOUR_WATERSHED_ID"
   ```

3. **Create Change Detection**
   ```bash
   curl -X POST http://localhost:5000/api/change-detection \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Change Detection",
       "watershedId": "YOUR_WATERSHED_ID",
       "baselineImageId": "BASELINE_IMAGE_ID",
       "comparisonImageId": "COMPARISON_IMAGE_ID",
       "algorithm": "ndvi_difference"
     }'
   ```

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production` in `.env`
2. Use a production database (not SQLite)
3. Set a secure JWT secret
4. Use HTTPS
5. Consider using PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start server.js --name watershed-api
   ```

## Need Help?

- 📖 **API Documentation:** http://localhost:5000/api-docs
- 🏥 **Health Check:** http://localhost:5000/health
- 📁 **Full README:** See README.md for comprehensive documentation
- 🐛 **Issues:** Check the logs in the `logs/` directory

---

**Happy mapping!** 🗺️
