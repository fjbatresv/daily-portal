#!/usr/bin/env node

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { basename, dirname, extname, join, relative } = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.cwd();
const outDir = join(root, 'graphify-out');

const trackedFiles = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((file) => !file.startsWith('node_modules/'))
  .filter((file) => !file.startsWith('dist/'))
  .filter((file) => !file.startsWith('backend/dist/'))
  .filter((file) => !file.startsWith('docs-site/dist/'))
  .filter((file) => !file.startsWith('docs-site/public/reference/'))
  .filter((file) => !file.startsWith('graphify-out/'));

const nodes = new Map();
const edges = [];

const communityByPrefix = [
  [/^backend\/src\/integrations\/jira\//, 'Jira Integration'],
  [/^backend\/src\/integrations\/github\//, 'GitHub Integration'],
  [/^backend\/src\/integrations\/google-calendar\//, 'Calendar Integration'],
  [/^backend\/src\/integrations\/slack\//, 'Slack Integration'],
  [/^backend\/src\/telegram\//, 'Telegram Delivery'],
  [/^backend\/src\/scheduler\//, 'Scheduler'],
  [/^backend\/src\/dashboard\//, 'Dashboard Aggregation'],
  [/^backend\/src\/reminders\//, 'Reminders Persistence'],
  [/^backend\/src\/common\//, 'Backend Infrastructure'],
  [/^backend\//, 'Backend Application'],
  [/^frontend\/src\/app\/features\/dashboard\//, 'Frontend Dashboard'],
  [/^frontend\/src\/app\/features\/todo\//, 'Frontend Todo'],
  [/^frontend\/src\/app\/features\/sources\//, 'Frontend Sources'],
  [/^frontend\/src\/app\/core\//, 'Frontend Core'],
  [/^frontend\//, 'Frontend Application'],
  [/^docs-site\//, 'Documentation Portal'],
  [/^docs\/adr\//, 'Architecture Decisions'],
  [/^docs\//, 'Project Documentation'],
  [/^\.github\//, 'Automation and Release'],
  [/^(docker-compose|nginx\/|backend\/Dockerfile|db\/)/, 'Deployment Runtime'],
];

function communityFor(file) {
  return communityByPrefix.find(([pattern]) => pattern.test(file))?.[1] ?? 'Repository Root';
}

function fileType(file) {
  const ext = extname(file);
  if (['.ts', '.js', '.cjs', '.mjs'].includes(ext)) return 'code';
  if (['.md', '.txt'].includes(ext)) return 'document';
  if (['.yml', '.yaml', '.json', '.sql'].includes(ext)) return 'config';
  if (['Dockerfile'].includes(basename(file))) return 'config';
  return 'asset';
}

function nodeId(file) {
  return `file:${file}`;
}

function addNode(file, extra = {}) {
  const id = nodeId(file);
  if (!nodes.has(id)) {
    nodes.set(id, {
      id,
      label: file,
      file_type: fileType(file),
      source_file: file,
      community: communityFor(file),
      ...extra,
    });
  }
  return id;
}

function addEdge(
  source,
  target,
  relation,
  confidence = 'EXTRACTED',
  confidenceScore = 1.0,
  sourceFile = null,
) {
  if (!nodes.has(source) || !nodes.has(target) || source === target) return;
  const duplicate = edges.some(
    (edge) => edge.source === source && edge.target === target && edge.relation === relation,
  );
  if (!duplicate) {
    edges.push({
      source,
      target,
      relation,
      confidence,
      confidence_score: confidenceScore,
      source_file: sourceFile ?? nodes.get(source).source_file,
      weight: confidence === 'EXTRACTED' ? 1.0 : 0.65,
    });
  }
}

function read(file) {
  return readFileSync(join(root, file), 'utf8');
}

for (const file of trackedFiles) {
  addNode(file);
}

const fileSet = new Set(trackedFiles);

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = join(dirname(fromFile), specifier);
  const candidates = [
    `${base}.ts`,
    `${base}.js`,
    `${base}.cjs`,
    `${base}.mjs`,
    `${base}.json`,
    join(base, 'index.ts'),
    join(base, 'index.js'),
  ].map((candidate) => relative(root, join(root, candidate)).replaceAll('\\', '/'));
  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
}

for (const file of trackedFiles.filter((candidate) => /\.(ts|js|cjs|mjs)$/.test(candidate))) {
  const content = read(file);
  const source = addNode(file);
  const importPattern =
    /(?:import\s+(?:[^'"]+\s+from\s+)?|export\s+[^'"]+\s+from\s+|require\()\s*['"]([^'"]+)['"]/g;
  for (const match of content.matchAll(importPattern)) {
    const targetFile = resolveImport(file, match[1]);
    if (targetFile) addEdge(source, addNode(targetFile), 'imports', 'EXTRACTED', 1.0, file);
  }
}

for (const file of trackedFiles.filter((candidate) => /\.(md|yaml|yml|json)$/.test(candidate))) {
  const content = read(file);
  const source = addNode(file);
  const linkPattern =
    /\]\(([^)]+)\)|(?:^|\s)([A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+\.(?:md|ts|json|yaml|yml|sql|cjs|mjs|html|css))/gm;
  for (const match of content.matchAll(linkPattern)) {
    const raw = (match[1] ?? match[2] ?? '').split('#')[0];
    if (!raw || raw.startsWith('http') || raw.startsWith('mailto:')) continue;
    const candidate = relative(root, join(root, dirname(file), raw)).replaceAll('\\', '/');
    const direct = fileSet.has(raw) ? raw : fileSet.has(candidate) ? candidate : null;
    if (direct) addEdge(source, addNode(direct), 'references', 'EXTRACTED', 1.0, file);
  }
}

const packageFiles = trackedFiles.filter((file) => file.endsWith('package.json'));
for (const file of packageFiles) {
  const pkg = JSON.parse(read(file));
  const source = addNode(file, { package_name: pkg.name });
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  for (const depName of Object.keys(deps)) {
    const depId = `package:${depName}`;
    if (!nodes.has(depId)) {
      nodes.set(depId, {
        id: depId,
        label: depName,
        file_type: 'dependency',
        source_file: file,
        community: 'Package Dependencies',
      });
    }
    addEdge(source, depId, 'depends_on', 'EXTRACTED', 1.0, file);
  }
}

const conceptualEdges = [
  [
    'backend/src/dashboard/daily-aggregator.service.ts',
    'backend/src/integrations/jira/jira.service.ts',
    'aggregates',
  ],
  [
    'backend/src/dashboard/daily-aggregator.service.ts',
    'backend/src/integrations/github/github.service.ts',
    'aggregates',
  ],
  [
    'backend/src/dashboard/daily-aggregator.service.ts',
    'backend/src/integrations/google-calendar/google-calendar.service.ts',
    'aggregates',
  ],
  [
    'backend/src/dashboard/daily-aggregator.service.ts',
    'backend/src/integrations/slack/slack.service.ts',
    'aggregates',
  ],
  [
    'backend/src/dashboard/daily-aggregator.service.ts',
    'backend/src/reminders/reminders.service.ts',
    'aggregates',
  ],
  [
    'backend/src/scheduler/scheduler.service.ts',
    'backend/src/dashboard/daily-aggregator.service.ts',
    'calls',
  ],
  [
    'backend/src/scheduler/scheduler.service.ts',
    'backend/src/telegram/telegram.service.ts',
    'calls',
  ],
  [
    'frontend/src/app/core/services/dashboard.service.ts',
    'backend/src/dashboard/dashboard.controller.ts',
    'api_client_for',
  ],
  [
    'frontend/src/app/core/services/reminders.service.ts',
    'backend/src/reminders/reminders.controller.ts',
    'api_client_for',
  ],
  ['docker-compose.yml', 'backend/Dockerfile', 'builds'],
  ['.github/workflows/docs-release.yml', 'docs-site/package.json', 'deploys'],
  ['docs-site/package.json', 'openapi.yaml', 'renders_api_reference_from'],
  ['AGENTS.md', 'docs/adr/README.md', 'guides_agents_to'],
  ['README.md', 'daily-portal-architecture.md', 'references'],
];

for (const [sourceFile, targetFile, relation] of conceptualEdges) {
  if (fileSet.has(sourceFile) && fileSet.has(targetFile)) {
    addEdge(addNode(sourceFile), addNode(targetFile), relation, 'INFERRED', 0.85, sourceFile);
  }
}

const communities = {};
for (const node of nodes.values()) {
  communities[node.community] ??= [];
  communities[node.community].push(node.id);
}

const degree = new Map([...nodes.keys()].map((id) => [id, 0]));
for (const edge of edges) {
  degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
  degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
}

const godNodes = [...degree.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([id, count]) => ({
    id,
    label: nodes.get(id).label,
    degree: count,
    community: nodes.get(id).community,
  }));

const bridgeEdges = edges
  .filter((edge) => nodes.get(edge.source).community !== nodes.get(edge.target).community)
  .slice(0, 20)
  .map((edge) => ({
    source: nodes.get(edge.source).label,
    target: nodes.get(edge.target).label,
    relation: edge.relation,
    confidence: edge.confidence,
  }));

const graph = {
  directed: true,
  multigraph: true,
  graph: {
    generated_by: 'scripts/generate-agent-graph.cjs',
    source: '.',
  },
  nodes: [...nodes.values()],
  links: edges,
  communities,
};

function escapeScriptJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function markdownTable(rows) {
  return rows.map((row) => `| ${row.join(' |')} |`).join('\n');
}

const report = `# Daily Portal Knowledge Graph

Generated by \`npm run graphify:repo\`.

This repository could not use the external Graphify Python runtime in the local environment, so this committed graph is a deterministic Graphify-compatible fallback generated from tracked repository files, TypeScript imports, package manifests, documentation links, CI workflows, and known architecture edges.

## Corpus

- Files indexed: ${trackedFiles.length}
- Nodes: ${nodes.size}
- Edges: ${edges.length}
- Communities: ${Object.keys(communities).length}

## Communities

${markdownTable([
  ['Community', 'Nodes'],
  ['---', '---:'],
  ...Object.entries(communities)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, ids]) => [name, String(ids.length)]),
])}

## God Nodes

${markdownTable([
  ['Node', 'Community', 'Degree'],
  ['---', '---', '---:'],
  ...godNodes.map((node) => [node.label, node.community, String(node.degree)]),
])}

## Surprising Connections

${bridgeEdges
  .slice(0, 8)
  .map(
    (edge) => `- \`${edge.source}\` --${edge.relation} (${edge.confidence})--> \`${edge.target}\``,
  )
  .join('\n')}

## Suggested Questions

- How does the daily digest move from integrations to Telegram delivery?
- Which frontend services map directly to backend controllers?
- Which docs and ADR files explain the deployment model?
- What files should an agent inspect before changing GitHub Pages documentation release behavior?
- Which package manifests influence the docs portal dependency surface?

## Agent Usage

Start with this report for orientation, then open \`graphify-out/graph.html\` for interactive navigation or query \`graphify-out/graph.json\` programmatically.
`;

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Daily Portal Knowledge Graph</title>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #111827; color: #f9fafb; }
    header { padding: 18px 24px; border-bottom: 1px solid #374151; display: flex; gap: 24px; align-items: baseline; flex-wrap: wrap; }
    h1 { margin: 0; font-size: 20px; }
    main { display: grid; grid-template-columns: 320px 1fr; height: calc(100vh - 73px); }
    aside { overflow: auto; border-right: 1px solid #374151; padding: 16px; background: #0f172a; }
    svg { width: 100%; height: 100%; background: radial-gradient(circle at center, #1f2937, #030712); }
    .node { cursor: pointer; }
    .node circle { stroke: #fff; stroke-width: 1.2; }
    .node text { font-size: 10px; fill: #e5e7eb; pointer-events: none; }
    .edge { stroke: #64748b; stroke-opacity: 0.45; }
    code { color: #bae6fd; word-break: break-word; }
    .community { margin-bottom: 12px; }
    .community strong { display: block; margin-bottom: 4px; color: #c4b5fd; }
  </style>
</head>
<body>
  <header>
    <h1>Daily Portal Knowledge Graph</h1>
    <span>${nodes.size} nodes · ${edges.length} edges · ${Object.keys(communities).length} communities</span>
  </header>
  <main>
    <aside>
      <h2>Communities</h2>
      ${Object.entries(communities)
        .sort((a, b) => b[1].length - a[1].length)
        .map(
          ([name, ids]) =>
            `<div class="community"><strong>${escapeHtml(name)}</strong>${ids.length} nodes</div>`,
        )
        .join('')}
      <h2>Selected</h2>
      <p id="details">Click a node.</p>
    </aside>
    <svg id="graph" role="img" aria-label="Daily Portal knowledge graph"></svg>
  </main>
  <script>
    const graph = ${escapeScriptJson(graph)};
    const svg = document.getElementById('graph');
    const details = document.getElementById('details');
    const width = 1200;
    const height = 900;
    svg.setAttribute('viewBox', \`0 0 \${width} \${height}\`);
    const communities = Object.keys(graph.communities);
    const colors = ['#8b5cf6','#0ea5e9','#22c55e','#f59e0b','#ef4444','#14b8a6','#e879f9','#a3e635','#f97316','#60a5fa','#f43f5e','#94a3b8'];
    const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
    graph.nodes.forEach((node, index) => {
      const c = communities.indexOf(node.community);
      const angle = (index / graph.nodes.length) * Math.PI * 2;
      const radius = 110 + (index % 9) * 34 + c * 8;
      const cx = width / 2 + Math.cos(angle + c) * radius;
      const cy = height / 2 + Math.sin(angle + c) * radius;
      node.x = Math.max(40, Math.min(width - 40, cx));
      node.y = Math.max(40, Math.min(height - 40, cy));
      node.color = colors[c % colors.length];
    });
    for (const edge of graph.links) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'edge');
      line.setAttribute('x1', source.x);
      line.setAttribute('y1', source.y);
      line.setAttribute('x2', target.x);
      line.setAttribute('y2', target.y);
      svg.appendChild(line);
    }
    for (const node of graph.nodes) {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'node');
      group.setAttribute('transform', \`translate(\${node.x},\${node.y})\`);
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', node.id.startsWith('package:') ? 4 : 6);
      circle.setAttribute('fill', node.color);
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = node.label;
      group.appendChild(title);
      group.appendChild(circle);
      group.addEventListener('click', () => {
        const out = graph.links.filter((edge) => edge.source === node.id || edge.target === node.id).slice(0, 12);
        details.innerHTML = '<strong>' + escape(node.label) + '</strong><br><code>' + escape(node.community) + '</code><br><br>' +
          out.map((edge) => '<code>' + escape(edge.relation) + '</code> ' + escape(edge.source === node.id ? nodeMap.get(edge.target)?.label ?? edge.target : nodeMap.get(edge.source)?.label ?? edge.source)).join('<br>');
      });
      svg.appendChild(group);
    }
    function escape(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    }
  </script>
</body>
</html>`;

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'graph.json'), JSON.stringify(graph, null, 2));
writeFileSync(join(outDir, 'GRAPH_REPORT.md'), report);
writeFileSync(join(outDir, 'graph.html'), html);

console.log(
  `Graph complete: ${nodes.size} nodes, ${edges.length} edges, ${Object.keys(communities).length} communities`,
);
