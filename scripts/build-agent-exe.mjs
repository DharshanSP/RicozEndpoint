import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const tempDir = join(root, '.tmp', 'agent-exe');
const webDownloads = join(root, 'apps', 'web', 'public', 'downloads');
const entry = join(tempDir, 'agent.cjs');
const seaConfig = join(tempDir, 'sea-config.json');
const blob = join(tempDir, 'agent.blob');
const executable = join(webDownloads, 'RicozEndpointAgent.exe');
const postject = join(root, 'node_modules', 'postject', 'dist', 'cli.js');

mkdirSync(tempDir, { recursive: true });
mkdirSync(webDownloads, { recursive: true });

await build({
  entryPoints: [join(root, 'apps', 'agent', 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: entry,
  sourcemap: false,
});

writeFileSync(
  seaConfig,
  JSON.stringify({
    main: entry,
    output: blob,
    disableExperimentalSEAWarning: true,
    useCodeCache: true,
  }),
);

const sea = spawnSync(process.execPath, ['--experimental-sea-config', seaConfig], {
  cwd: root,
  stdio: 'inherit',
});
if (sea.status !== 0) process.exit(sea.status ?? 1);

copyFileSync(process.execPath, executable);
const inject = spawnSync(process.execPath, [postject, executable, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'], {
  cwd: root,
  stdio: 'inherit',
});
if (inject.status !== 0) process.exit(inject.status ?? 1);

const size = readFileSync(executable).byteLength;
console.log(`Built ${executable} (${Math.round(size / 1024 / 1024)} MB)`);