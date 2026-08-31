/**
 * Spaced Repetition Scheduling Engine (Phase 4)
 * Calculates next revision dates and intervals based on active recall evaluation scores.
 */

/**
 * Calculate revision interval in days based on recall score
 * - 0–49   → revise after 1 day
 * - 50–69  → revise after 2 days
 * - 70–84  → revise after 4 days
 * - 85–100 → revise after 7 days
 */
function calculateRevisionInterval(score) {
  const rounded = Math.round(Number(score) || 0);
  if (rounded >= 85) return 7;
  if (rounded >= 70) return 4;
  if (rounded >= 50) return 2;
  return 1;
}

/**
 * Calculate formatted YYYY-MM-DD revision date from a base date and offset days.
 * Correctly accounts for month/year transitions and leap years.
 */
function calculateRevisionDate(baseDate = new Date(), days = 1) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Get human-readable description of interval
 */
function getIntervalDescription(days) {
  if (days === 1) return "1 day from now";
  return `${days} days from now`;
}

/**
 * Get status relative to today: 'overdue' | 'due_today' | 'upcoming'
 */
function getRevisionUrgency(revisionDateStr, todayStr = null) {
  if (!todayStr) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    todayStr = `${year}-${month}-${day}`;
  }

  if (revisionDateStr < todayStr) return "overdue";
  if (revisionDateStr === todayStr) return "due_today";
  return "upcoming";
}

module.exports = {
  calculateRevisionInterval,
  calculateRevisionDate,
  getIntervalDescription,
  getRevisionUrgency
};
