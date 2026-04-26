import commonjs from "@rollup/plugin-commonjs"
import nodeResolve from "@rollup/plugin-node-resolve"
import terser from "@rollup/plugin-terser"
import typescript from "@rollup/plugin-typescript"
import fs from "node:fs"
import path from "node:path"
import url from "node:url"

const isWatching = Boolean(process.env.ROLLUP_WATCH)
const sdPlugin = "com.sonosstreamdeck.plugin.sdPlugin"

function addWatchTree(watcher, dir) {
  if (!fs.existsSync(dir)) {
    return
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      addWatchTree(watcher, fullPath)
    } else {
      watcher.addWatchFile(fullPath)
    }
  }
}

export default {
  input: "src/plugin.ts",
  output: {
    file: `${sdPlugin}/bin/plugin.js`,
    sourcemap: isWatching,
    sourcemapPathTransform(relativeSourcePath, sourcemapPath) {
      return url.pathToFileURL(
        path.resolve(path.dirname(sourcemapPath), relativeSourcePath),
      ).href
    },
  },
  plugins: [
    {
      name: "watch-externals",
      buildStart() {
        this.addWatchFile(path.resolve(sdPlugin, "manifest.json"))
        addWatchTree(this, path.resolve(sdPlugin, "ui"))
        addWatchTree(this, path.resolve(sdPlugin, "imgs"))
      },
    },
    typescript({
      mapRoot: isWatching ? "./" : undefined,
    }),
    nodeResolve({
      browser: false,
      exportConditions: ["node"],
      preferBuiltins: true,
    }),
    commonjs(),
    !isWatching && terser(),
    {
      name: "emit-module-package-file",
      generateBundle() {
        this.emitFile({
          fileName: "package.json",
          source: '{ "type": "module" }',
          type: "asset",
        })
      },
    },
  ],
}
