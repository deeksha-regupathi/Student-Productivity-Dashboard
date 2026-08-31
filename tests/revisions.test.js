const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

// Use dedicated test database for Phase 4
const testDbPath = path.join(__dirname, "test_revisions.db");
if (fs.existsSync(testDbPath)) {
  try { fs.unlinkSync(testDbPath); } catch (e) {}
}
process.env.DB_PATH = testDbPath;

const db = require("../src/db");
const { 
  calculateRevisionInterval, 
  calculateRevisionDate, 
  getRevisionUrgency,
  getIntervalDescription 
} = require("../src/scheduler");
const app = require("../server");

let server;
let baseUrl;

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
// 1. SCHEDULER UNIT TESTS
// ==========================================

test("1. Revision Interval Calculation by Score Rules", () => {
  // 0–49 → 1 day
  assert.strictEqual(calculateRevisionInterval(0), 1);
  assert.strictEqual(calculateRevisionInterval(25), 1);
  assert.strictEqual(calculateRevisionInterval(49), 1);

  // 50–69 → 2 days
  assert.strictEqual(calculateRevisionInterval(50), 2);
  assert.strictEqual(calculateRevisionInterval(60), 2);
  assert.strictEqual(calculateRevisionInterval(69), 2);

  // 70–84 → 4 days
  assert.strictEqual(calculateRevisionInterval(70), 4);
  assert.strictEqual(calculateRevisionInterval(78), 4);
  assert.strictEqual(calculateRevisionInterval(84), 4);

  // 85–100 → 7 days
  assert.strictEqual(calculateRevisionInterval(85), 7);
  assert.strictEqual(calculateRevisionInterval(95), 7);
  assert.strictEqual(calculateRevisionInterval(100), 7);
});

test("2. Date Calculation with Month and Year Boundaries", () => {
  // Normal addition
  assert.strictEqual(calculateRevisionDate("2026-05-10", 2), "2026-05-12");

  // Month transition
  assert.strictEqual(calculateRevisionDate("2026-01-30", 2), "2026-02-01");
  assert.strictEqual(calculateRevisionDate("2026-02-28", 4), "2026-03-04");

  // Year transition
  assert.strictEqual(calculateRevisionDate("2026-12-30", 4), "2027-01-03");
  assert.strictEqual(calculateRevisionDate("2026-12-31", 7), "2027-01-07");
});

test("3. Revision Urgency Classification", () => {
  const today = "2026-08-31";
  assert.strictEqual(getRevisionUrgency("2026-08-25", today), "overdue");
  assert.strictEqual(getRevisionUrgency("2026-08-30", today), "overdue");
  assert.strictEqual(getRevisionUrgency("2026-08-31", today), "due_today");
  assert.strictEqual(getRevisionUrgency("2026-09-01", today), "upcoming");
  assert.strictEqual(getRevisionUrgency("2026-09-07", today), "upcoming");
});

// ==========================================
// 2. AUTOMATIC SCHEDULING INTEGRATION TESTS
// ==========================================

test("4. POST /api/recall/evaluate automatically schedules revision for high score (85-100 -> 7 days)", async () => {
  const payload = {
    topic_id: "topic-1",
    student_answer: "Cellular respiration converts glucose and oxygen into ATP energy releasing CO2 and water. Glycolysis in cytoplasm produces 2 ATP and pyruvate. Krebs cycle in mitochondrial matrix makes NADH FADH2. ETC in inner membrane uses ATP synthase and oxygen to make ATP via chemiosmosis."
  };

  const res = await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(body.score >= 85);
  assert.ok(body.next_revision, "Must return next_revision");
  assert.strictEqual(body.next_revision.days_until_revision, 7);
  assert.strictEqual(body.next_revision.status, "pending");

  // Verify stored in revisions table
  const revision = db.getRevisionById(body.next_revision.id);
  assert.ok(revision);
  assert.strictEqual(revision.topic_id, "topic-1");
  assert.strictEqual(revision.score, body.score);
  assert.strictEqual(revision.status, "pending");
});

test("5. POST /api/recall/evaluate automatically schedules revision for weak score (0-49 -> 1 day)", async () => {
  const payload = {
    topic_id: "topic-3",
    student_answer: "Big O is something about performance of functions."
  };

  const res = await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(body.score < 50);
  assert.ok(body.next_revision);
  assert.strictEqual(body.next_revision.days_until_revision, 1);
  assert.strictEqual(body.next_revision.status, "pending");
});

test("6. Multiple recall attempts for same topic updates active pending schedule", async () => {
  // Submit first attempt on topic-2 with moderate score
  const res1 = await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic_id: "topic-2",
      student_answer: "Newton's first law is inertia where objects stay at rest."
    })
  });
  const body1 = await res1.json();
  const revId1 = body1.next_revision.id;

  // Submit second attempt on topic-2 with complete answer
  const res2 = await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic_id: "topic-2",
      student_answer: "Newton's First Law is inertia: objects stay at rest or constant velocity unless an external force acts. Second Law is F = ma where force is mass times acceleration in Newtons. Third Law states action and reaction forces are equal and opposite, like a rocket thrust."
    })
  });
  const body2 = await res2.json();
  const revId2 = body2.next_revision.id;

  assert.notStrictEqual(revId1, revId2);

  // Check previous revision is marked superseded
  const oldRev = db.getRevisionById(revId1);
  assert.strictEqual(oldRev.status, "superseded");

  // New revision is pending
  const newRev = db.getRevisionById(revId2);
  assert.strictEqual(newRev.status, "pending");
  assert.strictEqual(newRev.days_until_revision || calculateRevisionInterval(body2.score), 7);
});

// ==========================================
// 3. REVISION API ENDPOINTS
// ==========================================

test("7. API: GET /api/revisions returns upcoming and due revisions", async () => {
  const res = await fetch(`${baseUrl}/api/revisions`);
  assert.strictEqual(res.status, 200);

  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.count > 0);
  assert.ok(body.data[0].topic_title);
});

test("8. API: GET /api/revisions/due returns due & overdue revisions", async () => {
  // First insert a valid recall attempt for topic-4 to satisfy foreign key constraints
  const attempt = db.saveRecallAttempt({
    id: "attempt-overdue-test",
    topic_id: "topic-4",
    student_answer: "Sample recall answer for overdue test",
    score: 40,
    level: "Weak",
    feedback: "Needs review.",
    created_at: "2026-08-01T10:00:00Z"
  });

  // Insert a test overdue revision directly into DB referencing the valid attempt
  db.getDatabase().prepare(`
    INSERT INTO revisions (id, topic_id, recall_attempt_id, score, revision_date, status, created_at)
    VALUES ('rev-overdue-test', 'topic-4', ?, 40, '2026-08-01', 'pending', '2026-08-01T10:00:00Z')
  `).run(attempt.id);

  const res = await fetch(`${baseUrl}/api/revisions/due`);
  assert.strictEqual(res.status, 200);

  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.some(r => r.id === "rev-overdue-test"));

  const overdueItem = body.data.find(r => r.id === "rev-overdue-test");
  assert.strictEqual(overdueItem.urgency, "overdue");
  assert.strictEqual(overdueItem.is_overdue, true);
});

test("9. API: POST /api/revisions/:id/complete marks revision completed", async () => {
  // First insert a valid recall attempt for topic-1 to satisfy foreign key constraints
  const attempt = db.saveRecallAttempt({
    topic_id: "topic-1",
    student_answer: "Sample recall answer for completion test",
    score: 80,
    level: "Good",
    feedback: "Solid recall.",
    created_at: new Date().toISOString()
  });

  // Schedule a revision referencing the valid attempt
  const rev = db.scheduleRevision({
    topic_id: "topic-1",
    recall_attempt_id: attempt.id,
    score: 80,
    revision_date: "2026-09-05"
  });

  const res = await fetch(`${baseUrl}/api/revisions/${rev.id}/complete`, {
    method: "POST"
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.status, "completed");
  assert.ok(body.data.completed_at);

  // Check DB state
  const stored = db.getRevisionById(rev.id);
  assert.strictEqual(stored.status, "completed");
});

test("10. API: POST /api/revisions/:id/complete returns 404 for invalid ID", async () => {
  const res = await fetch(`${baseUrl}/api/revisions/non-existent-revision-id/complete`, {
    method: "POST"
  });

  assert.strictEqual(res.status, 404);
  const body = await res.json();
  assert.ok(body.error);
});

test("11. API: GET /api/revisions/:topicId returns topic revision history", async () => {
  const res = await fetch(`${baseUrl}/api/revisions/topic-1`);
  assert.strictEqual(res.status, 200);

  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.topic_id, "topic-1");
  assert.ok(Array.isArray(body.data));
  assert.ok(body.count > 0);
});

test("12. API: GET /api/revisions/:topicId returns 404 for non-existent topic", async () => {
  const res = await fetch(`${baseUrl}/api/revisions/unknown-topic-999`);
  assert.strictEqual(res.status, 404);

  const body = await res.json();
  assert.ok(body.error);
});

test("13. API: GET /api/stats includes revision and topic analytics", async () => {
  const res = await fetch(`${baseUrl}/api/stats`);
  assert.strictEqual(res.status, 200);

  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(body.data.revisions);
  assert.ok(typeof body.data.revisions.pending_count === "number");
  assert.ok(typeof body.data.revisions.due_count === "number");
  assert.ok(Array.isArray(body.data.strongest_topics));
  assert.ok(Array.isArray(body.data.weakest_topics));
});
