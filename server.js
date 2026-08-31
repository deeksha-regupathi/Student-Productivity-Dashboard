const express = require("express");
const path = require("node:path");
const cors = require("cors");
require("dotenv").config();

const apiRouter = require("./src/routes/api");
const db = require("./src/db");

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database schema on boot
db.getDatabase();

// Middleware
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api", apiRouter);

// Serve static frontend files from project root
app.use(express.static(__dirname));

// Fallback route to index.html for SPA-style navigation
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    return res.sendFile(path.join(__dirname, "index.html"));
  }
  next();
});

// Central error handler
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal server error." });
});

// Start server if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`StudyPulse Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
