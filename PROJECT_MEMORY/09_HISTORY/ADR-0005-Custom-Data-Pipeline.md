# ADR-0005: Custom Data (Metaobjects & Metafields) Pipeline

## Status

Accepted

## Context

During the Phase 5 Migration Audit, it was identified that the original backup and restore architecture possessed zero logic for extracting or restoring Shopify's Custom Data layer (`Metaobjects`, `Metafield Definitions`). Modern Shopify Enterprise architectures depend entirely on Metaobjects for headless data schemas, component libraries, and custom B2B object models. Failing to migrate these resources results in broken visual themes and irrecoverable data loss.

## Decision

Metafield Definitions and Metaobject Definitions have been elevated to top-level, fully automated migration stages within the Imam Migration OS engine.

- `metaobjects_bulk` and `metaobject_definitions_bulk` utilize the GraphQL Bulk Operations API for unlimited size extraction.
- `metafield_definitions` utilizes the standard GraphQL cursor pagination API across all 11 `ownerTypes`.
- Custom Data resources have been injected into the `dependencyGraph` in `restore.server.ts` explicitly _before_ `products_bulk` and `collections_bulk` so that references to these definitions do not fail during restoration.

## Consequences

- **Positive**: Complete architectural replication of custom storefront data models is now possible.
- **Negative**: Metaobject definitions and metafield definitions are extremely strict regarding validations. Cross-store replication may fail if destination namespace logic collides with pre-existing Shopify native namespaces (e.g. `shopify.*`).
