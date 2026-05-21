# Threat Model

## Project Overview

The Sovereign Economy is a public-facing Node.js/Express application that mixes education, rewards, banking-style account features, chat, organization management, job and scholarship programs, and ICO/investor workflows. `server.js` is the main production entry point and talks directly to PostgreSQL plus third-party services such as Stripe, PayPal, Mercury, Printful, wallet tooling, and email delivery.

The production deployment is public, so any route without server-side authentication or authorization should be treated as internet-reachable. The browser is untrusted. User-supplied email addresses, wallet addresses, IDs, query parameters, headers, and request bodies must never be trusted as proof of identity or privilege.

## Assets

- **User financial and rewards data** -- claim balances, reward history, banking balances, transactions, withdrawals, deposits, scholarships, referrals, and ICO participation data. Exposure or tampering can directly impact users' money and reward entitlement.
- **User PII** -- names, email addresses, scholarship applications, job applications, chat history, KYC data, and organization membership data. Exposure creates privacy, fraud, and compliance risk.
- **Privileged business actions** -- scholarship approval, merchandise administration, investor notifications, reward issuance, and other operator-only actions. Abuse lets attackers change state or trigger business processes.
- **Application secrets and wallet material** -- database credentials, payment-provider secrets, email credentials, and any blockchain private keys used by server-side automation. Compromise can lead to full system or asset takeover.
- **Business integrity data** -- ICO investor records, analytics, student progress, internal admin workflows, and reputation-sensitive outbound notifications. Tampering can misstate business metrics or trigger spam and trust damage.

## Trust Boundaries

- **Browser to API** -- every public request crosses from an untrusted client into `server.js`. The server must authenticate and authorize sensitive reads and writes.
- **API to PostgreSQL** -- the API has broad read/write access to user, financial, scholarship, chat, and ICO tables. Missing checks at the route layer can become direct database disclosure or tampering.
- **API to external services** -- the server calls payment, email, and blockchain services with privileged credentials. Public endpoints that trigger those integrations need strict authorization and input validation.
- **Public to user-specific boundary** -- many endpoints operate on a single user's data identified by wallet, email, or numeric ID. That identifier is not an authentication token.
- **User to admin boundary** -- admin-only business actions exist in the same Express app. Admin status must be proven cryptographically or through a trusted server-side session, not asserted by a request header or body field.
- **Production to dev-only boundary** -- mockup or local-only helpers should be ignored unless they are wired into the public deployment. Public routes present in `server.js` are in scope.

## Scan Anchors

- **Production entry point:** `server.js`
- **Highest-risk code areas:** route handlers in `server.js`; auth helpers in `src/SecurityMiddleware.js`; stateful reward and scholarship logic in `src/WealthBuilderManager.js`; banking logic in `src/BankingAPI.js`
- **Public surfaces:** claims, banking, organization, student, wealth, chat, merchandise admin, ICO, monetization, and payment-related routes under `/api/`
- **Admin boundary:** routes using `adminAuth` or `securityMiddleware.requireAdmin()` need close review
- **Usually ignore unless proven reachable:** experimental/mockup assets, static marketing pages, and local development helpers not referenced by `server.js`

## Threat Categories

### Spoofing

This project heavily uses wallet addresses, email addresses, organization IDs, conversation IDs, and request headers as identifiers. In this codebase, spoofing risk is high whenever the server treats one of those values as proof of identity. Sensitive endpoints must require a valid server-side session or verified wallet signature, and admin operations must require trusted server-side authorization rather than a client-asserted wallet header.

### Tampering

The application records rewards, scholarship decisions, banking actions, investor records, and other financially meaningful state. If those workflows accept unverified client claims about who the actor is or whether a prerequisite was completed, attackers can create false records, approve benefits, or redirect value. Sensitive state changes must validate the acting principal and must derive business-critical facts server-side.

### Information Disclosure

The app stores and serves financial records, claim history, chat messages, scholarship applications, organization membership data, and KYC-related data. Any route that returns such data must be scoped to the authenticated owner or an authorized admin. Debug endpoints and broad list endpoints must not be publicly exposed in production.

### Denial of Service

Several public routes can trigger database work, email sending, or expensive business logic. Public endpoints that fan out to many users or external integrations must be rate-limited and restricted to authorized operators. Large unauthenticated read surfaces also increase scraping risk.

### Elevation of Privilege

The highest-risk class in this codebase is broken function-level authorization: a regular internet user may be able to perform admin-only actions or act on another user's data by changing an email, wallet, or ID in the request. Admin and owner checks must be enforced server-side on every privileged route, and routes must never rely on comments, client-side controls, or self-declared headers for privilege separation.
