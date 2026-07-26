# ADR 0004: Documentation Portal and Generated References

## Status

Accepted.

## Context

Daily Portal is intended to be shared as open source, accept forks and contributions, and serve as a portfolio project. The repository needs human-readable docs, API reference, and generated code references without duplicating source contracts.

## Decision

Use Astro Starlight in `docs-site/` as the documentation portal.

Generate:

- Frontend reference with Compodoc.
- Backend reference with TypeDoc.
- API reference and playground from `openapi.yaml`.
- Static source-doc links from files under `docs/`.

Publish the built documentation through GitHub Pages using `.github/workflows/docs-release.yml`.

## Consequences

The public project has a browsable documentation site and local contributors can run `npm run docs:dev`, `npm run docs:check`, and `npm run docs:build`.

The trade-off is additional CI time and documentation dependencies in the root workspace.
