# ZEMP V0.1 — Progress

Read this first (CLAUDE.md §2, §40). ZEMP is a separate project from `../YT&IG` — nothing is shared.

## Phase plan (master build prompt)

| Phase | Scope | Status |
|---|---|---|
| A | Complete frontend on a temporary mock API | **Done** (typecheck, lint, 47 tests, `next build`) |
| B | NestJS backend (auth, RBAC, domain services, REST `/api/v1`) | Not started |
| C | PostgreSQL + Prisma (schema, migrations, constraints, seed) | Not started |
| D | Replace mock API with the real backend | Not started |
| E | Testing, security review, hardening | Not started |
| F | V0.1 release readiness | Not started |

## Decisions (confirmed with the user)

- **Local PostgreSQL**: embedded Postgres via the `embedded-postgres` npm package (no Docker/WSL on this machine). Production uses any PostgreSQL via `DATABASE_URL`.
- **Colour contrast**: WCAG AA wins over exact reference colours. `#FA6147` stays the accent (bars, icons, focus, tints); solid fills carrying white text use `--color-primary-strong #D0432B` (4.6:1). Same rule applied to muted text (`#6F6A72` instead of `#858087`) and semantic text inks. Tokens: `frontend/src/app/globals.css`.
- **Git**: commit after each phase passes verification (repo-local identity).
- Product renamed BompVP → ZEMP in the spec docs; `requirements(1).md` renamed `requirements.md`.

## Decisions (implementation, low-risk defaults — revisit if the user disagrees)

- **Admins** view and assign work in teams they own; creating, editing, moving and deactivating people is Super Admin only (requirements §3.1 vs §3.2). One permission-map change grants more.
- **Status lifecycle**: requirements §7 plus `BLOCKED → CANCELLED`; cancel and reopen (`COMPLETED → IN_PROGRESS`) are manager-only. Setting progress to 100% completes the task; reopening drops progress to 99%.
- **Active workload** (all completion rates): non-cancelled tasks that are open, not yet due, or completed that day or later. Completed work drops out after its deadline passes.
- **Risk** (requirements §14): `required_daily_rate = remaining / remaining_days` vs achieved rate, checked against every open deadline; overdue wins; no verdict in the first day. Task-level risk: blocked, overdue, or progress more than 10 points behind elapsed time.
- **Out-of-scope reads return 404** (no existence leak); permitted-but-forbidden actions return 403.
- **Auth**: HttpOnly session cookie + double-submit CSRF header (`zemp_session`, `zemp_csrf`); Argon2id via Node's built-in `crypto.argon2` in the backend.
- Frontend reaches the API same-origin at `/api/v1` (Phase D: Next.js rewrite/proxy to NestJS).

## Architecture

```
packages/shared   @zemp/shared — enums, permissions, error codes, Zod schemas, API contracts,
                  time-zone helpers, task planners (all business rules), workload/risk,
                  read-model builders, deterministic seed (@zemp/shared/seed). ESM, built to dist/.
frontend          Next.js 16 (App Router, Turbopack), Tailwind 4 tokens, Radix primitives,
                  TanStack Query, React Hook Form + Zod, Recharts (reports only).
  src/mocks       PHASE A MOCK API (in-memory seed, same contract). Delete in Phase D,
  src/app/api/v1  together with the catch-all route handler.
backend           NestJS 12 (Phase B) — not created yet.
```

Toolchain: Node 24.19, pnpm 12.3.4, TypeScript 6.0.3 (TS 7 unsupported by typescript-eslint/ts-jest/Nest CLI), NestJS 12 (ESM framework, CJS app per its template), Prisma 7.10 (npm `latest` tag is an 8.0 RC), Zod 4.6.

## Phase A checklist

- [x] Workspace, shared domain package (33 unit tests passing)
- [x] Design tokens, UI primitives, app shell (sidebar, top bar, mobile drawer, session gate, session-expired re-auth, notifications popover, user menu)
- [x] Mock API: auth, tasks, people, teams, org chart, dashboard, reports, activity, notifications, audit, settings
- [x] Login
- [x] Dashboards (Super Admin / Admin / Employee)
- [x] Task list (URL filters, table + mobile cards + filter drawer, bulk priority) · Assign Task dialog · Task detail (sheet + page, progress editor, status actions, comments, activity) — verified in browser
- [x] Employees list + profile · Add/Edit employee · deactivate/reactivate · reset-access link · Organization view
- [x] Teams list/detail · create/edit team · move member
- [x] Daily report (trend chart, team comparison, employee table) + progress over time (5/7/custom days) · My Progress (employee)
- [x] Admin management (create/edit with team scope)
- [x] Notifications page · Profile · Settings (account, organization, roles matrix) · Audit log
- [x] Forgot/reset password pages · not-found page
- [x] ESLint flat config + lint (0 errors, 0 warnings), frontend tests (Vitest/RTL, 14) + shared (33), `next build` (21 routes), responsive + role spot checks
- Chart palette validated with the dataviz validator: Completed `#D0432B`, Assigned `#5D78D6` (all checks pass).

### Fixes during Phase A verification

- **App shell fills the viewport** (user request): the warm gradient is login-only; the shell is full-bleed with a fixed sidebar and a single scrolling `<main>` (was a centred rounded card on the gradient at ≥1280px).
- **Page no longer scrolls past the shell**: the charts' `sr-only` screen-reader tables are `position: absolute`, so with an unpositioned `<main>` they escaped the scroll container and stretched the document to ~4500px. `<main>` is now `relative`.
- **ESLint 9.39.5, not 10**: `eslint-plugin-react` 7.37.5 (pulled in by `eslint-config-next` 16.3.5) calls `context.getFilename()`, removed in ESLint 10. Revisit when the plugin ships an ESLint 10 build.
- React Compiler lint: prop→state sync moved out of an effect in `SearchInput`, `watch()` → `useWatch()` in the three RHF forms, and the mobile drawer now closes via `Sidebar onNavigate` instead of a `setState` in an effect.
- Vitest 5 + `@testing-library/user-event`: fake timers deadlock the awaits — use real timers with `waitFor`.

## Run

```bash
pnpm install
pnpm shared:build
pnpm --filter @zemp/frontend dev      # http://localhost:3000 (mock API, demo accounts on sign-in)
pnpm -r test                          # 33 shared + 14 frontend
pnpm --filter @zemp/frontend lint
pnpm --filter @zemp/frontend build
```

**Next: Phase B** — NestJS 12 backend implementing the same `/api/v1` contract with the `@zemp/shared` planners, then Phase D deletes `frontend/src/mocks` and `frontend/src/app/api/v1`.

Demo password for every seeded account (seed data only): `ZempDemo#2026` — e.g. `john@zemp.test` (Super Admin), `rock@zemp.test` (Admin), `aarav.shah@zemp.test` (Employee).

## Environment notes

- An ECC GateGuard hook denies the first write to every new file until facts are stated; set `ECC_GATEGUARD=off` to speed up large builds.
