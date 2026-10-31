import { fetchAllSamsaraPages } from "./samsaraApi.js";
import { supabase } from "../../config/supabase.js";
import { createStats, addError, chunkArray } from "../../utils/helpers.js";

export async function syncSamsaraDrivers(organizationId, credentials) {
  const stats = createStats();

  try {
    console.log(`[Samsara Drivers] Fetching users for org ${organizationId}`);

    const users = await fetchAllSamsaraPages(credentials.apiKey, "/fleet/drivers");

    stats.fetched = users.length;

    const rows = [];

    for (const user of users) {
      const fullName = user.name || "";
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || "Unknown";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Fallback for email as Samsara doesn't always require one
      const email = user.email || `samsara-driver-${user.id}@provider.local`;

      rows.push({
        organization_id: organizationId,
        first_name: firstName,
        last_name: lastName,
        email,
        // employee_id stores the provider's (Geotab/Samsara) driver ID for event-to-driver matching — NOT an HR employee number
        employee_id: String(user.id),
        license_number: user.licenseNumber || `SAMSARA-${user.id}`,
        license_expiry: user.licenseState // Might just be a state string, but we need an expiry for the schema
          ? "2099-12-31" 
          : "2099-12-31",
        status: user.driverActivationStatus === "deactivated" ? "inactive" : "active",
        updated_at: new Date().toISOString()
      });
    }

    const uniqueDrivers = new Map();
    let duplicateDriverCount = 0;
    for (const row of rows) {
      const key = `${row.organization_id}_${row.email}`;
      if (!uniqueDrivers.has(key)) {
        uniqueDrivers.set(key, row);
      } else {
        duplicateDriverCount++;
        console.log(`[Samsara Drivers] Duplicate email detected in batch: ${row.email}`);
      }
    }
    const finalRows = Array.from(uniqueDrivers.values());

    stats.mapped = finalRows.length;
    console.log(`[Samsara Drivers] Valid records (before dedupe): ${rows.length}, Duplicates: ${duplicateDriverCount}, Unique: ${finalRows.length}`);

    if (!finalRows.length) {
      return stats;
    }

    const emailsToLookup = finalRows.map(r => r.email);
    const { data: existingDrivers } = await supabase
      .from("drivers")
      .select("email")
      .eq("organization_id", organizationId)
      .in("email", emailsToLookup);
      
    const existingEmails = new Set(existingDrivers?.map(d => d.email) || []);

    for (const chunk of chunkArray(finalRows, 500)) {
      const { error } = await supabase
        .from("drivers")
        .upsert(chunk, {
          onConflict: "organization_id,email"
        });

      if (error) {
        throw new Error(`[Supabase Drivers] ${error.message}`);
      }

      for (const row of chunk) {
        if (existingEmails.has(row.email)) {
          stats.updated += 1;
        } else {
          stats.inserted += 1;
        }
      }
    }

    return stats;
  } catch (error) {
    addError(stats, error);
    throw error;
  }
}
