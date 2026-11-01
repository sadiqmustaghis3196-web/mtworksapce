# Software-house operations — current UI guide

Database abhi baad mein hai, jaisa aapne confirm kiya. Is waqt data isi browser mein save hota hai; backup Admin Settings se download karein. Doosre device par shared data ya secure real logins abhi nahi hain.

## Super Admin aur Admin

Default login: admin@mtnexus.test / NexusUI@2026!. Roles & Permissions → Accounts mein Admin account create karein, ADMIN role select karein. Sirf Super Admin administrator accounts aur role permissions badal sakta hai. Role level ADMIN/SUPER_ADMIN ko poora operational access milta hai; employee/custom role ke liye module ki Read aur required Create/Update/Delete/approve checkboxes tick karein. Read module kholne ke liye zaroori hai.

Admin Employees mein profile create kare, onboarding complete kare, phir Accounts mein us profile ko linked EMPLOYEE/INTERN account de. Active preview account apne email aur wahi public UI-preview password se login kar sakta hai. Yeh UI testing hai, real password security nahi. Apni active access remove karna aur protected Super role delete karna blocked hai.

## Employee aur intern

Employees ki directory logon ke hisaab se hai. Kisi bande ko kholein: current assignments, stage, deadline, overall progress, reported work, documents aur month-wise attendance nazar aayegi. Intern directory mein person, program, mentor, learning progress aur enrollment history milti hai. Employee ko apna dashboard aur apna work scope milta hai; admin persona controls nahi. Sales mein Add client lead se directly apna lead record karein.

## Attendance

Attendance register mein person aur month select karein. Check in/out actual presence record karta hai. Admin Add attendance ya Correct attendance se arrival/departure, break minutes aur reason de sakta hai. Time Asia/Karachi hai. Old/new values correction history mein rehti hain. Duplicate attendance, future records aur ulte times accept nahi hote. Total days aur hours recorded attendance par hain; unrecorded days ko automatically absent nahi kehte.

## Finance

Invoice payment Payments mein record karein. Finance → Cash & bank mein client refund, vendor payout, owner contribution ya doosra non-invoice movement banayein. Client movement ko client se link karein, reference, amount, account, date aur purpose dein. Draft balance mein count nahi hota. Post se count hota hai; reversal par Void aur reason dein. Posted financial record ko edit/delete karke history nahi mitati. Cash-flow view client-wise received/paid/outstanding aur recorded movements dikhata hai; bank transfer nahi bhejta.

## Board aur dashboard

Admin card khol kar edit kare ya Delete card confirm kare. Original archive/audit mein rehta hai, ID reuse nahi hoti. Linked workflows/subtasks ko pehle resolve karna padta hai. Dashboard Follow assigned task mein task choose karein. Start work aur daily phase updates se red marker Build, Testing, Quality, Review ya Revision par move hota hai. Iska matlab reported workflow hai, automatic software testing/deployment nahi.

## Departments aur UI

Department directory mein manager, members aur project/workload dekhein. Department kholne par people aur delivery pipeline nazar aati hai. Templates Engineering, QA, Design, Marketing, Sales, HR, Finance aur Support ki prefilled form kholte hain; save ke baghair data create nahi hota. Operations Overview sirf Super Admin ko milta hai. Light/dark themes, statuses, secondary controls, borders, focus aur reduced-motion behavior refine kiye gaye hain.

Role ka Delete checkbox Edit se alag hai: sirf Read + Delete milne par record delete ho sakta hai, Edit ka button nahi aata. References aur posted/audited history ki restrictions phir bhi apply hoti hain. Card deletion ke baad original archive mein rehta hai aur naya card purani ID reuse nahi karta.
