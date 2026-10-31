import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  return new Response(
    JSON.stringify({ 
      success: false, 
      message: "The simulation endpoint has been permanently disabled for data integrity reasons." 
    }),
    { 
      status: 403, 
      headers: { "Content-Type": "application/json" } 
    }
  );
});