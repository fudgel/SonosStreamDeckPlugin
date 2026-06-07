#!/usr/bin/env node
/**
 * Loop 01 helper: prove fetch-based SSE can receive stub frames.
 * Mirrors HttpSonosClient.subscribe() after the EventSource removal.
 */
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../..")
const host = process.env.SONOS_BROKER_HOST ?? "127.0.0.1"
const port = process.env.SONOS_BROKER_PORT ?? "47831"
const baseUrl = `http://${host}:${port}`

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}

function jsonField(body, expression) {
  const result = spawnSync(
    "node",
    [
      "-e",
      `const data = JSON.parse(process.argv[1]); const value = ${expression}; if (value === undefined || value === null) process.exit(2); console.log(typeof value === 'object' ? JSON.stringify(value) : String(value));`,
      body,
    ],
    { encoding: "utf8" },
  )

  if (result.status !== 0) {
    return null
  }

  return result.stdout.trim()
}

async function waitForConnected(sessionRef) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const response = await fetch(
      `${baseUrl}/v1/sonos/connection?sessionRef=${encodeURIComponent(sessionRef)}`,
    )
    const body = await response.text()
    const ok = jsonField(body, "data.ok")
    const status = jsonField(body, "data.connectionStatus")

    if (ok === "true" && status === "connected") {
      return
    }
  }

  fail("connection did not reach connected within ~5s")
}

function dispatchSseBlock(block) {
  if (!block.trim() || block.trimStart().startsWith(":")) {
    return null
  }

  let eventName
  const dataLines = []

  for (const line of block.split("\n")) {
    if (line.startsWith(":")) {
      continue
    }

    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim()
      continue
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (dataLines.length === 0) {
    return null
  }

  return { eventName, data: dataLines.join("\n") }
}

async function readFirstSseFrame(eventsUrl) {
  const controller = new AbortController()
  const response = await fetch(eventsUrl, {
    headers: { accept: "text/event-stream" },
    signal: controller.signal,
  })

  if (!response.ok) {
    fail(`SSE fetch returned HTTP ${response.status}`)
  }

  if (!response.body) {
    fail("SSE response had no body")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf("\n\n")
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const frame = dispatchSseBlock(block)

        if (frame) {
          return frame
        }

        boundary = buffer.indexOf("\n\n")
      }
    }
  } finally {
    controller.abort()
    reader.releaseLock()
  }

  fail("no SSE frame received")
}

async function main() {
  const authResponse = await fetch(`${baseUrl}/v1/sonos/auth/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  })
  const authBody = await authResponse.text()
  const sessionRef = jsonField(authBody, "data.sessionRef")

  if (!sessionRef) {
    fail("auth/start did not return sessionRef")
  }

  await waitForConnected(sessionRef)

  const eventsUrl =
    `${baseUrl}/v1/sonos/events?sessionRef=${encodeURIComponent(sessionRef)}` +
    "&householdId=house_1&groupId=group_1"

  const frame = await readFirstSseFrame(eventsUrl)

  if (!frame.data.includes('"state"')) {
    fail("SSE frame data did not include state payload")
  }

  console.log(`PASS  fetch SSE received event=${frame.eventName ?? "message"}`)
}

main()
