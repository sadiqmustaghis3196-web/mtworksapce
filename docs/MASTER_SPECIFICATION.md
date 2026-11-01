MT NEXUS GLOBAL — COMPLETE ERP SOFTWARE MASTER SPECIFICATION

REBUILD THE ORIGINAL APPLICATION FROM THE ATTACHED SCREENSHOT

You are the Principal Software Architect, Senior React Developer, Node.js Backend Engineer, PostgreSQL Database Engineer, UI/UX Engineer, QA Engineer, and Technical Teacher for MT Nexus Global.

I want a COMPLETE, FUNCTIONAL SOFTWARE HOUSE MANAGEMENT PLATFORM.

Do not deliver a simplified demo, static mockup, or incomplete dashboard.

The attached screenshot is the primary visual reference. Match its layout, branding, sidebar, Kanban behavior, task cards, typography, and color hierarchy as closely as practical.

The previous project files were deleted because they were poorly organized. The goal is to rebuild the full functionality with clean architecture, not reduce the software's scope.

PART 1 — TECH STACK

Frontend:

- React + Vite
- JavaScript / JSX
- React Router
- Modular reusable components
- CSS variables and responsive styles
- Accessible dialogs, forms, tables, menus

Backend:

- Node.js + Express
- REST APIs
- Controllers, services, repositories where useful
- Validation and authorization middleware

Database:

- PostgreSQL
- Prisma ORM
- Relational schema and migrations

Authentication:

- Secure server-side sessions
- HttpOnly cookies
- Password hashing
- Login, logout, password reset
- Backend-enforced RBAC
- Audit logging

Use maintained compatible packages.

PART 2 — DESIGN SYSTEM

Reproduce the screenshot's original interface.

DESKTOP LAYOUT:

- Approximately 225px left sidebar
- MT Nexus Global logo at the top
- Active Persona / Role section
- Main navigation beneath
- Dark navy header
- Search bar
- Attendance/check-in indicator
- Theme toggle
- Premium-style accent badge
- User profile dropdown
- Responsive content area

COLORS:

- Deep navy background
- Purple gradient sidebar
- Purple-blue active navigation
- Cyan highlights
- Purple/cyan action buttons
- Dark cards with subtle borders
- Grid-pattern background

Avoid white blocks, excessive glow, and generic dashboard templates.

MOBILE:

- Hamburger sidebar
- Overlay and close behavior
- Responsive header
- Touch-friendly controls
- Horizontal Kanban scrolling
- Responsive tables and dialogs
- No unwanted horizontal page overflow

Support 320, 375, 390, 430, 768, 1024, and 1440px.

PART 3 — GLOBAL APPLICATION SHELL

Build reusable:

AppLayout
Sidebar
Topbar
ProfileDropdown
RoleBadge
NotificationCenter
SearchBar
ThemeToggle
AttendanceStatus
Breadcrumbs
PageHeader
DataTable
FilterBar
FormModal
ConfirmDialog
FileUploader
Pagination
EmptyState
LoadingState
ErrorState

Global features:

- Role-aware navigation
- Search across authorized records
- Notifications
- User profile
- Account settings
- Visible Logout
- Back to Dashboard / Exit Admin Panel
- Mobile sidebar
- Dark/light theme
- Consistent loading and error handling

Do not allow the role selector to impersonate another user. The active role must come from the authenticated server session. Any persona-switching demo feature must be disabled in production.

PART 4 — LOGIN AND AUTHENTICATION

SCREENS:

- Login
- Forgot Password
- Reset Password
- Profile
- Change Password
- Session Expired
- Access Denied

LOGIN:

- Company email
- Password
- Show/hide password
- Remember me
- Forgot password
- Sign in

API:
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password
PATCH /api/auth/password

Implement secure sessions, cookie protection, rate limiting, generic login errors, session expiration, and server-side authorization.

No public self-registration.

Provide secure initial Super Admin provisioning without hardcoded passwords.

PART 5 — USER ROLES

Implement:

SUPER_ADMIN
ADMIN
DEPARTMENT_MANAGER
PROJECT_MANAGER
TEAM_LEAD
EMPLOYEE
INTERN
HR_MANAGER
FINANCE_MANAGER
SALES_MANAGER
SUPPORT_AGENT
CLIENT_VIEWER (optional external access)

Roles can be assigned according to company policy.

SUPER ADMIN:

- Full system administration
- Users and roles
- Departments
- Security settings
- Audit logs
- All authorized reports

ADMIN:

- Operational administration within assigned permissions

DEPARTMENT MANAGER:

- Department staff
- Department projects
- Approvals
- Team reports

PROJECT MANAGER:

- Project creation
- Task assignment
- Project timelines
- Review and approval

TEAM LEAD:

- Assigned team tasks
- Team progress
- Reviews as permitted

EMPLOYEE:

- Assigned tasks
- Attendance
- Leave requests
- Own profile
- Work submissions

INTERN:

- Assigned internship tasks
- Progress
- Attendance if applicable
- Mentor feedback

HR MANAGER:

- Employees
- Recruitment
- Leave administration
- Internship program

FINANCE MANAGER:

- Invoices
- Expenses
- Payroll
- Financial reporting

SALES MANAGER:

- Leads
- Opportunities
- Client pipeline

SUPPORT AGENT:

- Assigned support tickets
- Ticket updates
- Resolutions

CLIENT VIEWER:

- Only explicitly shared client projects and records

Implement permissions such as:

users.read
users.create
users.update
users.deactivate
roles.manage
departments.manage
projects.create
projects.update
projects.delete
tasks.create
tasks.assign
tasks.update
tasks.submit_review
tasks.approve
tasks.reject
employees.read
employees.manage
attendance.manage
leaves.approve
finance.read
finance.manage
payroll.manage
crm.manage
tickets.manage
audit.read
settings.manage

Permissions must be checked on backend endpoints and scoped to the correct department, project, or owner.

PART 6 — DASHBOARD MODULE

ROUTE:
/dashboard

SCREENS:

- Company Overview
- My Dashboard
- Department Dashboard
- Team Dashboard
- Reports Overview

COMPONENTS:

- Total employees
- Active projects
- Tasks due today
- Tasks in progress
- Tasks awaiting review
- Completed tasks
- Attendance today
- Pending leave requests
- Pending approvals
- Client summary
- Recent activity
- Upcoming deadlines
- Notifications

Role-specific data:

- Super Admin: company-wide
- Manager: authorized departments/projects
- Employee: own assignments
- Intern: own activities

APIs:
GET /api/dashboard/overview
GET /api/dashboard/my-work
GET /api/dashboard/activity
GET /api/dashboard/approvals

All metrics must be derived from PostgreSQL records.

PART 7 — PROJECT BOARDS

ROUTES:
/projects
/projects/:projectId/board
/projects/:projectId/list
/projects/:projectId/calendar
/projects/:projectId/timeline

PROJECT CATEGORIES:

- Web App
- Graphic Design
- Video Editing
- Social Media Marketing
- SEO

SCREENS:

- All Projects
- Project Details
- Kanban Board
- List View
- Calendar View
- Timeline View
- Project Members
- Project Settings

KANBAN STAGES:

1. Upcoming
2. Today To Do
3. In Progress
4. Review
5. Done
6. Reject

MATCH SCREENSHOT:

- Compact task cards
- Category badge
- Priority badge
- Client/project label
- Task number and title
- Due date
- Assignee avatar
- Progress bar
- Task count per column
- Add Card in relevant columns
- Stage-specific actions

Support both fully expanded columns and compact collapsed vertical stage rails, as in the original application.

Clicking a collapsed rail must expand it.

TASK WORKFLOW:
Upcoming -> Today To Do
Today To Do -> In Progress
In Progress -> Review
Review -> Done (Approve)
Review -> Reject (Reject)
Reject -> In Progress (Rework, if authorized)

IMPORTANT:
When an employee clicks Send for Review, the task must MOVE to Review in the database.

When a manager approves, the task must MOVE to Done.

When a manager rejects, the task must MOVE to Reject or follow a configurable rework transition.

Do not delete tasks during transitions.

Record every transition in task history.

Show success/error feedback.

Prevent unauthorized transitions.

APIs:
GET /api/projects
POST /api/projects
GET /api/projects/:id
PATCH /api/projects/:id
GET /api/projects/:id/tasks
POST /api/projects/:id/tasks
GET /api/tasks/:id
PATCH /api/tasks/:id
POST /api/tasks/:id/transition
POST /api/tasks/:id/assign

PART 8 — ADVANCED TASK DETAILS MODAL

Build one shared Trello-style task modal for Board, List, Calendar, and Timeline views.

SECTIONS:

- Task title
- Task description
- Status
- Priority
- Assignees
- Reporter/creator
- Labels
- Due date
- Start date
- Progress
- Checklists
- Subtasks
- Comments
- Attachments
- Activity history
- Approval status
- Review notes
- Rejection reason
- Related project/client

ACTIONS:

- Edit
- Assign
- Move stage
- Add checklist
- Add comment
- Upload attachment
- Submit for review
- Approve
- Reject
- Reopen
- Archive (authorized only)

Use a responsive modal with desktop two-column layout and mobile single-column layout.

Persist all changes through backend APIs.

PART 9 — CLIENT OPERATIONS

ROUTES:
/clients
/clients/new
/clients/:id
/clients/:id/projects
/clients/:id/contacts

SCREENS:

- Client Directory
- Add Client
- Client Profile
- Client Contacts
- Client Projects
- Client Activity

FIELDS:

- Company name
- Contact person
- Email
- Phone
- Industry
- Address
- Client status
- Assigned account manager
- Notes
- Related projects

FUNCTIONS:

- Create/edit clients
- Assign account manager
- Link projects
- Manage contacts
- Search/filter
- View client history

APIs:
/api/clients
/api/clients/:id
/api/clients/:id/contacts
/api/clients/:id/projects

PART 10 — HIRING & ATS

ROUTES:
/hiring
/hiring/jobs
/hiring/applicants
/hiring/interviews

SCREENS:

- Recruitment Dashboard
- Job Openings
- Applicants
- Candidate Profile
- Hiring Pipeline
- Interviews
- Offers

STAGES:
Applied
Screening
Interview
Assessment
Offer
Hired
Rejected

FUNCTIONS:

- Create job posting
- Add candidate
- Upload resume
- Schedule interview
- Record evaluation
- Move hiring stage
- Record hiring decision

APIs:
/api/jobs
/api/applications
/api/interviews

PART 11 — EMPLOYEES

ROUTES:
/employees
/employees/new
/employees/:id
/employees/:id/documents

SCREENS:

- Employee Directory
- Add Employee
- Employee Profile
- Employment Details
- Team Assignments
- Documents
- Onboarding/Offboarding

FIELDS:

- Employee ID
- Full name
- Work email
- Phone
- Department
- Designation
- Manager
- Joining date
- Employment status
- Role
- Work arrangement

FUNCTIONS:

- Create/update profiles
- Assign department
- Assign manager
- Manage employment status
- Link login account
- Search/filter/export according to permissions

APIs:
/api/employees
/api/employees/:id

PART 12 — ATTENDANCE & LEAVES

ROUTES:
/attendance
/attendance/my
/attendance/team
/leaves
/leaves/approvals

SCREENS:

- My Attendance
- Team Attendance
- Check-in/Check-out
- Timesheets
- Leave Requests
- Leave Approvals
- Leave Calendar

FUNCTIONS:

- Check in/out
- Record attendance
- Request leave
- Approve/reject leave
- View balances
- Attendance reporting
- Configurable leave policy

APIs:
/api/attendance
/api/attendance/check-in
/api/attendance/check-out
/api/leaves
/api/leaves/:id/approve
/api/leaves/:id/reject

PART 13 — INTERNSHIP PROGRAM

ROUTES:
/internships
/internships/programs
/internships/interns
/internships/:id

SCREENS:

- Internship Overview
- Programs
- Intern Directory
- Intern Profile
- Mentor Assignments
- Training Tasks
- Progress Reviews
- Completion Records

FUNCTIONS:

- Create program
- Enroll intern
- Assign mentor
- Assign learning tasks
- Track progress
- Evaluate performance
- Record completion

APIs:
/api/internships
/api/internship-enrollments
/api/internship-evaluations

PART 14 — FINANCE & PAYROLL

ROUTES:
/finance
/finance/invoices
/finance/payments
/finance/expenses
/finance/payroll
/finance/reports

SCREENS:

- Finance Dashboard
- Invoices
- Invoice Details
- Payments
- Expenses
- Payroll Records
- Financial Reports

FUNCTIONS:

- Create invoice
- Add invoice items
- Track payment status
- Record expense
- Prepare payroll records
- View financial summaries
- Export authorized reports

Use decimal-safe financial calculations.

Payroll execution and external transfers must require explicit approval and integration.

APIs:
/api/invoices
/api/payments
/api/expenses
/api/payroll

PART 15 — CREATIVE STUDIO

ROUTES:
/creative
/creative/requests
/creative/assets
/creative/reviews

SCREENS:

- Creative Overview
- Design Requests
- Video Editing Requests
- Creative Brief
- Asset Library
- Revision Requests
- Approvals

FUNCTIONS:

- Create creative brief
- Assign designer/editor
- Upload deliverables
- Request revision
- Approve/reject creative work
- Track revision history

APIs:
/api/creative-requests
/api/creative-assets
/api/creative-revisions

PART 16 — SALES & CLIENTS CRM

ROUTES:
/crm
/crm/leads
/crm/opportunities
/crm/pipeline
/crm/activities

SCREENS:

- Sales Dashboard
- Lead Directory
- Lead Details
- Opportunity Pipeline
- Follow-up Calendar
- Sales Activities
- Sales Reports

STAGES:
New Lead
Contacted
Qualified
Proposal
Negotiation
Won
Lost

FUNCTIONS:

- Add lead
- Assign salesperson
- Record calls/meetings
- Schedule follow-up
- Convert lead to client
- Track opportunities
- View sales reports

APIs:
/api/leads
/api/opportunities
/api/sales-activities

PART 17 — SUPPORT TICKETS

ROUTES:
/support
/support/tickets
/support/tickets/:id

SCREENS:

- Support Dashboard
- Ticket List
- Create Ticket
- Ticket Details
- Assigned Tickets
- Resolution History

FIELDS:

- Ticket number
- Subject
- Description
- Client
- Priority
- Status
- Assigned agent
- Due date
- Comments
- Attachments

STAGES:
Open
Assigned
In Progress
Waiting
Resolved
Closed

FUNCTIONS:

- Create ticket
- Assign agent
- Update priority
- Comment
- Attach files
- Resolve/reopen
- Track SLA deadlines

APIs:
/api/tickets
/api/tickets/:id
/api/tickets/:id/comments

PART 18 — DEPARTMENTS

ROUTES:
/departments
/departments/new
/departments/:id
/departments/:id/members

SCREENS:

- Department Directory
- Department Details
- Add/Edit Department
- Department Members
- Department Manager
- Department Projects
- Department Performance

FIELDS:

- Department name
- Code
- Description
- Manager
- Parent department (optional)
- Status

FUNCTIONS:

- Create/edit departments
- Assign manager
- Add/remove members
- Link projects
- View department workload
- Prevent unauthorized modifications

APIs:
/api/departments
/api/departments/:id
/api/departments/:id/members

PART 19 — ROLES & PERMISSIONS

ROUTES:
/admin/users
/admin/roles
/admin/permissions
/admin/audit-logs
/admin/settings

SCREENS:

- User Management
- Add User
- User Details
- Role Management
- Permission Matrix
- Audit Logs
- System Settings

FUNCTIONS:

- Create internal accounts
- Assign roles
- Set permissions
- Assign department
- Activate/deactivate user
- Initiate password reset
- View audit history

Enforce all permissions on the backend.

Do not rely on hiding frontend buttons as security.

PART 20 — DATABASE MODELS

Create normalized Prisma models for:

User
Role
Permission
UserRole
RolePermission
Session
PasswordResetToken
AuditLog
Department
EmployeeProfile
Project
ProjectMember
Task
TaskAssignment
TaskComment
TaskChecklist
TaskChecklistItem
TaskAttachment
TaskActivity
TaskLabel
Client
ClientContact
JobOpening
JobApplication
Interview
Attendance
LeaveRequest
LeaveBalance
InternshipProgram
InternshipEnrollment
InternshipEvaluation
Invoice
InvoiceItem
Payment
Expense
PayrollRecord
CreativeRequest
CreativeAsset
CreativeRevision
Lead
Opportunity
SalesActivity
SupportTicket
TicketComment
Notification

Use appropriate relations, indexes, foreign keys, unique constraints, timestamps, and migrations.

PART 21 — CLEAN PROJECT STRUCTURE

Use:

src/
components/
common/
navigation/
tasks/
forms/
layouts/
pages/
auth/
dashboard/
projects/
clients/
hiring/
employees/
attendance/
internships/
finance/
creative/
crm/
support/
departments/
admin/
routes/
services/
hooks/
context/
styles/
assets/

backend/
src/
routes/
controllers/
services/
middleware/
validators/
lib/
prisma/
schema.prisma
migrations/
tests/
package.json
.env.example

docs/
PROJECT_STRUCTURE.md
SCREEN_FILE_MAP.md
API_ENDPOINTS.md
DATABASE_MODELS.md
DEVELOPMENT_PROGRESS.md
lessons/

Do not create duplicate application roots or scattered HTML screens.

PART 22 — IMPLEMENTATION AND TESTING

Build in logical milestones:

1. Existing project audit
2. PostgreSQL + Prisma
3. Authentication
4. Users + roles + permissions
5. Dashboard and responsive layout
6. Project Boards + task modal
7. Clients
8. Hiring
9. Employees
10. Attendance
11. Internships
12. Finance
13. Creative Studio
14. Sales CRM
15. Support
16. Departments and final integration
17. Security, responsive QA, documentation

Do not skip dependencies between modules.

For each module:

- Build real React screens
- Implement API endpoints
- Implement database models
- Add validation
- Enforce permissions
- Test CRUD
- Test core workflow
- Test mobile responsiveness
- Verify data persists after refresh

Do not claim a module is complete until its core workflow has been tested.

PART 23 — DOCUMENTATION AND TEACHING

I am learning software development.

For every milestone explain in simple Roman Urdu:

- What was built
- Which files were created
- What each file does
- How the React frontend works
- How the Express API works
- How Prisma communicates with PostgreSQL
- Which database tables are involved
- How authentication and permissions work
- How I can test it myself

Keep documentation synchronized with actual implementation.

FINAL REQUIREMENTS

The finished system must have:

- All requested modules
- Professional screenshot-matched UI
- Working mobile responsiveness
- Real login/logout
- Proper user roles
- Functional task workflow
- Review/Approve/Reject
- Shared task modal
- Working Board/List/Calendar/Timeline
- Database-backed records
- Clean file structure
- Working endpoints
- No fake success reports
- Clear documentation

START BY INSPECTING THE EXISTING LOCAL PROJECT AND THE ATTACHED SCREENSHOT.

Then create the complete implementation map and start coding the real application.

Continue through milestones autonomously where safe.

If context limits interrupt work, save a precise checkpoint and resume from it later.

Do not stop after creating a demo or visual mockup.