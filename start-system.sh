#!/bin/bash

# Watershed Disturbance Mapping System - Quick Start Script
# This script will set up the complete system for testing

set -e

echo "🚀 Starting Watershed Disturbance Mapping System..."
echo "=================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p quick-start/logs

# Build and start services
echo "🔧 Building and starting services..."
cd quick-start

# Build the API server image
echo "🏗️  Building API server..."
docker build -t watershed-api ../api_server

# Start the services
echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check if services are running
echo "🔍 Checking service status..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services started successfully!"
    
    echo ""
    echo "🎉 Watershed Mapping System is ready!"
    echo "======================================"
    echo ""
    echo "📱 Frontend (React): http://localhost:3000"
    echo "🔗 API Server: http://localhost:5000"
    echo "🗄️  Database: localhost:5432"
    echo ""
    echo "🔐 Default Login Credentials:"
    echo "   Email: admin@watershedmapping.com"
    echo "   Password: AdminPassword123!"
    echo ""
    echo "📚 API Documentation: http://localhost:5000/api-docs"
    echo "❤️  Health Check: http://localhost:5000/api/health"
    echo ""
    echo "🛑 To stop: docker-compose down"
    echo "📋 View logs: docker-compose logs -f"
    echo ""
    
    # Test the health endpoint
    echo "🧪 Testing API health..."
    sleep 10
    if curl -s http://localhost:5000/api/health | grep -q "status"; then
        echo "✅ API is responding correctly!"
    else
        echo "⚠️  API might still be starting up. Please wait a moment and try again."
    fi
    
else
    echo "❌ Failed to start services. Check logs with: docker-compose logs"
    exit 1
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Login with the credentials above"
echo "3. Explore the watershed mapping features"
echo "4. When done, run 'docker-compose down' to stop"
echo ""
echo "Happy mapping! 🗺️"