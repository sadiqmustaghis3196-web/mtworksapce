import fetch from 'node-fetch';

const token = process.env.ADMIN_TOKEN;
const email = process.env.INVITE_EMAIL;

if (!token || !email) {
  console.error("Missing ADMIN_TOKEN or INVITE_EMAIL in process.env");
  process.exit(1);
}

const baseUrl = 'http://localhost:5000/api';

async function run() {
  const res = await fetch(`${baseUrl}/admin/users/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ email, role: 'fleet_manager' })
  });
  
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}

  console.log(`Status: ${res.status}`);
  if (json && json.success) {
    if (json.message === "Invitation created, but the email could not be sent." || json.message === "Invitation already exists.") {
       console.log(`Message: ${json.message}`);
       const token = json.data?.token;
       // The frontend invite URL logic
       if (token) {
           console.log(`Invite Link (Manual): http://localhost:5173/accept-invitation?token=${token}`);
       }
    } else {
       console.log("Message: Invitation sent successfully.");
    }
  } else {
    console.log(`Error: ${json ? json.error : text}`);
  }
}

run().catch(console.error);
