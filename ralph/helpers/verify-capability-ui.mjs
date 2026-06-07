#!/usr/bin/env node
/**
 * Loop 05 helper: stub exposes different availableActions for paused vs playing.
 */
import { spawnSync } from "node:child_process"

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
      `const data = JSON.parse(process.argv[1]); const value = ${expression}; if (value === undefined || value === null) process.exit(2); console.log(String(value));`,
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

async function fetchState(sessionRef) {
  const response = await fetch(
    `${baseUrl}/v1/sonos/state?sessionRef=${encodeURIComponent(sessionRef)}&householdId=house_1&groupId=group_1`,
  )
  return response.text()
}

async function togglePlayback(sessionRef) {
  const response = await fetch(`${baseUrl}/v1/sonos/commands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionRef,
      target: {
        householdId: "house_1",
        groupId: "group_1",
        groupName: "Living Room",
      },
      command: { type: "playback.toggle" },
    }),
  })

  const body = await response.text()
  const ok = jsonField(body, "data.ok")
  const accepted = jsonField(body, "data.accepted")

  if (ok !== "true" || accepted !== "true") {
    fail("playback.toggle did not succeed")
  }
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

  let stateBody = await fetchState(sessionRef)
  let playbackStatus = jsonField(stateBody, "data.state.playbackStatus")
  let canSkip = jsonField(stateBody, "data.state.availableActions.canSkip")

  if (playbackStatus === "playing") {
    await togglePlayback(sessionRef)
    stateBody = await fetchState(sessionRef)
    playbackStatus = jsonField(stateBody, "data.state.playbackStatus")
    canSkip = jsonField(stateBody, "data.state.availableActions.canSkip")
  }

  if (playbackStatus !== "paused") {
    fail(`expected paused state for capability baseline, got ${playbackStatus ?? "unknown"}`)
  }

  if (canSkip !== "false") {
    fail(`expected canSkip=false while paused, got ${canSkip ?? "unknown"}`)
  }

  console.log("PASS  paused state exposes canSkip=false")

  await togglePlayback(sessionRef)
  stateBody = await fetchState(sessionRef)
  playbackStatus = jsonField(stateBody, "data.state.playbackStatus")
  canSkip = jsonField(stateBody, "data.state.availableActions.canSkip")
  const canPause = jsonField(stateBody, "data.state.availableActions.canPause")

  if (playbackStatus !== "playing") {
    fail(`expected playing state after toggle, got ${playbackStatus ?? "unknown"}`)
  }

  if (canSkip !== "true" || canPause !== "true") {
    fail(
      `expected canSkip=true and canPause=true while playing, got canSkip=${canSkip} canPause=${canPause}`,
    )
  }

  console.log("PASS  playing state exposes canSkip=true and canPause=true")
}

main()
