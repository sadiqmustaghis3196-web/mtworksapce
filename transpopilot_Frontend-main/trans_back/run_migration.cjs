const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

const sql = `
-- Additive schema changes for fuel_records
ALTER TABLE fuel_records
ADD COLUMN IF NOT EXISTS fuel_type text,
ADD COLUMN IF NOT EXISTS receipt_url text,
ADD COLUMN IF NOT EXISTS data_source text,
ADD COLUMN IF NOT EXISTS external_transaction_id text,
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'disputed')),
ADD COLUMN IF NOT EXISTS notes text;

-- Create maintenance_records table
CREATE TABLE IF NOT EXISTS maintenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  service_date date NOT NULL,
  odometer numeric,
  engine_hours numeric,
  vendor text,
  description text,
  parts_repair_notes text,
  labor_cost numeric(10, 2),
  parts_cost numeric(10, 2),
  total_cost numeric(10, 2),
  receipt_url text,
  technician text,
  next_service_due_date date,
  next_service_due_mileage numeric,
  status text DEFAULT 'completed' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  notes text,
  data_source text DEFAULT 'manual',
  provider text,
  external_record_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for maintenance_records
CREATE INDEX IF NOT EXISTS idx_maintenance_records_vehicle ON maintenance_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_org ON maintenance_records(organization_id);
`;

async function runSQL() {
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
    console.error("RPC exec_sql failed:", error);
    const { data: d2, error: e2 } = await supabase.rpc('execute_sql', { sql: sql });
    if (e2) {
      console.error("RPC execute_sql failed:", e2);
      console.log("Could not find a way to execute SQL via RPC. I might need the connection string.");
    } else {
      console.log("Executed successfully with execute_sql:", d2);
    }
  } else {
    console.log("Executed successfully with exec_sql:", data);
  }
}

runSQL();
