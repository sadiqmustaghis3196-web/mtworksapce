# Notifications ka working flow

Bell pe click karein: usi screen ke upar dropdown notification list khulti hai; nayi screen nahi khulti. All, Unread aur Read se list filter karein. Mark read/unread badge ko update karta hai; Mark all read current lens ki notifications read karta hai. Open related work se linked task document ya module record khulta hai aur notification read ho jati hai. Refresh ke baad bhi status rehta hai.

Pehle mobile CSS bell ko hide karti thi aur reminders sirf dashboard se bante the. Ab bell mobile par visible hai; app ke har page par feed 15 seconds mein aur local change/focus par update hoti hai. Naya alert aane par popup bhi dikhta hai. Initial purani notifications dobara popup nahi kartin. Review event ke saath same din ka duplicate review reminder nahi banta.

Dashboard view/Profile perspective preview lens ke mutabiq inbox scoped hota hai. Employee view doosre recipient ki notifications nahi dikhata. Database phase abhi deferred hai: yeh in-app, browser-local notifications hain; app band ho to background delivery, email ya mobile push nahi hota.

Check commands: npm run test:notifications; npm run test:preview.

Dropdown ki apni search aur scroll hai. Bahar click, close ya Escape se list band hoti hai. Current screen, uski search aur board/list view wahi rehte hain. Sirf Open related work dabane par related task/record khulta hai. Dashboard View all aur alert popup ka View notifications bhi isi dropdown ko kholte hain.
