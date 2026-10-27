import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Verify the installed legacy runtime, not merely the name/version reported by audit.
const root = fs.realpathSync(process.cwd());
const vendor = path.join(root, 'vendor/security-backports/zod3');
const found = new Set();
const visited = new Set();
const verifiedDecoders = new Set();
const stackPackages = new Set();
function inspectPackage(directory) {
  if (!fs.existsSync(path.join(directory, 'package.json'))) return;
  const real = fs.realpathSync(directory);
  if (visited.has(real)) return;
  visited.add(real);
  const metadata = JSON.parse(fs.readFileSync(path.join(real, 'package.json'), 'utf8'));
  if (metadata.name === 'zod') {
    const version = metadata.version.split('.').map(Number);
    if (version[0] === 3) {
      if (!real.startsWith(root + path.sep)) throw new Error('Legacy Zod resolved outside this project');
      found.add(real);
    } else if (version[0] === 4 && (version[1] < 6 || version[1] === 6 && version[2] < 6)) {
      throw new Error('Unpatched modern Zod installed: ' + metadata.version);
    }
  }
  if (metadata.name === 'decode-uri-component') {
    const trusted = path.join(root, 'vendor/security-backports/decode-uri-component');
    if (metadata.version !== '0.5.1' || !fs.existsSync(path.join(trusted, 'SECURITY-VARIANT.json'))) {
      throw new Error('Unexpected URI decoder version or missing trusted variant');
    }
    for (const filename of ['index.js', 'index.cjs', 'package.json', 'license']) {
      const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      if (hash(path.join(real, filename)) !== hash(path.join(trusted, filename))) {
        throw new Error('URI decoder variant changed: ' + filename);
      }
    }
    verifiedDecoders.add(real);
  }
  if (metadata.name === '@stackframe/stack-shared') stackPackages.add(real);
  inspectModules(path.join(real, 'node_modules'));
}
function inspectModules(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const candidate = path.join(directory, entry.name);
    if (entry.name === '.pnpm') {
      for (const storeEntry of fs.readdirSync(candidate, {withFileTypes: true})) {
        if (storeEntry.isDirectory()) inspectModules(path.join(candidate, storeEntry.name, 'node_modules'));
      }
    } else if (entry.name.startsWith('@')) {
      for (const packageName of fs.readdirSync(candidate)) inspectPackage(path.join(candidate, packageName));
    } else if (!entry.name.startsWith('.')) inspectPackage(candidate);
  }
}
inspectModules(path.join(root, 'node_modules'));
if (!found.size) throw new Error('Expected legacy Zod consumers, but none were installed');
for (const directory of found) {
  const result = spawnSync(process.execPath, [
    path.join(vendor, 'verify_installed_backport.mjs'),
    path.join(vendor, 'backport-verification.json'),
    directory,
  ], {stdio: 'inherit'});
  if (result.status !== 0) process.exit(result.status ?? 1);
}
for (const directory of stackPackages) {
  const trusted = path.join(root, 'vendor/security-backports/stack-auth');
  const result = spawnSync(process.execPath, [
    path.join(trusted, 'verify_installed_backport.mjs'),
    directory,
    path.join(trusted, 'backport-verification.json'),
  ], {stdio: 'inherit'});
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(JSON.stringify({verifiedLegacyZodInstallations: found.size, verifiedDecoderInstallations: verifiedDecoders.size, verifiedStackPackages: stackPackages.size, rawAdvisoryStillVisible: true}));
