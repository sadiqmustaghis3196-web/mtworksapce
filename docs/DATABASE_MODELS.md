# Database model inventory

Existing Prisma schema: `server/prisma/schema.prisma`. PostgreSQL 16. Schema client generation is blocked by the environment network policy; no new migrations have been generated/applied.

New models:
- Session: unique hashed token, user foreign key with cascade deletion, expiry index. Never stores raw bearer/cookie secrets.
- TaskActivity: task foreign key, actor ID, from/to stages, optional reason and timestamp; written atomically with guarded transitions. Actor ID references User.
- Task.progress: integer progress, completion set to 100 through approval.

Existing areas: Organization, Role, Permission, RolePermission (with scope), UserRole, User, PasswordResetToken, Employee, Department, Project, ProjectMember, Task, TaskAssignee, TaskUpdate, TaskReview, TaskChecklist/Item, TaskAttachment, Client, Contract and retainer models, Lead, Candidate, Attendance, LeaveRequest, SupportTicket/Response, Invoice, Expense, PayrollRun/Payslip, Notification, AuditLog and automation models.

Pending normalization: JobOpening/Application/Interview; ClientContact; LeaveBalance; InternshipProgram/Enrollment/Evaluation; InvoiceItem/Payment; CreativeRequest/Asset/Revision; Opportunity/SalesActivity; generalized attachment storage and malware/content limits. RolePermission scope values are retained but a complete configurable policy engine is not implemented. Current task access is explicitly organization, project membership, assignment or department-manager scope; roles alone do not produce UI permission grants.

The reference seed creates role/permission metadata only, without demo people, tasks, default passwords or accounts. Existing historical integration tests expect the removed demo seed and must not be presented as current passing coverage.
