# Samsara Integration Checklist (Phase 2)

This checklist tracks the implementation steps required to bring Samsara to full feature parity with Geotab.

## Backend Endpoints (`server.js`)

- [ ] **`/api/vehicle-trips`**:
  - Implement query to fetch vehicle trips via Samsara `/fleet/trips` API.
  - Map Samsara trips to the standard frontend response schema (start time, stop time, distance, maximum speed, durations).
- [ ] **`/api/trip-summary`**:
  - Implement cumulative telemetry data parsing for Samsara-connected fleets over selected date ranges.
- [ ] **`/api/sync-safety`**:
  - Integrate with Samsara safety incident API (e.g. harsh braking, acceleration, crash events).
  - Map and save incoming incidents to the `safety_incident_reports` database table.
- [ ] **`/api/geotab-speed-profile`** (Rename to `/api/speed-profile`):
  - Query Samsara location/speed histories for specific vehicles.
  - Map speed profile datapoints.

## Frontend Modifications (`DriverTracking.tsx`)

- [ ] Verify frontend handling of the `providerNote` metadata when a Samsara-connected vehicle displays trips.

---

# General Todo / Notes
- [ ] **Security Improvement**: Encrypt telematics provider credentials (such as password and api_key) in the `fleet_integrations` table credentials JSON rather than storing them in plain text, before launching to production/paying customers.
- [ ] **OSRM Routing Server Warning**: Switch from the public OSRM demo server (`https://router.project-osrm.org`) to a self-hosted OSRM instance or commercial Directions APIs (Google/Mapbox) before launching the Route Optimization feature to paying customers/production.
- [ ] **Live Compliance & Incidents Sync**: Build a background sync pipeline for live compliance items (DVIRLogs/DutyStatusLogs) and recent incidents (ExceptionEvents/Samsara safety events) into the `compliance_items` and `safety_incident_reports` Supabase tables, replacing the current static/manual data.
- [ ] **Real Posted Speed Limits**: Currently, speed limits in the Speed Profile tab are hardcoded/estimated (100km/h for Geotab, 90km/h for Samsara). In the future, integrate a Maps API (e.g., Google Roads API or Mapbox) to reverse-geocode coordinates and obtain the exact real-world posted speed limits for these metrics.
