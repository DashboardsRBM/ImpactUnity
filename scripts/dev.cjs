const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = fs.existsSync('/app/applet/package.json')
  ? '/app/applet'
  : path.resolve(__dirname, '..');

const buildIdPath = path.join(rootDir, '.next', 'BUILD_ID');
const routesManifestPath = path.join(rootDir, '.next', 'routes-manifest.json');

// If a verified production build exists in .next, run `next start` for instant responses and immutable chunk caching.
// If the container just cold-started and .next does not exist yet, fall back to `next dev` so port 3000 opens immediately.
const hasProdBuild =
  fs.existsSync(buildIdPath) && fs.existsSync(routesManifestPath);
const mode = hasProdBuild ? 'start' : 'dev';

console.log(`[dev.cjs] Starting Next.js in '${mode}' mode on 0.0.0.0:3000...`);

const child = spawn('npx', ['next', mode, '-p', '3000', '-H', '0.0.0.0'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: hasProdBuild ? 'production' : 'development',
  },
});

process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
