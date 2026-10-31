const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function createBucket() {
  const bucketName = 'fleet-receipts';
  console.log(`Checking if bucket ${bucketName} exists...`);
  
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error("Error listing buckets:", listError);
    return;
  }
  
  const exists = buckets.find(b => b.name === bucketName);
  
  if (exists) {
    console.log(`Bucket ${bucketName} already exists. (public: ${exists.public})`);
  } else {
    console.log(`Creating bucket ${bucketName}...`);
    const { data, error } = await supabase.storage.createBucket(bucketName, {
      public: false, // Must be explicitly false/private
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
      fileSizeLimit: 10485760 // 10MB
    });
    
    if (error) {
      console.error("Error creating bucket:", error);
    } else {
      console.log(`Bucket ${bucketName} created successfully!`, data);
    }
  }
}

createBucket();
