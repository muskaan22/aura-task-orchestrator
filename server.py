import os
import json
import time
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 3000
DATA_DIR = os.path.join(os.getcwd(), 'data')
DATA_FILE = os.path.join(DATA_DIR, 'todos.json')
PUBLIC_DIR = os.path.join(os.getcwd(), 'public')

# Ensure directories exist
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# Default tutorial tasks
default_todos = [
  {
    "id": "1",
    "title": "Drag or click 'Focus' to add this to 'Today's Focus'",
    "priority": "high",
    "tags": ["feature"],
    "completed": False,
    "focus": True,
    "notes": "Focus Mode lets you isolate 1-3 Most Important Tasks (MITs) to eliminate distraction and lower anxiety.",
    "subtasks": [
      { "id": "sub1-1", "title": "Click the target icon on a task", "completed": False },
      { "id": "sub1-2", "title": "Complete this task in Focus Mode", "completed": False }
    ],
    "createdAt": datetime.utcnow().isoformat() + 'Z'
  },
  {
    "id": "2",
    "title": "Press '/' on keyboard to instantly focus the input box",
    "priority": "medium",
    "tags": ["shortcut"],
    "completed": False,
    "focus": False,
    "notes": "Pressing 'Esc' will unfocus the input. Keyboard efficiency reduces friction.",
    "subtasks": [],
    "createdAt": datetime.utcnow().isoformat() + 'Z'
  },
  {
    "id": "3",
    "title": "Try typing '#work !high Prepare project slides'",
    "priority": "high",
    "tags": ["tip"],
    "completed": False,
    "focus": False,
    "notes": "Our smart parser detects '#' for tags and '!' for priorities on the fly.",
    "subtasks": [],
    "createdAt": datetime.utcnow().isoformat() + 'Z'
  },
  {
    "id": "4",
    "title": "Check off this tutorial task to see your progress update",
    "priority": "low",
    "tags": ["tutorial"],
    "completed": True,
    "focus": False,
    "notes": "Completing tasks updates the visual progress gauge and strengthens your streak.",
    "subtasks": [],
    "createdAt": datetime.utcnow().isoformat() + 'Z'
  }
]

def read_todos():
    try:
        if not os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'w') as f:
                json.dump(default_todos, f, indent=2)
            return default_todos
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading file: {e}")
        return default_todos

def write_todos(todos):
    try:
        with open(DATA_FILE, 'w') as f:
            json.dump(todos, f, indent=2)
    except Exception as e:
        print(f"Error writing file: {e}")

class TodoHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # If API endpoint, don't translate to files
        if path.startswith('/api'):
            return path
        
        # Strip query parameters/anchors
        clean_path = path.split('?')[0].split('#')[0]
        if clean_path == '/':
            clean_path = '/index.html'
            
        relative_path = clean_path.lstrip('/')
        return os.path.join(PUBLIC_DIR, relative_path)

    def do_GET(self):
        if self.path == '/api/todos':
            todos = read_todos()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(todos).encode('utf-8'))
        else:
            # Serve files from /public using standard HTTP request handler
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/todos':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            todos = read_todos()
            new_todo = {
                "id": str(int(time.time() * 1000)),
                "title": data.get("title", "Untitled Task"),
                "priority": data.get("priority", "low"),
                "tags": data.get("tags", []),
                "completed": False,
                "focus": data.get("focus", False),
                "notes": data.get("notes", ""),
                "subtasks": data.get("subtasks", []),
                "createdAt": datetime.utcnow().isoformat() + 'Z'
            }
            todos.append(new_todo)
            write_todos(todos)

            self.send_response(201)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(new_todo).encode('utf-8'))
        else:
            self.send_error(404, "Endpoint not found")

    def do_PUT(self):
        if self.path.startswith('/api/todos/'):
            todo_id = self.path.split('/')[-1]
            content_length = int(self.headers['Content-Length'])
            put_data = self.rfile.read(content_length)
            data = json.loads(put_data.decode('utf-8'))

            todos = read_todos()
            todo_index = -1
            for idx, t in enumerate(todos):
                if t['id'] == todo_id:
                    todo_index = idx
                    break

            if todo_index == -1:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Todo not found"}).encode('utf-8'))
                return

            # Update fields
            updated_todo = todos[todo_index].copy()
            for key, val in data.items():
                if key != 'id':  # Protect ID
                    updated_todo[key] = val

            todos[todo_index] = updated_todo
            write_todos(todos)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(updated_todo).encode('utf-8'))
        else:
            self.send_error(404, "Endpoint not found")

    def do_DELETE(self):
        if self.path.startswith('/api/todos/'):
            todo_id = self.path.split('/')[-1]
            todos = read_todos()
            
            todo_exists = False
            for t in todos:
                if t['id'] == todo_id:
                    todo_exists = True
                    break

            if not todo_exists:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Todo not found"}).encode('utf-8'))
                return

            todos = [t for t in todos if t['id'] != todo_id]
            write_todos(todos)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": f"Task {todo_id} deleted."}).encode('utf-8'))
        else:
            self.send_error(404, "Endpoint not found")

    def do_OPTIONS(self):
        # Support CORS preflight requests
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def run_server():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, TodoHandler)
    print(f"===================================================")
    print(f"First-Principles Todo Server running on http://localhost:{PORT}")
    print(f"Python standard library server (No node/docker required)")
    print(f"Serving static files from /public")
    print(f"Database persisting to /data/todos.json")
    print(f"===================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
