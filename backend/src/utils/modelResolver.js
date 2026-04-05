const DEFAULT_MODELS = {
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
  groq: "llama-3.1-8b-instant",
  openai: "gpt-4o-mini",
  together: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  ollama: "llama3.2",
  custom: ""
};

export function getDefaultModel(provider) {
  return DEFAULT_MODELS[provider] || "";
}
