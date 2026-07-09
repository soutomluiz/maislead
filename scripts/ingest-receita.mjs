#!/usr/bin/env node
/**
 * Ingestão de "empresas recém-abertas" da Receita Federal → tabela rf_estabelecimento.
 *
 * ARQUITETURA AGNÓSTICA DE FONTE:
 *   - `SOURCES.dump`  → IMPLEMENTADO. Baixa o dump público grátis, filtra e sobe.
 *   - `SOURCES.api`   → STUB pronto p/ API paga. Mesma saída (mesmos campos), mesmo upsert.
 *   Quando contratar a API: implemente fetchFromApi() e rode com RECEITA_SOURCE=api.
 *   A tabela, a edge function de busca e a tela NÃO mudam — só a fonte.
 *
 * PRÉ-REQUISITOS:
 *   npm i unzipper iconv-lite            (o @supabase/supabase-js já está no projeto)
 *   Variáveis de ambiente:
 *     SUPABASE_URL                (ex: https://ddndpnibptrvurabacgi.supabase.co)
 *     SUPABASE_SERVICE_ROLE_KEY   (Supabase → Project Settings → API → service_role)
 *   Opcionais:
 *     RECEITA_SOURCE   = dump (padrão) | api
 *     RECEITA_DAYS     = 60 (padrão)   janela de recém-abertas
 *     RECEITA_MONTH    = 2026-07       força um mês específico (senão auto-descobre o último)
 *     RECEITA_BASE_URL = base dos dados abertos (padrão abaixo)
 *     RECEITA_ONLY_ACTIVE = 1 (padrão) só situação cadastral ativa (02)
 *     RECEITA_API_URL / RECEITA_API_KEY  (só p/ RECEITA_SOURCE=api)
 *
 * USO (recomendado com mais heap, pois processa centenas de milhares de linhas):
 *   node --max-old-space-size=4096 scripts/ingest-receita.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";
import readline from "node:readline";
import { createClient } from "@supabase/supabase-js";

// ---- deps opcionais (carregadas só quando a fonte dump é usada) ----
async function loadDumpDeps() {
  const [{ default: unzipper }, iconv] = await Promise.all([
    import("unzipper").catch(() => { throw new Error("Falta a dependência 'unzipper'. Rode: npm i unzipper iconv-lite"); }),
    import("iconv-lite").catch(() => { throw new Error("Falta a dependência 'iconv-lite'. Rode: npm i unzipper iconv-lite"); }),
  ]);
  return { unzipper, iconv: iconv.default ?? iconv };
}

const CFG = {
  source: process.env.RECEITA_SOURCE || "dump",
  days: parseInt(process.env.RECEITA_DAYS || "60", 10),
  month: process.env.RECEITA_MONTH || null,
  baseUrl: (process.env.RECEITA_BASE_URL || "https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj").replace(/\/$/, ""),
  onlyActive: process.env.RECEITA_ONLY_ACTIVE !== "0",
  supabaseUrl: process.env.SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  tmp: path.join(os.tmpdir(), "receita-ingest"),
};

function log(...a) { console.log(`[receita ${new Date().toISOString().slice(11, 19)}]`, ...a); }
function die(msg) { console.error("ERRO:", msg); process.exit(1); }

// ---------- CSV (Latin-1, ';' , aspas '"') ----------
function parseCsvLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ";") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}
const ymd = (s) => (s && /^\d{8}$/.test(s) && s !== "00000000") ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null;
const numBR = (s) => { const n = parseFloat(String(s || "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const clean = (s) => { const t = (s ?? "").trim(); return t === "" ? null : t; };

// ---------- download ----------
async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { log("já baixado:", path.basename(dest)); return dest; }
  log("baixando", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download falhou (${res.status}) ${url}`);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const tmp = dest + ".part";
  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(tmp);
    Readable.fromWeb(res.body).pipe(ws);
    ws.on("finish", resolve); ws.on("error", reject);
  });
  fs.renameSync(tmp, dest);
  return dest;
}

// stream das linhas do único CSV dentro de um zip da RF (Latin-1 → UTF-8)
async function* zipCsvLines(zipPath, deps) {
  const { unzipper, iconv } = deps;
  const stream = fs.createReadStream(zipPath).pipe(unzipper.ParseOne());
  const rl = readline.createInterface({ input: stream.pipe(iconv.decodeStream("latin1")), crlfDelay: Infinity });
  for await (const line of rl) { if (line) yield line; }
}

// descobre a subpasta YYYY-MM mais recente (lista o diretório Apache da RF)
async function discoverMonth() {
  if (CFG.month) return CFG.month;
  log("descobrindo o mês mais recente em", CFG.baseUrl);
  const res = await fetch(CFG.baseUrl + "/");
  if (!res.ok) throw new Error(`não consegui listar ${CFG.baseUrl} (${res.status}). Passe RECEITA_MONTH=YYYY-MM manualmente.`);
  const html = await res.text();
  const months = [...html.matchAll(/(\d{4}-\d{2})\//g)].map((m) => m[1]);
  if (!months.length) throw new Error("nenhuma pasta YYYY-MM encontrada. Passe RECEITA_MONTH=YYYY-MM.");
  months.sort();
  return months[months.length - 1];
}

// ================= FONTE: DUMP (grátis) =================
const SOURCES = {};
SOURCES.dump = async function ingestDump() {
  const deps = await loadDumpDeps();
  const month = await discoverMonth();
  const dir = `${CFG.baseUrl}/${month}`;
  const workdir = path.join(CFG.tmp, month);
  log(`fonte=dump mês=${month} janela=${CFG.days}d ativos=${CFG.onlyActive}`);

  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - CFG.days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  log("corte de data_abertura >=", cutoffStr);

  // 1) lookups pequenos
  const cnae = new Map(), muni = new Map();
  for (const [name, map, ci, di] of [["Cnaes", cnae, 0, 1], ["Municipios", muni, 0, 1]]) {
    const zip = await download(`${dir}/${name}.zip`, path.join(workdir, `${name}.zip`));
    for await (const line of zipCsvLines(zip, deps)) { const f = parseCsvLine(line); if (f[ci]) map.set(f[ci], clean(f[di])); }
    log(`${name}: ${map.size} registros`);
  }
  // sobe rf_cnae (upsert)
  await upsertCnae(cnae);

  // 2) 1ª passada: Estabelecimentos (10 partes) → filtra por data+situação
  const estabs = [];               // registros que passaram
  const basicos = new Set();        // cnpj_basico p/ cruzar com Empresas/Simples
  for (let i = 0; i < 10; i++) {
    const zip = await download(`${dir}/Estabelecimentos${i}.zip`, path.join(workdir, `Estabelecimentos${i}.zip`));
    let scanned = 0, kept = 0;
    for await (const line of zipCsvLines(zip, deps)) {
      const f = parseCsvLine(line); scanned++;
      const situ = f[5];                        // situacao_cadastral
      const dataAb = ymd(f[10]);                // data_inicio_atividade
      if (!dataAb || dataAb < cutoffStr) continue;
      if (CFG.onlyActive && situ !== "02") continue;
      const basico = f[0];
      const rec = {
        cnpj: `${f[0]}${f[1]}${f[2]}`,
        cnpj_basico: basico,
        nome_fantasia: clean(f[4]),
        situacao: situ ? parseInt(situ, 10) : null,
        data_abertura: dataAb,
        cnae_principal: clean(f[11]),
        uf: clean(f[19]),
        municipio_nome: muni.get(f[20]) ?? null,
        bairro: clean(f[17]),
        cep: clean(f[18]),
        ddd1: clean(f[21]),
        telefone1: clean(f[22]),
        email: clean(f[27]) ? f[27].trim().toLowerCase() : null,
        dump_ref: month,
      };
      estabs.push(rec); basicos.add(basico); kept++;
    }
    log(`Estabelecimentos${i}: lidos ${scanned}, mantidos ${kept} (total ${estabs.length})`);
  }
  if (!estabs.length) { log("nenhum estabelecimento no período. Fim."); return { inserted: 0 }; }

  // 3) 2ª passada: Empresas (razão social, porte, capital) só p/ os básicos selecionados
  const emp = new Map();
  for (let i = 0; i < 10; i++) {
    const zip = await download(`${dir}/Empresas${i}.zip`, path.join(workdir, `Empresas${i}.zip`));
    for await (const line of zipCsvLines(zip, deps)) {
      const f = parseCsvLine(line);
      if (!basicos.has(f[0])) continue;
      emp.set(f[0], { razao_social: clean(f[1]), capital_social: numBR(f[4]), porte: f[5] ? parseInt(f[5], 10) : null });
    }
    log(`Empresas${i} processado (match ${emp.size}/${basicos.size})`);
  }

  // 4) Simples (MEI/Simples) — arquivo único
  const simples = new Map();
  try {
    const zip = await download(`${dir}/Simples.zip`, path.join(workdir, "Simples.zip"));
    for await (const line of zipCsvLines(zip, deps)) {
      const f = parseCsvLine(line);
      if (!basicos.has(f[0])) continue;
      simples.set(f[0], { opcao_simples: f[1] === "S", opcao_mei: f[4] === "S" });
    }
    log(`Simples processado (match ${simples.size})`);
  } catch (e) { log("aviso: Simples não processado:", e.message); }

  // 5) merge + upsert
  for (const r of estabs) {
    const e = emp.get(r.cnpj_basico); const s = simples.get(r.cnpj_basico);
    r.razao_social = e?.razao_social ?? null;
    r.capital_social = e?.capital_social ?? null;
    r.porte = e?.porte ?? null;
    r.opcao_simples = s?.opcao_simples ?? null;
    r.opcao_mei = s?.opcao_mei ?? null;
  }
  return { records: estabs };
};

// ================= FONTE: API PAGA (stub) =================
// Quando contratar a API, implemente aqui. Deve retornar { records: [...] } com EXATAMENTE
// os mesmos campos de rf_estabelecimento (cnpj, cnpj_basico, razao_social, nome_fantasia,
// situacao, data_abertura, cnae_principal, porte, capital_social, opcao_mei, opcao_simples,
// uf, municipio_nome, bairro, cep, ddd1, telefone1, email, dump_ref). O restante (upsert,
// tabela, tela) já está pronto e NÃO muda.
SOURCES.api = async function ingestApi() {
  const url = process.env.RECEITA_API_URL, key = process.env.RECEITA_API_KEY;
  if (!url || !key) die("RECEITA_SOURCE=api exige RECEITA_API_URL e RECEITA_API_KEY.");
  die("Fonte 'api' ainda não implementada — é o seam pronto p/ quando você contratar a API. "
    + "Implemente o fetch aqui (paginação + map p/ o shape de rf_estabelecimento) e o resto funciona igual.");
  // Exemplo do shape esperado:
  // const records = [];
  // let page = 1;
  // while (true) {
  //   const res = await fetch(`${url}?opened_since=${CFG.days}d&page=${page}`, { headers: { Authorization: `Bearer ${key}` } });
  //   const data = await res.json();
  //   for (const it of data.items) records.push(mapApiItem(it));  // -> shape de rf_estabelecimento
  //   if (!data.hasNext) break; page++;
  // }
  // return { records };
};

// ---------- upserts no Supabase ----------
function sb() {
  if (!CFG.supabaseUrl || !CFG.serviceKey) die("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(CFG.supabaseUrl, CFG.serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
async function upsertCnae(map) {
  const client = sb();
  const rows = [...map.entries()].map(([codigo, descricao]) => ({ codigo, descricao }));
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await client.from("rf_cnae").upsert(rows.slice(i, i + 1000), { onConflict: "codigo" });
    if (error) throw new Error("upsert rf_cnae: " + error.message);
  }
  log(`rf_cnae: ${rows.length} upserted`);
}
async function upsertRecords(records) {
  const client = sb();
  const BATCH = 500;
  let done = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    const { error } = await client.from("rf_estabelecimento").upsert(chunk, { onConflict: "cnpj" });
    if (error) throw new Error(`upsert rf_estabelecimento (lote ${i}): ${error.message}`);
    done += chunk.length;
    if (done % 10000 < BATCH) log(`upsert ${done}/${records.length}`);
  }
  return done;
}

// ---------- main ----------
(async () => {
  const impl = SOURCES[CFG.source];
  if (!impl) die(`RECEITA_SOURCE inválida: ${CFG.source} (use 'dump' ou 'api')`);
  const t0 = Date.now();
  const out = await impl();
  const records = out.records ?? [];
  if (records.length) {
    log(`subindo ${records.length} registros p/ o Supabase…`);
    const n = await upsertRecords(records);
    log(`✅ concluído: ${n} estabelecimentos em ${((Date.now() - t0) / 60000).toFixed(1)} min`);
    log("Próximo: rode a query de tamanho no doc p/ conferir se coube no free (500 MB).");
  } else {
    log("nada a subir.");
  }
})().catch((e) => die(e.stack || e.message));
