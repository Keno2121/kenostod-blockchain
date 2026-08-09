---
name: MetaMask Snap Submission Status
description: Weekly check protocol and submission details for UTL snap in MetaMask directory
---

## Standing Rule
Check MetaMask Snap submission status EVERY WEEK at start of session. Do not wait for user to ask.

## Submission Details
- **GitHub Issue:** https://github.com/MetaMask/snaps-directory/issues/625
- **Issue #:** 625 (open, labeled `team-core-platform`)
- **Submitted:** Feb 25, 2026
- **Last follow-up posted:** August 9, 2026

## Correct Snap Info (as of June 2026)
- **Snap ID:** `npm:kenostod-utl-snap` (unscoped, canonical)
- **npm package:** https://www.npmjs.com/package/kenostod-utl-snap
- **Version:** 2.3.0 (published May 24, 2026)
- **Live demo:** https://kenostod-website.onrender.com/utl-dashboard.html
- **Repo:** https://github.com/Keno2121/kenostod-blockchain (utl/metamask-snap/)

## Note: Two npm packages exist
- `kenostod-utl-snap` — v2.3.0 (canonical, most current)
- `@kenostod/utl-snap` — v2.0.0 (scoped, older — was used in original submission)

## Comment History
- June 7, 2026 — Correction posted (snap ID, version, website all updated)
- June 13, 2026 — Follow-up #2
- June 22, 2026 — Follow-up #3 (mentioned presale date — was incorrect, corrected July 6)
- July 6, 2026 — Follow-up #4 (corrected presale date to July 23 – Aug 6)
- August 9, 2026 — Follow-up #5 (presale complete, BOT Chain live, 2 chains now)

## Weekly Check Protocol
Run this bash check at start of each session:
```bash
curl -s "https://api.github.com/repos/MetaMask/snaps-directory/issues/625" \
  -H "Authorization: Bearer $GITHUB_PERSONAL_ACCESS_TOKEN" | python3 -c "
import json,sys; d=json.load(sys.stdin)
print('State:', d.get('state'))
print('Comments:', d.get('comments'))
print('Updated:', d.get('updated_at','')[:10])
print('Labels:', [l['name'] for l in d.get('labels',[])])
"
```
If comments increased since last check, fetch them: `GET /repos/MetaMask/snaps-directory/issues/625/comments`

**Why:** Submission has been pending 5+ months. Past delays caused by stale info. Weekly checks catch any MetaMask requests for changes before they sit for weeks unanswered.

## Node Sale Dashboard Note
Build admin node sale dashboard (sold count, holder wallets, BNB raised) ONLY when BscScan shows first mint activity on `0x45599c6be7321519Ad3eadc63D14B2CD8d994f5A`. Do not build speculatively.
