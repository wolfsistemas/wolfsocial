# WhatsApp Cloud API no WolfSocial

Guia atualizado conforme o **painel da Meta de 2026** (menu por "casos de uso").
Cobre conectar um numero WhatsApp Business e:

- Enviar mensagens de teste (texto livre ou template aprovado).
- Receber mensagens via webhook (fica salvo no historico).
- Listar templates aprovados do WABA.
- Receber aviso quando um post for publicado ou falhar
  (quando o tenant liga "Avisar por WhatsApp").

Tudo serve em `whatsapp_accounts` / `whatsapp_messages` (multi-tenant + RLS) e
nas Edge Functions `whatsapp-*`. Nao precisa de servidor ligado 24h: a Meta
entrega as mensagens e chama o webhook (hospedado no Supabase).

## Arquitetura

```
[WolfSocial UI] -> whatsapp-connect  (valida numero, salva, cifra token)
                -> whatsapp-send      (envia texto/template, registra)
                -> whatsapp-templates (lista templates do WABA)
                            |
                            v
                    graph.facebook.com  (Cloud API)
                            |
        Meta  --webhook--> whatsapp-webhook (verifica assinatura, grava)
                            |
                    publish flow -> notify() -> aviso no WhatsApp
```

- Token do numero cifrado com AES-256-GCM (`TOKEN_ENC_KEY`), igual ao Instagram.
- `whatsapp-webhook` e publico (`--no-verify-jwt`) e valida `X-Hub-Signature-256`
  com o `App Secret` do app dono do produto WhatsApp.
- `WHATSAPP_VERIFY_TOKEN` e o token de verificacao do webhook.
- Opcional: `WHATSAPP_NOTIFY_TEMPLATE` + `WHATSAPP_NOTIFY_TEMPLATE_LANG`
  para avisos fora da janela de 24h (usa template aprovado).

## O painel mudou: onde ficam as coisas

O dashboard agora e organizado por **casos de uso** (use cases), com um menu
lateral a esquerda. O que antes era "Adicionar produto > WhatsApp > Set up"
virou:

| O que era | Onde esta agora |
| --- | --- |
| Add Product > WhatsApp > Set up | Use cases > **Connect with customers through WhatsApp** > **Customize** |
| API Setup (token/telefone) | Menu **API Setup** |
| WABA ID | No **API Setup** aparece como **Messaging account ID** |
| Webhooks | Menu **Configuration > Webhooks** |
| WhatsApp Manager | business.facebook.com/latest/whatsapp_manager (Account tools > Phone numbers) |

## Caminho A - Aproveitar o app que ja existe (recomendado)

Como voce ja tem o app **Wolf Social** (usado no Instagram), o ideal e adicionar
o caso de uso de WhatsApp **no mesmo app** - assim continua usando o mesmo
App Secret no webhook.

1. Abra https://developers.facebook.com/apps e entre no app **Wolf Social**.
2. No menu lateral, clique no item com o **icone de lapis / "Use cases"**
   (ou "Casos de uso").
3. Procure o card **"Connect with customers through WhatsApp"**
   ("Conectar-se com clientes pelo WhatsApp") e clique em **Customize**
   ("Personalizar"). Se aparecer **Add use case**, clique nele antes.
4. Se o card estiver **cinza / indisponivel**, va para o **Caminho B**.
5. Depois de abrir, voce cai em **Customize use case > Connect on WhatsApp >
   Quickstart**. Clique em **Start using the API**. Voce vai para o **API Setup**.

Se o card aparecer e abrir normalmente, siga direto para
"API Setup: pegar os dados".

## Caminho B - O caso de uso nao aparece no app existente

Se o WhatsApp estiver cinza/indisponivel no app atual, crie um app **so para
WhatsApp** (a Meta passou a recomendar isso no Get Started atual):

1. Abra https://developers.facebook.com/apps/creation/
2. Informe **nome** e **email** e clique **Next**.
3. Em "Select use cases", marque **Connect with customers through WhatsApp**
   e clique **Next**.
4. Selecione/crie um **portfolio de empresa** (business portfolio) e **Next**.
   - O caso de uso de WhatsApp **exige** portfolio de empresa.
5. Resolva os requisitos que aparecerem (pode pular por ora) e clique **Next**.
6. Revise e clique **Create app** / **Go to dashboard**.
7. Voce cai em **Customize use case > Connect on WhatsApp > Quickstart**.
   Clique em **Start using the API** para abrir o **API Setup**.

Atencao: se criar um app novo, o **App Secret dele e diferente** do app do
Instagram. Nesse caso me avise que eu adiciono um secret separado
(`WHATSAPP_APP_SECRET`) e ajusto o `whatsapp-webhook` para usa-lo.

## API Setup: pegar os dados

Na tela **API Setup** (menu lateral esquerdo):

1. Em **connect your app to a Messaging account**, selecione uma conta
   existente **ou** clique em **Create a WhatsApp Business account** e siga o
   fluxo. Depois de conectada, aparece o **Messaging account ID** no painel.
   - Esse **Messaging account ID** e o nosso **WABA ID**.
2. Clique em **Generate access token** para gerar o **token temporario** (24h).
   - E o nosso campo **Access token** (para teste).
3. Em **From**, escolha o numero de teste (a Meta cria um numero de teste
   automaticamente). O numero ao lado do "From" e o **Phone number ID**.
4. Em **To**, adicione o seu celular e clique **Send message** para confirmar
   que a integracao esta de pe. Responda a mensagem no celular.

Resumo do que copiar do **API Setup**:

| Dado | Onde aparece |
| --- | --- |
| Phone number ID | ao lado do numero **From** |
| WABA ID | **Messaging account ID** |
| Access token | botao **Generate access token** |

## Numero de teste x numero real

- **Numero de teste (automatico)**: entrega para ate 5 destinatarios que voce
  adicionar em **To**. Otimo para desenvolvimento.
- **Numero real**: use o **WhatsApp Manager**:
  https://business.facebook.com/latest/whatsapp_manager/
  - **Account tools (icone de caixa de ferramentas) > Phone numbers**.
  - Adicione o numero (nao pode estar em uso no WhatsApp comum; se estiver,
    e preciso excluir/desconectar antes).
  - Verifique por **SMS ou ligacao** e defina um **PIN de duas etapas**.
  - O numero precisa estar com status **Connected**.

## Configurar o webhook

No menu lateral do app: **Configuration > Webhooks** (a Meta chama de
"Webhook" tambem dentro do API Setup).

1. Clique em **Edit** / **Configure** no campo de Callback URL.
2. **Callback URL**:
   `https://rjyaqrbzsmbcxgcqivxa.supabase.co/functions/v1/whatsapp-webhook`
3. **Verify token**: o mesmo valor do secret `WHATSAPP_VERIFY_TOKEN`.
4. Clique em **Verify and save**.
5. Em **Webhook fields**, clique **Manage** e marque **messages**
   (recomendado: tambem `message_template_status_update`).

Se der erro de verificacao, confira se o token bate exatamente e se a URL nao
tem barra no final.

## Token permanente (producao)

O token de 24h nao serve para producao. Para gerar um duradouro:

1. Abra **Business Settings** > **System users**:
   https://business.facebook.com/latest/settings/system_users
2. Clique em **Add** e crie um **System user** (tipo Admin ou Employee).
3. Selecione o usuario e clique **Assign Assets**:
   - selecione o **app** e habilite **Manage app** (Full control);
   - selecione a **WhatsApp Business account (WABA)** e habilite
     **Manage WhatsApp Business accounts** (Full control);
   - clique **Assign assets**.
4. Clique em **Generate token** no system user.
5. Marque as permissoes:
   - `business_management`
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
6. Copie o token (aparece **uma vez**) e cole no campo **Access token** do
   WolfSocial, no lugar do token de teste.

Nunca cole esse token em conversa/chat; apenas no campo do WolfSocial.

## App Secret

O `whatsapp-webhook` valida a assinatura com `META_APP_SECRET`, que ja esta
configurado no Supabase. Se voce seguir o **Caminho A** (mesmo app), nao precisa
mexer. Se seguir o **Caminho B** (app novo), me informe para eu configurar.

## Como usar no WolfSocial

1. Abra **WhatsApp** no menu.
2. Preencha **Phone Number ID**, **WABA ID (Messaging account ID)**,
   **Access token**, **Telefone de alerta** e, se quiser, marque
   **Avisar por WhatsApp**. Clique **Conectar WhatsApp**.
3. Use **Enviar teste** para mandar texto livre ao seu numero.
4. **Ver templates aprovados** lista os templates do WABA.
5. **Mensagens recentes** mostra enviadas e recebidas.
6. Agende/publique um post: com o aviso ligado, o numero recebe a notificacao.

## Janela de 24h e templates

- **Texto livre** so entrega se o destinatario falou com o numero nas ultimas
  24h (ou se for destinatario de teste).
- Fora disso, a Meta exige **template aprovado**. Defina
  `WHATSAPP_NOTIFY_TEMPLATE` (ex.: template de utilidade com 2 variaveis:
  titulo e mensagem) para os avisos de publicacao.

## Problemas comuns

### Erro 130497 - "Business account is restricted from messaging users in this country"

A Meta aceita o envio (status `accepted`), mas o status logo depois e `failed`
com o codigo `130497`. Isso e uma **restricao de mensagem entre paises**:
o numero de teste americano (**+1**) nao entrega para destinatarios no Brasil.
Nao e bug do WolfSocial.

- **Receber do Brasil funciona**: o webhook recebe normalmente a mensagem que o
  usuario brasileiro manda para o numero.
- **Enviar para o Brasil nao funciona** com numero de teste dos EUA.

Como resolver:

1. **Recomendado**: registrar um **numero brasileiro** de producao (Etapa 2) e
   completar a **verificacao da empresa** (Etapa 3). Um numero local entrega
   local.
2. Preencher o **perfil/endereco** do numero no WhatsApp Manager
   (Phone numbers > perfil/Profile).
3. Alternativa temporaria para validar a integracao: testar envio para um
   destinatario em pais permitido (ex.: EUA).
4. Mensagens entre paises podem liberar apenas com escala da conta
   (limite alto, ~100 mil conversas/24h) e boa qualidade - nao e garantido.

### Erro 132000 - "Number of parameters does not match"

O template espera uma quantidade diferente de variaveis. Ajuste os
`components`/`parameters` para bater com o template aprovado.

## Secrets usados

```
WHATSAPP_VERIFY_TOKEN        token de verificacao do webhook
META_APP_SECRET              validacao de assinatura (ja existente)
WHATSAPP_NOTIFY_TEMPLATE     (opcional) template para avisos
WHATSAPP_NOTIFY_TEMPLATE_LANG (opcional, padrao pt_BR)
```

## Deploy

```bash
supabase functions deploy whatsapp-connect --project-ref <REF> --use-api

supabase functions deploy whatsapp-send --project-ref <REF> --use-api

supabase functions deploy whatsapp-templates --project-ref <REF> --use-api

supabase functions deploy whatsapp-webhook --project-ref <REF> --use-api --no-verify-jwt

supabase secrets set WHATSAPP_VERIFY_TOKEN=<valor> --project-ref <REF>
```
