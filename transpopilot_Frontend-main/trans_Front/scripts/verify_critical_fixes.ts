
import { createClient } from '@supabase/supabase-js';
import { vehicleAPI } from '../src/api/vehicles';
import { createRoute } from '../src/api/routes';
import { driverAPI } from '../src/api/drivers';
// import 'dotenv/config'; // Removed to avoid dependency issues

// Native fetch is available in modern Node.js environments
if (!globalThis.fetch) {
  console.warn('Native fetch not found, proceeding anyway...');
}

// Mock browser env variables if running in node without vite loading .env
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyFixes() {
  console.log('🚀 Starting Verification Script...');

  // 1. Authenticate (using a test account)
  const randomStr = Math.random().toString(36).substring(2, 7);
  const email = `verify.${randomStr}${Date.now()}@test-org-verifier.com`;
  const password = 'TestPassword123!';
  
  console.log(`🔐 Creating test account: ${email}`);
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
        data: {
            full_name: 'Test Verifier',
            role: 'admin',
            organization_name: 'Test Org'
        }
    }
  });

  if (authError) {
    console.error('❌ Auth Failed:', authError.message);
    // If it's "email confirmation required", we might need to use a known working account or mock it?
    // For now assuming signup works or dev mode is loose.
    return;
  }

  const user = authData.user;
  if (!user) {
      console.error('❌ No user created');
      return;
  }
  console.log('✅ User created:', user.id);

  // Wait for profile/org trigger creation (simulating frontend delay)
  console.log('⏳ Waiting for organization creation trigger...');
  await new Promise(r => setTimeout(r, 5000));

    // Force check profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) {
      console.error('❌ Organization ID missing after wait.');
      console.log('🛠️ Attempting Manual Fallback Creation (simulating AuthContext fix)...');
      
      try {
        // 1. Create Org
        const slug = `verify-${Date.now()}`;
        const { data: newOrg, error: createError } = await supabase
            .from('organizations')
            .insert({ 
                name: 'Verification Org', 
                slug: slug,
                subscription_tier: 'free' 
            })
            .select('id')
            .single();

        if (createError) {
             console.error('❌ Fallback Org Creation Failed:', createError.message);
        } else if (newOrg) {
             console.log('✅ Fallback Org Created:', newOrg.id);
             // 2. Update Profile
             const { error: updateError } = await supabase
                .from('user_profiles')
                .update({ organization_id: newOrg.id, role: 'admin' })
                .eq('id', user.id);
            
            if (updateError) {
                console.error('❌ Fallback Profile Update Failed:', updateError.message);
            } else {
                console.log('✅ Fallback Profile Updated. Re-authenticating...');
                // Re-login to refresh session claims if needed (though local client might need refresh)
                // await supabase.auth.refreshSession(); 
            }
        }
      } catch (e: any) {
          console.error('❌ Fallback Exception:', e.message);
      }
  } else {
      console.log('✅ Organization ID found:', profile.organization_id);
  }

  // Login to set session for client (supabase client keeps state in memory)
  await supabase.auth.signInWithPassword({ email, password });

  // 2. Verify Vehicle Creation
  console.log('🚛 Verifying Vehicle Creation...');
  try {
    const vehicle = await vehicleAPI.create({
      vehicle_number: `V-${Date.now()}`,
      make: 'Toyota',
      model: 'Tacoma',
      year: 2024,
      vin: `VIN${Date.now()}`,
      status: 'active',
      current_mileage: 100,
      fuel_capacity: 20
    });
    console.log('✅ Vehicle Created:', vehicle.id);
  } catch (e: any) {
    console.error('❌ Vehicle Creation Failed:', e.message);
  }

  // 3. Verify Route Creation
  console.log('🗺️ Verifying Route Creation...');
  try {
    const route = await createRoute({
      name: 'Verification Route',
      description: 'Test route',
      status: 'planned',
      // API should self-heal if organization_id is missing from args but user is auth'd
      estimated_distance: 10,
      estimated_duration: 30
    } as any);
    console.log('✅ Route Created:', route.id);
  } catch (e: any) {
    console.error('❌ Route Creation Failed:', e.message);
  }

  // 4. Verify Driver Creation
  console.log('👤 Verifying Driver Creation...');
  try {
      const driver = await driverAPI.create({
          first_name: 'Test',
          last_name: 'Driver',
          email: `driver_${Date.now()}@test.com`,
          license_number: `LIC${Date.now()}`,
          license_expiry: '2030-01-01',
          status: 'active'
      });
      console.log('✅ Driver Created:', driver.id);
  } catch (e: any) {
      console.error('❌ Driver Creation Failed:', e.message);
  }

  console.log('🏁 Verification Complete');
}

verifyFixes().catch(console.error);
