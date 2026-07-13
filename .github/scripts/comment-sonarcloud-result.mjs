import { readFileSync } from 'node:fs';
import { fetchJson, requireEnv, upsertIssueComment } from './github-comment-helpers.mjs';

const marker = '<!-- sonarcloud-pr-summary -->';
const sonarCloudUrl = 'https://sonarcloud.io';

function readSonarProperty(name) {
  const properties = readFileSync('sonar-project.properties', 'utf8');
  const line = properties
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));

  if (!line) {
    throw new Error(`${name} is missing from sonar-project.properties`);
  }

  return line.slice(name.length + 1).trim();
}

function sonarAuthHeader(token) {
  return `Basic ${Buffer.from(`${token}:`).toString('base64')}`;
}

function metricLabel(metricKey) {
  const labels = {
    new_bugs: 'New bugs',
    new_code_smells: 'New code smells',
    new_coverage: 'New coverage',
    new_duplicated_lines_density: 'New duplication',
    new_security_hotspots: 'New security hotspots',
    new_vulnerabilities: 'New vulnerabilities',
  };

  return labels[metricKey] ?? metricKey.replaceAll('_', ' ');
}

function buildBody({ dashboardUrl, projectStatus, scanOutcome }) {
  const status = projectStatus?.status ?? 'UNAVAILABLE';
  const emoji = status === 'OK' ? '✅' : status === 'ERROR' ? '❌' : '⚠️';
  const conditions = projectStatus?.conditions ?? [];
  const conditionRows =
    conditions.length > 0
      ? conditions
          .map((condition) =>
            [
              metricLabel(condition.metricKey),
              condition.status === 'OK' ? '✅ OK' : `❌ ${condition.status}`,
              condition.actualValue ?? 'n/a',
              condition.errorThreshold ?? 'n/a',
            ].join(' | '),
          )
          .join('\n')
      : 'No Quality Gate conditions were returned.';

  const conditionsTable =
    conditions.length > 0
      ? ['| Metric | Status | Actual | Threshold |', '| --- | --- | ---: | ---: |', conditionRows].join(
          '\n',
        )
      : conditionRows;

  return `${marker}
## SonarCloud

${emoji} **Quality Gate:** ${status}

**Workflow outcome:** ${scanOutcome}

${conditionsTable}

[Open analysis in SonarCloud](${dashboardUrl})
`;
}

async function main() {
  const githubToken = requireEnv('GITHUB_TOKEN');
  const sonarToken = requireEnv('SONAR_TOKEN');
  const event = JSON.parse(readFileSync(requireEnv('GITHUB_EVENT_PATH'), 'utf8'));
  const pullRequestNumber = event.pull_request?.number;

  if (!pullRequestNumber) {
    return;
  }

  const [owner, repo] = requireEnv('GITHUB_REPOSITORY').split('/');
  const projectKey = readSonarProperty('sonar.projectKey');
  const organization = readSonarProperty('sonar.organization');
  const dashboardUrl = `${sonarCloudUrl}/summary/new_code?id=${encodeURIComponent(
    projectKey,
  )}&pullRequest=${pullRequestNumber}`;
  const qualityGateUrl = `${sonarCloudUrl}/api/qualitygates/project_status?projectKey=${encodeURIComponent(
    projectKey,
  )}&pullRequest=${pullRequestNumber}`;

  let projectStatus;
  try {
    const qualityGate = await fetchJson(qualityGateUrl, {
      headers: { Authorization: sonarAuthHeader(sonarToken) },
    });
    projectStatus = qualityGate.projectStatus;
  } catch (error) {
    projectStatus = {
      status: 'UNAVAILABLE',
      conditions: [
        {
          metricKey: 'sonarcloud_api',
          status: 'ERROR',
          actualValue: error instanceof Error ? error.message : 'Unknown error',
          errorThreshold: 'n/a',
        },
      ],
    };
  }

  const body = buildBody({
    dashboardUrl: `${dashboardUrl}&organization=${encodeURIComponent(organization)}`,
    projectStatus,
    scanOutcome: process.env.SONAR_SCAN_OUTCOME ?? 'unknown',
  });

  await upsertIssueComment({ body, githubToken, marker, owner, repo, pullRequestNumber });
}

await main().catch((error) => {
  console.error(
    'SonarCloud comment script failed:',
    error instanceof Error ? error.message : error,
  );
});
