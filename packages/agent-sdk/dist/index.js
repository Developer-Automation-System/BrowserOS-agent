// src/errors.ts
class AgentSDKError extends Error {
  code;
  statusCode;
  constructor(message, code, statusCode) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = "AgentSDKError";
  }
}

class ConnectionError extends AgentSDKError {
  url;
  constructor(message, url) {
    super(message, "CONNECTION_ERROR");
    this.url = url;
    this.name = "ConnectionError";
  }
}

class NavigationError extends AgentSDKError {
  constructor(message, statusCode) {
    super(message, "NAVIGATION_ERROR", statusCode);
    this.name = "NavigationError";
  }
}

class ActionError extends AgentSDKError {
  constructor(message, statusCode) {
    super(message, "ACTION_ERROR", statusCode);
    this.name = "ActionError";
  }
}

class ExtractionError extends AgentSDKError {
  constructor(message, statusCode) {
    super(message, "EXTRACTION_ERROR", statusCode);
    this.name = "ExtractionError";
  }
}

class VerificationError extends AgentSDKError {
  constructor(message, statusCode) {
    super(message, "VERIFICATION_ERROR", statusCode);
    this.name = "VerificationError";
  }
}

// src/utils/sse-parser.ts
import { createParser } from "eventsource-parser";
async function parseSSEStream(ctx, reader, result) {
  const decoder = new TextDecoder;
  const pendingEvents = [];
  let currentText = "";
  const currentToolCalls = new Map;
  const parser = createParser({
    onEvent: (msg) => {
      if (msg.data === "[DONE]")
        return;
      try {
        const event = JSON.parse(msg.data);
        pendingEvents.push(event);
      } catch {}
    }
  });
  const processEvent = (event) => {
    ctx.emit(event);
    if (event.type === "start-step") {
      currentText = "";
      currentToolCalls.clear();
    } else if (event.type === "text-delta") {
      currentText += event.delta;
    } else if (event.type === "tool-input-available") {
      currentToolCalls.set(event.toolCallId, {
        name: event.toolName,
        args: event.input
      });
    } else if (event.type === "tool-output-available") {
      const tc = currentToolCalls.get(event.toolCallId);
      if (tc)
        tc.result = event.output;
    } else if (event.type === "finish-step") {
      const step = {};
      if (currentText)
        step.thought = currentText;
      if (currentToolCalls.size > 0) {
        step.toolCalls = Array.from(currentToolCalls.values());
      }
      result.steps.push(step);
    } else if (event.type === "error") {
      result.success = false;
    }
  };
  try {
    while (true) {
      ctx.throwIfAborted();
      const { done, value } = await reader.read();
      if (done)
        break;
      const text = decoder.decode(value, { stream: true });
      parser.feed(text);
      let event = pendingEvents.shift();
      while (event) {
        processEvent(event);
        event = pendingEvents.shift();
      }
    }
    let remaining = pendingEvents.shift();
    while (remaining) {
      processEvent(remaining);
      remaining = pendingEvents.shift();
    }
  } finally {
    reader.releaseLock();
  }
}

// src/utils/request.ts
async function request(ctx, endpoint, body, ErrorClass) {
  ctx.throwIfAborted();
  const url = `${ctx.baseUrl}${endpoint}`;
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctx.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Operation aborted");
    }
    throw new ConnectionError(`Failed to connect to server: ${error instanceof Error ? error.message : String(error)}`, url);
  }
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody.error?.message) {
        errorMessage = errorBody.error.message;
      }
    } catch {}
    throw new ErrorClass(errorMessage, response.status);
  }
  return response.json();
}

// src/methods/verify.ts
async function verify(ctx, expectation, options) {
  ctx.emit({ type: "start-step" });
  ctx.emit({ type: "text-start", id: "verify" });
  ctx.emit({
    type: "text-delta",
    id: "verify",
    delta: `Verifying: ${expectation}...
`
  });
  const result = await request(ctx, "/sdk/verify", {
    expectation,
    context: options?.context,
    windowId: ctx.browserContext?.windowId,
    llm: ctx.llmConfig
  }, VerificationError);
  ctx.emit({
    type: "text-delta",
    id: "verify",
    delta: result.success ? `Verification passed: ${result.reason}
` : `Verification failed: ${result.reason}
`
  });
  ctx.emit({ type: "text-end", id: "verify" });
  ctx.emit({ type: "finish-step" });
  return result;
}
async function verifyInternal(ctx, expectation) {
  return request(ctx, "/sdk/verify", {
    expectation,
    windowId: ctx.browserContext?.windowId,
    llm: ctx.llmConfig
  }, VerificationError);
}

// src/methods/act.ts
async function executeAct(ctx, instruction, options) {
  ctx.throwIfAborted();
  const url = `${ctx.baseUrl}/sdk/act`;
  const browserContextForAct = ctx.browserContext ? {
    windowId: ctx.browserContext.windowId,
    enabledMcpServers: ctx.browserContext.enabledMcpServers,
    customMcpServers: ctx.browserContext.customMcpServers
  } : undefined;
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instruction,
        context: options?.context,
        maxSteps: options?.maxSteps,
        browserContext: browserContextForAct,
        llm: ctx.llmConfig,
        sessionId: ctx.sessionId
      }),
      signal: ctx.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Operation aborted");
    }
    throw new ConnectionError(`Failed to connect to server: ${error instanceof Error ? error.message : String(error)}`, url);
  }
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody.error?.message) {
        errorMessage = errorBody.error.message;
      }
    } catch {}
    throw new ActionError(errorMessage, response.status);
  }
  const reader = response.body?.getReader();
  const result = { success: true, steps: [] };
  if (reader) {
    await parseSSEStream(ctx, reader, result);
  }
  return result;
}
async function act(ctx, instruction, options) {
  if (options?.resetState && ctx.stateful) {
    ctx.sessionId = crypto.randomUUID();
  }
  if (!options?.verify) {
    return executeAct(ctx, instruction, options);
  }
  const maxRetries = options.maxRetries ?? 1;
  let lastResult = null;
  let lastVerifyReason;
  for (let attempt = 0;attempt <= maxRetries; attempt++) {
    const retryInstruction = attempt === 0 || !lastVerifyReason ? instruction : `${instruction}

[Previous attempt failed verification: "${lastVerifyReason}"]`;
    const attemptOptions = attempt === 0 ? options : { ...options, resetState: false };
    lastResult = await executeAct(ctx, retryInstruction, attemptOptions);
    if (!lastResult.success) {
      return lastResult;
    }
    const verifyResult = await verifyInternal(ctx, options.verify);
    if (verifyResult.success) {
      return lastResult;
    }
    lastVerifyReason = verifyResult.reason;
    if (attempt < maxRetries) {
      ctx.emit({
        type: "text-delta",
        id: "act-retry",
        delta: `Verification failed: ${verifyResult.reason}. Retrying (${attempt + 1}/${maxRetries})...
`
      });
    }
  }
  return {
    success: false,
    steps: lastResult?.steps ?? []
  };
}

// src/methods/extract.ts
import { zodToJsonSchema } from "zod-to-json-schema";
async function extract(ctx, instruction, options) {
  ctx.emit({ type: "start-step" });
  ctx.emit({ type: "text-start", id: "extract" });
  ctx.emit({
    type: "text-delta",
    id: "extract",
    delta: `Extracting: ${instruction}...
`
  });
  const jsonSchema = zodToJsonSchema(options.schema);
  const result = await request(ctx, "/sdk/extract", {
    instruction,
    schema: jsonSchema,
    context: options.context,
    windowId: ctx.browserContext?.windowId
  }, ExtractionError);
  ctx.emit({
    type: "text-delta",
    id: "extract",
    delta: `Extraction complete.
`
  });
  ctx.emit({ type: "text-end", id: "extract" });
  ctx.emit({ type: "finish-step" });
  return result;
}

// src/methods/nav.ts
async function nav(ctx, url, options) {
  ctx.emit({ type: "start-step" });
  ctx.emit({ type: "text-start", id: "nav" });
  ctx.emit({
    type: "text-delta",
    id: "nav",
    delta: `Navigating to ${url}...
`
  });
  const windowId = options?.windowId ?? ctx.browserContext?.windowId;
  const result = await request(ctx, "/sdk/nav", { url, windowId, tabId: options?.tabId }, NavigationError);
  ctx.emit({
    type: "text-delta",
    id: "nav",
    delta: result.success ? `Navigation complete.
` : `Navigation failed.
`
  });
  ctx.emit({ type: "text-end", id: "nav" });
  ctx.emit({ type: "finish-step" });
  return result;
}

// src/agent.ts
class Agent {
  baseUrl;
  llmConfig;
  signal;
  browserContext;
  stateful;
  progressCallback;
  _sessionId = null;
  _disposed = false;
  constructor(options) {
    this.baseUrl = options.url.replace(/\/$/, "");
    this.llmConfig = options.llm;
    this.progressCallback = options.onProgress;
    this.signal = options.signal;
    this.browserContext = options.browserContext;
    this.stateful = options.stateful ?? true;
    if (this.stateful) {
      this._sessionId = crypto.randomUUID();
    }
  }
  get sessionId() {
    return this._sessionId;
  }
  set sessionId(value) {
    this._sessionId = value;
  }
  async dispose() {
    if (this._disposed)
      return;
    this._disposed = true;
    if (this._sessionId) {
      await fetch(`${this.baseUrl}/chat/${this._sessionId}`, {
        method: "DELETE"
      }).catch(() => {});
    }
  }
  async[Symbol.asyncDispose]() {
    await this.dispose();
  }
  throwIfAborted() {
    if (this.signal?.aborted) {
      throw new Error("Operation aborted");
    }
  }
  onProgress(callback) {
    this.progressCallback = callback;
  }
  emit(event) {
    this.progressCallback?.(event);
  }
  nav(url, options) {
    return nav(this, url, options);
  }
  act(instruction, options) {
    return act(this, instruction, options);
  }
  extract(instruction, options) {
    return extract(this, instruction, options);
  }
  verify(expectation, options) {
    return verify(this, expectation, options);
  }
}
export {
  VerificationError,
  NavigationError,
  ExtractionError,
  ConnectionError,
  AgentSDKError,
  Agent,
  ActionError
};
