# Frontend.md — ZEMP V0.1 Frontend System & UI Specification

> **Product:** ZEMP (formerly BompVP)  
> **Version:** V0.1  
> **Purpose:** Authoritative frontend architecture, UX, visual language, wireframes, responsive rules, component system, interaction behavior, and implementation standards.
>
> **Related documents**
> - `requirements.md` — product/domain/backend requirements and business rules
> - `CLAUDE.md` — master development controller and skill orchestration
>
> **Reference design:** The reference screenshot `SAMPLE UI.webp` is the visual direction for the product. The screenshot is a visual reference, not a requirement to copy unrelated HR-specific content. Its visual language must be adapted to ZEMP's employee/task/reporting product model.

---

# 1. FRONTEND NORTH STAR

ZEMP V0.1 should feel like a polished modern internal operations platform:

```text
Clean
Calm
Professional
Fast
Lightweight
Data-dense without feeling crowded
Soft rather than harsh
Minimal rather than decorative
Operational rather than marketing-oriented
```

The reference UI establishes the visual direction:

- Large rounded application shell
- Very light neutral workspace
- Warm coral/orange accent
- Soft shadows
- Rounded cards
- Thin separators
- Compact iconography
- Generous whitespace
- Clear hierarchy
- Data tables as a major interaction surface
- Left vertical navigation
- Top utility/navigation area
- Metric cards
- Rounded status badges
- Minimal visual noise
- Small, controlled use of accent color
- Friendly but professional visual tone

Do not turn the application into a colorful consumer dashboard.

---

# 2. ABSOLUTE FRONTEND COORDINATION RULE

`Frontend.md` is authoritative for frontend implementation.

However:

```text
requirements.md
    ↓
defines WHAT the system does

Frontend.md
    ↓
defines HOW the frontend presents and interacts with it

CLAUDE.md
    ↓
defines HOW Claude develops and maintains it
```

If a frontend decision conflicts with a backend/business rule in `requirements.md`, the business rule wins.

If a visual/design decision is not defined in `requirements.md`, use this file.

If the existing project already implements a pattern that is compatible with this specification, reuse it rather than rebuilding it.

---

# 3. REFERENCE SCREENSHOT ANALYSIS

The reference screenshot shows a desktop employee-management dashboard.

The important visual characteristics to preserve are:

## 3.1 Overall canvas

The outer background uses a warm abstract gradient/shape treatment.

Approximate visual direction:

```text
Coral / orange
→ peach
→ warm pale orange
```

with additional soft pink/red/yellow abstract forms.

For the actual ZEMP application shell:

- The abstract outer background may be used as a product-shell backdrop on the main desktop experience.
- It must remain visually subordinate to application content.
- The core application surface must remain neutral and highly readable.
- Do not place critical text directly on complex gradients.

Recommended outer colors:

```text
#FA6147
#FC8664
#FDB08A
#FBC0A0
#FFDF5A
#FF3B55
#F08BFF
```

These are reference-direction values rather than rigid requirements for every pixel.

---

# 4. COLOR SYSTEM

## 4.1 Primary brand/accent

Primary coral:

```text
--color-primary: #FA6147
```

Reference screenshot's strongest UI accent is approximately this coral/orange.

Supporting accent:

```text
--color-primary-hover: #F45138
--color-primary-active: #E9462F
--color-primary-soft: #FFF0EC
--color-primary-muted: #FDE0D8
```

Use the primary accent for:

- Primary CTA
- Active navigation item
- Important interactive controls
- Selected states
- Key progress indicators
- Focus accents
- Important links where appropriate

Do not use the primary accent for every interactive element.

---

# 5. NEUTRAL COLOR SYSTEM

The application should be predominantly neutral.

```text
--color-white: #FFFFFF
--color-background: #F6F5F8
--color-surface: #FFFFFF
--color-surface-subtle: #FBFBFC
--color-surface-muted: #F3F2F5

--color-border: #E9E7EA
--color-border-subtle: #F0EEF1
--color-border-strong: #DDD9DE

--color-text-primary: #161616
--color-text-secondary: #5F5C61
--color-text-muted: #858087
--color-text-disabled: #AAA6AB
```

### Usage

Primary text:

```text
#161616
```

Use for:

- Page titles
- Employee names
- Task titles
- Important metrics
- Navigation labels when active

Secondary:

```text
#5F5C61
```

Use for:

- Descriptions
- Table metadata
- Supporting labels
- Secondary navigation

Muted:

```text
#858087
```

Use sparingly for:

- Timestamps
- Helper text
- Non-critical metadata

---

# 6. SEMANTIC COLORS

## Success

```text
--success: #2EAA72
--success-soft: #E8F8F0
--success-border: #C9EEDC
```

Use for:

- Completed
- Active
- On track
- Positive change
- Successful actions

## Warning

```text
--warning: #D9902F
--warning-soft: #FFF3DF
--warning-border: #F5D7A9
```

Use for:

- At risk
- Deadline approaching
- Warning states

## Danger

```text
--danger: #E85C58
--danger-soft: #FDECEC
--danger-border: #F4CACA
```

Use for:

- Overdue
- Failed
- Destructive action
- Deactivated

## Info

```text
--info: #5D78D6
--info-soft: #EEF1FF
--info-border: #D7DFFF
```

Use for:

- Informational state
- Neutral system information
- Explanatory indicators

## Blocked

```text
--blocked: #8A6BC1
--blocked-soft: #F2EDFB
```

Use for blocked tasks and dependency-related states.

---

# 7. COLOR USAGE RATIO

Target visual balance:

```text
~75–85% neutral surfaces
~10–15% subtle neutral variations
~3–8% semantic/accent colors
```

Accent should guide attention, not dominate the interface.

Avoid:

- Rainbow dashboards
- Large colored backgrounds behind data
- Excessive colored badges
- Using success green for decoration
- Using red simply because it looks visually strong

Color must communicate meaning.

---

# 8. TYPOGRAPHY

Use a modern neutral sans-serif.

Preferred:

```text
Inter
```

Fallback:

```text
system-ui
-apple-system
BlinkMacSystemFont
"Segoe UI"
sans-serif
```

The exact font can be changed if `Frontend.md` implementation standards elsewhere establish a different system.

## Type scale

### Page title

```text
24–30px
font-weight: 600–700
line-height: 1.2
```

### Section title

```text
18–22px
font-weight: 600
```

### Card title

```text
15–17px
font-weight: 600
```

### Body

```text
14px
font-weight: 400–500
line-height: 1.45–1.6
```

### Table text

```text
13–14px
```

### Supporting metadata

```text
12–13px
```

### KPI number

```text
30–34px
font-weight: 600–700
```

Do not use excessively large headings inside operational screens.

---

# 9. FONT WEIGHTS

Use a restrained weight system:

```text
400 — Regular
500 — Medium
600 — Semibold
700 — Bold
```

Preferred:

```text
400 → body
500 → labels
600 → headings
700 → major KPI values / rare emphasis
```

Avoid 800/900 unless a specific visual requirement warrants it.

---

# 10. SPACING SYSTEM

Use a consistent 4px base.

```text
4px
8px
12px
16px
20px
24px
32px
40px
48px
64px
```

Recommended usage:

```text
4px  → icon/text micro gap
8px  → compact internal gap
12px → control gap
16px → standard component padding
20px → card/table padding
24px → section/card spacing
32px → major section spacing
40px+ → page-level separation
```

Do not use arbitrary values unless necessary.

---

# 11. BORDER RADIUS SYSTEM

The reference design relies heavily on rounded surfaces.

Use:

```text
--radius-xs: 6px
--radius-sm: 8px
--radius-md: 12px
--radius-lg: 16px
--radius-xl: 20px
--radius-2xl: 24px
--radius-pill: 999px
```

Recommended:

- Inputs: 10–12px
- Buttons: 10–12px
- Cards: 16px
- Main panels: 18–22px
- Status badges: pill
- Avatars: circular

Avoid rounding every small element excessively.

---

# 12. SHADOW SYSTEM

The screenshot uses extremely soft shadows.

Use:

```text
--shadow-card:
0 2px 12px rgba(20, 18, 20, 0.04);

--shadow-elevated:
0 8px 28px rgba(20, 18, 20, 0.08);

--shadow-modal:
0 18px 60px rgba(20, 18, 20, 0.14);
```

Keep shadows subtle.

Do not use heavy black drop shadows.

---

# 13. APPLICATION SHELL

The main application should use a desktop shell inspired by the reference.

Conceptually:

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         OUTER CANVAS                                │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    APP SHELL                               │   │
│   │                                                             │   │
│   │  ┌───────┐  ┌──────────────────────────────────────────┐   │   │
│   │  │       │  │ Top navigation / utility                 │   │   │
│   │  │       │  ├──────────────────────────────────────────┤   │   │
│   │  │ SIDE  │  │                                          │   │   │
│   │  │ NAV   │  │ Main page content                        │   │   │
│   │  │       │  │                                          │   │   │
│   │  │       │  │                                          │   │   │
│   │  │       │  │                                          │   │   │
│   │  └───────┘  └──────────────────────────────────────────┘   │   │
│   │                                                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

# 14. APPLICATION SHELL DIMENSIONS

Desktop target:

```text
Application max-width: ~1470px
Application min-height: calc(100vh - 48px)
Outer margin: ~24px
```

Reference visual:

```text
Large rounded shell
Centered horizontally
Generous outer breathing room
```

On very large displays, do not stretch content indefinitely.

Use:

```text
max-width: 1480px
margin-inline: auto
```

or an equivalent responsive constraint.

---

# 15. APP SHELL BACKGROUND

The application shell itself:

```text
background: #F6F5F8
```

or a very subtle neutral gradient.

Do not put strong decorative gradients behind data.

Outer canvas may contain the abstract warm gradient treatment.

---

# 16. LEFT SIDEBAR

The reference uses a compact vertical sidebar.

ZEMP should adapt it to:

```text
Brand / Logo
Workspace switcher if required
Dashboard
Tasks
Employees
Teams
Reports
Notifications
Settings
Profile / Logout
```

For role-based navigation:

### Super Admin

```text
Dashboard
Tasks
Employees
Teams
Admins
Reports
Audit Log
Notifications
Settings
```

### Admin

```text
Dashboard
Tasks
My Team
Reports
Notifications
Profile
```

### Employee

```text
My Dashboard
My Tasks
My Progress
Notifications
Profile
```

Navigation items the user cannot access must not be displayed merely as disabled decoration.

Prefer hiding unauthorized modules.

---

# 17. SIDEBAR STRUCTURE

```text
┌──────────────┐
│     LOGO     │
├──────────────┤
│              │
│  Dashboard   │
│  Tasks       │
│  Employees   │
│  Teams       │
│  Reports     │
│              │
│  ──────────  │
│  Admins      │  ← Super Admin only
│  Audit Log   │  ← permitted roles
│              │
│              │
│              │
│  Settings    │
│  Profile     │
│  Logout      │
└──────────────┘
```

The sidebar should not become a dense admin console.

---

# 18. SIDEBAR ITEM DIMENSIONS

Recommended:

```text
Height: 44–48px
Horizontal padding: 12–14px
Gap: 10–12px
Radius: 10–12px
Icon: 18–20px
Label: 13–14px
```

Active item:

```text
background: #FA6147
color: #FFFFFF
```

Inactive:

```text
background: transparent
color: #5F5C61
```

Hover:

```text
background: #F0EEF0
```

Do not make inactive navigation items colorful.

---

# 19. TOP BAR

The reference has a lightweight top utility bar.

ZEMP top bar:

```text
┌──────────────────────────────────────────────────────────────┐
│ Page context / breadcrumb        Search   Bell   Avatar      │
└──────────────────────────────────────────────────────────────┘
```

Possible contents:

- Breadcrumb
- Page title/context
- Global search
- Notifications
- User avatar
- User menu

Avoid placing too many controls here.

---

# 20. GLOBAL SEARCH

Search should eventually support:

```text
Employees
Tasks
Teams
```

V0.1 can start with context-specific search.

Visual:

```text
┌─────────────────────────────────────┐
│  🔍  Search...                      │
└─────────────────────────────────────┘
```

Recommended:

```text
height: 40–44px
radius: 12px
border: 1px solid #E9E7EA
background: #FFFFFF
```

---

# 21. DASHBOARD PRINCIPLE

The ZEMP dashboard should answer immediately:

```text
What is happening?
Who is responsible?
What is completed?
What is pending?
What is overdue?
Who is at risk?
What needs attention today?
```

Do not design the dashboard as a generic analytics page.

---

# 22. SUPER ADMIN DASHBOARD WIREFRAME

```text
┌───────────────────────────────────────────────────────────────┐
│ Dashboard                                      Date / filters │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│ │ Employees  │ │ Active     │ │ Tasks      │ │ Overdue    │ │
│ │ 120        │ │ 118        │ │ 240        │ │ 18         │ │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘ │
│                                                               │
│ ┌───────────────────────────────┐ ┌─────────────────────────┐ │
│ │ Task Progress                 │ │ Team Progress           │ │
│ │                               │ │                         │ │
│ │      progress visualization   │ │ Team A   ███████ 82%    │ │
│ │                               │ │ Team B   ██████  71%    │ │
│ │                               │ │ Team C   ████    54%    │ │
│ └───────────────────────────────┘ └─────────────────────────┘ │
│                                                               │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Today's Activity                                          │ │
│ │ Employee      Completed   In Progress   Blocked   Risk    │ │
│ │ ...                                                       │ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

---

# 23. ADMIN DASHBOARD WIREFRAME

Admin dashboard must be scoped to that admin's permitted teams.

```text
┌───────────────────────────────────────────────────────────────┐
│ My Team Dashboard                               Date / filter │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│ │ Team Size  │ │ Assigned   │ │ Completed  │ │ Overdue    │ │
│ │ 10         │ │ 90         │ │ 34         │ │ 7          │ │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘ │
│                                                               │
│ ┌──────────────────────────────┐ ┌──────────────────────────┐│
│ │ Team Completion              │ │ Employee Progress        ││
│ │                              │ │                          ││
│ │          67%                 │ │ Rock       78%            ││
│ │                              │ │ Bruce      62%            ││
│ └──────────────────────────────┘ └──────────────────────────┘│
│                                                               │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Tasks Requiring Attention                                 │ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

---

# 24. EMPLOYEE DASHBOARD WIREFRAME

Employee view should be simpler.

```text
┌───────────────────────────────────────────────────────────────┐
│ My Work                                                       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│ │ Assigned   │ │ Completed  │ │ In Progress│ │ Overdue    │ │
│ │ 30         │ │ 12         │ │ 14         │ │ 4          │ │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘ │
│                                                               │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Today's Progress                              40%          │ │
│ │ ████████████████░░░░░░░░░░░░░░░░                         │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ My Tasks                                                  │ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

---

# 25. KPI CARDS

Reference design uses four cards across the top.

ZEMP should use KPI cards for:

- Total Employees
- Active Employees
- Active Tasks
- Completed Today
- Overdue Tasks
- Team Completion
- At-Risk Tasks

Do not show every metric simultaneously.

Select based on role/page.

Card:

```text
background: #FFFFFF
border: 1px solid #F0EEF1
border-radius: 16px
padding: 20px
```

Approximate height:

```text
128–150px
```

---

# 26. KPI CARD WIREFRAME

```text
┌────────────────────────────────┐
│ Total Employees            ⓘ   │
│                                │
│ 120                            │
│                                │
│  ↑ +2    Increase from month  │
└────────────────────────────────┘
```

Information icon:

- Small
- Neutral
- Tooltip on hover/focus
- Never decorative if it has no explanation

---

# 27. KPI NUMBER RULE

Numbers should be the most visually prominent element inside KPI cards.

Hierarchy:

```text
Title        → small
Metric       → large
Comparison   → small
```

Example:

```text
Active Tasks
184

↑ +12
vs yesterday
```

Avoid:

```text
Huge metric + huge icon + huge badge
```

---

# 28. PROGRESS VISUALIZATION

Use simple visualizations.

V0.1 can use:

- Horizontal progress bars
- Circular progress indicators where useful
- Small trend lines
- Compact bar charts
- Tables

Do not introduce complicated chart types unless they provide useful information.

---

# 29. TASK PROGRESS BAR

Recommended:

```text
height: 7–8px
radius: 999px
background: #EEECEF
```

Completed:

```text
#2EAA72
```

In progress:

```text
#FA6147
```

At risk:

```text
#D9902F
```

Overdue:

```text
#E85C58
```

The color must match status semantics.

---

# 30. TASK MANAGEMENT PAGE

The task page is one of the most important V0.1 screens.

Wireframe:

```text
┌────────────────────────────────────────────────────────────────┐
│ Tasks                                      + Assign Task       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ┌────────────────────┐ ┌──────────┐ ┌─────────┐ ┌───────────┐│
│ │ Search tasks       │ │ Team ▼   │ │ Status ▼│ │ Date ▼    ││
│ └────────────────────┘ └──────────┘ └─────────┘ └───────────┘│
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ □ Task       Assignee   Priority  Status  Progress  Due  ⋮│ │
│ │                                                            │ │
│ │ □ Task A     Employee   High      Active   65%      Sep 15│ │
│ │ □ Task B     Employee   Medium    Done     100%     Sep 15│ │
│ │ □ Task C     Employee   Urgent    Blocked  40%      Sep 14│ │
│ └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

# 31. TASK TABLE

Columns should include:

```text
Checkbox
Task
Assignee
Team
Priority
Status
Progress
Due Date
Actions
```

Optional:

```text
Created By
Created Date
Updated
```

Do not force every possible field into the default table.

---

# 32. TABLE DESIGN

Reference screenshot uses:

- White surface
- Thin horizontal dividers
- Minimal vertical borders
- Compact rows
- Rounded outer container

Use:

```text
table container:
background: #FFFFFF
border: 1px solid #ECEAEC
border-radius: 16px
overflow: hidden
```

Header:

```text
background: #FFFFFF
font-size: 12–13px
font-weight: 600
color: #5F5C61
```

Rows:

```text
height: 52–60px
```

Divider:

```text
1px #F0EEF1
```

---

# 33. TABLE HOVER

Row hover:

```text
background: #FAFAFB
```

Do not use strong colored row backgrounds.

Selected row:

```text
background: #FFF6F3
```

with a subtle primary indication.

---

# 34. TASK STATUS BADGES

Use pill-shaped badges.

Example:

```text
[ To Do ]
[ In Progress ]
[ Blocked ]
[ Completed ]
[ Cancelled ]
```

Dimensions:

```text
height: 26–30px
padding: 0 10px
radius: 999px
font-size: 11–12px
font-weight: 500–600
```

Status styling:

```text
TODO
neutral

IN_PROGRESS
coral

BLOCKED
purple

COMPLETED
green

CANCELLED
neutral/red-muted
```

---

# 35. PRIORITY BADGES

Priority should be visually less dominant than status.

```text
Low       → neutral
Medium    → blue/info
High      → orange/warning
Urgent    → red/danger
```

Do not make every priority a large badge.

A small icon + label is sufficient.

---

# 36. ASSIGN TASK FLOW

Primary action:

```text
+ Assign Task
```

Opens a modal or side sheet.

Wireframe:

```text
┌─────────────────────────────────────────┐
│ Assign Task                         X   │
├─────────────────────────────────────────┤
│ Task title                              │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Description                             │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Assign to                               │
│ [ Employee ▼ ]                          │
│                                         │
│ Team                                    │
│ [ Team ▼ ]                              │
│                                         │
│ Priority       Due date                 │
│ [ Medium ▼ ]   [ Date ]                 │
│                                         │
│                 Cancel   Assign Task    │
└─────────────────────────────────────────┘
```

---

# 37. ASSIGNMENT PERMISSION UX

The frontend should filter assignment choices according to the user's scope.

Example:

Admin Rock:

```text
Assign to:
✓ Rock's permitted employees
✗ Bruce's employees
✗ Clark's employees
✗ other admins
```

Super Admin:

```text
Assign to:
✓ admins
✓ all employees
```

However:

> Frontend filtering is only a UX convenience. Backend authorization remains authoritative.

---

# 38. TASK DETAIL

Task detail should show:

```text
Task title
Description
Status
Progress
Priority
Assignee
Team
Created by
Start date
Due date
Completion date
Activity
Comments
```

Wireframe:

```text
┌───────────────────────────────────────────────────────────┐
│ Task title                                      ⋮          │
│ High priority • In Progress                              │
├───────────────────────────────────────────────────────────┤
│                                                           │
│ Description                                               │
│ ...                                                       │
│                                                           │
│ Progress                                      65%         │
│ ████████████████████░░░░░░░░                             │
│                                                           │
│ Assignee          Team          Due                        │
│ Employee A        Team Rock     Sep 15                    │
│                                                           │
├───────────────────────────────────────────────────────────┤
│ Activity                                                  │
│                                                           │
│ Employee A changed progress 40% → 65%                    │
│ Employee A added a comment                                │
│ Rock assigned task                                        │
│                                                           │
├───────────────────────────────────────────────────────────┤
│ Comments                                                  │
│ ...                                                       │
└───────────────────────────────────────────────────────────┘
```

---

# 39. EMPLOYEE MANAGEMENT PAGE

Adapt the reference screenshot's employee list.

Top-level:

```text
Employee List
Organization Chart
```

ZEMP should provide:

```text
Employees
Organization
```

or equivalent.

Employee KPI cards:

```text
Total Employees
Active Employees
Teams
Average Tasks / Employee
```

Avoid copying HR-specific metrics like tenure if they are not in V0.1 requirements.

---

# 40. EMPLOYEE TABLE

Recommended columns:

```text
Employee
Employee ID
Team
Role
Manager/Admin
Status
Active Tasks
Completion
Actions
```

Do not put email into the default table unless useful for the actual office workflow.

---

# 41. EMPLOYEE PROFILE

Employee profile:

```text
┌────────────────────────────────────────────────────────────┐
│ Avatar  Name                              Status             │
│         Role • Team • Employee ID                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Overview                                                   │
│                                                            │
│ Assigned      Completed      In Progress      Overdue      │
│ 30            12             14               4            │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ Current Tasks                                              │
├────────────────────────────────────────────────────────────┤
│ Recent Activity                                            │
└────────────────────────────────────────────────────────────┘
```

---

# 42. ORGANIZATION VIEW

Super Admin needs an organization view.

Wireframe:

```text
                         JOHN
                      Super Admin
                           │
          ┌────────────────┼────────────────┐
          │                │                │
        ROCK             BRUCE            CLARK
        Admin            Admin             Admin
          │                │                │
      Employees        Employees        Employees
```

Use:

- Nodes/cards
- Connecting lines
- Expand/collapse
- Employee count
- Team count
- Admin role labels

Do not make the organization chart the only way to manage hierarchy.

Tables/forms remain authoritative for operations.

---

# 43. DAILY REPORT PAGE

This is a core V0.1 page.

Top controls:

```text
Daily Report
[ Date ]
[ Team ]
[ Admin ]
[ Employee ]
```

Summary:

```text
Tasks assigned today
Tasks completed today
Tasks in progress
Tasks blocked
Tasks overdue
Overall completion
```

Then:

```text
Team progress
Employee progress
Task activity
At-risk workload
```

---

# 44. DAILY REPORT WIREFRAME

```text
┌─────────────────────────────────────────────────────────────┐
│ Daily Report                              Sep 14, 2026 ▼   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐│
│ │Assigned │ │Completed│ │Progress │ │Blocked  │ │Overdue ││
│ │ 90      │ │ 23      │ │ 25.6%   │ │ 5       │ │ 7      ││
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └────────┘│
│                                                             │
│ ┌──────────────────────────┐ ┌────────────────────────────┐ │
│ │ Progress Today           │ │ Team Comparison            │ │
│ │                          │ │                            │ │
│ │   trend / bars           │ │ Team A  ███████  78%       │ │
│ │                          │ │ Team B  █████    61%       │ │
│ └──────────────────────────┘ └────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Employee      Total   Done   Remaining  Progress  Risk  │ │
│ │ Employee A    30      12     18         40%       On    │ │
│ │ Employee B    30       7     23         23%       Risk  │ │
│ │ Employee C    30       4     26         13%       Risk  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

# 45. 5-DAY PROGRESS VIEW

For the user's 30-task/5-day example, the UI should make the progression obvious.

Example:

```text
                 Day 1   Day 2   Day 3   Day 4   Day 5
Employee A       4       10      18      25      30
Employee B       2       7       13      21      30
Employee C       0       4       9       17      30
```

Graphically:

```text
A  ████────────────── 13%
B  ██──────────────── 7%
C  ────────────────── 0%
```

As days progress:

```text
A  ████████████████
B  ███████████
C  ███████
```

The user should be able to switch between:

```text
Today
5-day period
Custom date range
```

---

# 46. ON-TRACK / AT-RISK UI

Use clear language:

```text
ON TRACK
AT RISK
OVERDUE
COMPLETED
```

Avoid subjective labels such as:

```text
Poor employee
Lazy
Low performer
Bad worker
```

The system tracks work progress, not personal worth.

---

# 47. REPORT TABLE RISK INDICATOR

Example:

```text
Employee A     80%     ON TRACK
Employee B     54%     AT RISK
Employee C     22%     AT RISK
```

Risk should be based on workload/deadline logic from `requirements.md`.

The frontend must display backend-provided risk state rather than inventing its own business formula.

---

# 48. ADMIN MANAGEMENT PAGE

Super Admin only.

Wireframe:

```text
┌─────────────────────────────────────────────────────────────┐
│ Admins                                      + Add Admin      │
├─────────────────────────────────────────────────────────────┤
│ Search   Team ▼   Status ▼                                  │
├─────────────────────────────────────────────────────────────┤
│ Admin     Team       Employees   Tasks   Status       ⋮     │
│ Rock      Team A     10          42      Active             │
│ Bruce     Team B     10          38      Active             │
│ Clark     Team C     10          31      Active             │
└─────────────────────────────────────────────────────────────┘
```

---

# 49. NOTIFICATIONS

Reference screenshot has a notification icon.

ZEMP should support:

```text
Task assigned
Task reassigned
Task completed
Task blocked
Deadline approaching
Task overdue
Important system notification
```

Notification panel:

```text
┌──────────────────────────────────────────┐
│ Notifications                            │
├──────────────────────────────────────────┤
│ ● Task assigned to you                   │
│   Complete homepage audit                 │
│   10 min ago                              │
│                                          │
│ ○ Task is due tomorrow                    │
│   2 hours ago                             │
│                                          │
│ ○ Employee completed a task               │
│   3 hours ago                             │
└──────────────────────────────────────────┘
```

Unread indicator should be subtle.

---

# 50. PROFILE MENU

Avatar opens:

```text
Name
Role
────────────────
Profile
Notifications
Settings
────────────────
Log out
```

Super Admin can have additional management options elsewhere; do not overload the avatar menu.

---

# 51. FORMS

Forms should feel lightweight and clear.

Standard:

```text
Label
Input
Helper/error text
```

Do not rely on placeholders as labels.

Example:

```text
Task title
[ Enter task title                         ]

Description
[ Describe what needs to be done           ]
[                                          ]

Due date
[ Sep 18, 2026                             ]
```

---

# 52. INPUT STYLE

```text
height: 40–44px
background: #FFFFFF
border: 1px solid #E5E2E6
border-radius: 10–12px
padding-inline: 12–14px
font-size: 13–14px
```

Focus:

```text
border-color: #FA6147
box-shadow: 0 0 0 3px #FFF0EC
```

Error:

```text
border-color: #E85C58
```

Disabled:

```text
background: #F3F2F5
color: #AAA6AB
```

---

# 53. BUTTON SYSTEM

## Primary

```text
background: #FA6147
color: #FFFFFF
```

Examples:

```text
+ Assign Task
+ Add Employee
Save
Create
```

## Secondary

```text
background: #FFFFFF
border: #E5E2E6
color: #161616
```

## Ghost

```text
background: transparent
color: #5F5C61
```

## Danger

```text
background: #E85C58
color: #FFFFFF
```

Use destructive buttons sparingly.

---

# 54. BUTTON DIMENSIONS

Default:

```text
height: 40px
padding: 0 14–16px
radius: 10–12px
font-size: 13–14px
font-weight: 500–600
```

Compact:

```text
height: 34–36px
```

Large primary:

```text
height: 44–48px
```

---

# 55. ICONOGRAPHY

Use one consistent icon family.

Recommended:

```text
Lucide
```

unless the existing project already uses another coherent library.

Icon rules:

```text
Default: 18px
Compact: 16px
Large action: 20px
```

Use stroke-based icons.

Avoid mixing:

- Filled icons
- Outlined icons
- Emoji
- Random SVG styles

in the same navigation system.

---

# 56. AVATARS

The reference uses circular employee avatars.

ZEMP:

```text
32px → compact table
36px → standard
40–48px → profile
64px+ → profile hero if needed
```

Fallback:

```text
Initials
```

Example:

```text
AB
```

Do not require a profile photo.

---

# 57. EMPTY STATES

Every major list needs a meaningful empty state.

Example:

```text
No tasks yet

Tasks assigned to your team will appear here.

[ Assign your first task ]
```

Avoid:

```text
No data.
```

unless genuinely appropriate.

---

# 58. LOADING STATES

Use skeletons for larger page regions.

Examples:

```text
KPI card skeleton
Table row skeleton
Profile skeleton
Report skeleton
```

Avoid blank screens while data loads.

Do not animate skeletons aggressively.

---

# 59. ERROR STATES

Page-level:

```text
Something went wrong

We couldn't load this report.

[ Try again ]
```

Form-level:

```text
Unable to create task.
Please correct the highlighted fields.
```

Do not expose backend stack traces.

---

# 60. TOASTS

Use small unobtrusive notifications.

Success:

```text
Task assigned successfully.
```

Error:

```text
Couldn't assign task.
```

Warning:

```text
This task is already overdue.
```

Do not show toasts for every trivial interaction.

---

# 61. MODALS

Use modals for:

- Short forms
- Confirmation
- Small focused actions

Use side sheets for:

- Task details
- Employee details
- Larger contextual workflows

Use full pages for:

- Dashboard
- Reports
- Task list
- Employee list
- Settings

---

# 62. DELETE / DEACTIVATE CONFIRMATION

Destructive actions require confirmation.

Example:

```text
Deactivate employee?

This will prevent the employee from receiving new tasks.

[Cancel] [Deactivate Employee]
```

Do not use:

```text
Are you sure?
```

without explaining the consequence.

---

# 63. TASK COMPLETION INTERACTION

When an employee completes a task:

```text
Update status
→ COMPLETED
→ progress automatically becomes 100%
→ completion timestamp recorded
→ activity event created
→ relevant notification generated
```

Frontend should reflect the state returned by backend.

---

# 64. PROGRESS EDITING

Employee may update:

```text
0–100%
```

Use either:

- Slider
- Numeric percentage
- Quick percentage buttons
- Combined control

Recommended:

```text
Progress
[──────●────────] 65%
```

Provide an accessible numeric input alternative.

---

# 65. STATUS TRANSITION UX

Do not present impossible status transitions.

Example:

If task is completed:

```text
Status: Completed
```

If reopening is permitted:

```text
Reopen task
```

should be explicit.

The frontend must not silently send arbitrary status values.

---

# 66. RESPONSIVE STRATEGY

Desktop is the primary reference.

Still support:

```text
Desktop
Tablet
Mobile
```

The information hierarchy must survive smaller screens.

---

# 67. DESKTOP BREAKPOINTS

Suggested:

```text
≥ 1440px  → large desktop
1200–1439 → desktop
992–1199  → compact desktop/tablet landscape
768–991   → tablet
<768      → mobile
```

Do not rely on exact breakpoints if the chosen CSS framework has an established system.

---

# 68. TABLET

At tablet widths:

- Sidebar may collapse
- KPI cards can become 2-column
- Tables can scroll horizontally
- Filters may wrap
- Secondary metadata can be hidden
- Primary actions remain visible

Do not squeeze 8 table columns into an unreadable width.

---

# 69. MOBILE

At mobile widths:

```text
Desktop sidebar
→ bottom navigation or drawer
```

Cards:

```text
4 columns
→ 2 columns
→ 1 column
```

Tables:

```text
full table
→ horizontal scroll
```

or use:

```text
responsive task cards
```

for genuinely narrow screens.

---

# 70. MOBILE TASK CARD

```text
┌───────────────────────────────┐
│ Homepage audit          ⋮     │
│ High • In Progress            │
│                               │
│ Employee A                    │
│ ███████████░░░░ 65%           │
│                               │
│ Due Sep 15                    │
└───────────────────────────────┘
```

---

# 71. ACCESSIBILITY

Target:

```text
WCAG 2.1 AA
```

At minimum:

- Keyboard navigation
- Visible focus states
- Semantic HTML
- Accessible labels
- Proper button semantics
- Accessible dialogs
- Accessible dropdowns
- Screen-reader-friendly status labels
- Sufficient contrast
- Reduced motion support
- No color-only communication

---

# 72. REDUCED MOTION

If user has:

```text
prefers-reduced-motion: reduce
```

then:

- Reduce transitions
- Disable decorative motion
- Avoid large movement
- Keep essential state changes understandable

ECC motion must respect this.

---

# 73. MOTION PRINCIPLES

Motion is supportive, not decorative.

Recommended durations:

```text
Micro interaction: 100–150ms
Standard transition: 150–220ms
Panel/modal: 200–280ms
Large page transition: 250–350ms
```

Use easing such as:

```text
ease-out
```

or the project's motion system.

Avoid:

- Bouncy dashboard cards
- Constant floating animations
- Excessive parallax
- Decorative animated gradients
- Long transitions

---

# 74. WHERE ECC SHOULD BE USED

Use ECC skill when implementing:

- Sidebar expansion
- Modal opening
- Side sheet opening
- Progress changes
- Toast entry/exit
- Tab changes
- Table filtering
- Dashboard card transitions
- Notification indicator
- Meaningful task completion feedback

Do not animate static data unnecessarily.

---

# 75. PAGE TRANSITION PRINCIPLE

Pages should feel connected.

Prefer subtle:

```text
opacity
small translate
```

rather than:

```text
large slide
zoom
bounce
```

---

# 76. DASHBOARD CHARTS

Charts should match the visual system.

Rules:

- White card container
- Minimal gridlines
- Neutral labels
- Coral primary series
- Semantic colors only when meaningful
- Tooltips
- Accessible alternative data table where appropriate

Do not use 8 unrelated colors.

---

# 77. FILTER SYSTEM

Common filter bar:

```text
Search
Team
Employee
Status
Priority
Date
```

Reference style:

```text
┌─────────────────┐ ┌────────────┐ ┌────────────┐
│ Search          │ │ Team ▼     │ │ Status ▼   │
└─────────────────┘ └────────────┘ └────────────┘
```

Filter controls should be compact.

---

# 78. FILTER DRAWER

On mobile:

```text
[ Filters ]
```

opens a bottom sheet/drawer.

Provide:

```text
Clear all
Apply filters
```

---

# 79. PAGINATION

Use the reference's compact pagination style.

```text
1–8 of 100

[ 1–8 ▼ ] [ Previous ] [ Next ]
```

Desktop.

On mobile:

```text
< Prev       1 / 13       Next >
```

Server-side pagination remains authoritative.

---

# 80. SORTING

Sortable columns should show:

```text
↕
↑
↓
```

Do not use ambiguous icons.

Sorting must be keyboard accessible.

---

# 81. BULK ACTIONS

When table rows are selected:

```text
3 selected

[ Assign ]
[ Change status ]
[ Change priority ]
[ More ]
```

Only expose actions permitted for the current user.

V0.1 can keep bulk functionality limited if implementation complexity becomes high.

---

# 82. EMPLOYEE CREATION FLOW

Super Admin:

```text
Add Employee
↓
Basic information
↓
Team
↓
Role
↓
Manager/Admin
↓
Account/access
↓
Create
```

Do not combine unrelated future HR fields into this form.

---

# 83. ADMIN CREATION FLOW

Super Admin:

```text
Add Admin
↓
Name
↓
Email
↓
Role
↓
Team/scope
↓
Access
↓
Create
```

Admin scope must be visually obvious.

---

# 84. PERMISSION VISIBILITY

For every privileged action, the interface should communicate scope.

Example:

```text
Assign task

Assigning within:
Rock's Team
```

This reduces accidental cross-team operations.

---

# 85. ROLE LABELS

Use consistent role names:

```text
Super Admin
Admin
Employee
```

Do not alternate between:

```text
Administrator
Manager
Supervisor
Admin
```

unless they represent genuinely different roles.

Job role is separate:

```text
System role: Employee
Job role: Software Engineer
```

---

# 86. TEAM LABELS

A team can have:

```text
Team name
Admin/owner
Employee count
Active task count
Completion rate
```

Example:

```text
Marketing
Rock
10 members
42 active tasks
76% completion
```

---

# 87. TEAM PAGE

Wireframe:

```text
┌────────────────────────────────────────────────────────────┐
│ Team: Rock's Team                           Edit Team      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Members 10    Active Tasks 42    Completed 31    Risk 3    │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ Members                                                    │
│                                                            │
│ Employee      Role             Tasks      Progress         │
│ ...                                                        │
└────────────────────────────────────────────────────────────┘
```

---

# 88. AUDIT LOG PAGE

Super Admin / authorized roles:

```text
Audit Log

Date/time
Actor
Action
Resource
Result
IP/device metadata if supported and appropriate
```

Visual:

```text
10:32 AM
Rock
Reassigned task #104
Employee A → Employee B
```

Audit data should not be editable through ordinary UI.

---

# 89. SETTINGS

V0.1 settings should remain limited.

Potential sections:

```text
Account
Organization
Notifications
Security
```

Only expose organization/security settings to authorized roles.

Do not build a huge settings center before it is required.

---

# 90. DESIGN TOKENS IMPLEMENTATION

Centralize tokens.

Example CSS variable layer:

```css
:root {
  --color-primary: #FA6147;
  --color-primary-hover: #F45138;
  --color-primary-soft: #FFF0EC;

  --color-background: #F6F5F8;
  --color-surface: #FFFFFF;

  --color-text-primary: #161616;
  --color-text-secondary: #5F5C61;
  --color-text-muted: #858087;

  --color-border: #E9E7EA;

  --color-success: #2EAA72;
  --color-warning: #D9902F;
  --color-danger: #E85C58;
  --color-info: #5D78D6;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
}
```

Actual implementation may map these into Tailwind/theme tokens if Tailwind is selected.

---

# 91. RECOMMENDED FRONTEND STACK

Unless the existing repository establishes another compatible stack:

```text
Next.js
TypeScript
React
Tailwind CSS
shadcn/ui primitives where useful
Lucide icons
TanStack Query
React Hook Form
Zod
```

For charts, choose one maintained charting library only if charts are actually required.

Recommended:

```text
Recharts
```

Do not install multiple charting libraries.

---

# 92. FRONTEND ARCHITECTURE

Recommended:

```text
frontend/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── tasks/
│   │   ├── employees/
│   │   ├── teams/
│   │   ├── reports/
│   │   ├── admins/
│   │   ├── audit/
│   │   └── settings/
│   └── ...
│
├── components/
│   ├── ui/
│   ├── layout/
│   ├── navigation/
│   ├── dashboard/
│   ├── tasks/
│   ├── employees/
│   ├── teams/
│   ├── reports/
│   └── shared/
│
├── lib/
│   ├── api/
│   ├── auth/
│   ├── permissions/
│   ├── utils/
│   └── validation/
│
├── hooks/
├── types/
└── ...
```

Adapt this to the actual repository.

Do not restructure an existing working application merely to match this example.

---

# 93. COMPONENT ARCHITECTURE

Prefer reusable primitives:

```text
Button
Input
Select
Dropdown
Modal
Sheet
Tooltip
Badge
Avatar
Progress
Table
Pagination
Tabs
Card
Skeleton
Toast
```

Then domain components:

```text
TaskCard
TaskTable
TaskStatusBadge
TaskProgress
EmployeeRow
EmployeeAvatar
TeamCard
DailyReportTable
KpiCard
```

Then page compositions.

Avoid giant components.

---

# 94. COMPONENT RESPONSIBILITY

Bad:

```text
Dashboard.tsx
→ 1500 lines
→ API calls
→ calculations
→ forms
→ modal
→ table
→ permissions
```

Prefer:

```text
DashboardPage
├── DashboardHeader
├── KpiGrid
│   └── KpiCard
├── ProgressOverview
├── TeamProgress
└── ActivityTable
```

Keep business logic outside visual components where possible.

---

# 95. SERVER VS CLIENT DATA

Use server-side rendering/data fetching where it makes sense.

Use client-side state for:

- Interactive forms
- Filters
- Modals
- Temporary UI state
- Optimistic interactions where safe

Do not turn the entire application into client-only rendering without a reason.

---

# 96. API CLIENT

Centralize API access.

Do not scatter:

```text
fetch(...)
```

through dozens of components.

Prefer:

```text
lib/api/
  auth.ts
  tasks.ts
  employees.ts
  teams.ts
  reports.ts
```

or an equivalent typed API client.

---

# 97. DATA FETCHING

TanStack Query is recommended for:

- Task lists
- Employee lists
- Team lists
- Reports
- Notifications

Benefits:

- Caching
- Loading state
- Error state
- Refetching
- Query invalidation

Use appropriate cache invalidation after mutations.

---

# 98. FORM VALIDATION

Use:

```text
React Hook Form
+
Zod
```

where compatible with the project.

But backend validation remains authoritative.

Frontend validation is for:

```text
UX
early feedback
type safety
```

Backend validation is for:

```text
security
data integrity
business rules
```

---

# 99. OPTIMISTIC UI

Use only when safe.

Good:

```text
Mark notification read
```

Potentially safe:

```text
Small progress update
```

Be careful with:

```text
Task reassignment
Delete
Permission changes
Admin changes
```

These should generally wait for server confirmation.

---

# 100. URL STATE

Filters that are useful to preserve/share should be represented in URL query parameters.

Example:

```text
/tasks?team=rock&status=in_progress&page=2
```

Benefits:

- Refresh persistence
- Back/forward navigation
- Shareable filtered views

Do not put sensitive information in URLs.

---

# 101. FRONTEND AUTHORIZATION

Frontend should derive the current role/scope from authenticated session data.

Use it to:

```text
hide unavailable navigation
disable/omit unavailable actions
filter visible choices
```

But never treat this as security.

The backend remains authoritative.

---

# 102. ROUTE PROTECTION

Protected routes:

```text
/dashboard
/tasks
/employees
/reports
```

must require authentication.

Role-restricted routes:

```text
/admins
/audit
/settings/security
```

must require appropriate role/permission.

Unauthorized navigation should produce a proper access-denied state or redirect.

---

# 103. ACCESS DENIED PAGE

Example:

```text
Access restricted

You don't have permission to view this area.

[ Return to dashboard ]
```

Do not reveal sensitive information about the restricted resource.

---

# 104. PERFORMANCE

Target:

- Fast initial render
- Minimal JavaScript where possible
- Lazy-load heavy charts
- Paginate large tables
- Virtualize only genuinely large lists
- Optimize images
- Avoid unnecessary rerenders
- Avoid repeated API requests
- Cache stable queries appropriately

Do not optimize prematurely.

Measure before adding complexity.

---

# 105. TABLE PERFORMANCE

If task count grows significantly:

```text
Server-side pagination
Server-side filtering
Server-side sorting
```

should be preferred.

Do not fetch 50,000 tasks into the browser.

---

# 106. DASHBOARD DATA LOADING

Load independent dashboard sections independently where useful.

Example:

```text
KPI summary
Team progress
Recent activity
```

One slow chart should not necessarily block the entire dashboard.

---

# 107. SECURITY UX

Never display:

- Passwords
- Tokens
- API secrets
- Internal authorization details
- Sensitive audit metadata to unauthorized users

Do not put permission logic only in button visibility.

---

# 108. DATE DISPLAY

Backend stores UTC.

Frontend displays dates in the appropriate user/organization timezone.

Recommended display:

```text
Sep 14, 2026
```

For timestamps:

```text
Sep 14, 2026, 10:32 AM
```

For relative activity:

```text
10 minutes ago
```

Provide exact timestamp on hover/focus where useful.

---

# 109. DEADLINE DISPLAY

Use semantic phrasing:

```text
Due today
Due tomorrow
Due Sep 18
Overdue by 2 days
Completed Sep 13
```

Do not rely only on color.

---

# 110. TASK DEADLINE VISUAL PRIORITY

Priority order:

```text
Overdue
Due today
Due tomorrow
Upcoming
No deadline
```

The visual hierarchy should make urgent work easy to locate.

---

# 111. REPORT DATE CONTROLS

Default:

```text
Today
```

Quick options:

```text
Today
Yesterday
Last 7 days
This week
Custom
```

Do not add complex date analytics unless required.

---

# 112. DATA DENSITY

The reference is data-dense but still breathable.

Target:

```text
compact controls
comfortable row heights
clear section spacing
limited decorative elements
```

Do not make every section a giant card.

Use cards for meaningful grouping.

---

# 113. CARD USAGE

Use cards for:

- KPIs
- Summary sections
- Focused panels
- Team summaries
- Profile summaries

Do not wrap:

```text
every button
every table row
every text paragraph
```

in individual cards.

---

# 114. SECTION HIERARCHY

Typical page:

```text
Page header
↓
KPI / summary
↓
Primary content
↓
Secondary content
```

Avoid:

```text
Header
card
card
card
card
card
card
footer
```

with no hierarchy.

---

# 115. VISUAL EMPHASIS

The most important item should be visually obvious.

For task management:

```text
Task title
Status
Assignee
Due date
Progress
```

For reports:

```text
Completion
Risk
Trend
```

For employee management:

```text
Name
Team
Role
Workload
Progress
```

---

# 116. ORGANIZATION CHART VISUAL LANGUAGE

Use the same visual language as cards:

```text
white surface
16px radius
soft border
subtle shadow
```

Admin node:

```text
Name
Admin
Team
Employee count
```

Employee group:

```text
10 employees
```

Clicking a node may open its detail.

---

# 117. MICROCOPY

Use direct operational language.

Good:

```text
Assign task
Complete task
View report
Add employee
Change team
Due today
7 tasks overdue
```

Avoid marketing language:

```text
Supercharge your productivity
Unlock workforce potential
Revolutionize your workday
```

ZEMP is an internal operations product.

---

# 118. CONFIRMATION COPY

Good:

```text
Task assigned successfully.
```

```text
Employee moved to Team Bruce.
```

```text
Admin deactivated.
```

Keep confirmations short.

---

# 119. ERROR MICROCOPY

Good:

```text
This task could not be updated. Please try again.
```

Better when known:

```text
You don't have permission to update this task.
```

Avoid technical:

```text
403 Forbidden
```

as the primary user-facing message.

---

# 120. FRONTEND TESTING

Use the project's established testing stack.

Recommended:

```text
Vitest or Jest
React Testing Library
Playwright
```

Test:

- Rendering
- Forms
- Permission visibility
- Task interactions
- Loading states
- Error states
- Filters
- Pagination
- Critical workflows

---

# 121. E2E CRITICAL PATHS

At minimum:

### Super Admin

```text
Login
→ dashboard
→ create admin
→ create employee
→ assign task
→ view report
```

### Admin

```text
Login
→ team dashboard
→ create task
→ assign to employee
→ view progress
```

### Employee

```text
Login
→ my tasks
→ update progress
→ complete task
```

### Permission test

```text
Admin Rock
→ attempts Team Bruce task
→ denied
```

---

# 122. VISUAL QA

After implementing a screen:

Check:

```text
Spacing
Alignment
Typography
Card dimensions
Table density
Button hierarchy
Responsive behavior
Focus states
Loading states
Error states
Empty states
```

Compare against this specification and the reference image.

Do not obsess over pixel-level copying of unrelated content.

---

# 123. DESIGN REFERENCE INTERPRETATION RULE

The screenshot is a style reference.

Copy the following design principles:

```text
Composition
Spacing
Rounded geometry
Neutral surfaces
Warm accent
Soft shadows
Compact navigation
KPI cards
Data-table treatment
Status-pill language
```

Do not copy:

```text
Employee names
HR metrics
Illustrations
Unrelated labels
Specific avatars
Specific sample data
Exact business terminology
```

Replace them with ZEMP data.

---

# 124. ZEMP PRIMARY NAVIGATION

Final V0.1 conceptual navigation:

### Super Admin

```text
Dashboard
Tasks
Employees
Teams
Admins
Reports
Audit Log
Notifications
Settings
```

### Admin

```text
Dashboard
Tasks
My Team
Reports
Notifications
Settings/Profile
```

### Employee

```text
My Dashboard
My Tasks
My Progress
Notifications
Profile
```

The exact grouping can be refined during implementation without changing permissions.

---

# 125. DASHBOARD DEFAULT

Super Admin:

```text
Organization-wide
Today
```

Admin:

```text
Own permitted team
Today
```

Employee:

```text
Own tasks
Today
```

This makes the first screen immediately useful.

---

# 126. DEFAULT REPORT METRICS

Super Admin:

```text
Total Employees
Active Employees
Active Tasks
Completed Today
Overdue
Overall Progress
```

Admin:

```text
Team Members
Assigned Tasks
Completed Today
In Progress
Overdue
Team Progress
```

Employee:

```text
My Tasks
Completed
In Progress
Overdue
My Progress
```

---

# 127. NO FRONTEND BUSINESS LOGIC DUPLICATION

Do not duplicate backend formulas unnecessarily.

For example, if backend returns:

```json
{
  "completionRate": 66.67,
  "risk": "AT_RISK"
}
```

frontend should display it.

Do not independently invent:

```text
if remainingDays < ...
```

in a React component.

---

# 128. COMPONENT NAMING

Prefer clear names:

```text
TaskTable
TaskFilters
TaskDetail
TaskStatusBadge
TaskProgressBar

EmployeeTable
EmployeeProfile
EmployeeFilters

TeamOverview
TeamMemberTable

DailyReport
DailyReportFilters
DailyProgressTable

DashboardKpi
DashboardKpiGrid
```

Avoid vague:

```text
Box
Thing
Card2
DataThing
PanelNew
```

---

# 129. FILE NAMING

Use the existing project convention.

If no convention exists:

```text
PascalCase.tsx
```

for React components.

Examples:

```text
TaskTable.tsx
TaskDetail.tsx
EmployeeTable.tsx
KpiCard.tsx
```

Hooks:

```text
useTasks.ts
useEmployees.ts
useDailyReport.ts
```

Utilities:

```text
formatDate.ts
permissions.ts
```

---

# 130. NO GIANT CSS FILE

Prefer:

```text
design tokens
Tailwind utility classes
small component-level styles
```

Avoid one enormous global CSS file containing every component's styling.

Global CSS should primarily contain:

```text
tokens
base styles
accessibility rules
global resets
```

---

# 131. TAILWIND RULE

If Tailwind is used:

- Map design tokens into Tailwind configuration/theme
- Do not scatter arbitrary hex values everywhere
- Reuse semantic classes/tokens
- Avoid giant class strings when component abstraction is appropriate

Bad:

```text
bg-[#FA6147] everywhere
```

Prefer:

```text
bg-primary
```

through the design token system.

---

# 132. SHADCN/UI RULE

If shadcn/ui is used:

Use it as a primitive foundation.

Customize its tokens to match ZEMP.

Do not allow default shadcn styling to become the product identity without adaptation.

Do not install every component just because it exists.

---

# 133. RESPONSIVE NAVIGATION

Desktop:

```text
persistent sidebar
```

Tablet:

```text
collapsible sidebar
```

Mobile:

```text
drawer / compact navigation
```

Navigation should preserve current location.

---

# 134. MOBILE HEADER

Mobile:

```text
☰   ZEMP                 🔔
```

or equivalent.

Keep it simple.

---

# 135. MOBILE DASHBOARD ORDER

Mobile order:

```text
Page title
↓
Most important KPI
↓
Urgent/overdue
↓
Today's progress
↓
Primary tasks
↓
Secondary analytics
```

Do not simply stack the desktop layout without reprioritization.

---

# 136. OVERDUE WORK SURFACE

Overdue tasks deserve a dedicated attention surface.

Example:

```text
Overdue — 7 tasks

Task A      Employee A      2 days overdue
Task B      Employee C      1 day overdue
...
```

Use danger styling sparingly.

---

# 137. TODAY'S WORK SURFACE

Employees should see:

```text
Today's tasks
Due today
Overdue
Completed today
```

This reduces cognitive load.

---

# 138. ADMIN ATTENTION SURFACE

Admins should see:

```text
Team members at risk
Overdue tasks
Blocked tasks
Deadlines approaching
```

This is more useful than generic "productivity score."

---

# 139. SUPER ADMIN ATTENTION SURFACE

Super Admin:

```text
Teams at risk
Admins with overdue workloads
Organization-wide overdue tasks
Inactive employees/admins
Recent administrative changes
```

---

# 140. NOTIFICATION PRIORITY

Suggested priority:

```text
Urgent task/deadline
↓
Task assignment
↓
Task blocked
↓
Task completion
↓
General information
```

Do not overwhelm users with notifications.

---

# 141. ACCESSIBILITY FOR STATUS

Do not communicate status only with color.

Use:

```text
● Completed
● In Progress
● Blocked
● Overdue
```

with text labels.

---

# 142. ACCESSIBILITY FOR PROGRESS

Do not rely only on a bar.

Show:

```text
65%
```

and provide an accessible label:

```text
Task progress: 65 percent
```

---

# 143. FOCUS STATES

Every interactive element needs a visible focus state.

Recommended:

```text
outline: 2px solid #FA6147
outline-offset: 2px
```

or an equivalent accessible focus ring.

Never remove browser focus without replacement.

---

# 144. CONTRAST

All text and controls must maintain accessible contrast.

Do not use:

```text
light gray text
on white
```

for essential content.

Muted text should remain readable.

---

# 145. DARK MODE

Dark mode is **not required for V0.1** unless separately approved.

Do not add it just because the component library supports it.

If introduced later, create a dedicated token system rather than ad-hoc dark styles.

---

# 146. INTERNATIONALIZATION

V0.1 can be English-first.

Still avoid hardcoding UI assumptions that make future localization impossible.

Do not concatenate sentences in ways that make translation difficult.

---

# 147. FRONTEND ENVIRONMENT VARIABLES

Only expose variables safe for the browser.

Never expose:

```text
database credentials
server secrets
private API keys
JWT signing secrets
```

Use public prefix conventions required by the selected framework.

---

# 148. FRONTEND API ERROR MAPPING

Map known backend error codes to user-friendly messages.

Example:

```text
TASK_NOT_FOUND
→ "This task no longer exists."

FORBIDDEN
→ "You don't have permission to perform this action."

VALIDATION_ERROR
→ field-level validation
```

Unknown:

```text
Something went wrong. Please try again.
```

---

# 149. OFFLINE / RETRY BEHAVIOR

V0.1 does not need full offline mode.

However:

- Handle network failures gracefully
- Allow retry
- Avoid losing form data where practical
- Show connection-related feedback when relevant

---

# 150. SECURITY AGAINST IDOR UX

If a user somehow navigates to:

```text
/tasks/foreign-task-id
```

frontend must correctly handle:

```text
403
```

or:

```text
404
```

It must not assume the task is available because the route exists.

---

# 151. FRONTEND LOGGING

Do not log sensitive information.

Avoid logging:

```text
tokens
passwords
private employee data
full API responses containing sensitive information
```

Use development-only logging where necessary.

---

# 152. ANALYTICS

Do not add third-party tracking by default.

Internal operational analytics and product telemetry should be considered separately.

V0.1 should prioritize the actual task-management product.

---

# 153. DESIGN QUALITY BAR

Every screen should pass this checklist:

```text
□ Looks like the same product
□ Uses design tokens
□ Uses consistent spacing
□ Uses consistent radius
□ Uses consistent typography
□ Uses semantic colors
□ Has loading state
□ Has error state
□ Has empty state
□ Has responsive behavior
□ Has keyboard access
□ Has visible focus
□ Does not expose unauthorized actions
□ Does not duplicate backend logic
□ Reuses existing components
```

---

# 154. FRONTEND IMPLEMENTATION WORKFLOW

When Claude implements a frontend feature:

```text
1. Read requirements.md
2. Read this Frontend.md
3. Inspect current frontend
4. Find existing reusable components
5. Identify API contract
6. Identify permission requirements
7. Implement with existing design tokens
8. Use Emil Frontend skill
9. Use ECC only if motion is required
10. Test interactions
11. Test responsive behavior
12. Test permission visibility
13. Verify against reference visual language
14. Update documentation if architecture changes
```

---

# 155. EMIL FRONTEND SKILL COORDINATION

The `CLAUDE.md` file requires automatic use of the Emil frontend skill for frontend work.

When using it, ensure it follows this document.

Priority:

```text
requirements.md
+
Frontend.md
+
existing project architecture
+
Emil frontend skill
```

The skill should improve implementation quality without overriding product requirements.

---

# 156. ECC COORDINATION

When motion is needed:

```text
Frontend.md
+
Emil
+
ECC
```

ECC should implement motion within the established design language.

Do not create a separate visual language through animation.

---

# 157. PONYTAIL COORDINATION

For straightforward frontend code:

```text
Emil + Ponytail
```

Use Ponytail to reduce unnecessary code.

Do not sacrifice accessibility or maintainability for brevity.

---

# 158. FULL-STACK FEATURE COORDINATION

For a feature such as:

```text
Assign Task
```

Claude should coordinate:

```text
Senior Backend Developer
→ API + validation + authorization + persistence

Emil Frontend
→ form + UX + API integration

Ponytail
→ efficient implementation

ECC
→ only if interaction motion is needed

Anthropic
→ cross-domain reasoning when complexity warrants it
```

---

# 159. DESIGN TOKEN SOURCE OF TRUTH

Do not allow these values to drift across components.

Centralize:

```text
Primary color
Semantic colors
Typography
Radius
Spacing
Shadows
```

If the design changes later, one token change should update the product wherever possible.

---

# 160. DO NOT COPY PIXEL VALUES BLINDLY

The reference screenshot provides visual direction.

If an exact value is not known:

```text
use the nearest design token
```

rather than:

```text
invent 17 different one-off values
```

Consistency is more important than microscopic imitation.

---

# 161. PAGE MAX WIDTH

Recommended content width:

```text
Full application shell
→ constrained by shell

Page content
→ width: 100%
→ padding: 24–32px

Dense tables
→ full available width

Focused forms
→ max-width: 640–760px
```

Do not make forms 1400px wide.

---

# 162. PAGE PADDING

Desktop:

```text
24–32px
```

Tablet:

```text
20–24px
```

Mobile:

```text
16px
```

---

# 163. PAGE HEADER

Recommended:

```text
┌─────────────────────────────────────────────────────────────┐
│ Tasks                                      + Assign Task    │
│ Manage assigned work and deadlines                         │
└─────────────────────────────────────────────────────────────┘
```

Title:

```text
24px
```

Description:

```text
13–14px
```

CTA aligned right on desktop.

Stacked on mobile.

---

# 164. BREADCRUMBS

Use breadcrumbs only where hierarchy genuinely benefits.

Example:

```text
Employees / Employee A
```

Do not use breadcrumbs on every page if they add no value.

---

# 165. TASK DETAIL SIDE SHEET

For quick inspection:

```text
width:
desktop 420–520px
```

Use:

```text
Task
status
progress
assignee
deadline
activity
```

Allow navigation to full task page if required.

---

# 166. EMPLOYEE DETAIL SIDE SHEET

Quick view:

```text
Avatar
Name
Role
Team
Status
Current workload
Progress
```

Actions:

```text
View profile
View tasks
```

---

# 167. COMMAND / QUICK ACTIONS

A command palette can be future-ready.

Potential:

```text
Search
Create task
Find employee
Open report
```

Not required for V0.1 unless it naturally fits the existing implementation.

---

# 168. DASHBOARD AUTO-REFRESH

Do not aggressively poll.

For changing metrics:

- Manual refresh
- Reasonable refetch intervals
- Event-driven updates later

The system should not generate unnecessary server load.

---

# 169. REAL-TIME FUTURE READINESS

Architecture may later support:

```text
WebSockets
Server-Sent Events
```

for:

- Live task updates
- Notifications
- Admin dashboards

V0.1 does not require real-time infrastructure unless specifically approved.

---

# 170. FRONTEND DATA OWNERSHIP

Frontend owns:

```text
temporary UI state
form state
navigation state
filter state
presentation state
```

Backend owns:

```text
task state
employee state
team state
permissions
reports
audit records
deadlines
```

---

# 171. FORM SUBMISSION

Standard flow:

```text
Idle
↓
Submitting
↓
Success / Error
```

During submission:

- Disable duplicate submission
- Show progress state
- Preserve entered data if request fails
- Display useful error

---

# 172. DOUBLE-SUBMIT PROTECTION

Buttons such as:

```text
Assign Task
Create Employee
Create Admin
Save
```

must prevent accidental duplicate submissions.

---

# 173. DESTRUCTIVE ACTIONS

Use a danger visual only for:

```text
Delete
Deactivate
Cancel
Irreversible changes
```

Do not use danger styling for ordinary overdue indicators in every context.

---

# 174. EMPLOYEE STATUS

System account status:

```text
Active
Inactive
```

Task status is separate.

Do not confuse:

```text
Employee inactive
```

with:

```text
Employee on vacation
```

unless that feature is added later.

---

# 175. ADMIN SCOPE INDICATOR

Admins should always understand what data they are seeing.

Example:

```text
My Team
Rock's Team · 10 employees
```

This is especially important because Super Admin sees organization-wide data.

---

# 176. SUPER ADMIN SCOPE INDICATOR

Super Admin:

```text
Organization
All teams · 30 employees
```

Provide filters to narrow down.

---

# 177. REPORT COMPARISON

When comparing teams/employees, keep comparison dimensions consistent.

Example:

```text
Assigned
Completed
Remaining
Progress
Overdue
```

Do not compare one employee on one metric and another on an unrelated metric.

---

# 178. CHART TOOLTIP

Tooltips should show exact values.

Example:

```text
Employee A
Day 1
Completed: 4
Total: 30
Progress: 13.33%
```

Charts are supplementary; the exact data should remain accessible.

---

# 179. REPORT EXPORT

Export can be future-ready.

Possible V0.2:

```text
CSV
PDF
Excel
```

V0.1 does not require export unless explicitly prioritized.

---

# 180. PRINTING

Not a V0.1 priority.

Do not optimize every screen for printing.

---

# 181. DESIGN SYSTEM EXTENSIBILITY

Future modules should be able to reuse:

```text
Employee
Team
Task
Status
Priority
KPI
Table
Report
Activity
```

This will help when adding:

```text
Attendance
Leave
OKRs
Expenses
Assets
Approvals
```

later.

---

# 182. FUTURE MODULE COMPATIBILITY

Do not make the navigation architecture dependent on only three pages.

It should support:

```text
Tasks
People
Operations
Reports
Administration
```

without forcing a V0.1 implementation of every future module.

---

# 183. V0.1 SCREEN INVENTORY

Required:

```text
1. Login
2. Super Admin Dashboard
3. Admin Dashboard
4. Employee Dashboard
5. Task List
6. Task Detail
7. Assign Task
8. Employee List
9. Employee Detail
10. Team List/Detail
11. Organization View
12. Daily Reports
13. Admin Management
14. Notifications
15. Profile
16. Basic Settings
17. Audit Log
```

Some can share components/routes where role-specific differences are primarily data scope.

---

# 184. LOGIN WIREFRAME

```text
┌─────────────────────────────────────┐
│                                     │
│              ZEMP                 │
│                                     │
│         Welcome back                │
│                                     │
│ Email                               │
│ [                                  ]│
│                                     │
│ Password                            │
│ [                                  ]│
│                                     │
│ [        Sign in                  ] │
│                                     │
│ Forgot password?                    │
│                                     │
└─────────────────────────────────────┘
```

Keep authentication screen consistent with the same visual language but less data-dense.

---

# 185. LOGIN UX

Required:

- Email validation
- Password field
- Show/hide password
- Loading state
- Invalid credentials state
- Inactive account state
- Keyboard support
- Accessible labels

---

# 186. SESSION EXPIRATION

If session expires:

```text
Your session has expired.

Please sign in again.
```

Avoid silent data loss.

---

# 187. UNSAVED CHANGES

For forms with meaningful data:

If user navigates away:

```text
You have unsaved changes.

Leave without saving?
```

Do not use this for tiny transient filters.

---

# 188. FILTER PERSISTENCE

Reasonable filters can persist during navigation.

Example:

```text
Task page
→ filter Team Rock
→ open task
→ back
→ Team Rock remains
```

Avoid persistent state becoming confusing.

---

# 189. SCROLL BEHAVIOR

Main page:

```text
application content scrolls
```

Sidebar:

```text
fixed/sticky where appropriate
```

Large tables:

```text
horizontal overflow inside table container
```

Avoid nested scroll containers unless necessary.

---

# 190. STICKY TABLE HEADER

For long tables, use sticky header where useful.

Keep it visually subtle.

---

# 191. ACTION MENU

Row actions:

```text
⋮
```

Menu:

```text
View
Edit
Reassign
Change status
Cancel
```

Only show permitted actions.

Destructive actions separated visually.

---

# 192. CONTEXT MENU RULE

Never hide the only way to perform a critical action inside a difficult-to-discover menu.

Primary actions should remain visible.

---

# 193. SEARCH RESULTS

Search should clearly distinguish:

```text
Task
Employee
Team
```

Example:

```text
Search "marketing"

Tasks
  Marketing campaign audit

Employees
  Daniel Smith

Teams
  Marketing
```

This can be future-ready; V0.1 may keep search context-specific.

---

# 194. PERFORMANCE INDICATORS

Avoid calling raw task completion "employee performance" everywhere.

Prefer:

```text
Task completion
Work progress
Deadline status
Workload
```

A future performance module can use richer criteria.

---

# 195. ADMIN REPORTING

Admins should be able to drill down:

```text
Team summary
↓
Employee
↓
Tasks
↓
Task activity
```

This creates a coherent information hierarchy.

---

# 196. SUPER ADMIN DRILLDOWN

Super Admin:

```text
Organization
↓
Team
↓
Admin
↓
Employee
↓
Task
↓
Activity
```

This is a major navigation principle.

---

# 197. EMPLOYEE DRILLDOWN

Employee:

```text
My dashboard
↓
Task
↓
Task detail
↓
Activity/comments
```

Keep employee UX focused.

---

# 198. ROLE-BASED DASHBOARD CONTENT

Do not create three unrelated dashboard designs.

Use shared visual primitives with different:

```text
data
scope
actions
```

This reduces maintenance.

---

# 199. SHARED DASHBOARD ARCHITECTURE

```text
DashboardPage
├── DashboardHeader
├── KpiGrid
├── ProgressSection
├── AttentionSection
└── ActivitySection
```

Role-specific data feeds these shared structures.

---

# 200. FRONTEND QUALITY PRINCIPLE

The final interface should feel like:

```text
One product
One design system
Three permission levels
Multiple data scopes
```

not:

```text
Three separate applications
```

---

# 201. FINAL VISUAL CHECKLIST

Before declaring a frontend screen complete:

```text
□ Neutral #F6F5F8 application background
□ White content surfaces
□ Coral #FA6147 used as primary accent
□ Soft 16px-ish card radius
□ Thin #E9E7EA borders
□ Very subtle shadows
□ Inter/system sans typography
□ 4px spacing rhythm
□ Compact iconography
□ Clear status pills
□ Clear KPI hierarchy
□ No excessive colors
□ No unnecessary gradients inside data surfaces
□ Consistent table treatment
□ Consistent buttons
□ Consistent forms
□ Responsive layout
□ Accessible focus
□ Loading state
□ Empty state
□ Error state
□ Permission-aware actions
```

---

# 202. FINAL FUNCTIONAL CHECKLIST

### Super Admin

```text
□ Login
□ View organization dashboard
□ Manage admins
□ Manage employees
□ Manage teams
□ Assign to admins
□ Assign to employees
□ View all tasks
□ View all reports
□ View audit log
```

### Admin

```text
□ Login
□ View scoped dashboard
□ View team
□ Assign tasks to permitted members
□ View task progress
□ View daily report
□ View overdue work
□ Cannot access another team's protected data
```

### Employee

```text
□ Login
□ View own dashboard
□ View tasks
□ Update progress
□ Change allowed status
□ Complete tasks
□ Comment
□ View own history
```

---

# 203. FRONTEND DEFINITION OF DONE

A frontend feature is complete only when:

```text
□ Requirement understood
□ requirements.md checked
□ Frontend.md checked
□ Existing implementation inspected
□ Existing components reused where possible
□ Correct frontend skill used
□ API contract verified
□ Permissions considered
□ Responsive behavior implemented
□ Loading state implemented
□ Error state implemented
□ Empty state implemented
□ Accessibility considered
□ Motion considered only when useful
□ No duplicated business logic
□ Tests added/updated where appropriate
□ Build passes
□ Lint passes where configured
□ Visual QA performed
□ No unrelated files rewritten
```

---

# 204. FINAL FRONTEND RULE

When a new frontend request arrives, Claude must think:

```text
What already exists?
↓
What does requirements.md require?
↓
What does Frontend.md require?
↓
What component can be reused?
↓
What API already exists?
↓
What permission scope applies?
↓
What is the smallest correct implementation?
↓
How do I verify it?
```

Never begin by redesigning the whole application.

---

# 205. REFERENCE DESIGN SUMMARY

The ZEMP V0.1 visual identity should consistently communicate:

```text
Warm coral accent
+
Neutral white surfaces
+
Soft gray background
+
Rounded geometry
+
Minimal shadows
+
Compact data tables
+
Clear KPI cards
+
Friendly status pills
+
Simple icons
+
Generous whitespace
+
Strong information hierarchy
```

The reference screenshot is therefore the **visual north star**, while `requirements.md` remains the **functional/product north star**.

---

# 206. FINAL SOURCE-OF-TRUTH MAP

```text
                         ZEMP V0.1
                              │
             ┌────────────────┼────────────────┐
             │                │                │
             ▼                ▼                ▼
      requirements.md    Frontend.md       CLAUDE.md
             │                │                │
       WHAT the product   HOW it looks   HOW Claude builds
       must do            and behaves    and maintains it
             │                │                │
             └────────────────┼────────────────┘
                              ▼
                     Existing Codebase
                              │
                              ▼
                         Implementation
```

When these documents evolve:

```text
Update the relevant source of truth.
Do not duplicate the same rule across all three.
```

---

# 207. END STATE

ZEMP V0.1 should feel like a coherent office operations command center where a user can understand, within seconds:

```text
WHO is working
WHERE they belong
WHAT they are responsible for
HOW MUCH is complete
WHAT is overdue
WHAT needs attention
WHO can perform each action
```

The UI should make those answers obvious without sacrificing the clean, soft, professional visual character established by the reference design.
