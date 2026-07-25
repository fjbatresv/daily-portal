# Agent Context Graph

Daily Portal ships a committed knowledge graph under `graphify-out/` so coding agents can orient themselves before opening many files.

## Outputs

- `graphify-out/GRAPH_REPORT.md`: compact human-readable overview with communities, high-degree nodes, and suggested questions.
- `graphify-out/graph.json`: Graphify-compatible node-link data for programmatic traversal.
- `graphify-out/graph.html`: standalone interactive graph for browser inspection.

## Regeneration

Run:

```bash
source ~/.nvm/nvm.sh
nvm use
npm run graphify:repo
```

The generator is deterministic and lives at `scripts/generate-agent-graph.cjs`. It indexes tracked repository files, TypeScript imports, package manifests, documentation links, CI workflows, and selected architecture relationships.

## Agent Workflow

Before broad codebase exploration:

1. Read `graphify-out/GRAPH_REPORT.md`.
2. Use `graphify-out/graph.html` when visual navigation helps.
3. Use `graphify-out/graph.json` for scripted path or neighborhood queries.
4. Regenerate the graph when changing module boundaries, package manifests, docs structure, workflows, or deployment files.

This graph is a fast orientation aid, not a substitute for reading the source files that will be changed.
