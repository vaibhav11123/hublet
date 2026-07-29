#!/bin/bash

echo "🚀 Setting up Hublet - Real Estate Lead Matching Platform"
echo "=========================================================="
echo ""

# Check if PostgreSQL is running
if ! command -v psql &> /dev/null
then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL first."
    exit 1
fi

echo "✅ PostgreSQL found"
echo ""

# Backend setup
echo "📦 Setting up Backend..."
cd backend || exit

if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit backend/.env and set your DATABASE_URL"
    echo "   Example: DATABASE_URL=\"postgresql://user:password@localhost:5432/hublet?schema=public\""
    echo ""
fi

echo "📥 Installing backend dependencies..."
npm install

echo "🔧 Generating Prisma client..."
npm run prisma:generate

echo "🗄️  Running database migrations..."
echo "   Make sure your DATABASE_URL in .env is correct!"
npm run prisma:migrate

cd ..

# Frontend setup
echo ""
echo "📦 Setting up Frontend..."
cd frontend || exit

echo "📥 Installing frontend dependencies..."
npm install

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the application:"
echo "1. Terminal 1: cd backend && npm run dev"
echo "2. Terminal 2: cd frontend && npm run dev"
echo ""
echo "Then open http://localhost:5173 in your browser"
echo ""
