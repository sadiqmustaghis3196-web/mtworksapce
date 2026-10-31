import { supabase } from './config/supabase.js';

async function verifyState2() {
  const email = 'kahasufyan@gmail.com';
  
  // drivers
  const { data: drivers } = await supabase.from('drivers').select('*').eq('email', email);
  console.log("drivers:", drivers);
  
  // driver_onboarding_progress
  if (drivers && drivers.length > 0) {
    const { data: prog } = await supabase.from('driver_onboarding_progress').select('*').eq('driver_id', drivers[0].id);
    console.log("driver_onboarding_progress:", prog);
  }
}

verifyState2();
