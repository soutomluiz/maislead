# Plano Técnico — Ingestão da base da Receita Federal no Supabase

> Companion do `roadmap-diferenciais-e-custos.md`. Detalha COMO trazer os Dados Abertos de
> CNPJ da Receita Federal para dentro do Postgres do Supabase, para destravar **"empresas
> recém-abertas"** e **filtros avançados** — respeitando a restrição crítica de custo.
> Escrito em 09/07/2026.

---

## 0. A restrição que define o plano: FREE tier = 500 MB

- Projeto Supabase `ddndpnibptrvurabacgi`, org **plano FREE** → **limite de 500 MB de banco**.
- Já existem tabelas do app (leads, searches, etc.) ocupando parte disso → orçamento real
  disponível ~**350–400 MB**.
- A base completa da RF (≈60 M empresas + 60 M estabelecimentos + 24 M sócios) descompactada
  passa de **40–50 GB**. **Não cabe. Nem perto.**

**Conclusão inescapável:** não se ingere a base inteira. Ingere-se uma **fatia filtrada e
enxuta**, montada FORA do banco (no script de ingestão) e só o resultado curado entra no
Postgres. O plano abaixo é desenhado para caber no free tier, com um gatilho claro de upgrade
para Pro (8 GB, US$ 25/mês) quando/se o volume justificar.

---

## 1. Como os Dados Abertos da RF realmente são

- **Fonte oficial:** `https://dadosabertos.rfb.gov.br/CNPJ/` (pasta por ano-mês). Atualização
  **mensal** (sai por volta da 2ª semana do mês).
- **Formato:** CSV, delimitador `;`, qualificador `"`, encoding **ISO-8859-1 (Latin-1)** →
  precisa **transcodificar para UTF-8** na ingestão. Datas em `AAAAMMDD` (`0`/`00000000` = nulo).
  Capital social usa **vírgula decimal**.
- **Arquivos** (cada um dividido em 10 partes `.zip`, exceto lookups e Simples):
  - `Empresas0..9.zip` — 7 colunas: `cnpj_basico, razao_social, natureza_juridica,
    qualificacao_responsavel, capital_social, porte, ente_federativo`.
    (`porte`: 01=ME, 03=EPP, 05=Demais, 00=n/a)
  - `Estabelecimentos0..9.zip` — 30 colunas. As que importam:
    `cnpj_basico, cnpj_ordem, cnpj_dv, matriz_filial, nome_fantasia, situacao_cadastral
    (02=ativa), data_situacao, data_inicio_atividade, cnae_principal, cnae_secundaria (lista),
    logradouro/numero/bairro/cep, uf, municipio(cod), ddd1, telefone1, correio_eletronico(email!)`.
  - `Simples.zip` — `cnpj_basico, opcao_simples, data_opcao, data_exclusao, opcao_mei, ...`.
  - `Socios0..9.zip` — QSA (nome sócio, qualificação, faixa etária...). **Fora do escopo Fase 1.**
  - Lookups pequenos (carregar 1×): `Cnaes, Municipios, Naturezas, Qualificacoes, Motivos, Paises`.
- **Pontos de ouro para a maisLEAD:**
  - `data_inicio_atividade` → alimenta direto **"recém-abertas"**.
  - `correio_eletronico` → **e-mail grátis** já na base (complementa o `enrich-emails`).
  - `situacao_cadastral`, `cnae`, `uf/municipio`, `porte`, `capital_social`, `opcao_mei` →
    **filtros avançados** sem depender de API paga.
- **Detalhe de timing:** o dump reflete a base no fechamento do mês. Uma empresa aberta ontem
  aparece só no próximo dump. "Recém-aberta" na prática = aberta nos **últimos ~30–60 dias**
  relativo à data do dump. É suficiente para a proposta de valor.

---

## 2. Estratégia: faseada, "filtra fora, guarda pouco"

### Fase 1 — Recém-abertas (MVP, cabe no free tier)
Ingerir **apenas** estabelecimentos que satisfaçam TODOS os critérios, montados por filtro no
script (streaming), nunca carregando a base toda no banco:
- `situacao_cadastral = 02` (ativa)
- `data_inicio_atividade >= (mês do dump − N dias)` (N configurável, começar com 60)
- **escopo geográfico/CNAE opcional** (ver §7 Decisões) — o maior corte de tamanho

Para cada estabelecimento que passa no filtro, coletar o `cnpj_basico` e puxar as linhas
correspondentes de `Empresas` e `Simples` (2ª passada / lookup em memória). Assim as 3 tabelas
ficam pequenas e consistentes.

**Footprint estimado (nacional, 60 dias, ativas):** ~ centenas de milhares de linhas →
~150–250 MB. **Cabe apertado.** Com recorte por UF/CNAE, cai para dezenas de MB (folgado).

### Fase 2 — Filtros em massa (só com Supabase Pro)
Base ampla (todas as ativas de um estado, ou nacional) para filtros ricos. Requer **Pro
(8 GB)**. Mesmo schema; só muda o filtro de ingestão e o tier. **Gatilho de upgrade**, não agora.

### Fase 3 — Deep dive por lead (QSA/sócios)
Não vem do dump em massa — usa CNPJá/BrasilAPI **sob demanda**, gateado atrás de tier pago
(conforme roadmap §5). Fora deste plano.

---

## 3. Schema proposto (enxuto, indexado para os filtros)

Prefixo `rf_` para separar dos dados do app. Colunas cortadas ao mínimo útil.

```sql
-- Estabelecimentos filtrados (tabela principal de consulta)
create table rf_estabelecimento (
  cnpj            char(14) primary key,        -- básico+ordem+dv concatenado
  cnpj_basico     char(8)  not null,
  razao_social    text,                        -- desnormalizado de rf_empresa (evita join)
  nome_fantasia   text,
  situacao        smallint,                    -- 2=ativa
  data_abertura   date,                        -- data_inicio_atividade
  cnae_principal  char(7),
  cnae_secundaria char(7)[],                   -- array p/ filtro GIN
  porte           smallint,                    -- 1=ME 3=EPP 5=demais
  capital_social  numeric(15,2),
  opcao_mei       boolean,
  opcao_simples   boolean,
  uf              char(2),
  municipio_cod   char(4),
  municipio_nome  text,                         -- desnormalizado do lookup
  bairro          text,
  cep             char(8),
  ddd1            varchar(4),
  telefone1       varchar(15),
  email           text,
  ingested_at     timestamptz default now(),
  dump_ref        text                          -- ex '2026-07' p/ saber a origem
);

create index rf_estab_abertura   on rf_estabelecimento (data_abertura desc);
create index rf_estab_uf_mun      on rf_estabelecimento (uf, municipio_cod);
create index rf_estab_cnae        on rf_estabelecimento (cnae_principal);
create index rf_estab_cnae_sec    on rf_estabelecimento using gin (cnae_secundaria);
create index rf_estab_situacao    on rf_estabelecimento (situacao);
create index rf_estab_nome_trgm   on rf_estabelecimento using gin (razao_social gin_trgm_ops);

-- Lookups pequenos (carregados 1×, raramente mudam)
create table rf_cnae      (codigo char(7) primary key, descricao text);
create table rf_municipio (codigo char(4) primary key, nome text, uf char(2));
```

> **Desnormalização proposital:** `razao_social`, `municipio_nome`, `porte`, `opcao_*` já
> gravados na linha do estabelecimento → consulta sem joins, e não precisamos manter
> `rf_empresa`/`rf_simples` inteiras ocupando espaço. Elas são usadas só durante a ingestão.

Extensão necessária: `pg_trgm` (para busca por nome). `create extension if not exists pg_trgm;`

---

## 4. Pipeline de ingestão (onde a mágica — e o peso — acontece)

**Não dá para fazer via Edge Function** (Deno tem limite de ~150 s e ~256 MB; o dump tem GBs).
A ingestão roda **fora do Supabase**, num script Node (ou Python) executado localmente ou numa
**GitHub Action** mensal. Só o resultado filtrado vai para o banco via `COPY` (caminho mais
rápido do Postgres).

**Passos do script `ingest-rf`:**
1. **Descobrir a pasta do mês** mais recente em `dadosabertos.rfb.gov.br/CNPJ/`.
2. **Baixar** os 10 `Estabelecimentos*.zip` (~4–5 GB), `Empresas*.zip`, `Simples.zip` e os
   lookups. (Download é o gargalo — ~5–6 GB/mês de banda local.)
3. **Streaming + filtro:** descompactar em stream, transcodificar Latin-1→UTF-8, parsear CSV
   linha a linha e **manter só as que passam no filtro da Fase 1**. Guardar num arquivo
   intermediário enxuto + um `Set` de `cnpj_basico` selecionados.
4. **2ª passada** em `Empresas`/`Simples`: manter só as linhas cujo `cnpj_basico` está no `Set`
   → montar as colunas desnormalizadas (razão social, porte, capital, mei/simples).
5. **Resolver lookups** (município cod→nome) em memória.
6. **`COPY`** o CSV final curado para uma **staging table** `rf_estabelecimento_stg` via conexão
   Postgres direta (connection string do Supabase).
7. **Swap idempotente** numa transação:
   ```sql
   begin;
   truncate rf_estabelecimento;
   insert into rf_estabelecimento select * from rf_estabelecimento_stg;
   drop table rf_estabelecimento_stg;
   commit;
   ```
   (Alternativa incremental: `insert ... on conflict (cnpj) do update` + prunar linhas com
   `data_abertura` fora da janela, para acumular histórico curto sem crescer sem limite.)
8. **Validar:** contar linhas, checar amostra, logar `dump_ref`.

**Automação:** uma **GitHub Action** com `schedule: cron` (1× ao mês, dia 15) rodando o script,
com a connection string em secret. Ou rodar manualmente da máquina quando sair o dump novo —
começar manual, automatizar depois.

---

## 5. Integração no app

1. **Edge Function `search-receita`** (verify_jwt on) — espelha o padrão do `extract-cnpj`:
   recebe filtros (uf, municipio, cnae, porte, dias_desde_abertura, tem_email...), consulta
   `rf_estabelecimento`, aplica **auth + limite de plano/cota** (admin = ilimitado, igual às
   outras extrações), retorna página de resultados. **Nunca** expor a tabela direto ao anon.
2. **Tela / filtros no app** — pode ser uma aba na `CnpjScreen` ("Recém-abertas") ou uma tela
   nova "Base Receita", com filtros: UF, cidade, CNAE, porte, "abertas nos últimos [30/60] dias",
   "só com e-mail". Resultado → **staging igual ao CNPJ** (preview → seleciona → importa),
   consumindo cota só no import, dedup por `leads.cnpj`.
3. **Mapa para `leads`** (reusa o que já existe no `extract-cnpj`): CNAE→industry,
   cidade/UF→location, porte/situação/capital→notes, `data_abertura`→opening_date,
   `email`→email (+ score +25), `type = 'cnpj'`.

---

## 6. Custos reais (honestidade vs. o "R$ 0" otimista do roadmap)

| Item | Custo real |
|---|---|
| Storage no Supabase (Fase 1, free) | **R$ 0** — se a fatia couber em ~350 MB |
| Banda/compute da ingestão mensal | **R$ 0** em $, mas ~5–6 GB download + ~30–60 min CPU/mês (sua máquina ou GitHub Action grátis) |
| Fase 2 (base ampla) | **Supabase Pro US$ 25/mês** (8 GB) — gatilho de upgrade |
| CNPJá deep-dive (Fase 3) | ~R$ 20/mês + créditos, sob demanda, tier pago |

> O roadmap diz "grátis (só storage)". Correto **em dólares**, mas no **free tier de 500 MB**
> "só storage" **é** a restrição dura. Por isso Fase 1 é obrigatoriamente uma fatia filtrada.

---

## 7. Decisões que preciso de você antes de codar

1. **Escopo geográfico da Fase 1:** nacional (aperta o free tier) ou começar por **1–2 estados**
   (ex.: SP)? Recorte por UF é o maior fator de caber com folga.
2. **CNAEs alvo:** filtrar por nichos específicos (ex.: comércio, serviços) ou trazer todos?
3. **Incluir MEI?** MEIs são volume enorme. Se o público-alvo dos seus clientes são PMEs com
   verba, talvez excluir MEI (`opcao_mei=false`) enxugue muito e melhore a qualidade.
4. **Janela "recém-aberta":** 30 ou 60 dias?
5. **Ingestão:** roda manual da sua máquina no início, ou já monto a **GitHub Action** mensal?
6. **Ficar no free** e caber na fatia, ou topa migrar pro **Pro (US$ 25/mês)** e destravar a
   Fase 2 (filtros em massa nacionais) de uma vez?

---

## 8. Ordem de implementação sugerida

1. Criar extensão `pg_trgm` + tabelas `rf_*` (migration).
2. Escrever o script `ingest-rf` (download→filtro→COPY→swap) e rodar 1× manual com escopo
   pequeno (ex.: só SP, 60 dias, sem MEI) para validar tamanho real no banco.
3. Edge Function `search-receita` (auth + cota + filtros).
4. UI: aba/tela de recém-abertas com o fluxo de staging→import (reusa componentes do CNPJ).
5. Automatizar ingestão (GitHub Action mensal).
6. Só então avaliar Fase 2 (upgrade Pro) conforme demanda.
