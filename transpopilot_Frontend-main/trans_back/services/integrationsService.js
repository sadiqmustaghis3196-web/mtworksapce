import { supabase } from "../config/supabase.js";

export async function saveGeotabIntegration(organizationId, userId, credentials) {
  const row = {
    organization_id: organizationId,
    provider_id: "geotab",
    status: "connected",
    credentials
  };

  if (userId) {
    row.user_id = userId;
  }

  const { error } = await supabase
    .from("fleet_integrations")
    .upsert(row, {
      onConflict: "organization_id,provider_id"
    });

  if (error) {
    throw new Error(`[Integration Save] ${error.message}`);
  }
}

export async function getCachedIntegrations(organizationId) {
  const { data, error } = await supabase
    .from("fleet_integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "connected");

  if (error) {
    throw new Error(`[Integration Lookup] ${error.message}`);
  }

  return data || [];
}

export async function saveSamsaraIntegration(organizationId, userId, credentials) {
  const row = {
    organization_id: organizationId,
    provider_id: "samsara",
    status: "connected",
    credentials
  };
  if (userId) {
    row.user_id = userId;
  }
  const { error } = await supabase.from("fleet_integrations").upsert(row, { onConflict: "organization_id,provider_id" });
  if (error) throw new Error("[Integration Save] " + error.message);
}
