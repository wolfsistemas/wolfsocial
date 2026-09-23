# WhatsApp Cloud API no WolfSocial

Integracao oficial (Meta) para o tenant conectar um numero WhatsApp Business e:

- Enviar mensagens de teste (texto livre ou template aprovado).
- Receber mensagens via webhook (fica salvo no historico).
- Listar templates aprovados do WABA.
- Enviar aviso no WhatsApp quando um post for publicado ou falhar
  (quando o tenant liga "Avisar por WhatsApp").

Tudo serve em `whatsapp_accounts` / `whatsapp_messages` (multi-tenant + RLS) e
nas Edge Functions `whatsapp-*`. Nao precisa de servidor ligado 24h: a Meta
entrega as mensagens e chama o webhook (hospedado no Supabase).

## Arquitetura

```
[WolfSocial UI] -> whatsapp-connect  (salva/valida numero, cifra token)
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
- `whatsapp-webhook` e publico (`--no-verify-jwt`) e valida a assinatura
  `X-Hub-Signature-256` com `META_APP_SECRET`.
- `WHATSAPP_VERIFY_TOKEN` e o token de verificacao do webhook.
- Opcional: `WHATSAPP_NOTIFY_TEMPLATE` + `WHATSAPP_NOTIFY_TEMPLATE_LANG`
  para avisos fora da janela de 24h (usa template aprovado).

## Passo a passo no painel da Meta

1. Em https://developers.facebook.com, abra o app **Wolf Social**.
2. **Add Product > WhatsApp > Set up**.
3. Crie/selecione um **WhatsApp Business Account (WABA)**.
4. Em **WhatsApp > API Setup**:
   - Anote o **Phone number ID**.
   - Anote o **WhatsApp Business Account ID** (WABA ID).
   - Gere o **Access token** (temporario, 24h) para teste.
   - Em **To**, adicione e verifique ate 5 numeros de teste (inclua o seu).
5. Em **WhatsApp > Configuration > Webhook**:
   - Callback URL:
     `https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook`
   - Verify token: o mesmo configurado no secret `WHATSAPP_VERIFY_TOKEN`.
   - Clique **Verify and save** e assine o campo **messages**.
6. Em **App settings > Basic**, copie o **App Secret** (se ainda nao tiver).

### Producao

- Crie um **System User** no Business Manager e gere um token permanente
  (ou use um token de longa duracao) para o numero de producao.
- Conclua a **verificacao de empresa** e a aprovacao do **display name**.
- Crie e envie templates para aprovacao (**WhatsApp > Message Templates**).

## Dados que voce precisa coletar

| Dado | Onde | Vai para |
| --- | --- | --- |
| Phone number ID | WhatsApp > API Setup | campo no WolfSocial (e cifrado o token) |
| WABA ID | WhatsApp > API Setup | campo no WolfSocial |
| Access token | WhatsApp > API Setup / System User | campo no WolfSocial (cifrado) |
| App Secret | App settings > Basic | secret `META_APP_SECRET` (ja usado) |
| Verify token | voce define | secret `WHATSAPP_VERIFY_TOKEN` |
| Callback URL | derivada | painel da Meta (Webhook) |

## Como usar no WolfSocial

1. Abra **WhatsApp** no menu.
2. Preencha **Phone Number ID**, **WABA ID**, **Access token**,
   **Telefone de alerta** (DDI+DDD+numero) e, se quiser, marque
   **Avisar por WhatsApp**. Clique **Conectar WhatsApp**.
3. Use **Enviar teste** para mandar texto livre ao seu numero.
   (Numero de teste entrega para os ate 5 destinatarios verificados.)
4. **Ver templates aprovados** lista os templates do WABA.
5. **Mensagens recentes** mostra enviadas e recebidas.
6. Agende e publique um post: com o aviso ligado, o numero recebe a notificacao.

## Janela de 24h e templates

- **Texto livre** so entrega se o destinatario falou com o numero nas ultimas
  24h (ou se for destinatario de teste).
- Fora disso, a Meta exige **template aprovado**. Defina
  `WHATSAPP_NOTIFY_TEMPLATE` (ex.: um template de utilidade com 2 variaveis:
  titulo e mensagem) para os avisos de publicacao.

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
