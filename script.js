// =========================================================
// StudyPulse — Phase 7: Production Polish & Responsive UX Script
// =========================================================

// ===== Toast Notification System =====
const toastContainer = document.getElementById("toastContainer");

function showToast(message, type = "info", duration = 4000) {
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");

  const icon = type === "success" ? "✅" : type === "error" ? "❌" : type === "warning" ? "⚠️" : "ℹ️";

  toast.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px;">
      <span aria-hidden="true">${icon}</span>
      <span>${escapeHtml(message)}</span>
    </div>
    <button class="toast-close" type="button" aria-label="Close notification">✕</button>
  `;

  const closeBtn = toast.querySelector(".toast-close");
  const removeToast = () => {
    toast.classList.add("toast-hiding");
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 260);
  };

  if (closeBtn) closeBtn.addEventListener("click", removeToast);
  setTimeout(removeToast, duration);

  toastContainer.appendChild(toast);
}

// ===== Accessible Confirmation Dialog System =====
const confirmDialog = document.getElementById("confirmDialog");
const confirmTitle = document.getElementById("confirmTitle");
const confirmMessage = document.getElementById("confirmMessage");
const confirmIconWrap = document.getElementById("confirmIconWrap");
const cancelConfirmBtn = document.getElementById("cancelConfirmBtn");
const proceedConfirmBtn = document.getElementById("proceedConfirmBtn");

let confirmResolve = null;

function showConfirmDialog({
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = true,
} = {}) {
  return new Promise((resolve) => {
    confirmResolve = resolve;

    if (confirmTitle) confirmTitle.textContent = title;
    if (confirmMessage) confirmMessage.textContent = message;
    if (proceedConfirmBtn) {
      proceedConfirmBtn.textContent = confirmText;
      proceedConfirmBtn.className = danger ? "btn btn-danger" : "btn btn-primary";
    }
    if (cancelConfirmBtn) cancelConfirmBtn.textContent = cancelText;

    if (confirmDialog && typeof confirmDialog.showModal === "function") {
      confirmDialog.showModal();
    }
  });
}

function handleConfirmClose(result) {
  if (confirmDialog && confirmDialog.open) {
    confirmDialog.close();
  }
  if (confirmResolve) {
    confirmResolve(result);
    confirmResolve = null;
  }
}

if (cancelConfirmBtn) {
  cancelConfirmBtn.addEventListener("click", () => handleConfirmClose(false));
}
if (proceedConfirmBtn) {
  proceedConfirmBtn.addEventListener("click", () => handleConfirmClose(true));
}
if (confirmDialog) {
  confirmDialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    handleConfirmClose(false);
  });
}

// ===== Theme Management (Light / Dark / System) =====
const THEME_STORAGE_KEY = "studypulse_theme";
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeIcon = document.getElementById("themeIcon");
const themeSelectDropdown = document.getElementById("themeSelectDropdown");

function getSavedTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) || "light";
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.setAttribute("data-theme", "dark");
    if (themeIcon) themeIcon.textContent = "☀️";
  } else if (theme === "light") {
    root.setAttribute("data-theme", "light");
    if (themeIcon) themeIcon.textContent = "🌙";
  } else {
    // System preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-theme", prefersDark ? "dark" : "light");
    if (themeIcon) themeIcon.textContent = prefersDark ? "☀️" : "🌙";
  }

  localStorage.setItem(THEME_STORAGE_KEY, theme);
  if (themeSelectDropdown) themeSelectDropdown.value = theme;
}

function toggleTheme() {
  const current = getSavedTheme();
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  showToast(`Switched to ${next === "dark" ? "Dark" : "Light"} theme`, "info", 2000);
}

if (themeToggleBtn) themeToggleBtn.addEventListener("click", toggleTheme);
if (themeSelectDropdown) {
  themeSelectDropdown.addEventListener("change", (e) => applyTheme(e.target.value));
}

// Listen to OS preference changes
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (getSavedTheme() === "system") {
    applyTheme("system");
  }
});

// Initialize theme on boot
applyTheme(getSavedTheme());

// ===== Global Date Setup =====
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

// Dynamic Welcome Greeting based on time of day
const welcomeKicker = document.getElementById("welcomeKicker");
if (welcomeKicker) {
  const hour = today.getHours();
  if (hour < 12) welcomeKicker.textContent = "Good morning";
  else if (hour < 18) welcomeKicker.textContent = "Good afternoon";
  else welcomeKicker.textContent = "Good evening";
}

// ===== Mobile Navigation Drawer =====
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const sidebarCloseBtn = document.getElementById("sidebarCloseBtn");
const overlay = document.getElementById("overlay");

function openSidebar() {
  if (!sidebar) return;
  sidebar.classList.add("is-open");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
  if (overlay) overlay.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  if (!sidebar) return;
  sidebar.classList.remove("is-open");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  if (overlay) overlay.hidden = true;
  document.body.style.overflow = "";
}

if (menuBtn) {
  menuBtn.addEventListener("click", () => {
    if (sidebar && sidebar.classList.contains("is-open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });
}

if (sidebarCloseBtn) sidebarCloseBtn.addEventListener("click", closeSidebar);
if (overlay) overlay.addEventListener("click", closeSidebar);

// Close drawer on ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && sidebar && sidebar.classList.contains("is-open")) {
    closeSidebar();
  }
});

// =========================================================
// PHASE 6: AUTHENTICATION STATE & CENTRAL API CLIENT
// =========================================================

const AUTH_TOKEN_KEY = "studypulse_token";
const AUTH_USER_KEY = "studypulse_user";

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getCurrentUser() {
  try {
    const userStr = localStorage.getItem(AUTH_USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
}

function getAuthHeaders() {
  const token = getAuthToken();
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

function setAuthSession(user, token) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  updateUserHeaderUI(user);
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

// Robust Central API Fetch Wrapper
async function apiFetch(url, options = {}) {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Handle 401 Unauthorized globally (session expired / revoked)
    if (res.status === 401 && !url.includes("/api/auth/login") && !url.includes("/api/auth/register")) {
      clearAuthSession();
      showAuthModal("signin");
      showToast("Your session has expired. Please sign in again.", "warning");
      return { ok: false, status: 401, error: "Session expired. Please sign in again." };
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }

    if (!res.ok) {
      const errorMsg = data.error || (res.status >= 500 ? "Server error. Please try again later." : "Request failed.");
      return { ok: false, status: res.status, error: errorMsg, data };
    }

    return { ok: true, status: res.status, data };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return { ok: false, status: 0, error: "Request timed out. Please check your internet connection." };
    }
    return { ok: false, status: 0, error: "Network error: Unable to reach the server." };
  }
}

// User Header UI Elements
const userAvatarEl = document.getElementById("userAvatar");
const userNameEl = document.getElementById("userName");
const userRoleEl = document.getElementById("userRole");
const welcomeHeadingEl = document.getElementById("welcomeHeading");
const logoutBtn = document.getElementById("logoutBtn");

function updateUserHeaderUI(user) {
  if (!user) return;
  const name = user.name || "Student";
  const initial = name.charAt(0).toUpperCase();

  if (userAvatarEl) userAvatarEl.textContent = initial;
  if (userNameEl) userNameEl.textContent = name;
  if (userRoleEl) userRoleEl.textContent = user.email || "Student";
  if (welcomeHeadingEl) welcomeHeadingEl.textContent = `Welcome back, ${name.split(" ")[0]}`;
}

// Auth Dialog Elements
const authDialog = document.getElementById("authDialog");
const tabSignInBtn = document.getElementById("tabSignInBtn");
const tabSignUpBtn = document.getElementById("tabSignUpBtn");
const signInForm = document.getElementById("signInForm");
const signUpForm = document.getElementById("signUpForm");
const loginAlert = document.getElementById("loginAlert");
const regAlert = document.getElementById("regAlert");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const regSubmitBtn = document.getElementById("regSubmitBtn");

function showAuthModal(mode = "signin") {
  if (!authDialog) return;
  if (mode === "signin") {
    if (tabSignInBtn) {
      tabSignInBtn.classList.add("is-active");
      tabSignInBtn.setAttribute("aria-selected", "true");
    }
    if (tabSignUpBtn) {
      tabSignUpBtn.classList.remove("is-active");
      tabSignUpBtn.setAttribute("aria-selected", "false");
    }
    if (signInForm) signInForm.hidden = false;
    if (signUpForm) signUpForm.hidden = true;
  } else {
    if (tabSignUpBtn) {
      tabSignUpBtn.classList.add("is-active");
      tabSignUpBtn.setAttribute("aria-selected", "true");
    }
    if (tabSignInBtn) {
      tabSignInBtn.classList.remove("is-active");
      tabSignInBtn.setAttribute("aria-selected", "false");
    }
    if (signUpForm) signUpForm.hidden = false;
    if (signInForm) signInForm.hidden = true;
  }

  if (loginAlert) loginAlert.hidden = true;
  if (regAlert) regAlert.hidden = true;
  clearAuthErrors();

  if (!authDialog.open && typeof authDialog.showModal === "function") {
    authDialog.showModal();
  }
}

function closeAuthModal() {
  if (authDialog && authDialog.open) {
    authDialog.close();
  }
}

function clearAuthErrors() {
  document.querySelectorAll(".field-error").forEach((el) => (el.textContent = ""));
}

if (tabSignInBtn) tabSignInBtn.addEventListener("click", () => showAuthModal("signin"));
if (tabSignUpBtn) tabSignUpBtn.addEventListener("click", () => showAuthModal("signup"));

// Validation helpers
function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Handle Sign In Submit
if (signInForm) {
  signInForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAuthErrors();

    const emailInput = document.getElementById("loginEmail");
    const passInput = document.getElementById("loginPassword");
    const email = emailInput ? emailInput.value.trim() : "";
    const password = passInput ? passInput.value : "";

    let hasError = false;
    if (!email) {
      const err = document.getElementById("loginEmailError");
      if (err) err.textContent = "Email address is required.";
      hasError = true;
    } else if (!isValidEmailFormat(email)) {
      const err = document.getElementById("loginEmailError");
      if (err) err.textContent = "Please enter a valid email address.";
      hasError = true;
    }

    if (!password) {
      const err = document.getElementById("loginPasswordError");
      if (err) err.textContent = "Password is required.";
      hasError = true;
    }

    if (hasError) return;
    if (loginAlert) loginAlert.hidden = true;

    setButtonLoading(loginSubmitBtn, true, "Signing In...");

    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    setButtonLoading(loginSubmitBtn, false);

    if (!res.ok) {
      if (loginAlert) {
        loginAlert.textContent = res.error || "Invalid email or password.";
        loginAlert.hidden = false;
      }
      return;
    }

    setAuthSession(res.data.user, res.data.token);
    closeAuthModal();
    showToast(`Welcome back, ${res.data.user.name.split(" ")[0]}!`, "success");
    await initializeDashboardData();
  });
}

// Handle Sign Up Submit
if (signUpForm) {
  signUpForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAuthErrors();

    const nameInput = document.getElementById("regName");
    const emailInput = document.getElementById("regEmail");
    const passInput = document.getElementById("regPassword");

    const name = nameInput ? nameInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim() : "";
    const password = passInput ? passInput.value : "";

    let hasError = false;
    if (!name || name.length < 2) {
      const err = document.getElementById("regNameError");
      if (err) err.textContent = "Please enter your full name (at least 2 characters).";
      hasError = true;
    }

    if (!email || !isValidEmailFormat(email)) {
      const err = document.getElementById("regEmailError");
      if (err) err.textContent = "Please enter a valid email address.";
      hasError = true;
    }

    if (!password || password.length < 6) {
      const err = document.getElementById("regPasswordError");
      if (err) err.textContent = "Password must be at least 6 characters long.";
      hasError = true;
    }

    if (hasError) return;
    if (regAlert) regAlert.hidden = true;

    setButtonLoading(regSubmitBtn, true, "Creating Account...");

    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });

    setButtonLoading(regSubmitBtn, false);

    if (!res.ok) {
      if (regAlert) {
        regAlert.textContent = res.error || "Registration failed.";
        regAlert.hidden = false;
      }
      return;
    }

    setAuthSession(res.data.user, res.data.token);
    closeAuthModal();
    showToast("Account created successfully! Welcome to StudyPulse.", "success");
    await initializeDashboardData();
  });
}

// Handle Logout with Confirmation
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    const confirmed = await showConfirmDialog({
      title: "Sign Out",
      message: "Are you sure you want to sign out of StudyPulse?",
      confirmText: "Sign Out",
      danger: true,
    });

    if (!confirmed) return;

    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {}

    clearAuthSession();
    showToast("Signed out successfully.", "info");
    showAuthModal("signin");
  });
}

async function verifyAuthOrPrompt() {
  const token = getAuthToken();
  if (!token) {
    showAuthModal("signin");
    return false;
  }

  const res = await apiFetch("/api/auth/me");
  if (res.ok && res.data && res.data.user) {
    updateUserHeaderUI(res.data.user);
    return true;
  }

  clearAuthSession();
  showAuthModal("signin");
  return false;
}

function setButtonLoading(btn, isLoading, loadingText = "Loading...") {
  if (!btn) return;
  const btnText = btn.querySelector(".btn-text");
  const btnSpinner = btn.querySelector(".btn-spinner");

  btn.disabled = isLoading;
  if (btnText) btnText.hidden = isLoading;
  if (btnSpinner) {
    btnSpinner.hidden = !isLoading;
    if (isLoading && loadingText) btnSpinner.textContent = `⏳ ${loadingText}`;
  }
}

// ===== View Navigation & Routing =====
const viewPanes = {
  dashboard: document.getElementById("viewDashboard"),
  recall: document.getElementById("viewRecall"),
  tasks: document.getElementById("viewDashboard"),
  subjects: document.getElementById("viewSubjects"),
  analytics: document.getElementById("viewAnalytics"),
  progress: document.getElementById("viewAnalytics"),
  settings: document.getElementById("viewSettings"),
};

function switchView(viewName) {
  const normalizedView = viewName === "progress" ? "analytics" : viewName;

  document.querySelectorAll(".sidebar-nav .nav-link").forEach((link) => {
    const linkView = link.getAttribute("data-view");
    if (linkView === normalizedView || (normalizedView === "analytics" && linkView === "progress")) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    } else {
      link.classList.remove("is-active");
      link.removeAttribute("aria-current");
    }
  });

  Object.values(viewPanes).forEach((pane) => {
    if (pane) pane.hidden = true;
  });

  const targetPane = viewPanes[normalizedView] || viewPanes.dashboard;
  if (targetPane) {
    targetPane.hidden = false;
  }

  // Update hash for deep linking without duplicate jump
  if (window.location.hash !== `#${normalizedView}`) {
    history.replaceState(null, "", `#${normalizedView}`);
  }

  closeSidebar();

  if (normalizedView === "dashboard") {
    loadRevisionQueue();
    renderAllTasks();
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

// Handle hash changes (back/forward buttons)
window.addEventListener("hashchange", () => {
  const view = window.location.hash.replace("#", "");
  if (view && viewPanes[view]) {
    switchView(view);
  }
});

document.querySelectorAll(".sidebar-nav .nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const viewName = link.getAttribute("data-view");
    if (viewName) {
      switchView(viewName);
    }
  });
});

// =========================================================
// PHASE 6 & 7: TASK MANAGEMENT (MULTI-USER & VALIDATION)
// =========================================================

let globalTasks = [];

const taskListEl = document.getElementById("taskList");
const taskCountEl = document.getElementById("taskCount");
const deadlineListEl = document.getElementById("deadlineList");
const deadlineCountEl = document.getElementById("deadlineCount");
const addTaskBtn = document.getElementById("addTaskBtn");
const taskDialog = document.getElementById("taskDialog");
const taskForm = document.getElementById("taskForm");
const dialogTitle = document.getElementById("dialogTitle");
const cancelTaskBtn = document.getElementById("cancelTaskBtn");
const closeTaskDialogBtn = document.getElementById("closeTaskDialogBtn");
const saveTaskBtn = document.getElementById("saveTaskBtn");
const searchInput = document.getElementById("searchInput");
const searchClearBtn = document.getElementById("searchClearBtn");
const welcomeText = document.getElementById("welcomeText");
const sidebarTip = document.getElementById("sidebarTip");

const kpiTotal = document.getElementById("kpiTotal");
const kpiCompleted = document.getElementById("kpiCompleted");
const kpiPending = document.getElementById("kpiPending");

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchUserTasks() {
  const res = await apiFetch("/api/tasks");
  if (res.ok && Array.isArray(res.data.data)) {
    globalTasks = res.data.data;
    return globalTasks;
  }
  return [];
}

function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

function formatDueDate(dateStr) {
  if (!dateStr) return "No date";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDueLabel(dateStr) {
  if (!dateStr) return "Upcoming";
  const due = new Date(dateStr + "T00:00:00");
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due - startOfToday) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `In ${diffDays} days`;
}

function capitalize(word) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function getFilteredTasks(tasks) {
  if (!searchInput) return tasks;
  const query = searchInput.value.trim().toLowerCase();
  if (!query) return tasks;

  return tasks.filter((task) => {
    const haystack = `${task.title} ${task.description || ""}`.toLowerCase();
    return haystack.includes(query);
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
      welcomeText.textContent = "All tasks completed! Fantastic active recall focus today.";
    } else if (pending === 1) {
      welcomeText.textContent = "You have 1 pending task. Finish strong!";
    } else if (total === 0) {
      welcomeText.textContent = "Add a study task to start organizing your schedule.";
    } else {
      welcomeText.textContent = `You have ${pending} pending task${pending === 1 ? '' : 's'}. Keep a steady pace.`;
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
  taskCountEl.textContent = `${visibleTasks.length} task${visibleTasks.length === 1 ? '' : 's'}`;

  if (visibleTasks.length === 0) {
    const isSearching = searchInput && searchInput.value.trim();
    if (isSearching) {
      taskListEl.innerHTML = `
        <li class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">🔍</span>
          <h3 class="empty-state-title">No tasks matching "${escapeHtml(searchInput.value.trim())}"</h3>
          <p class="empty-state-text">Try searching for a different topic or clear your filter.</p>
          <button class="btn btn-small empty-state-btn" onclick="clearSearchFilter()">Clear Search</button>
        </li>
      `;
    } else {
      taskListEl.innerHTML = `
        <li class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">📝</span>
          <h3 class="empty-state-title">No tasks scheduled yet</h3>
          <p class="empty-state-text">Create your first study task to organize your daily priorities.</p>
          <button class="btn btn-primary btn-small empty-state-btn" onclick="openAddModal()">+ Add Task</button>
        </li>
      `;
    }
    return;
  }

  taskListEl.innerHTML = visibleTasks
    .map((task) => {
      const completedClass = task.completed ? " is-completed" : "";
      const statusClass = task.completed ? " is-done" : "";
      const statusText = task.completed ? "Completed" : "Pending";

      return `
        <li class="task-item priority-${task.priority}${completedClass}" data-id="${task.id}">
          <input
            class="task-check"
            type="checkbox"
            ${task.completed ? "checked" : ""}
            data-action="complete"
            aria-label="Mark task '${escapeHtml(task.title)}' as ${task.completed ? 'pending' : 'completed'}"
          />
          <div>
            <div class="task-top">
              <p class="task-title">${escapeHtml(task.title)}</p>
              <span class="priority-tag priority-${task.priority}">
                ${capitalize(task.priority)}
              </span>
            </div>
            ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ""}
            <div class="task-meta">
              <span>📅 Due ${formatDueDate(task.dueDate)}</span>
              <span class="status-tag${statusClass}">${statusText}</span>
            </div>
            <div class="task-actions">
              <button class="btn btn-small" type="button" data-action="edit" aria-label="Edit task '${escapeHtml(task.title)}'">
                ✏️ Edit
              </button>
              <button class="btn btn-small btn-danger" type="button" data-action="delete" aria-label="Delete task '${escapeHtml(task.title)}'">
                🗑️ Delete
              </button>
            </div>
          </div>
        </li>
      `;
    })
    .join("");
}

function renderDeadlines(tasks) {
  if (!deadlineListEl || !deadlineCountEl) return;
  const upcoming = tasks
    .filter((task) => !task.completed && task.dueDate)
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
    .slice(0, 5);

  deadlineCountEl.textContent = `${upcoming.length} upcoming`;

  if (upcoming.length === 0) {
    deadlineListEl.innerHTML = '<li class="empty-note">No upcoming deadlines on your schedule.</li>';
    return;
  }

  deadlineListEl.innerHTML = upcoming
    .map((task) => {
      const date = new Date(task.dueDate + "T00:00:00");
      const day = String(date.getDate()).padStart(2, "0");
      const month = date.toLocaleDateString("en-IN", { month: "short" });

      return `
        <li class="deadline-item">
          <div class="deadline-date">
            <span class="deadline-day">${day}</span>
            <span class="deadline-month">${month}</span>
          </div>
          <div>
            <p class="deadline-title">${escapeHtml(task.title)}</p>
            <p class="deadline-meta">${getDueLabel(task.dueDate)} · ${capitalize(task.priority)} priority</p>
          </div>
          <span class="priority-tag priority-${task.priority}">
            ${capitalize(task.priority)}
          </span>
        </li>
      `;
    })
    .join("");
}

async function renderAllTasks() {
  const tasks = await fetchUserTasks();
  updateKpis(tasks);
  renderTaskList(tasks);
  renderDeadlines(tasks);
}

function openAddModal() {
  if (taskForm) taskForm.reset();
  const idInput = document.getElementById("taskId");
  if (idInput) idInput.value = "";
  if (dialogTitle) dialogTitle.textContent = "Add Task";
  const dateInput = document.getElementById("taskDueDate");
  if (dateInput) dateInput.value = toDateInputValue(new Date());

  clearTaskFormErrors();
  if (taskDialog && typeof taskDialog.showModal === "function") {
    taskDialog.showModal();
    const titleInput = document.getElementById("taskTitle");
    if (titleInput) titleInput.focus();
  }
}

function openEditModal(task) {
  if (dialogTitle) dialogTitle.textContent = "Edit Task";
  const idInput = document.getElementById("taskId");
  const titleInput = document.getElementById("taskTitle");
  const descInput = document.getElementById("taskDescription");
  const prioInput = document.getElementById("taskPriority");
  const dateInput = document.getElementById("taskDueDate");

  if (idInput) idInput.value = task.id;
  if (titleInput) titleInput.value = task.title;
  if (descInput) descInput.value = task.description || "";
  if (prioInput) prioInput.value = task.priority || "medium";
  if (dateInput) dateInput.value = task.dueDate || toDateInputValue(new Date());

  clearTaskFormErrors();
  if (taskDialog && typeof taskDialog.showModal === "function") {
    taskDialog.showModal();
    if (titleInput) titleInput.focus();
  }
}

function closeTaskModal() {
  if (taskDialog && taskDialog.open) {
    taskDialog.close();
  }
}

function clearTaskFormErrors() {
  const titleErr = document.getElementById("taskTitleError");
  const dateErr = document.getElementById("taskDueDateError");
  if (titleErr) titleErr.textContent = "";
  if (dateErr) dateErr.textContent = "";
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

async function addOrUpdateTask(event) {
  event.preventDefault();
  clearTaskFormErrors();

  const values = getFormValues();
  let hasError = false;

  if (!values.title) {
    const err = document.getElementById("taskTitleError");
    if (err) err.textContent = "Please enter a task title.";
    hasError = true;
  }

  if (!values.dueDate) {
    const err = document.getElementById("taskDueDateError");
    if (err) err.textContent = "Please select a due date.";
    hasError = true;
  }

  if (hasError) return;

  setButtonLoading(saveTaskBtn, true, "Saving...");

  try {
    let res;
    if (values.id) {
      res = await apiFetch(`/api/tasks/${values.id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      });
    } else {
      res = await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify(values),
      });
    }

    setButtonLoading(saveTaskBtn, false);

    if (!res.ok) {
      showToast(res.error || "Failed to save task.", "error");
      return;
    }

    closeTaskModal();
    showToast(values.id ? "Task updated successfully." : "Task added successfully.", "success");
    await renderAllTasks();
  } catch (err) {
    setButtonLoading(saveTaskBtn, false);
    showToast("Network error saving task.", "error");
  }
}

async function toggleComplete(taskId) {
  const task = globalTasks.find((t) => t.id === taskId);
  if (!task) return;

  const newStatus = !task.completed;
  const res = await apiFetch(`/api/tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify({ completed: newStatus }),
  });

  if (res.ok) {
    showToast(newStatus ? "Task completed! 🎉" : "Task marked as pending.", "info", 2000);
    await renderAllTasks();
  } else {
    showToast("Could not update task status.", "error");
  }
}

async function deleteTask(taskId) {
  const task = globalTasks.find((t) => t.id === taskId);
  const taskTitle = task ? task.title : "this task";

  const confirmed = await showConfirmDialog({
    title: "Delete Task?",
    message: `Are you sure you want to permanently delete "${taskTitle}"?`,
    confirmText: "Delete Task",
    danger: true,
  });

  if (!confirmed) return;

  const res = await apiFetch(`/api/tasks/${taskId}`, {
    method: "DELETE",
  });

  if (res.ok) {
    showToast("Task deleted successfully.", "info");
    await renderAllTasks();
  } else {
    showToast(res.error || "Failed to delete task.", "error");
  }
}

if (addTaskBtn) addTaskBtn.addEventListener("click", openAddModal);
if (cancelTaskBtn) cancelTaskBtn.addEventListener("click", closeTaskModal);
if (closeTaskDialogBtn) closeTaskDialogBtn.addEventListener("click", closeTaskModal);
if (taskForm) taskForm.addEventListener("submit", addOrUpdateTask);

// Search Handling with Clear button & Debounce
function clearSearchFilter() {
  if (searchInput) {
    searchInput.value = "";
    if (searchClearBtn) searchClearBtn.hidden = true;
    renderTaskList(globalTasks);
  }
}
window.clearSearchFilter = clearSearchFilter;

if (searchClearBtn) searchClearBtn.addEventListener("click", clearSearchFilter);

let searchDebounceTimeout = null;
if (searchInput) {
  searchInput.addEventListener("input", () => {
    if (searchClearBtn) searchClearBtn.hidden = !searchInput.value;
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      renderTaskList(globalTasks);
    }, 150);
  });
}

if (taskListEl) {
  taskListEl.addEventListener("click", (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;
    const taskItem = actionEl.closest(".task-item");
    if (!taskItem) return;

    const taskId = taskItem.getAttribute("data-id");
    const action = actionEl.getAttribute("data-action");

    if (action === "complete") toggleComplete(taskId);
    if (action === "edit") {
      const task = globalTasks.find((t) => t.id === taskId);
      if (task) openEditModal(task);
    }
    if (action === "delete") deleteTask(taskId);
  });
}

// =========================================================
// PHASE 4, 6 & 7: SMART REVISION QUEUE (SPACED REPETITION)
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
  const res = await apiFetch("/api/revisions?status=pending");

  if (res.ok && Array.isArray(res.data.data)) {
    globalRevisions = res.data.data;

    const overdue = globalRevisions.filter((r) => r.is_overdue).length;
    const dueToday = globalRevisions.filter((r) => r.is_due_today).length;
    const upcoming = globalRevisions.filter((r) => r.is_upcoming).length;

    if (revCountAll) revCountAll.textContent = globalRevisions.length;
    if (revCountOverdue) revCountOverdue.textContent = overdue;
    if (revCountDueToday) revCountDueToday.textContent = dueToday;
    if (revCountUpcoming) revCountUpcoming.textContent = upcoming;

    renderRevisionCards();
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
    const emptyIcon = currentRevisionFilter === "all" ? "🎉" : "✨";
    const emptyTitle = currentRevisionFilter === "all"
      ? "Revision queue is completely clear!"
      : `No ${currentRevisionFilter.replace("_", " ")} revisions`;
    const emptyMsg = currentRevisionFilter === "all"
      ? "All caught up on spaced repetition reviews. Complete an active recall session to schedule your next review."
      : `You're all set with ${currentRevisionFilter.replace("_", " ")} topics.`;

    revisionQueueList.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <span class="empty-state-icon" aria-hidden="true">${emptyIcon}</span>
        <h3 class="empty-state-title">${emptyTitle}</h3>
        <p class="empty-state-text">${emptyMsg}</p>
        <button class="btn btn-primary btn-small empty-state-btn" onclick="switchView('recall')">
          🧠 Practice Active Recall
        </button>
      </div>
    `;
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
            <span>📅 Scheduled: ${rev.revision_date}</span>
          </div>
          <div class="revision-card-actions">
            <button class="btn btn-primary btn-small" onclick="jumpToRecallTopic('${rev.topic_id}')">
              🧠 Revise Now
            </button>
            <button class="btn btn-small" onclick="markRevisionCompleted('${rev.id}', this)">
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

document.querySelectorAll(".revision-filter-tabs .filter-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".revision-filter-tabs .filter-tab").forEach((t) => {
      t.classList.remove("is-active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("is-active");
    tab.setAttribute("aria-selected", "true");
    currentRevisionFilter = tab.getAttribute("data-filter") || "all";
    renderRevisionCards();
  });
});

window.markRevisionCompleted = async function (revisionId, btnEl) {
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = "⏳ Completing...";
  }

  const res = await apiFetch(`/api/revisions/${revisionId}/complete`, {
    method: "POST",
  });

  if (res.ok) {
    showToast("Spaced revision completed! Great retention work.", "success");
    await loadRevisionQueue();
    await loadLearningAnalyticsDashboard();
  } else {
    showToast(res.error || "Could not complete revision.", "error");
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = "✓ Complete";
    }
  }
};

// =========================================================
// PHASE 3, 4 & 7: ACTIVE RECALL & EVALUATION ENGINE
// =========================================================

let globalTopics = [];
let selectedTopic = null;
let recallTimerInterval = null;
let recallStartTime = null;

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

const topicDialog = document.getElementById("topicDialog");
const topicForm = document.getElementById("topicForm");
const openNewTopicModalBtn = document.getElementById("openNewTopicModalBtn");
const openAddTopicBtn = document.getElementById("openAddTopicBtn");
const cancelTopicBtn = document.getElementById("cancelTopicBtn");
const closeTopicDialogBtn = document.getElementById("closeTopicDialogBtn");
const saveTopicBtn = document.getElementById("saveTopicBtn");

async function fetchTopics() {
  const res = await apiFetch("/api/topics");
  if (res.ok && Array.isArray(res.data.data)) {
    globalTopics = res.data.data;
    return globalTopics;
  }
  return [];
}

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

function setSelectedTopic(topicId) {
  selectedTopic = globalTopics.find((t) => t.id === topicId) || globalTopics[0];
  if (!selectedTopic) return;

  if (prepSubjectBadge) prepSubjectBadge.textContent = selectedTopic.subject || "General";
  if (prepConceptCount) {
    const count = Array.isArray(selectedTopic.key_concepts) ? selectedTopic.key_concepts.length : 0;
    prepConceptCount.textContent = `${count} Key Concept${count === 1 ? "" : "s"}`;
  }
  if (prepTopicTitle) prepTopicTitle.textContent = selectedTopic.title;
  if (prepQuestionText) prepQuestionText.textContent = selectedTopic.question;
  if (prepNotesContent) prepNotesContent.textContent = selectedTopic.notes;

  if (recallPrepCard) recallPrepCard.hidden = false;
  if (recallActiveCard) recallActiveCard.hidden = true;
  if (recallResultCard) recallResultCard.hidden = true;

  loadTopicHistory(selectedTopic.id);
}

if (topicSelect) {
  topicSelect.addEventListener("change", (e) => {
    setSelectedTopic(e.target.value);
  });
}

function startRecallSession() {
  if (!selectedTopic) {
    showToast("Please select a valid topic first.", "warning");
    return;
  }

  if (recallPrepCard) recallPrepCard.hidden = true;
  if (recallResultCard) recallResultCard.hidden = true;
  if (recallActiveCard) recallActiveCard.hidden = false;

  if (activeTopicTitle) activeTopicTitle.textContent = selectedTopic.title;
  if (activeQuestionText) activeQuestionText.textContent = selectedTopic.question;

  if (studentAnswerInput) {
    studentAnswerInput.value = "";
    studentAnswerInput.focus();
  }

  updateWordCount("");
  hideRecallAlert();
  startTimer();

  if (recallActiveCard) {
    recallActiveCard.scrollIntoView({ behavior: "smooth" });
  }
}

if (startRecallBtn) startRecallBtn.addEventListener("click", startRecallSession);
if (retryRecallBtn) retryRecallBtn.addEventListener("click", startRecallSession);

if (cancelActiveRecallBtn) {
  cancelActiveRecallBtn.addEventListener("click", () => {
    stopTimer();
    if (recallActiveCard) recallActiveCard.hidden = true;
    if (recallPrepCard) {
      recallPrepCard.hidden = false;
      recallPrepCard.scrollIntoView({ behavior: "smooth" });
    }
  });
}

function startTimer() {
  stopTimer();
  recallStartTime = Date.now();
  if (recallTimerDisplay) recallTimerDisplay.textContent = "00:00";
  recallTimerInterval = setInterval(() => {
    const elapsedSecs = Math.floor((Date.now() - recallStartTime) / 1000);
    const mins = String(Math.floor(elapsedSecs / 60)).padStart(2, "0");
    const secs = String(elapsedSecs % 60).padStart(2, "0");
    if (recallTimerDisplay) recallTimerDisplay.textContent = `${mins}:${secs}`;
  }, 1000);
}

function stopTimer() {
  if (recallTimerInterval) {
    clearInterval(recallTimerInterval);
    recallTimerInterval = null;
  }
}

function updateWordCount(text) {
  if (!recallWordCount) return;
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const chars = text.length;
  recallWordCount.textContent = `${words} word${words === 1 ? "" : "s"} (${chars} character${chars === 1 ? '' : 's'})`;
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

if (recallForm) {
  recallForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedTopic) {
      showRecallAlert("Please select a valid topic first.");
      return;
    }

    const answer = studentAnswerInput ? studentAnswerInput.value.trim() : "";

    if (!answer) {
      showRecallAlert("Please write your recalled answer before submitting.");
      if (studentAnswerInput) studentAnswerInput.focus();
      return;
    }

    if (answer.length < 8) {
      showRecallAlert("Your response is too short. Please explain the concepts with more depth.");
      if (studentAnswerInput) studentAnswerInput.focus();
      return;
    }

    hideRecallAlert();
    setButtonLoading(submitRecallBtn, true, "Evaluating with AI...");
    if (studentAnswerInput) studentAnswerInput.disabled = true;

    try {
      const res = await apiFetch("/api/recall/evaluate", {
        method: "POST",
        body: JSON.stringify({
          topic_id: selectedTopic.id,
          student_answer: answer,
        }),
      });

      setButtonLoading(submitRecallBtn, false);
      if (studentAnswerInput) studentAnswerInput.disabled = false;

      if (!res.ok) {
        showRecallAlert(res.error || "Evaluation failed. Please try submitting again.");
        return;
      }

      stopTimer();
      displayEvaluationResult(res.data);
      showToast(`Recall evaluation complete: ${res.data.score}% (${res.data.level})`, "success");
      loadRevisionQueue();
    } catch (err) {
      setButtonLoading(submitRecallBtn, false);
      if (studentAnswerInput) studentAnswerInput.disabled = false;
      showRecallAlert("Network error. Please try submitting again.");
    }
  });
}

function displayEvaluationResult(result) {
  if (recallActiveCard) recallActiveCard.hidden = true;
  if (recallResultCard) recallResultCard.hidden = false;

  const score = result.score;
  const level = result.level || "Needs Improvement";

  if (resultScoreVal) resultScoreVal.textContent = score;
  if (resultLevelPill) {
    resultLevelPill.textContent = `${getLevelIcon(level)} ${level}`;
    resultLevelPill.className = `level-pill level-${levelToCssClass(level)}`;
  }

  if (resultScoreDonut) {
    resultScoreDonut.style.borderColor = getLevelColor(level);
  }

  if (resultTopicTitle) {
    resultTopicTitle.textContent = `${result.topic_title || (selectedTopic ? selectedTopic.title : "Topic")} — Result`;
  }
  if (resultDate) {
    resultDate.textContent = `Completed on ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  if (result.next_revision && resultNextRevisionText) {
    const rev = result.next_revision;
    resultNextRevisionText.textContent = `Next revision: ${rev.label} (${rev.revision_date})`;
  }

  if (resultFeedbackText) {
    resultFeedbackText.textContent = result.feedback || "Evaluation complete.";
  }

  renderConceptList(correctConceptsList, result.correct_concepts, "No fully correct concepts identified.", "correct");
  renderConceptList(partialConceptsList, result.partial_concepts, "No partial concepts.", "partial");
  renderConceptList(missedConceptsList, result.missed_concepts, "None! All core concepts recalled.", "missed");

  if (correctCount) correctCount.textContent = (result.correct_concepts || []).length;
  if (partialCount) partialCount.textContent = (result.partial_concepts || []).length;
  if (missedCount) missedCount.textContent = (result.missed_concepts || []).length;

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

  if (revealedNotesBox && revealedNotesText && selectedTopic) {
    revealedNotesBox.hidden = true;
    revealedNotesText.textContent = selectedTopic.notes;
  }
  if (toggleNotesCompareBtn) {
    toggleNotesCompareBtn.textContent = "📖 View Original Notes";
  }

  if (selectedTopic) loadTopicHistory(selectedTopic.id);
  if (recallResultCard) recallResultCard.scrollIntoView({ behavior: "smooth" });
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

async function loadTopicHistory(topicId) {
  if (!topicHistoryTbody) return;
  const res = await apiFetch(`/api/recall/history?topic_id=${topicId}`);

  if (res.ok && Array.isArray(res.data.data) && res.data.data.length > 0) {
    topicHistoryTbody.innerHTML = res.data.data
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
    topicHistoryTbody.innerHTML = '<tr><td colspan="5" class="empty-note">No past recall attempts recorded yet for this topic.</td></tr>';
  }
}

// =========================================================
// SUBJECTS VIEW & TOPIC CREATION (WITH CONFIRM DELETE)
// =========================================================

const topicsGrid = document.getElementById("topicsGrid");

async function loadTopicsForSubjectsView() {
  await fetchTopics();
  if (!topicsGrid) return;

  if (globalTopics.length === 0) {
    topicsGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <span class="empty-state-icon" aria-hidden="true">📚</span>
        <h3 class="empty-state-title">No Study Topics Available</h3>
        <p class="empty-state-text">Create your first custom study topic with original notes to enable active recall sessions.</p>
        <button class="btn btn-primary btn-small empty-state-btn" onclick="openTopicModal()">+ Add Subject Topic</button>
      </div>
    `;
    return;
  }

  topicsGrid.innerHTML = globalTopics
    .map((t) => {
      const conceptCount = Array.isArray(t.key_concepts) ? t.key_concepts.length : 0;
      const snippet = t.notes ? t.notes.slice(0, 140) + "..." : "";
      const isCustomUserTopic = Boolean(t.user_id);

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
            ${isCustomUserTopic ? `
              <button class="btn btn-small btn-danger" onclick="deleteTopicItem('${t.id}')" title="Delete custom topic">
                🗑️ Delete
              </button>
            ` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

window.jumpToRecallTopic = function (topicId) {
  switchView("recall");
  if (topicSelect) topicSelect.value = topicId;
  setSelectedTopic(topicId);
};

window.deleteTopicItem = async function (topicId) {
  const topic = globalTopics.find((t) => t.id === topicId);
  const topicTitle = topic ? topic.title : "this topic";

  const confirmed = await showConfirmDialog({
    title: "Delete Custom Topic?",
    message: `Are you sure you want to permanently delete "${topicTitle}" and all its recall history?`,
    confirmText: "Delete Topic",
    danger: true,
  });

  if (!confirmed) return;

  const res = await apiFetch(`/api/topics/${topicId}`, {
    method: "DELETE",
  });

  if (res.ok) {
    showToast("Topic deleted successfully.", "info");
    await loadTopicsForSubjectsView();
    await loadTopicsForRecall();
  } else {
    showToast(res.error || "Failed to delete topic.", "error");
  }
};

function openTopicModal() {
  if (topicForm) topicForm.reset();
  clearTopicFormErrors();
  if (topicDialog && typeof topicDialog.showModal === "function") {
    topicDialog.showModal();
    const titleInput = document.getElementById("newTopicTitle");
    if (titleInput) titleInput.focus();
  }
}

function closeTopicModal() {
  if (topicDialog && topicDialog.open) {
    topicDialog.close();
  }
}

function clearTopicFormErrors() {
  const titleErr = document.getElementById("topicTitleError");
  const subjErr = document.getElementById("topicSubjectError");
  const notesErr = document.getElementById("topicNotesError");
  if (titleErr) titleErr.textContent = "";
  if (subjErr) subjErr.textContent = "";
  if (notesErr) notesErr.textContent = "";
}

window.openTopicModal = openTopicModal;

if (openNewTopicModalBtn) openNewTopicModalBtn.addEventListener("click", openTopicModal);
if (openAddTopicBtn) openAddTopicBtn.addEventListener("click", openTopicModal);
if (cancelTopicBtn) cancelTopicBtn.addEventListener("click", closeTopicModal);
if (closeTopicDialogBtn) closeTopicDialogBtn.addEventListener("click", closeTopicModal);

if (topicForm) {
  topicForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearTopicFormErrors();

    const titleInput = document.getElementById("newTopicTitle");
    const subjectInput = document.getElementById("newTopicSubject");
    const questionInput = document.getElementById("newTopicQuestion");
    const notesInput = document.getElementById("newTopicNotes");

    const title = titleInput ? titleInput.value.trim() : "";
    const subject = subjectInput ? subjectInput.value.trim() : "";
    const question = questionInput ? questionInput.value.trim() : "";
    const notes = notesInput ? notesInput.value.trim() : "";

    let hasError = false;
    if (!title) {
      const err = document.getElementById("topicTitleError");
      if (err) err.textContent = "Please provide a topic title.";
      hasError = true;
    }
    if (!subject) {
      const err = document.getElementById("topicSubjectError");
      if (err) err.textContent = "Please specify a subject or category.";
      hasError = true;
    }
    if (!notes || notes.length < 10) {
      const err = document.getElementById("topicNotesError");
      if (err) err.textContent = "Please write complete study notes (at least 10 characters).";
      hasError = true;
    }

    if (hasError) return;

    setButtonLoading(saveTopicBtn, true, "Saving Topic...");

    const res = await apiFetch("/api/topics", {
      method: "POST",
      body: JSON.stringify({ title, subject, question, notes }),
    });

    setButtonLoading(saveTopicBtn, false);

    if (!res.ok) {
      showToast(res.error || "Failed to create topic.", "error");
      return;
    }

    closeTopicModal();
    showToast(`Topic "${title}" created successfully!`, "success");
    await loadTopicsForRecall(res.data.data.id);
    switchView("recall");
  });
}

// =========================================================
// PHASE 5 & 7: PERSONALIZED LEARNING ANALYTICS FRONTEND
// =========================================================

const analyticsOverallScore = document.getElementById("analyticsOverallScore");
const analyticsOverallLevel = document.getElementById("analyticsOverallLevel");
const analyticsAvgRecall = document.getElementById("analyticsAvgRecall");
const analyticsTotalAttemptsMeta = document.getElementById("analyticsTotalAttemptsMeta");
const analyticsTopicsMastered = document.getElementById("analyticsTopicsMastered");
const analyticsMasteryRatioMeta = document.getElementById("analyticsMasteryRatioMeta");
const analyticsRevCompletion = document.getElementById("analyticsRevCompletion");
const analyticsActiveRevsMeta = document.getElementById("analyticsActiveRevsMeta");

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
    const overviewRes = await apiFetch("/api/analytics/overview");
    if (overviewRes.ok && overviewRes.data.data) {
      const d = overviewRes.data.data;

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
    const insightsRes = await apiFetch("/api/analytics/insights");
    if (analyticsInsightsContainer) {
      if (insightsRes.ok && Array.isArray(insightsRes.data.data) && insightsRes.data.data.length > 0) {
        analyticsInsightsContainer.innerHTML = insightsRes.data.data
          .map((ins) => {
            const severityClass = ins.severity === "positive" ? "insight-positive" : ins.severity === "warning" ? "insight-warning" : "insight-info";
            const icon = ins.severity === "positive" ? "🌟" : ins.severity === "warning" ? "⚠️" : "💡";

            return `
              <div class="insight-card ${severityClass}">
                <div class="insight-header">
                  <span aria-hidden="true">${icon}</span>
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
    const trendRes = await apiFetch("/api/analytics/recall-trend");
    if (recallTrendContainer) {
      if (trendRes.ok && Array.isArray(trendRes.data.data) && trendRes.data.data.length > 0) {
        recallTrendContainer.innerHTML = trendRes.data.data
          .map((item) => {
            const heightPct = Math.max(10, Math.min(100, item.average_score));
            const fillClass = item.average_score >= 80 ? "fill-high" : item.average_score >= 60 ? "fill-medium" : "fill-low";
            const formattedDate = new Date(item.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

            return `
              <div class="trend-bar-group" title="${item.date}: ${item.average_score}% avg (${item.attempts_count} attempt${item.attempts_count === 1 ? '' : 's'})" tabindex="0" aria-label="${item.date}: ${item.average_score}% average score">
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
        recallTrendContainer.innerHTML = `
          <div class="empty-state" style="width: 100%;">
            <span class="empty-state-icon" aria-hidden="true">📈</span>
            <p class="empty-state-text">Complete active recall sessions to visualize your memory trend over time.</p>
          </div>
        `;
      }
    }

    // 4. Subject-Wise Mastery Breakdown
    const subjRes = await apiFetch("/api/analytics/subjects");
    if (subjectsAnalyticsList) {
      if (subjRes.ok && Array.isArray(subjRes.data.data) && subjRes.data.data.length > 0) {
        subjectsAnalyticsList.innerHTML = subjRes.data.data
          .map((s) => `
            <div class="subject-stat-card">
              <div class="subject-stat-top">
                <span class="subject-stat-title">${escapeHtml(s.subject)}</span>
                <span class="level-pill level-${levelToCssClass(s.mastery_level)}">${s.mastery_percentage}% (${s.mastery_level})</span>
              </div>
              <div class="progress-bar" role="progressbar" aria-valuenow="${s.mastery_percentage}" aria-valuemin="0" aria-valuemax="100">
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
    const topicsRes = await apiFetch("/api/analytics/topics");
    if (topicMasteryTbody) {
      if (topicsRes.ok && Array.isArray(topicsRes.data.data) && topicsRes.data.data.length > 0) {
        topicMasteryTbody.innerHTML = topicsRes.data.data
          .map((t) => {
            const latestDisplay = t.latest_score !== null ? `${t.latest_score}%` : "--";
            const avgDisplay = t.average_score !== null ? `${t.average_score}%` : "--";
            const revStatus = t.pending_revisions > 0
              ? `<span class="urgency-badge urgency-due-today">Pending</span>`
              : `<span class="urgency-badge urgency-upcoming">Up to date</span>`;

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
    const historyRes = await apiFetch("/api/recall/history");
    if (allHistoryTbody) {
      if (historyRes.ok && Array.isArray(historyRes.data.data) && historyRes.data.data.length > 0) {
        allHistoryTbody.innerHTML = historyRes.data.data
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
async function initializeDashboardData() {
  await renderAllTasks();
  await loadTopicsForRecall();
  await loadRevisionQueue();
}

// Check authentication state and route on page load
verifyAuthOrPrompt().then((isAuthenticated) => {
  if (isAuthenticated) {
    initializeDashboardData();
    const hash = window.location.hash.replace("#", "");
    if (hash && viewPanes[hash]) {
      switchView(hash);
    }
  }
});

