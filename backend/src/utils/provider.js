export function detectProvider(apiKey = "", baseUrl = "", explicitProvider = "") {
  if (explicitProvider) return explicitProvider.toLowerCase();

  const normalizedBaseUrl = String(baseUrl || "").toLowerCase();
  const key = String(apiKey || "");

  if (normalizedBaseUrl.includes("localhost:11434") || normalizedBaseUrl.includes("/api/generate") || normalizedBaseUrl.includes("/api/chat")) {
    return "ollama";
  }
  if (normalizedBaseUrl.includes("openrouter.ai")) return "openrouter";
  if (normalizedBaseUrl.includes("api.groq.com")) return "groq";
  if (normalizedBaseUrl.includes("api.together.xyz") || normalizedBaseUrl.includes("together.ai")) return "together";
  if (normalizedBaseUrl.includes("api.openai.com")) return "openai";
  if (baseUrl) return "custom";

  if (/^sk-or-v1-/i.test(key)) return "openrouter";
  if (/^gsk_/i.test(key)) return "groq";
  if (/^sk-(proj-|svcacct-)?/i.test(key)) return "openai";

  return "openrouter";
}
