import esbuild from "esbuild";
import { writeFileSync } from "fs";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

const peerDependencies = (packageJson) => {
  const json = readFileSync(packageJson, "utf8");
  const { peerDependencies } = JSON.parse(json);
  return peerDependencies ?? {};
};

const workspacePeerDependencies = peerDependencies(
  join(process.cwd(), "package.json"),
);

const dist = join(process.cwd(), "dist");

const createDistFolder = () => {
  if (!existsSync(dist)) {
    mkdirSync(dist);
  }
};

const buildBrowser = (entryPoints) => {
  esbuild
    .build({
      entryPoints,
      outdir: "dist/browser",
      bundle: true,
      sourcemap: true,
      minify: true,
      splitting: false,
      format: "esm",
      define: { global: "window" },
      target: ["esnext"],
      platform: "browser",
      conditions: ["browser"],
      external: [...Object.keys(workspacePeerDependencies)],
    })
    .catch(() => process.exit(1));
};

const buildNode = (entryPoints) => {
  esbuild
    .build({
      entryPoints,
      outdir: "dist/node",
      bundle: true,
      sourcemap: true,
      minify: true,
      format: "esm",
      platform: "node",
      target: ["node20", "esnext"],
      banner: {
        js: "import { createRequire as topLevelCreateRequire } from 'module';\n const require = topLevelCreateRequire(import.meta.url);",
      },
      external: [...Object.keys(workspacePeerDependencies)],
    })
    .catch(() => process.exit(1));
};

const bundleFiles = () => {
  const entryPoints = readdirSync(join(process.cwd(), "src"))
    .filter(
      (file) =>
        !file.includes("test") &&
        !file.includes("spec") &&
        !file.includes("mock") &&
        statSync(join(process.cwd(), "src", file)).isFile(),
    )
    .map((file) => `src/${file}`);

  buildBrowser(entryPoints);
  buildNode(entryPoints);
};

const writeEntries = () => {
  // an entry for the browser as default
  writeFileSync(join(dist, "index.js"), "export * from './browser/index.js';");
};

export const build = () => {
  createDistFolder();
  bundleFiles();
  writeEntries();
};

build();
