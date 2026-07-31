import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AnalysisResult } from "../contract/analysis.schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "contract", "analysis.schema.json");

const jsonSchema = zodToJsonSchema(AnalysisResult, {
  name: "AnalysisResult",
  $refStrategy: "none",
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(jsonSchema, null, 2)}\n`, "utf8");
console.log(`Wrote ${outPath}`);
