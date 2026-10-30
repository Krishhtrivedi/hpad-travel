// Concatenates the migrations into supabase/setup.sql for pasting into the Supabase SQL editor.
import fs from "node:fs";
const dir = new URL("../supabase/migrations/", import.meta.url);
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const out = [
  "-- HPAD Travel Management System — complete database setup",
  "-- Generated from supabase/migrations by `npm run db:bundle`. Run once on a new project.",
  "",
  ...files.map((f) => `-- >>> ${f}\n${fs.readFileSync(new URL(f, dir), "utf8")}`),
].join("\n");
fs.writeFileSync(new URL("../supabase/setup.sql", import.meta.url), out);
console.log(`Wrote supabase/setup.sql from ${files.length} migrations`);
