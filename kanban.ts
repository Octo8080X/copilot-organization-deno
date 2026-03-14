import { Database } from "@db/sqlite";

const DB_PATH = "./kanban.db";

interface Task {
  id: number;
  requester: string;
  assignee: string;
  content: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

function initDatabase(): Database {
  const db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester TEXT NOT NULL,
      assignee TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      completed_at TEXT
    )
  `);
  // Migration: add status and completed_at columns if they don't exist
  try {
    db.exec(`ALTER TABLE tasks ADD COLUMN status TEXT DEFAULT 'pending'`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE tasks ADD COLUMN completed_at TEXT`);
  } catch { /* column already exists */ }
  return db;
}

function addTask(
  db: Database,
  requester: string,
  assignee: string,
  content: string,
): void {
  const stmt = db.prepare(
    "INSERT INTO tasks (requester, assignee, content) VALUES (?, ?, ?)",
  );
  stmt.run(requester, assignee, content);
  console.log(`Task added: ${requester} -> ${assignee}: ${content}`);
}

function listTasksByAgent(db: Database, agentId: string): void {
  const stmt = db.prepare(
    "SELECT * FROM tasks WHERE requester = ? OR assignee = ? ORDER BY created_at DESC",
  );
  const tasks = stmt.all(agentId, agentId) as Task[];

  if (tasks.length === 0) {
    console.log(`No tasks found for agent: ${agentId}`);
    return;
  }

  console.log(`\nTasks for agent: ${agentId}`);
  console.log("=".repeat(60));
  for (const task of tasks) {
    const statusIcon = task.status === "completed" ? "✓" : "○";
    console.log(
      `[${task.id}] ${statusIcon} ${task.requester} -> ${task.assignee}`,
    );
    console.log(`    Content: ${task.content}`);
    console.log(`    Status:  ${task.status}`);
    console.log(`    Created: ${task.created_at}`);
    if (task.completed_at) {
      console.log(`    Completed: ${task.completed_at}`);
    }
    console.log("-".repeat(60));
  }
}

function listPendingTasksForAgent(db: Database, agentId: string): void {
  const stmt = db.prepare(
    "SELECT * FROM tasks WHERE assignee = ? AND status = 'pending' ORDER BY created_at ASC",
  );
  const tasks = stmt.all(agentId) as Task[];

  if (tasks.length === 0) {
    console.log(`No pending tasks for agent: ${agentId}`);
    return;
  }

  console.log(`\nPending tasks for agent: ${agentId}`);
  console.log(`Total: ${tasks.length} task(s)`);
  console.log("=".repeat(60));
  for (const task of tasks) {
    console.log(`[${task.id}] ${task.requester} -> ${task.assignee}`);
    console.log(`    Content: ${task.content}`);
    console.log(`    Created: ${task.created_at}`);
    console.log("-".repeat(60));
  }
}

function listAllPendingTasksJson(db: Database): void {
  const stmt = db.prepare(
    "SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at ASC",
  );
  const tasks = stmt.all() as Task[];
  console.log(JSON.stringify(tasks));
}

function listPendingAgents(db: Database): void {
  const stmt = db.prepare(
    "SELECT DISTINCT assignee FROM tasks WHERE status = 'pending'",
  );
  const rows = stmt.all() as { assignee: string }[];
  const agents = rows.map((r) => r.assignee);
  console.log(JSON.stringify(agents));
}

function getTask(db: Database, taskId: number): void {
  const stmt = db.prepare("SELECT * FROM tasks WHERE id = ?");
  const task = stmt.get(taskId) as Task | undefined;

  if (!task) {
    console.log(`Task not found: ${taskId}`);
    return;
  }

  const statusIcon = task.status === "completed" ? "✓" : "○";
  console.log(`\nTask #${task.id} ${statusIcon}`);
  console.log("=".repeat(40));
  console.log(`Requester: ${task.requester}`);
  console.log(`Assignee:  ${task.assignee}`);
  console.log(`Content:   ${task.content}`);
  console.log(`Status:    ${task.status}`);
  console.log(`Created:   ${task.created_at}`);
  if (task.completed_at) {
    console.log(`Completed: ${task.completed_at}`);
  }
}

function completeTask(db: Database, taskId: number): void {
  const stmt = db.prepare("SELECT * FROM tasks WHERE id = ?");
  const task = stmt.get(taskId) as Task | undefined;

  if (!task) {
    console.log(`Task not found: ${taskId}`);
    return;
  }

  if (task.status === "completed") {
    console.log(`Task #${taskId} is already completed`);
    return;
  }

  const updateStmt = db.prepare(
    "UPDATE tasks SET status = 'completed', completed_at = datetime('now', 'localtime') WHERE id = ?",
  );
  updateStmt.run(taskId);
  console.log(`Task #${taskId} marked as completed`);
}

function showHelp(): void {
  console.log(`
Kanban Tool - AI Agent Task Management

Usage:
  deno task kanban <command> [arguments]

Commands:
  add <requester> <assignee> <content>  Add a new task
  list <agentId>                        List all tasks for an agent
  pending <agentId>                     List pending tasks assigned to an agent
  pending-all                           List all pending tasks as JSON
  pending-agents                        List agents with pending tasks as JSON
  get <taskId>                          Get task details by ID
  complete <taskId>                     Mark a task as completed
  help                                  Show this help message

Examples:
  deno task kanban add "Agent-A" "Agent-B" "Investigate API"
  deno task kanban list "Agent-A"
  deno task kanban pending "Agent-A"
  deno task kanban pending-all
  deno task kanban get 1
  deno task kanban complete 1
`);
}

function main(): void {
  const [command, ...args] = Deno.args;

  if (!command || command === "help") {
    showHelp();
    return;
  }

  const db = initDatabase();

  try {
    switch (command) {
      case "add": {
        if (args.length < 3) {
          console.error("Usage: kanban add <requester> <assignee> <content>");
          Deno.exit(1);
        }
        const [requester, assignee, content] = args;
        addTask(db, requester, assignee, content);
        break;
      }
      case "list": {
        if (args.length < 1) {
          console.error("Usage: kanban list <agentId>");
          Deno.exit(1);
        }
        const [agentId] = args;
        listTasksByAgent(db, agentId);
        break;
      }
      case "pending": {
        if (args.length < 1) {
          console.error("Usage: kanban pending <agentId>");
          Deno.exit(1);
        }
        const [agentId] = args;
        listPendingTasksForAgent(db, agentId);
        break;
      }
      case "pending-all": {
        listAllPendingTasksJson(db);
        break;
      }
      case "pending-agents": {
        listPendingAgents(db);
        break;
      }
      case "get": {
        if (args.length < 1) {
          console.error("Usage: kanban get <taskId>");
          Deno.exit(1);
        }
        const taskId = parseInt(args[0], 10);
        if (isNaN(taskId)) {
          console.error("Task ID must be a number");
          Deno.exit(1);
        }
        getTask(db, taskId);
        break;
      }
      case "complete": {
        if (args.length < 1) {
          console.error("Usage: kanban complete <taskId>");
          Deno.exit(1);
        }
        const taskId = parseInt(args[0], 10);
        if (isNaN(taskId)) {
          console.error("Task ID must be a number");
          Deno.exit(1);
        }
        completeTask(db, taskId);
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        Deno.exit(1);
    }
  } finally {
    db.close();
  }
}

main();
