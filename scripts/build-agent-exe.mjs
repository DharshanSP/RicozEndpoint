import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const tempDir = join(root, '.tmp', 'agent-exe');
const webDownloads = join(root, 'apps', 'web', 'public', 'downloads');
const entry = join(tempDir, 'agent.cjs');
const seaConfig = join(tempDir, 'sea-config.json');
const blob = join(tempDir, 'agent.blob');
const executable = join(webDownloads, 'RicozEndpointAgent.exe');
const archive = join(webDownloads, 'RicozEndpointAgent.zip');
const postject = join(root, 'node_modules', 'postject', 'dist', 'cli.js');
const defaultApiUrl = process.env.RICOZ_AGENT_API_URL || 'https://ricoz-api.onrender.com/api';
// UPX is opt-out: set RICOZ_AGENT_UPX=0 to skip. Missing UPX is a warning, not an error.
const wantUpx = process.env.RICOZ_AGENT_UPX !== '0';

mkdirSync(tempDir, { recursive: true });
mkdirSync(webDownloads, { recursive: true });

await build({
  entryPoints: [join(root, 'apps', 'agent', 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: entry,
  sourcemap: false,
  minify: true,
  define: {
    __RICOZ_DEFAULT_API_URL__: JSON.stringify(defaultApiUrl),
  },
});

writeFileSync(
  seaConfig,
  JSON.stringify({
    main: entry,
    output: blob,
    disableExperimentalSEAWarning: true,
    // Off: the V8 code cache inflates the blob for negligible cold-start gain
    // in a long-lived heartbeat loop.
    useCodeCache: false,
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

function mb(path) {
  return (statSync(path).size / 1024 / 1024).toFixed(1);
}

console.log(`SEA exe: ${executable} (${mb(executable)} MB, blob ${mb(blob)} MB)`);

// Compress with UPX when available (~88 MB -> ~30-35 MB for Node SEA binaries).
if (wantUpx) {
  const upx = spawnSync('upx', ['--best', '--lzma', executable], { stdio: 'inherit' });
  if (upx.status === 0) {
    console.log(`UPX exe: ${executable} (${mb(executable)} MB)`);
  } else if (upx.error?.code === 'ENOENT') {
    console.warn('UPX not found on PATH; skipping compression (install UPX or set RICOZ_AGENT_UPX=0 to silence).');
  } else {
    console.warn(`UPX exited with status ${upx.status}; keeping uncompressed exe.`);
  }
}

// Zip the exe for distribution (release asset). Best-effort across platforms.
function zipArchive() {
  if (process.platform === 'win32') {
    return spawnSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', `Compress-Archive -Path "${executable}" -DestinationPath "${archive}" -Force`],
      { stdio: 'inherit' },
    );
  }
  return spawnSync('zip', ['-j', '-9', archive, executable], { stdio: 'inherit' });
}
const zipped = zipArchive();
if (zipped.status === 0) {
  console.log(`Archive: ${archive} (${mb(archive)} MB)`);
} else {
  console.warn('Could not create zip archive (zip/Compress-Archive unavailable); the .exe is still usable.');
}