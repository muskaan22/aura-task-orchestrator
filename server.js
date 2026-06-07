const express = require('express');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store (Vercel serverless = stateless; persistence handled by client localStorage)
let todos = [
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

// GET: Fetch all todos
app.get('/api/todos', (req, res) => {
  res.json(todos);
});

// POST: Add a new todo
app.post('/api/todos', (req, res) => {
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
  res.status(201).json(newTodo);
});

// PUT: Update an existing todo
app.put('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  const todoIndex = todos.findIndex(t => t.id === id);

  if (todoIndex === -1) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  todos[todoIndex] = {
    ...todos[todoIndex],
    ...req.body,
    id: todos[todoIndex].id // protect ID
  };

  res.json(todos[todoIndex]);
});

// DELETE: Remove a todo
app.delete('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  const todoIndex = todos.findIndex(t => t.id === id);

  if (todoIndex === -1) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  todos = todos.filter(t => t.id !== id);
  res.json({ success: true, message: `Task ${id} deleted successfully.` });
});

// Serve SPA index fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export for Vercel (do NOT call app.listen here)
module.exports = app;

// Run locally if executed directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`AURA server running on http://localhost:${PORT}`);
  });
}
