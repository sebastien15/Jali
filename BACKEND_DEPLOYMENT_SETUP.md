# Jali Backend - GitHub Workflows & Deployment Setup

## Overview

This guide covers the complete setup for automated backend deployment to `api.jali.rw`.

---

## Part 1: GitHub Repository Secrets Setup

You need to add these secrets to your GitHub repository:

**Go to:** `GitHub Repo → Settings → Secrets and variables → Actions → New repository secret`

### Required Secrets:

| Secret Name | Description | Example |
|---|---|---|
| `SSH_HOST` | Your cPanel server IP or hostname | `192.168.1.100` or `server.cpanel.com` |
| `SSH_USERNAME` | SSH username for cPanel | `jaliuser` or `jali` |
| `SSH_PORT` | SSH port (default: 22) | `22` |
| `SSH_PRIVATE_KEY` | SSH private key for passwordless login | Full content of your private key file |
| `SSH_DEPLOY_PATH` | Path on server where backend lives | `/home/sebastien/api.jali.stoka.rw/backend` |
| `DB_PASSWORD` | MySQL password | (your MySQL password) |
| `APP_KEY` | Laravel app key (32 chars) | `base64:xxxxxxxxxxxxxxxxxxxxxxxx` |

### How to generate APP_KEY:
```bash
# Run locally or on server:
php -r "echo 'base64:'.base64_encode(random_bytes(32));"
```

---

## Part 2: SSH Key Setup

### Option A: Create New SSH Key

**On your local machine:**
```bash
ssh-keygen -t rsa -b 4096 -C "github-actions@jali.rw" -f ~/.ssh/jali_github -N ""
```

**Add public key to cPanel:**
1. Login to cPanel → SSH Access → Manage SSH Keys → Import Key
2. Or paste the public key content to `~/.ssh/authorized_keys`
3. Name: `github-actions`

**Add private key to GitHub:**
```bash
cat ~/.ssh/jali_github
```
Copy the entire content and paste it as `SSH_PRIVATE_KEY` secret.

---

## Part 3: cPanel MySQL Database Setup

### Step 1: Create Database
1. Login to cPanel
2. Go to **MySQL® Databases**
3. Under "Create New Database":
   - Database name: `jali` (or `jali_db`)
   - Click "Create Database"

### Step 2: Create Database User
1. Under "MySQL Users: Add New User":
   - Username: `jali_user`
   - Password: (generate a strong password, save it!)
   - Click "Create User"

### Step 3: Add User to Database
1. Under "Add User to Database":
   - Select User: `jali_user`
   - Select Database: `jali` or `jali_db`
   - Click "Add"
2. Grant **ALL PRIVILEGES**

### Step 4: Note Your Credentials
You'll need these for GitHub secrets:
- DB Host: `127.0.0.1` or `localhost`
- DB Name: `jali_db` (might have cPanel prefix like `username_jali_db`)
- DB User: `jali_user` (might have prefix like `username_jali_user`)
- DB Password: (the one you created)

---

## Part 4: Server Setup (cPanel)

### Step 1: Create Backend Directory
```bash
# Via SSH to your server:
mkdir -p /home/YOUR_CPANEL_USER/api.jali.rw/backend
mkdir -p /home/YOUR_CPANEL_USER/api.jali.rw/.scripts
```

### Step 2: Copy Deployment Script
```bash
# Copy the deploy script to server:
scp .scripts/deploy-prod.sh YOUR_USER@YOUR_SERVER:/home/YOUR_CPANEL_USER/api.jali.rw/.scripts/

# Make it executable:
chmod +x /home/YOUR_CPANEL_USER/api.jali.rw/.scripts/deploy-prod.sh
```

### Step 3: Upload Firebase Credentials
```bash
# Create directory on server:
mkdir -p /home/YOUR_CPANEL_USER/api.jali.rw/backend/storage/app

# Upload your firebase-credentials.json file
scp firebase-credentials.json YOUR_USER@YOUR_SERVER:/home/YOUR_CPANEL_USER/api.jali.rw/backend/storage/app/
```

### Step 4: Set Proper Permissions
```bash
cd /home/YOUR_CPANEL_USER/api.jali.rw/backend
chmod -R 755 storage bootstrap/cache
```

---

## Part 5: cPanel Domain Setup

### Step 1: Add Domain
1. Login to cPanel
2. Go to **Domains** or **Addon Domains**
3. Add domain: `api.jali.rw`
4. Document root: `/home/YOUR_CPANEL_USER/api.jali.rw/backend/public`

### Step 2: Enable SSL
1. Go to **Let's Encrypt SSL** or **AutoSSL** in cPanel
2. Select `api.jali.rw`
3. Click "Issue" or "Run AutoSSL"

### Step 3: Configure PHP
1. Go to **Select PHP Version** or **MultiPHP Manager**
2. Select domain `api.jali.rw`
3. Set PHP version to **8.2** or **8.3**
4. Enable extensions: `pdo_mysql`, `mbstring`, `openssl`, `curl`, `zip`, `bcmath`

---

## Part 6: How the Workflows Work

### Workflow 1: `deploy-backend.yml`
**Trigger:** Push to `main` branch (only when backend files change)

**What it does:**
1. Checks out code
2. Installs PHP dependencies (production mode)
3. Creates `.env` file with production credentials
4. Runs database migrations
5. Caches Laravel configuration
6. Copies files to server via SCP
7. Runs deployment script on server
8. Restarts PHP-FPM

### Workflow 2: `backend-tests.yml`
**Trigger:** Push/pull request to `main` or `develop`

**What it does:**
1. Sets up PHP environment
2. Installs dependencies
3. Runs PHPUnit tests

---

## Part 7: First Deployment

### Before your first deploy:

1. ✅ Add all GitHub secrets (Part 1)
2. ✅ Create MySQL database (Part 3)
3. ✅ Setup SSH access (Part 2)
4. ✅ Upload Firebase credentials (Part 4, Step 3)
5. ✅ Configure cPanel domain (Part 5)

### Then deploy:
```bash
# On your local machine, in the Jali project:
git add .
git commit -m "Setup backend deployment workflows"
git push origin main
```

The workflow will automatically deploy on push to `main`.

### Or trigger manually:
1. Go to GitHub repo → Actions
2. Click "Deploy Backend to Production"
3. Click "Run workflow" → select `main` branch

---

## Part 8: Testing the API

After deployment, test your API:

```bash
# Test basic connectivity:
curl https://api.jali.rw

# Test API routes:
curl https://api.jali.rw/api/buses

# Check if Laravel is running:
curl -I https://api.jali.rw
```

---

## Troubleshooting

### Deployment fails at SSH step:
- Verify SSH credentials and key format
- Ensure key has no passphrase
- Check that cPanel allows SSH access

### Database migration fails:
- Check MySQL credentials in cPanel
- Verify database exists
- Check user has ALL PRIVILEGES

### Permission denied errors:
```bash
# On server:
cd /home/YOUR_USER/api.jali.rw/backend
chmod -R 755 storage bootstrap/cache
chown -R YOUR_USER:YOUR_USER storage bootstrap/cache
```

### Can't access API:
- Verify domain points to correct directory
- Check SSL is active
- Ensure Nginx/Apache config points to `public/` folder

---

## Files Created

```
.github/workflows/
├── deploy-backend.yml        # Production deployment workflow
└── backend-tests.yml         # Automated test runner

.scripts/
└── deploy-prod.sh            # Server deployment script

backend/
└── .env.example              # Updated with MySQL config
```

---

## Next Steps

After everything is working:
1. Test API endpoints from your mobile app
2. Monitor deployment logs in GitHub Actions
3. Set up error monitoring (Sentry, LogRocket, etc.)
4. Consider adding test environment when ready
