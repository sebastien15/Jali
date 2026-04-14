#!/bin/bash

# Jali Backend Production Deployment Script
# This script runs on the server after files are deployed

set -e

echo "🚀 Starting Jali backend deployment..."

# Navigate to backend directory
cd /home2/seba/api.jali.stoka.rw/backend || exit 1

# Install PHP dependencies (production only)
echo "📦 Installing PHP dependencies..."
composer install --no-dev --optimize-autoloader --no-interaction --quiet

# Run database migrations
echo "🗄️ Running database migrations..."
php artisan migrate --force

# Clear all caches
echo "🧹 Clearing caches..."
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# Cache configurations for performance
echo "⚡ Caching configurations..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Set proper permissions
echo "🔒 Setting permissions..."
chmod -R 755 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true

# Restart PHP-FPM (if running on Ubuntu/Debian)
echo "🔄 Restarting PHP-FPM..."
sudo systemctl restart php8.3-fpm 2>/dev/null || sudo systemctl restart php-fpm 2>/dev/null || true

echo "✅ Jali backend deployment completed successfully!"
