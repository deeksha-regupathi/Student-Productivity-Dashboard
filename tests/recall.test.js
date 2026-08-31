const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

// Use an in-memory or dedicated test database for testing
const testDbPath = path.join(__dirname, "test_recall.db");
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}
process.env.DB_PATH = testDbPath;

const db = require("../src/db");
const { evaluateRecall, getRecallLevel, clampScore, evaluateWithFallbackEngine } = require("../src/evaluator");
const app = require("../server");

let server;
let baseUrl;

test.before((t, done) => {
  // Start server on random available port
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
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {
        // ignore cleanup error on Windows file lock
      }
    }
    done();
  });
});

// ==========================================
// 1. EVALUATOR UNIT TESTS
// ==========================================

test("1. Score Level Classification Boundaries", () => {
  assert.strictEqual(getRecallLevel(100), "Excellent");
  assert.strictEqual(getRecallLevel(85), "Excellent");
  assert.strictEqual(getRecallLevel(84), "Good");
  assert.strictEqual(getRecallLevel(70), "Good");
  assert.strictEqual(getRecallLevel(69), "Needs Improvement");
  assert.strictEqual(getRecallLevel(50), "Needs Improvement");
  assert.strictEqual(getRecallLevel(49), "Weak");
  assert.strictEqual(getRecallLevel(0), "Weak");
});

test("2. Score Clamping (0 to 100)", () => {
  assert.strictEqual(clampScore(120), 100);
  assert.strictEqual(clampScore(-10), 0);
  assert.strictEqual(clampScore(75.6), 76);
  assert.strictEqual(clampScore("invalid"), 0);
});

test("3. Successful Recall Evaluation - High Score (Excellent)", async () => {
  const topic = db.getTopicById("topic-1");
  assert.ok(topic, "Topic 1 should exist");

  const studentAnswer = `
    Cellular respiration converts glucose and oxygen into ATP energy, releasing carbon dioxide and water.
    Stage 1 is Glycolysis in the cytoplasm, breaking glucose into pyruvate with 2 ATP.
    Stage 2 is the Krebs Cycle in the mitochondrial matrix producing NADH, FADH2, and CO2.
    Stage 3 is the Electron Transport Chain across the inner mitochondrial membrane, using ATP synthase and oxygen as the final electron acceptor to generate 28-32 ATP through chemiosmosis.
    Mitochondria are the powerhouse where this takes place.
  `;

  const result = await evaluateRecall({
    topicNotes: topic.notes,
    topicQuestion: topic.question,
    topicTitle: topic.title,
    keyConcepts: topic.key_concepts,
    studentAnswer
  });

  assert.ok(result.score >= 85, `Expected score >= 85, got ${result.score}`);
  assert.strictEqual(result.level, "Excellent");
  assert.ok(Array.isArray(result.correct_concepts));
  assert.ok(result.correct_concepts.length >= 3);
  assert.ok(result.feedback.length > 0);
  assert.ok(Array.isArray(result.suggestions));
});

test("4. Successful Recall Evaluation - Moderate/Partial Score (Good or Needs Improvement)", async () => {
  const topic = db.getTopicById("topic-2");
  assert.ok(topic, "Topic 2 should exist");

  const studentAnswer = `
    Newton's first law says objects at rest stay at rest due to inertia.
    The second law is F = ma where force equals mass times acceleration.
  `;

  const result = await evaluateRecall({
    topicNotes: topic.notes,
    topicQuestion: topic.question,
    topicTitle: topic.title,
    keyConcepts: topic.key_concepts,
    studentAnswer
  });

  assert.ok(result.score >= 40 && result.score <= 84, `Expected score between 40 and 84, got ${result.score}`);
  assert.ok(result.level === "Good" || result.level === "Needs Improvement");
  assert.ok(result.missed_concepts.length > 0 || result.partial_concepts.length > 0);
});

test("5. Successful Recall Evaluation - Low Score (Weak)", async () => {
  const topic = db.getTopicById("topic-3");
  assert.ok(topic, "Topic 3 should exist");

  const studentAnswer = "Big O notation is something in computer science about code performance.";

  const result = await evaluateRecall({
    topicNotes: topic.notes,
    topicQuestion: topic.question,
    topicTitle: topic.title,
    keyConcepts: topic.key_concepts,
    studentAnswer
  });

  assert.ok(result.score < 50, `Expected score < 50 for weak answer, got ${result.score}`);
  assert.strictEqual(result.level, "Weak");
  assert.ok(result.missed_concepts.length >= 2);
});

test("6. Error Handling: Empty Answer Rejection in Evaluator", async () => {
  const topic = db.getTopicById("topic-1");
  await assert.rejects(
    async () => {
      await evaluateRecall({
        topicNotes: topic.notes,
        topicQuestion: topic.question,
        topicTitle: topic.title,
        keyConcepts: topic.key_concepts,
        studentAnswer: "   "
      });
    },
    {
      statusCode: 400,
      message: /cannot be empty/i
    }
  );
});

test("7. Error Handling: Very Short Answer Rejection in Evaluator", async () => {
  const topic = db.getTopicById("topic-1");
  await assert.rejects(
    async () => {
      await evaluateRecall({
        topicNotes: topic.notes,
        topicQuestion: topic.question,
        topicTitle: topic.title,
        keyConcepts: topic.key_concepts,
        studentAnswer: "ATP"
      });
    },
    {
      statusCode: 400,
      message: /too short/i
    }
  );
});

// ==========================================
// 2. DATABASE TESTS
// ==========================================

test("8. Database Storage: Save and Retrieve Recall Attempt", () => {
  const attempt = {
    topic_id: "topic-1",
    student_answer: "Test recall answer about cellular respiration.",
    score: 88,
    level: "Excellent",
    feedback: "Great job recalling the concepts.",
    correct_concepts: ["Glycolysis", "Krebs Cycle"],
    partial_concepts: ["ETC"],
    missed_concepts: [],
    suggestions: ["Review ATP synthase details."]
  };

  const saved = db.saveRecallAttempt(attempt);
  assert.ok(saved.id, "Saved record should have an ID");
  assert.strictEqual(saved.topic_id, "topic-1");
  assert.strictEqual(saved.score, 88);
  assert.strictEqual(saved.level, "Excellent");
  assert.strictEqual(saved.feedback, attempt.feedback);
  assert.deepStrictEqual(saved.correct_concepts, attempt.correct_concepts);
  assert.ok(saved.created_at, "Should have created_at timestamp");

  // Retrieve by ID
  const retrieved = db.getRecallAttemptById(saved.id);
  assert.ok(retrieved);
  assert.strictEqual(retrieved.id, saved.id);
  assert.strictEqual(retrieved.score, 88);

  // Retrieve history by topic
  const history = db.getRecallHistoryByTopic("topic-1");
  assert.ok(history.length > 0);
  assert.ok(history.some(h => h.id === saved.id));
});

test("9. Database: Custom Topic Creation and Retrieval", () => {
  const newTopic = db.createTopic({
    title: "Quantum Mechanics Basics",
    subject: "Physics",
    question: "Explain wave-particle duality and the Heisenberg uncertainty principle.",
    notes: "Quantum mechanics explains the behavior of subatomic particles...",
    key_concepts: [
      { name: "Wave-Particle Duality", keywords: ["wave", "particle", "photon"] },
      { name: "Uncertainty Principle", keywords: ["heisenberg", "uncertainty", "momentum", "position"] }
    ]
  });

  assert.ok(newTopic.id);
  assert.strictEqual(newTopic.title, "Quantum Mechanics Basics");

  const fetched = db.getTopicById(newTopic.id);
  assert.ok(fetched);
  assert.strictEqual(fetched.title, "Quantum Mechanics Basics");
  assert.strictEqual(fetched.key_concepts.length, 2);
});

// ==========================================
// 3. BACKEND API ENDPOINT TESTS
// ==========================================

test("10. API: GET /api/topics returns seeded topics", async () => {
  const res = await fetch(`${baseUrl}/api/topics`);
  assert.strictEqual(res.status, 200);

  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(body.count >= 4);
  assert.ok(Array.isArray(body.data));
});

test("11. API: GET /api/topics/:id returns valid topic", async () => {
  const res = await fetch(`${baseUrl}/api/topics/topic-1`);
  assert.strictEqual(res.status, 200);

  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.id, "topic-1");
  assert.strictEqual(body.data.title, "Cellular Respiration & Mitochondria");
});

test("12. API: GET /api/topics/:id returns 404 for invalid topic ID", async () => {
  const res = await fetch(`${baseUrl}/api/topics/non-existent-topic-id`);
  assert.strictEqual(res.status, 404);

  const body = await res.json();
  assert.ok(body.error);
});

test("13. API: POST /api/recall/evaluate - Successful Evaluation & Storage", async () => {
  const payload = {
    topic_id: "topic-1",
    student_answer: "Cellular respiration converts glucose into ATP in mitochondria through glycolysis, Krebs cycle, and electron transport chain with ATP synthase."
  };

  const res = await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();

  assert.strictEqual(body.success, true);
  assert.ok(body.attempt_id, "Should return generated attempt_id");
  assert.strictEqual(body.topic_id, "topic-1");
  assert.ok(typeof body.score === "number" && body.score >= 0 && body.score <= 100);
  assert.ok(["Excellent", "Good", "Needs Improvement", "Weak"].includes(body.level));
  assert.ok(Array.isArray(body.correct_concepts));
  assert.ok(Array.isArray(body.partial_concepts));
  assert.ok(Array.isArray(body.missed_concepts));
  assert.ok(typeof body.feedback === "string" && body.feedback.length > 0);
  assert.ok(Array.isArray(body.suggestions));
  assert.ok(body.created_at);

  // Verify attempt is in DB
  const stored = db.getRecallAttemptById(body.attempt_id);
  assert.ok(stored, "Attempt must be stored in database");
  assert.strictEqual(stored.score, body.score);
  assert.strictEqual(stored.level, body.level);
});

test("14. API: POST /api/recall/evaluate - Empty Answer Validation (400)", async () => {
  const payload = {
    topic_id: "topic-1",
    student_answer: "   "
  };

  const res = await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.ok(body.error);
  assert.match(body.error, /cannot be empty/i);
});

test("15. API: POST /api/recall/evaluate - Very Short Answer Validation (400)", async () => {
  const payload = {
    topic_id: "topic-1",
    student_answer: "short"
  };

  const res = await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.ok(body.error);
  assert.match(body.error, /too short/i);
});

test("16. API: POST /api/recall/evaluate - Invalid Topic ID (404)", async () => {
  const payload = {
    topic_id: "invalid-unknown-topic-9999",
    student_answer: "This is a detailed response explaining the concepts."
  };

  const res = await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assert.strictEqual(res.status, 404);
  const body = await res.json();
  assert.ok(body.error);
  assert.match(body.error, /not found/i);
});

test("17. API: POST /api/recall/evaluate - Missing topic_id (400)", async () => {
  const payload = {
    student_answer: "This is an answer without a topic ID."
  };

  const res = await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.ok(body.error);
});

test("18. API: GET /api/recall/history returns saved attempts", async () => {
  const res = await fetch(`${baseUrl}/api/recall/history?topic_id=topic-1`);
  assert.strictEqual(res.status, 200);

  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.count > 0);
});

test("19. API: GET /api/stats returns metrics", async () => {
  const res = await fetch(`${baseUrl}/api/stats`);
  assert.strictEqual(res.status, 200);

  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(typeof body.data.total_attempts === "number");
  assert.ok(typeof body.data.average_score === "number");
  assert.ok(body.data.level_distribution);
});
