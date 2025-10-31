#!/bin/bash

# Watershed Disturbance Mapping API - Setup and Start Script

set -e

echo "================================"
echo "Watershed Disturbance Mapping API"
echo "Setup and Start Script"
echo "================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt "18" ]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
        exit 1
    fi
    
    print_status "Node.js $(node -v) is installed"
}

# Check if npm is installed
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    NPM_VERSION=$(npm -v)
    print_status "npm $NPM_VERSION is installed"
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    if [ ! -d "node_modules" ]; then
        print_status "Installing npm packages..."
        npm install
        print_status "Dependencies installed successfully"
    else
        print_status "Dependencies already installed"
    fi
}

# Setup environment file
setup_env() {
    print_header "Environment Configuration"
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            print_status "Creating .env file from .env.example..."
            cp .env.example .env
            print_warning "Please update the .env file with your configuration"
            print_warning "  - Set your database credentials"
            print_warning "  - Change JWT_SECRET to a secure random string"
        else
            print_error ".env.example file not found"
            exit 1
        fi
    else
        print_status ".env file already exists"
    fi
}

# Check database connectivity
check_database() {
    print_header "Database Check"
    
    # Check if PostgreSQL is running (optional)
    if command -v pg_isready &> /dev/null; then
        if pg_isready -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} > /dev/null 2>&1; then
            print_status "PostgreSQL is running"
        else
            print_warning "PostgreSQL may not be running on ${DB_HOST:-localhost}:${DB_PORT:-5432}"
        fi
    else
        print_warning "pg_isready not available, skipping PostgreSQL check"
    fi
}

# Initialize database
init_database() {
    print_header "Database Initialization"
    
    print_status "Creating database tables..."
    npm run db:init
    
    # Create admin user
    print_status "Creating admin user..."
    npm run db:admin
    
    # Optionally seed with sample data
    read -p "Do you want to seed the database with sample data? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Seeding database with sample data..."
        npm run db:seed
    fi
}

# Lint code
lint_code() {
    print_header "Code Quality Check"
    
    print_status "Running ESLint..."
    npm run lint
    if [ $? -eq 0 ]; then
        print_status "Code linting passed"
    else
        print_warning "Code linting found issues"
    fi
}

# Generate API documentation
generate_docs() {
    print_header "API Documentation"
    
    print_status "Generating API documentation..."
    npm run generate-docs
    print_status "API documentation generated"
}

# Start the server
start_server() {
    print_header "Starting Server"
    
    if [ "$1" == "dev" ]; then
        print_status "Starting development server with auto-reload..."
        npm run dev
    else
        print_status "Starting production server..."
        npm start
    fi
}

# Show help
show_help() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  setup     Full setup (install, configure, database, docs)"
    echo "  install   Install dependencies only"
    echo "  configure Setup environment configuration"
    echo "  database  Initialize database and create admin user"
    echo "  lint      Run code quality checks"
    echo "  docs      Generate API documentation"
    echo "  dev       Start development server"
    echo "  start     Start production server"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup"
    echo "  $0 dev"
    echo "  $0 database"
}

# Main script logic
main() {
    cd "$(dirname "$0")" || exit 1
    
    case "$1" in
        "setup")
            check_node
            check_npm
            install_dependencies
            setup_env
            generate_docs
            init_database
            lint_code
            print_header "Setup Complete!"
            echo ""
            print_status "API server is ready!"
            print_status "API Documentation: http://localhost:5000/api-docs"
            print_status "Health Check: http://localhost:5000/health"
            echo ""
            print_warning "Default admin credentials:"
            echo "  Email: admin@watershedmapping.com"
            echo "  Password: AdminPassword123!"
            print_warning "Please change the admin password after first login!"
            ;;
        "install")
            check_node
            check_npm
            install_dependencies
            ;;
        "configure")
            setup_env
            ;;
        "database")
            check_node
            install_dependencies
            init_database
            ;;
        "lint")
            check_node
            lint_code
            ;;
        "docs")
            check_node
            generate_docs
            ;;
        "dev")
            check_node
            check_npm
            check_database
            start_server "dev"
            ;;
        "start")
            check_node
            check_npm
            check_database
            start_server
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        "")
            print_error "No command specified"
            show_help
            exit 1
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
