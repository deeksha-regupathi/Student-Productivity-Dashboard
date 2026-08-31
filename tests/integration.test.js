const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const app = require("../server");
const db = require("../src/db");

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
  server.close(done);
});

test("Integration: GET / serves index.html", async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.strictEqual(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes("StudyPulse"));
  assert.ok(text.includes("Active Recall"));
  assert.ok(text.includes("studentAnswerInput"));
});

test("Integration: GET /style.css and /script.js serve static assets", async () => {
  const cssRes = await fetch(`${baseUrl}/style.css`);
  assert.strictEqual(cssRes.status, 200);
  assert.match(cssRes.headers.get("content-type"), /text\/css/i);

  const jsRes = await fetch(`${baseUrl}/script.js`);
  assert.strictEqual(jsRes.status, 200);
  const jsText = await jsRes.text();
  assert.ok(jsText.includes("startRecallSession"));
});

test("Integration: Full Recall Workflow with Custom Topic Creation", async () => {
  // 1. Create a custom topic
  const createTopicRes = await fetch(`${baseUrl}/api/topics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Photosynthesis In Depth",
      subject: "Biology",
      question: "Explain the light-dependent reactions and Calvin cycle.",
      notes: "Light reactions occur in thylakoids using chlorophyll to split water and produce ATP and NADPH. Calvin cycle occurs in stroma to fix CO2 into glucose using RuBisCO.",
      key_concepts: [
        { name: "Light Reactions & Thylakoids", keywords: ["thylakoid", "light", "chlorophyll", "water", "atp", "nadph"] },
        { name: "Calvin Cycle & Stroma", keywords: ["calvin", "stroma", "co2", "glucose", "rubisco"] }
      ]
    })
  });

  assert.strictEqual(createTopicRes.status, 201);
  const topicData = await createTopicRes.json();
  assert.ok(topicData.data.id);
  const topicId = topicData.data.id;

  // 2. Submit student recall
  const evalRes = await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic_id: topicId,
      student_answer: "Light-dependent reactions take place inside the thylakoid membranes where chlorophyll absorbs light, photolysis splits water into oxygen, and ATP and NADPH are made. Then in the stroma, the Calvin cycle fixes carbon dioxide into glucose with RuBisCO."
    })
  });

  assert.strictEqual(evalRes.status, 200);
  const evalData = await evalRes.json();
  assert.strictEqual(evalData.success, true);
  assert.strictEqual(evalData.level, "Excellent");
  assert.ok(evalData.score >= 85);
  assert.strictEqual(evalData.correct_concepts.length, 2);
  assert.strictEqual(evalData.missed_concepts.length, 0);

  // 3. Verify history updated
  const historyRes = await fetch(`${baseUrl}/api/recall/history?topic_id=${topicId}`);
  assert.strictEqual(historyRes.status, 200);
  const historyData = await historyRes.json();
  assert.strictEqual(historyData.count, 1);
  assert.strictEqual(historyData.data[0].score, evalData.score);
});

test("Integration: Edge Case - Unicode and Special Characters in Recall Answer", async () => {
  const evalRes = await fetch(`${baseUrl}/api/recall/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic_id: "topic-2",
      student_answer: "Newton's 1st Law: Inertia (v = const). 2nd Law: F = m × a (Force = mass × acceleration). 3rd Law: Action = -Reaction! 🚀"
    })
  });

  assert.strictEqual(evalRes.status, 200);
  const evalData = await evalRes.json();
  assert.strictEqual(evalData.success, true);
  assert.ok(evalData.score >= 70);
  assert.ok(["Good", "Excellent"].includes(evalData.level));
});
