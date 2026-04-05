const VALID_KEYS = (process.env.RAG_API_KEYS || "")
  .split(",")
  .map((k) => k.trim())
  .filter((k) => k.length > 0);

export async function authenticate(request, reply) {
  const authHeader = request.headers.authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  const providedKey = match[1].trim();

  if (!VALID_KEYS.includes(providedKey)) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  request.userId = providedKey;
}
