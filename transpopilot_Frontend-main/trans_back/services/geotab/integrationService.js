import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

/**
 * Resolves the active Geotab integration for a given organization.
 * @param {string} organizationId 
 * @returns {Promise<{ credentials: any, serverPath: string }>}
 */
export async function resolveGeotabIntegration(organizationId) {
  if (!organizationId) {
    throw new Error("Missing organizationId.");
  }

  const { data: integrations, error } = await supabase
    .from("fleet_integrations")
    .select("provider_id, credentials")
    .eq("organization_id", organizationId)
    .eq("status", "connected");

  if (error || !integrations || integrations.length === 0) {
    throw new Error("No connected geotab integration");
  }

  const integration = integrations.find(p => p.provider_id === "geotab");
  if (!integration || !integration.credentials) {
    throw new Error("No connected geotab integration");
  }

  // To get serverPath, we must authenticate once or assume standard path.
  // The caller (geotabApi/geotabLimiter) usually authenticates if needed.
  return integration.credentials;
}
