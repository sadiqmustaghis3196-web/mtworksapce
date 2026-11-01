# Milestone 1–6 foundation — Roman Urdu lesson

## Abhi kya bana hai?

Pehle purana project inspect kiya. Backend aur Prisma models mojood thay, lekin React frontend nahi tha. Ab `src/` mein React/Vite app hai. Sidebar, topbar, login forms, dashboard aur task board banaye hain. Yeh abhi poora ERP nahi hai; baqi modules aur database integration pending hain.

## Files ka kaam

- `src/main.jsx`: React app start karta hai aur routes select karta hai.
- `src/context/AuthContext.jsx`: server se logged-in user poochta hai. Role browser se choose ya impersonate nahi hota.
- `src/layouts/AppLayout.jsx`: sidebar, search, profile menu, logout aur mobile navigation rakhta hai.
- `src/pages/projects/Projects.jsx`: API se tasks leta hai aur Board/List/Calendar/Timeline mein dikhata hai. Calendar abhi due-date grouping hai; full month calendar pending hai.
- `src/components/tasks/TaskModal.jsx`: ek shared dialog mein task edit, comment aur activity dikhata hai. Upload aur checklist editing abhi nahi bani.
- `src/services/api.js`: browser ki requests Express ko bhejta hai. Error aaye to fake success nahi dikhata.
- `server/src/routes/auth.js`: password verify karta hai aur database session banata hai. Cookie HttpOnly hai, is liye JavaScript token read nahi karta.
- `server/src/services/taskWorkflow.js`: allowed stage transitions check karta hai.
- `server/src/services/taskScope.js`: user ko sirf uske organization aur authorized project/assignment ke records tak rakhta hai.
- `server/prisma/schema.prisma`: tables aur relations define karta hai.

## Request ka safar

React button → api.js → Express route → validation aur permission check → Prisma → PostgreSQL → JSON response → React screen refresh.

Send for Review se task delete nahi hota. Backend stage ko Review karta hai aur TaskActivity mein purani/nayi stage save karta hai. Dono ek transaction mein honge. Approve se Done aur progress 100 hoti hai. Reject ke liye reason aur reviewer permission chahiye. Database par yeh workflow abhi test nahi hua, kyun ke Prisma engine download blocked hai.

## Authentication aur permissions

Login par random session token cookie mein aata hai; database mein uska hash aur expiry rehti hai. Logout database se session delete karta hai. Password change sab sessions revoke karta hai. UserRole → RolePermission → Permission se module grants nikalte hain. Backend har request dobara check karta hai; sirf button hide karna security nahi hoti. Complete configurable permission matrix abhi pending hai.

Seed default password ya account nahi banata. Pehla Super Admin operator command se securely provision hoga. Password-reset email ke liye SMTP configuration chahiye; is environment mein delivery verify nahi hui.

## Khud kaise test karein?

1. Root par `npm run build` se React build check karein.
2. `npm test` se workflow/security unit tests chalayein.
3. `npm run dev -- --port 8001` aur doosri terminal mein `npm run test:ui` chalayein. Yeh browser tests API fixtures istemal karte hain; real database proof nahi hain.
4. Environment settings mein binaries.prisma.sh allow karke Prisma generate karein. Uske baad disposable database par migrations aur naya integration suite run karna zaroori hai.

Abhi safe checkpoint yeh hai: UI aur pure rule tests pass hain; database/auth end-to-end aur baqi ERP modules complete nahi hain. `docs/DEVELOPMENT_PROGRESS.md` se agla kaam resume karein.
