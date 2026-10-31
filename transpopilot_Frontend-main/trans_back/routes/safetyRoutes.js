import express from "express";
import { speedProfileEndpoint } from "../controllers/safetyController.js";

const router = express.Router();

router.post("/geotab-speed-profile", speedProfileEndpoint);

export default router;
