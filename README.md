# AURA | First-Principles Task Orchestrator

Aura is a minimalist, high-fidelity task planner designed from **first principles** to combat task-management anxiety, eliminate entry friction, and help you focus on what actually matters. 

The application is completely **Dockerised**, featuring a Node.js Express REST API backend and a responsive vanilla CSS/JS glassmorphic frontend.

---

## 🧘 First-Principles Design Decisions

Traditional to-do apps present overwhelming lists, leading to choice paralysis and procrastination. Aura addresses this directly:

1. **Anti-Anxiety Focus Mode (MITs)**:
   * Research shows committing to **1 to 3 Most Important Tasks (MITs)** per day drastically improves completion rates and reduces stress.
   * Aura allows you to commit to a maximum of 3 active tasks in the "Focus Zone."
   * Activating **Focus Mode** dims and blurs the sidebar, lists, and form entries, locking your visual attention purely onto your selected commitments.

2. **Frictionless Natural Language Capture (NLP)**:
   * To prevent entering tasks from feeling like an chore, Aura features a single input field that parses tags and priorities on the fly:
     * Use `#` for tags (e.g. `#work`, `#personal`, `#shopping`).
     * Use `!` for priorities (e.g. `!high`, `!med`, `!low`).
   * *Example*: Typing `Finish presentation slide deck #work !high` will automatically label the task `#work`, classify it as high priority, and name the task "Finish presentation slide deck".

3. **Subtask Checklists**:
   * Large items are broken down. Expand any task to details to reveal a clean, inline subtask checklist that contributes to task progress.

4. **Keyboard-First Interface**:
   * Quick key bindings reduce interaction friction:
     * Press `/` to focus the main task entry field.
     * Press `Esc` to instantly clear focus or exit Focus Mode.

5. **Gamification without Clutter**:
   * Completing tasks triggers an elegant, circular progress indicator and updates a persistent daily completion streak tracker.

---

## 🛠️ Architecture & Tech Stack

* **Frontend**: Pure HTML5, Semantic DOM structure, Vanilla CSS (Modern Grid/Flexbox, Backdrop Blur filters, micro-interactions, responsive mobile configurations), and pure JavaScript. Icon system powered by Lucide SVG icons.
* **Backend**: Lightweight Node.js Express server (`server.js`) serving static files and exposing CRUD API paths.
* **Storage**: Persistent JSON-based database filesystem (`data/todos.json`).
* **Containerisation**: Multi-stage `Dockerfile` (optimized based on `node:20-alpine`) running under a non-root environment `USER node`. Orchestration managed via `docker-compose.yml` with host volume mapping.

---

## 🚀 Running the Application

Ensure you have Docker and Docker Compose installed.

### 1. Build & Spin up the Container
Open your terminal inside the project root and run:
```bash
docker compose up --build
```

### 2. Access the Application
Once the container starts, open your browser and navigate to:
```
http://localhost:3000
```

### 3. Check Persistence
Your tasks are saved inside the local `./data` folder in the project directory as `todos.json`. This folder is mounted into the container as a volume, meaning **your tasks will survive container builds, stops, and restarts**.

---

## ⌨️ Shortcuts & Input Syntax

| Trigger | Description | Example |
| :--- | :--- | :--- |
| <kbd>/</kbd> | Focuses task input bar | Pressing `/` sets cursor in input. |
| <kbd>Esc</kbd> | Closes focus layouts or blurs inputs | Resets the UI back to standard view. |
| `#tag-name` | Assigns category tags | `#work`, `#personal`, `#health` |
| `!priority-value` | Sets importance category | `!high`, `!med`, `!low` |
