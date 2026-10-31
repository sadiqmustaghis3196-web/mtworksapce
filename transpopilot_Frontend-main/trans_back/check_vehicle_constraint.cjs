require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await sb.from('vehicles').insert({ 
    organization_id: '387cf3be-c0fe-43af-9abe-93dc55fd9be3',
    vehicle_number: 'Demo - 06',
    vin: '2T1BU4EE0DC000000',
    make: 'test',
    model: 'test',
    year: 2024
  });
  console.log('Error 1:', error);

  const { data: d2, error: e2 } = await sb.from('vehicles').insert({ 
    organization_id: '387cf3be-c0fe-43af-9abe-93dc55fd9be3',
    vehicle_number: 'Demo - 99', 
    vin: '2T1BU4EE0DC000000',
    make: 'test',
    model: 'test',
    year: 2024
  });
  console.log('Error 2:', e2);
  
  const { data: d3, error: e3 } = await sb.from('vehicles').insert({ 
    organization_id: '387cf3be-c0fe-43af-9abe-93dc55fd9be3',
    vehicle_number: 'Demo - 06', 
    vin: 'NEW-VIN-123',
    make: 'test',
    model: 'test',
    year: 2024
  });
  console.log('Error 3:', e3);
}
run();
