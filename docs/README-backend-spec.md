# maisLEAD — Ferramenta / App (Guia de Backend para Claude Code)

Arquivo de front-end: **`maisLEAD.dc.html`** — o app completo (protótipo funcional com dados simulados). Trilíngue (PT/EN/ES) e com tema claro/escuro.

> ⚠️ **REGRA PRINCIPAL — TUDO QUE JÁ ESTÁ NA INTERFACE PRECISA FUNCIONAR DE VERDADE.**
> Cada tela, botão, filtro, modal e fluxo já desenhado é a **especificação do comportamento esperado**. Nada é enfeite. Se algo não puder ser entregue, deve ser **removido da interface**, não deixado sem função.

---

## Stack sugerida
- **API:** Node.js (NestJS/Express) — REST ou tRPC.
- **Banco:** PostgreSQL. **Auth:** JWT + refresh (ou Clerk/Auth0).
- **Filas:** BullMQ/Redis para extração e disparo de e-mail.
- **Storage:** S3 para uploads (CSV de importação).

## Telas do app (o que cada uma exige do backend)
- **Dashboard** — KPIs (total, recentes, com e-mail/telefone/site, **taxa de conversão**), gráfico de leads no tempo, donut de status, origem e indústrias. → agregações reais por conta.
- **Adicionar Leads → Entrada Manual** — formulário de lead. → `POST /leads`.
- **Google Places** e **Busca em Websites** — nicho + localização, com nichos populares, buscas recentes e prévia dos campos. → **extração real** (seção Extração).
- **Leads (lista)** — busca, **filtros** (status/indústria/temperatura), **seleção em lote**, **e-mail em massa**, **importar CSV**, exportar, paginação. → CRUD + filtros server-side + jobs.
- **Detalhe do Lead (gaveta)** — todos os dados extraídos, selos de verificação, ações WhatsApp/E-mail/Ligar/Site, mudar status, "Por que esta pontuação?", notas. → ver seções abaixo.
- **Pontuação** — cards por lead com score 0–100 e temperatura, filtros Quente/Morno/Frio. → fórmula de score.
- **Linha do tempo** — histórico de eventos por lead. → tabela `lead_events`.
- **Relatórios** — abas: **Funil de conversão, Conversão por origem, Distribuição de pontuação, Por indústria, No tempo**, com KPIs e **filtro de período** (7/30/90 dias, ano) + export. → agregações reais por período.
- **Integrações** — cards de CRMs com fluxo de conexão (modal de credenciais) e estado "Conectado".
- **Assinatura** — plano atual, recursos, histórico.
- **Configurações** — webhook, formato de export, itens por página, tema, idioma.
- **Perfil** — dados do usuário editáveis.

## Modelo de dados (mínimo)
```
accounts(id, name, plan, billing_cycle, created_at)
users(id, account_id, name, email, phone, location, bio, avatar_url, role)   # role: admin|member
leads(id, account_id, company, contact, industry, location, phone, email,
      website, address, status, score, source, created_at)
  # status ∈ {new, qualified, converted}   source ∈ {google_maps, website, manual, import}
lead_tags(id, lead_id, tag)
lead_notes(id, lead_id, user_id, body, created_at)
lead_events(id, lead_id, type, payload, created_at)   # alimenta a Linha do Tempo
integrations(id, account_id, provider, credentials_encrypted, webhook_url, status)
email_templates(id, account_id, name, subject, body)
email_campaigns(id, account_id, template_id, recipient_lead_ids[], status, scheduled_at, sent_at)
```
Tudo é **multi-tenant**: todo dado escopado por `account_id`.

## 1. Autenticação & Contas (BLOQUEADOR)
Cadastro, login, recuperação de senha, verificação de e-mail. Multi-usuário por conta. Perfil editável (tela de Perfil já existe).

## 2. Extração de Leads (BLOQUEADOR — promessa central)
- `POST /extract/google-maps { niche, location }` → job na fila → leads (nome, telefone, endereço, website).
- `POST /extract/website { niche, location }` → crawling.
- Usar Google Places API (ou provedor em conformidade com ToS). Deduplicar por telefone/website dentro da conta. Respeitar limites do plano.
- Alimentar "buscas recentes" da tela com histórico real (`searches(id, account_id, query, location, count, created_at)`).

## 3. Pontuação (a MESMA fórmula está no front — a tela "Por que esta pontuação?" mostra o detalhamento)
```
score = 30 (telefone presente) + 15 (endereço completo)
      + 25 (e-mail válido)  + 20 (website ativo)
      + nicho (0–10, relevância do segmento)
score = min(100, soma)
```
Temperatura: `>=75 Quente`, `55–74 Morno`, `<55 Frio`.
> O total exibido DEVE ser a soma exata dos componentes (o front valida). Mudou peso? Mude nos dois lugares.

## 4. Verificação/Enriquecimento (selos "Verificado / Online / Não encontrado")
- **E-mail:** sintaxe + MX + (opcional) NeverBounce/ZeroBounce.
- **Telefone:** libphonenumber (formato/DDD).
- **Website:** HTTP HEAD/GET (está no ar?).
- **Enriquecimento CNPJ (plano Business):** ReceitaWS/BrasilAPI (porte, CNAE, situação) + redes sociais.

## 5. Ações sobre o Lead
- **WhatsApp:** `https://wa.me/55DDDNUMERO?text=...`.
- **Ligar / Site:** `tel:` / abrir URL.
- **Mudar status:** `PATCH /leads/:id { status }` → grava + cria `lead_event`.
- **Notas:** `POST /leads/:id/notes`.
- Toda ação relevante gera `lead_event` (aparece na Linha do Tempo).

## 6. Lista de Leads — funcionalidades já na UI
- **Busca** (server-side), **filtros** status/indústria/temperatura, **paginação**.
- **Seleção em lote** + barra de ações: e-mail em massa, adicionar tag, exportar, mudar status.
- **Exportar CSV** conforme formato em Configurações.

## 7. Importar Leads (modal de upload já existe)
- `POST /leads/import` (multipart CSV/XLSX). Colunas: `empresa, telefone, email, website, cidade, setor, endereço`.
- Validar, deduplicar, pontuar, reportar linhas com erro. Oferecer CSV modelo.

## 8. E-mail em Massa (modal com templates + variáveis já existe)
- CRUD de `email_templates` (o front traz 3: Apresentação, Follow-up, Proposta).
- Variáveis `{{empresa}}`, `{{cidade}}`, `{{setor}}` substituídas por lead no envio.
- `POST /email-campaigns { template_id, lead_ids[], subject, body, scheduled_at? }` → fila.
- Provedor: SendGrid/SES/SMTP. Anti-spam: limite diário por plano, unsubscribe, tracking (aberturas/cliques → status por lead) + relatório de campanhas.

## 9. Integrações CRM (cards + modal de credenciais já existem)
CRMs na tela: HubSpot, Salesforce, Pipedrive, Zoho, ActiveCampaign, Freshsales, RD Station, Ploomes, Agendor, PipeRun, Zapier, Make, n8n, Webhook custom.
- OAuth onde houver; API key onde for padrão. Guardar credenciais **criptografadas**.
- Ao criar/atualizar lead → enviar para CRMs conectados (mapear campos). Expor webhook de saída para Zapier/Make/n8n.

## 10. Relatórios (agregações reais por `account_id` + período)
- **Funil:** contagem por status + % de passagem (Novos→Qualificados→Convertidos).
- **Origem:** volume e taxa de conversão por canal.
- **Pontuação:** distribuição Quente/Morno/Frio + % acionável.
- **Indústria:** volume e conversão por setor.
- **No tempo:** série temporal por período (7/30/90 dias, ano).
- Todos exportáveis.

## 11. Planos, Limites & Cobrança (BLOQUEADOR para recorrência)
- **Starter (grátis):** 50 leads/mês, Google Maps, pontuação, export CSV, 1 usuário.
- **Pro:** 2.000 leads/mês, Maps+Websites, e-mail em massa, integrações, verificação, 5 usuários.
- **Business:** leads ilimitados, tudo do Pro, enriquecimento CNPJ, cadência de follow-up, API, usuários ilimitados, suporte prioritário.
- **Stripe** (ou Pagar.me/Iugu) — checkout, assinaturas, webhooks. **Enforcement de limites** por plano (contador mensal de extração; features gated). Tela de Assinatura mostra plano/uso/faturas.

## 12. Onboarding
- Tela de boas-vindas hoje aparece só no 1º uso via `localStorage: maislead_seen_v2`. No produto, controlar por `users.onboarded_at`.

---

## Prioridade
1. Auth + contas + modelo de dados + persistência de leads.
2. Extração Google Maps (promessa central).
3. Planos + Stripe + enforcement de limites.
4. Pontuação + verificação no backend.
5. E-mail em massa (fila + provedor).
6. Integrações CRM (webhook + 2–3 OAuth).
7. Importar CSV, relatórios reais, enriquecimento CNPJ, cadência.

## Contratos de API
Manter nomes de campo conforme o front consome (`empresa`, `telefone`, `status`, `score`, `origem`) ou expor um mapper. O front está pronto para receber dados reais — basta trocar os arrays simulados (`LEADS`, dados do dashboard/relatórios) por chamadas à API. Preservar i18n (PT/EN/ES) e tema claro/escuro.
