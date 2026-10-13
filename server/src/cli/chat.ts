import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function getCompletionUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  const path = url.pathname.replace(/\/+$/, "");

  if (!path.endsWith("/chat/completions")) {
    url.pathname = `${path}/chat/completions`;
  }

  return url.toString();
}

function getMessageContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";

  return value
    .map((part: unknown) => {
      if (typeof part !== "object" || part === null || !("text" in part)) {
        return "";
      }
      return typeof part.text === "string" ? part.text : "";
    })
    .join("");
}

async function printJsonCompletion(response: Response): Promise<string> {
  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null || !("choices" in result)) {
    throw new Error("Gateway returned an invalid completion response");
  }

  const choices = result.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("Gateway returned no completion choices");
  }

  const first = choices[0];
  if (typeof first !== "object" || first === null || !("message" in first)) {
    throw new Error("Gateway returned an invalid completion choice");
  }

  const message = first.message;
  if (
    typeof message !== "object" ||
    message === null ||
    !("content" in message)
  ) {
    throw new Error("Gateway returned an invalid assistant message");
  }

  const content = getMessageContent(message.content);
  stdout.write(content);
  return content;
}

async function printStreamedCompletion(response: Response): Promise<string> {
  if (!response.body) {
    throw new Error("Gateway returned an empty response stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventData: string[] = [];
  let assistantMessage = "";

  function consumeEvent(): boolean {
    if (eventData.length === 0) return false;

    const data = eventData.join("\n");
    eventData = [];
    if (data === "[DONE]") return true;

    let event: unknown;
    try {
      event = JSON.parse(data);
    } catch {
      throw new Error("Gateway returned an invalid streaming response");
    }

    if (typeof event !== "object" || event === null || !("choices" in event)) {
      return false;
    }

    const choices = event.choices;
    if (!Array.isArray(choices) || choices.length === 0) return false;

    const first = choices[0];
    if (typeof first !== "object" || first === null || !("delta" in first)) {
      return false;
    }

    const delta = first.delta;
    if (typeof delta !== "object" || delta === null || !("content" in delta)) {
      return false;
    }

    const content = getMessageContent(delta.content);
    if (content) {
      assistantMessage += content;
      stdout.write(content);
    }
    return false;
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
        buffer = buffer.slice(newlineIndex + 1);

        if (line === "") {
          if (consumeEvent()) return assistantMessage;
        } else if (line.startsWith("data:")) {
          eventData.push(line.slice(5).trimStart());
        }

        newlineIndex = buffer.indexOf("\n");
      }

      if (done) break;
    }

    if (buffer.startsWith("data:")) {
      eventData.push(buffer.slice(5).trimStart());
    }
    consumeEvent();
    return assistantMessage;
  } finally {
    reader.releaseLock();
  }
}

async function main(): Promise<void> {
  const token = process.env.GATEWAY_TOKEN;
  if (!token) {
    throw new Error("Set GATEWAY_TOKEN to a token created in this gateway");
  }

  const baseUrl = process.env.GATEWAY_BASE_URL ?? "http://127.0.0.1:4000/v1";
  const completionUrl = getCompletionUrl(baseUrl);
  const readline = createInterface({ input: stdin, output: stdout });
  const messages: ChatMessage[] = [];
  let model = process.env.CHAT_MODEL?.trim() ?? "";

  try {
    if (!model) {
      model = (await readline.question("Model ID: ")).trim();
    }
    if (!model) {
      throw new Error("A model ID is required");
    }

    console.log(`Connected to ${baseUrl} using model ${model}.`);
    console.log(
      "Type /reset to clear history, /model <id> to switch models, or /exit to quit.\n",
    );

    stdout.write("You: ");
    for await (const line of readline) {
      const input = line.trim();
      if (!input) {
        stdout.write("You: ");
        continue;
      }

      if (input === "/exit" || input === "/quit") break;
      if (input === "/reset") {
        messages.length = 0;
        console.log("Conversation history cleared.\n");
        stdout.write("You: ");
        continue;
      }
      if (input.startsWith("/model ")) {
        const nextModel = input.slice("/model ".length).trim();
        if (!nextModel) {
          console.log(`Current model: ${model}\n`);
          stdout.write("You: ");
          continue;
        }
        model = nextModel;
        console.log(`Switched to ${model}.\n`);
        stdout.write("You: ");
        continue;
      }
      messages.push({ role: "user", content: input });
      messages.push({ role: "user", content: input });

      try {
        const response = await fetch(completionUrl, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            accept: "text/event-stream, application/json",
          },
          body: JSON.stringify({ model, messages, stream: true }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `Gateway returned HTTP ${response.status}: ${errorBody}`,
          );
        }

        const provider = response.headers.get("x-gateway-provider");
        stdout.write(provider ? `Assistant [${provider}]: ` : "Assistant: ");

        const contentType = response.headers.get("content-type") ?? "";
        let assistantMessage: string;
        if (contentType.includes("text/event-stream")) {
          assistantMessage = await printStreamedCompletion(response);
        } else {
          assistantMessage = await printJsonCompletion(response);
        }

        messages.push({ role: "assistant", content: assistantMessage });
        stdout.write("\n\n");
      } catch (error) {
        messages.pop();
        stdout.write("\n");
        console.error(
          error instanceof Error ? error.message : "Chat request failed",
        );
        stdout.write("\n");
      }
      stdout.write("You: ");
    }
  } finally {
    readline.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Chat client failed");
  process.exitCode = 1;
});
