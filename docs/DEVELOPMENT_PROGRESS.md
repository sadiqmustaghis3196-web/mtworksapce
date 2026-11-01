# Current implementation checkpoint

## Active scope

The user requested all previously unavailable sidebar modules to work for software-house management. Their earlier instruction still defers database work while UI/workflows are finalized. The default Vercel build is therefore a **browser-local workflow workspace**, visibly labeled UI PREVIEW. It is not the completed database-backed ERP from the long-term specification.

Public UI login: `admin@mtnexus.test` / `NexusUI@2026!`. It is not a real backend account. No hosted database, passwords, SMTP or external money movement is needed for this mode.

## Implemented browser workflows

| Area | Current behavior |
|---|---|
| Clients | Client/contact CRUD, account manager, related project/contact details and activity |
| Project management | Project CRUD, client/department/manager links, team membership, open shared board; completion requires approved tasks |
| Boards | Six stages, guarded moves, review/approve/reject/rework, filters, collapsed rails, List/Calendar/Timeline; all use the same task dialog |
| Task dialog | Edit, progress/date, member assignment, comments, checklist/item creation and completion, subtasks, file attachment downloads, transition history |
| Hiring | Jobs, candidate pipeline, interviews with conflict checks and evaluation, offers; Hire/Accept creates a linked onboarding employee |
| Employees | Profile CRUD, department/manager/work mode, onboarding/offboarding statuses, documents |
| Attendance/leaves | One check-in/day, check-out/duration, leave requests, working-day calculation, overlap checks, approval/balance deduction and cancellation refund |
| Internships | Programs/capacity, enrollment/mentor assignment, evaluations, completion requires progress=100 plus a review |
| Finance | Invoice items and exact integer-cent calculations, issue/partial/full payment records, overpayment guard, expenses, payroll approval then recording; no external transfers |
| Creative | Briefs, assigned designer/editor, file assets, review/revisions/approval; linked task stages update on creative workflow actions |
| CRM | Leads/opportunities/follow-ups, staged sales pipeline, won lead to client conversion without duplicates |
| Support | Assignment, progress/waiting/resolution/close/reopen, resolution notes, responses/attachments |
| Departments | Manager/parent hierarchy, member counts, related projects, cycle checks and active-staff deactivation guard |
| Administration | Preview account/role CRUD, stored permission selection, activate/deactivate, read-only audit log, company/currency/leave settings |
| Notifications/dashboard | Persistent workflow notifications/read state, activity/approval links, task/people/client/attendance metrics derived from browser records |
| Shared UX | Create/edit/detail dialogs, validation, search/status filters, pipeline views, pagination, CSV exports, downloadable workspace JSON backup; reset requires confirmation |

## Architecture

- `src/modules/catalog.js`: entity fields, relationships, columns, allowed actions and module tabs.
- `src/modules/store.js`: browser business rules, derived balances/totals, related record operations, audit/notifications.
- `src/pages/modules/ModuleWorkspace.jsx`: shared module page/list/pipeline/detail UI.
- `src/pages/modules/RecordForm.jsx`: typed/reference/file/permission forms.
- `src/preview/api.js`: isolated preview adapter; real `api()` transport only uses it in preview mode.
- `src/components/tasks/TaskModal.jsx`, `ScheduleViews.jsx`: shared advanced task controls and real date-grid/calendar/date-axis timeline.
- `src/services/files.js`: permitted file types and 1 MB per-file limit.
- Root `vercel.json`: static frontend only. `deployment/` preserves full-stack configuration for the later database phase.

Stored records use the existing versioned preview localStorage key; new entity collections are added to existing browser data without resetting existing task edits. Session marker uses sessionStorage. Reload retains local edits. Other devices/users do not share them. Download a backup from Administration → Settings before clearing browser storage or resetting.

## Validation

- Production Vite preview build passes. Explicit API build (`npm run build:production`) also compiles; its bundle excludes the public preview password. Rebuilt the default preview afterward.
- Four deployment configuration checks pass; git diff --check passes.
- Desktop client and mobile support screens visually inspected after browser tests.
- 17 workflow-rule tests pass (`node tests/workflows.test.js`). They cover every business area, decimal-safe invoices, invalid transitions, overlap/duplicate/overpayment guards and cross-module effects.
- Browser suite: **25 passed** (`npm run test:preview`) against the built application without API interception: every sidebar area at 320/375/390/430/768/1024/1440 widths, core workflows, file upload, actual backup download, assignments/checklists/subtasks, refresh persistence, calendar/timeline/dialogs, reset confirmation and logout. Final redesign run: 25/25 passed in 24.7 seconds.
- Historical backend tests and fake-transaction provisioning tests are not evidence of real DB integration.

## Database-backed phase remains pending

The real Express/Prisma code exists but the current workspace has no hosted DATABASE_URL and its Prisma engine download policy is still blocked. Most new browser module routes have **no corresponding implemented database endpoints**. Role editing in preview does not enforce real server authorization or create real login accounts. Browser accounts are configuration records; only the public UI login works in this phase.

Do not call this production-ready or claim durable/shared PostgreSQL persistence. Real API/schema/migration coverage, scoped RBAC for every new module, server uploads/storage, reset email delivery, multi-user conflicts, and external integrations remain work for the later database phase. No live Vercel deployment has been verified by this task.

Resume: inspect this file and `git diff`, continue in `/workspace/mtworksapce` without a worktree. Use `npm run dev` for browser-local workflows. `npm run prepare:production` restores full-stack deploy files only when the user resumes backend work; `npm run build:production` explicitly disables preview. Full original requirements: `docs/MASTER_SPECIFICATION.md`. Earlier task history: `docs/legacy/DEVELOPMENT_PROGRESS_before_module_workflows.md`.


## Professional operations redesign

Module dashboards now use domain-specific KPIs and linked operational panels: client delivery/portfolio, recruitment funnel and interviews, department staffing, attendance/leave review, internship capacity/progress, receivables/finance approval desk, creative workload/reviews, sales pipeline/follow-ups, support deadlines/ownership, and administration coverage. All counts, balances and workload shares come from current local records, without fabricated growth trends or assumed staff capacity. Overview can be hidden to focus on records.

New record profiles include workflow stage tracks, project completion/team context, client and employee summaries, structured invoice documents, payroll breakdowns, creative briefs and ticket conversation threads with an inline response composer. Relationship shortcuts apply real URL-driven record filters; add forms inherit that context. Forms suggest invoice IDs/dates, payroll salary/month/deductions, and payment balances without overwriting deliberate edits. Live cent-safe totals and contextual help explain financial entries. Search has a working Ctrl/Command+K shortcut; theme persists after refresh.

New files: src/modules/insights.js (read models), formSupport.js (form defaults/calculations), ModuleOverview.jsx and RecordOverview.jsx. Eight pure insight/form tests passed; 25 browser tests passed, including existing workflows, context drill-downs, invoice documents/calculations, salary suggestion behavior, ticket replies, mobile detail dialogs, keyboard search and persisted theme. Explicit DB-backed endpoints/security remain outside this UI phase. See docs/lessons/04-professional-operations.md.

## Daily delivery dashboard checkpoint

The new login landing page is `/dashboard`. Eleven role templates cover admin, managers, team leads, employees and interns, with company/department/project/personal display scopes and related HR, finance, sales or support agenda items. These are explicitly preview lenses, not server authorization.

Six delivery chevrons show Plan & assign → Build/work → Testing → Quality check → Review → Done. Testing and quality are reported work phases, not automated integrations. Existing approval/rejection/rework preserves task identity. Daily goals, immutable daily updates, actual minutes, progress deltas, blockers, next steps and historical dates survive refresh. Existing task progress is never counted as work performed today. Team rows open individual worklists.

Deadline watch and configurable in-app reminders cover overdue, today, tomorrow, reviews and a local-time daily digest. Reminder generation is deduplicated and runs while the dashboard is open. No email, push or background scheduler is connected. All data remains browser-local in the current UI preview.

New files: src/modules/dailyWork.js; src/pages/dashboard/{DailyDashboard,DailyForms,DeliveryFlow}.jsx; src/styles/dailyDashboard.css. Local adapter routes are documented in API_ENDPOINTS.md. Validation: 14 daily rule tests and 30 browser tests passed, including all role templates, seven viewport sizes, actual employee reporting visible to the admin lens, goal/preferences persistence and reminder deduplication. See lessons/05-daily-dashboard.md.
