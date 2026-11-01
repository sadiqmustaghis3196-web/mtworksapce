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

## Animated delivery diagram refinement

Replaced the single chevron strip with a connected two-row workflow diagram, input panels, directional SVG connectors and a dotted rework loop. Active stage occupancy has a colored double border and status text; counts and daily update/time totals derive from the scoped daily model. Dashed paths and working indicators animate only on the current day and honor reduced motion. Phone layout shows all six stages vertically with connectors.

Working task cards have a phase-colored double border. A separate two-column daily result box shows reported progress change and actual time; it becomes green with a double border only after an update exists. Existing overall progress is still separate. Added browser assertions for actual report highlighting, stage filtering, diagram layout, motion/reduced-motion and phone overflow. The original 30 browser checks passed; all six updated dashboard checks also passed. No backend or CI/CD integration was added.

## Pipeline documents checkpoint

User’s “Add to Cart” was interpreted as board Add Card. Assigned Upcoming cards now enter the current-day Plan pipeline automatically. Clicking a stage shows scoped task documents directly below the diagram; opening a task displays its editable document and live ownership, stage, deadline and progress. Stage changes retain the same task/document. Daily work counters continue to require actual daily reports.

New shared DocumentEditor and TaskDocument components support ordered heading/text/image/list/divider blocks, image captions, insertion between blocks, reorder/removal, page preview, explicit save and protection when closing unsaved document edits. Add Card uses the same editor and can assign members at creation. Existing descriptions provide initial content when no document exists. Summary/board notes remain separate.

Print / Save PDF opens a printable A4 document using the current draft and live workflow details; users choose Save as PDF in the browser dialog. Export includes ownership, deadline, stage history, daily reports, checklists and comments. No existing-PDF import/editing or DOCX export is claimed. PNG/JPG only, 1 MB per image, 40 blocks and 2.5 MB total; server integration remains deferred.

Validation: 33 browser checks passed, followed by both document browser checks passing again after final preview changes. These cover text/image/text order, assignment→pipeline→document, editing/persistence, reorder/remove, unsaved-close protection, mobile width and an actual Chromium-generated PDF artifact at /tmp/mt-workflow-document.pdf. Pure document tests cover escaped output, invalid types/URLs, size limits and workflow export. The daily rules also cover assigned Upcoming cards without fake activity.

## Notification delivery and inbox fix

The bell previously linked to the generic notifications collection, mobile CSS hid it, and reminders were only generated on dashboard reads. A shared notification feed now generates due reminders from every preview screen, refreshes on workspace changes, tab focus, cross-tab storage changes and a 15-second interval, and cleans up listeners on unmount. The header badge uses the same scoped feed as the inbox. New unread items show a dismissible in-app toast; initial history and profile switches do not replay old alerts.

A dedicated Notifications screen supports All/Unread/Read, global search, refresh, mark read/unread, scoped Mark all read, timestamps in Asia/Karachi, and Open related work. Opening marks read and opens the linked task document (including finished/Upcoming work) or module record; closing clears the task deep link. Read/unread writes are idempotent. Business task transitions now create review/approval/rework/start notifications. Same-day review events suppress an additional duplicate review reminder. Personal views exclude other recipients; company lenses retain company visibility. Dashboard notification cards also link to related work.

Mobile bell remains visible down to 320 px. In-app delivery remains browser-local while the app is open; email/push/background delivery is not connected. New files: modules/notifications.js, hooks/useNotifications.js, pages/notifications/Notifications.jsx, styles/notifications.css. Validation includes three notification browser flows plus pure feed/scope/target/dedup rules.

Final notification validation: all 36 browser checks passed. Inbox navigation dismisses the transient popup so it cannot cover inbox controls; incoming notifications remain visible in the list and badge. Production and preview builds and deployment checks also passed.

## Bell dropdown interaction correction

The user clarified that clicking the bell must open a list over whichever screen is active, not navigate to a new notification page. AppLayout now renders an anchored non-modal notification panel, using the existing inbox actions in compact mode. The panel has independent search, All/Unread/Read filters, Mark all read, refresh, a bounded scrolling list and persistent read/unread controls. Bell, toast View notifications and dashboard View all all open the same panel. Outside click, close and Escape dismiss; focus returns to the bell on explicit close/Escape. Opening/filtering/reading does not change URL or current screen/search/view. Only explicit Open related work navigates. Mobile panel is clamped to viewport width/height; reduced-motion disables entry animation. Legacy direct `/notifications` bookmarks remain supported.

Browser coverage now includes popup route preservation, background board/search preservation, independent scrolling/search, dismissal/focus and phone bounds, alongside the existing delivery/read-state checks.

Dropdown verification: 37 browser checks passed, including the four notification interaction flows. Preview/production builds and deployment checks passed.

## Card interaction and document image refinement

“Another city” was interpreted as another workflow column. Board cards now support native desktop drag/drop and touch/pen movement from the Drag handle, with valid destination highlights and a Move to… select alternative. Source task ID/history/document remain unchanged. Shared target rules preserve Upcoming→Today→In Progress→Review and reviewer-only approval/rejection/rework; dropping into Reject opens the existing required-reason form. Invalid jumps do not mutate the task.

Whole board and daily dashboard card surfaces open the task, including metadata/progress/background. Enter/Space opens a focused card. Interactive descendants retain their own controls and do not also open the task. Native drag suppresses the subsequent surface click.

Document images in edit and page-preview mode use small thumbnails (up to 220 px box/130 px image height), opening the original in a separate native dialog on click. The viewer fits the viewport, restores focus and closes on Escape/Close without dismissing the parent task dialog. Print/PDF content retains original images. New helper: modules/taskInteraction.js; viewer: components/documents/ImagePreview.jsx. Browser tests cover native movement and reason/refresh history, touch movement, whole-card vs action clicks, thumbnail bounds and nested viewer behavior.

Final card/image validation: 41 browser tests passed; reviewer target-rule test, four deployment checks, preview build and production build passed. Mobile page-overflow regression was corrected by removing a redundant absolutely positioned hidden label; move selects retain explicit accessible names.

## Dedicated revision stage and update history

Added preview stage 6, Revision & Updates, displayed after Review and before Done. Existing stage IDs 0–5 and Reject stay unchanged. Reviewers can request changes from In Progress/Review/Done with instructions (5–2,000 characters); drag/Move to… share the same gate. Stage 6 starts back into In Progress and must pass Review for approval. Each request stores a numbered round with instructions, requested time, lifecycle status and work updates; earlier rounds survive further requests. Approved rounds are closed to further updates. New requests reopen completed work without leaving it marked at 100%/approved.

Task cards show round/status badges; task detail opens the Revisions tab for pending work and shows a current-round banner. Revisions tab posts updates to the current open round, and mirrors them into task comments. Workflows notify assignees about revision requests/updates. The dashboard shows a separate revision lane/filter/task list, keeping pending revisions out of the normal Build count. Daily work logging still requires starting the work first. Creative Studio requests share stage 6 and the same revision helper. Task preview/PDF export includes all rounds and their updates.

New sources: modules/taskRevisions.js; tasks/RevisionRequestForm.jsx and RevisionHistory.jsx. Real backend/PostgreSQL stage migration remains deferred under the current browser-only UI scope; production controls continue to use the existing stages. Existing browser data needs no reset; revision arrays are added lazily. Added rule tests and end-to-end tests for request→update→start→resubmit→approve→second round, drag instructions, mobile detail and PDF history.

Final revision verification: 43 browser checks passed; revision, linked workflow, daily-work, document and card-rule tests passed. Preview/production builds and deployment checks passed. Mobile detail layout keeps the additional revision tab and controls inside the dialog.

## Role-based operations / people / attendance / finance checkpoint

The user requested a broad professional operations revision, then explicitly confirmed in Roman Urdu that database/real backend should remain for later. Do not silently enable production/backend mode. The current deployment remains browser-local, including preview accounts and their public test password.

Implemented preview account identities resolved from active account records; Super Admin/Admin operational access; Super-only role/admin-account management; protected self-access and Super role; grouped checkbox permissions and adapter-level action checks; personal task/data scoping; no employee dashboard-persona impersonation. Active preview accounts can sign in by configured email with the existing public preview password. Auth refreshes after account/role changes. These are UI testing controls, not secure authentication against local-storage tampering.

Task edit/delete permissions are visible in the shared task dialog. Deletion archives the original task and audits it; next IDs include archived records. Linked workflow/subtask constraints remain. Read-only roles get document previews and disabled task editing; an end-to-end forged-edit check confirms the adapter rejects the write. Generic modules now gate create/update/delete/actions; only Super Admin sees module metrics/Operations Overview.

Employees use a person directory and individual profile with assignments, deadlines/progress, daily reports, documents and monthly attendance days/hours. Intern/program directories use person/program cards, enrollment labels, mentor context and progress. Departments include team/manager/member cards, member popups/links, a six-step delivery summary and templates that open a prefilled form without creating assumed company data. CRM and creative pipelines surface owners and follow-up/due dates; support table includes SLA deadlines and existing resolution/conversation flows remain tested.

Attendance has its own person/month register, manual correction form, PKT arrival/departure/break calculations, duplicate/interval/future validation, correction reasons and before/after audit history. Historical attendance cannot be deleted. Cashbook adds receipts/payouts, client/vendor/employee/owner counterparties, vouchers, Draft→Posted→Voided state, exact minor-unit arithmetic, client money positions and recorded cash flow. Draft/voided movements do not count. Payroll uses recorded dates rather than inventing a first-of-month cash date. Financial posted history stays immutable.

Dashboard Follow assigned task tracks a chosen task with a red stage marker, including work/testing/quality/review/revision states. It reflects reported phases and real transitions, not automatic CI/CD. Dark background reduced glare; light-mode status/secondary text contrast corrected and checked. Operations screens now load lazily to keep the initial JS below the previous 500 KB warning threshold. All changes hydrate existing preview data without resetting it.

Key sources: modules/access.js, peopleOperations.js, financeFlow.js; common/PermissionMatrix.jsx; pages/modules/PeopleViews.jsx, FinanceFlow.jsx; styles/operationsRefinement.css and themeRefinement.css. New tests: operationsAccess.test.js and operationsRefinement.spec.js.

Validation for the operations checkpoint: all 50 browser scenarios passed, including account hierarchy, employee-only views, independent edit/delete grants, forged read-only write rejection, card archival/unique IDs, correction totals/history, posted/voided client payouts, moving task marker and light-mode secondary-control contrast above 4.5:1. All 56 domain/rule checks passed. Production/preview builds and four deployment checks passed; public preview credentials are absent from the production bundle. Task comments, revision requests/updates, approvals and uploads now record the signed-in preview actor rather than labeling every account Preview Admin. A final targeted run also checks deleting a task opened via notification/deep link clears that link without a stale missing-task error.

User communication preference: Roman Urdu/English. User explicitly chose: UI/workflows complete now; shared database/real login/backend later.
