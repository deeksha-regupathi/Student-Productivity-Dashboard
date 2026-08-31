# StudyPulse — Student Productivity Dashboard, AI Recall & Personalized Analytics

StudyPulse is a comprehensive student learning and productivity system combining active task management, AI-powered active recall evaluation, automated spaced repetition revision scheduling, and personalized learning analytics.

---

## 🚀 Key Features

### Phase 1 & 2: Productivity Dashboard & Task Management
- **Dashboard Overview**: Key performance indicators (Total Tasks, Completed, Pending, Focus Streak).
- **Task Management**: Create, edit, prioritize (Low, Medium, High), set due dates, mark as completed, and delete tasks.
- **Weekly Study Progress**: Visual subject-by-subject study hours tracking.
- **Upcoming Deadlines**: Real-time due date tracking (Due today, Overdue, Due tomorrow, etc.).

### Phase 3: AI-Powered Active Recall Practice & Evaluation
- **Curriculum Topics**: Built-in topics across Biology, Physics, and Computer Science + support for custom topics.
- **Active Recall Mode**: **Strictly hides study notes** while recalling from memory. Includes live elapsed timer and character/word counters.
- **Evaluation Engine**: Analyzes recalled answer against source material and key concepts.
  - **Score**: 0–100%
  - **Recall Levels**:
    - **Excellent**: 85–100%
    - **Good**: 70–84%
    - **Needs Improvement**: 50–69%
    - **Weak**: 0–49%
  - **Concept Breakdown**: Categorized into Correct, Partial, and Missed concepts.
  - **Feedback & Suggestions**: Actionable advice on what to review.

### Phase 4: Smart Revision & Spaced Repetition
- **Automatic Scheduling**: Calculates next revision date automatically upon recall submission:
  - **Score 0–49% (Weak)** → Next revision in **1 day**
  - **Score 50–69% (Needs Improvement)** → Next revision in **2 days**
  - **Score 70–84% (Good)** → Next revision in **4 days**
  - **Score 85–100% (Excellent)** → Next revision in **7 days**
- **Dashboard Revision Queue**: Filterable by **All**, **Overdue**, **Due Today**, and **Upcoming** with **Revise Now** and **Complete** actions.

### Phase 5: Personalized Learning Analytics & Progress Dashboard
- **Overall Learning Analytics**: Comprehensive metrics on topics, recall accuracy, revisions, and composite learning score.
- **Recall Performance Trend**: Chronological tracking of average, highest, and lowest recall scores over time.
- **Topic Mastery Matrix**: Topic-level mastery tracking taking both historical average and recency into account.
- **Subject-Wise Analytics**: Aggregate performance, topic count, and revision statuses by subject category.
- **Personalized Deterministic Insights**: Actionable, data-driven recommendations highlighting strengths, weak areas, revision discipline, and performance trajectories without external AI dependencies.
- **Empty-State Resiliency**: Fully responsive and graceful empty-state handling across all analytics components.

---

## 📐 Analytics Formulas & Classifications

### 1. Overall Learning Score (0–100)
$$\text{Overall Learning Score} = 0.50 \times (\text{Average Recall Score}) + 0.30 \times (\text{Average Topic Mastery}) + 0.20 \times (\text{Revision Completion Rate})$$
*If no recall attempts have been completed yet, the overall score defaults safely to `0`.*

### 2. Topic Mastery Calculation (0–100)
- **Multiple Attempts**: Weighted formula combining recency and consistency:
  $$\text{Mastery \%} = 0.60 \times (\text{Latest Score}) + 0.40 \times (\text{Average Score})$$
- **Single Attempt**: $1.00 \times (\text{Latest Score})$
- **Zero Attempts**: $0\%$

### 3. Topic & Learning Mastery Levels
| Score Range | Mastery Level |
| :--- | :--- |
| **85–100%** | **Mastered** |
| **70–84%** | **Strong** |
| **50–69%** | **Developing** |
| **0–49%** | **Needs Attention** |

### 4. Revision Completion Rate
$$\text{Revision Completion Rate} = \left( \frac{\text{Completed Revisions}}{\text{Completed Revisions} + \text{Pending Revisions}} \right) \times 100$$

---

## 📡 REST API Endpoints

### Learning Analytics (Phase 5)
- `GET /api/analytics/overview` — High-level learning analytics, overall learning score, mastery counts, and top 5 strongest/weakest topics.
- `GET /api/analytics/recall-trend` — Chronological daily recall performance (attempts, average, max, min scores).
- `GET /api/analytics/topics` — Complete topic mastery matrix with latest scores, average scores, and revision counts.
- `GET /api/analytics/subjects` — Subject-wise aggregated analytics.
- `GET /api/analytics/revisions` — Spaced repetition analytics, urgency breakdown, and daily completion history.
- `GET /api/analytics/insights` — Personalized deterministic insights derived from database metrics.

### Spaced Repetition & Revisions (Phase 4)
- `GET /api/revisions` — Get all active revision schedules (`?status=pending|completed|all`).
- `GET /api/revisions/due` — Get revisions due today or overdue.
- `POST /api/revisions/:id/complete` — Mark a revision as completed.
- `GET /api/revisions/:topicId` — Get revision history for a specific topic.

### Active Recall & Topics (Phase 1–3)
- `GET /api/topics` — List all study topics.
- `GET /api/topics/:id` — Retrieve topic details and notes.
- `POST /api/topics` — Create a new study topic.
- `POST /api/recall/evaluate` — Submit recalled answer for evaluation and automatic revision scheduling.
- `GET /api/recall/history` — Get past recall attempts history.
- `GET /api/stats` — Summary metrics for dashboard KPI compatibility.

---

## 🧪 Testing

To run the complete automated test suite (47 tests across all 5 phases):

```bash
npm test
```

All 47 tests execute in under 1 second using Node.js native test runner (`node:test`).

---

## 💻 Running the Application

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. **Open the web dashboard**:
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.
