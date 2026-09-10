---
name: Production startup isolation
description: Keep core database-backed services online when optional production integrations are unavailable.
---

# Production startup isolation

- Core database initialization must not share a failure boundary with optional AI, Telegram, payment, or bot integrations.
- **Why:** An unavailable AI credential on Render once aborted startup before Wealth Builder initialized, making scholarship applications return 503 even though AI was unrelated.
- **How to apply:** Initialize core database-backed services independently, catch optional integration failures locally, and verify Render has `DATABASE_URL` before testing production.

- Render is the active origin for `kenostodblockchain.com`; update it through its GitHub `main` deployment path rather than Replit Publish.
- **Why:** Replit Publish can replace the domain's DNS routing, while Render already owns the live server and production environment.
- **How to apply:** Push verified changes to GitHub, wait for the exact Render deployment to become live, inspect fresh startup logs, and test the custom domain.