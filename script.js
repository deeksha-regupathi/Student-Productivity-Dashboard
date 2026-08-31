// ===== Global State & Setup =====
const dateEl = document.getElementById("currentDate");
const today = new Date();

if (dateEl) {
  dateEl.textContent = today.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const overlay = document.getElementById("overlay");

function openSidebar() {
  sidebar.classList.add("is-open");
  overlay.hidden = false;
}

function closeSidebar() {
  sidebar.classList.remove("is-open");
  overlay.hidden = true;
}

if (menuBtn) {
  menuBtn.addEventListener("click", function () {
    if (sidebar.classList.contains("is-open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });
}

if (overlay) {
  overlay.addEventListener("click", closeSidebar);
}

// ===== View Navigation Routing =====
const viewPanes = {
  dashboard: document.getElementById("viewDashboard"),
  recall: document.getElementById("viewRecall"),
  tasks: document.getElementById("viewDashboard"), // Tasks scrolls/focuses dashboard
  subjects: document.getElementById("viewSubjects"),
  analytics: document.getElementById("viewAnalytics"),
  progress: document.getElementById("viewAnalytics"), // Alias for backward compatibility
  settings: document.getElementById("viewSettings"),
};

function switchView(viewName) {
  const normalizedView = viewName === "progress" ? "analytics" : viewName;

  // Update sidebar active link
  document.querySelectorAll(".sidebar-nav .nav-link").forEach((link) => {
    const linkView = link.getAttribute("data-view");
    if (linkView === normalizedView || (normalizedView === "analytics" && linkView === "progress")) {
      link.classList.add("is-active");
    } else {
      link.classList.remove("is-active");
    }
  });

  // Hide all view panes
  Object.values(viewPanes).forEach((pane) => {
    if (pane) pane.hidden = true;
  });

  // Show target view pane
  const targetPane = viewPanes[normalizedView] || viewPanes.dashboard;
  if (targetPane) {
    targetPane.hidden = false;
  }

  // Close mobile sidebar if open
  closeSidebar();

  // Trigger view-specific data refresh
  if (normalizedView === "dashboard") {
    loadRevisionQueue();
  } else if (normalizedView === "recall") {
    loadTopicsForRecall();
  } else if (normalizedView === "subjects") {
    loadTopicsForSubjectsView();
  } else if (normalizedView === "analytics") {
    loadLearningAnalyticsDashboard();
  } else if (normalizedView === "tasks") {
    const tasksPanel = document.getElementById("tasksHeading");
    if (tasksPanel) {
      tasksPanel.scrollIntoView({ behavior: "smooth" });
    }
  }
}

document.querySelectorAll(".sidebar-nav .nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const viewName = link.getAttribute("data-view");
    if (viewName) {
      switchView(viewName);
    }
  });
});

// ===== Task Management (Phase 2 preserved) =====
const STORAGE_KEY = "studentDashboardTasks";

const taskListEl = document.getElementById("taskList");
const taskCountEl = document.getElementById("taskCount");
const deadlineListEl = document.getElementById("deadlineList");
const deadlineCountEl = document.getElementById("deadlineCount");
const addTaskBtn = document.getElementById("addTaskBtn");
const taskDialog = document.getElementById("taskDialog");
const taskForm = document.getElementById("taskForm");
const dialogTitle = document.getElementById("dialogTitle");
const cancelTaskBtn = document.getElementById("cancelTaskBtn");
const searchInput = document.getElementById("searchInput");
const welcomeText = document.getElementById("welcomeText");
const sidebarTip = document.getElementById("sidebarTip");

const kpiTotal = document.getElementById("kpiTotal");
const kpiCompleted = document.getElementById("kpiCompleted");
const kpiPending = document.getElementById("kpiPending");

function getSampleTasks() {
  const todayStr = toDateInputValue(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const inThreeDays = new Date();
  inThreeDays.setDate(inThreeDays.getDate() + 3);

  return [
    {
      id: "task-1",
      title: "Revise Cellular Respiration Notes",
      description: "Review glycolysis and Krebs cycle stages for active recall.",
      priority: "medium",
      dueDate: todayStr,
      completed: true,
    },
    {
      id: "task-2",
      title: "Active Recall: Newton's Laws",
      description: "Test memory on the 3 laws of motion without looking at notes.",
      priority: "high",
      dueDate: toDateInputValue(tomorrow),
      completed: false,
    },
    {
      id: "task-3",
      title: "Practice Big-O Complexity Problems",
      description: "Analyze logarithmic vs linearithmic runtime.",
      priority: "low",
      dueDate: todayStr,
      completed: false,
    },
    {
      id: "task-4",
      title: "Photosynthesis Light Reactions Review",
      description: "Memorize thylakoid membrane electron flow.",
      priority: "medium",
      dueDate: toDateInputValue(inThreeDays),
      completed: false,
    },
  ];
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function loadTasks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const sample = getSampleTasks();
    saveTasks(sample);
    return sample;
  }

  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return parsed.map(function (task) {
        return {
          id: String(task.id),
          title: task.title || "",
          description: task.description || "",
          priority: task.priority || "medium",
          dueDate: task.dueDate || toDateInputValue(new Date()),
          completed: Boolean(task.completed),
        };
      });
    }
    return [];
  } catch (error) {
    console.error("Could not read saved tasks:", error);
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function createTaskId() {
  return "task-" + Date.now();
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatDueDate(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDueLabel(dateStr) {
  const due = new Date(dateStr + "T00:00:00");
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due - startOfToday) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return "In " + diffDays + " days";
}

function capitalize(word) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function getFilteredTasks(tasks) {
  if (!searchInput) return tasks;
  const query = searchInput.value.trim().toLowerCase();
  if (!query) return tasks;

  return tasks.filter(function (task) {
    const haystack = (task.title + " " + task.description).toLowerCase();
    return haystack.indexOf(query) !== -1;
  });
}

function updateKpis(tasks) {
  if (!kpiTotal || !kpiCompleted || !kpiPending) return;
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const pending = total - completed;

  kpiTotal.textContent = String(total);
  kpiCompleted.textContent = String(completed);
  kpiPending.textContent = String(pending);

  if (welcomeText) {
    if (pending === 0 && total > 0) {
      welcomeText.textContent = "All tasks are complete. Great active recall focus today.";
    } else if (pending === 1) {
      welcomeText.textContent = "You have 1 task left. Finish it at a steady pace.";
    } else {
      welcomeText.textContent = "You have " + pending + " pending tasks. Keep a steady pace.";
    }
  }

  const nextTask = tasks.find((t) => !t.completed);
  if (sidebarTip) {
    if (nextTask) {
      sidebarTip.textContent = nextTask.title;
    } else {
      sidebarTip.textContent = "Add a task to set today's focus.";
    }
  }
}

function renderTaskList(tasks) {
  if (!taskListEl || !taskCountEl) return;
  const visibleTasks = getFilteredTasks(tasks);
  taskCountEl.textContent = visibleTasks.length + " tasks";

  if (visibleTasks.length === 0) {
    taskListEl.innerHTML = '<li class="empty-note">No tasks found. Click Add Task to create one.</li>';
    return;
  }

  taskListEl.innerHTML = visibleTasks
    .map(function (task) {
      const completedClass = task.completed ? " is-completed" : "";
      const statusClass = task.completed ? " is-done" : "";
      const statusText = task.completed ? "Completed" : "Pending";

      return (
        '<li class="task-item priority-' +
        task.priority +
        completedClass +
        '" data-id="' +
        task.id +
        '">' +
        '<input class="task-check" type="checkbox" ' +
        (task.completed ? "checked" : "") +
        ' data-action="complete" aria-label="Complete ' +
        escapeHtml(task.title) +
        '" />' +
        "<div>" +
        '<div class="task-top">' +
        '<p class="task-title">' +
        escapeHtml(task.title) +
        "</p>" +
        '<span class="priority-tag priority-' +
        task.priority +
        '">' +
        capitalize(task.priority) +
        "</span>" +
        "</div>" +
        '<p class="task-description">' +
        escapeHtml(task.description) +
        "</p>" +
        '<div class="task-meta">' +
        "<span>Due " +
        formatDueDate(task.dueDate) +
        "</span>" +
        '<span class="status-tag' +
        statusClass +
        '">' +
        statusText +
        "</span>" +
        "</div>" +
        '<div class="task-actions">' +
        '<button class="btn btn-small" type="button" data-action="edit">Edit</button>' +
        '<button class="btn btn-small btn-danger" type="button" data-action="delete">Delete</button>' +
        "</div>" +
        "</div>" +
        "</li>"
      );
    })
    .join("");
}

function renderDeadlines(tasks) {
  if (!deadlineListEl || !deadlineCountEl) return;
  const upcoming = tasks
    .filter(function (task) {
      return !task.completed && task.dueDate;
    })
    .sort(function (a, b) {
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, 5);

  deadlineCountEl.textContent = upcoming.length + " upcoming";

  if (upcoming.length === 0) {
    deadlineListEl.innerHTML = '<li class="empty-note">No upcoming deadlines.</li>';
    return;
  }

  deadlineListEl.innerHTML = upcoming
    .map(function (task) {
      const date = new Date(task.dueDate + "T00:00:00");
      const day = String(date.getDate()).padStart(2, "0");
      const month = date.toLocaleDateString("en-IN", { month: "short" });

      return (
        '<li class="deadline-item">' +
        '<div class="deadline-date">' +
        '<span class="deadline-day">' +
        day +
        "</span>" +
        '<span class="deadline-month">' +
        month +
        "</span>" +
        "</div>" +
        "<div>" +
        '<p class="deadline-title">' +
        escapeHtml(task.title) +
        "</p>" +
        '<p class="deadline-meta">' +
        getDueLabel(task.dueDate) +
        " · " +
        capitalize(task.priority) +
        " priority</p>" +
        "</div>" +
        '<span class="priority-tag priority-' +
        task.priority +
        '">' +
        capitalize(task.priority) +
        "</span>" +
        "</li>"
      );
    })
    .join("");
}

function renderAllTasks() {
  const tasks = loadTasks();
  updateKpis(tasks);
  renderTaskList(tasks);
  renderDeadlines(tasks);
}

function openAddModal() {
  taskForm.reset();
  document.getElementById("taskId").value = "";
  dialogTitle.textContent = "Add Task";
  document.getElementById("taskDueDate").value = toDateInputValue(new Date());
  taskDialog.showModal();
}

function openEditModal(task) {
  dialogTitle.textContent = "Edit Task";
  document.getElementById("taskId").value = task.id;
  document.getElementById("taskTitle").value = task.title;
  document.getElementById("taskDescription").value = task.description;
  document.getElementById("taskPriority").value = task.priority;
  document.getElementById("taskDueDate").value = task.dueDate;
  taskDialog.showModal();
}

function closeTaskModal() {
  taskDialog.close();
}

function getFormValues() {
  return {
    id: document.getElementById("taskId").value,
    title: document.getElementById("taskTitle").value.trim(),
    description: document.getElementById("taskDescription").value.trim(),
    priority: document.getElementById("taskPriority").value,
    dueDate: document.getElementById("taskDueDate").value,
  };
}

function isValidTask(values) {
  if (!values.title) {
    alert("Please enter a task title.");
    return false;
  }
  if (!values.description) {
    alert("Please enter a description.");
    return false;
  }
  if (!values.priority) {
    alert("Please choose a priority.");
    return false;
  }
  if (!values.dueDate) {
    alert("Please choose a due date.");
    return false;
  }
  return true;
}

function addOrUpdateTask(event) {
  event.preventDefault();
  const values = getFormValues();
  if (!isValidTask(values)) return;

  const tasks = loadTasks();

  if (values.id) {
    const index = tasks.findIndex((t) => t.id === values.id);
    if (index !== -1) {
      tasks[index].title = values.title;
      tasks[index].description = values.description;
      tasks[index].priority = values.priority;
      tasks[index].dueDate = values.dueDate;
    }
  } else {
    tasks.push({
      id: createTaskId(),
      title: values.title,
      description: values.description,
      priority: values.priority,
      dueDate: values.dueDate,
      completed: false,
    });
  }

  saveTasks(tasks);
  closeTaskModal();
  renderAllTasks();
}

function toggleComplete(taskId) {
  const tasks = loadTasks();
  const index = tasks.findIndex((t) => t.id === taskId);
  if (index !== -1) {
    tasks[index].completed = !tasks[index].completed;
    saveTasks(tasks);
    renderAllTasks();
  }
}

function deleteTask(taskId) {
  const confirmed = confirm("Delete this task? This cannot be undone.");
  if (!confirmed) return;

  const tasks = loadTasks().filter((t) => t.id !== taskId);
  saveTasks(tasks);
  renderAllTasks();
}

if (addTaskBtn) addTaskBtn.addEventListener("click", openAddModal);
if (cancelTaskBtn) cancelTaskBtn.addEventListener("click", closeTaskModal);
if (taskForm) taskForm.addEventListener("submit", addOrUpdateTask);
if (searchInput) searchInput.addEventListener("input", renderAllTasks);

if (taskListEl) {
  taskListEl.addEventListener("click", function (event) {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;
    const taskItem = actionEl.closest(".task-item");
    if (!taskItem) return;

    const taskId = taskItem.getAttribute("data-id");
    const action = actionEl.getAttribute("data-action");

    if (action === "complete") toggleComplete(taskId);
    if (action === "edit") {
      const task = loadTasks().find((t) => t.id === taskId);
      if (task) openEditModal(task);
    }
    if (action === "delete") deleteTask(taskId);
  });
}

// =========================================================
// PHASE 4: SMART REVISION QUEUE (SPACED REPETITION)
// =========================================================

let globalRevisions = [];
let currentRevisionFilter = "all";

const revisionQueueList = document.getElementById("revisionQueueList");
const revCountAll = document.getElementById("revCountAll");
const revCountOverdue = document.getElementById("revCountOverdue");
const revCountDueToday = document.getElementById("revCountDueToday");
const revCountUpcoming = document.getElementById("revCountUpcoming");

async function loadRevisionQueue() {
  if (!revisionQueueList) return;
  try {
    const res = await fetch("/api/revisions?status=pending");
    const json = await res.json();

    if (json.success && Array.isArray(json.data)) {
      globalRevisions = json.data;

      // Calculate counts
      const overdue = globalRevisions.filter((r) => r.is_overdue).length;
      const dueToday = globalRevisions.filter((r) => r.is_due_today).length;
      const upcoming = globalRevisions.filter((r) => r.is_upcoming).length;

      if (revCountAll) revCountAll.textContent = globalRevisions.length;
      if (revCountOverdue) revCountOverdue.textContent = overdue;
      if (revCountDueToday) revCountDueToday.textContent = dueToday;
      if (revCountUpcoming) revCountUpcoming.textContent = upcoming;

      renderRevisionCards();
    }
  } catch (err) {
    console.error("Failed to load revision queue:", err);
    if (revisionQueueList) {
      revisionQueueList.innerHTML = '<p class="empty-note">Could not load revision queue.</p>';
    }
  }
}

function renderRevisionCards() {
  if (!revisionQueueList) return;

  let filtered = globalRevisions;
  if (currentRevisionFilter === "overdue") {
    filtered = globalRevisions.filter((r) => r.is_overdue);
  } else if (currentRevisionFilter === "due_today") {
    filtered = globalRevisions.filter((r) => r.is_due_today);
  } else if (currentRevisionFilter === "upcoming") {
    filtered = globalRevisions.filter((r) => r.is_upcoming);
  }

  if (filtered.length === 0) {
    const emptyMsg =
      currentRevisionFilter === "all"
        ? "All caught up! No pending spaced revisions. Complete an active recall session to schedule your next review."
        : `No ${currentRevisionFilter.replace("_", " ")} revisions at the moment.`;
    revisionQueueList.innerHTML = `<p class="empty-note" style="grid-column: 1/-1;">${emptyMsg}</p>`;
    return;
  }

  revisionQueueList.innerHTML = filtered
    .map((rev) => {
      let cardTypeClass = "revision-upcoming";
      let urgencyBadgeClass = "urgency-upcoming";
      let urgencyLabel = `Due on ${rev.revision_date}`;

      if (rev.is_overdue) {
        cardTypeClass = "revision-overdue";
        urgencyBadgeClass = "urgency-overdue";
        urgencyLabel = `⚠️ Overdue (${rev.revision_date})`;
      } else if (rev.is_due_today) {
        cardTypeClass = "revision-due-today";
        urgencyBadgeClass = "urgency-due-today";
        urgencyLabel = `🔔 Due Today`;
      }

      const scoreLevel = getRecallLevelLocal(rev.score);

      return `
        <article class="revision-card ${cardTypeClass}" data-id="${rev.id}">
          <div class="revision-card-top">
            <div>
              <span class="subject-badge">${escapeHtml(rev.topic_subject || "General")}</span>
              <h3 class="revision-card-title">${escapeHtml(rev.topic_title || "Study Topic")}</h3>
            </div>
            <span class="urgency-badge ${urgencyBadgeClass}">${urgencyLabel}</span>
          </div>
          <div class="revision-meta-row">
            <span>Last Score: <strong>${rev.score}%</strong> (${scoreLevel})</span>
            <span>Scheduled: ${rev.revision_date}</span>
          </div>
          <div class="revision-card-actions">
            <button class="btn btn-primary btn-small" onclick="jumpToRecallTopic('${rev.topic_id}')">
              🧠 Revise Now
            </button>
            <button class="btn btn-small" onclick="markRevisionCompleted('${rev.id}')">
              ✓ Complete
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function getRecallLevelLocal(score) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Improvement";
  return "Weak";
}

// Filter Tab Click Handlers
document.querySelectorAll(".revision-filter-tabs .filter-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".revision-filter-tabs .filter-tab").forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    currentRevisionFilter = tab.getAttribute("data-filter") || "all";
    renderRevisionCards();
  });
});

window.markRevisionCompleted = async function (revisionId) {
  try {
    const res = await fetch(`/api/revisions/${revisionId}/complete`, {
      method: "POST",
    });
    const json = await res.json();
    if (json.success) {
      await loadRevisionQueue();
      await loadLearningAnalyticsDashboard();
    } else {
      alert("Could not complete revision: " + (json.error || "Unknown error"));
    }
  } catch (err) {
    console.error("Failed to complete revision:", err);
  }
};

// =========================================================
// PHASE 3 & 4: ACTIVE RECALL & EVALUATION ENGINE FRONTEND
// =========================================================

let globalTopics = [];
let selectedTopic = null;
let recallTimerInterval = null;
let recallStartTime = null;

// DOM Elements for Recall View
const topicSelect = document.getElementById("topicSelect");
const recallPrepCard = document.getElementById("recallPrepCard");
const recallActiveCard = document.getElementById("recallActiveCard");
const recallResultCard = document.getElementById("recallResultCard");

const prepSubjectBadge = document.getElementById("prepSubjectBadge");
const prepConceptCount = document.getElementById("prepConceptCount");
const prepTopicTitle = document.getElementById("prepTopicTitle");
const prepQuestionText = document.getElementById("prepQuestionText");
const prepNotesContent = document.getElementById("prepNotesContent");

const startRecallBtn = document.getElementById("startRecallBtn");
const activeTopicTitle = document.getElementById("activeTopicTitle");
const activeQuestionText = document.getElementById("activeQuestionText");
const recallTimerDisplay = document.getElementById("recallTimerDisplay");
const studentAnswerInput = document.getElementById("studentAnswerInput");
const recallWordCount = document.getElementById("recallWordCount");
const recallAlert = document.getElementById("recallAlert");
const recallForm = document.getElementById("recallForm");
const submitRecallBtn = document.getElementById("submitRecallBtn");
const cancelActiveRecallBtn = document.getElementById("cancelActiveRecallBtn");

// Results Elements
const resultScoreDonut = document.getElementById("resultScoreDonut");
const resultScoreVal = document.getElementById("resultScoreVal");
const resultLevelPill = document.getElementById("resultLevelPill");
const resultTopicTitle = document.getElementById("resultTopicTitle");
const resultDate = document.getElementById("resultDate");
const resultNextRevisionText = document.getElementById("resultNextRevisionText");
const viewRevisionScheduleBtn = document.getElementById("viewRevisionScheduleBtn");
const resultFeedbackText = document.getElementById("resultFeedbackText");
const correctConceptsList = document.getElementById("correctConceptsList");
const partialConceptsList = document.getElementById("partialConceptsList");
const missedConceptsList = document.getElementById("missedConceptsList");
const correctCount = document.getElementById("correctCount");
const partialCount = document.getElementById("partialCount");
const missedCount = document.getElementById("missedCount");
const suggestionsList = document.getElementById("suggestionsList");
const toggleNotesCompareBtn = document.getElementById("toggleNotesCompareBtn");
const revealedNotesBox = document.getElementById("revealedNotesBox");
const revealedNotesText = document.getElementById("revealedNotesText");
const retryRecallBtn = document.getElementById("retryRecallBtn");
const topicHistoryTbody = document.getElementById("topicHistoryTbody");

// Topic Modal Elements
const topicDialog = document.getElementById("topicDialog");
const topicForm = document.getElementById("topicForm");
const openNewTopicModalBtn = document.getElementById("openNewTopicModalBtn");
const openAddTopicBtn = document.getElementById("openAddTopicBtn");
const cancelTopicBtn = document.getElementById("cancelTopicBtn");

/**
 * Fetch topics from backend API
 */
async function fetchTopics() {
  try {
    const res = await fetch("/api/topics");
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      globalTopics = json.data;
      return globalTopics;
    }
    return [];
  } catch (err) {
    console.error("Failed to load topics:", err);
    return [];
  }
}

/**
 * Load topics dropdown in Recall view
 */
async function loadTopicsForRecall(selectTopicId = null) {
  await fetchTopics();

  if (!topicSelect) return;
  topicSelect.innerHTML = "";

  if (globalTopics.length === 0) {
    topicSelect.innerHTML = '<option value="">No topics available</option>';
    return;
  }

  globalTopics.forEach((topic) => {
    const opt = document.createElement("option");
    opt.value = topic.id;
    opt.textContent = `[${topic.subject}] ${topic.title}`;
    topicSelect.appendChild(opt);
  });

  const targetId = selectTopicId || (globalTopics[0] ? globalTopics[0].id : null);
  if (targetId) {
    topicSelect.value = targetId;
    setSelectedTopic(targetId);
  }
}

/**
 * Set current active topic and render preview
 */
function setSelectedTopic(topicId) {
  selectedTopic = globalTopics.find((t) => t.id === topicId) || globalTopics[0];
  if (!selectedTopic) return;

  // Render Prep Card
  if (prepSubjectBadge) prepSubjectBadge.textContent = selectedTopic.subject || "General";
  if (prepConceptCount) {
    const count = Array.isArray(selectedTopic.key_concepts) ? selectedTopic.key_concepts.length : 0;
    prepConceptCount.textContent = `${count} Key Concept${count === 1 ? "" : "s"}`;
  }
  if (prepTopicTitle) prepTopicTitle.textContent = selectedTopic.title;
  if (prepQuestionText) prepQuestionText.textContent = selectedTopic.question;
  if (prepNotesContent) prepNotesContent.textContent = selectedTopic.notes;

  // Show Prep Card, hide Active and Result
  recallPrepCard.hidden = false;
  recallActiveCard.hidden = true;
  recallResultCard.hidden = true;

  // Load history for this topic
  loadTopicHistory(selectedTopic.id);
}

if (topicSelect) {
  topicSelect.addEventListener("change", (e) => {
    setSelectedTopic(e.target.value);
  });
}

/**
 * Start Active Recall Session (HIDES notes completely)
 */
function startRecallSession() {
  if (!selectedTopic) return;

  // 1. Hide study notes completely
  recallPrepCard.hidden = true;
  recallResultCard.hidden = true;

  // 2. Show Active Recall form
  recallActiveCard.hidden = false;
  activeTopicTitle.textContent = selectedTopic.title;
  activeQuestionText.textContent = selectedTopic.question;

  // 3. Clear textarea and alert
  studentAnswerInput.value = "";
  updateWordCount("");
  hideRecallAlert();

  // 4. Start live timer
  startTimer();

  // 5. Focus textarea
  studentAnswerInput.focus();
  recallActiveCard.scrollIntoView({ behavior: "smooth" });
}

if (startRecallBtn) {
  startRecallBtn.addEventListener("click", startRecallSession);
}

if (retryRecallBtn) {
  retryRecallBtn.addEventListener("click", () => {
    startRecallSession();
  });
}

if (cancelActiveRecallBtn) {
  cancelActiveRecallBtn.addEventListener("click", () => {
    stopTimer();
    recallActiveCard.hidden = true;
    recallPrepCard.hidden = false;
    recallPrepCard.scrollIntoView({ behavior: "smooth" });
  });
}

/**
 * Timer helpers
 */
function startTimer() {
  stopTimer();
  recallStartTime = Date.now();
  recallTimerDisplay.textContent = "00:00";
  recallTimerInterval = setInterval(() => {
    const elapsedSecs = Math.floor((Date.now() - recallStartTime) / 1000);
    const mins = String(Math.floor(elapsedSecs / 60)).padStart(2, "0");
    const secs = String(elapsedSecs % 60).padStart(2, "0");
    recallTimerDisplay.textContent = `${mins}:${secs}`;
  }, 1000);
}

function stopTimer() {
  if (recallTimerInterval) {
    clearInterval(recallTimerInterval);
    recallTimerInterval = null;
  }
}

/**
 * Live character/word counter
 */
function updateWordCount(text) {
  if (!recallWordCount) return;
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const chars = text.length;
  recallWordCount.textContent = `${words} word${words === 1 ? "" : "s"} (${chars} characters)`;
}

if (studentAnswerInput) {
  studentAnswerInput.addEventListener("input", (e) => {
    updateWordCount(e.target.value);
    if (recallAlert && !recallAlert.hidden) {
      hideRecallAlert();
    }
  });
}

function showRecallAlert(message) {
  if (!recallAlert) return;
  recallAlert.textContent = message;
  recallAlert.hidden = false;
}

function hideRecallAlert() {
  if (!recallAlert) return;
  recallAlert.hidden = true;
  recallAlert.textContent = "";
}

/**
 * Submit Recall Evaluation to Backend
 */
if (recallForm) {
  recallForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedTopic) {
      showRecallAlert("Please select a valid topic first.");
      return;
    }

    const answer = studentAnswerInput.value.trim();

    // Client-side validation
    if (!answer) {
      showRecallAlert("Please write your recalled answer before submitting.");
      studentAnswerInput.focus();
      return;
    }

    if (answer.length < 8) {
      showRecallAlert("Your response is too short. Please explain the concepts in more detail.");
      studentAnswerInput.focus();
      return;
    }

    // Set loading state
    hideRecallAlert();
    setSubmitLoading(true);

    try {
      const response = await fetch("/api/recall/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic_id: selectedTopic.id,
          student_answer: answer,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Evaluation failed. Please try again.");
      }

      // Stop timer & display results
      stopTimer();
      displayEvaluationResult(data);

      // Refresh revision queue in background
      loadRevisionQueue();
    } catch (err) {
      console.error("Submission error:", err);
      showRecallAlert(err.message || "Network error. Please try submitting again.");
    } finally {
      setSubmitLoading(false);
    }
  });
}

function setSubmitLoading(isLoading) {
  if (!submitRecallBtn) return;
  const btnText = submitRecallBtn.querySelector(".btn-text");
  const btnSpinner = submitRecallBtn.querySelector(".btn-spinner");

  submitRecallBtn.disabled = isLoading;
  if (btnText) btnText.hidden = isLoading;
  if (btnSpinner) btnSpinner.hidden = !isLoading;
}

/**
 * Render Recall Evaluation Results
 */
function displayEvaluationResult(result) {
  recallActiveCard.hidden = true;
  recallResultCard.hidden = false;

  // 1. Score & Level
  const score = result.score;
  const level = result.level || "Needs Improvement";

  resultScoreVal.textContent = score;
  resultLevelPill.textContent = getLevelIcon(level) + " " + level;
  resultLevelPill.className = `level-pill level-${levelToCssClass(level)}`;

  // Color donut border
  if (resultScoreDonut) {
    resultScoreDonut.style.borderColor = getLevelColor(level);
  }

  resultTopicTitle.textContent = `${result.topic_title || selectedTopic.title} — Result`;
  resultDate.textContent = `Completed on ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  // 2. Phase 4: Next Revision Banner
  if (result.next_revision && resultNextRevisionText) {
    const rev = result.next_revision;
    resultNextRevisionText.textContent = `Next revision: ${rev.label} (${rev.revision_date})`;
  }

  // 3. Feedback
  resultFeedbackText.textContent = result.feedback || "Evaluation complete.";

  // 4. Concepts Breakdown
  renderConceptList(correctConceptsList, result.correct_concepts, "No fully correct concepts identified.", "correct");
  renderConceptList(partialConceptsList, result.partial_concepts, "No partial concepts.", "partial");
  renderConceptList(missedConceptsList, result.missed_concepts, "None! All concepts recalled.", "missed");

  correctCount.textContent = (result.correct_concepts || []).length;
  partialCount.textContent = (result.partial_concepts || []).length;
  missedCount.textContent = (result.missed_concepts || []).length;

  // 5. Suggestions
  if (suggestionsList) {
    suggestionsList.innerHTML = "";
    const suggestions = result.suggestions || [];
    if (suggestions.length === 0) {
      suggestionsList.innerHTML = "<li>Keep up the outstanding active recall practice!</li>";
    } else {
      suggestions.forEach((s) => {
        const li = document.createElement("li");
        li.textContent = s;
        suggestionsList.appendChild(li);
      });
    }
  }

  // 6. Set up original notes toggle
  if (revealedNotesBox && revealedNotesText) {
    revealedNotesBox.hidden = true;
    revealedNotesText.textContent = selectedTopic.notes;
  }
  if (toggleNotesCompareBtn) {
    toggleNotesCompareBtn.textContent = "📖 View Original Notes";
  }

  // 7. Refresh Topic History
  loadTopicHistory(selectedTopic.id);

  // Scroll to results
  recallResultCard.scrollIntoView({ behavior: "smooth" });
}

function renderConceptList(container, items, emptyText, type) {
  if (!container) return;
  container.innerHTML = "";

  if (!items || items.length === 0) {
    container.innerHTML = `<li class="concept-pill-empty">${emptyText}</li>`;
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = `concept-pill`;
    const label = typeof item === "object" ? (item.name || item.title || JSON.stringify(item)) : String(item);
    li.textContent = label;
    container.appendChild(li);
  });
}

function levelToCssClass(level) {
  const norm = String(level || "").toLowerCase().replace(/\s+/g, "-");
  if (norm === "mastered" || norm === "excellent") return "excellent";
  if (norm === "strong" || norm === "good") return "good";
  if (norm === "developing" || norm === "needs-improvement") return "needs-improvement";
  return "weak";
}

function getLevelColor(level) {
  if (level === "Excellent" || level === "Mastered") return "#16a34a";
  if (level === "Good" || level === "Strong") return "#0284c7";
  if (level === "Needs Improvement" || level === "Developing") return "#d97706";
  return "#dc2626";
}

function getLevelIcon(level) {
  if (level === "Excellent" || level === "Mastered") return "🌟";
  if (level === "Good" || level === "Strong") return "👍";
  if (level === "Needs Improvement" || level === "Developing") return "📈";
  return "⚠️";
}

// Toggle Reveal Notes in Results
if (toggleNotesCompareBtn) {
  toggleNotesCompareBtn.addEventListener("click", () => {
    if (!revealedNotesBox) return;
    const isHidden = revealedNotesBox.hidden;
    revealedNotesBox.hidden = !isHidden;
    toggleNotesCompareBtn.textContent = isHidden ? "🙈 Hide Original Notes" : "📖 View Original Notes";
  });
}

if (viewRevisionScheduleBtn) {
  viewRevisionScheduleBtn.addEventListener("click", () => {
    switchView("dashboard");
    const revSection = document.getElementById("revisionQueueSection");
    if (revSection) {
      revSection.scrollIntoView({ behavior: "smooth" });
    }
  });
}

/**
 * Load History for specific Topic
 */
async function loadTopicHistory(topicId) {
  if (!topicHistoryTbody) return;
  try {
    const res = await fetch(`/api/recall/history?topic_id=${topicId}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      topicHistoryTbody.innerHTML = json.data
        .map((att) => {
          const dateStr = new Date(att.created_at).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          const correctNum = Array.isArray(att.correct_concepts) ? att.correct_concepts.length : 0;
          const missedNum = Array.isArray(att.missed_concepts) ? att.missed_concepts.length : 0;

          return `
            <tr>
              <td>${dateStr}</td>
              <td><strong>${att.score} / 100</strong></td>
              <td><span class="level-pill level-${levelToCssClass(att.level)}">${att.level}</span></td>
              <td>${correctNum} correct / ${missedNum} missed</td>
              <td>${escapeHtml(att.feedback ? att.feedback.slice(0, 70) + "..." : "")}</td>
            </tr>
          `;
        })
        .join("");
    } else {
      topicHistoryTbody.innerHTML = '<tr><td colspan="5" class="empty-note">No past attempts yet for this topic.</td></tr>';
    }
  } catch (err) {
    console.error("Failed to load topic history:", err);
  }
}

// =========================================================
// SUBJECTS VIEW & TOPIC CREATION
// =========================================================

const topicsGrid = document.getElementById("topicsGrid");

async function loadTopicsForSubjectsView() {
  await fetchTopics();
  if (!topicsGrid) return;

  if (globalTopics.length === 0) {
    topicsGrid.innerHTML = '<p class="empty-note">No topics created yet.</p>';
    return;
  }

  topicsGrid.innerHTML = globalTopics
    .map((t) => {
      const conceptCount = Array.isArray(t.key_concepts) ? t.key_concepts.length : 0;
      const snippet = t.notes ? t.notes.slice(0, 140) + "..." : "";
      return `
        <article class="topic-card">
          <div class="topic-tag-row">
            <span class="subject-badge">${escapeHtml(t.subject)}</span>
            <span class="topic-concept-count">${conceptCount} concepts</span>
          </div>
          <h3 class="topic-card-title">${escapeHtml(t.title)}</h3>
          <p class="topic-card-desc">${escapeHtml(snippet)}</p>
          <div class="topic-card-actions">
            <button class="btn btn-primary btn-small" onclick="jumpToRecallTopic('${t.id}')">
              🧠 Start Recall
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

// Global helper for card clicks
window.jumpToRecallTopic = function (topicId) {
  switchView("recall");
  if (topicSelect) topicSelect.value = topicId;
  setSelectedTopic(topicId);
};

// Add Topic Modal Logic
function openTopicModal() {
  if (topicForm) topicForm.reset();
  if (topicDialog) topicDialog.showModal();
}

function closeTopicModal() {
  if (topicDialog) topicDialog.close();
}

if (openNewTopicModalBtn) openNewTopicModalBtn.addEventListener("click", openTopicModal);
if (openAddTopicBtn) openAddTopicBtn.addEventListener("click", openTopicModal);
if (cancelTopicBtn) cancelTopicBtn.addEventListener("click", closeTopicModal);

if (topicForm) {
  topicForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("newTopicTitle").value.trim();
    const subject = document.getElementById("newTopicSubject").value.trim();
    const question = document.getElementById("newTopicQuestion").value.trim();
    const notes = document.getElementById("newTopicNotes").value.trim();

    if (!title || !notes) {
      alert("Please provide at least a title and study notes.");
      return;
    }

    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subject, question, notes }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create topic.");
      }

      closeTopicModal();
      await loadTopicsForRecall(json.data.id);
      switchView("recall");
    } catch (err) {
      alert("Error adding topic: " + err.message);
    }
  });
}

// =========================================================
// PHASE 5: PERSONALIZED LEARNING ANALYTICS FRONTEND
// =========================================================

// KPI Elements
const analyticsOverallScore = document.getElementById("analyticsOverallScore");
const analyticsOverallLevel = document.getElementById("analyticsOverallLevel");
const analyticsAvgRecall = document.getElementById("analyticsAvgRecall");
const analyticsTotalAttemptsMeta = document.getElementById("analyticsTotalAttemptsMeta");
const analyticsTopicsMastered = document.getElementById("analyticsTopicsMastered");
const analyticsMasteryRatioMeta = document.getElementById("analyticsMasteryRatioMeta");
const analyticsRevCompletion = document.getElementById("analyticsRevCompletion");
const analyticsActiveRevsMeta = document.getElementById("analyticsActiveRevsMeta");

// Insights & Visualizations
const analyticsInsightsContainer = document.getElementById("analyticsInsightsContainer");
const recallTrendContainer = document.getElementById("recallTrendContainer");
const subjectsAnalyticsList = document.getElementById("subjectsAnalyticsList");
const analyticsStrongestList = document.getElementById("analyticsStrongestList");
const analyticsWeakestList = document.getElementById("analyticsWeakestList");
const topicMasteryTbody = document.getElementById("topicMasteryTbody");
const allHistoryTbody = document.getElementById("allHistoryTbody");

async function loadLearningAnalyticsDashboard() {
  try {
    // 1. Overview KPIs
    const overviewRes = await fetch("/api/analytics/overview");
    const overviewJson = await overviewRes.json();

    if (overviewJson.success && overviewJson.data) {
      const d = overviewJson.data;

      if (analyticsOverallScore) analyticsOverallScore.textContent = d.overall_learning_score;
      if (analyticsOverallLevel) {
        analyticsOverallLevel.textContent = d.learning_level;
        analyticsOverallLevel.className = `level-pill level-${levelToCssClass(d.learning_level)}`;
      }

      if (analyticsAvgRecall) analyticsAvgRecall.textContent = `${d.average_recall_score}%`;
      if (analyticsTotalAttemptsMeta) {
        analyticsTotalAttemptsMeta.textContent = `Across ${d.total_recall_attempts} recall session${d.total_recall_attempts === 1 ? '' : 's'}`;
      }

      if (analyticsTopicsMastered) analyticsTopicsMastered.textContent = d.mastered_topics_count;
      if (analyticsMasteryRatioMeta) {
        analyticsMasteryRatioMeta.textContent = `${d.mastered_topics_count} of ${d.total_topics} topics ≥ 85% mastery`;
      }

      if (analyticsRevCompletion) analyticsRevCompletion.textContent = `${d.revision_completion_rate}%`;
      if (analyticsActiveRevsMeta) {
        analyticsActiveRevsMeta.textContent = `${d.completed_revisions} completed / ${d.total_scheduled_revisions} scheduled`;
      }

      // Strongest topics
      if (analyticsStrongestList) {
        if (Array.isArray(d.strongest_topics) && d.strongest_topics.length > 0) {
          analyticsStrongestList.innerHTML = d.strongest_topics
            .map((t) => `
              <li class="strength-item">
                <div>
                  <strong>${escapeHtml(t.title)}</strong>
                  <span class="topic-concept-count" style="display:block;">${escapeHtml(t.subject)} · ${t.attempts_count} attempt${t.attempts_count === 1 ? '' : 's'}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span class="level-pill level-${levelToCssClass(t.mastery_level)}">${t.mastery_percentage}% (${t.mastery_level})</span>
                  <button class="btn btn-small btn-primary" onclick="jumpToRecallTopic('${t.topic_id}')">Revise</button>
                </div>
              </li>
            `)
            .join("");
        } else {
          analyticsStrongestList.innerHTML = '<li class="empty-note">Complete recalls to see mastery topics.</li>';
        }
      }

      // Weakest topics
      if (analyticsWeakestList) {
        if (Array.isArray(d.weakest_topics) && d.weakest_topics.length > 0) {
          analyticsWeakestList.innerHTML = d.weakest_topics
            .map((t) => `
              <li class="strength-item">
                <div>
                  <strong>${escapeHtml(t.title)}</strong>
                  <span class="topic-concept-count" style="display:block;">${escapeHtml(t.subject)} · ${t.attempts_count} attempt${t.attempts_count === 1 ? '' : 's'}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span class="level-pill level-${levelToCssClass(t.mastery_level)}">${t.mastery_percentage}% (${t.mastery_level})</span>
                  <button class="btn btn-small btn-primary" onclick="jumpToRecallTopic('${t.topic_id}')">Practice</button>
                </div>
              </li>
            `)
            .join("");
        } else {
          analyticsWeakestList.innerHTML = '<li class="empty-note">Complete recalls to see topics needing focus.</li>';
        }
      }
    }

    // 2. Personalized Learning Insights
    const insightsRes = await fetch("/api/analytics/insights");
    const insightsJson = await insightsRes.json();
    if (analyticsInsightsContainer) {
      if (insightsJson.success && Array.isArray(insightsJson.data) && insightsJson.data.length > 0) {
        analyticsInsightsContainer.innerHTML = insightsJson.data
          .map((ins) => {
            const severityClass = ins.severity === "positive" ? "insight-positive" : ins.severity === "warning" ? "insight-warning" : "insight-info";
            const icon = ins.severity === "positive" ? "🌟" : ins.severity === "warning" ? "⚠️" : "💡";

            return `
              <div class="insight-card ${severityClass}">
                <div class="insight-header">
                  <span>${icon}</span>
                  <h4 class="insight-title">${escapeHtml(ins.title)}</h4>
                </div>
                <p class="insight-message">${escapeHtml(ins.message)}</p>
              </div>
            `;
          })
          .join("");
      } else {
        analyticsInsightsContainer.innerHTML = '<p class="empty-note">No learning insights available yet.</p>';
      }
    }

    // 3. Recall Performance Trend Visualizer
    const trendRes = await fetch("/api/analytics/recall-trend");
    const trendJson = await trendRes.json();
    if (recallTrendContainer) {
      if (trendJson.success && Array.isArray(trendJson.data) && trendJson.data.length > 0) {
        recallTrendContainer.innerHTML = trendJson.data
          .map((item) => {
            const heightPct = Math.max(10, Math.min(100, item.average_score));
            const fillClass = item.average_score >= 80 ? "fill-high" : item.average_score >= 60 ? "fill-medium" : "fill-low";
            const formattedDate = new Date(item.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

            return `
              <div class="trend-bar-group" title="${item.date}: ${item.average_score}% avg (${item.attempts_count} attempt${item.attempts_count === 1 ? '' : 's'})">
                <span class="trend-bar-score">${item.average_score}%</span>
                <div class="trend-bar-track">
                  <div class="trend-bar-fill ${fillClass}" style="height: ${heightPct}%;"></div>
                </div>
                <span class="trend-date-label">${formattedDate}</span>
              </div>
            `;
          })
          .join("");
      } else {
        recallTrendContainer.innerHTML = '<p class="empty-note">Complete recall sessions to visualize your performance trend.</p>';
      }
    }

    // 4. Subject-Wise Mastery Breakdown
    const subjRes = await fetch("/api/analytics/subjects");
    const subjJson = await subjRes.json();
    if (subjectsAnalyticsList) {
      if (subjJson.success && Array.isArray(subjJson.data) && subjJson.data.length > 0) {
        subjectsAnalyticsList.innerHTML = subjJson.data
          .map((s) => `
            <div class="subject-stat-card">
              <div class="subject-stat-top">
                <span class="subject-stat-title">${escapeHtml(s.subject)}</span>
                <span class="level-pill level-${levelToCssClass(s.mastery_level)}">${s.mastery_percentage}% (${s.mastery_level})</span>
              </div>
              <div class="progress-bar">
                <span class="progress-fill" style="width: ${Math.max(5, s.mastery_percentage)}%;"></span>
              </div>
              <div class="subject-meta-tags">
                <span>📚 ${s.topics_count} topic${s.topics_count === 1 ? '' : 's'}</span>
                <span>🧠 ${s.recall_attempts_count} attempt${s.recall_attempts_count === 1 ? '' : 's'}</span>
                <span>⚡ ${s.average_recall_score}% avg recall</span>
              </div>
            </div>
          `)
          .join("");
      } else {
        subjectsAnalyticsList.innerHTML = '<p class="empty-note">No subjects recorded.</p>';
      }
    }

    // 5. Topic Mastery Table
    const topicsRes = await fetch("/api/analytics/topics");
    const topicsJson = await topicsRes.json();
    if (topicMasteryTbody) {
      if (topicsJson.success && Array.isArray(topicsJson.data) && topicsJson.data.length > 0) {
        topicMasteryTbody.innerHTML = topicsJson.data
          .map((t) => {
            const latestDisplay = t.latest_score !== null ? `${t.latest_score}%` : "--";
            const avgDisplay = t.average_score !== null ? `${t.average_score}%` : "--";
            const revStatus = t.pending_revisions > 0 ? `<span class="urgency-badge urgency-due-today">Pending</span>` : `<span class="urgency-badge urgency-upcoming">Up to date</span>`;

            return `
              <tr>
                <td><strong>${escapeHtml(t.title)}</strong></td>
                <td><span class="subject-badge">${escapeHtml(t.subject)}</span></td>
                <td>${latestDisplay}</td>
                <td>${avgDisplay}</td>
                <td>${t.attempts_count}</td>
                <td><span class="level-pill level-${levelToCssClass(t.mastery_level)}">${t.mastery_percentage}% (${t.mastery_level})</span></td>
                <td>${revStatus}</td>
                <td>
                  <button class="btn btn-small btn-primary" onclick="jumpToRecallTopic('${t.topic_id}')">Revise</button>
                </td>
              </tr>
            `;
          })
          .join("");
      } else {
        topicMasteryTbody.innerHTML = '<tr><td colspan="8" class="empty-note">No topics available.</td></tr>';
      }
    }

    // 6. Recent Recall Evaluations History
    const historyRes = await fetch("/api/recall/history");
    const historyJson = await historyRes.json();
    if (allHistoryTbody) {
      if (historyJson.success && Array.isArray(historyJson.data) && historyJson.data.length > 0) {
        allHistoryTbody.innerHTML = historyJson.data
          .slice(0, 10)
          .map((att) => {
            const dateStr = new Date(att.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            });
            return `
              <tr>
                <td><strong>${escapeHtml(att.topic_title || att.topic_id)}</strong></td>
                <td><span class="subject-badge">${escapeHtml(att.topic_subject || "General")}</span></td>
                <td><strong>${att.score} / 100</strong></td>
                <td><span class="level-pill level-${levelToCssClass(att.level)}">${att.level}</span></td>
                <td>${dateStr}</td>
              </tr>
            `;
          })
          .join("");
      } else {
        allHistoryTbody.innerHTML = '<tr><td colspan="5" class="empty-note">No recall evaluations recorded yet.</td></tr>';
      }
    }

  } catch (err) {
    console.error("Failed to load learning analytics:", err);
  }
}

// ===== Initial App Boot =====
renderAllTasks();
loadTopicsForRecall();
loadRevisionQueue();
