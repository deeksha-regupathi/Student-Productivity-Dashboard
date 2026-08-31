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

function initSchema(db) {
  // Topics table
  db.exec(`
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      question TEXT NOT NULL,
      notes TEXT NOT NULL,
      key_concepts TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Recall attempts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recall_attempts (
      id TEXT PRIMARY KEY,
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

  // Phase 4: Revisions table for Spaced Repetition
  db.exec(`
    CREATE TABLE IF NOT EXISTS revisions (
      id TEXT PRIMARY KEY,
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

    CREATE INDEX IF NOT EXISTS idx_revisions_topic_id ON revisions(topic_id);
    CREATE INDEX IF NOT EXISTS idx_revisions_status_date ON revisions(status, revision_date);
  `);

  // Seed default topics if empty
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM topics").get();
  if (countRow && countRow.count === 0) {
    seedTopics(db);
  }
}

function seedTopics(db) {
  const sampleTopics = [
    {
      id: "topic-1",
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
    INSERT INTO topics (id, title, subject, question, notes, key_concepts, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const t of sampleTopics) {
    stmt.run(t.id, t.title, t.subject, t.question, t.notes, t.key_concepts, t.created_at);
  }
}

// Database helper functions: Topics
function getAllTopics(db = getDatabase()) {
  const rows = db.prepare(`
    SELECT id, title, subject, question, notes, key_concepts, created_at
    FROM topics
    ORDER BY created_at ASC
  `).all();

  return rows.map(r => ({
    ...r,
    key_concepts: JSON.parse(r.key_concepts || "[]")
  }));
}

function getTopicById(id, db = getDatabase()) {
  const row = db.prepare(`
    SELECT id, title, subject, question, notes, key_concepts, created_at
    FROM topics
    WHERE id = ?
  `).get(id);

  if (!row) return null;
  return {
    ...row,
    key_concepts: JSON.parse(row.key_concepts || "[]")
  };
}

function createTopic(topicData, db = getDatabase()) {
  const id = topicData.id || `topic-${Date.now()}`;
  const keyConceptsJson = typeof topicData.key_concepts === "string" 
    ? topicData.key_concepts 
    : JSON.stringify(topicData.key_concepts || []);
  const createdAt = topicData.created_at || new Date().toISOString();

  db.prepare(`
    INSERT INTO topics (id, title, subject, question, notes, key_concepts, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    topicData.title,
    topicData.subject || "General",
    topicData.question || `Explain what you know about ${topicData.title}`,
    topicData.notes,
    keyConceptsJson,
    createdAt
  );

  return getTopicById(id, db);
}

// Database helper functions: Recall Attempts
function saveRecallAttempt(attemptData, db = getDatabase()) {
  const id = attemptData.id || `recall-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = attemptData.created_at || new Date().toISOString();

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
      id, topic_id, student_answer, score, level, feedback,
      correct_concepts, partial_concepts, missed_concepts, suggestions, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
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

  return getRecallAttemptById(id, db);
}

function getRecallAttemptById(id, db = getDatabase()) {
  const row = db.prepare(`
    SELECT * FROM recall_attempts WHERE id = ?
  `).get(id);

  if (!row) return null;

  return {
    ...row,
    correct_concepts: JSON.parse(row.correct_concepts || "[]"),
    partial_concepts: JSON.parse(row.partial_concepts || "[]"),
    missed_concepts: JSON.parse(row.missed_concepts || "[]"),
    suggestions: JSON.parse(row.suggestions || "[]")
  };
}

function getRecallHistoryByTopic(topicId, db = getDatabase()) {
  const rows = db.prepare(`
    SELECT * FROM recall_attempts
    WHERE topic_id = ?
    ORDER BY created_at DESC
  `).all(topicId);

  return rows.map(r => ({
    ...r,
    correct_concepts: JSON.parse(r.correct_concepts || "[]"),
    partial_concepts: JSON.parse(r.partial_concepts || "[]"),
    missed_concepts: JSON.parse(r.missed_concepts || "[]"),
    suggestions: JSON.parse(r.suggestions || "[]")
  }));
}

function getAllRecallAttempts(db = getDatabase()) {
  const rows = db.prepare(`
    SELECT r.*, t.title AS topic_title, t.subject AS topic_subject
    FROM recall_attempts r
    LEFT JOIN topics t ON r.topic_id = t.id
    ORDER BY r.created_at DESC
  `).all();

  return rows.map(r => ({
    ...r,
    correct_concepts: JSON.parse(r.correct_concepts || "[]"),
    partial_concepts: JSON.parse(r.partial_concepts || "[]"),
    missed_concepts: JSON.parse(r.missed_concepts || "[]"),
    suggestions: JSON.parse(r.suggestions || "[]")
  }));
}

// =========================================================
// PHASE 4: REVISION SCHEDULING DATABASE METHODS
// =========================================================

/**
 * Schedule or update a spaced repetition revision for a topic
 */
function scheduleRevision({ topic_id, recall_attempt_id, score, revision_date, created_at }, db = getDatabase()) {
  const id = `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = created_at || new Date().toISOString();

  // If there are existing pending revisions for this topic, mark them superseded
  db.prepare(`
    UPDATE revisions 
    SET status = 'superseded', completed_at = ?
    WHERE topic_id = ? AND status = 'pending'
  `).run(now, topic_id);

  db.prepare(`
    INSERT INTO revisions (
      id, topic_id, recall_attempt_id, score, revision_date, status, created_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(
    id,
    topic_id,
    recall_attempt_id,
    score,
    revision_date,
    now
  );

  return getRevisionById(id, db);
}

/**
 * Get a revision by its ID
 */
function getRevisionById(id, db = getDatabase()) {
  const row = db.prepare(`
    SELECT r.*, t.title AS topic_title, t.subject AS topic_subject, t.question AS topic_question
    FROM revisions r
    LEFT JOIN topics t ON r.topic_id = t.id
    WHERE r.id = ?
  `).get(id);

  return row || null;
}

/**
 * Get revisions (filtered by status if provided)
 */
function getRevisions(filter = {}, db = getDatabase()) {
  let query = `
    SELECT r.*, t.title AS topic_title, t.subject AS topic_subject, t.question AS topic_question
    FROM revisions r
    LEFT JOIN topics t ON r.topic_id = t.id
  `;
  const params = [];

  if (filter.status) {
    query += ` WHERE r.status = ?`;
    params.push(filter.status);
  } else {
    // Default to pending if no status specified or return active
    query += ` WHERE r.status != 'superseded'`;
  }

  query += ` ORDER BY r.revision_date ASC, r.created_at DESC`;

  return db.prepare(query).all(...params);
}

/**
 * Get due revisions (revision_date <= today and status = 'pending')
 */
function getDueRevisions(todayStr = null, db = getDatabase()) {
  if (!todayStr) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    todayStr = `${year}-${month}-${day}`;
  }

  return db.prepare(`
    SELECT r.*, t.title AS topic_title, t.subject AS topic_subject, t.question AS topic_question
    FROM revisions r
    LEFT JOIN topics t ON r.topic_id = t.id
    WHERE r.status = 'pending' AND r.revision_date <= ?
    ORDER BY r.revision_date ASC, r.score ASC
  `).all(todayStr);
}

/**
 * Get upcoming revisions (revision_date > today and status = 'pending')
 */
function getUpcomingRevisions(todayStr = null, db = getDatabase()) {
  if (!todayStr) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    todayStr = `${year}-${month}-${day}`;
  }

  return db.prepare(`
    SELECT r.*, t.title AS topic_title, t.subject AS topic_subject, t.question AS topic_question
    FROM revisions r
    LEFT JOIN topics t ON r.topic_id = t.id
    WHERE r.status = 'pending' AND r.revision_date > ?
    ORDER BY r.revision_date ASC, r.score ASC
  `).all(todayStr);
}

/**
 * Get revision history for a topic
 */
function getRevisionsByTopic(topicId, db = getDatabase()) {
  return db.prepare(`
    SELECT r.*, t.title AS topic_title, t.subject AS topic_subject
    FROM revisions r
    LEFT JOIN topics t ON r.topic_id = t.id
    WHERE r.topic_id = ?
    ORDER BY r.created_at DESC
  `).all(topicId);
}

/**
 * Mark a revision as completed
 */
function completeRevision(id, db = getDatabase()) {
  const existing = getRevisionById(id, db);
  if (!existing) return null;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE revisions 
    SET status = 'completed', completed_at = ?
    WHERE id = ?
  `).run(now, id);

  return getRevisionById(id, db);
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
  completeRevision
};
