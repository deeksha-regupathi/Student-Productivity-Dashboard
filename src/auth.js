/**
 * Multi-User Authentication & Session Service (Phase 6)
 * Secure password hashing with PBKDF2 + SHA-512, timing-safe verification,
 * and token-based session management.
 */

const crypto = require("node:crypto");

const SALT_BYTES = 16;
const HASH_ITERATIONS = 10000;
const HASH_KEYLEN = 64;
const HASH_DIGEST = "sha512";
const SESSION_EXPIRY_DAYS = 7;

/**
 * Hash a plain text password with a unique cryptographic salt.
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEYLEN, HASH_DIGEST).toString("hex");
  return { salt, hash };
}

/**
 * Verify a plain text password against stored salt and hash using timing-safe comparison.
 */
function verifyPassword(password, salt, storedHash) {
  if (!password || !salt || !storedHash) return false;
  try {
    const computedHash = crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEYLEN, HASH_DIGEST).toString("hex");
    const storedBuf = Buffer.from(storedHash, "hex");
    const computedBuf = Buffer.from(computedHash, "hex");
    if (storedBuf.length !== computedBuf.length) return false;
    return crypto.timingSafeEqual(storedBuf, computedBuf);
  } catch (err) {
    return false;
  }
}

/**
 * Generate a cryptographically secure session token.
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Validate email format.
 */
function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
}

/**
 * Register a new user in the database.
 */
function registerUser({ name, email, password }, db) {
  if (!name || typeof name !== "string" || !name.trim()) {
    throw { status: 400, message: "Full name is required." };
  }
  if (!isValidEmail(email)) {
    throw { status: 400, message: "A valid email address is required." };
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    throw { status: 400, message: "Password must be at least 6 characters long." };
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check unique email
  const existing = db.prepare("SELECT id FROM users WHERE LOWER(email) = ?").get(normalizedEmail);
  if (existing) {
    throw { status: 400, message: "An account with this email already exists." };
  }

  const id = `user-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const { salt, hash } = hashPassword(password);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, salt, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), normalizedEmail, hash, salt, now);

  // Generate session token
  const token = createSession(id, db);

  return {
    user: {
      id,
      name: name.trim(),
      email: normalizedEmail,
      created_at: now
    },
    token
  };
}

/**
 * Authenticate user credentials and create a session.
 */
function loginUser({ email, password }, db) {
  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    throw { status: 400, message: "Email and password are required." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE LOWER(email) = ?").get(normalizedEmail);

  // Safe uniform error message without revealing if email exists
  if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
    throw { status: 401, message: "Invalid email or password." };
  }

  const token = createSession(user.id, db);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.created_at
    },
    token
  };
}

/**
 * Create a new session for a user.
 */
function createSession(userId, db) {
  const token = generateSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, expiresAt, now.toISOString());

  return token;
}

/**
 * Invalidate a session token.
 */
function deleteSession(token, db) {
  if (!token) return;
  db.prepare("DELETE FROM sessions WHERE id = ?").run(token);
}

/**
 * Get user by session token.
 */
function getUserByToken(token, db) {
  if (!token) return null;
  const now = new Date().toISOString();

  const row = db.prepare(`
    SELECT u.id, u.name, u.email, u.created_at, s.expires_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > ?
  `).get(token, now);

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    created_at: row.created_at
  };
}

/**
 * Express Authentication Middleware.
 * Extracts token from Authorization header (Bearer <token>) or x-auth-token.
 * Options:
 * - strict: if true, returns 401 when token is missing or invalid.
 *           if false, falls back to demo/guest user if no token is provided.
 */
function authMiddleware({ strict = false } = {}, getDb) {
  return (req, res, next) => {
    const db = getDb();
    const authHeader = req.headers["authorization"] || req.headers["x-auth-token"];
    let token = null;

    if (authHeader) {
      if (authHeader.startsWith("Bearer ") || authHeader.startsWith("bearer ")) {
        token = authHeader.slice(7).trim();
      } else {
        token = authHeader.trim();
      }
    }

    if (token) {
      const user = getUserByToken(token, db);
      if (!user) {
        return res.status(401).json({ error: "Invalid or expired authentication token. Please log in again." });
      }
      req.user = user;
      req.userId = user.id;
      req.token = token;
      return next();
    }

    // No token provided
    if (strict || req.headers["x-require-auth"] === "true") {
      return res.status(401).json({ error: "Authentication required. Please log in." });
    }

    // Fallback for Phase 1-5 legacy tests without auth header
    const defaultUser = db.prepare("SELECT id, name, email, created_at FROM users WHERE id = 'demo-user-1'").get();
    if (defaultUser) {
      req.user = defaultUser;
      req.userId = defaultUser.id;
    } else {
      req.user = { id: "demo-user-1", name: "Deeksha", email: "deeksha@studypulse.local" };
      req.userId = "demo-user-1";
    }

    next();
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  registerUser,
  loginUser,
  createSession,
  deleteSession,
  getUserByToken,
  authMiddleware
};
