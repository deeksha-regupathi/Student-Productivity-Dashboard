const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../auth");
const { evaluateRecall } = require("../evaluator");
const { 
  calculateRevisionInterval, 
  calculateRevisionDate, 
  getIntervalDescription,
  getRevisionUrgency 
} = require("../scheduler");
const analytics = require("../analytics");

// Apply authentication middleware across all API routes
// Extracts token, verifies user, and attaches req.user and req.userId
router.use(auth.authMiddleware({ strict: false }, () => db.getDatabase()));

// =========================================================
// PHASE 6: AUTHENTICATION ROUTES
// =========================================================

/**
 * POST /api/auth/register
 * Register a new user with name, email, and password.
 */
router.post("/auth/register", (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const result = auth.registerUser({ name, email, password }, db.getDatabase());

    res.status(201).json({
      success: true,
      message: "Account registered successfully.",
      user: result.user,
      token: result.token
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Registration failed." });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user with email and password.
 */
router.post("/auth/login", (req, res) => {
  try {
    const { email, password } = req.body || {};
    const result = auth.loginUser({ email, password }, db.getDatabase());

    res.json({
      success: true,
      message: "Logged in successfully.",
      user: result.user,
      token: result.token
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Authentication failed." });
  }
});

/**
 * POST /api/auth/logout
 * Destroy the current session token.
 */
router.post("/auth/logout", (req, res) => {
  try {
    if (!req.token) {
      return res.status(401).json({ error: "Authentication required to log out." });
    }
    auth.deleteSession(req.token, db.getDatabase());
    res.json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Failed to log out." });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user profile. (Strict auth required)
 */
router.get("/auth/me", (req, res) => {
  if (!req.token || !req.user || req.user.id === "demo-user-1" && !req.headers["authorization"] && !req.headers["x-auth-token"]) {
    return res.status(401).json({ error: "Authentication required. Please log in." });
  }
  res.json({
    success: true,
    user: req.user
  });
});

// =========================================================
// PHASE 6: USER TASKS APIS (USER-ISOLATED)
// =========================================================

/**
 * GET /api/tasks
 * Return tasks owned by the current user.
 */
router.get("/tasks", (req, res) => {
  try {
    const tasks = db.getUserTasks(req.userId);
    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (err) {
    console.error("Error fetching user tasks:", err);
    res.status(500).json({ error: "Failed to retrieve tasks." });
  }
});

/**
 * POST /api/tasks
 * Create a new task for the current user.
 */
router.post("/tasks", (req, res) => {
  try {
    const { title, description, priority, dueDate, due_date } = req.body || {};
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Task title is required." });
    }

    const newTask = db.createTask({
      title: title.trim(),
      description: description ? description.trim() : "",
      priority: priority || "medium",
      dueDate: dueDate || due_date || null
    }, req.userId);

    res.status(201).json({ success: true, data: newTask });
  } catch (err) {
    console.error("Error creating task:", err);
    res.status(500).json({ error: "Failed to create task." });
  }
});

/**
 * PUT /api/tasks/:id
 * Update an existing task owned by the current user.
 */
router.put("/tasks/:id", (req, res) => {
  try {
    const taskId = req.params.id;
    const updated = db.updateTask(taskId, req.body || {}, req.userId);

    if (!updated) {
      return res.status(404).json({ error: `Task not found or unauthorized.` });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Error updating task:", err);
    res.status(500).json({ error: "Failed to update task." });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task owned by the current user.
 */
router.delete("/tasks/:id", (req, res) => {
  try {
    const taskId = req.params.id;
    const deleted = db.deleteTask(taskId, req.userId);

    if (!deleted) {
      return res.status(404).json({ error: `Task not found or unauthorized.` });
    }

    res.json({ success: true, message: "Task deleted." });
  } catch (err) {
    console.error("Error deleting task:", err);
    res.status(500).json({ error: "Failed to delete task." });
  }
});

// =========================================================
// TOPICS APIS (SYSTEM + USER-ISOLATED)
// =========================================================

/**
 * GET /api/topics
 * Returns list of system topics + user-created topics.
 */
router.get("/topics", (req, res) => {
  try {
    const topics = db.getAllTopics(db.getDatabase(), req.userId);
    res.json({ success: true, count: topics.length, data: topics });
  } catch (err) {
    console.error("Error fetching topics:", err);
    res.status(500).json({ error: "Failed to retrieve study topics." });
  }
});

/**
 * GET /api/topics/:id
 * Returns details for a single topic by ID (accessible if system topic or owned by user).
 */
router.get("/topics/:id", (req, res) => {
  try {
    const topic = db.getTopicById(req.params.id, db.getDatabase(), req.userId);
    if (!topic) {
      return res.status(404).json({ error: `Topic not found with ID '${req.params.id}'` });
    }
    res.json({ success: true, data: topic });
  } catch (err) {
    console.error("Error fetching topic:", err);
    res.status(500).json({ error: "Failed to retrieve topic details." });
  }
});

/**
 * POST /api/topics
 * Create a new custom study topic owned by current user.
 */
router.post("/topics", (req, res) => {
  try {
    const { title, subject, question, notes, key_concepts } = req.body || {};

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Topic title is required." });
    }
    if (!notes || typeof notes !== "string" || !notes.trim()) {
      return res.status(400).json({ error: "Topic notes/content are required." });
    }

    const newTopic = db.createTopic({
      title: title.trim(),
      subject: (subject || "General").trim(),
      question: (question || `Explain what you remember about ${title}`).trim(),
      notes: notes.trim(),
      key_concepts: key_concepts || []
    }, db.getDatabase(), req.userId);

    res.status(201).json({ success: true, data: newTopic });
  } catch (err) {
    console.error("Error creating topic:", err);
    res.status(500).json({ error: "Failed to create study topic." });
  }
});

/**
 * POST /api/recall/evaluate
 * Main active recall evaluation endpoint.
 * Evaluates recall, saves attempt for user, and schedules user revision.
 */
router.post("/recall/evaluate", async (req, res) => {
  try {
    const { topic_id, student_answer } = req.body || {};

    // 1. Validation: topic_id
    if (!topic_id || typeof topic_id !== "string" || !topic_id.trim()) {
      return res.status(400).json({ error: "topic_id is required." });
    }

    // 2. Validation: student_answer
    if (typeof student_answer !== "string" || student_answer.trim().length === 0) {
      return res.status(400).json({ error: "Student answer cannot be empty." });
    }

    const trimmedAnswer = student_answer.trim();
    if (trimmedAnswer.length < 8) {
      return res.status(400).json({ 
        error: "Student answer is too short. Please write a complete explanation of what you recall." 
      });
    }

    // 3. Find topic in database (must be accessible to user)
    const topic = db.getTopicById(topic_id.trim(), db.getDatabase(), req.userId);
    if (!topic) {
      return res.status(404).json({ error: `Topic not found with ID '${topic_id}'.` });
    }

    // 4. Perform Recall Evaluation
    const evaluation = await evaluateRecall({
      topicNotes: topic.notes,
      topicQuestion: topic.question,
      topicTitle: topic.title,
      keyConcepts: topic.key_concepts,
      studentAnswer: trimmedAnswer
    });

    // 5. Store Recall Attempt in Database (tied to user)
    const attemptRecord = db.saveRecallAttempt({
      topic_id: topic.id,
      student_answer: trimmedAnswer,
      score: evaluation.score,
      level: evaluation.level,
      feedback: evaluation.feedback,
      correct_concepts: evaluation.correct_concepts,
      partial_concepts: evaluation.partial_concepts,
      missed_concepts: evaluation.missed_concepts,
      suggestions: evaluation.suggestions
    }, db.getDatabase(), req.userId);

    // 6. Automatically calculate and schedule next spaced revision date (tied to user)
    const intervalDays = calculateRevisionInterval(evaluation.score);
    const revisionDate = calculateRevisionDate(new Date(), intervalDays);
    const revisionRecord = db.scheduleRevision({
      topic_id: topic.id,
      recall_attempt_id: attemptRecord.id,
      score: evaluation.score,
      revision_date: revisionDate
    }, db.getDatabase(), req.userId);

    // 7. Return complete evaluation + revision schedule
    res.json({
      success: true,
      attempt_id: attemptRecord.id,
      topic_id: topic.id,
      topic_title: topic.title,
      score: evaluation.score,
      level: evaluation.level,
      correct_concepts: evaluation.correct_concepts,
      partial_concepts: evaluation.partial_concepts,
      missed_concepts: evaluation.missed_concepts,
      feedback: evaluation.feedback,
      suggestions: evaluation.suggestions,
      created_at: attemptRecord.created_at,
      next_revision: {
        id: revisionRecord ? revisionRecord.id : null,
        revision_date: revisionDate,
        days_until_revision: intervalDays,
        label: getIntervalDescription(intervalDays),
        status: "pending"
      }
    });

  } catch (err) {
    console.error("Recall evaluation error:", err);
    const status = err.statusCode || 500;
    res.status(status).json({ 
      error: err.message || "An unexpected error occurred during recall evaluation." 
    });
  }
});

/**
 * GET /api/recall/history
 * Returns past recall attempts for the current user.
 */
router.get("/recall/history", (req, res) => {
  try {
    const { topic_id } = req.query;
    let attempts;
    if (topic_id) {
      attempts = db.getRecallHistoryByTopic(topic_id, db.getDatabase(), req.userId);
    } else {
      attempts = db.getAllRecallAttempts(db.getDatabase(), req.userId);
    }
    res.json({ success: true, count: attempts.length, data: attempts });
  } catch (err) {
    console.error("Error fetching recall history:", err);
    res.status(500).json({ error: "Failed to retrieve recall history." });
  }
});

// =========================================================
// REVISION APIS (USER-ISOLATED)
// =========================================================

/**
 * GET /api/revisions/due
 * Returns topics whose revision date is today or overdue for current user.
 */
router.get("/revisions/due", (req, res) => {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    const dueRevisions = db.getDueRevisions(todayStr, db.getDatabase(), req.userId);

    const enriched = dueRevisions.map(r => ({
      ...r,
      urgency: r.revision_date < todayStr ? "overdue" : "due_today",
      is_overdue: r.revision_date < todayStr,
      is_due_today: r.revision_date === todayStr
    }));

    res.json({
      success: true,
      count: enriched.length,
      data: enriched
    });
  } catch (err) {
    console.error("Error fetching due revisions:", err);
    res.status(500).json({ error: "Failed to retrieve due revisions." });
  }
});

/**
 * GET /api/revisions
 * Returns upcoming and due revisions for current user.
 */
router.get("/revisions", (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const revisions = db.getRevisions(filter, db.getDatabase(), req.userId);

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    const enriched = revisions.map(r => ({
      ...r,
      urgency: getRevisionUrgency(r.revision_date, todayStr),
      is_overdue: r.status === "pending" && r.revision_date < todayStr,
      is_due_today: r.status === "pending" && r.revision_date === todayStr,
      is_upcoming: r.status === "pending" && r.revision_date > todayStr
    }));

    res.json({
      success: true,
      count: enriched.length,
      data: enriched
    });
  } catch (err) {
    console.error("Error fetching revisions:", err);
    res.status(500).json({ error: "Failed to retrieve revisions." });
  }
});

/**
 * POST /api/revisions/:id/complete
 * Mark a revision as completed (must belong to current user).
 */
router.post("/revisions/:id/complete", (req, res) => {
  try {
    const revisionId = req.params.id;
    if (!revisionId) {
      return res.status(400).json({ error: "Revision ID is required." });
    }

    const updated = db.completeRevision(revisionId, db.getDatabase(), req.userId);
    if (!updated) {
      return res.status(404).json({ error: `Revision not found with ID '${revisionId}'.` });
    }

    res.json({
      success: true,
      message: "Revision marked as completed.",
      data: updated
    });
  } catch (err) {
    console.error("Error completing revision:", err);
    res.status(500).json({ error: "Failed to complete revision." });
  }
});

/**
 * GET /api/revisions/:topicId
 * Return revision history for a specific topic (user-isolated).
 */
router.get("/revisions/:topicId", (req, res) => {
  try {
    const topicId = req.params.topicId;
    const topic = db.getTopicById(topicId, db.getDatabase(), req.userId);
    if (!topic) {
      return res.status(404).json({ error: `Topic not found with ID '${topicId}'.` });
    }

    const topicRevisions = db.getRevisionsByTopic(topicId, db.getDatabase(), req.userId);
    res.json({
      success: true,
      topic_id: topic.id,
      topic_title: topic.title,
      count: topicRevisions.length,
      data: topicRevisions
    });
  } catch (err) {
    console.error("Error fetching topic revisions:", err);
    res.status(500).json({ error: "Failed to retrieve topic revisions." });
  }
});

// =========================================================
// PHASE 5: PERSONALIZED LEARNING ANALYTICS APIS (USER-ISOLATED)
// =========================================================

/**
 * GET /api/analytics/overview
 */
router.get("/analytics/overview", (req, res) => {
  try {
    const overview = analytics.getAnalyticsOverview(db.getDatabase(), req.userId);
    res.json({ success: true, data: overview });
  } catch (err) {
    console.error("Error computing analytics overview:", err);
    res.status(500).json({ error: "Failed to retrieve learning analytics overview." });
  }
});

/**
 * GET /api/analytics/recall-trend
 */
router.get("/analytics/recall-trend", (req, res) => {
  try {
    const trend = analytics.getRecallTrend(db.getDatabase(), req.userId);
    res.json({ success: true, count: trend.length, data: trend });
  } catch (err) {
    console.error("Error computing recall trend:", err);
    res.status(500).json({ error: "Failed to retrieve recall trend." });
  }
});

/**
 * GET /api/analytics/topics
 */
router.get("/analytics/topics", (req, res) => {
  try {
    const topics = analytics.getTopicMasteryAnalytics(db.getDatabase(), req.userId);
    res.json({ success: true, count: topics.length, data: topics });
  } catch (err) {
    console.error("Error computing topic analytics:", err);
    res.status(500).json({ error: "Failed to retrieve topic analytics." });
  }
});

/**
 * GET /api/analytics/subjects
 */
router.get("/analytics/subjects", (req, res) => {
  try {
    const subjects = analytics.getSubjectAnalytics(db.getDatabase(), req.userId);
    res.json({ success: true, count: subjects.length, data: subjects });
  } catch (err) {
    console.error("Error computing subject analytics:", err);
    res.status(500).json({ error: "Failed to retrieve subject analytics." });
  }
});

/**
 * GET /api/analytics/revisions
 */
router.get("/analytics/revisions", (req, res) => {
  try {
    const revAnalytics = analytics.getRevisionAnalytics(db.getDatabase(), req.userId);
    res.json({ success: true, data: revAnalytics });
  } catch (err) {
    console.error("Error computing revision analytics:", err);
    res.status(500).json({ error: "Failed to retrieve revision analytics." });
  }
});

/**
 * GET /api/analytics/insights
 */
router.get("/analytics/insights", (req, res) => {
  try {
    const insights = analytics.generateLearningInsights(db.getDatabase(), req.userId);
    res.json({ success: true, count: insights.length, data: insights });
  } catch (err) {
    console.error("Error generating learning insights:", err);
    res.status(500).json({ error: "Failed to generate learning insights." });
  }
});

/**
 * GET /api/stats
 * Overview metrics for dashboard & progress tabs (user-isolated).
 */
router.get("/stats", (req, res) => {
  try {
    const attempts = db.getAllRecallAttempts(db.getDatabase(), req.userId);
    const total = attempts.length;
    const avgScore = total > 0 ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / total) : 0;
    
    const levels = {
      Excellent: attempts.filter(a => a.level === "Excellent").length,
      Good: attempts.filter(a => a.level === "Good").length,
      "Needs Improvement": attempts.filter(a => a.level === "Needs Improvement").length,
      Weak: attempts.filter(a => a.level === "Weak").length
    };

    const topicScores = {};
    for (const a of attempts) {
      if (!topicScores[a.topic_id]) {
        topicScores[a.topic_id] = {
          topic_id: a.topic_id,
          title: a.topic_title || a.topic_id,
          subject: a.topic_subject || "General",
          scores: []
        };
      }
      topicScores[a.topic_id].scores.push(a.score);
    }

    const topicStats = Object.values(topicScores).map(t => {
      const avg = Math.round(t.scores.reduce((s, x) => s + x, 0) / t.scores.length);
      return {
        topic_id: t.topic_id,
        title: t.title,
        subject: t.subject,
        average_score: avg,
        attempts_count: t.scores.length
      };
    });

    const strongestTopics = [...topicStats].sort((a, b) => b.average_score - a.average_score).slice(0, 3);
    const weakestTopics = [...topicStats].sort((a, b) => a.average_score - b.average_score).slice(0, 3);

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    const allRevisions = db.getRevisions({ status: "pending" }, db.getDatabase(), req.userId);
    const dueRevisions = db.getDueRevisions(todayStr, db.getDatabase(), req.userId);
    const completedRevisions = db.getRevisions({ status: "completed" }, db.getDatabase(), req.userId);
    const overdueCount = dueRevisions.filter(r => r.revision_date < todayStr).length;
    const dueTodayCount = dueRevisions.filter(r => r.revision_date === todayStr).length;

    res.json({
      success: true,
      data: {
        total_attempts: total,
        average_score: avgScore,
        level_distribution: levels,
        recent_attempts: attempts.slice(0, 5),
        revisions: {
          pending_count: allRevisions.length,
          due_count: dueRevisions.length,
          overdue_count: overdueCount,
          due_today_count: dueTodayCount,
          completed_count: completedRevisions.length
        },
        strongest_topics: strongestTopics,
        weakest_topics: weakestTopics
      }
    });
  } catch (err) {
    console.error("Error computing stats:", err);
    res.status(500).json({ error: "Failed to compute stats." });
  }
});

module.exports = router;
