/**
 * Personalized Learning Analytics Service (Phase 5)
 * Pure, deterministic data aggregation and insight generation based on recall attempts,
 * topic mastery, subject performance, and spaced repetition revisions.
 */

const { getRevisionUrgency } = require("./scheduler");

/**
 * Mastery level classification based on score/percentage:
 * - 85–100 → Mastered
 * - 70–84  → Strong
 * - 50–69  → Developing
 * - 0–49   → Needs Attention
 */
function getMasteryLevel(score) {
  const rounded = Math.round(Number(score) || 0);
  if (rounded >= 85) return "Mastered";
  if (rounded >= 70) return "Strong";
  if (rounded >= 50) return "Developing";
  return "Needs Attention";
}

/**
 * Calculate topic mastery percentage from latest score and average score.
 * Formula:
 * - If multiple attempts: 60% weight to latest recall + 40% weight to historical average
 * - If single attempt: 100% latest score
 * - If 0 attempts: 0
 */
function calculateTopicMastery(latestScore, averageScore, attemptsCount) {
  if (!attemptsCount || attemptsCount === 0 || latestScore === null || latestScore === undefined) {
    return 0;
  }
  if (attemptsCount === 1) {
    return Math.max(0, Math.min(100, Math.round(latestScore)));
  }
  const weighted = 0.6 * latestScore + 0.4 * averageScore;
  return Math.max(0, Math.min(100, Math.round(weighted)));
}

/**
 * Calculate Overall Learning Score (0–100)
 * Formula:
 * Overall Learning Score = 0.50 * (Average Recall Score)
 *                        + 0.30 * (Average Topic Mastery)
 *                        + 0.20 * (Revision Completion Rate)
 * If total attempts is 0, defaults to 0.
 */
function calculateOverallLearningScore({ averageRecallScore, averageMastery, revisionCompletionRate, totalAttempts }) {
  if (!totalAttempts || totalAttempts === 0) {
    return 0;
  }
  const score = (
    0.50 * (Number(averageRecallScore) || 0) +
    0.30 * (Number(averageMastery) || 0) +
    0.20 * (Number(revisionCompletionRate) || 0)
  );
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get formatted today's date string YYYY-MM-DD
 */
function getTodayDateStr(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Topic Analytics & Mastery List
 */
function getTopicMasteryAnalytics(db) {
  const topics = db.prepare(`SELECT * FROM topics ORDER BY title ASC`).all();
  const attempts = db.prepare(`SELECT * FROM recall_attempts ORDER BY created_at ASC`).all();
  const revisions = db.prepare(`SELECT * FROM revisions`).all();

  // Group attempts by topic
  const attemptsByTopic = {};
  for (const a of attempts) {
    if (!attemptsByTopic[a.topic_id]) {
      attemptsByTopic[a.topic_id] = [];
    }
    attemptsByTopic[a.topic_id].push(a);
  }

  // Group revisions by topic
  const revisionsByTopic = {};
  for (const r of revisions) {
    if (!revisionsByTopic[r.topic_id]) {
      revisionsByTopic[r.topic_id] = [];
    }
    revisionsByTopic[r.topic_id].push(r);
  }

  return topics.map((t) => {
    const topicAttempts = attemptsByTopic[t.id] || [];
    const count = topicAttempts.length;
    const scores = topicAttempts.map((a) => a.score);

    const latestAttempt = count > 0 ? topicAttempts[count - 1] : null;
    const latestScore = latestAttempt ? latestAttempt.score : null;
    const avgScore = count > 0 ? Math.round(scores.reduce((s, x) => s + x, 0) / count) : null;
    const masteryPct = calculateTopicMastery(latestScore, avgScore, count);
    const masteryLvl = count > 0 ? getMasteryLevel(masteryPct) : "Needs Attention";

    const topicRevisions = revisionsByTopic[t.id] || [];
    const pendingRevs = topicRevisions.filter((r) => r.status === "pending").length;
    const completedRevs = topicRevisions.filter((r) => r.status === "completed").length;

    return {
      topic_id: t.id,
      title: t.title,
      subject: t.subject || "General",
      attempts_count: count,
      latest_score: latestScore,
      average_score: avgScore,
      mastery_percentage: masteryPct,
      mastery_level: masteryLvl,
      pending_revisions: pendingRevs,
      completed_revisions: completedRevs,
      last_attempt_date: latestAttempt ? latestAttempt.created_at : null
    };
  });
}

/**
 * Subject-wise Analytics
 */
function getSubjectAnalytics(db) {
  const topicStats = getTopicMasteryAnalytics(db);
  const revisions = db.prepare(`SELECT * FROM revisions`).all();
  const todayStr = getTodayDateStr();

  // Build revision lookup
  const revLookup = {};
  for (const r of revisions) {
    if (!revLookup[r.topic_id]) revLookup[r.topic_id] = [];
    revLookup[r.topic_id].push(r);
  }

  const subjectsMap = {};

  for (const t of topicStats) {
    const subj = t.subject || "General";
    if (!subjectsMap[subj]) {
      subjectsMap[subj] = {
        subject: subj,
        topics_count: 0,
        recall_attempts_count: 0,
        scores_sum: 0,
        scores_count: 0,
        mastery_sum: 0,
        completed_revisions: 0,
        pending_revisions: 0,
        overdue_revisions: 0
      };
    }

    subjectsMap[subj].topics_count += 1;
    subjectsMap[subj].recall_attempts_count += t.attempts_count;
    subjectsMap[subj].mastery_sum += t.mastery_percentage;

    if (t.average_score !== null) {
      subjectsMap[subj].scores_sum += t.average_score * t.attempts_count;
      subjectsMap[subj].scores_count += t.attempts_count;
    }

    const topicRevs = revLookup[t.topic_id] || [];
    subjectsMap[subj].completed_revisions += topicRevs.filter((r) => r.status === "completed").length;
    subjectsMap[subj].pending_revisions += topicRevs.filter((r) => r.status === "pending").length;
    subjectsMap[subj].overdue_revisions += topicRevs.filter(
      (r) => r.status === "pending" && r.revision_date < todayStr
    ).length;
  }

  return Object.values(subjectsMap).map((s) => {
    const avgScore = s.scores_count > 0 ? Math.round(s.scores_sum / s.scores_count) : 0;
    const avgMastery = s.topics_count > 0 ? Math.round(s.mastery_sum / s.topics_count) : 0;

    return {
      subject: s.subject,
      topics_count: s.topics_count,
      recall_attempts_count: s.recall_attempts_count,
      average_recall_score: avgScore,
      mastery_percentage: avgMastery,
      mastery_level: getMasteryLevel(avgMastery),
      completed_revisions: s.completed_revisions,
      pending_revisions: s.pending_revisions,
      overdue_revisions: s.overdue_revisions
    };
  });
}

/**
 * Recall Performance Trend over Time
 */
function getRecallTrend(db) {
  const attempts = db.prepare(`
    SELECT score, created_at
    FROM recall_attempts
    ORDER BY created_at ASC
  `).all();

  const grouped = {};
  for (const a of attempts) {
    const dateStr = a.created_at ? a.created_at.slice(0, 10) : getTodayDateStr();
    if (!grouped[dateStr]) {
      grouped[dateStr] = {
        date: dateStr,
        attempts_count: 0,
        scores: []
      };
    }
    grouped[dateStr].attempts_count += 1;
    grouped[dateStr].scores.push(a.score);
  }

  return Object.values(grouped).map((g) => {
    const total = g.scores.length;
    const avg = total > 0 ? Math.round(g.scores.reduce((s, x) => s + x, 0) / total) : 0;
    const max = total > 0 ? Math.max(...g.scores) : 0;
    const min = total > 0 ? Math.min(...g.scores) : 0;

    return {
      date: g.date,
      attempts_count: g.attempts_count,
      average_score: avg,
      highest_score: max,
      lowest_score: min
    };
  });
}

/**
 * Revision Analytics
 */
function getRevisionAnalytics(db, todayStr = getTodayDateStr()) {
  const revisions = db.prepare(`
    SELECT r.*, t.title AS topic_title, t.subject AS topic_subject
    FROM revisions r
    LEFT JOIN topics t ON r.topic_id = t.id
    ORDER BY r.revision_date ASC
  `).all();

  const completed = revisions.filter((r) => r.status === "completed").length;
  const pending = revisions.filter((r) => r.status === "pending").length;
  const overdue = revisions.filter((r) => r.status === "pending" && r.revision_date < todayStr).length;
  const dueToday = revisions.filter((r) => r.status === "pending" && r.revision_date === todayStr).length;
  const upcoming = revisions.filter((r) => r.status === "pending" && r.revision_date > todayStr).length;

  const totalActive = completed + pending;
  const completionRate = totalActive > 0 ? Math.round((completed / totalActive) * 100) : 0;

  // History trend (completions by day)
  const completionsByDate = {};
  for (const r of revisions) {
    if (r.status === "completed" && r.completed_at) {
      const dateStr = r.completed_at.slice(0, 10);
      completionsByDate[dateStr] = (completionsByDate[dateStr] || 0) + 1;
    }
  }

  const completionHistory = Object.keys(completionsByDate).sort().map((date) => ({
    date,
    completed_count: completionsByDate[date]
  }));

  return {
    total_scheduled: revisions.length,
    active_schedules_count: totalActive,
    completed_count: completed,
    pending_count: pending,
    overdue_count: overdue,
    due_today_count: dueToday,
    upcoming_count: upcoming,
    completion_rate: completionRate,
    urgency_breakdown: {
      overdue,
      due_today: dueToday,
      upcoming
    },
    completion_history: completionHistory
  };
}

/**
 * Overall Learning Analytics Overview
 */
function getAnalyticsOverview(db, todayStr = getTodayDateStr()) {
  const topics = db.prepare(`SELECT COUNT(*) AS count FROM topics`).get()?.count || 0;
  const attempts = db.prepare(`SELECT score FROM recall_attempts`).all();
  const totalAttempts = attempts.length;
  const avgRecallScore = totalAttempts > 0
    ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / totalAttempts)
    : 0;

  const topicAnalytics = getTopicMasteryAnalytics(db);
  const masteredTopicsCount = topicAnalytics.filter((t) => t.mastery_level === "Mastered").length;
  const avgMastery = topicAnalytics.length > 0
    ? Math.round(topicAnalytics.reduce((s, t) => s + t.mastery_percentage, 0) / topicAnalytics.length)
    : 0;

  const revStats = getRevisionAnalytics(db, todayStr);

  const overallLearningScore = calculateOverallLearningScore({
    averageRecallScore: avgRecallScore,
    averageMastery: avgMastery,
    revisionCompletionRate: revStats.completion_rate,
    totalAttempts
  });

  // Top 5 strongest and weakest topics
  const topicsWithAttempts = topicAnalytics.filter((t) => t.attempts_count > 0);
  const strongestTopics = [...topicsWithAttempts]
    .sort((a, b) => b.mastery_percentage - a.mastery_percentage || b.attempts_count - a.attempts_count)
    .slice(0, 5);

  const weakestTopics = [...topicAnalytics]
    .sort((a, b) => a.mastery_percentage - b.mastery_percentage || a.attempts_count - b.attempts_count)
    .slice(0, 5);

  return {
    total_topics: topics,
    total_recall_attempts: totalAttempts,
    average_recall_score: avgRecallScore,
    mastered_topics_count: masteredTopicsCount,
    average_topic_mastery: avgMastery,
    total_scheduled_revisions: revStats.total_scheduled,
    completed_revisions: revStats.completed_count,
    pending_revisions: revStats.pending_count,
    overdue_revisions: revStats.overdue_count,
    due_today_revisions: revStats.due_today_count,
    revision_completion_rate: revStats.completion_rate,
    overall_learning_score: overallLearningScore,
    learning_level: getMasteryLevel(overallLearningScore),
    strongest_topics: strongestTopics,
    weakest_topics: weakestTopics,
    revisions: revStats
  };
}

/**
 * Generate Personalized, Deterministic Learning Insights
 */
function generateLearningInsights(db, todayStr = getTodayDateStr()) {
  const overview = getAnalyticsOverview(db, todayStr);
  const subjects = getSubjectAnalytics(db);
  const trend = getRecallTrend(db);
  const topicStats = getTopicMasteryAnalytics(db);

  const insights = [];

  // 1. Empty state insight
  if (overview.total_recall_attempts === 0) {
    return [
      {
        type: "recommendation",
        title: "Welcome to StudyPulse Analytics!",
        message: "Complete your first Active Recall session to generate personalized retention insights and spaced repetition schedules.",
        severity: "info"
      }
    ];
  }

  // 2. Strongest subject insight
  const activeSubjects = subjects.filter((s) => s.recall_attempts_count > 0);
  if (activeSubjects.length > 0) {
    const strongestSubject = [...activeSubjects].sort((a, b) => b.average_recall_score - a.average_recall_score)[0];
    if (strongestSubject && strongestSubject.average_recall_score >= 70) {
      insights.push({
        type: "strength",
        title: `Top Subject Mastery: ${strongestSubject.subject}`,
        message: `Your strongest subject is ${strongestSubject.subject} with an average recall score of ${strongestSubject.average_recall_score}% across ${strongestSubject.recall_attempts_count} attempt${strongestSubject.recall_attempts_count === 1 ? '' : 's'}.`,
        severity: "positive"
      });
    }

    // Weakest subject insight
    const weakestSubject = [...activeSubjects].sort((a, b) => a.average_recall_score - b.average_recall_score)[0];
    if (weakestSubject && weakestSubject.average_recall_score < 70 && weakestSubject.subject !== strongestSubject.subject) {
      insights.push({
        type: "weakness",
        title: `Focus Needed in ${weakestSubject.subject}`,
        message: `${weakestSubject.subject} is currently your lowest-scoring subject with an average of ${weakestSubject.average_recall_score}%. Dedicate more active recall sessions to this area.`,
        severity: "warning"
      });
    }
  }

  // 3. Overdue Revisions insight
  if (overview.overdue_revisions > 0) {
    insights.push({
      type: "revision",
      title: `${overview.overdue_revisions} Overdue Revision${overview.overdue_revisions === 1 ? '' : 's'} Pending`,
      message: `You have ${overview.overdue_revisions} topic${overview.overdue_revisions === 1 ? '' : 's'} past their spaced repetition date. Reviewing them today prevents forgetting curve decay.`,
      severity: "warning"
    });
  } else if (overview.completed_revisions > 0 && overview.revision_completion_rate >= 80) {
    insights.push({
      type: "revision",
      title: "Excellent Revision Discipline",
      message: `You have completed ${overview.revision_completion_rate}% of all scheduled revisions, maintaining high retention pathways.`,
      severity: "positive"
    });
  }

  // 4. Trend & Improvement insight
  if (trend.length >= 2) {
    const recentScores = trend.slice(-3).map((t) => t.average_score);
    const earlierScores = trend.slice(0, Math.max(1, trend.length - 3)).map((t) => t.average_score);

    const recentAvg = Math.round(recentScores.reduce((s, x) => s + x, 0) / recentScores.length);
    const earlierAvg = Math.round(earlierScores.reduce((s, x) => s + x, 0) / earlierScores.length);
    const diff = recentAvg - earlierAvg;

    if (diff > 5) {
      insights.push({
        type: "trend",
        title: "Upward Performance Trajectory",
        message: `Your average recall score improved by +${diff}% in recent sessions compared to earlier practice.`,
        severity: "positive"
      });
    } else if (diff < -8) {
      insights.push({
        type: "trend",
        title: "Recall Score Dip Detected",
        message: `Recent recall scores dipped by ${Math.abs(diff)}%. Consider shortening your study sessions and doing more frequent spaced reviews.`,
        severity: "warning"
      });
    } else {
      insights.push({
        type: "trend",
        title: "Consistent Recall Performance",
        message: `Your active recall performance remains steady at approximately ${recentAvg}% average accuracy.`,
        severity: "info"
      });
    }
  }

  // 5. Topic Mastery recommendation
  const topicsNeedingAttention = topicStats.filter((t) => t.mastery_level === "Needs Attention");
  if (topicsNeedingAttention.length > 0) {
    const topPick = topicsNeedingAttention[0];
    insights.push({
      type: "recommendation",
      title: `Recommended Practice: ${topPick.title}`,
      message: `Practice active recall for '${topPick.title}' (${topPick.subject}) to boost your mastery from ${topPick.mastery_percentage}%.`,
      severity: "info"
    });
  } else if (overview.mastered_topics_count === overview.total_topics && overview.total_topics > 0) {
    insights.push({
      type: "strength",
      title: "All Topics Mastered! 🌟",
      message: "You have achieved Mastered status (≥85%) across all curriculum topics. Add new subjects to expand your knowledge base.",
      severity: "positive"
    });
  }

  return insights;
}

module.exports = {
  getMasteryLevel,
  calculateTopicMastery,
  calculateOverallLearningScore,
  getTopicMasteryAnalytics,
  getSubjectAnalytics,
  getRecallTrend,
  getRevisionAnalytics,
  getAnalyticsOverview,
  generateLearningInsights
};
