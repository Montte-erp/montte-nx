# @core/authentication

Full authentication and authorization layer built on Better Auth. Handles user management, multi-tenant organizations, and third-party integrations.

## Exports

| Export     | Purpose                                       |
| ---------- | --------------------------------------------- |
| `./server` | Better Auth instance factory with all plugins |
| `./client` | Client-side auth SDK with React hooks         |

## Capabilities

- Email/password, magic link, and email OTP sign-in
- Google OAuth social login
- Two-factor authentication (TOTP + backup codes)
- Organization and team management (multi-tenant)
- API key management for SDK access
- Stripe subscription integration
- Session caching via Redis

## Usage

```typescript
// Server
import { auth } from "@core/authentication/server";

// Client
import { authClient } from "@core/authentication/client";
```

## Custom Fields

Custom fields on `user`, `session`, `organization`, and `team` tables are added via `additionalFields` in the Better Auth config — never by editing Drizzle schemas directly.
