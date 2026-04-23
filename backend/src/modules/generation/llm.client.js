import { detectProvider } from "../../utils/provider.js";
import { getDefaultModel } from "../../utils/modelResolver.js";
import { withRetry } from "../../utils/retry.js";
import { recordLatency, recordError } from "../../utils/metrics.js";

function normalizeBaseUrl(provider, baseUrl = "") {
  if (baseUrl) return baseUrl.replace(/\/$/, "");

  switch (provider) {
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "groq":
      return "https://api.groq.com/openai/v1";
    case "openai":
      return "https://api.openai.com/v1";
    case "together":
      return "https://api.together.xyz/v1";
    case "ollama":
      return "http://localhost:11434";
    default:
      throw new Error("No base URL configured for provider.");
  }
}

async function parseJson(response) {
  return response.json().catch(() => ({}));
}

async function callOpenAICompatible({ prompt, apiKey, baseUrl, model }) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user }
      ],
      temperature: 0.2
    })
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error?.message || `LLM request failed with HTTP ${response.status}`);
  }

  return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function callOllama({ prompt, baseUrl, model }) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.OLLAMA_API_KEY ? { 'Authorization': `Bearer ${process.env.OLLAMA_API_KEY}` } : {})
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user }
      ],
      stream: false,
      options: {
        temperature: 0.2
      }
    })
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || `Ollama request failed with HTTP ${response.status}`);
  }

  return data?.message?.content?.trim() || data?.response?.trim() || "";
}

export async function generate({ prompt, apiKey, baseUrl, model, provider }) {
  const detectedProvider = detectProvider(apiKey, baseUrl, provider);
  const selectedModel = model || getDefaultModel(detectedProvider);
  const resolvedBaseUrl = normalizeBaseUrl(detectedProvider, baseUrl);

  if (!selectedModel) {
    throw new Error(`No default model configured for provider "${detectedProvider}".`);
  }

  const doGenerate = async () => {
    if (detectedProvider === "ollama") {
      return {
        provider: detectedProvider,
        model: selectedModel,
        answer: await callOllama({ prompt, baseUrl: resolvedBaseUrl, model: selectedModel })
      };
    }

    if (!apiKey) {
      throw new Error("No API key provided for generation.");
    }

    return {
      provider: detectedProvider,
      model: selectedModel,
      answer: await callOpenAICompatible({
        prompt,
        apiKey,
        baseUrl: resolvedBaseUrl,
        model: selectedModel
      })
    };
  };

  const start = process.hrtime.bigint();
  try {
    const result = await withRetry(doGenerate, { maxAttempts: 3, baseDelayMs: 2000 });
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
    recordLatency("llm.generate", elapsed);
    return result;
  } catch (error) {
    recordError("llm.generate");
    throw error;
  }
}




