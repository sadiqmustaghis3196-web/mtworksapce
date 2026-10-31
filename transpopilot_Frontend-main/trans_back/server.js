import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import apiRoutes from "./routes/index.js";
import { getErrorMessage } from "./utils/helpers.js";

dotenv.config();

const app = express();

import { initCronJobs } from './services/cronService.js';
initCronJobs();

import { startWorker } from './services/liveTrackingWorker.js';
startWorker();

const allowedOrigins = [
  "https://transpopilot-frontend-86a9.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.APP_BASE_URL,
].filter(Boolean).map((u) => u.replace(/\/+$/, ""));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, "");
      if (
        allowedOrigins.includes(cleanOrigin) ||
        cleanOrigin.endsWith(".vercel.app")
      ) {
        return callback(null, true);
      }
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  })
);
app.use(express.json({ limit: "10mb" }));

app.use(apiRoutes);

app.get("/api/health", async (req, res) => {
  return res.json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`
  });
});

app.use((error, req, res, next) => {
  console.error("[Unhandled Server Error]", error);
  res.status(500).json({
    success: false,
    error: getErrorMessage(error)
  });
});

const PORT = Number(process.env.PORT || 5000);

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});

export default app;