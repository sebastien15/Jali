# Scaling React Native + Laravel on cPanel to 10,000 Concurrent Users
### A Senior Developer's Field Guide

> **Context:** cPanel hosting is shared/VPS infrastructure — not a cloud-native environment. This guide focuses on extracting maximum performance within those constraints, with honest notes on where cPanel hits its ceiling and what to do about it.

---

## Table of Contents

1. [Reality Check: cPanel's Limits](#1-reality-check-cpanels-limits)
2. [PHP & Laravel Backend Optimization](#2-php--laravel-backend-optimization)
3. [Database Optimization (MySQL)](#3-database-optimization-mysql)
4. [Caching Strategy](#4-caching-strategy)
5. [Queue Workers & Background Jobs](#5-queue-workers--background-jobs)
6. [React Native App Optimization](#6-react-native-app-optimization)
7. [Static Assets & CDN](#7-static-assets--cdn)
8. [Apache / LiteSpeed Configuration](#8-apache--litespeed-configuration)
9. [API Design for Scale](#9-api-design-for-scale)
10. [Monitoring & Observability](#10-monitoring--observability)
11. [Migration Path Beyond cPanel](#11-migration-path-beyond-cpanel)
12. [Quick Wins Checklist](#12-quick-wins-checklist)

---

## 1. Reality Check: cPanel's Limits

Before optimizing, understand what you're working with.

| Resource | Shared Hosting | VPS (4–8 vCPU) | Dedicated |
|---|---|---|---|
| Concurrent PHP workers | ~20–50 | ~100–300 | ~500+ |
| MySQL connections | 25–100 | 100–500 | 500+ |
| Raw HTTP throughput | Very limited | Medium | High |

**Key insight:** 10,000 *concurrent* users does not mean 10,000 simultaneous PHP processes. It means your app must handle 10,000 open connections — which is only achievable if most of those connections are being served **static assets, cached responses, or CDN content**, not hitting PHP at all.

**Your goal:** Make PHP handle as few requests as possible. Every request that returns a cached or static response is a win.

---

## 2. PHP & Laravel Backend Optimization

### 2.1 PHP Configuration (`php.ini`)

```ini
; Increase execution limits carefully
max_execution_time = 30        ; Keep low — slow requests are a symptom, not a limit to raise
memory_limit = 256M
max_input_vars = 3000

; OPcache — the single most impactful PHP setting
opcache.enable = 1
opcache.memory_consumption = 256
opcache.interned_strings_buffer = 16
opcache.max_accelerated_files = 20000
opcache.revalidate_freq = 0    ; 0 = never revalidate in production (restart PHP-FPM to clear)
opcache.validate_timestamps = 0 ; Disable in production for maximum speed
opcache.save_comments = 1
opcache.fast_shutdown = 1
```

> **OPcache alone can reduce PHP response time by 40–60%.** Enable it first, before anything else.

### 2.2 PHP-FPM Pool Configuration

If your cPanel host gives you PHP-FPM access (most VPS plans do), tune the pool:

```ini
; /opt/cpanel/ea-phpXX/root/etc/php-fpm.d/your-pool.conf

pm = dynamic
pm.max_children = 50           ; Tune based on RAM: (Total RAM - OS overhead) / per-process RAM
pm.start_servers = 10
pm.min_spare_servers = 5
pm.max_spare_servers = 20
pm.max_requests = 500          ; Restart workers periodically to prevent memory leaks
pm.process_idle_timeout = 10s
```

**Calculate `pm.max_children`:**
```
Available RAM for PHP = Total RAM × 0.7
Per-process RAM ≈ 30–60 MB (check with: ps aux | grep php-fpm | awk '{print $6}')
max_children = Available RAM / Per-process RAM
```

### 2.3 Laravel Application Optimization

**Run these on every deployment:**

```bash
# Compile all config, routes, views into single cached files
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# Optimize the autoloader
composer install --optimize-autoloader --no-dev

# Optional: generate IDE helper for better performance
php artisan optimize
```

**`.env` settings for production:**

```env
APP_ENV=production
APP_DEBUG=false           # CRITICAL — debug mode is 10× slower and leaks sensitive data
LOG_LEVEL=error           # Don't log every request
CACHE_DRIVER=redis        # Never use 'file' in production
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
```

### 2.4 Eliminate N+1 Queries

The most common Laravel performance killer:

```php
// ❌ BAD — fires 1 + N queries
$orders = Order::all();
foreach ($orders as $order) {
    echo $order->user->name; // N queries
}

// ✅ GOOD — fires 2 queries total
$orders = Order::with(['user', 'items.product'])->get();

// ✅ EVEN BETTER — paginate large datasets
$orders = Order::with('user')
    ->select(['id', 'user_id', 'total', 'status']) // only needed columns
    ->latest()
    ->paginate(25);
```

**Install Laravel Debugbar in development** to catch N+1 issues before they hit production:

```bash
composer require barryvdh/laravel-debugbar --dev
```

### 2.5 Use Lazy Collections for Large Datasets

```php
// ❌ BAD — loads 100k records into memory
User::all()->each(fn($u) => $this->process($u));

// ✅ GOOD — processes one chunk at a time
User::lazy()->each(fn($u) => $this->process($u));

// ✅ ALSO GOOD — for very large exports
User::chunk(500, fn($users) => $this->exportChunk($users));
```

---

## 3. Database Optimization (MySQL)

### 3.1 Essential Indexes

Missing indexes are responsible for the majority of slow queries at scale.

```sql
-- Check for slow queries (enable slow query log in my.cnf)
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;

-- Find missing indexes using EXPLAIN
EXPLAIN SELECT * FROM orders WHERE user_id = 1 AND status = 'pending';
-- If type = "ALL", you need an index

-- Add composite indexes for common query patterns
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- For full-text search, use FULLTEXT instead of LIKE '%...%'
CREATE FULLTEXT INDEX idx_products_search ON products(name, description);
SELECT * FROM products WHERE MATCH(name, description) AGAINST ('jersey' IN BOOLEAN MODE);
```

**In Laravel migrations:**
```php
// Composite index for common filters
$table->index(['user_id', 'status', 'created_at'], 'idx_orders_lookup');

// For foreign keys — always index them
$table->foreignId('user_id')->constrained()->index();
```

### 3.2 MySQL Configuration (`my.cnf`)

If you have access to MySQL config (cPanel WHM → MySQL Configuration):

```ini
[mysqld]
# InnoDB buffer pool: set to 70% of available RAM on a DB-dedicated server
innodb_buffer_pool_size = 1G

# Connection handling
max_connections = 300
thread_cache_size = 50

# Query cache (MySQL 5.x only — removed in 8.0)
query_cache_type = 1
query_cache_size = 64M

# Slow query logging
slow_query_log = 1
long_query_time = 1
slow_query_log_file = /var/log/mysql/slow.log
```

### 3.3 Read Replicas (Advanced)

If your cPanel VPS allows it, offload read traffic:

```php
// config/database.php
'mysql' => [
    'read' => [
        'host' => [env('DB_READ_HOST', '127.0.0.1')],
    ],
    'write' => [
        'host' => [env('DB_HOST', '127.0.0.1')],
    ],
    'sticky' => true, // Use write connection after a write within same request
    // ... other config
]
```

### 3.4 Connection Pooling with PgBouncer / ProxySQL

MySQL doesn't pool connections by default. At 10k users, this matters:

```bash
# Install ProxySQL on your VPS (if root access available)
# It sits between Laravel and MySQL and reuses connections
# Reduces MySQL max_connections needed by 60-80%
```

Alternatively, keep `DB_POOL_SIZE` reasonable in Laravel and rely on Redis for session/cache to avoid unnecessary DB connections.

---

## 4. Caching Strategy

Caching is **the most effective** lever for scaling on cPanel. Every cached response is a request MySQL never sees.

### 4.1 Install Redis on cPanel VPS

```bash
# Via WHM Terminal or SSH
yum install redis   # CentOS/AlmaLinux
systemctl enable redis
systemctl start redis

# Install PHP Redis extension via cPanel EasyApache
# EasyApache 4 → PHP Extensions → php-redis
```

```env
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
CACHE_DRIVER=redis
SESSION_DRIVER=redis
```

### 4.2 Response Caching (Full Page)

```php
// Cache entire API responses
Route::get('/api/products', [ProductController::class, 'index'])
    ->middleware('cache.headers:public;max_age=3600;etag');

// Manual cache in controllers
public function index()
{
    return Cache::remember('products.all', 3600, fn() =>
        Product::with('category')
            ->active()
            ->orderBy('name')
            ->get()
    );
}

// Cache with tags (allows grouped invalidation)
public function store(Request $request)
{
    $product = Product::create($request->validated());
    Cache::tags(['products'])->flush(); // Invalidate all product caches
    return response()->json($product, 201);
}
```

### 4.3 Fragment Caching

Cache expensive computations, not just full responses:

```php
// Cache dashboard stats for 5 minutes
$stats = Cache::remember('dashboard.stats.' . $user->id, 300, function () use ($user) {
    return [
        'total_orders'   => Order::where('user_id', $user->id)->count(),
        'pending'        => Order::where('user_id', $user->id)->pending()->count(),
        'total_spent'    => Order::where('user_id', $user->id)->sum('total'),
    ];
});
```

### 4.4 HTTP-Level Caching

Use ETags and Last-Modified headers so browsers and CDN proxies can cache responses:

```php
// In your API responses
public function show(Product $product)
{
    $etag = md5($product->updated_at->timestamp);

    if (request()->header('If-None-Match') === $etag) {
        return response(null, 304);
    }

    return response()->json($product)
        ->header('ETag', $etag)
        ->header('Cache-Control', 'public, max-age=300');
}
```

---

## 5. Queue Workers & Background Jobs

Never do slow work synchronously. Move it to queues.

### 5.1 What to Queue

- Email sending
- SMS/notifications
- Image processing / resizing
- PDF generation
- External API calls (payment webhooks, shipping, etc.)
- Report generation
- Search index updates

```php
// ❌ BAD — slow response, blocks user
public function register(Request $request)
{
    $user = User::create($request->validated());
    Mail::to($user)->send(new WelcomeEmail($user)); // Blocks for 2–5 seconds
    return response()->json($user, 201);
}

// ✅ GOOD — instant response, email sent in background
public function register(Request $request)
{
    $user = User::create($request->validated());
    Mail::to($user)->queue(new WelcomeEmail($user)); // Returns immediately
    return response()->json($user, 201);
}
```

### 5.2 Running Queue Workers on cPanel

cPanel doesn't natively support persistent processes, but you can use **Cron Jobs**:

```bash
# cPanel → Cron Jobs → Add:
# Every minute — restarts the worker if it dies
* * * * * cd /home/youraccount/public_html && php artisan queue:work redis --sleep=3 --tries=3 --max-time=3600 --quiet >> /dev/null 2>&1
```

For more robust worker management, use **Supervisor** if you have SSH root access:

```ini
; /etc/supervisor/conf.d/laravel-worker.conf
[program:laravel-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /home/youraccount/public_html/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
numprocs=4            ; Run 4 workers in parallel
redirect_stderr=true
stdout_logfile=/home/youraccount/logs/worker.log
```

---

## 6. React Native App Optimization

React Native is a mobile client — it doesn't serve your 10k users, it *is* one of them. The optimizations here reduce how hard each app instance hits your Laravel API, and keep the app itself fast and responsive on device.

### 6.1 API State Management with TanStack Query

This is the single most impactful library for a React Native + Laravel setup. It eliminates redundant network calls, caches responses on-device, and handles background refetching intelligently.

```bash
npm install @tanstack/react-query
```

```jsx
// App.tsx — wrap your app
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // Data stays fresh for 5 min — no refetch on screen focus
      cacheTime: 30 * 60 * 1000,  // Keep in memory for 30 min
      retry: 2,
      refetchOnWindowFocus: false, // Mobile: don't refetch on app foreground by default
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
    </QueryClientProvider>
  );
}
```

```jsx
// hooks/useProducts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useProducts(page = 1) {
  return useQuery({
    queryKey: ['products', page],
    queryFn: () => api.get(`/products?page=${page}`).then(r => r.data),
    keepPreviousData: true,  // No loading flash when paginating
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderData) => api.post('/orders', orderData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // Refresh stock
    },
  });
}
```

### 6.2 Offline-First with Persistent Cache

Mobile users go offline. Don't let your app break when they do.

```bash
npm install @tanstack/react-query-persist-client @tanstack/query-async-storage-persister
npm install @react-native-async-storage/async-storage
```

```jsx
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  throttleTime: 1000,
});

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: 24 * 60 * 60 * 1000, // Persist cache for 24 hours
      }}
    >
      <RootNavigator />
    </PersistQueryClientProvider>
  );
}
```

This means your app loads from local cache instantly, then syncs with the server in the background — users on slow mobile networks (common in East African markets) see data immediately.

### 6.3 Reduce API Payload Size

Every byte costs bandwidth and battery. Design your Laravel API responses for mobile:

```php
// Laravel: lean resource for list views
class ProductListResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'        => $this->id,
            'name'      => $this->name,
            'price'     => $this->price,
            'thumbnail' => $this->thumbnail_url, // Small image, not full-res
            // ❌ Don't include: full description, raw image, pivot data
        ];
    }
}

// Full detail only when user opens a product
class ProductDetailResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'          => $this->id,
            'name'        => $this->name,
            'description' => $this->description,
            'price'       => $this->price,
            'images'      => ImageResource::collection($this->images),
            'category'    => new CategoryResource($this->category),
        ];
    }
}
```

Always compress API responses. In your `.htaccess`:

```apache
# Compress JSON API responses — saves 60–80% bandwidth on typical payloads
AddOutputFilterByType DEFLATE application/json
```

### 6.4 FlatList Optimization for Large Lists

React Native's `FlatList` renders natively, but you still need to configure it properly:

```jsx
import { FlatList, Image } from 'react-native';

// ✅ Optimized FlatList for product/order lists
function ProductList({ products }) {
  const renderItem = useCallback(({ item }) => (
    <ProductCard product={item} />
  ), []);

  const keyExtractor = useCallback((item) => item.id.toString(), []);

  return (
    <FlatList
      data={products}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      // Performance props
      removeClippedSubviews={true}    // Unmount off-screen components
      maxToRenderPerBatch={10}        // Render 10 items per batch
      updateCellsBatchingPeriod={50}  // Batch updates every 50ms
      windowSize={10}                 // Render 5 screens above + below viewport
      initialNumToRender={8}          // Only render 8 items on mount
      // Infinite scroll
      onEndReachedThreshold={0.5}
      onEndReached={fetchNextPage}
      ListFooterComponent={isFetchingNextPage ? <Spinner /> : null}
    />
  );
}
```

### 6.5 Image Optimization

Images are the #1 cause of memory pressure and slow scrolling in React Native:

```bash
npm install react-native-fast-image
```

```jsx
import FastImage from 'react-native-fast-image';

// ✅ FastImage: persistent disk cache + memory cache + priority loading
function ProductCard({ product }) {
  return (
    <FastImage
      source={{
        uri: product.thumbnail_url,
        priority: FastImage.priority.normal,
        cache: FastImage.cacheControl.immutable, // Cache forever (URL has content hash)
      }}
      style={{ width: 120, height: 120 }}
      resizeMode={FastImage.resizeMode.cover}
    />
  );
}

// Preload critical images (e.g., on home screen, preload first 10 products)
useEffect(() => {
  FastImage.preload(
    products.slice(0, 10).map(p => ({ uri: p.thumbnail_url }))
  );
}, [products]);
```

**On the Laravel side — serve WebP thumbnails:**

```php
// app/Http/Controllers/ImageController.php
// Use Intervention Image to generate WebP thumbnails on upload
use Intervention\Image\Facades\Image;

public function store(Request $request)
{
    $image = $request->file('image');
    $thumbnail = Image::make($image)
        ->fit(300, 300)
        ->encode('webp', 80); // 80% quality WebP

    Storage::put("thumbnails/{$filename}.webp", $thumbnail);
}
```

### 6.6 Minimize Re-renders

```jsx
// ❌ BAD — new object reference every render triggers re-render downstream
function Screen() {
  const style = { flex: 1, padding: 16 }; // New object every render

  return <ProductList containerStyle={style} />;
}

// ✅ GOOD — stable reference
const containerStyle = { flex: 1, padding: 16 }; // Defined outside component

// ✅ GOOD — memoize expensive child components
const ProductCard = React.memo(({ product, onPress }) => {
  // Only re-renders if product.id changes or onPress reference changes
  return (
    <TouchableOpacity onPress={() => onPress(product.id)}>
      <Text>{product.name}</Text>
    </TouchableOpacity>
  );
});

// ✅ GOOD — stable callback reference
function ProductList({ onSelect }) {
  const handlePress = useCallback((id) => onSelect(id), [onSelect]);
  return <ProductCard onPress={handlePress} />;
}
```

### 6.7 Use Hermes Engine

Hermes is a JavaScript engine optimized for React Native — it dramatically reduces startup time and memory usage:

```json
// android/app/build.gradle
project.ext.react = [
    enableHermes: true,  // Already default in RN 0.70+, verify it's on
]
```

```json
// ios/Podfile
use_react_native!(
  :path => config[:reactNativePath],
  :hermes_enabled => true
)
```

With Hermes, app startup time typically drops by 30–50% compared to JSC (JavaScriptCore).

### 6.8 Network Request Batching

Don't fire 10 API calls on screen mount — batch them:

```jsx
// ❌ BAD — 3 parallel requests on every screen open
useEffect(() => {
  fetchProducts();
  fetchCategories();
  fetchUserProfile();
}, []);

// ✅ GOOD — single batched endpoint or use Promise.all with React Query
// Option A: Create a Laravel batch endpoint
// GET /api/home → returns { products, categories, user }

// Option B: Parallel queries (React Query handles deduplication)
function HomeScreen() {
  const products   = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const profile    = useQuery({ queryKey: ['profile'], queryFn: fetchProfile });
  // These fire in parallel but each result is independently cached
}
```

**Laravel batch endpoint:**

```php
// routes/api.php
Route::get('/home', function () {
    return response()->json([
        'products'   => Cache::remember('home.products', 300, fn() =>
            ProductListResource::collection(Product::active()->limit(20)->get())
        ),
        'categories' => Cache::remember('home.categories', 3600, fn() =>
            Category::all(['id', 'name', 'icon'])
        ),
    ]);
});
```

---

## 7. Static Assets & CDN

This is where you get the 10k user headroom. **Static files should never touch PHP.**

### 7.1 Configure Apache/LiteSpeed for Static Files

```apache
# .htaccess — add in your public/ directory

# Enable GZIP compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css
  AddOutputFilterByType DEFLATE application/javascript application/json
  AddOutputFilterByType DEFLATE image/svg+xml font/woff2
</IfModule>

# Browser caching for static assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/webp         "access plus 1 year"
  ExpiresByType image/jpeg         "access plus 1 year"
  ExpiresByType image/png          "access plus 1 year"
  ExpiresByType text/css           "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType font/woff2         "access plus 1 year"
  ExpiresByType text/html          "access plus 5 minutes"
</IfModule>

# Cache-Control headers
<IfModule mod_headers.c>
  <FilesMatch "\.(js|css|webp|jpg|png|woff2)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
</IfModule>
```

### 7.2 CDN Integration (Cloudflare — Free Tier Works)

Cloudflare is the single best upgrade you can make on cPanel hosting. Set it up before anything else.

```
DNS: Route your domain through Cloudflare (orange cloud = proxied)
```

**Cloudflare settings to enable:**
- **Auto Minify** → HTML, CSS, JS
- **Brotli** → ON
- **Rocket Loader** → Test carefully (can conflict with some SPAs)
- **Caching Level** → Standard
- **Browser Cache TTL** → 1 year (your assets have content-hash filenames anyway)
- **Page Rules** → Cache everything for `/build/*` (your Vite output)

**Cloudflare Page Rules:**

| URL Pattern | Setting |
|---|---|
| `yourdomain.com/build/*` | Cache Level: Cache Everything, Edge TTL: 1 month |
| `yourdomain.com/api/*` | Cache Level: Bypass |
| `yourdomain.com/storage/*` | Cache Level: Cache Everything, Edge TTL: 1 week |

### 7.3 Asset Versioning (Vite handles this automatically)

Vite appends content hashes to filenames (`app.a3f9b2.js`), so you can safely set infinite cache TTLs without worrying about stale files.

React Native apps don't serve static HTML — the APK/IPA is the "static asset." What you're serving from cPanel is your **API and media files** (images, documents). Those are what Cloudflare should cache.

---

## 8. Apache / LiteSpeed Configuration

### 8.1 LiteSpeed Cache Plugin (if on LiteSpeed)

LiteSpeed is common on modern cPanel servers and is significantly faster than Apache for PHP:

```bash
# Install via WHM → EasyApache → LiteSpeed Web Server
# Then install LSCWP (LiteSpeed Cache for WordPress-style apps)
# For Laravel, use the LSCache header API directly:
```

```php
// app/Http/Middleware/LiteSpeedCache.php
public function handle($request, Closure $next)
{
    $response = $next($request);

    if ($request->isMethod('GET') && $response->getStatusCode() === 200) {
        $response->headers->set('X-LiteSpeed-Cache-Control', 'public, max-age=3600');
        $response->headers->set('X-LiteSpeed-Tag', 'page-' . md5($request->url()));
    }

    return $response;
}
```

### 8.2 Enable HTTP/2

HTTP/2 allows multiplexing — a single connection handles multiple parallel requests. Ensure it's enabled:

```apache
# WHM → Apache Configuration → Global Configuration
# Enable: Protocols h2 h2c http/1.1

# Or in .htaccess
<IfModule mod_http2.c>
  Protocols h2 http/1.1
</IfModule>
```

### 8.3 Keep-Alive Settings

```apache
# .htaccess
<IfModule mod_headers.c>
  Header set Connection keep-alive
</IfModule>
```

---

## 9. API Design for Scale

### 9.1 Pagination — Always

```php
// ❌ NEVER return unbounded collections
return Product::all(); // Could be 50,000 records

// ✅ Always paginate
return Product::paginate(25);           // Cursor pagination is even faster for large sets
return Product::cursorPaginate(25);     // Best for infinite scroll
```

### 9.2 Field Selection

```php
// ❌ BAD — returns all columns including large blobs
return User::find($id);

// ✅ GOOD — only what the client needs
return User::select(['id', 'name', 'email', 'avatar'])->find($id);
```

### 9.3 API Rate Limiting

Prevent a single user from hammering your server:

```php
// routes/api.php
Route::middleware(['throttle:api'])->group(function () {
    Route::get('/products', [ProductController::class, 'index']);
});

// config/cache.php — use Redis for rate limiter
// config/app.php → RateLimiter uses Redis

// AppServiceProvider::boot()
RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
});

// Stricter limit for expensive endpoints
RateLimiter::for('search', function (Request $request) {
    return Limit::perMinute(10)->by($request->ip());
});
```

### 9.4 Use API Resources to Control Output Size

```php
// app/Http/Resources/ProductResource.php
class ProductResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'       => $this->id,
            'name'     => $this->name,
            'price'    => $this->price,
            'category' => $this->whenLoaded('category', fn() => $this->category->name),
            // Omit heavy fields unless explicitly requested
            'description' => $this->when($request->has('full'), $this->description),
        ];
    }
}
```

---

## 10. Monitoring & Observability

You can't optimize what you can't measure.

### 10.1 Laravel Telescope (Development) + Pulse (Production)

```bash
# Development
composer require laravel/telescope --dev
php artisan telescope:install && php artisan migrate

# Production monitoring
composer require laravel/pulse
php artisan pulse:install && php artisan migrate
```

Laravel Pulse gives you: slow queries, slow requests, queue throughput, Redis memory, exceptions — all in a single dashboard.

### 10.2 Error Tracking

```bash
composer require sentry/sentry-laravel
```

```env
SENTRY_LARAVEL_DSN=https://your-key@sentry.io/project-id
```

### 10.3 Key Metrics to Watch

| Metric | Warning Threshold | Critical Threshold |
|---|---|---|
| PHP-FPM worker utilization | >70% | >90% |
| MySQL query time (avg) | >100ms | >500ms |
| Redis memory usage | >70% allocated | >90% |
| Queue depth (jobs waiting) | >100 | >1,000 |
| Laravel response time (p95) | >500ms | >2,000ms |
| Cloudflare cache hit rate | <70% | <50% |

### 10.4 Simple Health Endpoint

```php
// routes/api.php
Route::get('/health', function () {
    return response()->json([
        'status'    => 'ok',
        'db'        => DB::connection()->getPdo() ? 'ok' : 'error',
        'redis'     => Redis::ping() === 'PONG' ? 'ok' : 'error',
        'timestamp' => now()->toISOString(),
    ]);
})->withoutMiddleware(['throttle:api']);
```

---

## 11. Migration Path Beyond cPanel

When you've maxed out cPanel's capabilities, here's where to go next:

```
Phase 1 (0–5k users)      → cPanel VPS + Cloudflare + Redis (this guide)
Phase 2 (5k–20k users)    → Move to DigitalOcean / Hetzner managed server
                             + Separate DB server + Redis server
Phase 3 (20k–100k users)  → Kubernetes or Docker Swarm
                             + Load balancer (HAProxy or Nginx)
                             + Horizontal scaling of PHP-FPM
Phase 4 (100k+ users)     → Full cloud (AWS ECS / GCP Cloud Run)
                             + Aurora RDS + ElastiCache Redis
                             + Event-driven architecture
```

**For cPanel VPS specifically — consider migrating to RunCloud or ServerPilot** as a control panel replacement. They provide the same SSH/web-based management but with better performance primitives (Nginx instead of Apache, built-in Redis/Supervisor management, zero overhead control panel).

---

## 12. Quick Wins Checklist

Deploy these in order — highest impact first:

**Backend (Laravel on cPanel):**
- [ ] **Enable OPcache** — 40–60% PHP speed improvement, single biggest win
- [ ] **Set `APP_DEBUG=false`** — critical, never run debug in production
- [ ] **Run `php artisan optimize`** — caches config, routes, views
- [ ] **Install Redis** and set `CACHE_DRIVER=redis`, `SESSION_DRIVER=redis`
- [ ] **Install Cloudflare** (free tier) — CDN + GZIP + DDoS protection for free
- [ ] **Add missing database indexes** — run `EXPLAIN` on your top 10 queries
- [ ] **Paginate all API responses** — use `cursorPaginate()` for infinite scroll
- [ ] **Add rate limiting** to all API routes (`throttle:60,1`)
- [ ] **Move emails and heavy jobs to queues** — never block a response for email
- [ ] **Eager load relationships** — eliminate N+1 queries with `->with()`
- [ ] **Enable GZIP for `application/json`** in `.htaccess`
- [ ] **Install Laravel Pulse** to find your real bottlenecks

**React Native (Mobile App):**
- [ ] **Install TanStack Query** — eliminates redundant API calls, caches on-device
- [ ] **Enable offline persistence** with `AsyncStorage` persister
- [ ] **Enable Hermes engine** — 30–50% faster app startup
- [ ] **Install `react-native-fast-image`** — persistent image cache, no re-downloading
- [ ] **Tune FlatList** — set `removeClippedSubviews`, `maxToRenderPerBatch`, `windowSize`
- [ ] **Serve WebP thumbnails** from Laravel — smaller images over mobile networks
- [ ] **Set `staleTime` in React Query** — avoid refetching data that hasn't changed
- [ ] **Wrap list item components in `React.memo()`** — prevent unnecessary re-renders
- [ ] **Batch screen-load API calls** into a single `/home` or `/bootstrap` endpoint
- [ ] **Add skeleton loaders** — perceived performance matters as much as real performance

---

> **Final note:** The difference between an app that dies at 500 users and one that handles 10,000 is almost never a single setting. It's the combination of PHP doing less work, the database answering faster, static files never touching PHP, and your server spending its resources on real computation — not on repeating work it already did.

*Measure first. Optimize the bottleneck. Repeat.*