# Stack: Infrastructure (cPanel + LiteSpeed + MySQL + Redis)
> Server-level configuration for jali.stoka.rw on cPanel VPS.
> This file covers: server config, CDN, Redis, queues, DB tuning, scaling path.

---

## Current Setup

- Host: `jali.stoka.rw` on cPanel VPS (LiteSpeed web server)
- Server path: `/home2/seba/jali.stoka.rw/`
- Document root: `backend/public/` (or should be — see deployment.md)
- PHP: 8.3 via cPanel EasyApache
- DB: MySQL (prod), SQLite (dev)
- Queue: should be Redis (see below)

---

## Realistic Capacity on cPanel VPS

| Resource | VPS (4–8 vCPU) |
|---|---|
| Concurrent PHP workers | ~100–300 |
| MySQL connections | ~100–500 |

**Key insight:** 5,000–10,000 concurrent users is only achievable if most requests are served by cache, CDN, or static files — not by PHP. The goal is to make PHP handle as few requests as possible.

---

## OPcache — Enable First (40–60% PHP Speed Gain)

The single most impactful PHP setting. Via cPanel → PHP Configuration:
```ini
opcache.enable = 1
opcache.memory_consumption = 256
opcache.interned_strings_buffer = 16
opcache.max_accelerated_files = 20000
opcache.revalidate_freq = 0        ; never revalidate — restart PHP-FPM to clear
opcache.validate_timestamps = 0    ; disable in production
opcache.fast_shutdown = 1
```

---

## Redis — Required in Production

Without Redis: cache goes to disk files (slow, no atomic operations, no pub/sub).
With Redis: cache, sessions, and queues all run in-memory at microsecond speed.

Install via WHM Terminal:
```bash
yum install redis
systemctl enable redis && systemctl start redis
# Then: cPanel EasyApache → PHP Extensions → enable php-redis
```

Set in backend `.env` (production):
```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
```

---

## Queue Workers (Background Jobs)

cPanel doesn't support persistent processes natively. Use cron to keep a worker alive:

```bash
# cPanel → Cron Jobs → Every minute:
* * * * * cd /home2/seba/jali.stoka.rw/backend && php artisan queue:work redis --sleep=3 --tries=3 --max-time=3600 --quiet >> /dev/null 2>&1
```

If SSH root access is available, use Supervisor instead (more reliable):
```ini
; /etc/supervisor/conf.d/jali-worker.conf
[program:jali-worker]
command=php /home2/seba/jali.stoka.rw/backend/artisan queue:work redis --sleep=3 --tries=3
autostart=true
autorestart=true
numprocs=4          ; 4 parallel workers
redirect_stderr=true
stdout_logfile=/home2/seba/logs/worker.log
```

---

## Cloudflare — Free Tier (Do This Before Anything Else)

Cloudflare is the single best upgrade for cPanel hosting:
- CDN caches static responses globally (API JSON, images)
- Free DDoS protection
- Free GZIP/Brotli compression
- Free HTTP/2 and HTTP/3

**Setup:** Route domain DNS through Cloudflare (orange cloud = proxied)

**Settings to enable:**
- Auto Minify → HTML, CSS, JS
- Brotli → ON
- Caching Level → Standard
- Browser Cache TTL → 1 year

**Page Rules:**
| URL Pattern | Setting |
|---|---|
| `jali.stoka.rw/api/*` | Cache Level: Bypass (never cache API responses at CDN) |
| `jali.stoka.rw/storage/*` | Cache Level: Cache Everything, Edge TTL: 1 week |

API responses are handled by Laravel's own Cache-Control headers + Redis — not Cloudflare caching.

---

## LiteSpeed Configuration

LiteSpeed (running on this server) is significantly faster than Apache for PHP. Leverage it:

```php
// app/Http/Middleware/LiteSpeedCache.php
// Add X-LiteSpeed-Cache-Control for GET 200 responses on public endpoints
$response->headers->set("X-LiteSpeed-Cache-Control", "public, max-age=3600");
```

Enable HTTP/2 (allows parallel requests over one connection):
In WHM → Apache/LiteSpeed Configuration → enable `Protocols h2 http/1.1`

GZIP compression for JSON (in `backend/public/.htaccess`):
```apache
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE application/json
  AddOutputFilterByType DEFLATE text/html text/css application/javascript
</IfModule>

# Browser caching for static assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType font/woff2 "access plus 1 year"
</IfModule>
```

---

## MySQL Configuration Tuning

Via WHM → MySQL Configuration (if available):
```ini
[mysqld]
innodb_buffer_pool_size = 1G   ; 70% of DB-dedicated RAM
max_connections = 300
thread_cache_size = 50
slow_query_log = 1
long_query_time = 1            ; log queries slower than 1 second
slow_query_log_file = /var/log/mysql/slow.log
```

Check for slow queries regularly:
```sql
EXPLAIN SELECT * FROM bookings WHERE user_id = 1 AND status = 'pending';
-- type = "ALL" means full table scan → add index
```

---

## Scaling Path (When cPanel Hits Its Ceiling)

```
Phase 1 (0–5k users)      → cPanel VPS + Cloudflare + Redis        ← YOU ARE HERE
Phase 2 (5k–20k users)    → DigitalOcean/Hetzner managed server
                             Separate DB server + Redis server
Phase 3 (20k–100k users)  → Docker Swarm or Kubernetes
                             HAProxy load balancer
                             Horizontal PHP-FPM scaling
Phase 4 (100k+ users)     → AWS ECS or GCP Cloud Run
                             Aurora RDS + ElastiCache
```

For Phase 2 (when needed): consider replacing cPanel with **RunCloud** or **ServerPilot** — same web-based management, but with Nginx + built-in Redis/Supervisor, zero control panel overhead.

---

## Quick Wins — Priority Order

Deploy these in order (highest impact first):

- [ ] Enable OPcache via cPanel PHP Configuration
- [ ] Set `APP_DEBUG=false` in production `.env`
- [ ] Run `php artisan optimize` on every deploy
- [ ] Install Redis + set `CACHE_DRIVER=redis`
- [ ] Set up Cloudflare (free tier) — CDN + GZIP + DDoS
- [ ] Enable GZIP for `application/json` in `.htaccess`
- [ ] Set up queue worker via cPanel cron
- [ ] Enable slow query log + add missing indexes
- [ ] Install Laravel Pulse for production monitoring
- [ ] Add Sentry for error tracking (`composer require sentry/sentry-laravel`)
