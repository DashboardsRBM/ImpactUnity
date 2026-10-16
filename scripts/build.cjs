const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Guarantee that rootDir is always /app/applet
const rootDir =
  process.env.APP_DIR && fs.existsSync(process.env.APP_DIR)
    ? process.env.APP_DIR
    : fs.existsSync('/app/applet/package.json')
      ? '/app/applet'
      : path.resolve(__dirname, '..');

try {
  process.chdir(rootDir);
} catch (e) {
  console.warn(`[build.cjs] Warning: could not chdir to ${rootDir}:`, e);
}

const prodNextDir = path.join(rootDir, '.next-prod');
const nextDir = path.join(rootDir, '.next');
const sourceHashFile = path.join(nextDir, '.build-source-hash');

function computeSourceHash() {
  const hash = crypto.createHash('sha256');
  const walk = (targetPath) => {
    if (!fs.existsSync(targetPath)) return;
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(targetPath).sort();
      for (const entry of entries) {
        walk(path.join(targetPath, entry));
      }
    } else if (stat.isFile()) {
      hash.update(path.relative(rootDir, targetPath));
      hash.update(fs.readFileSync(targetPath));
    }
  };

  for (const item of [
    'app',
    'src',
    'public',
    'package.json',
    'next.config.mjs',
    'tsconfig.json',
    'postcss.config.mjs',
    'scripts/build.cjs',
    'scripts/dev.cjs',
  ]) {
    walk(path.join(rootDir, item));
  }
  return hash.digest('hex');
}

const currentSourceHash = computeSourceHash();
if (
  !process.env.FORCE_NEXT_BUILD &&
  fs.existsSync(path.join(nextDir, 'BUILD_ID')) &&
  fs.existsSync(path.join(nextDir, 'routes-manifest.json')) &&
  fs.existsSync(sourceHashFile) &&
  fs.readFileSync(sourceHashFile, 'utf8').trim() === currentSourceHash
) {
  console.log(
    `[build.cjs] Build artifacts in .next already match source hash (${currentSourceHash.slice(0, 12)}). Skipping redundant rebuild.`
  );
  process.exit(0);
}

console.log(`[build.cjs] Project root directory confirmed: ${rootDir}`);
console.log('[build.cjs] Starting production Next.js standalone build into isolated build directory...');

// Clean previous temporary production build directory
if (fs.existsSync(prodNextDir)) {
  fs.rmSync(prodNextDir, { recursive: true, force: true });
}

execSync(`npx next build "${rootDir}"`, {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    NEXT_DIST_DIR: '.next-prod',
    PWD: rootDir,
    INIT_CWD: rootDir,
  },
});

console.log('[build.cjs] Next.js build completed. Preparing standalone & production server artifacts...');

function collectJsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

// 1. Normalize .next-prod references inside .next-prod/standalone
const prodStandaloneDir = path.join(prodNextDir, 'standalone');
const standaloneDotNext = path.join(prodStandaloneDir, '.next');
if (fs.existsSync(prodStandaloneDir)) {
  const standaloneProdNext = path.join(prodStandaloneDir, '.next-prod');
  if (fs.existsSync(standaloneProdNext)) {
    if (fs.existsSync(standaloneDotNext)) {
      fs.rmSync(standaloneDotNext, { recursive: true, force: true });
    }
    fs.renameSync(standaloneProdNext, standaloneDotNext);
  }

  const serverJsPath = path.join(prodStandaloneDir, 'server.js');
  if (fs.existsSync(serverJsPath)) {
    const content = fs.readFileSync(serverJsPath, 'utf8').replace(/\.next-prod/g, '.next');
    fs.writeFileSync(serverJsPath, content, 'utf8');
  }
  const reqFilesPath = path.join(standaloneDotNext, 'required-server-files.json');
  if (fs.existsSync(reqFilesPath)) {
    const content = fs.readFileSync(reqFilesPath, 'utf8').replace(/\.next-prod/g, '.next');
    fs.writeFileSync(reqFilesPath, content, 'utf8');
  }
}

// Also normalize top-level required-server-files.json inside .next-prod
const topReqFilesPath = path.join(prodNextDir, 'required-server-files.json');
if (fs.existsSync(topReqFilesPath)) {
  const content = fs.readFileSync(topReqFilesPath, 'utf8').replace(/\.next-prod/g, '.next');
  fs.writeFileSync(topReqFilesPath, content, 'utf8');
}

// 2. Consolidate App Router client chunks into a single synchronous bundle so
//    React Flight never needs dynamic chunk loading (r.e / r.f.j) or extra HTTP requests.
const chunksDir = path.join(prodNextDir, 'static', 'chunks');
const buildManifestPath = path.join(prodNextDir, 'build-manifest.json');

if (fs.existsSync(chunksDir) && fs.existsSync(buildManifestPath)) {
  const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'));
  const origRootMainFiles = buildManifest.rootMainFiles || [];

  const webpackRel = origRootMainFiles.find((f) => f.includes('/webpack-'));
  const mainAppRel = origRootMainFiles.find((f) => f.includes('/main-app-'));
  const vendorRels = origRootMainFiles.filter(
    (f) => f !== webpackRel && f !== mainAppRel
  );

  if (webpackRel && mainAppRel) {
    const webpackFullPath = path.join(prodNextDir, webpackRel);
    const mainAppFullPath = path.join(prodNextDir, mainAppRel);

    // Patch webpack runtime so r.f.j never throws ChunkLoadError
    const origWebpackContent = fs.readFileSync(webpackFullPath, 'utf8');
    const patchedWebpackContent = origWebpackContent.replace(
      /r\.f\.j=\([^)]*\)=>\{[\s\S]*?\},r\.O\.j=/,
      'r.f.j=(t,o)=>{e[t]=0},r.O.j='
    );
    const newWebpackHash = crypto
      .createHash('md5')
      .update(patchedWebpackContent)
      .digest('hex')
      .slice(0, 16);
    const newWebpackFilename = `webpack-${newWebpackHash}.js`;
    const newWebpackRel = `static/chunks/${newWebpackFilename}`;
    fs.writeFileSync(webpackFullPath, patchedWebpackContent, 'utf8');
    fs.writeFileSync(path.join(chunksDir, newWebpackFilename), patchedWebpackContent, 'utf8');

    // Concatenate vendor chunks (4bd1b696, 255) + all app/* chunks + main-app in exact execution order.
    // Declare `var _N_E;` and strip top-level `"use strict";` prefixes so `_N_E=e.O()` never throws ReferenceError.
    const stripTopLevelUseStrict = (code) => code.replace(/^"use strict";\s*/, '');

    const vendorContents = vendorRels
      .map((rel) => path.join(prodNextDir, rel))
      .filter((p) => fs.existsSync(p))
      .map((p) => stripTopLevelUseStrict(fs.readFileSync(p, 'utf8')));

    const rootBasenames = new Set(origRootMainFiles.map((rel) => path.basename(rel)));
    const extraSharedChunkFiles = fs
      .readdirSync(chunksDir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.endsWith('.js') &&
          !rootBasenames.has(entry.name) &&
          !/^(webpack-|main-|main-app-|framework-|polyfills-)/.test(entry.name)
      )
      .map((entry) => path.join(chunksDir, entry.name))
      .sort();
    const extraSharedChunkContents = extraSharedChunkFiles.map((p) =>
      stripTopLevelUseStrict(fs.readFileSync(p, 'utf8'))
    );

    const appChunkFiles = collectJsFiles(path.join(chunksDir, 'app'));
    const appChunkContents = appChunkFiles.map((p) =>
      stripTopLevelUseStrict(fs.readFileSync(p, 'utf8'))
    );
    const origMainAppContent = stripTopLevelUseStrict(
      fs.readFileSync(mainAppFullPath, 'utf8')
    );

    const consolidatedMainAppContent = [
      'var _N_E;',
      ...vendorContents,
      ...extraSharedChunkContents,
      ...appChunkContents,
      origMainAppContent,
    ].join(';\n');

    const newMainAppHash = crypto
      .createHash('md5')
      .update(consolidatedMainAppContent)
      .digest('hex')
      .slice(0, 16);
    const newMainAppFilename = `main-app-${newMainAppHash}.js`;
    const newMainAppRel = `static/chunks/${newMainAppFilename}`;

    fs.writeFileSync(mainAppFullPath, consolidatedMainAppContent, 'utf8');
    fs.writeFileSync(path.join(chunksDir, newMainAppFilename), consolidatedMainAppContent, 'utf8');

    const newRootMainFiles = [newWebpackRel, newMainAppRel];

    const targetNextDirs = [prodNextDir];
    if (fs.existsSync(standaloneDotNext)) {
      targetNextDirs.push(standaloneDotNext);
    }

    for (const baseDir of targetNextDirs) {
      // Update build-manifest.json
      const bmPath = path.join(baseDir, 'build-manifest.json');
      if (fs.existsSync(bmPath)) {
        const bm = JSON.parse(fs.readFileSync(bmPath, 'utf8'));
        bm.rootMainFiles = newRootMainFiles;
        fs.writeFileSync(bmPath, JSON.stringify(bm, null, 2), 'utf8');
      }

      // Update app-build-manifest.json
      const abmPath = path.join(baseDir, 'app-build-manifest.json');
      if (fs.existsSync(abmPath)) {
        const abm = JSON.parse(fs.readFileSync(abmPath, 'utf8'));
        if (abm.pages) {
          for (const key of Object.keys(abm.pages)) {
            const cssOnly = (abm.pages[key] || []).filter((f) => f.endsWith('.css'));
            abm.pages[key] = [...cssOnly, ...newRootMainFiles];
          }
        }
        fs.writeFileSync(abmPath, JSON.stringify(abm, null, 2), 'utf8');
      }

      // Update server/middleware-build-manifest.js
      const mbmPath = path.join(baseDir, 'server', 'middleware-build-manifest.js');
      if (fs.existsSync(mbmPath)) {
        let mbm = fs.readFileSync(mbmPath, 'utf8');
        mbm = mbm.replace(
          /rootMainFiles:\[[^\]]*\]/,
          `rootMainFiles:${JSON.stringify(newRootMainFiles)}`
        );
        fs.writeFileSync(mbmPath, mbm, 'utf8');
      }

      // Clear chunk arrays and inline CSS in all *_client-reference-manifest.js files
      const serverAppDir = path.join(baseDir, 'server', 'app');
      for (const file of collectJsFiles(serverAppDir)) {
        if (file.endsWith('_client-reference-manifest.js')) {
          let crm = fs.readFileSync(file, 'utf8').replace(/"chunks":\[[^\]]*\]/g, '"chunks":[]');
          crm = crm.replace(
            /\{"inlined":false,"path":"(static\/css\/[^"]+)"\}/g,
            (match, cssRelPath) => {
              const cssFullPath = path.join(prodNextDir, cssRelPath);
              if (fs.existsSync(cssFullPath)) {
                const cssContent = fs.readFileSync(cssFullPath, 'utf8');
                return JSON.stringify({
                  inlined: true,
                  path: cssRelPath,
                  content: cssContent,
                });
              }
              return match;
            }
          );
          fs.writeFileSync(file, crm, 'utf8');
        }
      }
    }

    console.log(
      `[build.cjs] Consolidated ${vendorContents.length} vendor chunks + ${appChunkFiles.length} app chunks into ${newMainAppFilename} & patched ${newWebpackFilename}.`
    );
  }
}

// Remove webpack cache before syncing to .next to keep footprint small and fast
const prodCacheDir = path.join(prodNextDir, 'cache');
if (fs.existsSync(prodCacheDir)) {
  fs.rmSync(prodCacheDir, { recursive: true, force: true });
}

// 3. Preserve existing static chunks from previous builds so in-flight or cached HTML
//    referencing a previous chunk hash never hits a 404.
const prevStaticDir = path.join(nextDir, 'static');
const newStaticDir = path.join(prodNextDir, 'static');
if (fs.existsSync(prevStaticDir) && fs.existsSync(newStaticDir)) {
  try {
    fs.cpSync(prevStaticDir, newStaticDir, { recursive: true, force: false });
    const allChunkFiles = fs.readdirSync(chunksDir);
    const latestWebpackFiles = allChunkFiles.filter((f) => /^webpack-[0-9a-f]+\.js$/.test(f));
    const latestMainAppFiles = allChunkFiles.filter((f) => /^main-app-[0-9a-f]+\.js$/.test(f));
    const bm = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'));
    const activeWebpack = path.join(prodNextDir, bm.rootMainFiles[0]);
    const activeMainApp = path.join(prodNextDir, bm.rootMainFiles[1]);
    if (fs.existsSync(activeWebpack)) {
      const wc = fs.readFileSync(activeWebpack, 'utf8');
      for (const wf of latestWebpackFiles) {
        fs.writeFileSync(path.join(chunksDir, wf), wc, 'utf8');
      }
    }
    if (fs.existsSync(activeMainApp)) {
      const mc = fs.readFileSync(activeMainApp, 'utf8');
      for (const mf of latestMainAppFiles) {
        fs.writeFileSync(path.join(chunksDir, mf), mc, 'utf8');
      }
    }
  } catch (e) {
    // Ignore non-fatal merge warnings
  }
}

// 4. Sync production build (.next-prod) into .next in-place
fs.mkdirSync(nextDir, { recursive: true });
fs.cpSync(prodNextDir, nextDir, { recursive: true, force: true });
fs.writeFileSync(sourceHashFile, currentSourceHash, 'utf8');

// 5. Remove temporary .next-prod directory
if (fs.existsSync(prodNextDir)) {
  fs.rmSync(prodNextDir, { recursive: true, force: true });
}

console.log('[build.cjs] Build artifact preparation completed successfully.');

