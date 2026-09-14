/**
 * LTX AI Text-to-Video — Express Backend Server
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import videoRoutes from "./routes/videoRoutes.js";

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "http://localhost:5173",  // Vite dev default
  "http://localhost:5174",  // Vite dev alternative
  "http://localhost:4173",  // Vite preview
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, Postman, same-origin SSR)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const videoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // max 20 generation requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many generation requests. Please wait 15 minutes before trying again.",
  },
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/video", videoLimiter, videoRoutes);
app.use("/api/tts", videoRoutes); // Expose the same router for TTS testing

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status:  "ok",
    service: "ai-video-automation-backend",
    timestamp: new Date().toISOString(),
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Endpoint not found." });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[Server Error]", err.message);
  res.status(500).json({ success: false, error: "Internal server error." });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   AI Video Automation Backend           ║
║   Listening on http://localhost:${PORT}    ║
╚══════════════════════════════════════════╝
  `);
});

export default app;
