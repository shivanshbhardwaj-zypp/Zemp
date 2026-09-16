# ZEMP V0.1 — Progress

Read this first (CLAUDE.md §2, §40). ZEMP is a separate project from `../YT&IG` — nothing is shared.

## Phase plan (master build prompt)

| Phase | Scope | Status |
|---|---|---|
| A | Complete frontend on a temporary mock API | **Done** (typecheck, lint, 47 tests, `next build`) |
| B | NestJS backend (auth, RBAC, domain services, REST `/api/v1`) | **Almost done** — every module but reports |
| C | PostgreSQL + Prisma (schema, migrations, constraints, seed) | Not started |
| D | Replace mock API with the real backend | Not started |
| E | Testing, security review, hardening | Not started |
| F | V0.1 release readiness | Not started |

## Decisions (confirmed with the user)

- **Local PostgreSQL**: embedded Postgres via the `embedded-postgres` npm package (no Docker/WSL on this machine). Production uses any PostgreSQL via `DATABASE_URL`.
- **Colour contrast**: WCAG AA wins over exact reference colours. `#FA6147` stays the accent (bars, icons, focus, tints); solid fills carrying white text use `--color-primary-strong #D0432B` (4.6:1). Same rule applied to muted text (`#6F6A72` instead of `#858087`) and semantic text inks. Tokens: `frontend/src/app/globals.css`.
- **Git**: commit after each phase passes verification (repo-local identity).
- Product renamed BompVP → ZEMP in the spec docs; `requirements(1).md` renamed `requirements.md`.

## Scope addition — self-reported work with review (approved by the user, 16 Sep 2026)

"Approvals" sits in requirements §39 (V0.2+ candidates) and §38 requires separate approval to add it; the
user asked for it explicitly, so V0.1 now includes it. Decisions they confirmed:

- **An employee logs work nobody assigned** and chooses the reviewer: the admin who owns their team, or a
  Super Admin. Only those two may be chosen, enforced server-side (`canReviewFor`).
- **It counts only once approved.** `countsTowardMetrics` keeps `PENDING` / `CHANGES_REQUESTED` submissions
  out of `summarizeWorkload`, so nobody can move their own or their team's numbers unilaterally.
- **Evidence is a note plus an optional http(s) link** — V0.1 has no file storage; uploads would need one.
- **Completed work only** (not work in progress), logged within 30 days of finishing it.
- Modelled on the existing Task (`origin`, `reviewerId`, `reviewStatus`, `reviewedAt`, `reviewNote`,
  `evidenceUrl`) rather than a second entity, so it flows through task lists, activity, audit and reports.
- Flow: submit → reviewer approves (counts) or asks for changes with a required note → author revises and
  resubmits. Only the chosen reviewer or a Super Admin decides; never the author.

## Scope addition — Sub Admins (approved by the user, 16 Sep 2026)

"Custom roles" is another requirements §39 candidate pulled into V0.1 on request: an admin promotes a
member of a team they own to **Sub Admin**, a co-admin for that one team.

- **Same permissions as an admin**, scoped by `domain/access.ts` to the team they belong to (their
  managed team = their membership). They keep `tasks.selfReport` because they still do their own work.
- **They stay a team member** (the user asked for "both"): still in the team roster, still counted in
  team headcount and reports, with a real `SUB_ADMIN` role label everywhere.
- **Limits:** cannot appoint other Sub Admins (delegation never chains), cannot create/edit/deactivate
  people or edit the team, and **cannot manage their own admin's tasks** — `canManageTask` takes the
  assignee's role for exactly this.
- Only the team's owning admin and the Super Admin appoint or remove a Sub Admin (`users.delegate`).
- Found and fixed during verification: the read model said `canEdit: false` on the admin's task, but the
  mock handlers called the planners without `assigneeRole`, so the write path allowed the edit. The
  argument is now **required** on `planTaskUpdate` / `planStatusChange` / `planReassign` /
  `planProgressUpdate` and on `canManageTask`, so a caller cannot silently skip the check — a
  regression test covers it (`domain/delegation.test.ts`). Phase B must pass it from the joined row.

## Phase B — backend status (16 Sep 2026)

`backend/` is a running NestJS 12 API on `/api/v1`, seeded from `@zemp/shared/seed`, with 51 routes
mapped. It is **ESM** (NestJS 12 and `@zemp/shared` are both ESM), so relative imports carry `.js`.

**Done and verified live:** auth (argon2id, HttpOnly session + double-submit CSRF, change/reset
password), tasks (list/filter/sort/page, create, update, progress, status, reassign, activity,
comments), reviews (self-report, queue, approve/request changes, resubmit, reviewer options), people
(employees, admins, account status, reset links, Sub Admin delegation), teams (+ members and org
chart), notifications, audit log, settings, health (live/ready), Swagger at `/api/v1/docs`.

**Cross-cutting:** request id + structured logs, throttling (tighter on auth), global auth guard
(endpoints are protected unless marked `@Public()`), Zod validation from the shared schemas, the
`{success, data, meta}` envelope, and an exception filter that maps `DomainError` to its status and
never leaks a stack trace.

**Still to write:** the **reports module** — `/dashboard/summary`, `/dashboard/attention`,
`/reports/daily`, `/reports/progress`, `/activity`. Port `frontend/src/mocks/handlers/reports.ts`
(`resolveScope`, `livePeople`/`liveTeams`, snapshot sums for past days) onto `StoreService`.

**Phase C note:** `StoreService` is the only thing that touches data. Swapping it for Prisma-backed
repositories is the whole of Phase C's integration work; services and controllers do not change.
Sessions and password-reset tokens also move from maps to tables.

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
- [x] Self-reported work: employee logs completed work and picks a reviewer · reviewer queue at `/reviews`
      (approve / ask for changes) · revise and resubmit · dashboard banner · notifications, activity and audit
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

**Next: finish Phase B** (the reports module), then **Phase C** — NestJS 12 backend implementing the same `/api/v1` contract with the `@zemp/shared` planners, then Phase D deletes `frontend/src/mocks` and `frontend/src/app/api/v1`.

## Demo data (from the user's `Demo_Data.xlsx`, 16 Sep 2026)

The seeded organization is the CXO team from the sheet — the previous fictional org (John Carter, Rock
Alvarez and the 30 employees) is gone, along with the §36 "1 Super Admin, 3 admins, 10 employees each"
shape and the §10 sprint fixture. Task history, comments, activity, notifications and snapshots are
still generated for these people so the dashboards and reports have something to show.

| Sheet role | Seeded as | Email | Code |
|---|---|---|---|
| Super Admin | `SUPER_ADMIN`, no team | test@example.com | MOB0000 |
| Super Admin/Admin | `SUPER_ADMIN` **and** a member of CXO — Super Admin already carries every admin power, so this one account runs the org and works in the team | dipro@example.com | MOB0001 |
| Admin | `ADMIN`, **owns** CXO | shivansh@example.com | MOB0002 |
| Employe | `EMPLOYEE` in CXO | neeraj@example.com | MOB0003 |
| Employe | `EMPLOYEE` in CXO | saurav@example.com | MOB0004 |

- Password for every account is the sheet's `1234567890` (seed data only). **It does not satisfy ZEMP's
  own password rule** (10+ chars with a letter and a number) — sign-in accepts it, but changing a
  password in-app requires a stronger one. Worth replacing before this data goes anywhere real.
- `phone` was added to the user record and shows on the employee profile; people created through the UI
  have no phone yet (the create/edit forms don't collect one).

## Environment notes

- An ECC GateGuard hook denies the first write to every new file until facts are stated; set `ECC_GATEGUARD=off` to speed up large builds.
