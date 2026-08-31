const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");
const fs = require("node:fs");

// Ensure data directory exists
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dataDir, "study_dashboard.db");

let dbInstance = null;

function getDatabase(customPath) {
  if (customPath) {
    const customDb = new DatabaseSync(customPath);
    initSchema(customDb);
    return customDb;
  }
  if (!dbInstance) {
    dbInstance = new DatabaseSync(dbPath);
    initSchema(dbInstance);
  }
  return dbInstance;
}

function ensureColumnExists(db, table, column, definition) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    const exists = columns.some(c => c.name === column);
    if (!exists && columns.length > 0) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch (e) {
    // If table doesn't exist yet, it will be created by CREATE TABLE IF NOT EXISTS
  }
}

function initSchema(db) {
  // 1. Users table (Phase 6)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);

  // 2. Sessions table (Phase 6)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  `);

  // 3. User Tasks table (Phase 6)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
  `);

  // 4. Topics table
  db.exec(`
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      question TEXT NOT NULL,
      notes TEXT NOT NULL,
      key_concepts TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  ensureColumnExists(db, "topics", "user_id", "TEXT");

  // 5. Recall attempts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recall_attempts (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      topic_id TEXT NOT NULL,
      student_answer TEXT NOT NULL,
      score INTEGER NOT NULL,
      level TEXT NOT NULL,
      feedback TEXT NOT NULL,
      correct_concepts TEXT NOT NULL,
      partial_concepts TEXT NOT NULL,
      missed_concepts TEXT NOT NULL,
      suggestions TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );
  `);
  ensureColumnExists(db, "recall_attempts", "user_id", "TEXT");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_recall_attempts_user_id ON recall_attempts(user_id);
    CREATE INDEX IF NOT EXISTS idx_recall_attempts_topic_id ON recall_attempts(topic_id);
  `);

  // 6. Revisions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS revisions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      topic_id TEXT NOT NULL,
      recall_attempt_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      revision_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (topic_id) REFERENCES topics(id),
      FOREIGN KEY (recall_attempt_id) REFERENCES recall_attempts(id)
    );
  `);
  ensureColumnExists(db, "revisions", "user_id", "TEXT");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_revisions_user_id ON revisions(user_id);
    CREATE INDEX IF NOT EXISTS idx_revisions_topic_id ON revisions(topic_id);
    CREATE INDEX IF NOT EXISTS idx_revisions_status_date ON revisions(status, revision_date);
  `);

  // Ensure default demo user exists for test compatibility
  seedDemoUser(db);

  // Seed default system topics if empty
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM topics WHERE user_id IS NULL").get();
  if (countRow && countRow.count === 0) {
    seedTopics(db);
  }
}

function seedDemoUser(db) {
  const existing = db.prepare("SELECT id FROM users WHERE id = 'demo-user-1'").get();
  if (!existing) {
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, salt, created_at)
      VALUES ('demo-user-1', 'Deeksha', 'deeksha@studypulse.local', 'mockhash', 'mocksalt', ?)
    `).run(new Date().toISOString());
  }
}

function seedTopics(db) {
  const sampleTopics = [
    {
      id: "topic-1",
      user_id: null,
      title: "Cellular Respiration & Mitochondria",
      subject: "Biology",
      question: "Explain the purpose of cellular respiration, where it takes place, its key stages, and how ATP is generated.",
      notes: `Cellular respiration is the biochemical process by which cells convert glucose and oxygen into usable energy in the form of ATP (adenosine triphosphate), releasing carbon dioxide and water as byproducts. 

It consists of three primary stages:
1. Glycolysis: Occurs in the cytoplasm; breaks down 1 glucose molecule into 2 pyruvate molecules, producing a net gain of 2 ATP and 2 NADH without requiring oxygen (anaerobic).
2. The Krebs Cycle (Citric Acid Cycle): Occurs in the mitochondrial matrix; oxidizes pyruvate derivatives (Acetyl-CoA), releasing carbon dioxide and producing ATP, NADH, and FADH2 electron carriers.
3. Oxidative Phosphorylation & Electron Transport Chain (ETC): Occurs across the inner mitochondrial membrane; high-energy electrons from NADH and FADH2 move along protein complexes, creating a proton gradient. ATP synthase uses this proton-motive force to synthesize approximately 28–32 ATP molecules through chemiosmosis. Oxygen acts as the final electron acceptor, forming water.

Mitochondria are known as the powerhouse of the cell because the majority of ATP generation occurs within their specialized inner membrane and matrix.`,
      key_concepts: JSON.stringify([
        {
          name: "Purpose & Equation of Respiration",
          description: "Conversion of glucose and oxygen into ATP energy, releasing carbon dioxide and water.",
          keywords: ["glucose", "oxygen", "energy", "atp", "carbon dioxide", "water"]
        },
        {
          name: "Glycolysis",
          description: "Occurs in cytoplasm, breaks glucose into pyruvate, produces net 2 ATP anaerobically.",
          keywords: ["glycolysis", "cytoplasm", "pyruvate", "anaerobic", "glucose"]
        },
        {
          name: "Krebs Cycle / Citric Acid Cycle",
          description: "Occurs in mitochondrial matrix, processes Acetyl-CoA, generates NADH, FADH2, and CO2.",
          keywords: ["krebs", "citric acid", "matrix", "nadh", "fadh2", "co2", "acetyl-coa"]
        },
        {
          name: "Electron Transport Chain & ATP Synthase",
          description: "Inner membrane electron transfer creating proton gradient, ATP synthase generates ATP via chemiosmosis.",
          keywords: ["electron transport chain", "inner membrane", "proton gradient", "atp synthase", "chemiosmosis"]
        },
        {
          name: "Role of Oxygen & Mitochondria",
          description: "Oxygen is the final electron acceptor forming water; mitochondria house Krebs cycle and ETC.",
          keywords: ["oxygen", "final electron acceptor", "powerhouse", "mitochondria", "water"]
        }
      ]),
      created_at: new Date().toISOString()
    },
    {
      id: "topic-2",
      user_id: null,
      title: "Newton's Three Laws of Motion",
      subject: "Physics",
      question: "State and explain Newton's Three Laws of Motion with real-world examples and the formula for force.",
      notes: `Sir Isaac Newton formulated three foundational laws of classical mechanics describing the relationship between a body and the forces acting upon it:

1. First Law (Law of Inertia): An object at rest remains at rest, and an object in motion continues in motion with constant velocity along a straight line unless acted upon by a net external force. Inertia is an object's resistance to changes in its state of motion, directly proportional to its mass.
Example: A passenger lunges forward when a moving bus suddenly brakes.

2. Second Law (Law of Acceleration & Force): The acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass.
Formula: F = ma (Force = mass × acceleration), measured in Newtons (N).
Example: Pushing a heavier car requires significantly more force than pushing a bicycle to achieve the same acceleration.

3. Third Law (Action & Reaction): For every action force, there is an equal and opposite reaction force. When object A exerts a force on object B, object B simultaneously exerts an equal magnitude force in the opposite direction on object A.
Example: A rocket launches upward because the downward thrust of expelled gases creates an equal upward reaction force.`,
      key_concepts: JSON.stringify([
        {
          name: "First Law (Law of Inertia)",
          description: "Objects maintain constant velocity or rest unless acted upon by an external net force; inertia depends on mass.",
          keywords: ["first law", "inertia", "rest", "constant velocity", "external force", "straight line"]
        },
        {
          name: "Second Law (F = ma)",
          description: "Force equals mass times acceleration; acceleration is proportional to net force and inversely proportional to mass.",
          keywords: ["second law", "f = ma", "force", "mass", "acceleration", "proportional"]
        },
        {
          name: "Third Law (Action-Reaction)",
          description: "Every action has an equal and opposite reaction force between interacting bodies.",
          keywords: ["third law", "equal and opposite", "action", "reaction", "forces"]
        },
        {
          name: "Units & Real-World Examples",
          description: "Force measured in Newtons; examples such as seatbelts, rocket propulsion, or pushing objects.",
          keywords: ["newtons", "example", "rocket", "bus", "friction", "seatbelt"]
        }
      ]),
      created_at: new Date().toISOString()
    },
    {
      id: "topic-3",
      user_id: null,
      title: "Time Complexity & Big-O Notation",
      subject: "Computer Science",
      question: "What is Big-O notation, why is it used, and how do O(1), O(log n), O(n), and O(n^2) compare in efficiency?",
      notes: `Big-O notation is a mathematical notation used in computer science to describe the limiting behavior and asymptotic upper bound of an algorithm's time or space requirements as the input size (n) grows towards infinity.

Key Complexity Classes (from most to least efficient):
1. O(1) - Constant Time: The execution time remains constant regardless of input size. Example: Array index lookup or hash table get/set.
2. O(log n) - Logarithmic Time: The problem size is divided by a constant factor in each step. Highly efficient for large datasets. Example: Binary search on a sorted array.
3. O(n) - Linear Time: Execution time grows directly in direct proportion to input size. Example: Iterating through an array (linear search).
4. O(n log n) - Linearithmic Time: Efficient comparison-based sorting algorithms. Example: Merge sort and Quicksort (average case).
5. O(n^2) - Quadratic Time: Execution time grows with the square of the input size, typically seen in nested loops over the data. Example: Bubble sort or Selection sort.

Best vs Worst vs Average Case:
- Big-O (O) represents the worst-case upper bound.
- Big-Omega (Ω) represents the best-case lower bound.
- Big-Theta (Θ) represents the tight bound where upper and lower bounds match.`,
      key_concepts: JSON.stringify([
        {
          name: "Definition & Purpose of Big-O",
          description: "Describes asymptotic upper bound of time/space complexity as input size n grows.",
          keywords: ["big-o", "asymptotic", "upper bound", "input size", "time complexity", "efficiency"]
        },
        {
          name: "Constant Time O(1)",
          description: "Execution time does not change with input size; e.g. array index access.",
          keywords: ["o(1)", "constant time", "hash table", "index access"]
        },
        {
          name: "Logarithmic Time O(log n)",
          description: "Divides problem size in each step; e.g. binary search on sorted array.",
          keywords: ["o(log n)", "logarithmic", "binary search", "halving"]
        },
        {
          name: "Linear O(n) and Quadratic O(n^2)",
          description: "Linear O(n) scales directly with n (single loop); Quadratic O(n^2) scales with n squared (nested loops).",
          keywords: ["o(n)", "linear", "o(n^2)", "quadratic", "nested loops", "bubble sort"]
        },
        {
          name: "Worst vs Average vs Best Case (O, Omega, Theta)",
          description: "Big-O is worst case, Omega is best case, Theta is tight bound.",
          keywords: ["worst case", "best case", "omega", "theta", "upper bound"]
        }
      ]),
      created_at: new Date().toISOString()
    },
    {
      id: "topic-4",
      user_id: null,
      title: "Photosynthesis Process & Light Reactions",
      subject: "Biology",
      question: "Explain the stages of photosynthesis, where light and dark reactions occur, and the chemical inputs and outputs.",
      notes: `Photosynthesis is the process by which green plants, algae, and cyanobacteria convert light energy into chemical energy stored in glucose.

Overall Chemical Equation:
6 CO2 + 6 H2O + Light Energy -> C6H12O6 (Glucose) + 6 O2

The process takes place inside the chloroplasts and is divided into two main stages:
1. Light-Dependent Reactions:
- Location: Thylakoid membranes of chloroplasts.
- Mechanism: Chlorophyll pigments absorb sunlight, exciting electrons. Water (H2O) is split (photolysis) into protons, electrons, and Oxygen (O2) which is released as a byproduct.
- Products: ATP and NADPH are generated to power the next phase.

2. Light-Independent Reactions (Calvin Cycle / Dark Reactions):
- Location: Stroma of chloroplasts.
- Mechanism: Fixation of Carbon Dioxide (CO2) catalyzed by the enzyme RuBisCO. Uses the ATP and NADPH produced in the light reactions to convert 3-PGA into G3P / glucose sugar.
- Products: Glucose (chemical energy storage), NADP+, and ADP.`,
      key_concepts: JSON.stringify([
        {
          name: "Overall Equation & Purpose",
          description: "Plants convert CO2, H2O, and light into glucose and oxygen in chloroplasts.",
          keywords: ["photosynthesis", "glucose", "oxygen", "carbon dioxide", "water", "chloroplast", "equation"]
        },
        {
          name: "Light-Dependent Reactions",
          description: "Occurs in thylakoid membranes, chlorophyll absorbs photons, splits water, releases O2, produces ATP and NADPH.",
          keywords: ["light-dependent", "thylakoid", "chlorophyll", "photolysis", "water splitting", "atp", "nadph"]
        },
        {
          name: "Calvin Cycle / Light-Independent",
          description: "Occurs in stroma, fixes CO2 using RuBisCO enzyme, uses ATP and NADPH to form glucose.",
          keywords: ["calvin cycle", "light-independent", "stroma", "co2 fixation", "rubisco", "glucose"]
        },
        {
          name: "Chloroplast Structure",
          description: "Thylakoids, grana stacks, and stroma fluid.",
          keywords: ["chloroplast", "thylakoid", "stroma", "grana"]
        }
      ]),
      created_at: new Date().toISOString()
    }
  ];

  const stmt = db.prepare(`
    INSERT INTO topics (id, user_id, title, subject, question, notes, key_concepts, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const t of sampleTopics) {
    stmt.run(t.id, t.user_id, t.title, t.subject, t.question, t.notes, t.key_concepts, t.created_at);
  }
}

// Database helper functions: Topics (Filtered by User)
function getAllTopics(db = getDatabase(), userId = null) {
  let query = `
    SELECT id, user_id, title, subject, question, notes, key_concepts, created_at
    FROM topics
  `;
  const params = [];

  if (userId) {
    query += ` WHERE user_id IS NULL OR user_id = ?`;
    params.push(userId);
  }

  query += ` ORDER BY created_at ASC`;

  const rows = db.prepare(query).all(...params);

  return rows.map(r => ({
    ...r,
    key_concepts: JSON.parse(r.key_concepts || "[]")
  }));
}

function getTopicById(id, db = getDatabase(), userId = null) {
  let query = `
    SELECT id, user_id, title, subject, question, notes, key_concepts, created_at
    FROM topics
    WHERE id = ?
  `;
  const params = [id];

  if (userId) {
    query += ` AND (user_id IS NULL OR user_id = ?)`;
    params.push(userId);
  }

  const row = db.prepare(query).get(...params);

  if (!row) return null;
  return {
    ...row,
    key_concepts: JSON.parse(row.key_concepts || "[]")
  };
}

function createTopic(topicData, db = getDatabase(), userId = null) {
  const id = topicData.id || `topic-${Date.now()}`;
  const keyConceptsJson = typeof topicData.key_concepts === "string" 
    ? topicData.key_concepts 
    : JSON.stringify(topicData.key_concepts || []);
  const createdAt = topicData.created_at || new Date().toISOString();
  const assignedUserId = userId || topicData.user_id || null;

  db.prepare(`
    INSERT INTO topics (id, user_id, title, subject, question, notes, key_concepts, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    assignedUserId,
    topicData.title,
    topicData.subject || "General",
    topicData.question || `Explain what you know about ${topicData.title}`,
    topicData.notes,
    keyConceptsJson,
    createdAt
  );

  return getTopicById(id, db, assignedUserId);
}

// Database helper functions: Recall Attempts (Filtered by User)
function saveRecallAttempt(attemptData, db = getDatabase(), userId = null) {
  const id = attemptData.id || `recall-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = attemptData.created_at || new Date().toISOString();
  const assignedUserId = userId || attemptData.user_id || null;

  const correctJson = typeof attemptData.correct_concepts === "string"
    ? attemptData.correct_concepts
    : JSON.stringify(attemptData.correct_concepts || []);

  const partialJson = typeof attemptData.partial_concepts === "string"
    ? attemptData.partial_concepts
    : JSON.stringify(attemptData.partial_concepts || []);

  const missedJson = typeof attemptData.missed_concepts === "string"
    ? attemptData.missed_concepts
    : JSON.stringify(attemptData.missed_concepts || []);

  const suggestionsJson = typeof attemptData.suggestions === "string"
    ? attemptData.suggestions
    : JSON.stringify(attemptData.suggestions || []);

  db.prepare(`
    INSERT INTO recall_attempts (
      id, user_id, topic_id, student_answer, score, level, feedback,
      correct_concepts, partial_concepts, missed_concepts, suggestions, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    assignedUserId,
    attemptData.topic_id,
    attemptData.student_answer,
    attemptData.score,
    attemptData.level,
    attemptData.feedback,
    correctJson,
    partialJson,
    missedJson,
    suggestionsJson,
    createdAt
  );

  return getRecallAttemptById(id, db, assignedUserId);
}

function getRecallAttemptById(id, db = getDatabase(), userId = null) {
  let query = `SELECT * FROM recall_attempts WHERE id = ?`;
  const params = [id];

  if (userId) {
    query += ` AND (user_id IS NULL OR user_id = ?)`;
    params.push(userId);
  }

  const row = db.prepare(query).get(...params);
  if (!row) return null;

  return {
    ...row,
    correct_concepts: JSON.parse(row.correct_concepts || "[]"),
    partial_concepts: JSON.parse(row.partial_concepts || "[]"),
    missed_concepts: JSON.parse(row.missed_concepts || "[]"),
    suggestions: JSON.parse(row.suggestions || "[]")
  };
}

function getRecallHistoryByTopic(topicId, db = getDatabase(), userId = null) {
  let query = `
    SELECT * FROM recall_attempts
    WHERE topic_id = ?
  `;
  const params = [topicId];

  if (userId) {
    query += ` AND (user_id IS NULL OR user_id = ?)`;
    params.push(userId);
  }

  query += ` ORDER BY created_at DESC`;

  const rows = db.prepare(query).all(...params);

  return rows.map(r => ({
    ...r,
    correct_concepts: JSON.parse(r.correct_concepts || "[]"),
    partial_concepts: JSON.parse(r.partial_concepts || "[]"),
    missed_concepts: JSON.parse(r.missed_concepts || "[]"),
    suggestions: JSON.parse(r.suggestions || "[]")
  }));
}

function getAllRecallAttempts(db = getDatabase(), userId = null) {
  let query = `
    SELECT r.*, t.title AS topic_title, t.subject AS topic_subject
    FROM recall_attempts r
    LEFT JOIN topics t ON r.topic_id = t.id
  `;
  const params = [];

  if (userId) {
    query += ` WHERE (r.user_id IS NULL OR r.user_id = ?)`;
    params.push(userId);
  }

  query += ` ORDER BY r.created_at DESC`;

  const rows = db.prepare(query).all(...params);

  return rows.map(r => ({
    ...r,
    correct_concepts: JSON.parse(r.correct_concepts || "[]"),
    partial_concepts: JSON.parse(r.partial_concepts || "[]"),
    missed_concepts: JSON.parse(r.missed_concepts || "[]"),
    suggestions: JSON.parse(r.suggestions || "[]")
  }));
}

// =========================================================
// PHASE 4 & 6: REVISION SCHEDULING DATABASE METHODS (USER-ISOLATED)
// =========================================================

/**
 * Schedule or update a spaced repetition revision for a topic
 */
function scheduleRevision({ topic_id, recall_attempt_id, score, revision_date, created_at }, db = getDatabase(), userId = null) {
  const id = `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = created_at || new Date().toISOString();
  const assignedUserId = userId || null;

  // Mark previous pending revisions for this topic and user as superseded
  let updateQuery = `
    UPDATE revisions 
    SET status = 'superseded', completed_at = ?
    WHERE topic_id = ? AND status = 'pending'
  `;
  const updateParams = [now, topic_id];

  if (assignedUserId) {
    updateQuery += ` AND (user_id IS NULL OR user_id = ?)`;
    updateParams.push(assignedUserId);
  }

  db.prepare(updateQuery).run(...updateParams);

  db.prepare(`
    INSERT INTO revisions (
      id, user_id, topic_id, recall_attempt_id, score, revision_date, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(
    id,
    assignedUserId,
    topic_id,
    recall_attempt_id,
    score,
    revision_date,
    now
  );

  return getRevisionById(id, db, assignedUserId);
}

/**
 * Get a revision by its ID (isolated by user)
 */
function getRevisionById(id, db = getDatabase(), userId = null) {
  let query = `
    SELECT r.*, t.title AS topic_title, t.subject AS topic_subject, t.question AS topic_question
    FROM revisions r
    LEFT JOIN topics t ON r.topic_id = t.id
    WHERE r.id = ?
  `;
  const params = [id];

  if (userId) {
    query += ` AND (r.user_id IS NULL OR r.user_id = ?)`;
    params.push(userId);
  }

  const row = db.prepare(query).get(...params);
  return row || null;
}

/**
 * Get revisions (filtered by status and isolated by user)
 */
function getRevisions(filter = {}, db = getDatabase(), userId = null) {
  let query = `
    SELECT r.*, t.title AS topic_title, t.subject AS topic_subject, t.question AS topic_question
    FROM revisions r
    LEFT JOIN topics t ON r.topic_id = t.id
    WHERE 1=1
  `;
  const params = [];

  if (userId) {
    query += ` AND (r.user_id IS NULL OR r.user_id = ?)`;
    params.push(userId);
  }

  if (filter.status) {
    query += ` AND r.status = ?`;
    params.push(filter.status);
  } else {
    query += ` AND r.status != 'superseded'`;
  }

  query += ` ORDER BY r.revision_date ASC, r.created_at DESC`;

  return db.prepare(query).all(...params);
}

/**
 * Get due revisions (isolated by user)
 */
function getDueRevisions(todayStr = null, db = getDatabase(), userId = null) {
  if (!todayStr) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    todayStr = `${year}-${month}-${day}`;
  }

  let query = `
    SELECT r.*, t.title AS topic_title, t.subject AS topic_subject, t.question AS topic_question
    FROM revisions r
    LEFT JOIN topics t ON r.topic_id = t.id
    WHERE r.status = 'pending' AND r.revision_date <= ?
  `;
  const params = [todayStr];

  if (userId) {
    query += ` AND (r.user_id IS NULL OR r.user_id = ?)`;
    params.push(userId);
  }

  query += ` ORDER BY r.revision_date ASC, r.score ASC`;

  return db.prepare(query).all(...params);
}

/**
 * Get upcoming revisions (isolated by user)
 */
function getUpcomingRevisions(todayStr = null, db = getDatabase(), userId = null) {
  if (!todayStr) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    todayStr = `${year}-${month}-${day}`;
  }

  let query = `
    SELECT r.*, t.title AS topic_title, t.subject AS topic_subject, t.question AS topic_question
    FROM revisions r
    LEFT JOIN topics t ON r.topic_id = t.id
    WHERE r.status = 'pending' AND r.revision_date > ?
  `;
  const params = [todayStr];

  if (userId) {
    query += ` AND (r.user_id IS NULL OR r.user_id = ?)`;
    params.push(userId);
  }

  query += ` ORDER BY r.revision_date ASC, r.score ASC`;

  return db.prepare(query).all(...params);
}

/**
 * Get revision history for a topic (isolated by user)
 */
function getRevisionsByTopic(topicId, db = getDatabase(), userId = null) {
  let query = `
    SELECT r.*, t.title AS topic_title, t.subject AS topic_subject
    FROM revisions r
    LEFT JOIN topics t ON r.topic_id = t.id
    WHERE r.topic_id = ?
  `;
  const params = [topicId];

  if (userId) {
    query += ` AND (r.user_id IS NULL OR r.user_id = ?)`;
    params.push(userId);
  }

  query += ` ORDER BY r.created_at DESC`;

  return db.prepare(query).all(...params);
}

/**
 * Mark a revision as completed (with user ownership check)
 */
function completeRevision(id, db = getDatabase(), userId = null) {
  const existing = getRevisionById(id, db, userId);
  if (!existing) return null;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE revisions 
    SET status = 'completed', completed_at = ?
    WHERE id = ?
  `).run(now, id);

  return getRevisionById(id, db, userId);
}

// =========================================================
// PHASE 6: USER TASK MANAGEMENT METHODS (USER-ISOLATED)
// =========================================================

function getUserTasks(userId, db = getDatabase()) {
  if (!userId) return [];
  const rows = db.prepare(`
    SELECT id, user_id, title, description, priority, due_date AS dueDate, completed, created_at
    FROM tasks
    WHERE user_id = ?
    ORDER BY due_date ASC, created_at DESC
  `).all(userId);

  return rows.map(r => ({
    ...r,
    completed: Boolean(r.completed)
  }));
}

function createTask(taskData, userId, db = getDatabase()) {
  if (!userId) throw new Error("userId is required to create a task.");
  const id = taskData.id || `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO tasks (id, user_id, title, description, priority, due_date, completed, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    taskData.title,
    taskData.description || "",
    taskData.priority || "medium",
    taskData.dueDate || taskData.due_date || null,
    taskData.completed ? 1 : 0,
    now
  );

  return {
    id,
    user_id: userId,
    title: taskData.title,
    description: taskData.description || "",
    priority: taskData.priority || "medium",
    dueDate: taskData.dueDate || taskData.due_date || null,
    completed: Boolean(taskData.completed),
    created_at: now
  };
}

function updateTask(id, taskData, userId, db = getDatabase()) {
  if (!userId || !id) return null;
  const existing = db.prepare(`SELECT * FROM tasks WHERE id = ? AND user_id = ?`).get(id, userId);
  if (!existing) return null;

  db.prepare(`
    UPDATE tasks 
    SET title = ?, description = ?, priority = ?, due_date = ?, completed = ?
    WHERE id = ? AND user_id = ?
  `).run(
    taskData.title !== undefined ? taskData.title : existing.title,
    taskData.description !== undefined ? taskData.description : existing.description,
    taskData.priority !== undefined ? taskData.priority : existing.priority,
    taskData.dueDate !== undefined ? taskData.dueDate : (taskData.due_date !== undefined ? taskData.due_date : existing.due_date),
    taskData.completed !== undefined ? (taskData.completed ? 1 : 0) : existing.completed,
    id,
    userId
  );

  return {
    id,
    user_id: userId,
    title: taskData.title !== undefined ? taskData.title : existing.title,
    description: taskData.description !== undefined ? taskData.description : existing.description,
    priority: taskData.priority !== undefined ? taskData.priority : existing.priority,
    dueDate: taskData.dueDate !== undefined ? taskData.dueDate : existing.due_date,
    completed: taskData.completed !== undefined ? Boolean(taskData.completed) : Boolean(existing.completed)
  };
}

function deleteTask(id, userId, db = getDatabase()) {
  if (!userId || !id) return false;
  const result = db.prepare(`DELETE FROM tasks WHERE id = ? AND user_id = ?`).run(id, userId);
  return result.changes > 0;
}

module.exports = {
  getDatabase,
  initSchema,
  getAllTopics,
  getTopicById,
  createTopic,
  saveRecallAttempt,
  getRecallAttemptById,
  getRecallHistoryByTopic,
  getAllRecallAttempts,
  scheduleRevision,
  getRevisionById,
  getRevisions,
  getDueRevisions,
  getUpcomingRevisions,
  getRevisionsByTopic,
  completeRevision,
  getUserTasks,
  createTask,
  updateTask,
  deleteTask
};
