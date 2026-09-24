# Facebook Login (Login do Facebook para Empresas)

Documento de referencia para habilitar e usar o caminho de login via Facebook.
O Instagram ja publica hoje pelo **Instagram Business Login**; o Facebook entra
para dar acesso a **Paginas**, **Portfolio Empresarial** e, no futuro, a
**Marketing API (anuncios)**.

---

## 1. Situacao atual

| Caminho | Produto Meta | Uso no WolfSocial | Status |
| --- | --- | --- | --- |
| `instagram` | Instagram Business Login | Publicar conteudo (imagem, Reels, carrossel, Story) | Funcionando |
| `facebook` | Facebook Login for Business | Paginas / Portfolio / Anuncios (futuro) | Em configuracao |

O erro **`Invalid Scopes: instagram_basic, ..., pages_show_list, ...`** aconteceu
porque o app e do tipo **Business** e usa o **Facebook Login for Business**. Esse
produto **nao aceita o parametro `scope`**: as permissoes vem de uma
**Configuracao de login** (`config_id`). Enviar `scope` faz a Meta recusar todos
os escopos.

---

## 2. Como o codigo escolhe o caminho

Arquivo: `supabase/functions/_shared/meta.ts`

- `authorizeUrl(authPath, redirectUri, state)`
  - `authPath = 'instagram'` -> `https://www.instagram.com/oauth/authorize` com os
    escopos `instagram_business_*`.
  - `authPath = 'facebook'`
    - se `META_FB_LOGIN_CONFIG_ID` estiver definido -> usa `config_id` (Login for
      Business).
    - senao -> usa `scope` (login classico, caso o app seja desse tipo).
- `exchangeCode(...)` troca o `code` por token e, no Facebook, busca
  `/me/accounts` para achar a **Pagina** com a **conta profissional do Instagram**.
- `refreshToken(...)` renova o token longo.

O callback grava a conta em `public.social_accounts` com `auth_path`
(`instagram` ou `facebook`). As duas conexoes **coexistem** (a unica e por
`tenant_id, auth_path, ig_user_id`).

---

## 3. Passo a passo para habilitar o Facebook Login

1. Abra o app em https://developers.facebook.com/apps.
2. No menu lateral, abra **Login do Facebook para Empresas > Configuracoes**.
3. Clique em **Criar configuracao** e escolha o tipo:
   - **Login** (recomendado para comecar): define apenas as permissoes.
   - **Integracao empresarial**: permite selecionar ativos (Paginas) no fluxo.
4. Na configuracao, selecione as permissoes:
   - Base: `business_management`, `pages_show_list`, `pages_read_engagement`
   - Instagram: `instagram_basic` (obrigatoria para a Página expor
     `instagram_business_account`), `instagram_manage_comments`
   - Futuro (anuncios): `ads_read`, `ads_management`
   - Obs.: se `instagram_basic` nao aparecer na lista, habilite primeiro o
     caso de uso de Instagram com Login do Facebook em **Casos de uso**.
5. Salve e copie o **ID da configuracao**.
6. Em **Login do Facebook > Configuracoes**, confirme que a URI de
   redirecionamento esta cadastrada:
   `https://SEU_REF.supabase.co/functions/v1/meta-oauth-callback`
7. Rode:
   ```bash
   supabase secrets set META_FB_LOGIN_CONFIG_ID=SEU_CONFIG_ID
   ```
8. Re-deploy do login:
   ```bash
   supabase functions deploy meta-oauth-start --use-api
   supabase functions deploy meta-oauth-callback --use-api --no-verify-jwt
   ```

---

## 4. Variaveis de ambiente (Edge Functions)

| Variavel | Obrigatoria | Descricao |
| --- | --- | --- |
| `META_APP_ID` | Sim | ID do app (Facebook) |
| `META_APP_SECRET` | Sim | Chave secreta do app (Facebook) |
| `META_INSTAGRAM_APP_ID` | Sim | ID do app do Instagram (Instagram Login) |
| `META_INSTAGRAM_APP_SECRET` | Sim | Chave do app do Instagram |
| `META_FB_LOGIN_CONFIG_ID` | Nao | ID da configuracao de Login for Business |
| `META_REDIRECT_URI` | Sim | `.../functions/v1/meta-oauth-callback` |
| `META_GRAPH_VERSION` | Sim | Ex.: `v21.0` |
| `APP_URL` | Sim | URL do front para onde o callback redireciona |

---

## 5. O que acontece ao conectar via Facebook

Pre-requisito: a conta profissional do Instagram precisa estar **vinculada a
uma Pagina do Facebook** (Pagina > Configuracoes > Contas vinculadas >
Instagram). Estar apenas "dentro do Portfolio Empresarial" nao basta. A API
procura a Pagina cujo campo `instagram_business_account` esta preenchido,
incluindo Paginas de Portfolio (`/me/businesses/{id}/owned_pages`).

1. Usuario autoriza o app no dialogo da Meta (com `config_id`).
2. Callback troca o `code` por token de usuario e por token longo.
3. Chama `/me/accounts` e encontra a **Pagina** com
   `instagram_business_account`.
4. Grava uma linha em `social_accounts` com `auth_path = 'facebook'` e
   `fb_page_id` preenchido.

Observacao: **publicacao de conteudo deve usar a conexao `instagram`**. O
caminho Facebook fica reservado para Paginas, Portfolio e anuncios.

---

## 6. Niveis de acesso: testador vs Acesso Avancado

Hoje as permissoes do app estao em **Acesso Padrao**. Isso define **quem**
consegue conectar:

| Permissao | Acesso Padrao (hoje) | Acesso Avancado (producao) |
| --- | --- | --- |
| `instagram_business_basic` | Admin/desenvolvedor/testador do app | Qualquer usuario |
| `instagram_business_content_publish` | Admin/desenvolvedor/testador do app | Qualquer usuario |
| `pages_show_list`, `pages_read_engagement` | Admin/desenvolvedor/testador do app | Qualquer usuario |

- **Para voce e sua equipe (ate ~25 pessoas):** adicione cada um como
  **Testador do Instagram** em **Funcoes do app > Testadores do Instagram** e
  aceite o convite no app do Instagram. Conecta **sem** App Review.
- **Para clientes externos (qualquer usuario):** e preciso **Acesso Avancado**,
  obtido via **App Review** de cada permissao. O App Review exige
  **Verificacao de Empresa (CNPJ)** concluida no Business Manager, justificativa
  de uso, screencast do fluxo e link da politica de privacidade.

Observacao: sem **Verificacao de Empresa** nao ha Acesso Avancado. Portanto o
onboarding de clientes externos (Instagram e WhatsApp/Embedded Signup) fica
bloqueado ate essa verificacao ser feita.

### Como retomar quando o CNPJ estiver pronto

1. Business Manager: concluir **Verificacao de Empresa**.
2. Developer: submeter **App Review** de `instagram_business_basic` e
   `instagram_business_content_publish` (+ `..._manage_comments` /
   `..._manage_insights` se usados).
3. Aprovado o Acesso Avancado, qualquer usuario ja consegue conectar pelo
   fluxo atual (nenhuma mudanca de codigo e necessaria).

---

## 7. Como testar

1. Em **Contas**, clique em **Conectar via Facebook**.
2. Selecione a Pagina quando a Meta pedir.
3. Deve voltar com "Conta conectada com sucesso" e aparecer uma segunda conta
   `@wolfsaas` identificada como **Via Facebook**.
4. A conexao **Via Instagram** deve continuar intacta.

---

## 8. Anuncios (etapa futura)

A integracao real com trafego pago exige:

- Produto **Marketing API** adicionado ao app.
- Permissoes `ads_read` e `ads_management` com **App Review**.
- **Verificacao de negocio** concluida.
- **Conta de anuncios** com forma de pagamento valida.

O banco ja possui `ad_accounts` e `ad_campaigns` prontos. A tela **Anuncios**
apenas exibe o que estiver registrado ate essa fase.

---

## 9. Checklist rapido

- [ ] Configuracao de Login for Business criada e `config_id` copiado
- [ ] URI de redirecionamento cadastrada
- [ ] `META_FB_LOGIN_CONFIG_ID` definido nos secrets
- [ ] Funcoes de login re-deployadas
- [ ] Conexao "Conectar via Facebook" testada e coexistindo com a do Instagram
- [ ] (Producao) Verificacao de Empresa concluida
- [ ] (Producao) App Review das permissoes com Acesso Avancado aprovado
