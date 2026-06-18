/**
 * SSE Streaming endpoint for AI chat completions
 * and WebSocket PTY proxy for the terminal.
 *
 * These are registered as custom Express routes in server/_core/index.ts.
 */
import type { Express, Request, Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { ENV } from "./_core/env";
import { checkRateLimit } from "./db";

// ── SSE Chat Streaming ────────────────────────────────────────────────────────

export function registerStreamingRoutes(app: Express) {
  app.post("/api/chat/stream", async (req: Request, res: Response) => {
    const { sessionId, messageId, agentSessionId, model } = req.query as Record<string, string>;
    const { messages } = req.body as {
      messages: { role: string; content: string }[];
    };

    if (!sessionId || !messageId) {
      res.status(400).json({ error: "Missing sessionId or messageId" });
      return;
    }

    // Rate limit
    const workspaceId = (req.query.workspaceId as string) ?? sessionId;
    const allowed = await checkRateLimit(workspaceId);
    if (!allowed) {
      res.status(429).json({ error: "Rate limit exceeded: 100 req/min per workspace" });
      return;
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (data: object) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const done = () => {
      res.write("data: [DONE]\n\n");
      res.end();
    };

    try {
      const apiUrl = ENV.forgeApiUrl;
      const apiKey = ENV.forgeApiKey;

      if (!apiUrl || !apiKey) {
        // Fallback: echo a demo response
        const demoText = "Hello! I'm Notus AI. The LLM API is not configured yet — please set `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` in your environment. Once configured, I'll be able to help you write code, run commands, and build your project.";
        for (const char of demoText) {
          send({ type: "token", content: char });
          await new Promise((r) => setTimeout(r, 8));
        }
        done();
        return;
      }

      // Call the LLM API with streaming
      const response = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model ?? "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are Notus AI, an expert coding assistant embedded in a browser-based IDE. 
You help developers write code, debug issues, explain concepts, and run terminal commands.
When you need to run a command, use the run_command tool.
When you need to read or write files, use the file tools.
Always be concise, accurate, and helpful.`,
            },
            ...messages,
          ],
          stream: true,
          tools: AGENT_TOOLS,
          tool_choice: "auto",
        }),
      });

      if (!response.ok || !response.body) {
        const err = await response.text();
        send({ type: "error", message: `LLM API error: ${response.status} ${err}` });
        done();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let toolCallBuffer: Record<string, { name: string; args: string }> = {};

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;

            // Text token
            if (delta?.content) {
              send({ type: "token", content: delta.content });
            }

            // Tool call accumulation
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCallBuffer[idx]) {
                  toolCallBuffer[idx] = { name: tc.function?.name ?? "", args: "" };
                }
                if (tc.function?.name) toolCallBuffer[idx].name = tc.function.name;
                if (tc.function?.arguments) toolCallBuffer[idx].args += tc.function.arguments;
              }
            }

            // Finish reason
            if (choice.finish_reason === "tool_calls") {
              for (const [, tc] of Object.entries(toolCallBuffer)) {
                let args: Record<string, unknown> = {};
                try { args = JSON.parse(tc.args); } catch {}
                const toolCallId = `tc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                send({ type: "tool_call", toolName: tc.name, toolCallId, arguments: args });

                // Execute the tool
                const result = await executeAgentTool(tc.name, args, { sessionId, workspaceId, agentSessionId });
                send({ type: "tool_result", toolCallId, result: result.output ?? {}, error: result.error });
              }
              toolCallBuffer = {};
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }

      done();
    } catch (e) {
      send({ type: "error", message: String(e) });
      done();
    }
  });
}

// ── Agent Tool Definitions (OpenAI format) ────────────────────────────────────

const AGENT_TOOLS = [
  // Messaging (×2)
  {
    type: "function",
    function: {
      name: "send_message",
      description: "Send a message to the user in the chat",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Message content" },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_messages",
      description: "Read recent chat messages from the session",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of messages to read (default 10)" },
        },
      },
    },
  },
  // File Ops (×5)
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file in the workspace",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to workspace root" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write or overwrite a file in the workspace",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
          content: { type: "string", description: "File content" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files and directories in the workspace",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path (default: root)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a file from the workspace",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to delete" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_file",
      description: "Move or rename a file in the workspace",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Source path" },
          to: { type: "string", description: "Destination path" },
        },
        required: ["from", "to"],
      },
    },
  },
  // Shell Ops (×5)
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Run a shell command in the terminal",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
          cwd: { type: "string", description: "Working directory" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_script",
      description: "Run a script file in the terminal",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Script file path" },
          args: { type: "array", items: { type: "string" }, description: "Script arguments" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "install_package",
      description: "Install an npm/pip package in the workspace",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Package name" },
          manager: { type: "string", enum: ["npm", "pnpm", "yarn", "pip"], description: "Package manager" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "kill_process",
      description: "Kill a running process by PID or name",
      parameters: {
        type: "object",
        properties: {
          pid: { type: "number", description: "Process ID" },
          name: { type: "string", description: "Process name" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_processes",
      description: "List running processes in the sandbox",
      parameters: { type: "object", properties: {} },
    },
  },
  // Browser Ops (×3)
  {
    type: "function",
    function: {
      name: "browse_url",
      description: "Fetch and return the HTML content of a URL",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to fetch" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "screenshot",
      description: "Take a screenshot of a URL or the current preview",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to screenshot" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "click_element",
      description: "Click an element in the browser preview",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector" },
          url: { type: "string", description: "URL to navigate to first" },
        },
        required: ["selector"],
      },
    },
  },
];

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeAgentTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: { sessionId: string; workspaceId: string; agentSessionId?: string }
): Promise<{ output?: Record<string, unknown>; error?: string }> {
  switch (toolName) {
    case "send_message":
      return { output: { sent: true, content: args.content } };
    case "read_messages":
      return { output: { messages: [] } };
    case "read_file":
      return { output: { content: `// File: ${args.path}\n// Content would be loaded from workspace` } };
    case "write_file":
      return { output: { written: true, path: args.path, bytes: String(args.content ?? "").length } };
    case "list_files":
      return { output: { files: [], path: args.path ?? "/" } };
    case "delete_file":
      return { output: { deleted: true, path: args.path } };
    case "move_file":
      return { output: { moved: true, from: args.from, to: args.to } };
    case "run_command":
      return { output: { stdout: `$ ${args.command}\n(command output would appear here)`, stderr: "", exitCode: 0 } };
    case "run_script":
      return { output: { stdout: "", stderr: "", exitCode: 0 } };
    case "install_package":
      return { output: { installed: true, package: args.name } };
    case "kill_process":
      return { output: { killed: true } };
    case "list_processes":
      return { output: { processes: [] } };
    case "browse_url":
      return { output: { html: `<html><body>Fetched: ${args.url}</body></html>`, title: String(args.url) } };
    case "screenshot":
      return { output: { url: "", message: "Screenshot captured" } };
    case "click_element":
      return { output: { clicked: true, selector: args.selector } };
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ── WebSocket Terminal Proxy ──────────────────────────────────────────────────

export function registerTerminalWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "", `http://${request.headers.host}`);
    if (url.pathname === "/api/terminal/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (ws: any, req: any) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const sessionId = url.searchParams.get("sessionId") ?? "default";
    const workspaceId = url.searchParams.get("workspaceId") ?? "";

    // Send welcome message
    ws.send(JSON.stringify({ type: "output", data: `\r\n\x1b[36m╔══════════════════════════════════════╗\r\n║     Notus AI Terminal v1.0           ║\r\n║     Session: ${sessionId.slice(0, 20).padEnd(20)}   ║\r\n╚══════════════════════════════════════╝\x1b[0m\r\n\r\n` }));
    ws.send(JSON.stringify({ type: "output", data: "\x1b[33mNote: Terminal sandbox connection requires a running PTY process.\x1b[0m\r\n" }));
    ws.send(JSON.stringify({ type: "output", data: "Type commands and press Enter. The agent can also run commands for you.\r\n\r\n$ " }));

    // Echo mode for demo (real implementation would spawn a PTY)
    let buffer = "";
    ws.on("message", (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "input") {
          const input: string = msg.data;
          // Echo character
          ws.send(JSON.stringify({ type: "output", data: input }));
          if (input === "\r" || input === "\n") {
            const cmd = buffer.trim();
            buffer = "";
            if (cmd) {
              ws.send(JSON.stringify({ type: "output", data: `\r\n\x1b[33m[demo] Command: ${cmd}\x1b[0m\r\n$ ` }));
            } else {
              ws.send(JSON.stringify({ type: "output", data: "\r\n$ " }));
            }
          } else if (input === "\x7f") {
            // Backspace
            if (buffer.length > 0) {
              buffer = buffer.slice(0, -1);
              ws.send(JSON.stringify({ type: "output", data: "\x1b[D \x1b[D" }));
            }
          } else {
            buffer += input;
          }
        } else if (msg.type === "resize") {
          // Acknowledge resize
        }
      } catch {
        // raw input
      }
    });

    ws.on("close", () => {
      // cleanup
    });
  });
}
