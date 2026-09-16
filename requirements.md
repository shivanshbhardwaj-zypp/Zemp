# ZEMP V0.1 — Requirements & Architecture

> **Product:** ZEMP (formerly BompVP)  
> **Version:** V0.1 MVP  
> **Document:** Product Requirements, Technical Requirements & System Architecture  
> **Status:** Development specification  
>
> **Important:** This document intentionally contains **no frontend visual design, UI styling, theme, color, typography, or component-design specification**. All frontend decisions must be coordinated through `Frontend.md`.

---

## 1. Product Vision

ZEMP V0.1 is an internal office management platform centered on:

1. Employee and team management
2. Hierarchical admin management
3. Task assignment and execution
4. Deadline and workload tracking
5. Daily progress reporting
6. Team and employee performance visibility
7. Permission-controlled access
8. A foundation that can later expand into a complete office management system

The V0.1 objective is to create a reliable operational core rather than attempting to build every HR/office feature immediately.

---

# 2. Core Organizational Model

ZEMP uses a hierarchical organization model.

### Example

```text
Super Admin: John
│
├── Admin: Rock
│   ├── Employee 1
│   ├── Employee 2
│   ├── ...
│   └── Employee 10
│
├── Admin: Bruce
│   ├── Employee 1
│   ├── Employee 2
│   ├── ...
│   └── Employee 10
│
└── Admin: Clark
    ├── Employee 1
    ├── Employee 2
    ├── ...
    └── Employee 10
```

John can:

- Manage Rock, Bruce and Clark
- Manage employees under any team
- Assign tasks to admins
- Assign tasks directly to employees
- View organization-wide reports
- Reassign/override tasks
- Manage organization structure

Rock, Bruce and Clark can:

- Manage their own team members
- Assign tasks to their permitted employees
- View their team's progress
- View their team's reports
- Manage their employees within their permission scope

Employees can:

- View their assigned tasks
- Update task progress
- Update status
- Add comments
- Complete tasks
- View their own task history

---

# 3. User Roles

## 3.1 Super Admin

The Super Admin is the highest privileged operational user.

### Required capabilities

- Create admins
- Edit admins
- Deactivate admins
- Reset/administer admin access
- Create employees
- Edit employees
- Deactivate employees
- Create/manage teams
- Assign admins to teams
- Move employees between teams
- Assign tasks to admins
- Assign tasks directly to employees
- Reassign any task
- View all tasks
- View all reports
- View organization-wide metrics
- View team-level metrics
- View employee-level metrics
- Access audit logs
- Manage system-level settings
- Manage permissions where supported

There should be only one logical Super Admin authority in V0.1 unless the architecture explicitly supports multiple Super Admins later.

---

## 3.2 Admin

Admins are scoped managers.

### Required capabilities

- View their own profile
- View permitted team members
- Create tasks for permitted team members
- Assign tasks to permitted team members
- Edit permitted tasks
- Reassign permitted tasks
- View task progress
- View daily reports
- View employee progress
- View team progress
- See overdue tasks
- See upcoming deadlines
- Add task comments where permitted

### Restrictions

An Admin must not:

- Access another admin's private team data
- Modify another admin's team members without permission
- Manage Super Admin
- Change organization-wide security settings
- Access unrestricted organization-wide reports unless explicitly granted
- Assign tasks outside their permission scope

---

## 3.3 Employee

### Required capabilities

- Securely log in
- View own profile
- View assigned tasks
- View task details
- Update task status
- Update progress percentage
- Add comments
- Add completion notes
- Mark work complete
- View own completed tasks
- View upcoming and overdue tasks

### Restrictions

Employees must not:

- Assign tasks
- Change task ownership
- Modify other employees
- View private information of other employees
- Access admin reports
- Change permissions

---

# 4. Employee Data Requirements

Minimum employee record:

| Field | Required | Notes |
|---|---|---|
| Employee ID | Yes | Unique organization identifier |
| Name | Yes | Full name |
| Email | Yes | Unique login/contact identifier |
| Team | Yes | Current team |
| Role | Yes | Job/organizational role |
| System Role | Yes | Super Admin / Admin / Employee |
| Manager/Admin | Yes where applicable | Reporting relationship |
| Status | Yes | Active / Inactive |
| Created At | Yes | Audit |
| Updated At | Yes | Audit |

Future-compatible fields can include phone, joining date, location, employment type, etc., but should not complicate V0.1 unnecessarily.

---

# 5. Team Requirements

A team should be a separate entity.

### Team fields

- Team ID
- Team name
- Description
- Team owner/admin
- Parent organizational scope if needed
- Active/inactive status
- Created at
- Updated at

A team should not be represented only as a text field on an employee.

This allows:

- Team reassignment
- Team reporting
- Team-level permissions
- Multiple teams
- Future departments
- Team history

---

# 6. Task Management

Tasks are the central operational entity.

## 6.1 Required task fields

- Task ID
- Title
- Description
- Assignor ID
- Assignee ID
- Team ID
- Priority
- Status
- Progress percentage
- Start date/time
- Due date/time
- Completion date/time
- Created date/time
- Updated date/time
- Completion note
- Parent task ID (optional/future-ready)
- Created by
- Updated by

---

# 7. Task Status

V0.1 should use a controlled status model:

```text
TODO
IN_PROGRESS
BLOCKED
COMPLETED
CANCELLED
```

Status transitions must be validated by the backend.

Example:

```text
TODO → IN_PROGRESS
IN_PROGRESS → BLOCKED
BLOCKED → IN_PROGRESS
IN_PROGRESS → COMPLETED
TODO → CANCELLED
IN_PROGRESS → CANCELLED
```

Do not allow arbitrary client-side status values.

---

# 8. Task Priority

V0.1:

```text
LOW
MEDIUM
HIGH
URGENT
```

Priority should be independently stored from status.

---

# 9. Progress Tracking

Every active task should have a progress value:

```text
0–100%
```

Rules:

- New task defaults to 0%
- Completed task must be 100%
- A task at 100% should normally be COMPLETED
- Negative values are invalid
- Values above 100 are invalid
- Backend must validate progress
- Progress updates should be auditable

---

# 10. Example: 30 Tasks × 3 Employees

Suppose:

```text
Employee A → 30 tasks
Employee B → 30 tasks
Employee C → 30 tasks

Deadline → 5 days
```

On Day 1:

```text
Employee A → 4 completed
Employee B → 2 completed
Employee C → 0 completed
```

The system should calculate:

### Employee A

```text
Completed = 4
Total = 30
Completion = 13.33%
Remaining = 26
```

### Employee B

```text
Completed = 2
Total = 30
Completion = 6.67%
Remaining = 28
```

### Employee C

```text
Completed = 0
Total = 30
Completion = 0%
Remaining = 30
```

### Team/assignment summary

```text
Total assigned = 90
Completed = 6
Remaining = 84
Overall completion = 6.67%
```

The dashboard/reporting layer should derive these metrics from task data rather than storing manually calculated totals.

---

# 11. Deadline & Overdue Logic

A task becomes overdue when:

```text
current_time > due_date
AND status != COMPLETED
AND status != CANCELLED
```

The backend should determine overdue state.

Do not rely solely on a frontend timer.

The system should expose:

- Due today
- Due tomorrow
- Upcoming
- Overdue
- Completed on time
- Completed late

---

# 12. Daily Reporting

Daily reporting is a core V0.1 feature.

## Daily report should show

### Organization level

- Total active employees
- Total active admins
- Tasks assigned today
- Tasks completed today
- Tasks currently in progress
- Tasks blocked
- Tasks overdue
- Overall completion percentage
- Deadline risk
- Activity summary

### Team level

- Team task count
- Completed tasks
- Pending tasks
- In-progress tasks
- Blocked tasks
- Overdue tasks
- Completion rate
- Employee-by-employee progress

### Employee level

- Tasks assigned
- Tasks completed
- Tasks remaining
- Tasks overdue
- Completion percentage
- Progress updates
- Blocked tasks
- Upcoming deadlines
- Daily activity

---

# 13. Daily Progress Snapshot

The system should preserve historical reporting.

Example:

```text
Day 1
A: 4/30
B: 2/30
C: 0/30

Day 2
A: 10/30
B: 7/30
C: 4/30

Day 3
A: 18/30
B: 13/30
C: 9/30
```

This allows the system to answer:

- How much was completed today?
- How much was completed yesterday?
- Is productivity increasing/decreasing?
- Is an employee/team on track for the deadline?
- Which tasks are falling behind?

Daily snapshots or immutable activity events should be used where needed rather than reconstructing historical state from only the current task record.

---

# 14. Workload & Deadline Risk

V0.1 should calculate basic workload indicators.

For an assignment:

```text
remaining_tasks = total_tasks - completed_tasks
remaining_days = due_date - current_date
required_daily_rate = remaining_tasks / remaining_days
```

This can produce a simple risk classification:

```text
ON_TRACK
AT_RISK
OVERDUE
COMPLETED
```

This is an operational indicator, not a judgment of employee quality.

---

# 15. Task Activity / Audit History

Task changes should be traceable.

Record events such as:

- Task created
- Task assigned
- Task reassigned
- Priority changed
- Due date changed
- Status changed
- Progress changed
- Comment added
- Task completed
- Task reopened
- Task cancelled

Each event should contain:

- Event ID
- Task ID
- Actor ID
- Event type
- Previous value where relevant
- New value where relevant
- Timestamp

---

# 16. Comments

Tasks should support comments.

Minimum comment fields:

- Comment ID
- Task ID
- Author ID
- Comment body
- Created at
- Updated at
- Deleted/edited state if supported

V0.1 does not need a complex messaging system.

---

# 17. Authentication

Authentication must be backend-controlled.

Minimum requirements:

- Login
- Logout
- Password hashing
- Secure session/token handling
- Authentication middleware
- Role-based authorization
- Account activation/deactivation
- Password reset architecture

Never store plaintext passwords.

---

# 18. Authorization / RBAC

Use server-side authorization.

A user's permissions should be determined by:

```text
System role
+
Organization scope
+
Team scope
+
Resource ownership
```

Example:

```text
Super Admin
→ all organization resources

Admin Rock
→ Rock's permitted team/resources

Employee A
→ own assigned resources
```

Never trust role information supplied by the client.

---

# 19. Recommended Permission Model

Keep role and permission separate.

Example permissions:

```text
users.read
users.create
users.update
users.deactivate

teams.read
teams.create
teams.update
teams.delete

tasks.read
tasks.create
tasks.assign
tasks.update
tasks.reassign
tasks.complete
tasks.delete

reports.read
reports.organization
reports.team
reports.employee

audit.read

settings.read
settings.update
```

Roles can map to these permissions.

This makes future custom roles possible without redesigning authorization.

---

# 20. Audit Logging

Important administrative actions must be logged.

At minimum:

- Login/logout
- Failed login attempts
- Employee created/updated/deactivated
- Admin created/updated/deactivated
- Team changes
- Task assignment/reassignment
- Permission changes
- Due-date changes
- Task deletion/cancellation
- Security-sensitive changes

Audit logs should be append-oriented and protected from ordinary users.

---

# 21. Notifications — V0.1 Foundation

The architecture should be notification-ready.

V0.1 may implement in-app notifications for:

- New task assigned
- Task reassigned
- Deadline approaching
- Task overdue
- Task completed
- Task blocked
- Important comment/activity

Email, WhatsApp, Slack and Teams can be future integrations.

---

# 22. Search, Filtering & Sorting

The backend should support efficient filtering for:

- Employee
- Team
- Admin
- Status
- Priority
- Due date
- Date range
- Completion state
- Overdue state
- Assignment date

Search should be designed for pagination and large datasets.

---

# 23. Pagination

Do not return unlimited records.

Use server-side pagination for:

- Employees
- Tasks
- Teams
- Reports where applicable
- Audit logs
- Activity history

API responses should expose enough metadata for the client to paginate.

---

# 24. Data Integrity Rules

Backend must enforce:

- Unique Employee ID
- Unique login email
- Valid team references
- Valid user references
- Valid task references
- Valid status
- Valid priority
- Progress 0–100
- Due date cannot violate defined business rules
- Inactive users cannot receive new tasks unless explicitly allowed
- Unauthorized users cannot access resources outside their scope
- Completed tasks cannot silently become incomplete without an auditable action

Use database constraints wherever possible.

---

# 25. Suggested Technical Stack

## Frontend

The frontend stack is intentionally delegated to:

```text
Frontend.md
```

The frontend implementation must coordinate with `Frontend.md` and must not invent a conflicting architecture.

Do not place frontend styling/theme decisions in this document.

## Backend

Recommended:

```text
TypeScript
Node.js
NestJS
```

Why:

- Strong architecture
- Type safety
- Dependency injection
- Modular structure
- Guards/interceptors
- Validation
- Scalable API architecture

## Database

Recommended:

```text
PostgreSQL
```

ORM:

```text
Prisma
```

PostgreSQL should be the source of truth for transactional application data.

## Authentication

Recommended:

```text
JWT or secure session-based authentication
Argon2id or bcrypt for password hashing
```

Prefer secure, HTTP-only cookie-based session/token handling when appropriate for the chosen frontend architecture.

## Validation

Recommended:

```text
class-validator / class-transformer
```

or another strongly typed backend validation layer consistent with NestJS.

## API

Recommended:

```text
REST API
```

with clear versioning:

```text
/api/v1/...
```

A future GraphQL layer can be added if required, but should not be introduced merely for V0.1 complexity.

## Caching / Queue Infrastructure

Keep the architecture ready for:

```text
Redis
BullMQ
```

Use them when asynchronous jobs or notification processing become necessary.

Do not add infrastructure without a concrete V0.1 need.

## Testing

Recommended:

```text
Unit tests
Integration tests
API/e2e tests
```

Primary backend testing:

```text
Jest
Supertest
```

## API Documentation

Recommended:

```text
OpenAPI / Swagger
```

The API contract should be generated/maintained from the backend.

## Code Quality

Recommended:

```text
TypeScript strict mode
ESLint
Prettier
Husky
lint-staged
```

---

# 26. Architecture

Use a modular monolith for V0.1.

Do **not** start with microservices.

Recommended:

```text
                    ┌──────────────────┐
                    │     Frontend     │
                    │  See Frontend.md │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   REST API v1    │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │   Auth &   │ │   Task &   │ │ Reporting  │
       │   RBAC     │ │   Workflow │ │  Service   │
       └────────────┘ └────────────┘ └────────────┘
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                    ┌──────────────────┐
                    │    PostgreSQL    │
                    └──────────────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
                 Redis            Job Queue
              (when needed)      (when needed)
```

---

# 27. Backend Module Structure

Recommended:

```text
backend/
├── src/
│   ├── auth/
│   ├── users/
│   ├── employees/
│   ├── admins/
│   ├── teams/
│   ├── tasks/
│   ├── task-activity/
│   ├── comments/
│   ├── reports/
│   ├── notifications/
│   ├── audit/
│   ├── permissions/
│   ├── common/
│   ├── database/
│   └── app.module.ts
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed/
│
├── test/
├── package.json
└── ...
```

Do not create modules simply because they sound enterprise-like. Every module should have a clear domain responsibility.

---

# 28. Domain Relationships

Conceptually:

```text
Organization
   │
   ├── Teams
   │     │
   │     └── Employees
   │
   ├── Admins
   │
   └── Tasks
          │
          ├── Assignor
          ├── Assignee
          ├── Team
          ├── Activity
          └── Comments
```

A user account and employee profile should be logically separable.

This makes future support for non-employee administrative accounts easier.

---

# 29. Core Database Entities

Minimum V0.1 entities:

```text
User
EmployeeProfile
Team
TeamMembership
Role
Permission
RolePermission
Task
TaskActivity
TaskComment
DailyProgressSnapshot
Notification
AuditLog
```

Depending on implementation, Admin may be represented by `User + Role` rather than a separate Admin table.

Prefer normalized relational modeling over duplicated role-specific data.

---

# 30. API Structure

Example:

```text
/api/v1/auth/login
/api/v1/auth/logout
/api/v1/auth/me

/api/v1/users
/api/v1/users/:id

/api/v1/employees
/api/v1/employees/:id

/api/v1/teams
/api/v1/teams/:id
/api/v1/teams/:id/members

/api/v1/tasks
/api/v1/tasks/:id
/api/v1/tasks/:id/progress
/api/v1/tasks/:id/status
/api/v1/tasks/:id/comments
/api/v1/tasks/:id/activity

/api/v1/reports/daily
/api/v1/reports/teams/:id
/api/v1/reports/employees/:id

/api/v1/notifications
/api/v1/audit-logs
```

Exact endpoints may change during implementation if a better REST design is justified.

---

# 31. Reporting Architecture

Reports should be derived from authoritative task/activity data.

Avoid storing every dashboard number as independently editable data.

Use:

```text
Task state
+
Task activity
+
Date/time
+
Team/user relationships
```

to calculate reports.

For expensive reports, introduce:

```text
DailyProgressSnapshot
```

or materialized/aggregated data later.

---

# 32. Time & Date Handling

Store timestamps in UTC.

Convert to the organization's/user's timezone at presentation/reporting boundaries.

Never mix local timestamps and UTC inconsistently.

Every task deadline must have an unambiguous timezone interpretation.

---

# 33. Error Handling

API errors should use a consistent format.

Example:

```json
{
  "success": false,
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task could not be found."
  }
}
```

Do not leak stack traces or internal database details to clients.

---

# 34. Security Requirements

Minimum:

- Password hashing
- Authentication middleware
- Authorization guards
- Input validation
- SQL injection protection through ORM/parameterization
- XSS-aware output handling
- CSRF protection where cookie auth requires it
- Rate limiting on authentication endpoints
- Secure headers
- Secure cookie configuration where applicable
- Audit logging
- No secrets committed to Git
- Environment variables for secrets
- Production error sanitization

---

# 35. Environment Management

Use separate environments:

```text
development
test
production
```

Use environment variables for:

```text
DATABASE_URL
AUTH_SECRET
REDIS_URL
EMAIL credentials
other integrations
```

Provide:

```text
.env.example
```

Never commit real secrets.

---

# 36. Seed Data

Development seed data should create:

```text
1 Super Admin
3 Admins
10 employees per Admin
Sample teams
Sample tasks
Sample task activity
```

This should allow developers to immediately demonstrate:

- Hierarchy
- Task assignment
- Daily progress
- Reporting
- Permission boundaries

Seed data must never contain real credentials or production secrets.

---

# 37. MVP Acceptance Criteria

V0.1 is functionally complete when:

### Organization

- Super Admin can create/manage admins
- Super Admin can create/manage employees
- Teams can be created and managed
- Employees can belong to appropriate teams
- Admin hierarchy is enforceable

### Tasks

- Authorized users can create tasks
- Admins can assign only within their scope
- Super Admin can assign broadly
- Employees can update their own task progress
- Status transitions are validated
- Deadlines work correctly
- Overdue tasks are detected

### Reports

- Daily report works
- Team report works
- Employee report works
- Completion percentages are accurate
- Remaining workload is accurate
- Historical progress can be viewed

### Security

- Authentication works
- Authorization is enforced server-side
- Unauthorized resources cannot be accessed by changing IDs
- Sensitive actions are audited

### Reliability

- Validation exists
- Error handling is consistent
- Database migrations work
- Seed data works
- Tests cover critical business logic

---

# 38. Explicitly Out of Scope for V0.1

Do not expand V0.1 into a full HRMS unless separately approved.

Not required initially:

- Payroll
- Salary management
- Recruitment/ATS
- Full attendance system
- Biometric integration
- Advanced leave management
- Expense management
- Performance appraisal workflows
- Complex OKR system
- Employee benefits
- Asset management
- Full CRM
- Full project management suite
- AI employee scoring
- Surveillance/productivity tracking
- Complex chat/messaging
- WhatsApp automation
- Advanced calendar integration

Architecture may remain future-compatible with these.

---

# 39. Future V0.2+ Roadmap Candidates

Potential later modules:

```text
Attendance
Leave
Calendar
Goals / OKRs
Performance reviews
Employee documents
Approvals
Expense management
Asset management
Announcements
Internal chat
Notifications
Email/Slack/Teams integration
AI daily summaries
AI task planning
Workload forecasting
Advanced analytics
Organization charts
Custom workflows
Custom roles
Mobile app
```

These should be added incrementally.

---

# 40. Frontend Coordination Rule

This is mandatory:

> **All frontend implementation must coordinate with `Frontend.md`.**

`requirements.md` defines:

- Product behavior
- Domain model
- Business rules
- Backend requirements
- API requirements
- Architecture
- Security
- Data requirements

`Frontend.md` defines:

- Frontend architecture
- UI/UX
- Components
- Layout
- Visual system
- Theme
- Responsive behavior
- Frontend interaction patterns
- Frontend implementation conventions

If these documents conflict, stop and resolve the conflict rather than silently choosing one.

---

# 41. Development Principle

Build V0.1 as a strong foundation, not as a throwaway prototype.

Priorities:

```text
Correctness
Security
Clear architecture
Maintainability
Simple implementation
Testability
Extensibility
```

Avoid:

```text
Premature microservices
Unnecessary dependencies
Duplicated state
Hardcoded business rules
Frontend-only authorization
Over-engineering
```

---

# 42. Definition of Done

A feature is not done merely because its code exists.

A feature is done when:

1. Requirements are understood
2. Existing implementation is inspected
3. Data model is correct
4. Backend logic exists
5. Authorization is enforced
6. Validation exists
7. Error cases are handled
8. Tests cover important behavior
9. API contract is documented where applicable
10. Frontend is coordinated through `Frontend.md`
11. Existing functionality still works
12. Changes are integrated without unnecessary rewrites
13. The project can be continued from the current state by another developer/agent

---

# 43. Source of Truth Hierarchy

When implementing ZEMP:

```text
Product requirement
      ↓
requirements.md
      ↓
Frontend.md for frontend-specific decisions
      ↓
Existing implementation
      ↓
Task/phase instructions
      ↓
Code changes
```

The actual existing code is always inspected before modifying it.

