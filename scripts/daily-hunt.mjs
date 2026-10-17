import { createClient } from "@supabase/supabase-js";
import { searchOpenStreetMap } from "../src/lib/osm.server.ts";
import { calculateLeadScore } from "../src/lib/score.ts";
import { runDailyHunts } from "../src/lib/daily-hunt.ts";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Configure the daily worker Supabase secrets first.");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const result = await runDailyHunts(db, searchOpenStreetMap, calculateLeadScore);
console.log(
  `Daily hunting: ${result.completed} completed, ${result.failed} failed, ${result.skipped} skipped.`,
);
if (result.failed) process.exitCode = 1;
