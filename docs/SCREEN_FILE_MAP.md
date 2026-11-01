# Current screen map

Active mode is now the user-requested database-free UI preview. Login, dashboard and board use isolated browser sample data in preview builds. The integration limitations below refer to the real API mode.

| Route | Source | Current status |
|---|---|---|
| /login, /forgot-password, /reset-password | src/pages/auth/Login.jsx | Forms built; login/reset integration blocked on Prisma, mail transport unverified |
| /profile | src/pages/auth/Profile.jsx | Session identity and password form; backend integration unverified |
| /dashboard | src/pages/dashboard/Dashboard.jsx | Authorized task counts/deadlines API implemented; DB checks pending |
| /projects, /projects/:projectId/:view | src/pages/projects/Projects.jsx | Board/list/date groups/timeline UI with real API calls; browser fixture tests passed |
| Shared task dialog | src/components/tasks/TaskModal.jsx | Edit/comment/activity; checklists/attachments currently read-only; assignment, subtask and upload actions outstanding |
| All other module routes | src/main.jsx | Explicit unavailable state; no module completion claimed |

Shell: src/layouts/AppLayout.jsx. Shared tables/dialogs/states: src/components/common/UI.jsx. Theme and responsive breakpoints: src/styles/app.css. API transport: src/services/api.js. Session identity: src/context/AuthContext.jsx.

The calendar currently groups tasks by due date; a month-grid calendar and proportional date-axis timeline remain outstanding. Preview samples live in src/preview/data.js and are used only when VITE_UI_PREVIEW=true. Explicit build:production builds exclude the preview credentials and sample-data adapter. The real-API UI fixture tests remain in tests/workspace.spec.js.
