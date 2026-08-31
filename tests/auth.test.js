const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

// Use dedicated test database for Phase 6 Auth
const testDbPath = path.join(__dirname, "test_auth.db");
if (fs.existsSync(testDbPath)) {
  try { fs.unlinkSync(testDbPath); } catch (e) {}
}
process.env.DB_PATH = testDbPath;

const db = require("../src/db");
const auth = require("../src/auth");
const app = require("../server");

let server;
let baseUrl;

let userAToken;
let userAData;
let userBToken;
let userBData;

test.before((t, done) => {
  server = http.createServer(app);
  server.listen(0, () => {
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
    done();
  });
});

test.after((t, done) => {
  server.close(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
    done();
  });
});

// ==========================================
// 1. REGISTRATION & PASSWORD HASHING
// ==========================================

test("1. Successful Registration and Password Hashing", async () => {
  const payload = {
    name: "Alice Johnson",
    email: "alice@example.com",
    password: "securePassword123"
  };

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(body.token, "Session token must be returned");
  assert.ok(body.user);
  assert.strictEqual(body.user.name, "Alice Johnson");
  assert.strictEqual(body.user.email, "alice@example.com");

  // Critical security check: password or hash MUST NOT be returned in API
  assert.strictEqual(body.user.password, undefined);
  assert.strictEqual(body.user.password_hash, undefined);
  assert.strictEqual(body.user.salt, undefined);

  // Check DB state: password must be hashed with salt, not stored plain text
  const dbUser = db.getDatabase().prepare("SELECT * FROM users WHERE email = ?").get("alice@example.com");
  assert.ok(dbUser);
  assert.notStrictEqual(dbUser.password_hash, "securePassword123");
  assert.ok(dbUser.salt);
  assert.ok(auth.verifyPassword("securePassword123", dbUser.salt, dbUser.password_hash));

  userAToken = body.token;
  userAData = body.user;
});

test("2. Duplicate Email Registration is Rejected (400)", async () => {
  const payload = {
    name: "Alice Imposter",
    email: "ALICE@EXAMPLE.COM", // case-insensitive check
    password: "anotherPassword"
  };

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.ok(body.error);
  assert.match(body.error, /already exists/i);
});

test("3. Invalid Registration Inputs Rejected (400)", async () => {
  // Short password (< 6 chars)
  const shortPassRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Bob", email: "bob@example.com", password: "123" })
  });
  assert.strictEqual(shortPassRes.status, 400);

  // Invalid email format
  const badEmailRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Bob", email: "notanemail", password: "password123" })
  });
  assert.strictEqual(badEmailRes.status, 400);

  // Missing name
  const noNameRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "", email: "bob@example.com", password: "password123" })
  });
  assert.strictEqual(noNameRes.status, 400);
});

// ==========================================
// 2. LOGIN & AUTHENTICATION STATE
// ==========================================

test("4. Successful User Login", async () => {
  const payload = {
    email: "Alice@example.com", // case-insensitive
    password: "securePassword123"
  };

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(body.token);
  assert.strictEqual(body.user.email, "alice@example.com");
  assert.strictEqual(body.user.password_hash, undefined);
});

test("5. Invalid Login Credentials (Safe Uniform 401 Error)", async () => {
  // Wrong password
  const wrongPassRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "alice@example.com", password: "wrongPassword" })
  });
  assert.strictEqual(wrongPassRes.status, 401);
  const wrongPassBody = await wrongPassRes.json();
  assert.strictEqual(wrongPassBody.error, "Invalid email or password.");

  // Non-existent email
  const wrongEmailRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nonexistent@example.com", password: "password123" })
  });
  assert.strictEqual(wrongEmailRes.status, 401);
  const wrongEmailBody = await wrongEmailRes.json();
  // Safe error: must not reveal whether email exists
  assert.strictEqual(wrongEmailBody.error, "Invalid email or password.");
});

test("6. Authentication State: GET /api/auth/me", async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { "Authorization": `Bearer ${userAToken}` }
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.user.id, userAData.id);
  assert.strictEqual(body.user.email, "alice@example.com");
});

test("7. Protected Route Without Token or With Invalid Token", async () => {
  // Without token to /api/auth/me
  const noTokenRes = await fetch(`${baseUrl}/api/auth/me`);
  assert.strictEqual(noTokenRes.status, 401);

  // With invalid token
  const badTokenRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { "Authorization": "Bearer invalid-or-fake-token-12345" }
  });
  assert.strictEqual(badTokenRes.status, 401);
});

test("8. Logout Invalidation", async () => {
  // Register temporary user to test logout
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Temp User", email: "temp@example.com", password: "password123" })
  });
  const regBody = await regRes.json();
  const tempToken = regBody.token;

  // Verify authenticated
  const meRes1 = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { "Authorization": `Bearer ${tempToken}` }
  });
  assert.strictEqual(meRes1.status, 200);

  // Call logout
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${tempToken}` }
  });
  assert.strictEqual(logoutRes.status, 200);

  // Verify token is now rejected
  const meRes2 = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { "Authorization": `Bearer ${tempToken}` }
  });
  assert.strictEqual(meRes2.status, 401);
});

// ==========================================
// 3. USER DATA ISOLATION TESTS
// ==========================================

test("9. User Data Isolation: User A creates topic, task, recall attempt and revision", async () => {
  // 1. User A creates custom topic
  const topicRes = await fetch(`${baseUrl}/api/topics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${userAToken}`
    },
    body: JSON.stringify({
      title: "Alice Private Topic - Quantum Mechanics",
      subject: "Physics",
      notes: "Quantum superposition allows particles to exist in multiple states simultaneously.",
      key_concepts: [{ name: "Superposition", keywords: ["quantum", "superposition", "particles"] }]
    })
  });
  assert.strictEqual(topicRes.status, 201);
  const topicBody = await topicRes.json();
  userAData.topicId = topicBody.data.id;

  // 2. User A creates a task
  const taskRes = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${userAToken}`
    },
    body: JSON.stringify({
      title: "Alice Private Study Task",
      description: "Review superposition formulas.",
      priority: "high"
    })
  });
  assert.strictEqual(taskRes.status, 201);
  const taskBody = await taskRes.json();
  userAData.taskId = taskBody.data.id;

  // 3. User A completes a recall attempt on their topic
  const evalRes = await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${userAToken}`
    },
    body: JSON.stringify({
      topic_id: userAData.topicId,
      student_answer: "Quantum superposition allows particles to be in multiple states simultaneously until measured."
    })
  });
  assert.strictEqual(evalRes.status, 200);
  const evalBody = await evalRes.json();
  userAData.attemptId = evalBody.attempt_id;
  userAData.revisionId = evalBody.next_revision.id;
});

test("10. Register User B and Verify Complete Data Isolation", async () => {
  // Register User B
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Bob Builder",
      email: "bob@example.com",
      password: "passwordBob123"
    })
  });
  assert.strictEqual(regRes.status, 201);
  const regBody = await regRes.json();
  userBToken = regBody.token;
  userBData = regBody.user;

  // 1. User B should NOT see User A's custom topic in topics list
  const topicsRes = await fetch(`${baseUrl}/api/topics`, {
    headers: { "Authorization": `Bearer ${userBToken}` }
  });
  const topicsBody = await topicsRes.json();
  assert.strictEqual(topicsRes.status, 200);
  assert.ok(!topicsBody.data.some(t => t.id === userAData.topicId), "User B must not see User A's private topic");

  // 2. User B cannot access User A's topic directly by ID
  const directTopicRes = await fetch(`${baseUrl}/api/topics/${userAData.topicId}`, {
    headers: { "Authorization": `Bearer ${userBToken}` }
  });
  assert.strictEqual(directTopicRes.status, 404);

  // 3. User B cannot see User A's tasks
  const tasksRes = await fetch(`${baseUrl}/api/tasks`, {
    headers: { "Authorization": `Bearer ${userBToken}` }
  });
  const tasksBody = await tasksRes.json();
  assert.strictEqual(tasksRes.status, 200);
  assert.strictEqual(tasksBody.data.length, 0, "User B should have 0 tasks initially");

  // 4. User B cannot update or delete User A's task
  const updateOtherTaskRes = await fetch(`${baseUrl}/api/tasks/${userAData.taskId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${userBToken}`
    },
    body: JSON.stringify({ title: "Hacked Task Title" })
  });
  assert.strictEqual(updateOtherTaskRes.status, 404);

  const deleteOtherTaskRes = await fetch(`${baseUrl}/api/tasks/${userAData.taskId}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${userBToken}` }
  });
  assert.strictEqual(deleteOtherTaskRes.status, 404);

  // 5. User B cannot see User A's recall attempts
  const historyRes = await fetch(`${baseUrl}/api/recall/history`, {
    headers: { "Authorization": `Bearer ${userBToken}` }
  });
  const historyBody = await historyRes.json();
  assert.strictEqual(historyRes.status, 200);
  assert.strictEqual(historyBody.data.length, 0, "User B should have 0 recall history attempts");

  // 6. User B cannot see User A's revisions
  const revsRes = await fetch(`${baseUrl}/api/revisions`, {
    headers: { "Authorization": `Bearer ${userBToken}` }
  });
  const revsBody = await revsRes.json();
  assert.strictEqual(revsRes.status, 200);
  assert.strictEqual(revsBody.data.length, 0, "User B should have 0 scheduled revisions");

  // 7. User B cannot complete User A's revision
  const completeRes = await fetch(`${baseUrl}/api/revisions/${userAData.revisionId}/complete`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${userBToken}` }
  });
  assert.strictEqual(completeRes.status, 404, "User B must not be able to complete User A's revision");

  // 8. User B cannot access User A's revision history for topic
  const topicRevsRes = await fetch(`${baseUrl}/api/revisions/${userAData.topicId}`, {
    headers: { "Authorization": `Bearer ${userBToken}` }
  });
  assert.strictEqual(topicRevsRes.status, 404);

  // 9. User B's analytics must be completely isolated (0 attempts, score 0, no insights from User A)
  const analyticsRes = await fetch(`${baseUrl}/api/analytics/overview`, {
    headers: { "Authorization": `Bearer ${userBToken}` }
  });
  const analyticsBody = await analyticsRes.json();
  assert.strictEqual(analyticsRes.status, 200);
  assert.strictEqual(analyticsBody.data.total_recall_attempts, 0);
  assert.strictEqual(analyticsBody.data.overall_learning_score, 0);

  const insightsRes = await fetch(`${baseUrl}/api/analytics/insights`, {
    headers: { "Authorization": `Bearer ${userBToken}` }
  });
  const insightsBody = await insightsRes.json();
  assert.strictEqual(insightsRes.status, 200);
  assert.strictEqual(insightsBody.data[0].type, "recommendation");
  assert.match(insightsBody.data[0].title, /Welcome to StudyPulse Analytics/i);
});
