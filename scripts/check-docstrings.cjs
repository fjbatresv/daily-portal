const { existsSync, readdirSync, readFileSync } = require('node:fs');
const { join, relative } = require('node:path');
const ts = require('typescript');

const sourceRoots = [
  { label: 'backend', path: join(__dirname, '..', 'backend', 'src') },
  { label: 'frontend', path: join(__dirname, '..', 'frontend', 'src') },
];
const minimumCoverage = 80;
const relevantDecorators = new Set([
  'Component',
  'Controller',
  'Directive',
  'Injectable',
  'Module',
  'Pipe',
]);

function collectSourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return collectSourceFiles(path);
    }

    if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.types.ts')
    ) {
      return [path];
    }

    return [];
  });
}

function hasModifier(node, kind) {
  return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function decoratorName(decorator) {
  const expression = decorator.expression;
  if (ts.isCallExpression(expression)) {
    return expression.expression.getText();
  }

  return expression.getText();
}

function hasRelevantClassDecorator(node) {
  return (
    ts.getDecorators(node)?.some((decorator) => relevantDecorators.has(decoratorName(decorator))) ??
    false
  );
}

function hasDocstring(node) {
  return ts.getJSDocCommentsAndTags(node).some((comment) => comment.kind === ts.SyntaxKind.JSDoc);
}

function isExported(node) {
  return hasModifier(node, ts.SyntaxKind.ExportKeyword);
}

function isPrivate(node) {
  return hasModifier(node, ts.SyntaxKind.PrivateKeyword);
}

function isDocumentableVariableDeclaration(declaration) {
  return (
    ts.isIdentifier(declaration.name) &&
    declaration.initializer &&
    (ts.isArrowFunction(declaration.initializer) ||
      ts.isFunctionExpression(declaration.initializer))
  );
}

function inspectFile(path, rootPath, label) {
  const sourceText = readFileSync(path, 'utf8');
  const sourceFile = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true);
  const targets = [];

  function visit(node, parentClassRelevant = false) {
    if (ts.isClassDeclaration(node)) {
      const classRelevant = isExported(node) || hasRelevantClassDecorator(node);
      if (classRelevant) {
        targets.push({ node, name: node.name?.getText(sourceFile) ?? '<anonymous class>' });
      }

      ts.forEachChild(node, (child) => visit(child, classRelevant));
      return;
    }

    if (ts.isFunctionDeclaration(node) && isExported(node)) {
      targets.push({ node, name: node.name?.getText(sourceFile) ?? '<anonymous function>' });
    }

    if (ts.isVariableStatement(node) && isExported(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (isDocumentableVariableDeclaration(declaration)) {
          targets.push({ node, name: declaration.name.getText(sourceFile) });
        }
      }
    }

    const isPublicClassMember =
      parentClassRelevant &&
      (ts.isMethodDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node)) &&
      !isPrivate(node);

    if (isPublicClassMember) {
      targets.push({ node, name: node.name.getText(sourceFile) });
    }

    ts.forEachChild(node, (child) => visit(child, parentClassRelevant));
  }

  visit(sourceFile);

  return targets.map((target) => ({
    name: target.name,
    path,
    label,
    documented: hasDocstring(target.node),
    relativePath: relative(rootPath, path),
  }));
}

function collectTargets() {
  return sourceRoots.flatMap((root) => {
    if (!existsSync(root.path)) {
      throw new Error(`Source directory not found: ${root.path}`);
    }

    return collectSourceFiles(root.path).flatMap((path) =>
      inspectFile(path, root.path, root.label),
    );
  });
}

const targets = collectTargets();
const documented = targets.filter((target) => target.documented).length;
const coverage = targets.length === 0 ? 100 : (documented / targets.length) * 100;
const missing = targets.filter((target) => !target.documented);

console.log(`Docstrings: ${documented}/${targets.length} (${coverage.toFixed(2)}%)`);

for (const root of sourceRoots) {
  const rootTargets = targets.filter((target) => target.label === root.label);
  const rootDocumented = rootTargets.filter((target) => target.documented).length;
  const rootCoverage = rootTargets.length === 0 ? 100 : (rootDocumented / rootTargets.length) * 100;
  console.log(
    `${root.label}: ${rootDocumented}/${rootTargets.length} (${rootCoverage.toFixed(2)}%)`,
  );
}

if (missing.length > 0) {
  console.log('Missing docstrings:');
  for (const target of missing) {
    console.log(`- ${target.label}/${target.relativePath}: ${target.name}`);
  }
}

if (coverage < minimumCoverage) {
  process.exitCode = 1;
}
