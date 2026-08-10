import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const packageManifestPath = path.join(rootDir, 'trilium-package.json');
const distArtifactsDir = path.join(rootDir, 'dist', 'artifacts');
const stagedManifestDir = path.join(rootDir, 'manifests');

console.log('📦 Building Ikmal Tools for Trilium package bundle...');

if (!fs.existsSync(distArtifactsDir)) {
    fs.mkdirSync(distArtifactsDir, { recursive: true });
}

// 1. Audit source files for deprecated or forbidden API routes.
// This gates the build, so it has to run before anything is written -- running
// it last only produced a nonzero exit code on top of a fully built,
// deployable dist/ tree.
console.log('🔍 Auditing source code for API route safety...');
const deprecatedPatterns = [/remove-from-parent/, /clone-to-note/];
const srcFiles = [];
function scanDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) scanDir(full);
        else if (entry.isFile() && (full.endsWith('.js') || full.endsWith('.ts') || full.endsWith('.jsx') || full.endsWith('.tsx'))) {
            srcFiles.push(full);
        }
    }
}
scanDir(path.join(rootDir, 'src'));

const violations = [];
for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of deprecatedPatterns) {
        if (pattern.test(content)) {
            violations.push({ file: path.relative(rootDir, file), pattern: pattern.toString() });
        }
    }
}

if (violations.length > 0) {
    console.error('❌ BUILD AUDIT FAILED: Deprecated REST API endpoints detected in source files:');
    for (const v of violations) {
        console.error(`   - ${v.file}: matches ${v.pattern}`);
    }
    process.exit(1);
}

// 2. Bundle jsx/ts artifacts into standalone browser/backend JS using esbuild
try {
    // The engines and components are compiled to dist/ as well as bundled into the
    // artifacts. The test suite imports dist/, so without this step it would keep
    // asserting against whatever was compiled last rather than the current source.
    console.log('🔨 Compiling engines and components to dist/...');
    execSync('npx tsc -p tsconfig.build.json', { stdio: 'inherit' });

    console.log('🔨 Bundling dashboard render artifact...');
    execSync('npx esbuild src/artifacts/notes-system-dashboard.jsx --loader:.jsx=tsx --bundle --format=iife --target=es2020 --outfile=dist/artifacts/notes-system-dashboard.js', { stdio: 'inherit' });

    console.log('🔨 Bundling Today page render artifact...');
    execSync('npx esbuild src/artifacts/notes-system-today-page.jsx --loader:.jsx=tsx --bundle --format=iife --target=es2020 --outfile=dist/artifacts/notes-system-today-page.js', { stdio: 'inherit' });

    console.log('🔨 Bundling project dashboard render artifact...');
    execSync('npx esbuild src/artifacts/notes-system-project-dashboard.js --bundle --format=iife --target=es2020 --outfile=dist/artifacts/notes-system-project-dashboard.js', { stdio: 'inherit' });

    console.log('🔨 Bundling standalone kanban render artifact...');
    execSync('npx esbuild src/artifacts/notes-system-kanban.jsx --loader:.jsx=tsx --bundle --format=iife --target=es2020 --outfile=dist/artifacts/notes-system-kanban.js', { stdio: 'inherit' });

    console.log('🔨 Bundling standalone insights render artifact...');
    execSync('npx esbuild src/artifacts/notes-system-insights.jsx --loader:.jsx=tsx --bundle --format=iife --target=es2020 --outfile=dist/artifacts/notes-system-insights.js', { stdio: 'inherit' });

    console.log('🔨 Bundling standalone quick capture toolbar artifact...');
    execSync('npx esbuild src/artifacts/notes-system-quick-capture.jsx --loader:.jsx=tsx --bundle --format=iife --target=es2020 --outfile=dist/artifacts/notes-system-quick-capture.js', { stdio: 'inherit' });

    console.log('🔨 Bundling standalone weather render artifact...');
    execSync('npx esbuild src/artifacts/notes-system-weather.jsx --loader:.jsx=tsx --bundle --format=iife --target=es2020 --outfile=dist/artifacts/notes-system-weather.js', { stdio: 'inherit' });

    console.log('🔨 Bundling standalone on-this-day render artifact...');
    execSync('npx esbuild src/artifacts/notes-system-on-this-day.jsx --loader:.jsx=tsx --bundle --format=iife --target=es2020 --outfile=dist/artifacts/notes-system-on-this-day.js', { stdio: 'inherit' });

    console.log('🔨 Bundling standalone stale-notes render artifact...');
    execSync('npx esbuild src/artifacts/notes-system-stale-notes.jsx --loader:.jsx=tsx --bundle --format=iife --target=es2020 --outfile=dist/artifacts/notes-system-stale-notes.js', { stdio: 'inherit' });

    console.log('🔨 Bundling standalone canvas render artifact (beta)...');
    execSync('npx esbuild src/artifacts/notes-system-canvas.jsx --loader:.jsx=tsx --bundle --format=iife --target=es2020 --outfile=dist/artifacts/notes-system-canvas.js', { stdio: 'inherit' });

    console.log('🔨 Bundling launcher artifact...');
    execSync('npx esbuild src/artifacts/notes-system-launcher.js --bundle --format=iife --target=es2020 --outfile=dist/artifacts/notes-system-launcher.js', { stdio: 'inherit' });

    console.log('🔨 Bundling workspace bootstrap artifact...');
    execSync('npx esbuild src/artifacts/notes-system-workspace-bootstrap.js --bundle --format=iife --target=es2020 --outfile=dist/artifacts/notes-system-workspace-bootstrap.js', { stdio: 'inherit' });

    console.log('🔨 Copying CSS stylesheet...');
    const stylesheetSource = fs.readFileSync(path.join(rootDir, 'src', 'artifacts', 'notes-system.css'), 'utf8');
    fs.writeFileSync(path.join(distArtifactsDir, 'notes-system.css'), stylesheetSource);

    const distBackendDir = path.join(rootDir, 'dist', 'backend');
    if (!fs.existsSync(distBackendDir)) {
        fs.mkdirSync(distBackendDir, { recursive: true });
    }
    const srcBackendDir = path.join(rootDir, 'src', 'backend');
    if (fs.existsSync(srcBackendDir)) {
        console.log('🔨 Copying backend event scripts...');
        for (const file of fs.readdirSync(srcBackendDir)) {
            if (file.endsWith('.js')) {
                fs.copyFileSync(path.join(srcBackendDir, file), path.join(distBackendDir, file));
            }
        }
    }

    console.log('🔨 Bundling YAML if/then runtime dispatcher...');
    execSync('npx esbuild src/backend/if-then-dispatch.backend.ts --bundle --format=iife --target=es2020 --outfile=dist/backend/if-then-dispatch.backend.js', { stdio: 'inherit' });
} catch (err) {
    console.error('❌ Bundling failed:', err.message);
    process.exit(1);
}

// 3. Read trilium-package.json
const manifestRaw = fs.readFileSync(packageManifestPath, 'utf8');
const manifest = JSON.parse(manifestRaw);

// 4. Calculate SRI sha256 integrity hashes for bundled dist/artifacts
for (const artifact of manifest.artifacts) {
    const distRelPath = artifact.source.replace(/^src\//, 'dist/').replace(/\.jsx$/, '.js');
    const artifactPath = path.join(rootDir, distRelPath);
    if (!fs.existsSync(artifactPath)) {
        console.warn(`⚠️ Bundled artifact file missing: ${distRelPath}`);
        continue;
    }

    const fileContent = fs.readFileSync(artifactPath);
    const hash = crypto.createHash('sha256').update(fileContent).digest('base64');
    artifact.integrity = `sha256-${hash}`;
    console.log(`  ✓ ${artifact.id} -> ${artifact.integrity}`);
}

// 5. Save updated trilium-package.json
fs.writeFileSync(packageManifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('✅ Updated trilium-package.json with computed SRI hashes.');
// 6. Generate staged bundle metadata. Standalone components own their own
// manifests and payloads; this package only records the optional relationship.
if (!fs.existsSync(stagedManifestDir)) fs.mkdirSync(stagedManifestDir, { recursive: true });
const sriFor = (relativePath) => {
    const bytes = fs.readFileSync(path.join(rootDir, relativePath));
    return `sha256-${crypto.createHash('sha256').update(bytes).digest('base64')}`;
};
const bundleManifest = {
    schemaVersion: 1,
    kind: 'bundle',
    id: 'iansherr/ikmal_tools',
    version: '0.1.0',
    name: 'Ikmal Tools',
    description: 'A selectable bundle of independently managed Ikmal Trilium apps.',
    repository: manifest.repository,
    staged: true,
    stagedReason: 'Publish after component ownership transfer and bundle lifecycle UI are validated.',
    components: [
        { id: manifest.id, role: 'core', required: true },
        { id: 'iansherr/ikmal_editor_trilium', role: 'editor', required: false, defaultEnabled: true }
    ]
};
fs.writeFileSync(path.join(stagedManifestDir, 'ikmal-tools-bundle.json'), JSON.stringify(bundleManifest, null, 2) + '\n');

const shortcutsManifest = {
    id: 'iansherr/ikmal_shortcuts_trilium',
    version: '0.1.0',
    name: 'Ikmal Shortcuts & Quick Capture',
    description: 'Global keyboard hotkeys (Alt+T/S/M, Cmd+Shift+K), searchable hotkey cheatsheet, and quick capture command palette.',
    author: manifest.author,
    maintainer: manifest.maintainer,
    repository: manifest.repository,
    homepage: manifest.homepage,
    license: manifest.license,
    maintenance: manifest.maintenance,
    securityStatus: manifest.securityStatus,
    compatibility: manifest.compatibility,
    permissions: ['read-notes', 'write-notes'],
    artifacts: [
        {
            id: 'ikmal-shortcuts-launcher',
            type: 'frontend',
            source: 'dist/artifacts/notes-system-launcher.js',
            integrity: sriFor('dist/artifacts/notes-system-launcher.js'),
            title: 'Ikmal Shortcuts & Quick Capture',
            activation: 'startup'
        }
    ]
};
fs.writeFileSync(path.join(stagedManifestDir, 'ikmal-shortcuts.json'), JSON.stringify(shortcutsManifest, null, 2) + '\n');

const kanbanManifest = {
    id: 'iansherr/ikmal_kanban_trilium',
    version: '0.1.0',
    name: 'Ikmal Standalone Kanban Board',
    description: 'Native HTML5 drag-and-drop Kanban board for task status tracking, priority pill badges, and completion animations.',
    author: manifest.author,
    maintainer: manifest.maintainer,
    repository: manifest.repository,
    homepage: manifest.homepage,
    license: manifest.license,
    maintenance: manifest.maintenance,
    securityStatus: manifest.securityStatus,
    compatibility: manifest.compatibility,
    permissions: ['read-notes', 'write-notes'],
    artifacts: [
        {
            id: 'ikmal-kanban-board',
            type: 'render',
            source: 'dist/artifacts/notes-system-kanban.js',
            integrity: sriFor('dist/artifacts/notes-system-kanban.js'),
            title: 'Ikmal Standalone Kanban Board',
            activation: 'manual'
        }
    ]
};
fs.writeFileSync(path.join(stagedManifestDir, 'ikmal-kanban.json'), JSON.stringify(kanbanManifest, null, 2) + '\n');

console.log('✅ Generated staged Shortcuts, Kanban, and Ikmal Tools bundle manifests.');
console.log('🎉 Build completed successfully!');
