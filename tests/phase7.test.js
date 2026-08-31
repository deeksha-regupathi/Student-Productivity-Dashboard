const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const testDbPath = path.join(__dirname, "test_phase7.db");
if (fs.existsSync(testDbPath)) {
  try { fs.unlinkSync(testDbPath); } catch (e) {}
}
process.env.DB_PATH = testDbPath;

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
// 1. FRONTEND ACCESSIBILITY & PRODUCTION ASSETS
// =========================================================

test("Phase 7 Frontend: index.html contains accessible skip link, theme toggle, and toast container", async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.strictEqual(res.status, 200);
  const html = await res.text();

  assert.ok(html.includes('class="skip-link"'), "Skip link present");
  assert.ok(html.includes('id="toastContainer"'), "Toast container present");
  assert.ok(html.includes('id="confirmDialog"'), "Confirmation dialog present");
  assert.ok(html.includes('id="themeToggleBtn"'), "Theme toggle button present");
  assert.ok(html.includes('data-theme="light"'), "Initial data-theme attribute present");
  assert.ok(html.includes('id="sidebarCloseBtn"'), "Mobile sidebar close button present");
});

test("Phase 7 Frontend: style.css contains dark theme variables and responsive drawer classes", async () => {
  const res = await fetch(`${baseUrl}/style.css`);
  assert.strictEqual(res.status, 200);
  const css = await res.text();

  assert.ok(css.includes('[data-theme="dark"]'), "Dark theme CSS variables defined");
  assert.ok(css.includes('.toast-container'), "Toast container styles defined");
  assert.ok(css.includes('.confirm-dialog'), "Confirmation dialog styles defined");
  assert.ok(css.includes('@media (max-width: 768px)'), "Mobile breakpoint defined");
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), "Reduced motion support defined");
});

test("Phase 7 Frontend: script.js contains toast, confirm dialog, and theme logic", async () => {
  const res = await fetch(`${baseUrl}/script.js`);
  assert.strictEqual(res.status, 200);
  const js = await res.text();

  assert.ok(js.includes("showToast"), "showToast defined");
  assert.ok(js.includes("showConfirmDialog"), "showConfirmDialog defined");
  assert.ok(js.includes("applyTheme"), "applyTheme defined");
  assert.ok(js.includes("apiFetch"), "Central apiFetch defined");
});

// =========================================================
// 2. TOPIC CRUD & USER ISOLATION
// =========================================================

test("Phase 7 Setup: Register two test users", async () => {
  const resA = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "User Seven A", email: "user7a@example.com", password: "password123" }),
  });
  const dataA = await resA.json();
  assert.strictEqual(resA.status, 201);
  userTokenA = dataA.token;

  const resB = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "User Seven B", email: "user7b@example.com", password: "password123" }),
  });
  const dataB = await resB.json();
  assert.strictEqual(resB.status, 201);
  userTokenB = dataB.token;
});

test("Phase 7 Topics: User A creates a custom topic", async () => {
  const res = await fetch(`${baseUrl}/api/topics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${userTokenA}`,
    },
    body: JSON.stringify({
      title: "Cell Division & Mitosis",
      subject: "Biology",
      question: "Describe the phases of mitosis in somatic cells.",
      notes: "Mitosis comprises Prophase, Metaphase, Anaphase, and Telophase resulting in two identical diploid daughter cells.",
    }),
  });

  const json = await res.json();
  assert.strictEqual(res.status, 201);
  assert.strictEqual(json.success, true);
  assert.ok(json.data.id);
  assert.strictEqual(json.data.title, "Cell Division & Mitosis");
});

test("Phase 7 Topics: User B cannot delete User A's custom topic", async () => {
  // Get topics for User A
  const listResA = await fetch(`${baseUrl}/api/topics`, {
    headers: { "Authorization": `Bearer ${userTokenA}` },
  });
  const listDataA = await listResA.json();
  const customTopic = listDataA.data.find((t) => t.title === "Cell Division & Mitosis");
  assert.ok(customTopic, "Custom topic should exist");

  // User B tries to delete User A's topic
  const deleteResB = await fetch(`${baseUrl}/api/topics/${customTopic.id}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${userTokenB}` },
  });

  assert.strictEqual(deleteResB.status, 404, "User B should not be able to delete User A topic");
});

test("Phase 7 Topics: User cannot delete non-existent or built-in system topics", async () => {
  // Built-in topic (e.g. topic-1) has user_id = null
  const deleteBuiltinRes = await fetch(`${baseUrl}/api/topics/topic-1`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${userTokenA}` },
  });
  assert.strictEqual(deleteBuiltinRes.status, 404, "Cannot delete built-in topic");

  const deleteNonExistent = await fetch(`${baseUrl}/api/topics/non-existent-topic-999`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${userTokenA}` },
  });
  assert.strictEqual(deleteNonExistent.status, 404);
});

test("Phase 7 Topics: User A deletes own custom topic and cascades cleanup", async () => {
  const listResA = await fetch(`${baseUrl}/api/topics`, {
    headers: { "Authorization": `Bearer ${userTokenA}` },
  });
  const listDataA = await listResA.json();
  const customTopic = listDataA.data.find((t) => t.title === "Cell Division & Mitosis");

  // Submit a recall attempt on this topic first
  await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${userTokenA}`,
    },
    body: JSON.stringify({
      topic_id: customTopic.id,
      student_answer: "Mitosis has Prophase, Metaphase, Anaphase, Telophase producing two identical diploid cells.",
    }),
  });

  // User A deletes own topic
  const deleteRes = await fetch(`${baseUrl}/api/topics/${customTopic.id}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${userTokenA}` },
  });

  assert.strictEqual(deleteRes.status, 200);
  const deleteJson = await deleteRes.json();
  assert.strictEqual(deleteJson.success, true);

  // Verify topic is gone
  const afterListRes = await fetch(`${baseUrl}/api/topics`, {
    headers: { "Authorization": `Bearer ${userTokenA}` },
  });
  const afterListData = await afterListRes.json();
  assert.ok(!afterListData.data.some((t) => t.id === customTopic.id));
});

// =========================================================
// 3. API VALIDATION & ERROR HANDLING
// =========================================================

test("Phase 7 Validation: Missing title or notes on topic creation returns 400", async () => {
  const res = await fetch(`${baseUrl}/api/topics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${userTokenA}`,
    },
    body: JSON.stringify({ subject: "Math" }),
  });

  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.strictEqual(json.success, false);
});

test("Phase 7 Validation: Missing title on task creation returns 400", async () => {
  const res = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${userTokenA}`,
    },
    body: JSON.stringify({ description: "No title here" }),
  });

  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.strictEqual(json.success, false);
});

test("Phase 7 Validation: Missing answer or topic_id on recall evaluate returns 400", async () => {
  const res = await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${userTokenA}`,
    },
    body: JSON.stringify({ topic_id: "topic-1" }), // missing student_answer
  });

  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.strictEqual(json.success, false);
});

test("Phase 7 Auth: Protected endpoints reject invalid or missing auth tokens with 401", async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { "Authorization": "Bearer invalid_token_xyz" },
  });
  assert.strictEqual(res.status, 401);

  const resRev = await fetch(`${baseUrl}/api/revisions/rev-123/complete`, {
    method: "POST",
    headers: { "Authorization": "Bearer invalid_token_xyz" },
  });
  assert.strictEqual(resRev.status, 401);
});
