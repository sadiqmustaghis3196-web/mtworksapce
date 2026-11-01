# UI preview — Roman Urdu

Abhi user ne kaha hai pehle UI design finalize karna hai, database baad mein. Is liye ek alag preview mode banaya hai.

- `src/preview/config.js`: public test email/password aur build flag.
- `src/preview/data.js`: design review ke liye sample projects aur tasks.
- `src/preview/api.js`: preview login, board edits, comments aur stage moves browser storage mein rakhta hai. Server request nahi bhejta.
- `src/services/api.js`: preview build mein preview adapter; normal build mein asli Express API use karta hai.
- `vercel.json`: filhal sirf static preview deploy karta hai. Is mein database ki zaroorat nahi.
- `deployment/`: asli backend ki deployment files mehfooz hain. Baad mein `npm run prepare:production` se restore hongi.

Login: `admin@mtnexus.test` / `NexusUI@2026!`. Yeh public UI testing credentials hain, real admin account nahi. Asli backend par in se login nahi hota.

`npm run dev:preview` se design test karein. Card edit ya review/approve karne ke baad refresh karein: changes isi browser mein rehte hain. Reset sample data se original cards wapas aate hain. Doosre browser mein yeh data share nahi hota.

`npm run build` asli API mode hai. `npm run build:preview` UI preview hai. Dono ko database integration ka proof na samjhein.
