import express from "express";
import { syncGeotabEndpoint, syncFuelEndpoint, syncSafetyEndpoint, syncSamsaraEndpoint, verifyGeotabEndpoint, verifySamsaraEndpoint } from "../controllers/syncController.js";

const router = express.Router();

router.post("/sync-geotab", syncGeotabEndpoint);
router.post("/sync-samsara", syncSamsaraEndpoint);
router.post("/verify-geotab", verifyGeotabEndpoint);
router.post("/verify-samsara", verifySamsaraEndpoint);
router.post("/sync-fuel", syncFuelEndpoint);
router.post("/sync-safety", syncSafetyEndpoint);

export default router;
