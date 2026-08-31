# StudyPulse — Student Productivity Dashboard & Active Recall System

StudyPulse is a student productivity dashboard combining active task management, AI-powered active recall evaluation, and smart spaced repetition revision scheduling.

---

## 🚀 Key Features

### Phase 1 & 2: Productivity Dashboard & Task Management
- **Dashboard Overview**: Key performance indicators (Total Tasks, Completed, Pending, Focus Streak).
- **Task Management**: Create, edit, prioritize (Low, Medium, High), set due dates, mark as completed, and delete tasks.
- **Weekly Study Progress**: Visual subject-by-subject hours tracking.
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
- **Automatic Scheduling**: Calculates the next revision date automatically upon recall submission without requiring manual student input:
  - **Score 0–49%** → Next revision in **1 day**
  - **Score 50–69%** → Next revision in **2 days**
  - **Score 70–84%** → Next revision in **4 days**
  - **Score 85–100%** → Next revision in **7 days**
- **Dashboard Revision Queue**:
  - Filterable by **All**, **Overdue**, **Due Today**, and **Upcoming**.
  - Quick action buttons: **Revise Now** (launches directly into active recall for that topic) and **Complete** (marks revision finished).
- **Spaced Analytics**:
  - Strongest vs Weakest topics tracking.
  - Due and completed revision counters.
  - Full revision and recall attempt history.

---

## 🛠 Tech Stack & Architecture

- **Backend**: Node.js 24 + Express 5
- **Database**: SQLite with `node:sqlite` (zero external binary dependencies)
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 with responsive layouts
- **Testing**: Built-in `node:test` & `node:assert` runner

---

## 📡 REST API Endpoints

### Active Recall & Topics
- `GET /api/topics` — List all study topics.
- `GET /api/topics/:id` — Retrieve topic details and notes.
- `POST /api/topics` — Create a new study topic.
- `POST /api/recall/evaluate` — Submit recalled answer for AI/concept evaluation and automatic revision scheduling.
  - **Input**: `{ "topic_id": "topic-1", "student_answer": "..." }`
  - **Output**: `{ "score": 85, "level": "Excellent", "correct_concepts": [...], "partial_concepts": [...], "missed_concepts": [...], "feedback": "...", "suggestions": [...], "next_revision": { "revision_date": "2026-09-07", "days_until_revision": 7, "label": "7 days from now" } }`
- `GET /api/recall/history` — Get past recall attempts (optional query `?topic_id=...`).
- `GET /api/stats` — Overall study metrics, topic mastery, and revision statistics.

### Spaced Repetition & Revisions (Phase 4)
- `GET /api/revisions` — Get all active revision schedules (`?status=pending|completed|all`).
- `GET /api/revisions/due` — Get revisions that are due today or overdue.
- `POST /api/revisions/:id/complete` — Mark a revision schedule as completed.
- `GET /api/revisions/:topicId` — Get revision history for a specific topic.

---

## 🧪 Testing

To run the complete automated test suite (36 tests across integration, recall evaluation, database, and spaced repetition scheduling):

```bash
npm test
```

All 36 tests execute in under 1 second using Node's native test runner.

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

3. **Access the web app**:
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Configuration (Optional)

The application runs fully offline out-of-the-box using the built-in intelligent concept-matching fallback engine. To enable external LLM evaluation, create a `.env` file from `.env.example`:

```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
# or
OPENAI_API_KEY=your_openai_api_key_here
```
