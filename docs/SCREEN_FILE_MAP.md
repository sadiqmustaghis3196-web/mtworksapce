# Current screen map

All routes below now have interactive browser-local screens. No “Module not available yet” placeholder route remains in the preview app. Real backend integration remains separate and incomplete.

| Routes | Screens / source |
|---|---|
| /login, /forgot-password, /reset-password | Login.jsx; public preview login works; real email/password reset unavailable in preview |
| /dashboard | Dashboard.jsx; current task/people/client/attendance metrics, deadlines, approvals, activity |
| /projects, /projects/:projectId/board, /list, /calendar, /timeline | Projects.jsx; Board/List, month grid and proportional date-axis timeline |
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
