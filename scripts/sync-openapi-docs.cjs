const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const sourceOpenApi = path.join(rootDir, 'openapi.yaml');
const publicDir = path.join(rootDir, 'docs-site', 'public');
const referenceDir = path.join(publicDir, 'reference');
const rapidocSource = path.join(rootDir, 'node_modules', 'rapidoc', 'dist', 'rapidoc-min.js');
const rapidocTargetDir = path.join(publicDir, 'vendor', 'rapidoc');
const sourceDocsDir = path.join(rootDir, 'docs');
const publicSourceDocsDir = path.join(publicDir, 'source-docs');

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writePage(filePath, { title, heading, allowTry }) {
  const tryMode = allowTry ? 'true' : 'false';
  const showMethodInNavBar = allowTry ? 'as-colored-block' : 'as-plain-text';

  fs.writeFileSync(
    filePath,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <script type="module" src="../../vendor/rapidoc/rapidoc-min.js"></script>
    <style>
      html,
      body {
        height: 100%;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <rapi-doc
      spec-url="../../openapi.yaml"
      heading-text="${heading}"
      theme="dark"
      render-style="read"
      layout="row"
      allow-try="${tryMode}"
      allow-server-selection="true"
      show-method-in-nav-bar="${showMethodInNavBar}"
      default-schema-tab="schema"
      schema-style="tree"
    ></rapi-doc>
  </body>
</html>
`,
  );
}

function copyMarkdownAsText(sourceDirectory, targetDirectory) {
  fs.rmSync(targetDirectory, { recursive: true, force: true });
  ensureDir(targetDirectory);

  for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);

    if (entry.isDirectory()) {
      copyMarkdownAsText(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile() || path.extname(entry.name) !== '.md') {
      continue;
    }

    fs.copyFileSync(sourcePath, `${targetPath}.txt`);
  }
}

if (!fs.existsSync(sourceOpenApi)) {
  throw new Error(`Missing OpenAPI source: ${sourceOpenApi}`);
}

if (!fs.existsSync(rapidocSource)) {
  throw new Error('Missing rapidoc assets. Run npm install before generating API docs.');
}

ensureDir(publicDir);
ensureDir(path.join(referenceDir, 'api'));
ensureDir(path.join(referenceDir, 'api-playground'));
ensureDir(rapidocTargetDir);

fs.copyFileSync(sourceOpenApi, path.join(publicDir, 'openapi.yaml'));
fs.copyFileSync(rapidocSource, path.join(rapidocTargetDir, 'rapidoc-min.js'));
copyMarkdownAsText(sourceDocsDir, publicSourceDocsDir);

writePage(path.join(referenceDir, 'api', 'index.html'), {
  title: 'Daily Portal API Reference',
  heading: 'Daily Portal API Reference',
  allowTry: false,
});

writePage(path.join(referenceDir, 'api-playground', 'index.html'), {
  title: 'Daily Portal API Playground',
  heading: 'Daily Portal API Playground',
  allowTry: true,
});
