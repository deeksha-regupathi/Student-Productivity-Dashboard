const express = require("express");
const path = require("node:path");
const cors = require("cors");
require("dotenv").config();

const apiRouter = require("./src/routes/api");
const db = require("./src/db");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const isProduction = process.env.NODE_ENV === "production";

// Initialize database schema on boot
db.getDatabase();

// Security: Disable Express fingerprint header
app.disable("x-powered-by");

// Production Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Configurable CORS Middleware
const corsOrigin = process.env.CORS_ORIGIN;
if (corsOrigin && corsOrigin !== "*") {
  const allowedOrigins = corsOrigin.split(",").map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin)
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    })
  );
} else {
  app.use(cors());
}

// Body parsing middleware
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api", apiRouter);

// Serve static frontend files from project root
app.use(express.static(__dirname));

// Fallback route to index.html for SPA-style client navigation
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    return res.sendFile(path.join(__dirname, "index.html"));
  }
  next();
});

// Central Production-Safe Error Handler
app.use((err, req, res, next) => {
  if (!isProduction) {
    console.error("Unhandled server error:", err);
  }
  const status = err.status || (err.message === "Not allowed by CORS" ? 403 : 500);
  const errorMessage = isProduction && status === 500 ? "Internal server error." : err.message || "Internal server error.";
  res.status(status).json({ success: false, error: errorMessage });
});

// Start server if run directly
let serverInstance = null;
if (require.main === module) {
  serverInstance = app.listen(PORT, HOST, () => {
    console.log(`StudyPulse Server running on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log("\nReceived shutdown signal. Closing StudyPulse server gracefully...");
    if (serverInstance) {
      serverInstance.close(() => {
        console.log("Server stopped.");
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

module.exports = app;

