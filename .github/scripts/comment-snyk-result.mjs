import { existsSync, readFileSync } from 'node:fs';

const marker = '<!-- snyk-pr-summary -->';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body}`);
  }

  return response.json();
}

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function fetchAllPages(url, githubToken) {
  const results = [];
  let nextUrl = url;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: githubHeaders(githubToken),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${response.status} ${response.statusText}: ${body}`);
    }

    results.push(...(await response.json()));
    nextUrl = parseNextLink(response.headers.get('link'));
  }

  return results;
}

function parseNextLink(linkHeader) {
  if (!linkHeader) {
    return undefined;
  }

  const nextLink = linkHeader.split(',').find((entry) => entry.includes('rel="next"'));
  return nextLink?.match(/<([^>]+)>/)?.[1];
}

function normalizeResults(rawResult) {
  if (!rawResult) {
    return [];
  }

  if (Array.isArray(rawResult)) {
    return rawResult;
  }

  return [rawResult];
}

function severityCounts(results) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };

  for (const result of results) {
    const vulnerabilities = Array.isArray(result.vulnerabilities) ? result.vulnerabilities : [];
    for (const vulnerability of vulnerabilities) {
      const severity = vulnerability.severity;
      if (severity in counts) {
        counts[severity] += 1;
      }
    }
  }

  return counts;
}

function readSnykResults() {
  if (!existsSync('snyk-results.json')) {
    return { results: [], parseError: 'snyk-results.json was not produced.' };
  }

  try {
    return { results: normalizeResults(JSON.parse(readFileSync('snyk-results.json', 'utf8'))) };
  } catch (error) {
    return {
      results: [],
      parseError: error instanceof Error ? error.message : 'Unknown JSON parse error.',
    };
  }
}

function buildBody({ scanOutcome, results, parseError }) {
  const counts = severityCounts(results);
  const projectCount = results.length;
  const vulnerabilityCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const status = scanOutcome === 'success' ? '✅ Passed' : '❌ Failed';
  const resultNote = parseError
    ? `\n\n> Could not parse Snyk JSON output: ${parseError}`
    : `\n\nScanned projects: **${projectCount}**`;

  return `${marker}
## Snyk

${status}

**Workflow outcome:** ${scanOutcome}
${resultNote}

| Severity | Count |
| --- | ---: |
| Critical | ${counts.critical} |
| High | ${counts.high} |
| Medium | ${counts.medium} |
| Low | ${counts.low} |

Total vulnerabilities reported in JSON output: **${vulnerabilityCount}**
`;
}

async function upsertComment({ body, githubToken, owner, repo, pullRequestNumber }) {
  const commentsUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${pullRequestNumber}/comments?per_page=100`;
  const comments = await fetchAllPages(commentsUrl, githubToken);
  const existing = comments.find((comment) => comment.body?.includes(marker));

  if (existing) {
    await fetchJson(existing.url, {
      method: 'PATCH',
      headers: githubHeaders(githubToken),
      body: JSON.stringify({ body }),
    });
    return;
  }

  await fetchJson(commentsUrl, {
    method: 'POST',
    headers: githubHeaders(githubToken),
    body: JSON.stringify({ body }),
  });
}

async function main() {
  const githubToken = requireEnv('GITHUB_TOKEN');
  const event = JSON.parse(readFileSync(requireEnv('GITHUB_EVENT_PATH'), 'utf8'));
  const pullRequestNumber = event.pull_request?.number;

  if (!pullRequestNumber) {
    return;
  }

  const [owner, repo] = requireEnv('GITHUB_REPOSITORY').split('/');
  const { results, parseError } = readSnykResults();
  const body = buildBody({
    scanOutcome: process.env.SNYK_SCAN_OUTCOME ?? 'unknown',
    results,
    parseError,
  });

  await upsertComment({ body, githubToken, owner, repo, pullRequestNumber });
}

await main();
