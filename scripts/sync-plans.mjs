// Copia a fonte única de verdade dos planos (src/config/plans.json) para public/plans.json,
// que o Vite publica em app.maislead.com/plans.json. A landge (maislead.com) faz fetch dele.
// Roda automaticamente no `npm run build` (antes do vite build), então public/plans.json
// está sempre em sincronia — você edita SÓ src/config/plans.json.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = resolve(root, "src/config/plans.json");
const outPath = resolve(root, "public/plans.json");

const raw = readFileSync(srcPath, "utf8");
const data = JSON.parse(raw); // valida que é JSON válido antes de publicar
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`[sync-plans] ${srcPath} -> ${outPath} (${data.order?.length ?? 0} planos)`);
