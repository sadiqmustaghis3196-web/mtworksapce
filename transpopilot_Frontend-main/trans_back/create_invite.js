import { supabase } from './config/supabase.js';
import crypto from "crypto";

async function createInvite() {
  const token = crypto.randomBytes(32).toString('hex');
  const { data, error } = await supabase.from('driver_invitations').insert({
    organization_id: '1f7849b1-e6d5-4565-a634-6a73499e9835',
    email: 'sufyan.newtest@gmail.com',
    first_name: 'Sufyan',
    last_name: 'New',
    employee_type: 'contractor',
    token: token,
    status: 'PENDING',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: 'b6fbfddd-e37e-4e28-9473-ff8c48b8ad1e' // Note: make sure this exists or it will foreign-key error
  }).select();

  if (error) {
    // try getting a valid user for created_by
    const {data: admin} = await supabase.from('user_profiles').select('id').eq('role', 'admin').limit(1).single();
    if (admin) {
        const { data: d2, error: e2 } = await supabase.from('driver_invitations').insert({
          organization_id: '1f7849b1-e6d5-4565-a634-6a73499e9835',
          email: 'sufyan.newtest@gmail.com',
          first_name: 'Sufyan',
          last_name: 'New',
          employee_type: 'contractor',
          token: token,
          status: 'PENDING',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          created_by: admin.id
        }).select();
        console.log("Token:", token, "Error:", e2);
    } else {
        console.log(error);
    }
  } else {
    console.log("Token:", token);
  }
}

createInvite();
