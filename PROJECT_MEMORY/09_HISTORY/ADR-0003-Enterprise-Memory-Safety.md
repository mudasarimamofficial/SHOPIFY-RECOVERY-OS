# ADR-0003: Enterprise Memory Safety & Streaming Mandate

## Status

Accepted

## Context

Initial implementations of data extraction, validation, and verification (Deep Compare) relied on holding massive payload structures or arrays in memory. While these passed standard testing, they create fatal Out-Of-Memory (OOM) vectors when deployed against Enterprise shops (10M+ records) running in serverless environments (Node.js/Vercel with 1GB caps).

## Decision

All interactions with the Shopify API and Supabase Storage MUST adhere to a strict streaming/bounded memory mandate:

1. **No In-Memory Hashing for Bulks**: Hashing mandates full buffer ingestion. We will bypass SHA256 checksum generation for operations utilizing `fetch` payloads > 100MB, instead passing the `Blob` stream directly to Supabase.
2. **LRU Bounded Caching**: Any associative memory maps (like the `IdMapper`) must have a hard boundary. We have instituted a max size of `50,000` keys. Exceeding this boundary triggers a `Map.clear()`.
3. **No Aggregate Fetching for Counts**: Code must NOT fetch large entity collections to `.length` them. Always use `pagedCount` to discard items immediately.
4. **Hard Limits on Pagination Buffers**: In deep verification, if the dataset is loaded into memory, it must not exceed `50,000` nodes.

## Consequences

- **Positive**: Platform will not crash on 10,000,000 item catalogs.
- **Negative**: Deep Compare validation will truncate at 50,000 records, meaning full cryptographic verification of >50,000 records requires a secondary, pure-stream database validation approach instead of live-memory matching.
