#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..")

function runStep(label, command, args, options = {}) {
  console.log(`\n== ${label} ==`)
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    ...options,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function brokerReachable() {
  const result = spawnSync("node", ["scripts/broker-stub.mjs", "status"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  return result.status === 0
}

runStep("Plugin build", "npm", ["run", "build"])
runStep("Plugin validate", "npm", ["run", "validate"])
runStep("Typecheck", "npx", ["tsc", "--noEmit"])

if (!brokerReachable()) {
  runStep("Broker stub start", "node", ["scripts/broker-stub.mjs", "start"])
} else {
  console.log("\n== Broker stub ==")
  console.log("Broker already running.")
}

runStep("Broker smoke tests", "bash", ["scripts/broker-stub-test.sh"])

console.log("\nAll smoke checks passed.")
