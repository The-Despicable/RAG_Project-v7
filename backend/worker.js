import dotenv from "dotenv";
import { runWorkerLoop } from "./src/modules/ingest/ingest.worker.js";

dotenv.config();

await runWorkerLoop(console);
