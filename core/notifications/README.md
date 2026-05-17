# @core/notifications

Camada tipada de notificações do Montte, baseada em Better-Notify.

Este pacote é puro: não importa SSE nem Redis. A ideia é concentrar o catálogo, modelos e transports aqui para que os call sites de domínio usem uma camada única de notificações.

## POC atual

- `magicLink`: email transacional de acesso.
- `emailOtp`: email de códigos OTP do Better Auth.
- `organizationInvitation`: email de convite de organização do Better Auth.

Modelos usam React Email via `@betternotify/react-email`, com alternativa plain text habilitada. O envio usa `@betternotify/resend` como transporte de email.

## Canais

- Email: ativo, via Resend.
- In-app/SSE: legado fora deste pacote.
