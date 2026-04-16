# @core/transactional

Transactional email system using Resend + React Email. Handles authentication emails, organization invitations, and operational alerts.

## Exports

| Export       | Purpose                          |
| ------------ | -------------------------------- |
| `./client`   | Email sending functions          |
| `./utils`    | Resend client factory            |
| `./emails/*` | React Email templates            |

## Email Templates

| Function                       | Purpose                                                                  |
| ------------------------------ | ------------------------------------------------------------------------ |
| `sendMagicLinkEmail()`         | Passwordless sign-in links                                               |
| `sendEmailOTP()`               | One-time passwords (sign-in, verification, password reset, email change) |
| `sendOrganizationInvitation()` | Team invitation emails                                                   |
| `sendBudgetAlert()`            | Budget threshold notification emails                                     |

## Usage

```typescript
import { sendEmailOTP } from "@core/transactional/client";

await sendEmailOTP({ email, otp, type: "sign-in" });
```

## Details

All emails are sent from `Montte <suporte@mail.montte.co>` in Brazilian Portuguese (pt-BR). Templates are built with `@react-email/components` and rendered server-side.
