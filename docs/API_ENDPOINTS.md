# Implemented API routes (integration validation pending)

All mutating requests require `X-Requested-With: XMLHttpRequest`, a trusted Origin when present, and a valid cookie session for authenticated routes. Session tokens are opaque, HttpOnly cookies; their SHA-256 hashes are stored in PostgreSQL. JWT bearer login responses are no longer supported.

| Route | Purpose | Authorization |
|---|---|---|
| POST /api/auth/login | Password verification, DB session creation | Rate limited |
| GET /api/auth/me | Current session identity and DB role permissions | Session |
| POST /api/auth/logout | Delete current DB session | Session |
| POST /api/auth/forgot-password | One-time reset email | Rate limited; configured SMTP required |
| POST /api/auth/reset-password | Consume hashed token, revoke all user sessions | One-time unexpired token |
| PATCH /api/auth/password | Change own password, revoke sessions | Current password + session |
| GET /api/dashboard/overview | Authorized project/task counts and deadlines | dashboard.read + task scope |
| GET /api/projects | List organization projects (memberships for non-super-admin) | projects.read |
| GET /api/tasks, /api/tasks/:id | Tasks, related detail records | tasks.read + organization/assignment/project scope |
| POST /api/tasks | Create Upcoming card in an authorized project | tasks.create |
| PATCH /api/tasks/:id | Edit content, date, priority, progress | tasks.update + task modification scope; cannot change stage/project/department here |
| POST /api/tasks/:id/transition | Guarded move and TaskActivity transaction | Per-action permission + task scope |
| POST /api/tasks/:id/move | Compatibility alias for transition | Same guards |
| POST /api/tasks/:id/comments | Add TaskUpdate comment | Task modification scope |
| DELETE /api/tasks/:id | Soft archive | tasks.delete + scope |
| POST /api/tasks/:id/restore | Restore archived record | tasks.delete + scope |
| GET/POST /api/users | Read/create internal accounts | users.read/create; organization scope; no privilege escalation |
| PATCH /api/users/:id | Update account/profile/role; revoke sessions | users.update + scope; protected Super Admin |
| POST /api/users/:id/reset-password | Send reset instructions | users.update + scope; SMTP required |

Legacy employees/clientOps reads require Super Admin and organization filtering while full module authorization is being implemented. Health route is a development diagnostic. Most master-spec endpoints remain **unimplemented**; the milestone map is authoritative.

## Browser-local module adapter (not HTTP backend endpoints)

In the default UI-preview build only, `/workspace/data`, `/workspace/:entity`, `/workspace/:entity/:id`, and `/workspace/:entity/:id/actions/:action` are api() paths handled inside `src/preview/api.js` / `src/modules/store.js`, without fetch. Attendance uses `/workspace/attendance/check-in` and `/check-out`. Task preview actions also support `/tasks/:id/assign`, `/checklists`, checklist items, `/attachments` and parentTaskId for subtasks. These are not newly implemented Express endpoints. Their database-backed equivalents remain pending.

## Browser-only daily dashboard adapter

These routes are intercepted by `src/preview/api.js` in UI preview mode; they are not implemented HTTP backend endpoints:

- `GET /dashboard/daily?role=...&profileId=...&focusId=...&date=YYYY-MM-DD`: scoped daily read model and due in-app reminders.
- `POST /dashboard/daily/update`: assigned employee, task, today's date, summary, minutes, progress, work phase, blocker and next step.
- `POST /dashboard/daily/plan`: employee/task/date, daily target and goal.
- `PATCH /dashboard/daily/preferences`: in-app reminder switches and local digest time.

Validation and history live in `src/modules/dailyWork.js`. Role/profile parameters change the preview display scope and do not establish authorization. No network or background notification delivery occurs.

## Browser-only task document fields

Preview `POST /tasks` accepts `documentBlocks` and `employeeIds`; it validates document/member inputs before saving the task and assignment notifications together. Preview `PATCH /tasks/:id` accepts `documentBlocks`, recording `documentUpdatedAt`. `GET /tasks/:id` decorates the task with its current project/assignees and linked daily reports for preview/export. These fields are not implemented on the real backend yet.

Document blocks are ordered `{id,type,text}` or `{id,type:"image",src,caption}` records. Allowed types: heading, text, image, list, divider. Only local PNG/JPG data URLs are accepted; HTML/SVG and remote image URLs are rejected. Export escapes all text. No network PDF service is used.

## Browser-only notification feed

- `GET /notifications/feed?role=...&profileId=...`: generate deduplicated due in-app reminders and return sorted scoped items, unread count and profile.
- `POST /notifications/read-all` with role/profileId: mark the currently scoped feed read.
- `POST /workspace/notifications/:id/actions/read` or `/unread`: idempotent status change.

Task stage transitions also persist recipient notifications, tagged with eventType/targetStage. `notificationTarget` resolves tasks to `/projects?task=:id` and module notifications to their record routes. These are preview adapter operations, not new real-backend or remote notification services.

## Browser-only revision workflow

Preview `POST /tasks/:id/transition` now accepts targetStage 6 with required `reason` from stages 2, 3 or 4. Stage 6 returns to 2. Existing 0–5 stage IDs retain their meanings. Revision state is stored in task.revisions with round number, instructions, status, timestamps and updates. `POST /tasks/:id/revision-updates` with content adds an update to the latest open round and a matching task comment. Approved/superseded rounds cannot be updated. Real server schemas/migrations are unchanged; these routes are browser adapter additions.

## Role-aware preview operations

Preview login resolves an active record in `records.users` and its role. Every active preview account uses the existing public UI-preview password; session storage identifies the preview account. `/auth/me` derives current permissions so role changes take effect. Super Admin/Admin have full operational rights; role/admin-account changes and self-access protections are checked in `access.js`. Workspace/task mutations use explicit action permissions. Own records/tasks are scoped for non-admin preview users, and dashboard/notification query parameters cannot impersonate another account. This is browser adapter behavior, not server authentication.

- `DELETE /tasks/:id`: permission-checked archive plus audit; existing dependent-workflow rules apply.
- `POST /workspace/attendance`, `PATCH /workspace/attendance/:id`: manual entry/correction with employeeId, date, PKT datetime-local checkIn/checkOut, breakMinutes and required correctionReason. Before/after values persist. Attendance deletion is disallowed.
- `/workspace/cashbook`: existing generic CRUD/actions mechanism for reference, direction, account, counterpartyType/name, client/project, amount/date/purpose/receipt. `post` locks and includes a movement; `void` requires a reason and excludes it from cash-flow totals while retaining history.

Accounts/roles, attendance and cashbook remain browser-local. Real Express routes, database migrations, password hashing and cross-device sessions have not been introduced in this phase.
