#!/bin/bash
set -e

echo "🚀 Setting up Super Deals - Deals Microservice..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or later and try again."
    exit 1
fi

# Check for AWS CLI
if ! command -v aws &> /dev/null; then
    echo "⚠️  AWS CLI is not installed. Some deployment commands may not work."
    read -p "Would you like to install AWS CLI? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 Installing AWS CLI..."
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip awscliv2.zip
        sudo ./aws/install
        rm -rf awscliv2.zip aws/
    fi
fi

# Install dependencies
echo "📦 Installing project dependencies..."
npm install

# Set up environment file
if [ ! -f .env ]; then
    echo "🔧 Creating .env file from example..."
    cp .env.example .env
    echo "ℹ️  Please update the .env file with your configuration"
else
    echo "✅ .env file already exists"
fi

# Install git hooks
echo "🔧 Setting up Git hooks..."
npx husky install

# Verify AWS configuration
echo "🔍 Verifying AWS configuration..."
if aws sts get-caller-identity &> /dev/null; then
    echo "✅ AWS CLI is configured"
else
    echo "⚠️  AWS CLI is not configured. Run 'aws configure' to set up your credentials."
fi

echo "✨ Setup complete! You can now start developing."
echo "To start the development server, run: npm run dev"
echo "To deploy to staging: npm run deploy:staging"
echo "To deploy to production: npm run deploy:prod"
