# BUG-0004: O(N^2) JSONL Parsing Memory Blowout

## Context

During the Phase 4 Streaming & Concurrency refactor, an algorithmic catastrophe was identified in the Restore Engine. The pipeline chunks restores into batches of 50-150 items to prevent timeouts.

## Flaw Identified

For _every single chunk_, `restore.server.ts` would invoke `await fileData.arrayBuffer()` to download the entire backup `Blob`. The `executor.ts` would then decode the full buffer into a string, invoke `.split('\n')`, and call `JSON.parse` across the entire 1,000,000-item array, only to `.slice()` 50 items and discard the rest.
On a 10M record store, this translates to 10M parses * 200,000 chunks = 2 Trillion JSON parse operations. This caused exponential memory blowouts, extreme serverless timeout billing, and reliable OOM crashes.

## Resolution

- Replaced the string ingestion with a pure `ReadableStream` line-by-line streaming parser using Node's `readline` API.
- The `executor.ts` now accepts a `Blob` instead of an `ArrayBuffer`. It streams the data until it reaches the target `offset`, parses exactly `limit` items, and closes the stream with `O(1)` memory bounding.
- Background worker promise leakage inside `runWithConcurrency` was patched by introducing a synchronized `hasError` cancellation flag to halt sibling workers gracefully if one fails.
