import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

/**
 * Resolves the active Samsara integration for a given organization.
 * @param {string} organizationId 
 * @returns {Promise<{ apiKey: string }>}
 */
export async function resolveSamsaraIntegration(organizationId) {
  if (!organizationId) {
    throw new Error("Missing organizationId.");
  }

  const { data: integrations, error } = await supabase
    .from("fleet_integrations")
    .select("provider_id, credentials")
    .eq("organization_id", organizationId)
    .eq("status", "connected");

  if (error || !integrations || integrations.length === 0) {
    throw new Error("No connected samsara integration");
  }

  const integration = integrations.find(p => p.provider_id === "samsara");
  if (!integration || !integration.credentials) {
    throw new Error("No connected samsara integration");
  }

  return integration.credentials;
}
