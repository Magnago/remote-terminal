import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';

const sharedSrc = resolve(__dirname, '../../packages/shared/src');
const desktopPkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
const allDeps = [
  ...Object.keys(desktopPkg.dependencies || {}),
  ...Object.keys(desktopPkg.devDependencies || {}),
].filter((d) => d !== '@remote-terminal/shared');

// ESM-only packages cannot be require()'d in CJS output — must be bundled, not externalized.
const esmOnlyDeps = new Set(['electron-store', 'nanoid']);

// Externalize all node_modules deps via rollupOptions.external (array gets merged/concatenated
// with electron-vite's defaults by mergeConfig, giving Rollup direct externalization before
// Vite's SSR resolver, which would otherwise bundle everything due to forced noExternal:true).
const externalDeps = allDeps.filter((dep) => !esmOnlyDeps.has(dep)).flatMap((dep) => [
  dep,
  new RegExp(`^${dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`),
]);

export default defineConfig({
  main: {
    resolve: {
      alias: { '@shared': sharedSrc },
    },
    build: {
      rollupOptions: {
        external: externalDeps,
      },
    },
  },
  preload: {
    resolve: {
      alias: { '@shared': sharedSrc },
    },
    build: {
      rollupOptions: {
        external: externalDeps,
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        '@shared': sharedSrc,
      },
    },
    plugins: [react()],
  },
});
