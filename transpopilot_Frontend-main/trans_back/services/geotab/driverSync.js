import { callGeotabApi } from "./geotabApi.js";
import { supabase } from "../../config/supabase.js";
import { createStats, addError, chunkArray } from "../../utils/helpers.js";

export async function syncGeotabDrivers(organizationId, credentials) {
  const stats = createStats();

  try {
    console.log(`[Geotab Drivers] Fetching users for org ${organizationId}`);

    const users = await callGeotabApi(
      organizationId,
      credentials,
      {
        method: "Get",
        params: {
          typeName: "User",
          resultsLimit: 50000
        }
      }
    );

    stats.fetched = users.length;

    const driverUsers = users.filter((user) => {
      return (
        user.isDriver === true ||
        user.driverLicenseNumber ||
        user.firstName ||
        user.lastName
      );
    });

    const rows = [];

    for (const user of driverUsers) {
      const fullName = user.name || "";
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = user.firstName || nameParts[0] || "Unknown";
      const lastName = user.lastName || nameParts.slice(1).join(" ") || "";

      const email =
        user.email ||
        (user.name && user.name.includes("@")
          ? user.name
          : `geotab-${user.id}@provider.local`);

      rows.push({
        organization_id: organizationId,
        first_name: firstName,
        last_name: lastName,
        email,
        // employee_id stores the provider's (Geotab/Samsara) driver ID for event-to-driver matching — NOT an HR employee number
        employee_id: user.id,
        license_number: user.driverLicenseNumber || `GEOTAB-${user.id}`,
        license_expiry: user.driverLicenseExpiryDate
          ? new Date(user.driverLicenseExpiryDate).toISOString().slice(0, 10)
          : "2099-12-31",
        status:
          user.activeTo && new Date(user.activeTo) < new Date()
            ? "inactive"
            : "active",
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
        console.log(`[Geotab Drivers] Duplicate email detected in batch: ${row.email}`);
      }
    }
    const finalRows = Array.from(uniqueDrivers.values());

    stats.mapped = finalRows.length;
    console.log(`[Geotab Drivers] Valid records (before dedupe): ${rows.length}, Duplicates: ${duplicateDriverCount}, Unique: ${finalRows.length}`);

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
