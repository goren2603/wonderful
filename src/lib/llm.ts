// LLM abstraction shared by all three products.
//
// Default: a deterministic "demo" provider that turns real computed numbers
// into readable prose — no network call, no fabrication, always available.
// If ANTHROPIC_API_KEY is set, swap in a real model call with the same
// interface. Every piece of text produced by either provider is labeled with
// its provider so the UI can show whether an interpretation is demo or live.

export interface LLMRequest {
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface LLMResult {
  text: string;
  provider: "demo" | "live";
  model: string;
}

interface LLMProvider {
  name: "demo" | "live";
  complete(req: LLMRequest): Promise<LLMResult>;
}

class DemoLLMProvider implements LLMProvider {
  name = "demo" as const;

  async complete(req: LLMRequest): Promise<LLMResult> {
    // The "demo" provider does not call any external model. It returns the
    // prompt's own pre-composed narrative (callers pass fully-formed,
    // data-grounded text as the prompt for demo mode) so the UI always has
    // something real — never a canned unrelated sentence.
    return {
      text: req.prompt,
      provider: "demo",
      model: "demo-narrative-v1",
    };
  }
}

class AnthropicLLMProvider implements LLMProvider {
  name = "live" as const;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
  }

  async complete(req: LLMRequest): Promise<LLMResult> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: req.maxTokens ?? 400,
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    const text = data.content.find((c) => c.type === "text")?.text ?? "";
    return { text, provider: "live", model: this.model };
  }
}

let cachedProvider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (cachedProvider) return cachedProvider;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  cachedProvider = apiKey ? new AnthropicLLMProvider(apiKey) : new DemoLLMProvider();
  return cachedProvider;
}

export function isLiveLLM(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
