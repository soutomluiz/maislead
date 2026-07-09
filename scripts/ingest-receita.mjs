#!/usr/bin/env node
/**
 * Ingestão de "empresas recém-abertas" da Receita Federal → tabela rf_estabelecimento.
 *
 * ARQUITETURA AGNÓSTICA DE FONTE:
 *   - `SOURCES.dump`  → IMPLEMENTADO. Baixa o dump público grátis (Nextcloud/WebDAV da RF),
 *                        filtra por data+situação e sobe só a fatia.
 *   - `SOURCES.api`   → STUB pronto p/ API paga. Mesma saída (mesmos campos), mesmo upsert.
 *   Quando contratar a API: implemente fetchFromApi() e rode com RECEITA_SOURCE=api.
 *   A tabela, a edge function de busca e a tela NÃO mudam — só a fonte.
 *
 * A RF migrou (jan/2026) os arquivos p/ um compartilhamento Nextcloud. Baixamos via WebDAV:
 *   base   = https://arquivos.receitafederal.gov.br/public.php/webdav
 *   auth   = Basic (usuário = token do share, senha vazia)
 *   token  = da URL pública .../index.php/s/<TOKEN>  (default abaixo; troque se a RF mudar)
 *
 * PRÉ-REQUISITOS:
 *   npm i unzipper iconv-lite            (o @supabase/supabase-js já está no projeto)
 *   Variáveis de ambiente:
 *     SUPABASE_URL                (ex: https://ddndpnibptrvurabacgi.supabase.co)
 *     SUPABASE_SERVICE_ROLE_KEY   (Supabase → Project Settings → API → service_role)
 *   Opcionais:
 *     RECEITA_SOURCE       = dump (padrão) | api
 *     RECEITA_DAYS         = 60 (padrão)   janela de recém-abertas
 *     RECEITA_MONTH        = 2026-06       força um mês (senão auto-descobre o último)
 *     RECEITA_SHARE_TOKEN  = token do share Nextcloud (default abaixo)
 *     RECEITA_WEBDAV_BASE  = base WebDAV (default abaixo)
 *     RECEITA_ONLY_ACTIVE  = 1 (padrão) só situação cadastral ativa (02)
 *     RECEITA_API_URL / RECEITA_API_KEY  (só p/ RECEITA_SOURCE=api)
 *
 * USO (com mais heap, pois processa centenas de milhares de linhas):
 *   node --max-old-space-size=4096 scripts/ingest-receita.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import readline from "node:readline";
import { createClient } from "@supabase/supabase-js";

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
  webdavBase: (process.env.RECEITA_WEBDAV_BASE || "https://arquivos.receitafederal.gov.br/public.php/webdav").replace(/\/$/, ""),
  shareToken: process.env.RECEITA_SHARE_TOKEN || "YggdBLfdninEJX9",
  onlyActive: process.env.RECEITA_ONLY_ACTIVE !== "0",
  supabaseUrl: process.env.SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  tmp: path.join(os.tmpdir(), "receita-ingest"),
};
const AUTH = "Basic " + Buffer.from(`${CFG.shareToken}:`).toString("base64");
const UA = "maisLEAD-ingest/1.0";

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

// ---------- WebDAV (Nextcloud público) ----------
// PROPFIND depth 1 → lista os filhos (pastas de mês, ou arquivos dentro de um mês).
async function propfind(url) {
  const res = await fetch(url, { method: "PROPFIND", headers: { Authorization: AUTH, Depth: "1", "User-Agent": UA } });
  if (!res.ok) throw new Error(`PROPFIND ${res.status} em ${url}. Token do share pode ter mudado — veja a URL nova em gov.br/receitafederal/dados e passe RECEITA_SHARE_TOKEN.`);
  const xml = await res.text();
  const hrefs = [...xml.matchAll(/<[a-z0-9]*:?href>([^<]+)<\/[a-z0-9]*:?href>/gi)].map((m) => decodeURIComponent(m[1].trim()));
  return hrefs;
}
// nome do último segmento de um href de pasta/arquivo
function lastSeg(href) { return href.replace(/\/$/, "").split("/").filter(Boolean).pop() || ""; }

async function discoverMonth() {
  if (CFG.month) return CFG.month;
  log("descobrindo o mês mais recente (WebDAV)…");
  const hrefs = await propfind(CFG.webdavBase + "/");
  const months = hrefs.filter((h) => /\/\d{4}-\d{2}\/?$/.test(h)).map((h) => lastSeg(h)).filter((s) => /^\d{4}-\d{2}$/.test(s));
  if (!months.length) { log("sem pastas de mês no share — assumindo arquivos na raiz."); return ""; }
  months.sort();
  return months[months.length - 1];
}

// lista os arquivos (nomes) dentro do mês (ou raiz) e devolve um mapa nome->url
async function listFiles(month) {
  const dirUrl = CFG.webdavBase + (month ? `/${month}` : "");
  const hrefs = await propfind(dirUrl + "/");
  const map = new Map();
  for (const h of hrefs) {
    if (/\/$/.test(h)) continue; // pasta
    const name = lastSeg(h);
    if (name && /\.(zip|ZIP)$/.test(name)) map.set(name, `${dirUrl}/${encodeURIComponent(name)}`);
  }
  return map;
}
function pick(map, re) { for (const [name, url] of map) if (re.test(name)) return { name, url }; return null; }
function pickAll(map, re) { return [...map].filter(([n]) => re.test(n)).map(([name, url]) => ({ name, url })).sort((a, b) => a.name.localeCompare(b.name)); }

// ---------- download + unzip ----------
async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { log("já baixado:", path.basename(dest)); return dest; }
  log("baixando", path.basename(dest));
  const res = await fetch(url, { headers: { Authorization: AUTH, "User-Agent": UA } });
  if (!res.ok) throw new Error(`download falhou (${res.status}) ${url}`);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const tmp = dest + ".part";
  const total = Number(res.headers.get("content-length") || 0);
  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(tmp);
    const src = Readable.fromWeb(res.body);
    let recv = 0, lastPct = -1;
    src.on("data", (c) => {
      recv += c.length;
      const mb = Math.floor(recv / 1e6);
      const pct = total ? Math.floor((recv / total) * 100) : -1;
      if (pct >= 0 ? pct !== lastPct && pct % 5 === 0 : mb % 50 === 0) { lastPct = pct; process.stdout.write(`   ${pct >= 0 ? pct + "% · " : ""}${mb} MB\r`); }
    });
    src.on("error", reject);
    src.pipe(ws);
    ws.on("finish", () => { process.stdout.write("\n"); resolve(); });
    ws.on("error", reject);
  });
  fs.renameSync(tmp, dest);
  return dest;
}
async function* zipCsvLines(zipPath, deps) {
  const { unzipper, iconv } = deps;
  const stream = fs.createReadStream(zipPath).pipe(unzipper.ParseOne());
  const rl = readline.createInterface({ input: stream.pipe(iconv.decodeStream("latin1")), crlfDelay: Infinity });
  for await (const line of rl) { if (line) yield line; }
}

// ================= FONTE: DUMP (grátis) =================
const SOURCES = {};
SOURCES.dump = async function ingestDump() {
  const deps = await loadDumpDeps();
  const month = await discoverMonth();
  const workdir = path.join(CFG.tmp, month || "root");
  log(`fonte=dump mês=${month || "(raiz)"} janela=${CFG.days}d ativos=${CFG.onlyActive}`);
  const files = await listFiles(month);
  log(`${files.size} arquivos .zip no repositório`);
  if (!files.size) die("nenhum .zip encontrado no repositório WebDAV.");
  if (process.env.RECEITA_LIST_ONLY) { log("RECEITA_LIST_ONLY — arquivos:"); for (const n of files.keys()) console.log("   -", n); return { records: [] }; }

  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - CFG.days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  log("corte de data_abertura >=", cutoffStr);

  // 1) lookups pequenos (CNAE + Município)
  const cnae = new Map(), muni = new Map();
  for (const [re, map, ci, di] of [[/^Cnaes/i, cnae, 0, 1], [/^Munic/i, muni, 0, 1]]) {
    const f = pick(files, re);
    if (!f) { log("aviso: lookup não encontrado p/", re); continue; }
    const zip = await download(f.url, path.join(workdir, f.name));
    for await (const line of zipCsvLines(zip, deps)) { const c = parseCsvLine(line); if (c[ci]) map.set(c[ci], clean(c[di])); }
    log(`${f.name}: ${map.size} registros`);
  }
  await upsertCnae(cnae);

  // 2) 1ª passada: Estabelecimentos → filtra por data+situação
  const estabZips = pickAll(files, /^Estabelecimentos/i);
  if (!estabZips.length) die("arquivos 'Estabelecimentos*.zip' não encontrados (nomes podem ter mudado).");
  const estabs = [];
  const basicos = new Set();
  for (const f of estabZips) {
    const zip = await download(f.url, path.join(workdir, f.name));
    let scanned = 0, kept = 0;
    for await (const line of zipCsvLines(zip, deps)) {
      const c = parseCsvLine(line); scanned++;
      const situ = c[5];
      const dataAb = ymd(c[10]);
      if (!dataAb || dataAb < cutoffStr) continue;
      if (CFG.onlyActive && situ !== "02") continue;
      const basico = c[0];
      estabs.push({
        cnpj: `${c[0]}${c[1]}${c[2]}`, cnpj_basico: basico, nome_fantasia: clean(c[4]),
        situacao: situ ? parseInt(situ, 10) : null, data_abertura: dataAb, cnae_principal: clean(c[11]),
        uf: clean(c[19]), municipio_nome: muni.get(c[20]) ?? null, bairro: clean(c[17]), cep: clean(c[18]),
        ddd1: clean(c[21]), telefone1: clean(c[22]),
        email: clean(c[27]) ? c[27].trim().toLowerCase() : null, dump_ref: month || "root",
      });
      basicos.add(basico); kept++;
    }
    log(`${f.name}: lidos ${scanned}, mantidos ${kept} (total ${estabs.length})`);
  }
  if (!estabs.length) { log("nenhum estabelecimento no período. Fim."); return { records: [] }; }

  // 3) 2ª passada: Empresas (razão social/porte/capital) só dos básicos selecionados
  const emp = new Map();
  for (const f of pickAll(files, /^Empresas/i)) {
    const zip = await download(f.url, path.join(workdir, f.name));
    for await (const line of zipCsvLines(zip, deps)) {
      const c = parseCsvLine(line);
      if (!basicos.has(c[0])) continue;
      emp.set(c[0], { razao_social: clean(c[1]), capital_social: numBR(c[4]), porte: c[5] ? parseInt(c[5], 10) : null });
    }
    log(`${f.name} ok (match ${emp.size}/${basicos.size})`);
  }

  // 4) Simples (MEI/Simples)
  const simples = new Map();
  const sf = pick(files, /^Simples/i);
  if (sf) {
    try {
      const zip = await download(sf.url, path.join(workdir, sf.name));
      for await (const line of zipCsvLines(zip, deps)) {
        const c = parseCsvLine(line);
        if (!basicos.has(c[0])) continue;
        simples.set(c[0], { opcao_simples: c[1] === "S", opcao_mei: c[4] === "S" });
      }
      log(`${sf.name} ok (match ${simples.size})`);
    } catch (e) { log("aviso: Simples não processado:", e.message); }
  }

  // 5) merge
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
SOURCES.api = async function ingestApi() {
  const url = process.env.RECEITA_API_URL, key = process.env.RECEITA_API_KEY;
  if (!url || !key) die("RECEITA_SOURCE=api exige RECEITA_API_URL e RECEITA_API_KEY.");
  die("Fonte 'api' ainda não implementada — é o seam pronto p/ quando você contratar a API. "
    + "Implemente o fetch aqui (paginação + map p/ o shape de rf_estabelecimento) e o resto funciona igual.");
};

// ---------- upserts no Supabase ----------
function sb() {
  if (!CFG.supabaseUrl || !CFG.serviceKey) die("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(CFG.supabaseUrl, CFG.serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
async function upsertCnae(map) {
  if (!map.size) return;
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
    log("Confira o tamanho no banco (query no doc) p/ ver se coube no free (500 MB).");
  } else {
    log("nada a subir.");
  }
})().catch((e) => die(e.stack || e.message));
