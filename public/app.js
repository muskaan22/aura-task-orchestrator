// State Management
let todos = [];
let activeFilter = 'all'; // 'all', 'active', 'completed', 'focus'
let selectedTag = null; // Filter by specific tag
let searchPhrase = '';
let currentSort = 'created-desc';

// Elements Cache
const todoListContainer = document.getElementById('todo-list-container');
const addTaskForm = document.getElementById('add-task-form');
const newTaskInput = document.getElementById('new-task-input');
const focusZone = document.getElementById('focus-zone');
const focusSlotsWrapper = document.getElementById('focus-slots-wrapper');
const focusActiveCount = document.getElementById('focus-active-count');
const toggleFocusModeBtn = document.getElementById('toggle-focus-mode-btn');

// Count badges
const countAll = document.getElementById('count-all');
const countActive = document.getElementById('count-active');
const countCompleted = document.getElementById('count-completed');
const countFocus = document.getElementById('count-focus');

// Analytics elements
const progressCircle = document.getElementById('progress-circle');
const progressPercent = document.getElementById('progress-percent');
const completedCountEl = document.getElementById('completed-count');
const streakCountEl = document.getElementById('streak-count');

// Navigation Filters
const filters = {
  all: document.getElementById('filter-all'),
  active: document.getElementById('filter-active'),
  completed: document.getElementById('filter-completed'),
  focus: document.getElementById('filter-focus')
};

// Search & Sort Inputs
const searchInput = document.getElementById('search-tasks-input');
const sortSelect = document.getElementById('sort-tasks-select');
const listTitle = document.getElementById('list-title');
const tagsContainer = document.getElementById('tags-container');

// SVG Dash offset constants
const CIRCLE_RADIUS = 50;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS; // ~314.16

// ----------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadStreak();
  fetchTodos();
});

// ----------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------

function setupEventListeners() {
  // Add task form submission
  addTaskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAddTask();
  });

  // Sidebar Filter buttons
  Object.keys(filters).forEach(key => {
    filters[key].addEventListener('click', () => {
      setFilter(key);
    });
  });

  // Search input typing
  searchInput.addEventListener('input', (e) => {
    searchPhrase = e.target.value.toLowerCase().trim();
    render();
  });

  // Sorting selection
  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    render();
  });

  // Toggle Focus Mode Layout (Anti-Anxiety screen zoom)
  toggleFocusModeBtn.addEventListener('click', toggleFocusLayout);

  // Keyboard Shortcuts: '/' to focus input, 'Esc' to exit Focus Mode
  document.addEventListener('keydown', (e) => {
    // If typing in any input field or textarea, do not trigger shortcuts
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') {
        e.target.blur(); // Blur current input
      }
      return;
    }

    if (e.key === '/') {
      e.preventDefault();
      newTaskInput.focus();
    } else if (e.key === 'Escape') {
      if (document.body.classList.contains('focus-layout-active')) {
        toggleFocusLayout();
      }
    }
  });
}

// ----------------------------------------------------
// API REQUESTS & SYNCING
// ----------------------------------------------------

async function fetchTodos() {
  try {
    const response = await fetch('/api/todos');
    if (!response.ok) throw new Error('Failed to fetch tasks.');
    todos = await response.json();
    updateAnalytics();
    render();
  } catch (error) {
    showToast(`Error: ${error.message}`, true);
  }
}

async function handleAddTask() {
  const rawText = newTaskInput.value.trim();
  if (!rawText) return;

  // First Principle NLP Parser
  const { title, tags, priority } = parseTaskNLP(rawText);

  try {
    const response = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, tags, priority })
    });
    
    if (!response.ok) throw new Error('Failed to add task.');
    const newTodo = await response.json();
    todos.push(newTodo);
    
    // Clear Input
    newTaskInput.value = '';
    
    showToast(`Task added: "${newTodo.title}"`);
    updateAnalytics();
    render();
  } catch (error) {
    showToast(`Error: ${error.message}`, true);
  }
}

async function toggleTodoCompleted(id) {
  const todoIndex = todos.findIndex(t => t.id === id);
  if (todoIndex === -1) return;

  const currentStatus = todos[todoIndex].completed;
  const newStatus = !currentStatus;
  
  // Update UI optimistically
  todos[todoIndex].completed = newStatus;
  
  // Play satisfaction metrics
  if (newStatus) {
    showToast('Task completed! Focus maintained.');
    incrementStreakIfNeeded();
  }
  
  updateAnalytics();
  render();

  try {
    const response = await fetch(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: newStatus })
    });
    
    if (!response.ok) throw new Error('Sync failed.');
    // Keep backend result in state
    todos[todoIndex] = await response.json();
  } catch (error) {
    // Revert on failure
    todos[todoIndex].completed = currentStatus;
    updateAnalytics();
    render();
    showToast(`Sync failed: ${error.message}`, true);
  }
}

async function toggleTodoFocus(id) {
  const todoIndex = todos.findIndex(t => t.id === id);
  if (todoIndex === -1) return;

  const currentFocus = todos[todoIndex].focus;
  
  // First principles rule: Max 3 commitments in focus to lower anxiety!
  if (!currentFocus) {
    const activeFocusCount = todos.filter(t => t.focus && !t.completed).length;
    if (activeFocusCount >= 3) {
      showToast('To prevent anxiety, limit active focus commitments to 3 tasks!', true);
      return;
    }
  }

  const newFocus = !currentFocus;
  todos[todoIndex].focus = newFocus;
  render();

  try {
    const response = await fetch(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ focus: newFocus })
    });
    
    if (!response.ok) throw new Error('Sync failed.');
    todos[todoIndex] = await response.json();
    render();
  } catch (error) {
    todos[todoIndex].focus = currentFocus;
    render();
    showToast(`Sync failed: ${error.message}`, true);
  }
}

async function updateTodoNotes(id, notes) {
  const todoIndex = todos.findIndex(t => t.id === id);
  if (todoIndex === -1) return;

  todos[todoIndex].notes = notes;

  try {
    const response = await fetch(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    });
    
    if (!response.ok) throw new Error('Sync notes failed.');
    showToast('Notes auto-saved');
  } catch (error) {
    showToast('Notes sync failed', true);
  }
}

async function addSubtask(todoId, title) {
  const todoIndex = todos.findIndex(t => t.id === todoId);
  if (todoIndex === -1) return;

  const subtask = {
    id: 'sub-' + Date.now(),
    title: title,
    completed: false
  };

  todos[todoIndex].subtasks.push(subtask);
  render();

  try {
    const response = await fetch(`/api/todos/${todoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtasks: todos[todoIndex].subtasks })
    });
    
    if (!response.ok) throw new Error('Sync failed.');
    todos[todoIndex] = await response.json();
  } catch (error) {
    showToast(`Failed to add subtask: ${error.message}`, true);
  }
}

async function toggleSubtaskCompleted(todoId, subtaskId) {
  const todoIndex = todos.findIndex(t => t.id === todoId);
  if (todoIndex === -1) return;

  const subtasks = todos[todoIndex].subtasks.map(sub => {
    if (sub.id === subtaskId) {
      return { ...sub, completed: !sub.completed };
    }
    return sub;
  });

  todos[todoIndex].subtasks = subtasks;
  render();

  try {
    const response = await fetch(`/api/todos/${todoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtasks })
    });
    
    if (!response.ok) throw new Error('Sync failed.');
    todos[todoIndex] = await response.json();
  } catch (error) {
    showToast(`Subtask state sync failed: ${error.message}`, true);
  }
}

async function deleteSubtask(todoId, subtaskId) {
  const todoIndex = todos.findIndex(t => t.id === todoId);
  if (todoIndex === -1) return;

  const subtasks = todos[todoIndex].subtasks.filter(sub => sub.id !== subtaskId);
  todos[todoIndex].subtasks = subtasks;
  render();

  try {
    const response = await fetch(`/api/todos/${todoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtasks })
    });
    
    if (!response.ok) throw new Error('Sync failed.');
    todos[todoIndex] = await response.json();
  } catch (error) {
    showToast(`Failed to delete subtask: ${error.message}`, true);
  }
}

async function handleDeleteTodo(id) {
  try {
    const response = await fetch(`/api/todos/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Failed to delete task.');
    
    // Remove from state
    todos = todos.filter(t => t.id !== id);
    
    showToast('Task removed from orchestration');
    updateAnalytics();
    render();
  } catch (error) {
    showToast(`Error: ${error.message}`, true);
  }
}

// ----------------------------------------------------
// FIRST-PRINCIPLES NATURAL LANGUAGE PARSER
// ----------------------------------------------------

/**
 * Parses raw text input on the fly.
 * Extends capabilities by isolating '#' for tags, '!' for priorities.
 * E.g., "Review Q3 numbers #work !high" -> { title: "Review Q3 numbers", tags: ["work"], priority: "high" }
 */
function parseTaskNLP(text) {
  const words = text.split(/\s+/);
  const tags = [];
  let priority = 'low';
  const cleanTitleWords = [];

  words.forEach(word => {
    if (word.startsWith('#') && word.length > 1) {
      // Extract tag, remove commas or symbols
      const tag = word.substring(1).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    } else if (word.startsWith('!') && word.length > 1) {
      const pVal = word.substring(1).toLowerCase();
      if (['high', 'med', 'medium', 'low'].includes(pVal)) {
        priority = pVal === 'medium' ? 'medium' : pVal;
      } else {
        // Not a valid priority value, keep as word in title
        cleanTitleWords.push(word);
      }
    } else {
      cleanTitleWords.push(word);
    }
  });

  const title = cleanTitleWords.join(' ').trim();
  return {
    title: title || 'Untitled Task',
    tags,
    priority
  };
}

// ----------------------------------------------------
// UI RENDERING ENGINE
// ----------------------------------------------------

function setFilter(filter) {
  activeFilter = filter;
  selectedTag = null; // Clear tag filter if general filter selected
  
  // Toggle active CSS classes on nav buttons
  Object.keys(filters).forEach(key => {
    if (key === filter) {
      filters[key].classList.add('active');
      filters[key].setAttribute('aria-pressed', 'true');
    } else {
      filters[key].classList.remove('active');
      filters[key].setAttribute('aria-pressed', 'false');
    }
  });

  // Update Main title description
  const filterNames = {
    all: 'All Tasks',
    active: 'Active Tasks',
    completed: 'Completed Tasks',
    focus: 'Today\'s Focus MITs'
  };
  listTitle.textContent = filterNames[filter];
  render();
}

function render() {
  renderSidebarTags();
  renderFocusZone();
  renderTodoList();
  
  // Update badges
  countAll.textContent = todos.length;
  countActive.textContent = todos.filter(t => !t.completed).length;
  countCompleted.textContent = todos.filter(t => t.completed).length;
  countFocus.textContent = todos.filter(t => t.focus && !t.completed).length;
  
  // Setup Lucide icons dynamically rendered
  lucide.createIcons();
}

function renderSidebarTags() {
  // Extract all unique tags
  const tagsMap = {};
  todos.forEach(todo => {
    todo.tags.forEach(tag => {
      tagsMap[tag] = (tagsMap[tag] || 0) + 1;
    });
  });

  tagsContainer.innerHTML = '';
  
  const sortedTags = Object.keys(tagsMap).sort();
  if (sortedTags.length === 0) {
    tagsContainer.innerHTML = `<span class="section-title" style="letter-spacing: normal; font-size: 0.65rem;">No tags defined</span>`;
    return;
  }

  sortedTags.forEach(tag => {
    const count = tagsMap[tag];
    const button = document.createElement('button');
    button.className = `tag-btn ${selectedTag === tag ? 'active' : ''}`;
    button.innerHTML = `
      <span class="tag-dot"></span>
      <span>#${tag}</span>
      <span class="tag-count">${count}</span>
    `;
    
    button.addEventListener('click', () => {
      if (selectedTag === tag) {
        selectedTag = null; // Toggle off
      } else {
        selectedTag = tag;
        activeFilter = 'all'; // Reset filter when clicking specific tag
        Object.keys(filters).forEach(k => filters[k].classList.remove('active'));
        filters.all.classList.add('active');
        listTitle.textContent = `Tag: #${tag}`;
      }
      render();
    });
    
    tagsContainer.appendChild(button);
  });
}

function renderFocusZone() {
  const focusTasks = todos.filter(t => t.focus && !t.completed);
  
  // Update slots count
  focusActiveCount.textContent = focusTasks.length;

  // Clear slots
  // Preserve placeholder if empty
  const placeholder = document.getElementById('focus-empty-placeholder');
  
  // Remove existing cards
  const existingCards = focusSlotsWrapper.querySelectorAll('.focus-card');
  existingCards.forEach(c => c.remove());

  if (focusTasks.length === 0) {
    placeholder.style.display = 'flex';
  } else {
    placeholder.style.display = 'none';
    
    focusTasks.forEach(todo => {
      const card = document.createElement('div');
      card.className = 'focus-card';
      
      const subtaskDone = todo.subtasks.filter(s => s.completed).length;
      const subtaskTotal = todo.subtasks.length;
      const progressText = subtaskTotal > 0 ? `${subtaskDone}/${subtaskTotal} subtasks` : '';

      card.innerHTML = `
        <div class="focus-card-header">
          <button class="checkbox-container" aria-label="Mark task complete">
            <input type="checkbox" ${todo.completed ? 'checked' : ''}>
            <span class="checkmark"></span>
          </button>
          <div class="focus-card-title ${todo.completed ? 'completed' : ''}">${escapeHTML(todo.title)}</div>
        </div>
        <div class="focus-card-footer">
          <span class="focus-card-progress">${progressText}</span>
          <div class="focus-card-actions">
            <button class="focus-card-btn remove-focus" title="Remove from Focus commitments">
              <i data-lucide="target" class="icon-xs"></i>
            </button>
          </div>
        </div>
      `;

      // Event handlers for focus card items
      card.querySelector('input[type="checkbox"]').addEventListener('change', () => {
        // Trigger completion
        toggleTodoCompleted(todo.id);
      });

      card.querySelector('.remove-focus').addEventListener('click', () => {
        toggleTodoFocus(todo.id);
      });

      focusSlotsWrapper.appendChild(card);
    });
  }
}

function renderTodoList() {
  todoListContainer.innerHTML = '';
  
  // Filter todos
  let filtered = todos.filter(todo => {
    // 1. Search phrase filter
    if (searchPhrase) {
      const inTitle = todo.title.toLowerCase().includes(searchPhrase);
      const inTags = todo.tags.some(t => t.toLowerCase().includes(searchPhrase));
      if (!inTitle && !inTags) return false;
    }

    // 2. Nav state filter
    if (selectedTag) {
      return todo.tags.includes(selectedTag);
    }

    if (activeFilter === 'active') return !todo.completed;
    if (activeFilter === 'completed') return todo.completed;
    if (activeFilter === 'focus') return todo.focus && !todo.completed;
    
    return true; // 'all'
  });

  // Sort todos
  filtered.sort((a, b) => {
    if (currentSort === 'created-desc') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    if (currentSort === 'created-asc') {
      return new Date(a.createdAt) - new Date(b.createdAt);
    }
    
    // Priority sort
    const priorityWeights = { high: 3, medium: 2, low: 1 };
    const weightA = priorityWeights[a.priority] || 1;
    const weightB = priorityWeights[b.priority] || 1;
    
    if (currentSort === 'priority-desc') {
      return weightB - weightA;
    }
    if (currentSort === 'priority-asc') {
      return weightA - weightB;
    }
    return 0;
  });

  if (filtered.length === 0) {
    todoListContainer.innerHTML = `
      <div class="focus-slot-placeholder">
        <i data-lucide="inbox" class="placeholder-icon"></i>
        <p>No tasks match the active filters.</p>
        <span>Clear search or check your other categories.</span>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Render cards
  filtered.forEach(todo => {
    const card = document.createElement('div');
    card.id = `todo-${todo.id}`;
    card.className = `todo-card ${todo.completed ? 'completed' : ''} ${todo.focus ? 'in-focus-mode' : ''}`;
    
    // State of expansion check
    const isExpanded = card.dataset.expanded === 'true';

    // Build subtasks completed numbers
    const totalSubtasks = todo.subtasks.length;
    const completedSubtasks = todo.subtasks.filter(s => s.completed).length;
    
    // Build priority markup
    const prioLabel = todo.priority === 'medium' ? 'med' : todo.priority;

    // Generate HTML template
    card.innerHTML = `
      <div class="todo-card-main">
        <label class="checkbox-container">
          <input type="checkbox" id="check-${todo.id}" ${todo.completed ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
        
        <div class="todo-content-wrapper">
          <div class="todo-text-column">
            <span class="todo-title">${escapeHTML(todo.title)}</span>
            <div class="todo-meta">
              <span class="priority-badge ${todo.priority}">${prioLabel}</span>
              ${todo.tags.map(t => `<span class="todo-tag">#${escapeHTML(t)}</span>`).join('')}
              ${totalSubtasks > 0 ? `
                <div class="subtask-count-indicator">
                  <i data-lucide="check-square" class="icon-xxs"></i>
                  <span>${completedSubtasks}/${totalSubtasks}</span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="todo-actions-panel">
          <button class="action-btn toggle-focus ${todo.focus ? 'active' : ''}" title="Commit to focus mode">
            <i data-lucide="target" class="icon-sm"></i>
          </button>
          <button class="action-btn toggle-details" title="Show task notes & subtasks">
            <i data-lucide="chevron-down" class="icon-sm"></i>
          </button>
          <button class="action-btn btn-delete" title="Delete Task">
            <i data-lucide="trash-2" class="icon-sm"></i>
          </button>
        </div>
      </div>
      
      <!-- Hidden expansion panel -->
      <div class="todo-details-panel" style="display: none;">
        <div class="details-grid">
          
          <!-- Notes input -->
          <div class="details-col">
            <span class="details-title-sm">Notes</span>
            <textarea class="todo-notes-textarea" placeholder="Add details or links here... (Auto-saves on leave)">${escapeHTML(todo.notes || '')}</textarea>
          </div>
          
          <!-- Subtasks Checklist -->
          <div class="details-col">
            <span class="details-title-sm">Action Checklist</span>
            <div class="subtasks-container">
              <div class="subtask-list">
                ${todo.subtasks.map(sub => `
                  <div class="subtask-item ${sub.completed ? 'completed' : ''}" data-subtask-id="${sub.id}">
                    <input type="checkbox" class="subtask-checkbox" ${sub.completed ? 'checked' : ''}>
                    <span class="subtask-text">${escapeHTML(sub.title)}</span>
                    <button class="subtask-btn-delete" title="Remove subtask">
                      <i data-lucide="x" class="icon-xxs"></i>
                    </button>
                  </div>
                `).join('')}
              </div>
              
              <!-- Quick Add Subtask input -->
              <form class="add-subtask-form">
                <input type="text" class="subtask-input" placeholder="Add actionable step..." required autocomplete="off">
                <button type="submit" class="subtask-submit-btn">
                  <i data-lucide="plus" class="icon-xs"></i>
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    `;

    // ----------------------------------------------------
    // CARD EVENT BINDINGS
    // ----------------------------------------------------
    
    // Checkbox Complete Click
    card.querySelector(`#check-${todo.id}`).addEventListener('change', () => {
      toggleTodoCompleted(todo.id);
    });

    // Focus Toggle Click
    card.querySelector('.toggle-focus').addEventListener('click', () => {
      toggleTodoFocus(todo.id);
    });

    // Delete Button Click
    card.querySelector('.btn-delete').addEventListener('click', () => {
      handleDeleteTodo(todo.id);
    });

    // Expand details chevron toggle
    const toggleDetailsBtn = card.querySelector('.toggle-details');
    const detailsPanel = card.querySelector('.todo-details-panel');
    
    toggleDetailsBtn.addEventListener('click', () => {
      const isExpanded = detailsPanel.style.display !== 'none';
      if (isExpanded) {
        detailsPanel.style.display = 'none';
        toggleDetailsBtn.classList.remove('expanded');
      } else {
        detailsPanel.style.display = 'block';
        toggleDetailsBtn.classList.add('expanded');
      }
    });

    // Note textarea autosave on blur
    const notesTextarea = card.querySelector('.todo-notes-textarea');
    notesTextarea.addEventListener('blur', (e) => {
      updateTodoNotes(todo.id, e.target.value.trim());
    });

    // Add subtask logic
    const subtaskForm = card.querySelector('.add-subtask-form');
    const subtaskInput = card.querySelector('.subtask-input');
    subtaskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const stTitle = subtaskInput.value.trim();
      if (stTitle) {
        addSubtask(todo.id, stTitle);
        subtaskInput.value = '';
      }
    });

    // Subtask checkboxes & deletion
    const subtaskItems = card.querySelectorAll('.subtask-item');
    subtaskItems.forEach(item => {
      const stId = item.dataset.subtaskId;
      
      // Complete toggle
      item.querySelector('.subtask-checkbox').addEventListener('change', () => {
        toggleSubtaskCompleted(todo.id, stId);
      });
      
      // Delete button
      item.querySelector('.subtask-btn-delete').addEventListener('click', () => {
        deleteSubtask(todo.id, stId);
      });
    });

    todoListContainer.appendChild(card);
  });
}

// ----------------------------------------------------
// SYSTEM METRICS & ANALYTICS
// ----------------------------------------------------

function updateAnalytics() {
  const total = todos.length;
  const completed = todos.filter(t => t.completed).length;
  completedCountEl.textContent = completed;

  let percent = 0;
  if (total > 0) {
    percent = Math.round((completed / total) * 100);
  }
  progressPercent.textContent = `${percent}%`;

  // Draw circular stroke offset
  // Circumference = 314.16. Offset = C - (percent / 100) * C
  const offset = CIRCLE_CIRCUMFERENCE - (percent / 100) * CIRCLE_CIRCUMFERENCE;
  progressCircle.style.strokeDashoffset = offset;
}

// ----------------------------------------------------
// DAILY STREAK MANAGEMENT
// ----------------------------------------------------

function loadStreak() {
  const streakData = JSON.parse(localStorage.getItem('aura-streak-tracker') || '{"count": 0, "lastDate": null}');
  streakCountEl.textContent = streakData.count;
}

function incrementStreakIfNeeded() {
  const todayStr = new Date().toDateString();
  const streakData = JSON.parse(localStorage.getItem('aura-streak-tracker') || '{"count": 0, "lastDate": null}');
  
  if (streakData.lastDate === todayStr) {
    // Already checked off task today, streak is locked
    return;
  }
  
  const lastDate = streakData.lastDate ? new Date(streakData.lastDate) : null;
  const today = new Date();
  
  if (!lastDate) {
    streakData.count = 1;
  } else {
    // Check if yesterday was last active day (streak continues)
    const diffTime = Math.abs(today - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) {
      streakData.count += 1;
    } else {
      streakData.count = 1; // reset streak
    }
  }
  
  streakData.lastDate = todayStr;
  localStorage.setItem('aura-streak-tracker', JSON.stringify(streakData));
  streakCountEl.textContent = streakData.count;
}

// ----------------------------------------------------
// LAYOUT ANXIETY RELIEF MODE
// ----------------------------------------------------

function toggleFocusLayout() {
  const isFocusActive = document.body.classList.toggle('focus-layout-active');
  
  if (isFocusActive) {
    toggleFocusModeBtn.classList.add('active');
    toggleFocusModeBtn.innerHTML = `
      <i data-lucide="eye" class="icon-sm"></i>
      <span>Exit Focus Mode</span>
    `;
    showToast('Focus mode active. Breathing room engaged.');
  } else {
    toggleFocusModeBtn.classList.remove('active');
    toggleFocusModeBtn.innerHTML = `
      <i data-lucide="eye-off" class="icon-sm"></i>
      <span>Focus Mode</span>
    `;
    showToast('Exited focus mode. Workspace restored.');
  }
  lucide.createIcons();
}

// ----------------------------------------------------
// UTILITIES
// ----------------------------------------------------

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  
  toastMsg.textContent = message;
  
  if (isError) {
    toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5), 0 0 20px 2px rgba(244, 63, 94, 0.25)';
  } else {
    toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5), var(--shadow-glow-cyan)';
  }

  toast.classList.remove('hidden');
  
  // Clear existing timeouts if double triggered
  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  
  window.toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Format Greeting and Date
const updateGreetingAndDate = () => {
  const hour = new Date().getHours();
  let greeting = 'Align & Focus';
  if (hour < 12) greeting = 'Focus your mind, good morning';
  else if (hour < 17) greeting = 'Maintain momentum, good afternoon';
  else greeting = 'Review and align, good evening';
  
  document.getElementById('greeting-title').textContent = greeting;

  const options = { weekday: 'long', month: 'short', day: 'numeric' };
  document.getElementById('current-date-str').textContent = new Date().toLocaleDateString('en-US', options);
};

updateGreetingAndDate();
setInterval(updateGreetingAndDate, 60000); // Update every minute
