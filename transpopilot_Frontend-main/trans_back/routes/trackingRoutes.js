import express from "express";
import { attachSupabaseUser, requireRole } from "../services/rbac.js";
import { vehicleTripsEndpoint, vehiclesListEndpoint, tripRouteEndpoint, liveLocationsEndpoint, watchVehicleEndpoint, getVehicleHistoryEndpoint } from "../controllers/trackingController.js";

const router = express.Router();

router.use(attachSupabaseUser);

router.get("/vehicles-list", vehiclesListEndpoint);
router.post("/vehicle-trips", vehicleTripsEndpoint);
router.post("/trip-route", tripRouteEndpoint);
router.post("/tracking/live-locations", requireRole("admin", "super_admin", "fleet_manager", "dispatcher"), liveLocationsEndpoint); // I noticed in Frontend it fetches /api/tracking/live-locations
router.post("/tracking/:vehicleId/watch", requireRole("admin", "super_admin", "fleet_manager", "dispatcher"), watchVehicleEndpoint);
router.get("/tracking/:vehicleId/history", requireRole("admin", "super_admin", "fleet_manager", "dispatcher"), getVehicleHistoryEndpoint);

export default router;
