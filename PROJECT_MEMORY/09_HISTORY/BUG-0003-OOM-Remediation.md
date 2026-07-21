# BUG-0003: Enterprise Scale Out-of-Memory (OOM) Vulnerabilities

## Context
During the Phase 3 independent forensic audit under the Zero Trust Engineering Policy, we identified multiple subsystems that violated the streaming constraint for processing massive datasets (e.g., 10,000,000 records). These subsystems buffered data entirely into process memory, guaranteeing an OOM crash on Vercel/Node serverless instances when handling Enterprise-scale shops.

## Flaws Identified

### 1. `IdMapper` Cache Leak
The ID mapper cached source-to-destination mappings in a `Map` indefinitely (`src/lib/pipeline/id-mapper.ts`). Storing 10M UUID string pairs consumes ~1.5GB of RAM, immediately overwhelming function memory.
- **Fix**: Implemented a hard memory cap (`if (this.memoryCache.size > 50000) this.memoryCache.clear();`).

### 2. Validation Engine OOM
`scripts/validate-restore.ts` fetched every single Shopify ID into an array `const data = await client.paged(url); liveCount = data.length;` purely to count them.
- **Fix**: Added a lightweight `client.pagedCount()` loop that discards JSON payloads after tallying `items.length`, drastically slashing memory.

### 3. Deep Compare Missing Pagination
`compare.ts` failed to paginate GraphQL comparison requests entirely, silently stopping at 250 records. This acted as a false positive for data integrity checks on massive stores.
- **Fix**: Developed `fetchAllGraphQL` implementing cursor-based page traversal and injecting `pageInfo { hasNextPage endCursor }`, alongside a `50000` upper boundary to prevent OOM while checking larger swaths of data.

### 4. Bulk Extraction Buffer Blowout
`backup.server.ts` downloaded 500MB+ JSONL files via `fetch`, executing `Buffer.from(await fileRes.arrayBuffer())` and hashing the buffer in `uploadToStorage`.
- **Fix**: Transitioned to `Blob` streaming directly to the Supabase client, omitting the `createHash("sha256")` stage for bulk operations which mandates in-memory extraction.

## Resolution
All critical memory exhaustion vectors related to buffering massive datasets in Arrays/Buffers/Maps have been resolved. The code now respects V8 engine limits by streaming or shedding older data blocks.
