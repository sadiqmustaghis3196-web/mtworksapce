# Daily dashboard — Roman Urdu walkthrough

Login ke baad Daily work dashboard khulta hai. Admin ko team ka kaam, manager ko apne scope ka aur employee/intern ko apni assignments dikhte hain. Dashboard view aur Profile perspective UI testing ke lenses hain; account ya asli permissions change nahi karte.

1. Set daily goal se employee, assigned task, date aur target choose karein.
2. Start work karein, phir Log daily update mein aaj ka summary, actual minutes aur overall progress dein. Testing/Quality check phase aur blocker/next step bhi record ho sakta hai.
3. Agar pehle progress 60% thi aur ab 80% hai, aaj ka change +20 percentage points hai. Purana 60% aaj ka kaam nahi gina jata.
4. Send for Review ke baad manager Approve ya Reject kare. Reject ka kaam rework se Build mein wapas jata hai; approval se Done hota hai.
5. Team daily progress mein har shakhs ki updates, time aur blockers dekhein. View work uski worklist kholta hai. Date badal kar recorded history dekh sakte hain.
6. Notification preferences mein overdue, today, tomorrow, review aur daily digest choose karein. Time Asia/Karachi hai. Reminders sirf app khuli hone par in-app bante hain; email/push nahi jata.

Flow diagram manual delivery tracking hai. Git, Jenkins ya deployment tool integration abhi connected nahi hai. Data isi browser mein save hai; doosre device ya employee ke browser se share nahi hota. Database aur real roles ka phase baad mein hoga.

Checks: `npm run test:daily` mein 14 rule tests aur `npm run test:preview` mein 30 browser tests pass hue. Browser checks role templates, desktop/mobile, goal/preferences refresh, deadline reminders aur employee update ka admin view mein dikhna cover karte hain.

## Diagram aur colors

Desktop par flow do connected rows mein hai: pehli row left se right, phir neeche right se left. Arrows direction batate hain; dotted amber loop revisions ko Build mein wapas lata hai. Mobile par wahi six stages upar se neeche dikhte hain. Working stage/task ka phase-colored double border hota hai, review amber hai. Daily update record karne par progress aur time ka alag box green double border mein dikhata hai. Double border ke saath text bhi diya hai, is liye sirf color par depend nahi karte. Reduced motion setting animation band kar deti hai.
