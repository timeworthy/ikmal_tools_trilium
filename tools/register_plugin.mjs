import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const pluginManifestPath = path.join(rootDir, 'trilium-package.json');

console.log('🔎 Validating standalone Trilium package manifest...');

if (!fs.existsSync(pluginManifestPath)) {
    console.error('❌ trilium-package.json not found!');
    process.exit(1);
}

const packageManifest = JSON.parse(fs.readFileSync(pluginManifestPath, 'utf8'));
if (!packageManifest.id || !packageManifest.version || !Array.isArray(packageManifest.artifacts)) {
    console.error('❌ Manifest must include id, version, and artifacts.');
    process.exit(1);
}

console.log(`✅ ${packageManifest.id} v${packageManifest.version} is ready for Community Packages deployment.`);
console.log('   No shared registry is modified; plugins are maintained as standalone repositories.');
