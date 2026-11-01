# Professional operations UI — Roman Urdu

Pehle har module mein ek jaisay counters aur generic forms thay. Ab har module ke kaam ke mutabiq overview aur context banaya hai. Database baad mein rahegi; yeh abhi browser-local workspace hai.

## Kya badla?

- Clients mein active accounts, live projects, outstanding invoices aur delivery health nazar aati hai. Client profile se usi client ke contacts/projects khulte hain.
- Hiring mein recruitment funnel ki stage par click karne se usi stage ke applicants khulte hain. Interviews ka schedule alag panel mein hai.
- People/attendance/internships mein team structure, onboarding, daily availability, leave approvals, program capacity aur mentor progress nazar aata hai.
- Finance mein draft invoice ko receivables nahi samjha jata. Sirf issued unpaid balances outstanding hain. Recorded payments ki monthly summary hai. Invoice detail ab line items, bill-from/bill-to, dates, payments aur balance ke saath document ki tarah dikhti hai.
- Creative aur support mein assigned work, review/deadline queues aur ownership dikhte hain. Ticket ke andar seedha reply likh sakte hain aur refresh ke baad response rehta hai.
- Sales mein lead funnel aur follow-up agenda hai. Administration mein role coverage aur recent changes hain.

## Professional form behavior

Contextual link se contacts/items/payments kholein to form mein related client/invoice pehle se select hota hai. Invoice number aur date suggest hoti hai. Employee select karne par new payroll mein salary suggest hoti hai, lekin agar aapne khud gross salary edit ki ho to woh overwrite nahi hoti. Deductions aur invoice line items ka live total bhi nazar aata hai. Actual validation store mein dobara hoti hai; sirf UI calculation par bharosa nahi kiya.

## Files ka kaam

- `src/modules/insights.js`: existing records se KPIs, progress, watchlists aur filter links banata hai. Fake growth numbers nahi hain.
- `src/modules/formSupport.js`: defaults, field help aur exact-cent calculations deta hai.
- `src/pages/modules/ModuleOverview.jsx`: module ke operations panels render karta hai.
- `src/pages/modules/RecordOverview.jsx`: profile header, workflow stages, invoice/payroll document aur ticket conversation render karta hai.
- `RecordForm.jsx`: in helpers ko use karke form ko context deta hai.
- `AppLayout.jsx`: Ctrl/Command+K search aur saved dark/light theme handle karta hai.

## Khud check karein

1. `npm run build` se preview build banayein.
2. `npm run test:preview` chalayein. Runner built app ka local server khud start kar sakta hai; installed system Chromium chahiye.
3. `node tests/insights.test.js` se 8 summary/calculation checks chalayein.
4. Login karke Client A → Manage contacts kholein; Add contact mein Client A preselected hona chahiye.
5. Invoice → View invoice items → Add item mein invoice preselected aur quantity/unit price ka live total hona chahiye.
6. Ticket ke andar response post karke refresh karein. Search ke liye Ctrl/Command+K aur theme toggle ke baad refresh bhi check karein.

25 browser tests aur 8 pure read-model/form tests pass hue. Yeh local UI/workflow evidence hai, PostgreSQL, real permissions, bank transfer ya email integration ka proof nahi. Aapka data abhi isi browser mein rehta hai; Settings se backup download kar sakte hain.
