const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

// Use dedicated test database for Phase 5
const testDbPath = path.join(__dirname, "test_analytics.db");
if (fs.existsSync(testDbPath)) {
  try { fs.unlinkSync(testDbPath); } catch (e) {}
}
process.env.DB_PATH = testDbPath;

const db = require("../src/db");
const {
  getMasteryLevel,
  calculateTopicMastery,
  calculateOverallLearningScore,
  getAnalyticsOverview,
  getSubjectAnalytics,
  getRecallTrend,
  getRevisionAnalytics,
  generateLearningInsights
} = require("../src/analytics");
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
// 1. ANALYTICS FORMULAS & UNIT TESTS
// ==========================================

test("1. Topic Mastery Level Classification", () => {
  assert.strictEqual(getMasteryLevel(100), "Mastered");
  assert.strictEqual(getMasteryLevel(85), "Mastered");
  assert.strictEqual(getMasteryLevel(84), "Strong");
  assert.strictEqual(getMasteryLevel(70), "Strong");
  assert.strictEqual(getMasteryLevel(69), "Developing");
  assert.strictEqual(getMasteryLevel(50), "Developing");
  assert.strictEqual(getMasteryLevel(49), "Needs Attention");
  assert.strictEqual(getMasteryLevel(0), "Needs Attention");
});

test("2. Topic Mastery Calculation (Weighted Recency & History)", () => {
  // 0 attempts -> 0
  assert.strictEqual(calculateTopicMastery(null, null, 0), 0);

  // Single attempt -> 100% latest score
  assert.strictEqual(calculateTopicMastery(90, 90, 1), 90);
  assert.strictEqual(calculateTopicMastery(45, 45, 1), 45);

  // Multiple attempts: 60% latest (90) + 40% avg (70) = 54 + 28 = 82
  assert.strictEqual(calculateTopicMastery(90, 70, 3), 82);

  // Multiple attempts: 60% latest (60) + 40% avg (80) = 36 + 32 = 68
  assert.strictEqual(calculateTopicMastery(60, 80, 2), 68);
});

test("3. Overall Learning Score Formula Calculation", () => {
  // 0 attempts -> 0
  assert.strictEqual(calculateOverallLearningScore({
    averageRecallScore: 0,
    averageMastery: 0,
    revisionCompletionRate: 0,
    totalAttempts: 0
  }), 0);

  // Example: Avg Recall = 80, Avg Mastery = 85, Revision Completion = 90
  // Score = 0.50 * 80 + 0.30 * 85 + 0.20 * 90 = 40 + 25.5 + 18 = 83.5 -> 84
  const score = calculateOverallLearningScore({
    averageRecallScore: 80,
    averageMastery: 85,
    revisionCompletionRate: 90,
    totalAttempts: 5
  });
  assert.strictEqual(score, 84);

  // Clamped boundaries (0 to 100)
  assert.strictEqual(calculateOverallLearningScore({
    averageRecallScore: 100,
    averageMastery: 100,
    revisionCompletionRate: 100,
    totalAttempts: 10
  }), 100);
});

// ==========================================
// 2. EMPTY STATE HANDLING
// ==========================================

test("4. Empty State: Overview and Insights before any recall attempts", () => {
  const overview = getAnalyticsOverview(db.getDatabase());
  assert.strictEqual(overview.total_recall_attempts, 0);
  assert.strictEqual(overview.average_recall_score, 0);
  assert.strictEqual(overview.overall_learning_score, 0);
  assert.strictEqual(overview.revision_completion_rate, 0);
  assert.ok(Array.isArray(overview.strongest_topics));
  assert.ok(Array.isArray(overview.weakest_topics));

  const insights = generateLearningInsights(db.getDatabase());
  assert.ok(Array.isArray(insights));
  assert.strictEqual(insights.length, 1);
  assert.strictEqual(insights[0].type, "recommendation");
});

// ==========================================
// 3. API INTEGRATION TESTS WITH DATA
// ==========================================

test("5. Setup Learning Data via Recall Sessions", async () => {
  // Perform recall on topic-1 (Biology) with high score
  await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic_id: "topic-1",
      student_answer: "Cellular respiration converts glucose and oxygen into ATP, CO2 and water. Glycolysis in cytoplasm produces pyruvate and 2 ATP. Krebs cycle in mitochondrial matrix makes NADH FADH2. ETC in inner membrane uses ATP synthase and oxygen to generate ATP via chemiosmosis."
    })
  });

  // Perform recall on topic-2 (Physics) with medium score
  await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic_id: "topic-2",
      student_answer: "Newton's First Law is inertia where objects stay at rest. Second law is F = ma."
    })
  });

  // Perform recall on topic-3 (Computer Science) with low score
  await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic_id: "topic-3",
      student_answer: "Big O measures time complexity."
    })
  });
});

test("6. API: GET /api/analytics/overview returns accurate metrics", async () => {
  const res = await fetch(`${baseUrl}/api/analytics/overview`);
  assert.strictEqual(res.status, 200);

  const json = await res.json();
  assert.strictEqual(json.success, true);
  const data = json.data;

  assert.ok(data.total_topics >= 4);
  assert.strictEqual(data.total_recall_attempts, 3);
  assert.ok(typeof data.average_recall_score === "number");
  assert.ok(data.average_recall_score > 0);
  assert.ok(typeof data.overall_learning_score === "number");
  assert.ok(data.overall_learning_score >= 0 && data.overall_learning_score <= 100);
  assert.ok(data.learning_level);
  assert.ok(Array.isArray(data.strongest_topics));
  assert.ok(Array.isArray(data.weakest_topics));
});

test("7. API: GET /api/analytics/recall-trend returns chronological performance", async () => {
  const res = await fetch(`${baseUrl}/api/analytics/recall-trend`);
  assert.strictEqual(res.status, 200);

  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.ok(Array.isArray(json.data));
  assert.ok(json.count > 0);

  const first = json.data[0];
  assert.ok(first.date);
  assert.strictEqual(typeof first.attempts_count, "number");
  assert.strictEqual(typeof first.average_score, "number");
  assert.strictEqual(typeof first.highest_score, "number");
  assert.strictEqual(typeof first.lowest_score, "number");
});

test("8. API: GET /api/analytics/topics returns mastery and revision counts", async () => {
  const res = await fetch(`${baseUrl}/api/analytics/topics`);
  assert.strictEqual(res.status, 200);

  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.ok(Array.isArray(json.data));
  assert.ok(json.count >= 4);

  const bioTopic = json.data.find(t => t.topic_id === "topic-1");
  assert.ok(bioTopic);
  assert.strictEqual(bioTopic.attempts_count, 1);
  assert.ok(bioTopic.mastery_percentage >= 85);
  assert.strictEqual(bioTopic.mastery_level, "Mastered");
  assert.strictEqual(typeof bioTopic.pending_revisions, "number");
});

test("9. API: GET /api/analytics/subjects returns subject-wise aggregation", async () => {
  const res = await fetch(`${baseUrl}/api/analytics/subjects`);
  assert.strictEqual(res.status, 200);

  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.ok(Array.isArray(json.data));
  assert.ok(json.count >= 3);

  const biology = json.data.find(s => s.subject === "Biology");
  assert.ok(biology);
  assert.ok(biology.topics_count >= 1);
  assert.ok(biology.recall_attempts_count >= 1);
  assert.ok(biology.average_recall_score >= 80);
});

test("10. API: GET /api/analytics/revisions returns spaced repetition metrics and completion rate", async () => {
  // Complete one revision to test completion rate
  const pendingRevs = db.getRevisions({ status: "pending" });
  assert.ok(pendingRevs.length > 0);
  const revToComplete = pendingRevs[0];

  await fetch(`${baseUrl}/api/revisions/${revToComplete.id}/complete`, {
    method: "POST"
  });

  const res = await fetch(`${baseUrl}/api/analytics/revisions`);
  assert.strictEqual(res.status, 200);

  const json = await res.json();
  assert.strictEqual(json.success, true);
  const data = json.data;

  assert.ok(data.total_scheduled >= 3);
  assert.ok(data.completed_count >= 1);
  assert.ok(data.completion_rate > 0);
  assert.ok(data.urgency_breakdown);
  assert.ok(Array.isArray(data.completion_history));
});

test("11. API: GET /api/analytics/insights returns deterministic recommendations", async () => {
  const res = await fetch(`${baseUrl}/api/analytics/insights`);
  assert.strictEqual(res.status, 200);

  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.ok(Array.isArray(json.data));
  assert.ok(json.count > 0);

  // Insights should contain valid types and severities
  json.data.forEach(ins => {
    assert.ok(["strength", "weakness", "revision", "trend", "recommendation"].includes(ins.type));
    assert.ok(["positive", "warning", "info"].includes(ins.severity));
    assert.ok(ins.title);
    assert.ok(ins.message);
  });
});
