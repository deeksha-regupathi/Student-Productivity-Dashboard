# StudyPulse — Multi-User Student Productivity, AI Active Recall & Personalized Analytics

StudyPulse is a comprehensive, production-ready multi-user student learning and productivity system combining active task management, AI-powered active recall evaluation, automated spaced repetition revision scheduling, personalized learning analytics, secure multi-user data isolation, and responsive UX across desktop, tablet, and mobile.

---

## 🚀 Key Features

### Phase 1 & 2: Productivity Dashboard & Task Management
- **Dashboard Overview**: Key performance indicators (Total Tasks, Completed, Pending, Focus Streak).
- **Task Management**: Create, edit, prioritize (Low, Medium, High), set due dates, mark as completed, and delete tasks with confirmation dialogs.
- **Weekly Study Progress**: Visual subject-by-subject study hours tracking.
- **Upcoming Deadlines**: Real-time due date tracking (Due today, Overdue, Due tomorrow, etc.).

### Phase 3: AI-Powered Active Recall Practice & Evaluation
- **Curriculum Topics**: Built-in topics across Biology, Physics, and Computer Science + support for custom user topics.
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

### Phase 6: Multi-User Authentication & Personal Data Isolation
- **User Registration & Login**: Full Name, Email, and Password with strict input validation and unique email enforcement.
- **Cryptographic Security**: Password hashing using Node.js native `crypto.pbkdf2Sync` (SHA-512 with 10,000 iterations and 16-byte random salt) and timing-safe password verification (`crypto.timingSafeEqual`).
- **Complete Personal Data Isolation**:
  - Tasks, private study topics, recall attempts, revision schedules, and learning analytics are strictly isolated by `user_id`.
  - Cross-user data modification and queries are prevented at the database and API layer.
- **Token-Based Sessions**: Secure session tokens with 7-day expiration and instant invalidation on logout.
- **Uniform Error Handling**: Safe authentication error messages prevent user enumeration. Passwords and hashes are never exposed in API responses.

### Phase 7: Production Polish & Responsive UX
- **Cross-Device Responsive Design**:
  - **Desktop / Laptop**: Two-column layout with fixed/sticky sidebar, expansive KPI cards, and side-by-side analytics panels.
  - **Tablet (<= 992px)**: Two-column grid collapses gracefully.
  - **Mobile (<= 768px)**: Sliding off-canvas sidebar drawer with backdrop overlay, accessible hamburger menu toggle, minimum 44px touch targets, and fluid single-column collapse.
- **Light & Dark Theme Modes**:
  - Full design-token-driven theming supporting **Light**, **Dark**, and **System OS preference** with seamless switching and persistent local storage.
- **Accessibility & WCAG Compliance**:
  - Semantic HTML5, accessible skip link (`.skip-link`), ARIA landmark roles, accessible live regions (`aria-live="polite"`), high contrast color ratios, and high-visibility focus indicator rings (`:focus-visible`).
  - Motion sensitivity support via `@media (prefers-reduced-motion: reduce)`.
- **Toast Notifications System**:
  - Floating non-intrusive notification toasts for task changes, recall evaluations, revision completions, theme switches, and error feedback.
- **Accessible Custom Confirmation Dialog**:
  - Replaces all native `confirm()` prompts with keyboard-trapped, styled `<dialog>` modals with safe destruction warnings.
- **Inline Validation & Loading States**:
  - Real-time client-side form validation with inline error messages for email, password, tasks, topics, and recall word count.
  - Button loading spinners and shimmering skeleton card loaders for smooth asynchronous transitions.
- **Topic Deletion**:
  - Authenticated custom topic deletion (`DELETE /api/topics/:id`) with cascade cleanup of associated revisions and recall attempts.

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

### Phase 8: Production Deployment Readiness & Infrastructure
- **Production-Ready Server Architecture**:
  - Configurable port and host binding (`HOST=0.0.0.0`, `PORT=3000`) for cloud container environments.
  - Hardened security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-XSS-Protection: 1; mode=block`).
  - Stripped framework fingerprinting (`X-Powered-By` disabled).
  - Production-aware error sanitization (no internal stack traces or database errors leaked to clients).
  - Graceful shutdown listeners (`SIGTERM`, `SIGINT`).
- **Production Health Check Endpoint**:
  - `GET /api/health` providing safe uptime and operational status without disclosing system secrets or file paths.
- **Configurable CORS Security**:
  - Flexible environment variable `CORS_ORIGIN` supporting strict domain whitelisting or open same-origin setups.
- **SQLite Production Architecture & Persistence**:
  - Pragmas for foreign key integrity (`PRAGMA foreign_keys = ON;`).
  - Container volume mount points (`/app/data`) for SQLite database persistence across container redeployments.
- **Docker Containerization**:
  - Lightweight Alpine Node.js 22 containerization (`Dockerfile` and `.dockerignore`) with built-in health check and persistent storage support.

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

### System & Health (Phase 8)
- `GET /api/health` — Safe production health check endpoint (`{ "success": true, "status": "ok", "timestamp": "..." }`).

### Authentication (Phase 6)
- `POST /api/auth/register` — Register a new student account (`{ name, email, password }`).
- `POST /api/auth/login` — Sign in with email and password (`{ email, password }`).
- `POST /api/auth/logout` — Invalidate the current session token.
- `GET /api/auth/me` — Retrieve current authenticated user profile.

### Tasks Management (Phase 6 & 7)
- `GET /api/tasks` — List tasks owned by the authenticated user.
- `POST /api/tasks` — Create a new task.
- `PUT /api/tasks/:id` — Update a task (title, description, priority, due date, completion).
- `DELETE /api/tasks/:id` — Delete a user task.

### Learning Analytics (Phase 5 & 7)
- `GET /api/analytics/overview` — High-level learning analytics, overall learning score, mastery counts, and top 5 strongest/weakest topics.
- `GET /api/analytics/recall-trend` — Chronological daily recall performance (attempts, average, max, min scores).
- `GET /api/analytics/topics` — Complete topic mastery matrix with latest scores, average scores, and revision counts.
- `GET /api/analytics/subjects` — Subject-wise aggregated analytics.
- `GET /api/analytics/revisions` — Spaced repetition analytics, urgency breakdown, and daily completion history.
- `GET /api/analytics/insights` — Personalized deterministic insights derived from database metrics.

### Spaced Repetition & Revisions (Phase 4 & 7)
- `GET /api/revisions` — Get all active revision schedules for the user (`?status=pending|completed|all`).
- `GET /api/revisions/due` — Get revisions due today or overdue.
- `POST /api/revisions/:id/complete` — Mark a revision as completed.
- `GET /api/revisions/:topicId` — Get revision history for a specific topic.

### Active Recall & Topics (Phase 1–3, 7)
- `GET /api/topics` — List system topics and user's private topics.
- `GET /api/topics/:id` — Retrieve topic details and notes.
- `POST /api/topics` — Create a new study topic.
- `DELETE /api/topics/:id` — Delete a custom topic created by the current user.
- `POST /api/recall/evaluate` — Submit recalled answer for evaluation and automatic revision scheduling.
- `GET /api/recall/history` — Get past recall attempts history for the user.
- `GET /api/stats` — Summary metrics for dashboard KPI compatibility.

---

## ⚙️ Environment Variables Reference

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port on which the HTTP server listens. |
| `HOST` | `0.0.0.0` | Host interface binding for container and cloud environments. |
| `NODE_ENV` | `production` | Set to `production` for security headers, stripped traces, and sanitized errors. |
| `DB_PATH` | `./data/study_dashboard.db` | Absolute or relative path to SQLite database file. |
| `CORS_ORIGIN` | `*` | Allowed CORS origins (e.g. `https://studypulse.app`). |
| `SESSION_EXPIRY_DAYS` | `7` | Duration in days before session tokens expire. |

---

## 🚢 Production Deployment Guide

> [!NOTE]
> The application has been prepared and verified for production readiness. No public deployment has been executed yet.

### Option A: Containerized Deployment (Docker)

1. **Build the container image**:
   ```bash
   docker build -t studypulse:latest .
   ```

2. **Run container with persistent volume**:
   ```bash
   docker run -d \
     --name studypulse \
     -p 3000:3000 \
     -v studypulse_data:/app/data \
     -e NODE_ENV=production \
     -e PORT=3000 \
     studypulse:latest
   ```

3. **Verify health check**:
   ```bash
   curl http://localhost:3000/api/health
   ```

---

### Option B: Cloud Platform as a Service (Render, Railway, Fly.io)

1. **Configure Environment Variables**:
   Set `NODE_ENV=production`, `PORT=3000`, `HOST=0.0.0.0`.
2. **Configure Persistent Disk / Volume**:
   - **Render**: Attach a persistent disk mounted at `/app/data` (or set `DB_PATH=/var/data/study_dashboard.db`).
   - **Railway**: Add a Volume mounted at `/app/data`.
   - **Fly.io**: Create a volume `fly volumes create studypulse_data` and mount in `fly.toml` at `/app/data`.
3. **Set Build & Start Commands**:
   - Build: `npm install --omit=dev`
   - Start: `node server.js`

---

### Option C: Linux VPS Deployment (Ubuntu / Debian + Nginx + PM2)

1. **Clone repository & install dependencies**:
   ```bash
   git clone <repo-url> /var/www/studypulse
   cd /var/www/studypulse
   npm ci --omit=dev
   ```

2. **Configure `.env`**:
   ```bash
   cp .env.example .env
   # Edit .env with your domain and settings
   ```

3. **Start with PM2 Process Manager**:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "studypulse"
   pm2 save
   pm2 startup
   ```

4. **Configure Nginx Reverse Proxy with SSL (Certbot)**:
   ```nginx
   server {
       server_name studypulse.example.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

---

## 🗄️ Database Architecture & Scaling Considerations

- **Current Architecture (SQLite via native `node:sqlite`)**:
  - Fast, self-contained, zero external database service dependency.
  - Uses `PRAGMA foreign_keys = ON;` and foreign key cascading.
  - **Ideal for**: Single-instance containerized apps, personal servers, and cloud instances with persistent volume disks.
- **Database Backup Recommendation**:
  - Regular automated snapshots of `data/study_dashboard.db` using standard SQLite backup / cron.
- **Horizontal Scaling Path (PostgreSQL)**:
  - If multi-instance auto-scaling across distributed nodes without shared persistent disks is required in the future, the data access layer in `src/db.js` is cleanly decoupled to allow swapping SQLite queries with PostgreSQL connection pooling.

---

## 🧪 Testing

To run the complete automated test suite (76 tests across all 8 phases):

```bash
npm test
```

All 76 tests execute in ~1 second using Node.js native test runner (`node:test`).

---

## 💻 Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the local server**:
   ```bash
   npm start
   ```

3. **Open the web dashboard**:
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

