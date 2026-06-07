#!/usr/bin/env node
/**
 * Static checks: every command action maps to the expected broker command type
 * and passes ev.action.id into runCommand for global actionTargets fallback.
 */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../..")
const actionsDir = join(projectRoot, "src/actions")

const commandActions = [
  {
    file: "play-pause.ts",
    kind: "play-pause",
    commandType: "playback.toggle",
  },
  {
    file: "next-track.ts",
    kind: "next-track",
    commandType: "playback.next",
  },
  {
    file: "previous-track.ts",
    kind: "previous-track",
    commandType: "playback.previous",
  },
  {
    file: "mute-toggle.ts",
    kind: "mute-toggle",
    commandType: "group.mute.toggle",
  },
  {
    file: "play-mode.ts",
    kind: "play-mode",
    commandType: "playback.mode.cycle",
  },
  {
    file: "now-playing-encoder.ts",
    kind: "now-playing-encoder",
    commandType: "playback.toggle",
    minRunCommandCalls: 2,
  },
]

function fail(message) {
  console.error(`FAIL  ${message}`)
  process.exit(1)
}

function readAction(fileName) {
  return readFileSync(join(actionsDir, fileName), "utf8")
}

for (const action of commandActions) {
  const source = readAction(action.file)

  if (!source.includes("runCommand(")) {
    fail(`${action.file} missing runCommand()`)
  }

  const runCommandCalls = source.match(/runCommand\(/g)?.length ?? 0
  const expectedCalls = action.minRunCommandCalls ?? 1

  if (runCommandCalls < expectedCalls) {
    fail(`${action.file} expected ${expectedCalls} runCommand call(s), found ${runCommandCalls}`)
  }

  if (!source.includes(`"${action.commandType}"`)) {
    fail(`${action.file} missing command type ${action.commandType}`)
  }

  if (!source.includes("ev.action.id")) {
    fail(`${action.file} missing ev.action.id argument to runCommand`)
  }

  if (!source.includes(`"${action.kind}"`) || !source.includes("registerVisibleAction(")) {
    fail(`${action.file} missing registerVisibleAction for kind ${action.kind}`)
  }

  console.log(`PASS  ${action.file} -> ${action.commandType}`)
}

const albumArt = readAction("album-art.ts")

if (albumArt.includes("runCommand(")) {
  fail("album-art.ts must not send commands")
}

if (!albumArt.includes('"album-art"') || !albumArt.includes("registerVisibleAction(")) {
  fail("album-art.ts missing registerVisibleAction")
}

console.log("PASS  album-art.ts display-only")

const pluginSource = readFileSync(join(projectRoot, "src/plugin.ts"), "utf8")
const manifestSource = readFileSync(
  join(projectRoot, "com.sonosstreamdeck.plugin.sdPlugin/manifest.json"),
  "utf8",
)

for (const action of [...commandActions, { file: "album-art.ts" }]) {
  const pascal = action.file
    .replace(".ts", "")
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("") + "Action"

  if (!pluginSource.includes(pascal)) {
    fail(`plugin.ts missing registration for ${pascal}`)
  }

  const uuid = `com.sonosstreamdeck.plugin.${action.file.replace(".ts", "")}`
  if (!manifestSource.includes(uuid)) {
    fail(`manifest.json missing ${uuid}`)
  }
}

console.log("PASS  plugin.ts registers all manifest actions")
