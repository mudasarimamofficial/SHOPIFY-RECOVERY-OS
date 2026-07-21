---
id: ACCEPTANCE-FORENSIC-20260721
title: Enterprise Forensic Audit — 2026-07-21
status: FAILED
importance: CRITICAL
owner: Imam Recovery OS
last_verified: 2026-07-21
verification_method: Clean-room static review, local execution, live Supabase CLI inspection, and deployed-browser smoke tests
acceptance_status: REJECTED
---

# Enterprise Forensic Audit — 2026-07-21

## Release decision

**REJECTED — do not deploy, release, or certify this revision for production migration use.**

This is a fresh review. It supersedes prior local claims of production readiness. No application source was changed during this audit; the working tree was already materially dirty before the audit began.

## Fresh evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| Production build | ✅ VERIFIED | `npm run build` completed successfully on 2026-07-21. |
| Unit tests | ✅ VERIFIED | `npx vitest run --reporter=verbose`: 23/23 tests in 4 files passed. |
| Browser smoke tests | ✅ VERIFIED | `npx playwright test`: 3/3 production-hosted unauthenticated/auth-page smoke tests passed. |
| Dependency vulnerability scan | ✅ VERIFIED | `npm audit --json`: 0 reported vulnerabilities. |
| Memory consistency tool | ✅ VERIFIED | `npm run memory:verify`: health score 96. This checks documentation structure, not behavioral correctness. |
| Lint | ❌ FAILED | `npx eslint src tests` reported 3 Prettier errors in `src/lib/shopify.server.ts`. Repository-wide lint exceeded 60 seconds. |
| TypeScript type gate | ❌ FAILED | `npx tsc --noEmit` did not complete within the 60-second execution budget; package scripts do not provide a typecheck gate. |
| Production schema parity | ❌ FAILED | `supabase migration list --linked` shows local migrations 20260718000000, 20260718120000, and 20260720172300 absent remotely, and remote migrations 20260717191656 and 20260718082113 absent locally. |
| Shopify live verification | ⚠️ BLOCKED BY EXTERNAL DEPENDENCY | No usable Shopify Admin token or app credentials were present. Shopify CLI project inspection timed out/non-interactively could not establish account state. |
| Vercel control-plane verification | ⚠️ BLOCKED BY EXTERNAL DEPENDENCY | `vercel whoami --no-color` timed out. Deployment is browser-reachable, but CLI identity and production environment parity were not verified. |

## Release-blocking findings

1. **CRITICAL — committed credential material.** `.env`, `.env.production`, `.vercel.env`, and `.vercel.prod.env` are tracked and contain a non-empty `VERCEL_OIDC_TOKEN`. The token is also present in `HEAD` and historical commits. `scripts/fetch-stores.ts` decrypts and prints Shopify access tokens. Rotate/revoke exposed credentials, remove the token-printing tool, and make an approved forward-only history remediation plan before release.
2. **CRITICAL — cross-tenant restore authorization bypass.** `startRestoreFn` inserts with the service-role client using caller-provided backup, store, and plan values. `stepRestoreFn` advances any supplied job ID with service-role access. Neither validates ownership or recomputes the plan server-side.
3. **CRITICAL — privacy deletion is incomplete.** `shop/redact` deletes only the `stores` row; recovery-package storage objects containing store and customer data remain. `customers/redact` only returns 200 despite backed-up customer PII. This does not meet Shopify compliance-webhook obligations.
4. **CRITICAL — production migration state is unsupported.** The configured Admin API version is `2024-10`, which is no longer supported; Shopify falls unsupported versions forward. The implementation relies heavily on the legacy REST Admin API, while Shopify directs new development to GraphQL.
5. **HIGH — recovery claim exceeds implementation.** The public resource catalog labels many resources `full`, but the backup flow only collects shop, locations, collections, pages, blogs/articles, redirects, policies, theme assets, products, customers, and orders. The executable restore plan only enables locations, products, collections, pages, blogs, articles, redirects, and customers. Policies, themes, orders, and all other catalog items are not executable cross-store restores.
6. **HIGH — data loss and false-success paths.** Theme asset backup catches fetch failures and writes empty placeholder assets, then marks the resource completed; asset restore catches failures and continues. Restore completion permits `completed_with_failures`; no verified rollback is implemented. The recovery SDK has a separate incompatible `manifest.json`/encrypted-resource format that is not used by the active backup path and contains a default signing-secret fallback.
7. **HIGH — not enterprise-scale.** Bulk result downloads, restoration parsing, verification, and package downloads buffer entire payloads in memory. The advertised streaming implementation also buffers full payloads. The verifier checks only the first 250 top-level objects (and 50 variants), with no pagination.
8. **HIGH — migration correctness unverified.** The active package format is `recovery/2` but uses unencrypted storage payloads. Restore and verifier logic have no integration, failure-injection, resume, rollback, or large-store tests. The local test suite exercises neither live backup nor restore.
9. **MEDIUM — operational concurrency/reliability gaps.** The SQL queue has no connected worker/cron execution path, no stale-lock recovery, and comments acknowledge its lock protocol is only a workaround. Backup state transitions are not compare-and-swap protected; concurrent calls can duplicate stages or race the single Shopify bulk operation.
10. **MEDIUM — governance mismatch.** `AGENTS.md` mandates `/PROJECT_BRAIN/00_START_HERE`, but that layout is absent; maintained material is in `/PROJECT_MEMORY`. The repository is heavily dirty, including deletion of the previous pipeline and documentation churn, so no revision is reproducibly reviewable.

## Shopify capability assessment

`Implemented` below means source code contains an attempted handler, not that behavior was live-verified.

| Resource group | Status | Notes |
| --- | --- | --- |
| Products, variants, product media, inventory levels | Partial implementation | GraphQL Bulk backup and `productSet` restore; media/inventory are capped in query shape; no live validation, paging, rollback, or deep comparison at scale. |
| Locations | Partial implementation | Backs up locations; restore only maps to an already-existing same-named destination location. |
| Smart/custom collections | Partial implementation | Bulk backup and attempted GraphQL create/update; dependency mapping relies on product IDs. |
| Pages, blogs, articles, redirects | Partial implementation | REST backup/restore only; no complete field fidelity, idempotency proof, or live validation. |
| Customers | Partial implementation | Basic fields only; addresses, consent, and privacy deletion are absent. |
| Orders | Backup only | Attempted bulk extraction; restore planner disables execution. |
| Theme assets/settings/app blocks/embeds | Backup only / unsafe | Active theme assets collected, but cross-store restore is disabled; errors may be silently converted to empty assets. |
| Store policies/settings | Backup only | Policies are collected but skipped by restore. |
| Files, metafields, metaobjects, menus, navigation, translations/locales, markets, price lists, discounts, selling plans, delivery/shipping, fulfillment, taxes, pixels, consent, search, storefront settings, companies/B2B, catalogs, publications, gift cards, subscriptions, webhooks | Missing implementation | Some are represented in the UI catalog but have no active backup-and-restore implementation or verification coverage. |
| GraphQL Bulk Operations | Partial implementation | One active-operation model, full-buffer download, no robust recovery/claiming, and limited resources only. |
| GraphQL API | Partial implementation | Used for selected resources, but API version is retired and response error/schema compatibility is unverified. |
| REST fallback | Partial implementation | Used broadly despite REST legacy status; retry exists but lacks request timeout/abort and observability. |

## Required remediation before reassessment

1. Immediately rotate/revoke the exposed Vercel OIDC credential; remove all tracked environment files and token-printing scripts through an approved forward-only remediation. Audit provider logs for use of the exposed token.
2. Add server-side ownership checks to every service-role operation; derive restore plans on the server from validated backup/store ownership and reject arbitrary plans/job IDs.
3. Implement compliant customer/shop data request, redaction, and storage-object deletion flows, with durable audit evidence and tests.
4. Reconcile Supabase migration history before any production change; use a reviewed migration repair/deployment plan rather than force operations.
5. Upgrade to a supported Shopify API version and move active REST-dependent workflows to supported GraphQL APIs; validate generated queries against the selected schema.
6. Reduce the capability matrix to truthful, tested claims or implement each claimed resource with backup, restore, dependency mapping, idempotency, resume, rollback policy, verification, metrics, and tests.
7. Replace full-buffer archive/download/parse paths with bounded streaming/chunking; add request timeouts, per-store concurrency controls, durable leases, and execution telemetry.
8. Establish CI gates for format/lint, typecheck, unit/integration tests, migration parity, secret scanning, and authenticated end-to-end recovery tests using isolated Shopify stores.

## External evidence

Shopify’s current versioning schedule shows `2024-10` is outside the accessible versions in July 2026, and Shopify recommends current quarterly API updates. Shopify also identifies the REST Admin API as legacy and requires compliance webhooks to process stored customer data.

- https://shopify.dev/docs/api/usage/versioning
- https://shopify.dev/docs/api/admin-rest/usage/versioning
- https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance

## Certification

| Engineering gate | Classification |
| --- | --- |
| Build and public smoke rendering | ✅ VERIFIED |
| Dependency vulnerability scan | ✅ VERIFIED |
| Unit behavior | ✅ VERIFIED, but insufficient scope |
| Code quality gate | ❌ FAILED |
| Tenant isolation and authorization | ❌ FAILED |
| Secret management | ❌ FAILED |
| Shopify privacy compliance | ❌ FAILED |
| Production database parity | ❌ FAILED |
| Supported Shopify API compatibility | ❌ FAILED |
| Backup/restore correctness, resume, rollback, verification | ❌ FAILED |
| Enterprise-scale performance | ❌ FAILED |
| Live Shopify store validation | ⚠️ BLOCKED BY EXTERNAL DEPENDENCY |
| Vercel control-plane validation | ⚠️ BLOCKED BY EXTERNAL DEPENDENCY |

**Final certification: NOT APPROVED FOR PRODUCTION.**
