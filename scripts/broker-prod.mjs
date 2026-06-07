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
const brokerScript = join(projectRoot, "services/sonos-broker/src/server.mjs")
const pidFile = join(projectRoot, ".broker-prod.pid")
const logFile = join(projectRoot, ".broker-prod.log")

const defaultHost = process.env.SONOS_BROKER_PROD_HOST || "127.0.0.1"
const defaultPort = Number(process.env.SONOS_BROKER_PROD_PORT || 47832)

const usage = `Usage: node scripts/broker-prod.mjs <command> [options]

Commands:
  start     Start the production Sonos broker (background by default)
  stop      Stop a running production broker
  kill      Alias for stop
  restart   Stop then start the production broker
  status    Show whether the broker is running and reachable

Options:
  --host <host>       Broker host (default: ${defaultHost})
  --port <port>       Broker port (default: ${defaultPort})
  --foreground, -f    Run in the foreground (start only)
  --watch, -w         Restart when server sources change (start only)
  --help, -h          Show this help

Examples:
  npm run broker:prod:start
  npm run broker:prod:stop
  npm run broker:prod
  node scripts/broker-prod.mjs start --foreground
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

function spawnBroker(options, spawnOptions = {}) {
  const env = {
    ...process.env,
    SONOS_BROKER_PROD_HOST: options.host,
    SONOS_BROKER_PROD_PORT: String(options.port),
    BROKER_PUBLIC_BASE_URL:
      process.env.BROKER_PUBLIC_BASE_URL || baseUrl(options.host, options.port),
  }

  const nodeArgs = options.watch ? ["--watch", brokerScript] : [brokerScript]

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
  console.log(`[sonos-broker] sent ${force ? "SIGKILL" : "SIGTERM"} to pid ${pid}`)
}

async function startBroker(options) {
  const managedPid = readPid()

  if (managedPid && isProcessRunning(managedPid)) {
    const health = await fetchHealth(options.host, options.port)

    if (health.ok) {
      console.log(
        `[sonos-broker] already running (pid ${managedPid}) at ${baseUrl(options.host, options.port)}`,
      )
      return 0
    }

    console.log("[sonos-broker] stale pid file detected; stopping previous process")
    stopBroker(options, { force: true })
  }

  const portPid = findPortListenerPid(options.port)

  if (portPid) {
    console.log(
      `[sonos-broker] port ${options.port} is already in use by pid ${portPid}; stopping it first`,
    )
    killPid(portPid, true)
    await sleep(200)
  }

  if (options.foreground) {
    console.log(
      `[sonos-broker] starting in foreground at ${baseUrl(options.host, options.port)}`,
    )

    const child = spawnBroker(options, { stdio: "inherit" })
    writePid(child.pid)

    return new Promise((resolve) => {
      child.on("exit", (code) => {
        clearPidFile()
        resolve(code ?? 1)
      })
    })
  }

  console.log(
    `[sonos-broker] starting in background at ${baseUrl(options.host, options.port)}`,
  )
  console.log(`[sonos-broker] log file: ${logFile}`)

  const out = openSync(logFile, "a")
  const child = spawnBroker(options, {
    detached: true,
    stdio: ["ignore", out, out],
  })

  child.unref()
  writePid(child.pid)

  await sleep(300)

  if (!isProcessRunning(child.pid)) {
    clearPidFile()
    console.error("[sonos-broker] failed to start; see log file for details")
    return 1
  }

  const health = await fetchHealth(options.host, options.port)

  if (!health.ok) {
    console.error("[sonos-broker] process started but /health is not responding yet")
    return 1
  }

  console.log(`[sonos-broker] running (pid ${child.pid})`)
  return 0
}

function stopBroker(options, { force = false } = {}) {
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
    console.log(`[sonos-broker] no broker process found on port ${options.port}`)
    return 0
  }

  return 0
}

async function restartBroker(options) {
  stopBroker(options, { force: true })
  await sleep(200)
  return startBroker(options)
}

async function statusBroker(options) {
  const managedPid = readPid()
  const managedRunning = managedPid ? isProcessRunning(managedPid) : false
  const portPid = findPortListenerPid(options.port)
  const health = await fetchHealth(options.host, options.port)
  const url = baseUrl(options.host, options.port)

  if (managedRunning && health.ok) {
    console.log(`[sonos-broker] running (pid ${managedPid}) at ${url}`)
    if (health.body?.service) {
      console.log(`[sonos-broker] service: ${health.body.service}`)
    }
    if (health.body?.sonosConfigured !== undefined) {
      console.log(`[sonos-broker] sonosConfigured: ${health.body.sonosConfigured}`)
    }
    return 0
  }

  if (health.ok) {
    console.log(
      `[sonos-broker] reachable at ${url}${portPid ? ` (pid ${portPid})` : ""} but not managed by ${pidFile}`,
    )
    return 0
  }

  if (managedRunning || portPid) {
    const pid = managedRunning ? managedPid : portPid
    console.log(`[sonos-broker] pid ${pid} exists but ${url}/health is not responding`)
    return 1
  }

  console.log(`[sonos-broker] not running at ${url}`)
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
    console.error(`[sonos-broker] ${error.message}`)
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
      return startBroker(parsed.options)
    case "stop":
    case "kill":
      return stopBroker(parsed.options, {
        force: parsed.command === "kill",
      })
    case "restart":
      return restartBroker(parsed.options)
    case "status":
      return statusBroker(parsed.options)
    default:
      console.error(`[sonos-broker] unknown command: ${parsed.command}`)
      console.error("")
      console.error(usage.trim())
      return 1
  }
}

main().then((code) => {
  process.exitCode = code
})
