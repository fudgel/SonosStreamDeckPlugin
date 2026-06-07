#!/usr/bin/env node

import { spawn, execFileSync } from "node:child_process"
import {
  existsSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(scriptDir, "..")
const stubScript = join(scriptDir, "sonos-broker-stub.mjs")
const pidFile = join(projectRoot, ".broker-stub.pid")
const logFile = join(projectRoot, ".broker-stub.log")

const defaultHost = process.env.SONOS_BROKER_HOST || "127.0.0.1"
const defaultPort = Number(process.env.SONOS_BROKER_PORT || 47831)

const usage = `Usage: node scripts/broker-stub.mjs <command> [options]

Commands:
  start     Start the broker stub (background by default)
  stop      Stop a running broker stub
  kill      Alias for stop
  restart   Stop then start the broker stub
  status    Show whether the stub is running and reachable

Options:
  --host <host>       Broker host (default: ${defaultHost})
  --port <port>       Broker port (default: ${defaultPort})
  --foreground, -f    Run in the foreground (start only)
  --watch, -w         Restart stub when sonos-broker-stub.mjs changes (start only)
  --help, -h          Show this help

Examples:
  npm run broker:start
  npm run broker:stop
  npm run broker:restart
  node scripts/broker-stub.mjs start --foreground
  node scripts/broker-stub.mjs start --port 47832
`

function parseArgs(argv) {
  const positional = []
  const options = {
    host: defaultHost,
    port: defaultPort,
    foreground: false,
    watch: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    switch (arg) {
      case "--help":
      case "-h":
        options.help = true
        break
      case "--foreground":
      case "-f":
        options.foreground = true
        break
      case "--watch":
      case "-w":
        options.watch = true
        break
      case "--host":
        options.host = argv[index + 1] ?? ""
        index += 1
        break
      case "--port":
        options.port = Number(argv[index + 1])
        index += 1
        break
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown option: ${arg}`)
        }
        positional.push(arg)
        break
    }
  }

  if (!Number.isFinite(options.port) || options.port <= 0) {
    throw new Error("Port must be a positive number.")
  }

  return { command: positional[0], options }
}

function baseUrl(host, port) {
  return `http://${host}:${port}`
}

function readPid() {
  if (!existsSync(pidFile)) {
    return undefined
  }

  const raw = readFileSync(pidFile, "utf8").trim()
  const pid = Number(raw)

  return Number.isInteger(pid) && pid > 0 ? pid : undefined
}

function writePid(pid) {
  writeFileSync(pidFile, `${pid}\n`, "utf8")
}

function clearPidFile() {
  if (existsSync(pidFile)) {
    unlinkSync(pidFile)
  }
}

function isProcessRunning(pid) {
  if (!pid) {
    return false
  }

  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error && typeof error === "object" && error.code === "EPERM"
  }
}

async function fetchHealth(host, port) {
  try {
    const response = await fetch(`${baseUrl(host, port)}/health`, {
      signal: AbortSignal.timeout(1500),
    })

    if (!response.ok) {
      return { ok: false, body: undefined }
    }

    return { ok: true, body: await response.json() }
  } catch {
    return { ok: false, body: undefined }
  }
}

function spawnStub(options, spawnOptions = {}) {
  const env = {
    ...process.env,
    SONOS_BROKER_HOST: options.host,
    SONOS_BROKER_PORT: String(options.port),
  }

  const nodeArgs = options.watch ? ["--watch", stubScript] : [stubScript]

  return spawn(process.execPath, nodeArgs, {
    cwd: projectRoot,
    env,
    stdio: spawnOptions.stdio ?? "inherit",
    detached: spawnOptions.detached ?? false,
    ...spawnOptions,
  })
}

function findPortListenerPid(port) {
  try {
    const output = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()

    if (!output) {
      return undefined
    }

    const pid = Number(output.split("\n")[0])

    return Number.isInteger(pid) && pid > 0 ? pid : undefined
  } catch {
    return undefined
  }
}

function killPid(pid, force) {
  process.kill(pid, force ? "SIGKILL" : "SIGTERM")
  console.log(`[broker] sent ${force ? "SIGKILL" : "SIGTERM"} to pid ${pid}`)
}

async function startStub(options) {
  const managedPid = readPid()

  if (managedPid && isProcessRunning(managedPid)) {
    const health = await fetchHealth(options.host, options.port)

    if (health.ok) {
      console.log(
        `[broker] already running (pid ${managedPid}) at ${baseUrl(options.host, options.port)}`,
      )
      return 0
    }

    console.log("[broker] stale pid file detected; stopping previous process")
    stopStub(options, { force: true })
  }

  const portPid = findPortListenerPid(options.port)

  if (portPid) {
    console.log(
      `[broker] port ${options.port} is already in use by pid ${portPid}; stopping it first`,
    )
    killPid(portPid, true)
    await sleep(200)
  }

  if (options.foreground) {
    console.log(
      `[broker] starting in foreground at ${baseUrl(options.host, options.port)}`,
    )

    const child = spawnStub(options, { stdio: "inherit" })
    writePid(child.pid)

    return new Promise((resolve) => {
      child.on("exit", (code) => {
        clearPidFile()
        resolve(code ?? 1)
      })
    })
  }

  console.log(
    `[broker] starting in background at ${baseUrl(options.host, options.port)}`,
  )
  console.log(`[broker] log file: ${logFile}`)

  const out = openLogFile()
  const child = spawnStub(options, {
    detached: true,
    stdio: ["ignore", out, out],
  })

  child.unref()
  writePid(child.pid)

  await sleep(300)

  if (!isProcessRunning(child.pid)) {
    clearPidFile()
    console.error("[broker] failed to start; see log file for details")
    return 1
  }

  const health = await fetchHealth(options.host, options.port)

  if (!health.ok) {
    console.error("[broker] process started but /health is not responding yet")
    return 1
  }

  console.log(`[broker] running (pid ${child.pid})`)
  return 0
}

function openLogFile() {
  return openSync(logFile, "a")
}

function stopStub(options, { force = false } = {}) {
  const managedPid = readPid()
  const stoppedPids = new Set()

  if (managedPid && isProcessRunning(managedPid)) {
    killPid(managedPid, force)
    stoppedPids.add(managedPid)
  }

  clearPidFile()

  const portPid = findPortListenerPid(options.port)

  if (portPid && !stoppedPids.has(portPid)) {
    killPid(portPid, force)
    stoppedPids.add(portPid)
  }

  if (stoppedPids.size === 0) {
    console.log(`[broker] no broker process found on port ${options.port}`)
    return 0
  }

  return 0
}

async function restartStub(options) {
  stopStub(options, { force: true })
  await sleep(200)
  return startStub(options)
}

async function statusStub(options) {
  const managedPid = readPid()
  const managedRunning = managedPid ? isProcessRunning(managedPid) : false
  const portPid = findPortListenerPid(options.port)
  const health = await fetchHealth(options.host, options.port)
  const url = baseUrl(options.host, options.port)

  if (managedRunning && health.ok) {
    console.log(`[broker] running (pid ${managedPid}) at ${url}`)
    if (health.body?.service) {
      console.log(`[broker] service: ${health.body.service}`)
    }
    return 0
  }

  if (health.ok) {
    console.log(
      `[broker] reachable at ${url}${portPid ? ` (pid ${portPid})` : ""} but not managed by ${pidFile}`,
    )
    return 0
  }

  if (managedRunning || portPid) {
    const pid = managedRunning ? managedPid : portPid
    console.log(`[broker] pid ${pid} exists but ${url}/health is not responding`)
    return 1
  }

  console.log(`[broker] not running at ${url}`)
  return 1
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function main() {
  let parsed

  try {
    parsed = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`[broker] ${error.message}`)
    console.error("")
    console.error(usage.trim())
    return 1
  }

  if (parsed.options.help || !parsed.command) {
    console.log(usage.trim())
    return parsed.options.help ? 0 : 1
  }

  switch (parsed.command) {
    case "start":
      return startStub(parsed.options)
    case "stop":
    case "kill":
      return stopStub(parsed.options, {
        force: parsed.command === "kill",
      })
    case "restart":
      return restartStub(parsed.options)
    case "status":
      return statusStub(parsed.options)
    default:
      console.error(`[broker] unknown command: ${parsed.command}`)
      console.error("")
      console.error(usage.trim())
      return 1
  }
}

main().then((code) => {
  process.exitCode = code
})
