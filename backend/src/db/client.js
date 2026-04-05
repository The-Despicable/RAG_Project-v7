import pg from "pg";
import dotenv from "dotenv";
import { withRetry } from "../utils/retry.js";
import { recordLatency, recordError } from "../utils/metrics.js";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function query(sql, params) {
  const start = process.hrtime.bigint();
  try {
    const result = await withRetry(() => pool.query(sql, params));
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
    recordLatency("db.query", elapsed);
    return result;
  } catch (error) {
    recordError("db.query");
    throw error;
  }
}

export { pool };
