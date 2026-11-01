# Software-house workflows — Roman Urdu

Ab pehle wale “Module not available yet” pages hata diye hain. Har module mein forms, tables, detail dialog aur uske apne workflow actions hain. Database ko aapki instruction ke mutabiq baad ke phase mein rakha hai; filhal records isi browser mein save hote hain.

## Nayi files ka kaam

- `src/modules/catalog.js`: har module ke fields, required values, related record choices, columns aur allowed actions define karta hai.
- `src/modules/store.js`: asal browser business rules chalata hai. Candidate hire ho to employee banta hai; payment aaye to invoice balance badalta hai; leave approve ho to balance kam hota hai.
- `src/pages/modules/ModuleWorkspace.jsx`: reusable list, pipeline, filters, details, pagination, export aur action dialogs dikhata hai.
- `RecordForm.jsx`: text, dates, amounts, employee/client/project selections, files aur permission checkboxes dikhata hai.
- `src/preview/api.js`: React ke api() calls ko is local store tak le jata hai. Yeh Express ya PostgreSQL request nahi hai.
- `ScheduleViews.jsx`: calendar ka month grid aur asli dates ke mutabiq task timeline banata hai.
- `src/services/files.js`: file type/size check aur browser mein file read karta hai.

## Har module ka seedha flow

- Client Operations: client banao, uske contacts banao, project se link karo.
- Projects: team aur manager select karo, board kholo, task assign karo, review aur approve/reject karo. Task delete nahi hota.
- Hiring: job publish → applicant → screening → interview → assessment → offer → hire. Hire se linked onboarding employee banta hai.
- Employees: profile/department/manager edit, onboarding/offboarding aur documents manage karo.
- Attendance: employee select karke check-in/out. Leave request approve karne par working-day balance kam hota hai; cancel se wapas aata hai.
- Internship: program → enrollment/mentor → progress review → 100% progress → completion.
- Finance: draft invoice → items → issue → recorded payment. Overpayment reject hoti hai. Payroll approval ke baghair record nahi hoti; real bank payment nahi bheji jati.
- Creative: brief → start → file upload → review → approve/revise. Iska linked board task bhi move hota hai.
- Sales: lead ko stages se Won tak lao, phir client mein convert karo. Duplicate conversion nahi hoti.
- Support: assign → start → resolve notes → close/reopen. Responses aur files alag tab mein hain.
- Departments: team/manager aur hierarchy manage karo. Active employees wale department ko deactivate nahi kar sakte.
- Roles: preview accounts aur permission matrix save kar sakte ho. Yeh real server security nahi hai; backend phase mein endpoint-level authorization lagegi.

## Data aur testing

Changes ke baad refresh karo: records rehte hain. Doosre device/browser par share nahi hote. Settings se workspace JSON backup aur tables se CSV download kar sakte ho. Reset se pehle confirmation aayegi.

`npm run build` se UI build hoti hai. `node tests/workflows.test.js` se business rules test hote hain. Built app ko port 8002 par serve karke `npm run test:preview` se browser workflows test hote hain. Is testing mein API fake responses intercept nahi kiye; asli local workflow code use hua. PostgreSQL persistence, real logins aur real permissions ke tests abhi baad ke phase mein hain.
