# SETUP - WolfSocial

Guia de configuracao em etapas. Siga na ordem. Cada etapa diz o que testar.

---

## Etapa 0 - GitHub Pages

1. No repositorio, va em **Settings > Pages** e defina **Source: GitHub Actions**.
2. Va em **Settings > Secrets and variables > Actions > Variables** e crie:
   - `VITE_SUPABASE_URL` (preenche na Etapa 1)
   - `VITE_SUPABASE_ANON_KEY` (preenche na Etapa 1)
3. O workflow `.github/workflows/deploy.yml` roda a cada push na `main`.
4. **Teste:** apos o primeiro push, a pagina deve abrir em
   `https://wolfsistemas.github.io/wolfsocial/` mostrando a tela de configuracao
   (Setup), porque o Supabase ainda nao estara conectado.

---

## Etapa 1 - Supabase (dados e storage)

1. Crie um projeto em https://supabase.com.
2. Em **Project Settings > API**, copie:
   - Project URL
   - anon public key
   - service_role key (esta e secreta, so para as Edge Functions)
3. Aplique a migracao. Com a CLI:
   ```bash
   supabase link --project-ref SEU_PROJECT_REF
   supabase db push
   ```
   Ou cole o conteudo de `supabase/migrations/0001_init.sql` no SQL Editor.
4. Confirme que o bucket **media** foi criado em **Storage** (publico).
5. Preencha `.env` local e as **Variables** do GitHub (Etapa 0).
6. **Teste:** o site deve mostrar a tela de login. Crie sua conta; um tenant
   e uma membership sao criados automaticamente.

---

## Etapa 2 - Edge Functions

1. Edite `supabase/config.toml` se precisar (opcional).
2. Publique as funcoes:
   ```bash
   supabase functions deploy meta-oauth-start
   supabase functions deploy meta-oauth-callback
   supabase functions deploy publish-post
   supabase functions deploy publish-due
   supabase functions deploy refresh-tokens
   ```
3. Defina os secrets das funcoes:
   ```bash
   supabase secrets set META_APP_ID=... META_APP_SECRET=...
   supabase secrets set META_GRAPH_VERSION=v21.0
   supabase secrets set META_REDIRECT_URI=https://SEU_REF.supabase.co/functions/v1/meta-oauth-callback
   supabase secrets set APP_URL=https://wolfsistemas.github.io/wolfsocial
   supabase secrets set CRON_SECRET=um-segredo-forte
   supabase secrets set TOKEN_ENC_KEY=$(openssl rand -base64 32)
   ```
   `TOKEN_ENC_KEY` precisa ter exatamente 32 bytes em base64. Guarde bem: sem
   ela os tokens salvos nao podem ser descriptografados.

---

## Etapa 3 - App Meta e permissoes

1. Em https://developers.facebook.com crie um app do tipo **Business**.
2. Adicione os produtos **Instagram** e **Facebook Login**.
3. Em **Facebook Login > Settings**, adicione a URL de redirecionamento:
   `https://SEU_REF.supabase.co/functions/v1/meta-oauth-callback`
4. Permissoes usadas pelo app:
   - `instagram_basic`
   - `instagram_content_publish`
   - `instagram_manage_comments`
   - `instagram_manage_insights`
   - `pages_show_list`
   - `pages_read_engagement`
   - `business_management`
5. Enquanto o app estiver em modo de desenvolvimento, so contas com papel no
   app (admin/testador) conseguem conectar. Como e a sua conta, adicione-se como
   admin/testador.
6. **Teste:** em **Contas**, clique em *Conectar via Facebook*. Autorize. O app
   deve voltar com "Conta conectada com sucesso".

---

## Etapa 4 - Publicar as primeiras imagens

1. Em **Midias**, envie uma imagem JPEG.
2. Em **Novo post**, formato **Imagem**, selecione a midia, escreva a legenda.
3. Clique em **Publicar agora**. Confira no Instagram.
4. **Teste de agendamento:** crie um post para daqui a alguns minutos, com
   status *Agendado*.

---

## Etapa 5 - Ativar o agendador

O agendamento real precisa de um cron externo chamando `publish-due`.

1. No Supabase, va em **Integrations > Cron** (ou use pg_cron).
2. Crie um job a cada minuto:
   - URL: `https://SEU_REF.supabase.co/functions/v1/publish-due`
   - Metodo: POST
   - Header: `x-cron-secret: <seu CRON_SECRET>`
3. Crie um job diario para `refresh-tokens` com o mesmo header.
4. **Teste:** agende um post para 2 minutos no futuro e acompanhe em **Fila**:
   ele deve passar de *Agendado* para *Publicado* automaticamente.

---

## Etapa 6 - Reels

1. Envie um video MP4 vertical (9:16).
2. **Novo post > Reels**, selecione o video, legenda e publique.
3. Videos levam de segundos a minutos para processar. Se ainda nao estiver
   pronto, o post fica *Publicando* e o worker conclui na proxima passada.
4. **Limitacao:** a API so aceita audio original. Musica licenciada (trending)
   nao e suportada.

---

## Etapa 7 - Carrossel

1. Envie de 2 a 10 imagens/videos.
2. **Novo post > Carrossel**, selecione na ordem desejada e publique.

---

## Etapa 8 - Stories (validacao)

1. **Novo post > Story**, selecione uma imagem vertical.
2. Se a Meta recusar com erro de tipo de midia, registre a mensagem: a Meta
   trata Stories via API de forma limitada e o suporte varia por conta.
3. Stories nao aceitam legenda, stickers, enquetes nem links via API.

---

## Etapa 9 - Anuncios (futuro)

As tabelas `ad_accounts` e `ad_campaigns` ja existem. A integracao real exige
permissao `ads_management` com App Review, verificacao de negocio e conta de
anuncios. Nesta fase, o trafego pago continua no Gerenciador de Anuncios da
Meta. A tela **Anuncios** apenas exibe o que estiver registrado.

---

## Solucao de problemas

- **"Nenhuma Pagina com conta profissional"**: vincule o Instagram a Pagina no
  Portifolio Empresarial e reconecte.
- **Token expirado**: o job `refresh-tokens` renova antes de vencer. Se a conta
  foi revogada, reconecte em Contas.
- **Limite de publicacao (erro 2207042)**: cota de 24h da conta atingida. O post
  vai para *Falhou*; reagende para a janela seguinte.
- **Token nao descriptografa**: `TOKEN_ENC_KEY` mudou. Reconecte a conta.
