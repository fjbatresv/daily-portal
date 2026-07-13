import { existsSync, readFileSync } from 'node:fs';
import { requireEnv, upsertIssueComment } from './github-comment-helpers.mjs';

const marker = '<!-- snyk-pr-summary -->';

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

  await upsertIssueComment({ body, githubToken, marker, owner, repo, pullRequestNumber });
}

await main().catch((error) => {
  console.error('Snyk comment script failed:', error instanceof Error ? error.message : error);
});
