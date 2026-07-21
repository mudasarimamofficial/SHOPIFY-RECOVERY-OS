# ADR-0004: Execution Pipeline StreamReader

## Status

Accepted

## Context

During the Deep Performance Audit, it was discovered that the Restore Engine (`executor.ts`) achieved chunking by downloading the full backup JSONL into memory, decoding it into a string, parsing the entire JSONL payload into a Javascript array object structure, and then slicing out the specific offset. This operation executed inside an `O(N^2)` matrix, leading to billions of JSON parse cycles and OOM failures when operating on 10,000,000 record scale datasets.

## Decision

All array accumulation logic within the execution parsing phase is strictly prohibited. The restore pipeline MUST stream all Supabase `Blob` payloads directly into a Node.js `readline` interface wrapped around a Web `ReadableStream`. The parser must ignore lines until it reaches the execution target `offset` and then stream exactly `limit` objects.
Product/Variant grouping must occur seamlessly within the stream reader state loop, yielding a composite product grouping only when the _next_ Product ID token is parsed.

## Consequences

- **Positive**: Restore operations now have an `O(1)` memory bound and do not repeatedly parse out-of-bounds nodes, saving trillions of cycles across an enterprise migration.
- **Negative**: Relying on sequential Node stream reading means deep random-access within massive payloads is unsupported. All backup and restore logic is strictly restricted to sequential processing arrays.
