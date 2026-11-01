# Current screen map

All routes below now have interactive browser-local screens. No “Module not available yet” placeholder route remains in the preview app. Real backend integration remains separate and incomplete.

| Routes | Screens / source |
|---|---|
| /login, /forgot-password, /reset-password | Login.jsx; public preview login works; real email/password reset unavailable in preview |
| /dashboard | DailyDashboard.jsx, DailyForms.jsx, DeliveryFlow.jsx; daily delivery pipeline, role/profile lenses, goals, work logs, team progress, deadlines and in-app reminders. Dashboard.jsx retains the real-backend dashboard for the later production phase. |
| /projects, /projects/:projectId/board, /list, /calendar, /timeline | Projects.jsx; Board/List, month grid, proportional date-axis timeline, Add Card with document blocks and assignment. Shared TaskModal/TaskDocument/DocumentEditor opens from boards and dashboard pipeline. |
| /projects/manage | Project CRUD, team membership, related tasks and board links |
| /clients, /clients/contacts, /clients/projects | Clients, contacts, related projects |
| /hiring/jobs, /hiring/applicants, /hiring/interviews, /hiring/offers | Recruitment and hiring pipeline |
| /employees, /employees/documents | Employee directory/profiles/documents and employment actions |
| /attendance, /attendance/leaves | Check-in/out, attendance records, leave requests/approvals |
| /internships/programs, /internships/interns, /internships/reviews | Programs, enrollment/mentor directory and evaluations |
| /finance/invoices, /finance/items, /finance/payments, /finance/expenses, /finance/payroll | Invoice-item/payment ledger, expenses and approval-controlled payroll records |
| /creative/requests, /creative/assets, /creative/revisions | Brief/review pipeline, uploaded assets, revision history |
| /crm/leads, /crm/opportunities, /crm/activities | Sales pipelines, conversion and follow-ups |
| /support/tickets, /support/responses | Ticket assignment/resolution/reopen and responses |
| /departments | Departments, managers, parent hierarchy, member counts and related work |
| /admin/users, /admin/roles, /admin/audit-logs, /admin/settings | Preview account/permission configuration, audit records, workspace settings and backup |
| /notifications, /profile | Notification read state; current profile (real password changes remain unavailable in preview) |

Business module screens use `src/pages/modules/ModuleWorkspace.jsx` and `RecordForm.jsx`, driven by `src/modules/catalog.js`. Lists, details, forms and workflows are shared reusable components rather than duplicated HTML screens. Record detail routes append the record ID to the listed collection path; add/edit dialogs preserve the current section.

Task dialog: `src/components/tasks/TaskModal.jsx`; schedules: `ScheduleViews.jsx`; shell: `src/layouts/AppLayout.jsx`; file validation: `src/services/files.js`.

## Professional operations layer

ModuleOverview.jsx renders the domain-specific panels defined by src/modules/insights.js. RecordOverview.jsx adds profiles, stage tracks, invoice document/payroll layouts and inline ticket conversations. RecordForm.jsx uses formSupport.js for contextual defaults, help and live financial calculations. Detail shortcuts use URL reference filters and pass those references into new-record forms. Data remains browser-local.

The preview `/notifications` route now uses pages/notifications/Notifications.jsx instead of the generic collection screen, with a live unread badge, filters, read actions and related-record links. AppLayout displays new-item toasts and keeps the bell available on phones.

Bell interaction: AppLayout mounts Notifications in compact mode inside an anchored overlay (`#notification-popover`). It preserves the current route and screen. Dashboard View all and toast actions open that overlay; standalone `/notifications` remains only as a compatible direct route.
