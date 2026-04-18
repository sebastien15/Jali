# Roles & Permissions Management — Migration Plan

## Goal
Give the superadmin a UI to create/edit roles and assign app-defined permissions to them via a dual-listbox interface (left = available, right = assigned), with category filter and search. Permissions remain app-defined (seeded), not user-created arbitrary strings.

## Current State
- **Permissions table**: `id, name, description` — 13 permissions seeded
- **Roles table**: `id, name, description` — 4 roles (superadmin, admin, user, driver)
- **Pivot**: `role_permissions(role_id, permission_id)`
- **Middleware**: `CheckPermission` checks `user->role->permissions->contains(name)`
- **Mobile**: `isSuperAdmin` flag used for most gates; `user.permissions[]` array used for some

## Risk Areas
- Syncing permissions to a role replaces all assignments — must not accidentally strip superadmin permissions
- New granular permissions are additive (won't break existing checks)
- Deleting a role that has assigned users would orphan those users — guard against it

---

## Steps

### Step 1 — Add `category` to permissions + expand permission catalog
- [ ] Migration: add `category varchar(50)` to `permissions` table
- [ ] Migration / seeder: upsert all permissions with categories:

| Permission | Category |
|---|---|
| `confirm-bookings` | Bookings |
| `upload-tickets` | Bookings |
| `create-bookings` | Bookings |
| `view-own-bookings` | Bookings |
| `manage-agencies` | Agencies |
| `agencies.create` | Agencies |
| `agencies.update` | Agencies |
| `agencies.delete` | Agencies |
| `agencies.routes` | Agencies |
| `manage-locations` | Locations |
| `locations.create` | Locations |
| `locations.update` | Locations |
| `locations.delete` | Locations |
| `view-analytics` | Analytics |
| `view-station-analytics` | Analytics |
| `manage-buses` | Buses |
| `manage-users` | Users |
| `manage-admins` | Admins |
| `create-private-seats` | Driver |
| `view-own-earnings` | Driver |
| `manage-roles` | Admins |

**Files**: new migration `2026_04_18_000001_add_category_to_permissions_and_expand_catalog.php`

---

### Step 2 — Backend: RolesController (superadmin only)
- [ ] `GET /admin/roles` — list all roles with permission count + user count
- [ ] `POST /admin/roles` — create role `{name, description}`
- [ ] `PATCH /admin/roles/{id}` — update name/description (guard: cannot edit superadmin)
- [ ] `DELETE /admin/roles/{id}` — delete role (guard: cannot delete if users assigned; cannot delete superadmin/admin/user/driver)
- [ ] `GET /admin/roles/{id}/permissions` — get role's current permissions
- [ ] `PUT /admin/roles/{id}/permissions` — sync permissions `{permission_ids: []}` (guard: superadmin role always keeps all)

**File**: `backend/app/Http/Controllers/Admin/RolesController.php`

---

### Step 3 — Backend: PermissionsController
- [ ] `GET /admin/permissions` — list all app-defined permissions with `id, name, description, category`

**File**: `backend/app/Http/Controllers/Admin/PermissionsController.php`

---

### Step 4 — Backend: Routes
- [ ] Add routes under `permission:manage-roles` middleware in `api.php`
- [ ] Add `manage-roles` permission check in `routes/api.php`

---

### Step 5 — Mobile: queryKeys
- [ ] Add `roles.all`, `roles.detail(id)`, `permissions.all` to `queryKeys.ts`

---

### Step 6 — Mobile: Roles list screen `/(admin)/roles/index.tsx`
- [ ] List all roles as cards showing name + description + permission count + user count
- [ ] Tap a role → navigate to detail screen
- [ ] "+" button → inline sheet to create new role (name + description)
- [ ] Superadmin-only (guarded in layout)

---

### Step 7 — Mobile: Role detail screen `/(admin)/roles/[id].tsx`
**This is the main feature — dual-listbox UI:**
- [ ] Top: role name + description + edit pencil
- [ ] Left panel: "Available Permissions"
  - Category filter chips (All, Bookings, Agencies, Locations, Analytics, Buses, Users, Admins, Driver)
  - Search text input
  - Scrollable list of permissions NOT assigned to this role
  - Tap → moves to right panel
- [ ] Right panel: "Assigned Permissions"
  - Scrollable list of permissions assigned to this role
  - Tap → moves to left panel
- [ ] "Save" button → `PUT /admin/roles/{id}/permissions`
- [ ] Guard: if role is `superadmin`, show read-only (all permissions locked)

---

### Step 8 — Mobile: Add "Roles" tile to superadmin dashboard
- [ ] Add tile in `dashboard.tsx` under superadmin-only section
- [ ] Route: `/(admin)/roles`

---

### Step 9 — Verify existing flows still work
- [ ] Admin login → bookings still load (confirm-bookings still present)
- [ ] Agency management still gated by manage-agencies
- [ ] New permissions (agencies.create etc.) are available to assign but not yet enforced in backend (additive, no breaking change)
- [ ] Superadmin role always has all permissions (enforced in PUT handler)

---

## Implementation Order
Steps 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

Start with Step 1 and mark each checkbox as completed before moving to the next.
