import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const releaseType = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const validReleaseTypes = new Set(['major', 'minor', 'patch']);

if (!validReleaseTypes.has(releaseType)) {
  throw new Error(`Expected release type to be one of: ${[...validReleaseTypes].join(', ')}`);
}

const packageFiles = ['package.json', 'backend/package.json', 'frontend/package.json'];
const rootPackage = JSON.parse(readFileSync('package.json', 'utf8'));
const currentVersion = rootPackage.version;
const nextVersion = bumpVersion(currentVersion, releaseType);
const tagName = `v${nextVersion}`;
const previousTag = getPreviousTag();
const commits = getCommits(previousTag);
const releaseDate = new Date().toISOString().slice(0, 10);
const releaseNotes = buildReleaseNotes({ commits, previousTag, releaseDate, version: nextVersion });

if (!dryRun) {
  for (const packageFile of packageFiles) {
    const packageJson = JSON.parse(readFileSync(packageFile, 'utf8'));
    packageJson.version = nextVersion;
    writeFileSync(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
  }

  prependChangelog(releaseNotes);
}

writeGithubOutput({
  current_version: currentVersion,
  next_version: nextVersion,
  previous_tag: previousTag,
  tag_name: tagName,
});

if (dryRun) {
  process.stdout.write(releaseNotes);
} else {
  writeFileSync('release-notes.md', releaseNotes);
}

function bumpVersion(version, type) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    throw new Error(`Version "${version}" is not a valid semantic version`);
  }

  const [, majorRaw, minorRaw, patchRaw] = match;
  let major = Number(majorRaw);
  let minor = Number(minorRaw);
  let patch = Number(patchRaw);

  if (type === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (type === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

function getPreviousTag() {
  try {
    return execFileSync('git', ['describe', '--tags', '--abbrev=0'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function getCommits(tag) {
  const range = tag ? `${tag}..HEAD` : 'HEAD';
  const output = execFileSync('git', ['log', '--no-merges', '--pretty=format:%s%x09%h', range], {
    encoding: 'utf8',
  }).trim();

  if (!output) {
    return [];
  }

  return output.split('\n').map((line) => {
    const [subject, shortSha] = line.split('\t');
    return { subject, shortSha };
  });
}

function buildReleaseNotes({ commits, previousTag, releaseDate, version }) {
  const groupedCommits = groupCommits(commits);
  const compareLine = previousTag
    ? `\nCompare: https://github.com/${process.env.GITHUB_REPOSITORY}/compare/${previousTag}...v${version}\n`
    : '';
  const sections = [
    ['Features', groupedCommits.features],
    ['Fixes', groupedCommits.fixes],
    ['Maintenance', groupedCommits.maintenance],
  ]
    .filter(([, entries]) => entries.length > 0)
    .map(([title, entries]) => `### ${title}\n\n${entries.map(formatCommit).join('\n')}`)
    .join('\n\n');

  return `## v${version} - ${releaseDate}${compareLine}\n${
    sections || '- No user-facing changes were detected in commit subjects.'
  }\n`;
}

function groupCommits(commits) {
  return commits.reduce(
    (groups, commit) => {
      if (/^feat(\(.+\))?!?:/i.test(commit.subject)) {
        groups.features.push(commit);
      } else if (/^fix(\(.+\))?!?:/i.test(commit.subject)) {
        groups.fixes.push(commit);
      } else {
        groups.maintenance.push(commit);
      }

      return groups;
    },
    { features: [], fixes: [], maintenance: [] },
  );
}

function formatCommit(commit) {
  return `- ${commit.subject} (${commit.shortSha})`;
}

function prependChangelog(releaseNotes) {
  const changelogPath = 'CHANGELOG.md';
  let existingContent = '';

  try {
    existingContent = readFileSync(changelogPath, 'utf8').trim();
  } catch {
    existingContent = '# Changelog';
  }

  const normalizedContent = existingContent.startsWith('# Changelog')
    ? existingContent
    : `# Changelog\n\n${existingContent}`;
  const nextContent = normalizedContent.replace(
    '# Changelog',
    `# Changelog\n\n${releaseNotes.trim()}`,
  );
  writeFileSync(changelogPath, `${nextContent.trim()}\n`);
}

function writeGithubOutput(values) {
  const outputPath = process.env.GITHUB_OUTPUT;

  if (!outputPath) {
    return;
  }

  const output = Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  writeFileSync(outputPath, `${output}\n`, { flag: 'a' });
}
