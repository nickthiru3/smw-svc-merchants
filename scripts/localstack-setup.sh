#!/bin/bash

# LocalStack Setup Script for Super Deals Microservice
# This script sets up LocalStack for local AWS development

set -e

echo "🐳 Setting up LocalStack for Super Deals Microservice..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    print_status "Checking Docker..."
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Check if docker-compose is available
check_docker_compose() {
    print_status "Checking docker-compose..."
    if ! command -v docker-compose &> /dev/null; then
        print_error "docker-compose is not installed. Please install docker-compose and try again."
        exit 1
    fi
    print_success "docker-compose is available"
}

# Start LocalStack
start_localstack() {
    print_status "Starting LocalStack..."
    
    # Stop any existing LocalStack containers
    docker-compose -f docker-compose.localstack.yml down > /dev/null 2>&1 || true
    
    # Start LocalStack
    docker-compose -f docker-compose.localstack.yml up -d
    
    print_success "LocalStack container started"
}

# Wait for LocalStack to be ready
wait_for_localstack() {
    print_status "Waiting for LocalStack to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:4566/health > /dev/null 2>&1; then
            print_success "LocalStack is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    print_error "LocalStack failed to start within expected time"
    exit 1
}

# Configure AWS CLI for LocalStack
configure_aws_cli() {
    print_status "Configuring AWS CLI for LocalStack..."
    
    # Create LocalStack profile
    aws configure set aws_access_key_id test --profile localstack
    aws configure set aws_secret_access_key test --profile localstack
    aws configure set region us-east-1 --profile localstack
    aws configure set output json --profile localstack
    
    print_success "AWS CLI configured for LocalStack"
}

# Install cdklocal if not present
install_cdklocal() {
    print_status "Checking cdklocal installation..."
    
    if ! command -v cdklocal &> /dev/null; then
        print_status "Installing cdklocal..."
        npm install -g aws-cdk-local
        print_success "cdklocal installed"
    else
        print_success "cdklocal is already installed"
    fi
}

# Test LocalStack services
test_localstack_services() {
    print_status "Testing LocalStack services..."
    
    # Test S3
    aws --endpoint-url=http://localhost:4566 s3 mb s3://test-bucket --profile localstack > /dev/null 2>&1
    aws --endpoint-url=http://localhost:4566 s3 ls --profile localstack | grep test-bucket > /dev/null
    print_success "S3 service is working"
    
    # Test DynamoDB
    aws --endpoint-url=http://localhost:4566 dynamodb list-tables --profile localstack > /dev/null 2>&1
    print_success "DynamoDB service is working"
    
    # Clean up test resources
    aws --endpoint-url=http://localhost:4566 s3 rb s3://test-bucket --profile localstack > /dev/null 2>&1
}

# Display LocalStack information
display_info() {
    echo ""
    echo "🎉 LocalStack setup complete!"
    echo ""
    echo "📋 LocalStack Information:"
    echo "  • Gateway URL: http://localhost:4566"
    echo "  • Health Check: curl http://localhost:4566/health"
    echo "  • AWS Profile: localstack"
    echo ""
    echo "🚀 Next Steps:"
    echo "  1. Deploy your CDK stack: npm run deploy:localstack"
    echo "  2. Run your application: npm run dev:localstack"
    echo "  3. View LocalStack logs: docker-compose -f docker-compose.localstack.yml logs -f"
    echo ""
    echo "🛠️  Useful Commands:"
    echo "  • Stop LocalStack: npm run localstack:stop"
    echo "  • Restart LocalStack: npm run localstack:restart"
    echo "  • View LocalStack status: npm run localstack:status"
    echo ""
}

# Main execution
main() {
    echo "🏗️  Super Deals Microservice - LocalStack Setup"
    echo "=============================================="
    echo ""
    
    check_docker
    check_docker_compose
    install_cdklocal
    start_localstack
    wait_for_localstack
    configure_aws_cli
    test_localstack_services
    display_info
}

# Run main function
main "$@"
