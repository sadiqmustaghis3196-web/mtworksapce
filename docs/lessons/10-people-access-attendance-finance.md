# People, access, attendance aur finance

UI ko generic module dashboards se aage role aur person ke hisaab se refine kiya hai. Employee directory ek bande ka profile/work record kholti hai; intern directory mentor/program context rakhti hai; department members aur task-stage counts se pipeline banti hai. Missing data ka fake progress ya assumed absence nahi banate.

Access model active preview account se role nikalta hai. Super Admin/Admin operational actions karte hain; Super role/Admin accounts ka control Super Admin ke paas hai. Employee apna assigned work aur direct lead entry dekhta hai. Permission matrix aur browser adapter dono action check karte hain. Local storage editable hai aur public password shared hai: isko production security na samjhein. Database aur real authentication aapke kehne par baad ka phase hai.

Attendance correction before/after snapshot aur reason rakhti hai. PKT timestamps ko UTC ISO mein store karke minutes calculate hote hain; breaks subtract hote hain. Finance mein amounts integer minor units se calculate hote hain; posted/voided state se inflow/outflow badalta hai. Payroll cash date actual recorded timestamp hai, salary month ka assumed first day nahi.

Follow assigned task marker task ke reported phase par move hota hai. Read-only role ke forged edit test mein adapter write reject karta hai; phir bhi server authorization alag phase hai. Light mode ke secondary buttons ka contrast bhi browser test mein check hota hai.

Sources: access.js, peopleOperations.js, financeFlow.js; PeopleViews/FinanceFlow, PermissionMatrix, themeRefinement.css. Checks: npm run test:operations; npm run test:preview. Current guide: docs/OPERATIONS_GUIDE.md.
