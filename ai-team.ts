import { delay } from "jsr:@std/async";

// AgentIDからdeno task名へのマッピング
const agentTaskMap: Record<string, string> = {
  "task-okinawa": "okinawa",
  "task-decompose": "decompose",
  "task-reporter": "report",
};

// 現在実行中のエージェントを追跡
const runningAgents = new Set<string>();

async function getPendingAgents(): Promise<string[]> {
  const command = new Deno.Command("deno", {
    args: ["task", "kanban", "pending-agents"],
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout } = await command.output();
  const output = new TextDecoder().decode(stdout).trim();
  if (!output || output === "[]") {
    return [];
  }
  try {
    return JSON.parse(output) as string[];
  } catch {
    console.error("パースに失敗:", output);
    return [];
  }
}

async function runAgent(agentId: string): Promise<void> {
  const taskName = agentTaskMap[agentId];
  if (!taskName) {
    console.log(`不明なエージェントID: ${agentId}`);
    return;
  }

  if (runningAgents.has(agentId)) {
    console.log(`${agentId} は既に実行中です`);
    return;
  }

  console.log(`エージェント起動: ${agentId} (deno task ${taskName})`);
  runningAgents.add(agentId);

  try {
    const command = new Deno.Command("deno", {
      args: ["task", taskName],
      stdout: "inherit",
      stderr: "inherit",
    });
    const process = command.spawn();
    await process.status;
  } finally {
    runningAgents.delete(agentId);
  }
}

async function checkAndDispatchAgents(): Promise<void> {
  console.log(`\n[${new Date().toLocaleTimeString()}] タスクチェック中...`);

  const agents = await getPendingAgents();

  if (agents.length === 0) {
    console.log("未完了タスクなし");
    return;
  }

  console.log(`対象エージェント: ${agents.join(", ")}`);

  // 各エージェントを順次起動
  for (const agentId of agents) {
    await runAgent(agentId);
  }
}

// 標準入力を受け取りカンバンツールを操作するエージェント
if (Deno.args.join() !== "") {
  const command = new Deno.Command("deno", {
    args: [
      "task",
      "kanban",
      "add",
      "human",
      "task-decompose",
      Deno.args.join(" "),
    ],
    stdout: "inherit",
    stderr: "inherit",
  });
  const process = command.spawn();
  await process.status;
}

// 1分ごとにタスクをチェックしてエージェントを起動

console.log("AI Team Manager 起動");
console.log("タスクチェック間隔: 0.5分");

// プロセスを継続
while (true) {
  await checkAndDispatchAgents();
  await delay(500);
}
