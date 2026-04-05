import { pool } from "../../db/client.js";

export async function loadGenerationEvalData(limit = 5) {
  const result = await pool.query(`
    SELECT results
    FROM generation_eval_runs
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);

  return result.rows
    .map((row) => row.results?.details || [])
    .flat();
}
