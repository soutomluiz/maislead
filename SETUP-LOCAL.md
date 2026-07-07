# maisLead — Setup local & migração para novo Supabase

Este projeto foi desacoplado da **Lovable** para desenvolvimento local com Claude Code.

## O que já foi feito
- `lovable-tagger` removido do `vite.config.ts` e do `package.json`; script `gptengineer.js` removido do `index.html`.
- Título do app corrigido para **maisLead**.
- Credenciais do Supabase movidas de código hardcoded para **variáveis de ambiente** (`.env`).
- `.gitignore` limpo (tinha comandos colados por engano) e agora ignora `.env` e `supabase/restore_data.sql`.
- Arquivos vazios `git` e `main` (commitados por engano) removidos.
- Schema do banco recriado a partir do backup em `supabase/migrations/20250101000000_init_maislead.sql`.
- Dados (3 usuários, 3 perfis, 4 roles, 160 leads, 1 notificação) exportados para `supabase/restore_data.sql` (fora do git — contém hashes de senha).

## Rodar localmente
```bash
npm install
npm run dev
# abre em http://localhost:8080
```
O app lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` do `.env`. Copie de `.env.example`.

## Migrar para o novo projeto Supabase (conta abbacreatormarketing@gmail.com)
1. **Criar projeto** novo no Supabase e anotar a `Project URL` e a `anon public key`
   (Project Settings → API).
2. **Schema:** abra o SQL Editor e rode todo o conteúdo de
   `supabase/migrations/20250101000000_init_maislead.sql`.
3. **Dados (opcional, para trazer os leads/usuários existentes):** rode
   `supabase/restore_data.sql` no SQL Editor. Os logins continuam funcionando com as
   mesmas senhas (hashes bcrypt preservados).
4. **Avatares:** no Storage, o bucket `avatars` já é criado pela migração. Faça upload
   dos 2 arquivos de `pvkzcewudzvlqiwszzwi.storage.zip` (pasta `avatars/`) mantendo os
   mesmos nomes (`<user_id>.jpeg`).
5. **`.env`:** troque `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` pelos valores do
   projeto novo. Reinicie `npm run dev`.

## Edge Functions
Há 5 funções em `supabase/functions/`. Para publicá-las no projeto novo (via Supabase CLI):
```bash
supabase link --project-ref <REF_DO_PROJETO_NOVO>
supabase functions deploy create-checkout google-custom-search google-places-search send-welcome-email website-crawler
```
E configure os **segredos** (Project Settings → Edge Functions → Secrets, ou
`supabase secrets set`):

| Segredo | Usado em |
|---|---|
| `GOOGLE_MAPS_API_KEY` | google-places-search |
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | google-custom-search |
| `FIRECRAWL_API_KEY` | website-crawler |
| `STRIPE_SECRET_KEY` | create-checkout |
| `RESEND_API_KEY` | send-welcome-email |

`SUPABASE_URL` e `SUPABASE_ANON_KEY` são injetados automaticamente pelo Supabase.
