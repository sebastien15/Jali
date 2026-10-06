# Working on Jali Ride with Multiple AI Agents

Jali Ride is built by several AI agents working in parallel. These rules keep their work
consistent so the result feels like **one** app, not many.

> **Release / architecture direction:** read [the shared plan](../RELEASE_PLAN.md) before selecting service-scope, release-order, pricing, module-boundary or shared-UX work. It records passenger transport plus cargo (batch TBD), modular architecture and one-account customer/provider UX; detailed navigation examples remain proposals. Dependency waves below govern implementation dependencies, not public launch order. Select only user-authorized work; flag material deviations and honor explicit owner-approved changes. The plan does not authorize taking issues or implementing future batches.

## 1. Pick a story
1. Open `USER_STORIES.md` → *Build order — dependency waves*.
2. Take a story whose **Depends on** stories are all merged. Stories in the same wave can run in parallel.
3. Comment on the GitHub issue that you're taking it (one agent per story).

## 2. Read before coding
- [Batch release, architecture & rollout migration plan](../RELEASE_PLAN.md) (scope, zero Jali fees, sequence, modular boundaries, shared UX and deviation rules)
- `CLAUDE.md` → `context.md` (guards, roles, conventions)
- `RIDE_HAILING_PLAN.md` (architecture, data model, state machine, API list)
- The story file in `stories/` (acceptance criteria are the definition of done)
- `UX_QUALITY_CHECKLIST.md` for any UI work

## 3. Shared contracts — change them deliberately
These files are shared by many stories. Change them only as described, and mention the change in the PR description:

| Contract | Rule |
|---|---|
| `docs/api/openapi.yaml` (S21.9) | Add/modify the endpoint spec **in the same PR** as the implementation. Never break an existing field; add new ones. |
| Database migrations | New migration per change; never edit a merged migration. |
| Ride state machine (`RIDE_HAILING_PLAN.md` §5.4) | New states/transitions need a plan update in the same PR. |
| `RolesAndPermissionsSeeder` | Append permissions; never rename. |
| `locales/*.json` | Add keys under a story-specific namespace (e.g. `ride.nearby.*`) to avoid merge conflicts. |
| `lib/queryKeys.ts` | Add keys; don't reorder or rename existing ones. |

## 4. Branch & PR
- Branch: `feat/<story-id>-<short-name>` (e.g. `feat/S3.2-nearby-drivers`).
- One story per PR; PR title starts with the story ID.
- PR description: copy the acceptance criteria and tick each one with evidence (test name, screenshot).
- CI (S21.3) must be green. Use staging + driver simulator (S21.4) for end-to-end checks.

## 5. Copying ideas from other apps
- Features, flows and patterns from Uber, DiDi, Bolt, inDrive, Careem, Grab are fair to adopt — that's how the backlog was built (*Inspired by* field).
- Do **not** copy logos, brand names, icons, illustrations, exact copywriting or proprietary assets. Use Jali's theme (`C.xxx`) and Ionicons.

## 6. Future backend rewrite (e.g. Rust)
The mobile app must depend only on the OpenAPI contract, never on Laravel specifics (error
message formats aside from the documented error schema). With contract tests green, any
backend implementing the spec can replace Laravel service by service.
