-- Preferência do usuário: esconder o modal de confirmação ao revelar leads.
-- Guardada no perfil (não em localStorage) pra valer em qualquer dispositivo.
alter table public.profiles
  add column if not exists hide_reveal_confirm boolean not null default false;

comment on column public.profiles.hide_reveal_confirm is
  'Se true, o usuário optou por não ver o modal de confirmação ao revelar leads. Preferência por perfil (vale em qualquer dispositivo).';
