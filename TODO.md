# TODO — dívidas técnicas do maisLEAD

Lista curta de coisas pra fazer depois do lançamento. Foco atual: **lançar**.

## Segurança / dependências

### [ ] Subir o Vite 5 → 7 (corrige advisory do esbuild) — PRIORIDADE MÉDIA
- **Por quê:** `esbuild` ≤0.24.2 tem a vuln [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
  (qualquer site pode mandar requisições pro **dev server** e ler a resposta).
  O GitHub Dependabot reporta como 4 alertas (1 high, 3 moderate), mas é **1 problema-raiz só**:
  o `vite@5.4.21` depende do `esbuild@0.21.5` vulnerável.
- **Impacto real: baixo.** É **dev-only** e está em **devDependencies** — não vai pro bundle de
  produção (o Netlify serve o output estático do `vite build`; o dev server do esbuild não roda em prod).
  Só afeta a máquina de quem roda `npm run dev`, e só enquanto o dev server está no ar.
- **Por que não corrigimos agora:** não existe update seguro dentro da linha 5.x. O único fix é subir
  `vite` pra 7 (major/breaking) — `npm audit fix --force` tentaria `vite@8`. Não vale arriscar quebrar
  o build durante o lançamento por um bug que não toca produção.
- **Como fazer (depois):**
  1. Branch isolado (ex: `chore/upgrade-vite-7`).
  2. Atualizar `vite` e `@vitejs/plugin-react-swc` para as versões compatíveis com Vite 7.
  3. Rodar `npm run build` **e** `npm run dev`, testar as telas logado (login, extração, CRM, agenda).
  4. Só então merge no `main`.
- **NÃO rodar** `npm audit fix --force` direto no main (instala major sem teste).
- Registrado em 2026-07-21.

## Recursos desativados (voltam em versão futura)

### [ ] Reativar E-mail em massa (templates) — planejado pra v3
- **Status:** DESATIVADO em 2026-07-23. A UI de disparo foi escondida e a feature saiu da
  descrição dos planos e do gating, pra **não vender algo que não existe ainda**.
- **Por quê desativamos:** faltam os secrets de envio configurados; melhor esconder do que
  entregar um botão que falha.
- **O que foi mexido (tudo reversível, nada deletado):**
  - `src/app/leads/LeadsScreen.tsx` — botão "Enviar E-mail" e o mount do `MassEmailModal`
    **comentados** (procurar por "v3"). O componente `MassEmailModal.tsx` continua no repo.
  - `src/app/plan.ts` — `massEmail` removido de `Feature` e `FEATURE_MIN`.
  - `src/app/SubScreen.tsx` — item "E-mail em massa + templates" removido das feats do plano Pro (pt/en/es).
  - `supabase/functions/send-emails/index.ts` — guard no topo: retorna `403 feature_disabled`
    enquanto o secret `EMAILS_ENABLED` não for `"true"`. **Código do envio preservado** abaixo do guard.
    (deploy: v15)
- **Como RELIGAR (v3):**
  1. Configurar os secrets no Supabase: **`RESEND_API_KEY`**, **`RESEND_FROM`** (remetente verificado)
     e **`EMAILS_ENABLED=true`**.
  2. Descomentar o botão + o mount do modal em `LeadsScreen.tsx` (marcados com "v3").
  3. Voltar `massEmail` em `plan.ts` (`Feature` + `FEATURE_MIN: { massEmail: 1 }`).
  4. Voltar a feat "E-mail em massa + templates" nas feats do Pro em `SubScreen.tsx` (pt/en/es).
  5. Testar disparo logado numa conta Pro/Business antes de anunciar.
