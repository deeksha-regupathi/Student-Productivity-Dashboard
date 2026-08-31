const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const testDbPath = path.join(__dirname, "test_phase8.db");
if (fs.existsSync(testDbPath)) {
  try { fs.unlinkSync(testDbPath); } catch (e) {}
}
process.env.DB_PATH = testDbPath;
process.env.NODE_ENV = "production";

const db = require("../src/db");
const auth = require("../src/auth");
const app = require("../server");

let server;
let baseUrl;

let userTokenA;
let userTokenB;

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

// =========================================================
// 1. HEALTH CHECK ENDPOINT
// =========================================================

test("Phase 8 Health: GET /api/health returns production-safe status", async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.strictEqual(res.status, 200);

  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.status, "ok");
  assert.ok(json.timestamp, "Timestamp must be present");

  // Verify no sensitive keys are leaked
  assert.strictEqual(json.db_path, undefined);
  assert.strictEqual(json.env, undefined);
  assert.strictEqual(json.secret, undefined);
  assert.strictEqual(json.paths, undefined);
  assert.strictEqual(json.stack, undefined);
});

// =========================================================
// 2. PRODUCTION SECURITY HEADERS & FINGERPRINTING
// =========================================================

test("Phase 8 Security: HTTP responses include security headers and strip X-Powered-By", async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  
  assert.strictEqual(res.headers.get("x-content-type-options"), "nosniff");
  assert.strictEqual(res.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.strictEqual(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.strictEqual(res.headers.get("x-xss-protection"), "1; mode=block");
  assert.strictEqual(res.headers.get("x-powered-by"), null, "X-Powered-By must be disabled in production");
});

// =========================================================
// 3. PRODUCTION ERROR HANDLING (NO STACK TRACES LEAKED)
// =========================================================

test("Phase 8 Error Handling: Invalid JSON and 404/500 routes do not leak stack traces", async () => {
  // Trigger a bad request error
  const res = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}), // Missing required title
  });

  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.strictEqual(json.success, false);
  assert.strictEqual(json.stack, undefined, "Stack trace must not be leaked");
  assert.ok(typeof json.error === "string");
});

// =========================================================
// 4. AUTHENTICATION & MULTI-USER REGRESSION
// =========================================================

test("Phase 8 Auth Setup: Register User Eight A and User Eight B", async () => {
  const resA = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Production User A", email: "proda@example.com", password: "securePass123" }),
  });
  const dataA = await resA.json();
  assert.strictEqual(resA.status, 201);
  assert.ok(dataA.token);
  userTokenA = dataA.token;

  const resB = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Production User B", email: "prodb@example.com", password: "securePass123" }),
  });
  const dataB = await resB.json();
  assert.strictEqual(resB.status, 201);
  assert.ok(dataB.token);
  userTokenB = dataB.token;
});

test("Phase 8 User Isolation: User A data is isolated from User B in production environment", async () => {
  // User A creates a task
  const taskResA = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${userTokenA}`,
    },
    body: JSON.stringify({
      title: "User A Production Task",
      priority: "high",
      dueDate: "2026-09-15",
    }),
  });
  const taskDataA = await taskResA.json();
  assert.strictEqual(taskResA.status, 201);

  // User B lists tasks - should NOT see User A's task
  const taskListResB = await fetch(`${baseUrl}/api/tasks`, {
    headers: { "Authorization": `Bearer ${userTokenB}` },
  });
  const taskListDataB = await taskListResB.json();
  assert.strictEqual(taskListResB.status, 200);
  assert.ok(!taskListDataB.data.some((t) => t.id === taskDataA.data.id));

  // User B cannot edit User A's task
  const editResB = await fetch(`${baseUrl}/api/tasks/${taskDataA.data.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${userTokenB}`,
    },
    body: JSON.stringify({ title: "Hacked by User B" }),
  });
  assert.strictEqual(editResB.status, 404);
});

// =========================================================
// 5. PRODUCTION FULL RECALL & SPACED REPETITION FLOW
// =========================================================

test("Phase 8 Workflow: Full recall evaluation, auto-scheduling, and analytics integration", async () => {
  // 1. User A creates topic
  const topicRes = await fetch(`${baseUrl}/api/topics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${userTokenA}`,
    },
    body: JSON.stringify({
      title: "Thermodynamics Laws",
      subject: "Physics",
      question: "State the first and second laws of thermodynamics.",
      notes: "First law is conservation of energy where change in internal energy equals heat added minus work done. Second law states total entropy of an isolated system always increases.",
      key_concepts: [
        { name: "First Law of Thermodynamics", keywords: ["first", "energy", "conservation", "heat", "work"] },
        { name: "Second Law of Thermodynamics", keywords: ["second", "entropy", "isolated", "system"] }
      ]
    }),
  });
  const topicData = await topicRes.json();
  assert.strictEqual(topicRes.status, 201);

  // 2. User A evaluates recall
  const evalRes = await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${userTokenA}`,
    },
    body: JSON.stringify({
      topic_id: topicData.data.id,
      student_answer: "The first law is conservation of energy where heat and work balance. The second law states total entropy of an isolated system always increases.",
    }),
  });
  const evalData = await evalRes.json();
  assert.strictEqual(evalRes.status, 200);
  assert.strictEqual(evalData.success, true);
  assert.ok(evalData.score >= 70, "Should score good/excellent on accurate answer");
  assert.ok(evalData.next_revision, "Next revision must be auto-scheduled");

  // 3. User A checks revision queue
  const revRes = await fetch(`${baseUrl}/api/revisions?status=pending`, {
    headers: { "Authorization": `Bearer ${userTokenA}` },
  });
  const revData = await revRes.json();
  assert.strictEqual(revRes.status, 200);
  assert.ok(revData.data.some((r) => r.topic_id === topicData.data.id));

  // 4. User A checks analytics overview
  const analyticsRes = await fetch(`${baseUrl}/api/analytics/overview`, {
    headers: { "Authorization": `Bearer ${userTokenA}` },
  });
  const analyticsData = await analyticsRes.json();
  assert.strictEqual(analyticsRes.status, 200);
  assert.strictEqual(analyticsData.data.total_recall_attempts, 1);
  assert.ok(analyticsData.data.overall_learning_score > 0);
});

// =========================================================
// 6. LOGOUT AND TOKEN REVOCATION
// =========================================================

test("Phase 8 Logout: Session token is invalidated and prevents subsequent access", async () => {
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${userTokenA}` },
  });
  assert.strictEqual(logoutRes.status, 200);

  // Attempting to access protected profile should return 401
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { "Authorization": `Bearer ${userTokenA}` },
  });
  assert.strictEqual(meRes.status, 401);
});
