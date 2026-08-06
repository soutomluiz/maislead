# Handoff — maisLEAD (sessão 2026-08-06)

Resumo pra continuar em outro PC. Em cada repositório, rode `git pull` antes de começar.

---

## 🎯 Objetivo da sessão
Deixar o produto pronto pra vender: remover dados fictícios do painel admin e validar
que o billing (Stripe) funciona ponta a ponta.

## ✅ O que foi feito e JÁ está no ar

### 1. Landing (`maislead.com`) — repo `maislead-landing` — commit `782a377`
- Adicionado o **vídeo de demonstração** (`demo.mp4`) na seção "Como funciona",
  logo abaixo do título (é onde o botão "Ver demonstração" leva).

### 2. Painel admin (`admin.maislead.com`) — repo `maislead-admin` — commit `df9a0a2`
- **Removidos TODOS os dados fictícios** (arquivo `src/data/mock.ts` agora só tem tipos).
  - Visão Geral: agora 100% real (MRR somado das contas, contas por plano, funil, ociosos, contas recentes).
  - Assinaturas e Financeiro: **estado vazio honesto** ("aparece quando o billing conectar").
  - Relatórios: cohort virou estado vazio.
- **Corrigido o preço do MRR**: usava 149/349 antigos; agora 99/229 (alinhado ao app).
  - Deployado como edge function **`admin-list-customers` v19** no Supabase.

### 3. App principal (`app.maislead.com`) — repo `new project` — commit `e5e8940`
- **Cupons habilitados** no Stripe Checkout (`allow_promotion_codes=true`).
  - Deployado como edge function **`stripe-checkout` v21** no Supabase.

> As edge functions (v19, v21) já estão rodando no Supabase — não dependem de deploy do site.

---

## 🔍 Estado do billing (Stripe) — confirmado

- Stripe está em **modo LIVE / produção** (chaves `sk_live_`).
- Webhook `stripe-webhook` **registrado e FUNCIONANDO**: entregas retornam `200 OK` +
  `{received:true}` → o `STRIPE_WEBHOOK_SECRET` está correto.
- **Nenhuma cobrança indevida** aconteceu. As contas de teste ficaram em Free.
- Fluxo: checkout → webhook grava `accounts.plan` + `stripe_customer_id` + `stripe_subscription_id`.
- ⚠️ Ainda NÃO houve nenhum `checkout.session.completed` de um cadastro real →
  o caminho "compra concluída → plano sobe" ainda não foi visto ponta a ponta.

---

## 📌 PENDENTE — terminar antes de vender

### 1. (CRÍTICO) Confirmar que o cadastro grava a conta até o fim
As contas criadas hoje (guia normal E anônima) **não apareceram no banco** depois.
Pode ter sido não-finalização OU bug de persistência.
**Como testar:** criar conta nova em guia anônima → depois me passar o e-mail usado →
eu confiro no banco (`accounts`/`profiles`) se gravou.

### 2. Validar a compra completa (sem cobrar)
1. No Stripe: criar cupom **100% off / duração "Para sempre"** → dentro dele, criar um
   **código promocional** (ex.: `TESTE100`). Cupom = regra; código = o que se digita.
2. Em **guia anônima**: maislead.com → Começar grátis → cadastrar (e-mail novo + empresa).
3. Assinatura → escolher plano → assinar → no Stripe clicar **"Adicionar código promocional"**
   → digitar `TESTE100` → total **R$ 0** → concluir.
4. Verificar no painel admin (dar **F5** — ele atualiza a cada ~45s) se o plano subiu.

### 3. Ajustes menores (não bloqueiam a venda)
- `profiles.email` fica **NULL** no cadastro (o trigger não copia o e-mail pro profile).
  O admin usa o e-mail do `auth.users` como fallback, então a lista não quebra.
- **UX:** ao voltar do checkout do Stripe, o app às vezes cai na tela de login
  (sessão não restaurada na hora). Inofensivo, mas confunde.
- Landing: "Começar grátis" e "Entrar" vão pra mesma URL. Ideia: deep-link `?signup`
  pra "Começar grátis" abrir direto na aba de cadastro (não confirmado).

---

## 🧰 Referência técnica
- Supabase project ref: `ddndpnibptrvurabacgi` (mesmo projeto p/ app e admin).
- Repos:
  - App: `C:\Users\atmma\Desktop\new project` (`soutomluiz/maislead`)
  - Admin: `C:\Users\atmma\Desktop\maislead-admin` (`soutomluiz/maislead-admin`)
  - Landing: `C:\Users\atmma\Desktop\maislead-landing` (`soutomluiz/maislead-landing`)
- Deploy: todos no **Netlify**, automático no push pra `main`.
- Edge functions: deploy via MCP do Supabase (CLI não instalado). Webhook URL:
  `https://ddndpnibptrvurabacgi.supabase.co/functions/v1/stripe-webhook`
- Contas reais no banco hoje: **8** (7 tester "Business" + Washington Luiz). 0 pagantes.

*(Pode apagar este arquivo quando não precisar mais — é só um handoff.)*
