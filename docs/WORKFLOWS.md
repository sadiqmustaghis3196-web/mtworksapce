# Working browser workflows

Sign in with the public preview login shown on the form. Current records are local to this browser, not shared with a team. The following are the actual available flows, not claims of backend integration.

1. **Delivery:** Manage projects & teams → add project → select client, department, manager and members → Open project board → add a card → assign project members → plan/start → checklists/comments/files → Send for Review → Approve or Reject (reason required) → Rework. Task IDs/history survive transitions; no task is deleted on a move. Project completion requires all linked tasks to be Done.
2. **Clients:** Add a client, add contacts in Contacts, link projects to the client. Detail shows related records and changes. Referenced clients cannot be deleted until related records are reassigned.
3. **Hiring:** Create/publish a job → add applicant and resume → screening/interview/assessment/offer → hire. Interview time conflicts are rejected. Hiring creates one linked employee in Onboarding. Offers can record acceptance and joining salary/date. “Record offer sent” records an operator event; no email is sent.
4. **Employees:** Add/edit profiles, reporting manager, work arrangement and department. Complete onboarding, mark leave, start/complete offboarding. Upload/download employee documents. Reassign linked work before deleting an employee.
5. **Attendance:** Select an active employee, Check in, then Check out. Duplicate daily entries and repeated check-out are rejected. Leave Requests count Monday–Friday; overlapping requests are blocked. Approval deducts the relevant allowance; cancellation restores it. Cross-year requests must be split.
6. **Internships:** Create program/capacity → enroll an employee with a different mentor → start training → record progress reviews → set progress=100 → Record completion. Review and progress requirements are enforced.
7. **Finance:** Create draft invoice → add line items → Issue invoice → record partial/full payments. Totals are calculated in integer minor units; overpayment and edits to issued invoice items are rejected. Payments are immutable ledger records. Payroll is Draft → Pending approval → Approved → Recorded; no bank transfer occurs. Expenses also require approval before recording.
8. **Creative:** Add a brief tied to a project/designer → Start work creates a linked In Progress task → upload a deliverable → Submit for review → Approve or Request revision (instructions required). Linked task stages and revision history update.
9. **CRM:** Lead → Contacted → Qualified → Proposal → Negotiation → Won → Convert to client. Conversion creates a client once; opportunities can link to the lead and activities track follow-up dates.
10. **Support:** Create/assign ticket → In progress → Waiting or Resolve with resolution notes → Close or Reopen. Add responses and attachments in Responses. SLA deadlines are recorded for review; no external notification service runs.
11. **Departments/admin:** Maintain managers/hierarchy and inspect member/project links. Cyclic hierarchy and deactivating a department with active staff are blocked. Preview account/role permission records can be configured, but do not create real credentials or enforce server permissions. Audit rows are read-only.
12. **Reporting/data:** Search/filter, pipeline views, pagination and CSV export are available per collection. Dashboard/notifications use current local records. Administration → Settings exports a full JSON backup. Reset sample data requires confirmation and removes local work; it does not change any remote database.

Uploads allow PDF/PNG/JPG/TXT/DOCX up to 1 MB per file and consume browser storage. Browser quota failures show an error instead of success. Download important backups before clearing site data. Full server-based storage, security, accounting integrations and production deployment are not implemented by these local workflows.

## Daily work and accountability

After login, select the dashboard role/profile lens and work date. Managers see their scoped team; employees and interns see personal assignments. Set a daily goal against an assigned unfinished task. Start the task, then Log daily update with work summary, actual minutes, current overall progress, phase, blocker and next step. Updates can only be recorded for today, by an assigned active employee; review-stage updates cannot bypass approval. A change from 60% to 80% contributes 20 percentage points to today's work, not 80%. Multiple updates retain their snapshots.

Select Testing or Quality check when reporting that work. Send for Review uses the existing approval process; approval completes the task and rejection returns it through rework. Daily history records reported work separately from current task state. Admin/team views summarize each person's reports, time, approvals and blockers. Personal preview views hide review/assignment controls.

Notification preferences control deadline/review reminders and daily digest time (Asia/Karachi). Reminders are local, deduplicated and checked while the dashboard is open. Mark read persists. These role lenses and records are for UI testing; real shared accounts, permissions and remote notifications require the later backend phase.

## Task brief → pipeline → document → PDF

Add Card → enter title and document blocks → choose project/members → create. Assigned Upcoming work appears in Plan & assign. Open a stage’s task list, then its task document. Edit paragraphs/headings, insert an image with caption, add more text below, move blocks up/down, preview and Save document. Close prompts before discarding unsaved document changes. Daily reports and workflow stages remain linked to this task.

Print / Save PDF opens a separate A4 print view; click its Print / Save as PDF button and choose Save as PDF. It uses the currently shown document draft and includes live ownership, deadlines, stage changes, daily reports, checklists and comments. Keep edits with Save document before leaving the task. Existing PDFs are attachments, not editable document sources.
