# maisLEAD — Roadmap de Diferenciais, Viabilidade e Custos

> Documento de estratégia de produto. Registra a análise feita em **08/07/2026** sobre
> como a maisLEAD pode sair na frente do mercado de ferramentas de captação/extração de
> leads, o que é viável, o que custa, e a arquitetura recomendada para escalar.

---

## 1. Contexto e tese

O mercado de "raspadores" (Google Maps, LinkedIn, Instagram) está saturado. O diferencial
**não está na quantidade de dados**, e sim em **inteligência, validação e automação do
próximo passo**. Quem compra ferramenta de lead não quer "dados", quer **clientes prontos
para abordar**.

A maisLEAD deve se posicionar como uma ferramenta que entrega **oportunidades qualificadas
com o script de abordagem na mão** — não só uma lista de contatos.

---

## 2. O que a maisLEAD JÁ tem hoje (baseline)

Antes de construir qualquer coisa nova, metade do "feijão com arroz" do mercado já está pronto:

| Recurso | Onde está | Status |
|---|---|---|
| Lead scoring (telefone/endereço/email/site/nicho) | `src/lib/score.ts` | ✅ Pronto (base a evoluir) |
| Validação de e-mail (sintaxe + MX) e telefone BR | Edge Function `verify-lead` | ✅ Pronto |
| Enriquecimento de e-mail via scraping (custo zero) | Edge Function `enrich-emails` | ✅ Pronto |
| Consulta CNPJ grátis (BrasilAPI) | Edge Function `verify-lead` | ✅ Pronto |
| Export CSV/JSON | `LeadsScreen` / `exportLeads` | ✅ Pronto |
| Webhooks para integrações (pg_net) | Migration `lead_webhook_dispatch` | ✅ Pronto |
| Disparo de e-mail (Resend) | Edge Function `send-emails` | ✅ Pronto |
| Extração Google Places | Edge Function `extract-google-maps` | ✅ Pronto |
| Extração de sites (Google Custom Search + scraping) | Edge Function `extract-website` | ✅ Pronto |

**Fonte tipográfica do app:** `Plus Jakarta Sans` (global, escopada em `.ml-root` via
`src/app/theme.css`, carregada em `index.html`). Não há "módulo de propostas" real — apenas
um estágio de Kanban "Proposta Enviada" em código legado desconectado
(`src/components/KanbanBoard.tsx`, não renderizado) e um template de e-mail "Proposta"
no `MassEmailModal`.

---

## 3. Avaliação das ideias (origem: análise do Gemini + filtro de viabilidade real)

### 🟢 FAÇA — barato, alto valor, base já existe

#### 1. Detecção de tecnologia do site (WordPress, Elementor, Pixel do Meta, etc.)
- **Viável?** Muito. O HTML do site já é baixado em `enrich-emails` / `extract-website`.
  Basta procurar assinaturas no HTML:
  - `wp-content` → WordPress
  - `elementor` → Elementor
  - `connect.facebook.net` / `fbevents.js` → Pixel do Meta
  - `gtag` / `google-analytics` → Google Analytics
  - `shopify`, `vtex`, `nuvemshop` → e-commerce
- **Custo:** **R$ 0** — nenhuma API nova, só regex no HTML já buscado.
- **Valor:** vira filtro E argumento de venda ("usa WordPress sem Pixel → cliente perfeito
  pra tráfego pago").

#### 2. Auditoria de Maturidade Digital (evolução do lead scoring)
- **Viável?** Sim, com escopo honesto. Pontuar de graça: tem site? tem e-mail? tem telefone?
  HTTPS? tem Pixel/Analytics? tem loja online?
- **O pega:** "Instagram sem postar há 3 meses" é a parte **cara/arriscada** — o Instagram
  bloqueia scraping e a API oficial (Graph) exige autorização do próprio lead (inviável para
  prospecção fria). **Deixar Instagram de fora** ou marcar como "não verificado".
- **Custo:** **R$ 0** para a versão baseada em site + dados já extraídos.
- **É o maior diferencial de venda e é praticamente de graça.** Só evoluir o `score.ts`.

#### 3. IA para gerar 3 mensagens de abordagem personalizadas
- **Viável?** Muito — é o recurso de maior "olho brilhando". Entrada para a IA:
  nicho + cidade + tecnologia detectada + descrição do site → 3 mensagens únicas.
- **Custo:** baixíssimo. Com **Claude Haiku 4.5**, ~**US$ 0,001–0,005 por lead**
  (fração de centavo). 1.000 leads ≈ **US$ 1–5**.
- **Implementação:** nova Edge Function `generate-outreach` + chave da Anthropic.
- Melhor custo-benefício da lista.

#### 4. Empresas recém-abertas (via Receita Federal)
- **Viável?** Sim — feature matadora de **timing**. A base de CNPJ da Receita é **pública e
  gratuita** (Dados Abertos, atualizada mensalmente, campo `data_inicio_atividade`).
- **Custo:** só **storage + processamento** no Supabase.
- **Valor:** "empresa que abriu essa semana precisa de tudo" → conversão altíssima.
- Ver arquitetura recomendada na seção 5.

#### 5. Auto-envio do primeiro contato via Telegram
- **Viável?** Sim, e **de graça** — a Bot API do Telegram é 100% gratuita.
- **Custo:** **R$ 0**. Um clique → lead entra no funil → dispara mensagem.

### 🟡 TALVEZ — bom, mas tem custo ou fricção real

#### 6. Validação de WhatsApp ("o número tem WhatsApp?")
- **A mais arriscada.** Não há API oficial gratuita. Opções:
  - Bibliotecas não-oficiais (Baileys / whatsapp-web.js) → **contra os ToS, risco de banir o
    número**.
  - Serviços pagos BR → ~**R$ 0,01–0,05 por número**.
- **Recomendação:** pular no core, ou oferecer como **add-on pago opcional** (repassar custo).

#### 7. Disparo automático por WhatsApp
- Mesmo problema. O jeito certo é a **WhatsApp Cloud API oficial (Meta)** — **paga por
  conversa** (~US$ 0,005–0,08) e exige verificação de negócio. **Deixar para v2.**
  Telegram (grátis) primeiro.

#### 8. Filtros de faturamento estimado / nº de funcionários
- Google Maps **não tem** isso. Aproximação grátis pelo **"porte" do CNPJ** (ME/EPP) e
  capital social. Dado **real** de faturamento/funcionários só em bases B2B **pagas**
  (Speedio, Econodata). **Aproximar grátis; vender o dado real como premium depois.**

### 🔴 DEIXA PRA LÁ (por agora)

#### 9. Scraping de vagas de emprego
- LinkedIn/Gupy/Catho são hostis a scraping, quebram toda semana, ROI baixo perto do
  esforço. **Alto custo de manutenção, valor médio.** Só se um cliente grande pedir.

---

## 4. Análise da CNPJá (consulta profunda)

Avaliada a pedido, com foco em: "hoje é pequena, no futuro terá muitas consultas diárias".

### O que a "consulta profunda" retorna
Vai além do básico: **status cadastral, endereço, contatos, CNAEs, e o QSA (quadro de
sócios/acionistas)**. **Simples Nacional / MEI** e Inscrição Estadual vêm de fontes
separadas (SINTEGRA/SUFRAMA) e **custam créditos adicionais**. É a consulta mais completa
do mercado BR.

### Modelo de cobrança (ponto crítico)
- **Modelo de créditos**, não de requisições. Cada tipo de dado consome uma quantidade
  diferente → **custo por consulta variável e imprevisível**.
- **Cache vs. tempo real:** dados podem ter **até ~45 dias**; dado fresco (real-time) gasta
  **créditos extras**.
- **Grátis:** ~50 créditos/mês (acaba rápido).
- **Pago:** a partir de ~**R$ 19,99/mês**, pool de créditos limitado.
- **Rate limit:** API pública **5 req/min por IP**; planos pagos aumentam o teto. Relatos
  frequentes de **429 em pico**.

### Benchmark de mercado
| Serviço | Free tier | A partir de |
|---|---|---|
| **BrasilAPI** (já usado) | Sem limite formal | **Grátis** |
| CNPJá | ~50 créditos/mês | ~R$ 19,99/mês + créditos |
| Casa dos Dados | 200 (7 dias) | R$ 0,01/consulta |
| ReceitaWS | 3 req/min | ~R$ 149/mês |
| SERPRO | 3.000 (trial) | ~R$ 662/mês |

> ⚠️ O site da CNPJá bloqueou o acesso automatizado (429) na coleta; valores vêm de busca +
> fontes comparativas. **Confirmar o preço vigente direto no painel deles antes de fechar.**

### Veredito
- **CNPJá é excelente como "lupa" pontual, péssima como "esteira" de volume.**
- No modelo de créditos, alto volume (ex.: 1.000 consultas/dia = 30k/mês) vira **centenas de
  reais/mês** + rate limit (429). **Não escala** para bulk.

---

## 5. Arquitetura recomendada — modelo HÍBRIDO

A regra de ouro para escalar sem estourar custo:

| Uso | Ferramenta | Custo | Escala |
|---|---|---|---|
| CNPJ básico pontual (já tem) | BrasilAPI | Grátis | Boa (baixo volume) |
| Bulk + recém-abertas + filtros | **Dump da Receita Federal no próprio Postgres** | Grátis (só storage) | **Infinita** |
| Enriquecimento profundo (QSA, Simples, sócios) | CNPJá **sob demanda** | ~R$ 20/mês + créditos | Ruim em massa |

**Princípios:**
1. **Não colocar a CNPJá no caminho crítico de alto volume.**
2. **Volume/bulk** → ingerir o **dump público da Receita Federal** (Dados Abertos, grátis) no
   Postgres do Supabase e consultar o **próprio banco** (custo marginal R$ 0, sem rate limit).
   Isso destrava **de uma vez** tanto os **filtros avançados** quanto **"empresas
   recém-abertas"**.
3. **Deep dive de 1 lead por vez** (quando o usuário clica) → CNPJá ou BrasilAPI, idealmente
   gateado atrás de um **tier pago**.

---

## 6. Prioridade recomendada (bang-for-buck)

1. **Tech-detection + Maturidade Digital** — grátis, HTML já é baixado → diferencial de venda #1
2. **IA de abordagem com Haiku** — centavos por lead → o "olho brilhando"
3. **Empresas recém-abertas (dump Receita no Postgres)** — grátis → timing + destrava filtros
4. **Telegram auto-send** — grátis
5. **WhatsApp (check + disparo oficial)** — v2, como add-on pago

---

## 7. Resumo de custos

| Item | Custo | Observação |
|---|---|---|
| Tech-detection | R$ 0 | Regex no HTML já buscado |
| Maturidade digital | R$ 0 | Evolução do `score.ts` |
| IA de abordagem (Haiku) | ~US$ 1–5 / 1.000 leads | Fração de centavo por lead |
| Dump Receita Federal | R$ 0 (+ storage) | Base pública, atualização mensal |
| Telegram | R$ 0 | Bot API gratuita |
| WhatsApp check | R$ 0,01–0,05/número | Pago ou não-oficial (risco) |
| WhatsApp disparo | US$ 0,005–0,08/conversa | Cloud API oficial (v2) |
| CNPJá deep (opcional) | ~R$ 20/mês + créditos | Só sob demanda, tier pago |
| **Custo recorrente atual (gargalo)** | **Google Places** ~US$ 32/1k buscas + US$ 17/1k detalhes | US$ 200/mês grátis do Google |

**Conclusão:** dá para **multiplicar o valor percebido sem multiplicar o custo** — os
diferenciais de maior impacto (tech-detection, maturidade, Telegram, Receita) são **grátis**,
e a IA custa **centavos**.

---

## 8. Próximo passo sugerido

Detalhar o plano técnico de **ingerir o dump da Receita Federal no Supabase** — é a peça que
destrava tanto os **filtros avançados** quanto **"empresas recém-abertas"**, e é grátis.
Mapear: tamanho da base, estratégia de atualização mensal e schema.

---

## Fontes consultadas (08/07/2026)
- [CNPJá — API](https://cnpja.com/en/api)
- [Comparativo de APIs de CNPJ (cnpj-api.com)](https://cnpj-api.com/blog/melhor-api-consulta-cnpj)
- [CNPJ.ws](https://www.cnpj.ws/pt-BR)
- [Catálogo gov.br — Consulta CNPJ](https://www.gov.br/conecta/catalogo/apis/consulta-cnpj)
