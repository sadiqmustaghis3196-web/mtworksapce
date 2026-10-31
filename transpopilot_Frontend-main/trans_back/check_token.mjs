import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'd:/Sharjeel/transpopitlot_web/trans_back/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTokens() {
    const { data: integrations } = await supabase
        .from('fleet_integrations')
        .select('*')
        .eq('provider_id', 'samsara');
        
    integrations.forEach(i => {
        console.log('Org:', i.organization_id);
        if(i.credentials && i.credentials.apiKey) {
            console.log('Token starts with:', i.credentials.apiKey.substring(0, 15) + '...');
        } else {
            console.log('No API Key');
        }
    });
}
checkTokens();
