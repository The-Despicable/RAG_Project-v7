import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import app from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

export function checkEnvVars() {
  const required = ["OPENROUTER_API_KEY", "DATABASE_URL"];
  const missing = required.filter(k => !process.env[k] || process.env[k].trim() === "");
  if (missing.length > 0) {
    console.error("FATAL: Missing required environment variables:", missing.join(", "));
    process.exit(1);
  }
  console.log("All required environment variables are set.");
}

const start = async () => {
  try {
    checkEnvVars();
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
