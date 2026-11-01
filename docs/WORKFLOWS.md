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
11. **Departments/admin:** Maintain managers/hierarchy and inspect member/project links. Cyclic hierarchy and deactivating a department with active staff are blocked. Active preview accounts can sign in with their configured email and the public test password. Role permissions are enforced by the browser adapter; they are not secure server authorization or real credentials. Audit rows are read-only.
12. **Reporting/data:** Search/filter, pipeline views, pagination and CSV export are available per collection. Dashboard/notifications use current local records. Administration → Settings exports a full JSON backup. Reset sample data requires confirmation and removes local work; it does not change any remote database.

Uploads allow PDF/PNG/JPG/TXT/DOCX up to 1 MB per file and consume browser storage. Browser quota failures show an error instead of success. Download important backups before clearing site data. Full server-based storage, security, accounting integrations and production deployment are not implemented by these local workflows.

## Daily work and accountability

After login, select the dashboard role/profile lens and work date. Managers see their scoped team; employees and interns see personal assignments. Set a daily goal against an assigned unfinished task. Start the task, then Log daily update with work summary, actual minutes, current overall progress, phase, blocker and next step. Updates can only be recorded for today, by an assigned active employee; review-stage updates cannot bypass approval. A change from 60% to 80% contributes 20 percentage points to today's work, not 80%. Multiple updates retain their snapshots.

Select Testing or Quality check when reporting that work. Send for Review uses the existing approval process; approval completes the task and rejection returns it through rework. Daily history records reported work separately from current task state. Admin/team views summarize each person's reports, time, approvals and blockers. Personal preview views hide review/assignment controls.

Notification preferences control deadline/review reminders and daily digest time (Asia/Karachi). Reminders are local, deduplicated and checked while the dashboard is open. Mark read persists. These role lenses and records are for UI testing; real shared accounts, permissions and remote notifications require the later backend phase.

## Task brief → pipeline → document → PDF

Add Card → enter title and document blocks → choose project/members → create. Assigned Upcoming work appears in Plan & assign. Open a stage’s task list, then its task document. Edit paragraphs/headings, insert an image with caption, add more text below, move blocks up/down, preview and Save document. Close prompts before discarding unsaved document changes. Daily reports and workflow stages remain linked to this task.

Print / Save PDF opens a separate A4 print view; click its Print / Save as PDF button and choose Save as PDF. It uses the currently shown document draft and includes live ownership, deadlines, stage changes, daily reports, checklists and comments. Keep edits with Save document before leaving the task. Existing PDFs are attachments, not editable document sources.

## Notification inbox

Use the header bell on desktop or mobile to open an anchored dropdown without navigating away. All/Unread/Read filters and current-view search narrow the inbox. Mark read/unread changes the persistent badge; Mark all read affects the current preview lens. Open related work marks the alert read and opens its task document or linked module record. Task transitions notify reviewers/assignees, and deadlines/review/digest reminders honor the existing reminder preferences.

The feed refreshes immediately after local changes, on focus/storage changes and every 15 seconds throughout the app, not only on the dashboard. New unread items show an in-app popup. Existing history is not replayed at login. These are browser-local alerts while the app is open, not email/device push notifications.

The notification dropdown has its own search and scroll area. Opening it, filtering and marking read preserve the current screen, current-view search and selected board view. Outside click, Escape or its close button dismiss it; Escape returns focus to the bell. Only the explicit Open related work action navigates to the task/record. Dashboard View all and live alert View notifications open the same dropdown. The old `/notifications` URL remains available for existing bookmarks, but the bell no longer opens it.

## Move and open cards

On the board, drag a card or its handle to a highlighted next stage. On touch screens use the handle; Move to… also works with a keyboard. Existing approval/rejection gates remain: Review→Done is approval, Review→Reject asks for instructions, and Done/Reject→In Progress is rework. Refresh preserves the same task and transition history. Click non-control areas of a board or daily-work card to open it; controls perform their own action.

Uploaded document images are small clickable previews. Click one to open the larger original; Escape or Close image returns to the task without closing its document. PDF output continues to include the image in its document order.

## Client revisions and ongoing updates

From In Progress, Review or Done choose Request revision (or drag/Move to… Revision & Updates) → describe client instructions → request. Card moves to its own revision column; the same ID, document and assignees remain. Open Revisions to post work notes. Start revision → In Progress → daily work/reporting → Send for Review → Approve completes the round. Further client feedback creates the next numbered round while preserving old instructions/updates. Reject remains a separate decision. The dashboard revision lane opens pending revision tasks, and document/PDF views include the round history. Creative Studio Request revision follows this same task stage.

## Account hierarchy, people and attendance

Super Admin → create Admin account / configure role permissions → Admin creates employee profile → complete onboarding → create active employee account linked to that profile. Preview accounts use the public UI-preview password shown on login. Employee login opens personal assignments and cannot switch into someone else’s dashboard lens. Employee CRM starts with Add client lead and no aggregate operations panels. Only Super Admin sees module Operations Overview.

Open a person profile to review assignments/progress, deadlines, daily work, documents and monthly attendance. Intern profiles add enrollment/program/mentor context. Department templates open a prefilled form; saving creates a real local department record, and assigning people/projects populates its team/pipeline.

Attendance: check in/out normally, or Admin adds/corrects a date with arrival/departure, unpaid break and a reason. Times use PKT; duplicate/future/reversed shifts are rejected. Corrections retain previous values and can be inspected in the register. Recorded days/hours are totals of actual stored records; missing days are not assumed absent.

Cash & bank: add a draft movement and counterparty/client → Post movement → included in recorded inflow/outflow and client positions → Void movement with reason if reversed. Use invoice Payments for invoice receipts to avoid entering the same receipt twice. Recorded expenses/payroll also contribute; the view is a local ledger, not a bank integration. Posted history remains locked.

Task delete: Admin opens the card and confirms deletion. The board record disappears and its full original is retained in the archive/audit. Linked records and child tasks require resolving references first; posted financial/attendance history uses reversal/correction rather than deletion.
