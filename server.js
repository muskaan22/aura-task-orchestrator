const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Data file path
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'todos.json');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial default tasks representing first-principles features
const defaultTodos = [
  {
    id: "1",
    title: "Drag or click 'Focus' to add this to 'Today's Focus'",
    priority: "high",
    tags: ["feature"],
    completed: false,
    focus: true,
    notes: "Focus Mode lets you isolate 1-3 Most Important Tasks (MITs) to eliminate distraction and lower anxiety.",
    subtasks: [
      { id: "sub1-1", title: "Click the target icon on a task", completed: false },
      { id: "sub1-2", title: "Complete this task in Focus Mode", completed: false }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: "2",
    title: "Press '/' on keyboard to instantly focus the input box",
    priority: "medium",
    tags: ["shortcut"],
    completed: false,
    focus: false,
    notes: "Pressing 'Esc' will unfocus the input. Keyboard efficiency reduces friction.",
    subtasks: [],
    createdAt: new Date().toISOString()
  },
  {
    id: "3",
    title: "Try typing '#work !high Prepare project slides'",
    priority: "high",
    tags: ["tip"],
    completed: false,
    focus: false,
    notes: "Our smart parser detects '#' for tags and '!' for priorities on the fly.",
    subtasks: [],
    createdAt: new Date().toISOString()
  },
  {
    id: "4",
    title: "Check off this tutorial task to see your progress update",
    priority: "low",
    tags: ["tutorial"],
    completed: true,
    focus: false,
    notes: "Completing tasks updates the visual progress gauge and strengthens your streak.",
    subtasks: [],
    createdAt: new Date().toISOString()
  }
];

// Helper to read todos
function readTodos() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultTodos, null, 2));
      return defaultTodos;
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading todos file, resetting to defaults:', err);
    return defaultTodos;
  }
}

// Helper to write todos
function writeTodos(todos) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(todos, null, 2));
  } catch (err) {
    console.error('Error writing todos file:', err);
  }
}

// REST API routes

// GET: Fetch all todos
app.get('/api/todos', (req, res) => {
  res.json(readTodos());
});

// POST: Add a new todo
app.post('/api/todos', (req, res) => {
  const todos = readTodos();
  const newTodo = {
    id: Date.now().toString(),
    title: req.body.title || 'Untitled Task',
    priority: req.body.priority || 'low',
    tags: req.body.tags || [],
    completed: false,
    focus: req.body.focus || false,
    notes: req.body.notes || '',
    subtasks: req.body.subtasks || [],
    createdAt: new Date().toISOString()
  };
  todos.push(newTodo);
  writeTodos(todos);
  res.status(201).json(newTodo);
});

// PUT: Update an existing todo
app.put('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  const todos = readTodos();
  const todoIndex = todos.findIndex(t => t.id === id);

  if (todoIndex === -1) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  // Update fields
  const updatedTodo = {
    ...todos[todoIndex],
    ...req.body,
    id: todos[todoIndex].id // Protect ID
  };

  todos[todoIndex] = updatedTodo;
  writeTodos(todos);
  res.json(updatedTodo);
});

// DELETE: Remove a todo
app.delete('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  let todos = readTodos();
  const todoIndex = todos.findIndex(t => t.id === id);

  if (todoIndex === -1) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  todos = todos.filter(t => t.id !== id);
  writeTodos(todos);
  res.json({ success: true, message: `Task ${id} deleted successfully.` });
});

// Serve frontend SPA index for any unrecognized routes (client-side routing fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start listening
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`First-Principles Todo Server running on port ${PORT}`);
  console.log(`Serving static files from /public`);
  console.log(`Database persisting to /data/todos.json`);
  console.log(`===================================================`);
});
