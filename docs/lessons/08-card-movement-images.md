# Card move aur image preview

Board par card ko drag karke highlighted column mein chhorein. Mobile par Drag handle use karein; Move to… dropdown keyboard/mobile ka alternative hai. Kaam Today se In Progress aur phir Review mein jata hai. Review se Done approval hai; Reject par reason dena zaroori hai. Done/Reject se In Progress rework hai. Card ki ID aur history nahi badalti.

Card ki blank jagah, project naam ya progress pe click se task document khulta hai. Buttons, selects aur doosre controls apna action karte hain; task saath mein nahi khulta. Focused card par Enter/Space bhi kaam karta hai.

Document images chhoti thumbnails hain. Click se full image viewer khulta hai. Escape ya Close image se viewer band hota hai, task/document wahi rehta hai. PDF mein original image rehti hai; thumbnail sirf editor/preview ka display hai.

Checks: npm run test:preview; node --test tests/cardRules.test.js. Browser suite desktop drag, touch drag, history persistence, rejection reason, card click aur image viewer ko cover karti hai.
