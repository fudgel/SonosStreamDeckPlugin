import http from "node:http"

const host = process.env.SONOS_BROKER_HOST || "127.0.0.1"
const port = Number(process.env.SONOS_BROKER_PORT || 47831)
const maxJsonBytes = 16 * 1024

const demoTracks = [
  {
    trackId: "song:signal-fires",
    albumId: "album:north-arcade-midnight-signals",
    albumName: "Midnight Signals",
    title: "Signal Fires",
    artist: "North Arcade",
    durationMillis: 214000,
    artwork: createArtworkDataUrl({
      title: "Signal Fires",
      artist: "North Arcade",
      accentA: "#ff8a50",
      accentB: "#ef5350",
    }),
  },
  {
    trackId: "song:cascade-static",
    albumId: "album:paper-satellites-signal-loss",
    albumName: "Signal Loss",
    title: "Cascade Static",
    artist: "Paper Satellites",
    durationMillis: 189000,
    artwork: createArtworkDataUrl({
      title: "Cascade Static",
      artist: "Paper Satellites",
      accentA: "#4fc3f7",
      accentB: "#00695c",
    }),
  },
  {
    trackId: "song:glass-harbor",
    albumId: "album:blue-meridian-tidal-memory",
    albumName: "Tidal Memory",
    title: "Glass Harbor",
    artist: "Blue Meridian",
    durationMillis: 247000,
    artwork: createArtworkDataUrl({
      title: "Glass Harbor",
      artist: "Blue Meridian",
      accentA: "#ffd180",
      accentB: "#6a1b9a",
    }),
  },
]

const playModeLabels = ["Play Once", "Repeat Queue", "Shuffle Queue"]

const demoHouseholds = [
  {
    householdId: "house_1",
    householdName: "Studio",
    groups: [
      { groupId: "group_1", groupName: "Living Room" },
      { groupId: "group_2", groupName: "Kitchen" },
    ],
  },
  {
    householdId: "house_2",
    householdName: "Upstairs",
    groups: [{ groupId: "group_3", groupName: "Bedroom" }],
  },
]

const authSessions = new Map()
const targetState = new Map()

class InputError extends Error {
  constructor(statusCode, payload) {
    super(payload.message)
    this.statusCode = statusCode
    this.payload = payload
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      sendOptions(res)
      return
    }

    if (!req.url) {
      sendJson(res, 400, failure("service_error", "Request URL is missing.", false))
      return
    }

    const requestUrl = new URL(req.url, `http://${host}:${port}`)

    if (req.method === "GET" && requestUrl.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: "sonos-broker-stub",
      })
      return
    }

    if (req.method === "POST" && requestUrl.pathname === "/v1/sonos/auth/start") {
      const body = await readJsonBody(req, maxJsonBytes)
      const sessionRefFromBody =
        body && typeof body === "object"
          ? asNonEmptyString(body.sessionRef)
          : undefined
      const session = startAuthorization(sessionRefFromBody)

      sendJson(res, 200, {
        ok: true,
        sessionRef: session.sessionRef,
        authorizeUrl: `http://${host}:${port}/mock-sonos-login?sessionRef=${encodeURIComponent(session.sessionRef)}`,
      })
      return
    }

    if (req.method === "GET" && requestUrl.pathname === "/mock-sonos-login") {
      const sessionRef = asNonEmptyString(requestUrl.searchParams.get("sessionRef"))
      const session = sessionRef ? getAuthSession(sessionRef) : undefined

      if (!session) {
        sendHtml(res, 404, `<h1>Invalid Sonos stub session</h1>`)
        return
      }

      markSessionConnected(session)
      sendHtml(
        res,
        200,
        `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Sonos Stub Auth</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at top, #263547 0%, #0f1720 70%);
        color: #eef5ff;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
      }
      main {
        max-width: 440px;
        padding: 32px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.06);
      }
      h1 {
        margin-top: 0;
      }
      p {
        color: #c8d6e5;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Sonos Stub Connected</h1>
      <p>The local broker stub marked this demo session as connected.</p>
      <p>You can return to Stream Deck and refresh the property inspector if needed.</p>
    </main>
  </body>
</html>`,
      )
      return
    }

    if (req.method === "GET" && requestUrl.pathname === "/v1/sonos/connection") {
      const sessionRef = asNonEmptyString(requestUrl.searchParams.get("sessionRef"))
      const session = sessionRef ? getAuthSession(sessionRef) : undefined

      if (!session) {
        sendJson(
          res,
          404,
          failure("not_connected", "Sonos session was not found.", false),
        )
        return
      }

      sendJson(res, 200, connectionPayload(session))
      return
    }

    if (req.method === "GET" && requestUrl.pathname === "/v1/sonos/groups") {
      const sessionRef = asNonEmptyString(requestUrl.searchParams.get("sessionRef"))
      const session = sessionRef ? getConnectedSession(sessionRef) : undefined

      if (!session) {
        sendJson(
          res,
          401,
          failure("not_connected", "Connect Sonos before loading groups.", false),
        )
        return
      }

      sendJson(res, 200, {
        ok: true,
        sessionRef: session.sessionRef,
        households: demoHouseholds,
      })
      return
    }

    if (req.method === "POST" && requestUrl.pathname === "/v1/sonos/commands") {
      const body = await readJsonBody(req, maxJsonBytes)

      if (!body || typeof body !== "object") {
        sendJson(res, 400, failure("service_error", "Command payload must be a JSON object.", false))
        return
      }

      const requestId = asNonEmptyString(body.requestId) || cryptoRandomId()
      const sessionRef = asNonEmptyString(body.sessionRef)
      const target = asTarget(body.target)
      const commandType = asCommandType(body.command)
      const session = sessionRef ? getConnectedSession(sessionRef) : undefined

      if (!sessionRef || !target || !commandType) {
        sendJson(
          res,
          400,
          {
            ...failure("invalid_target", "Missing sessionRef, target, or command type.", false),
            requestId,
          },
        )
        return
      }

      if (!session) {
        sendJson(
          res,
          401,
          {
            ...failure("not_connected", "Reconnect Sonos before sending commands.", false),
            requestId,
          },
        )
        return
      }

      const record = getOrCreateRecord(session.sessionRef, target)
      applyCommand(record, commandType)
      const payload = snapshotPayload(target, record)

      publishState(payload, record)

      console.log(
        `[broker] command ${commandType} target=${record.key} revision=${record.revision}`,
      )

      sendJson(res, 202, {
        ok: true,
        requestId,
        accepted: true,
      })
      return
    }

    if (req.method === "GET" && requestUrl.pathname === "/v1/sonos/state") {
      const sessionRef = asNonEmptyString(requestUrl.searchParams.get("sessionRef"))
      const target = asTargetFromSearch(requestUrl.searchParams)
      const session = sessionRef ? getConnectedSession(sessionRef) : undefined

      if (!sessionRef || !target) {
        sendJson(
          res,
          400,
          failure("invalid_target", "Missing sessionRef, householdId, or groupId.", false),
        )
        return
      }

      if (!session) {
        sendJson(
          res,
          401,
          failure("not_connected", "Reconnect Sonos before reading state.", false),
        )
        return
      }

      const record = getOrCreateRecord(session.sessionRef, target)
      sendJson(res, 200, snapshotPayload(target, record))
      return
    }

    if (req.method === "GET" && requestUrl.pathname === "/v1/sonos/events") {
      const sessionRef = asNonEmptyString(requestUrl.searchParams.get("sessionRef"))
      const target = asTargetFromSearch(requestUrl.searchParams)
      const session = sessionRef ? getConnectedSession(sessionRef) : undefined

      if (!sessionRef || !target) {
        sendJson(
          res,
          400,
          failure("invalid_target", "Missing sessionRef, householdId, or groupId.", false),
        )
        return
      }

      if (!session) {
        sendJson(
          res,
          401,
          failure("not_connected", "Reconnect Sonos before subscribing to events.", false),
        )
        return
      }

      const record = getOrCreateRecord(session.sessionRef, target)

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      })

      const client = res
      record.clients.add(client)

      writeSseState(client, snapshotPayload(target, record))

      const heartbeat = setInterval(() => {
        client.write(`: keep-alive\n\n`)
      }, 25000)

      const cleanup = () => {
        clearInterval(heartbeat)
        record.clients.delete(client)
      }

      req.on("close", cleanup)
      res.on("close", cleanup)
      return
    }

    sendJson(res, 404, failure("service_error", "Route not found.", false))
  } catch (error) {
    if (error instanceof InputError) {
      sendJson(res, error.statusCode, error.payload)
      return
    }

    console.error(`[broker] unexpected error`, error)

    if (!res.headersSent) {
      sendJson(res, 500, failure("service_error", "Unexpected broker error.", true))
    } else {
      res.end()
    }
  }
})

server.listen(port, host, () => {
  console.log(`[broker] listening on http://${host}:${port}`)
})

function getOrCreateRecord(sessionRef, target) {
  const key = `${sessionRef}:${target.householdId}:${target.groupId}`
  let record = targetState.get(key)

  if (!record) {
    record = createRecord(key)
    targetState.set(key, record)
  }

  return record
}

function createRecord(key) {
  return {
    key,
    revision: 0,
    trackIndex: 0,
    playbackStatus: "paused",
    positionMillis: 0,
    positionUpdatedAt: Date.now(),
    muted: false,
    playModeIndex: 0,
    clients: new Set(),
  }
}

function applyCommand(record, commandType) {
  syncPlaybackPosition(record)

  switch (commandType) {
    case "playback.toggle":
      record.playbackStatus =
        record.playbackStatus === "playing" ? "paused" : "playing"
      record.positionUpdatedAt = Date.now()
      break
    case "playback.next":
      record.trackIndex = (record.trackIndex + 1) % demoTracks.length
      record.positionMillis = 0
      record.positionUpdatedAt = Date.now()
      break
    case "playback.previous":
      record.trackIndex =
        (record.trackIndex - 1 + demoTracks.length) % demoTracks.length
      record.positionMillis = 0
      record.positionUpdatedAt = Date.now()
      break
    case "group.mute.toggle":
      record.muted = !record.muted
      break
    case "playback.mode.cycle":
      record.playModeIndex = (record.playModeIndex + 1) % playModeLabels.length
      break
    default:
      break
  }

  record.revision += 1
}

function syncPlaybackPosition(record) {
  if (record.playbackStatus !== "playing") {
    record.positionUpdatedAt = Date.now()
    return
  }

  const now = Date.now()
  const elapsed = Math.max(0, now - record.positionUpdatedAt)

  if (!elapsed) {
    return
  }

  const track = demoTracks[record.trackIndex]
  record.positionMillis = Math.min(
    track.durationMillis,
    record.positionMillis + elapsed,
  )
  record.positionUpdatedAt = now
}

function buildGroupState(record) {
  syncPlaybackPosition(record)
  const track = demoTracks[record.trackIndex]
  const playModeLabel = playModeLabels[record.playModeIndex]
  const currentTrackId = {
    serviceId: "stub-sonos-demo",
    accountId: "demo-account",
    objectId: track.trackId,
  }
  const currentAlbumId = {
    serviceId: "stub-sonos-demo",
    accountId: "demo-account",
    objectId: track.albumId,
  }

  return {
    playbackStatus: record.playbackStatus,
    currentTrackTitle: track.title,
    currentArtistName: track.artist,
    currentTrackId,
    currentAlbumName: track.albumName,
    currentAlbumId,
    currentTrackImageUrl: track.artwork,
    currentAlbumImageUrl: track.artwork,
    positionMillis: Math.round(record.positionMillis),
    durationMillis: track.durationMillis,
    albumArtUrl: track.artwork,
    isMuted: record.muted,
    playModeLabel,
    availableActions: {
      canSkip: true,
      canSkipBack: true,
      canPause: record.playbackStatus === "playing",
    },
  }
}

function snapshotPayload(target, record) {
  return {
    ok: true,
    target: {
      householdId: target.householdId,
      groupId: target.groupId,
    },
    revision: record.revision,
    state: buildGroupState(record),
  }
}

function publishState(payload, record) {
  for (const client of record.clients) {
    writeSseState(client, payload)
  }
}

function writeSseState(client, payload) {
  client.write(`event: state\n`)
  client.write(`id: ${payload.revision}\n`)
  client.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  }
}

function sendOptions(res) {
  res.writeHead(204, corsHeaders())
  res.end()
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    ...corsHeaders(),
  })
  res.end(JSON.stringify(payload))
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    ...corsHeaders(),
  })
  res.end(html)
}

function failure(code, message, retryable) {
  return {
    ok: false,
    code,
    message,
    retryable,
  }
}

function connectionPayload(session) {
  syncAuthSession(session)

  return {
    ok: true,
    connectionStatus: session.connectionStatus,
    sessionRef: session.sessionRef,
    connectedAccountLabel: session.connectedAccountLabel,
    lastError: session.lastError,
  }
}

function startAuthorization(existingSessionRef) {
  const sessionRef = existingSessionRef || `sess_${cryptoRandomId()}`
  const session = {
    sessionRef,
    connectionStatus: "authorizing",
    connectedAccountLabel: undefined,
    lastError: undefined,
    readyAt: Date.now() + 900,
  }

  authSessions.set(sessionRef, session)
  return session
}

function getAuthSession(sessionRef) {
  const session = authSessions.get(sessionRef)

  if (!session) {
    return undefined
  }

  syncAuthSession(session)
  return session
}

function getConnectedSession(sessionRef) {
  const session = getAuthSession(sessionRef)
  return session && session.connectionStatus === "connected" ? session : undefined
}

function syncAuthSession(session) {
  if (
    session.connectionStatus === "authorizing" &&
    Date.now() >= session.readyAt
  ) {
    markSessionConnected(session)
  }
}

function markSessionConnected(session) {
  session.connectionStatus = "connected"
  session.connectedAccountLabel = "Demo Sonos Account"
  session.lastError = undefined
  session.readyAt = Date.now()
}

async function readJsonBody(req, limitBytes) {
  let total = 0
  const chunks = []

  for await (const chunk of req) {
    total += chunk.length

    if (total > limitBytes) {
      throw new InputError(
        413,
        failure("service_error", "Request body exceeds the broker limit.", false),
      )
    }

    chunks.push(chunk)
  }

  if (!chunks.length) {
    return undefined
  }

  const raw = Buffer.concat(chunks).toString("utf8")

  try {
    return JSON.parse(raw)
  } catch {
    throw new InputError(
      400,
      failure("service_error", "Request body must contain valid JSON.", false),
    )
  }
}

function asTarget(value) {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const target = value
  const householdId = asNonEmptyString(target.householdId)
  const groupId = asNonEmptyString(target.groupId)

  if (!householdId || !groupId) {
    return undefined
  }

  return { householdId, groupId }
}

function asTargetFromSearch(searchParams) {
  const householdId = asNonEmptyString(searchParams.get("householdId"))
  const groupId = asNonEmptyString(searchParams.get("groupId"))

  if (!householdId || !groupId) {
    return undefined
  }

  return { householdId, groupId }
}

function asCommandType(value) {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const commandType = asNonEmptyString(value.type)

  switch (commandType) {
    case "playback.toggle":
    case "playback.next":
    case "playback.previous":
    case "group.mute.toggle":
    case "playback.mode.cycle":
      return commandType
    default:
      return undefined
  }
}

function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value : undefined
}

function createArtworkDataUrl({ title, artist, accentA, accentB }) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accentA}" />
      <stop offset="100%" stop-color="${accentB}" />
    </linearGradient>
  </defs>
  <rect width="144" height="144" rx="22" fill="url(#bg)" />
  <circle cx="112" cy="36" r="18" fill="rgba(255,255,255,0.18)" />
  <path d="M18 104C40 84 62 74 88 74C108 74 124 80 136 92V144H18Z" fill="rgba(0,0,0,0.18)" />
  <text x="16" y="30" fill="#fff7ef" font-size="10" font-family="Avenir Next, Segoe UI, sans-serif" letter-spacing="2">SONOS</text>
  <text x="16" y="98" fill="#ffffff" font-size="24" font-weight="700" font-family="Avenir Next, Segoe UI, sans-serif">${escapeXml(firstWord(title))}</text>
  <text x="16" y="118" fill="rgba(255,255,255,0.86)" font-size="11" font-family="Avenir Next, Segoe UI, sans-serif">${escapeXml(title)}</text>
  <text x="16" y="132" fill="rgba(255,255,255,0.72)" font-size="10" font-family="Avenir Next, Segoe UI, sans-serif">${escapeXml(artist)}</text>
</svg>`

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
}

function firstWord(value) {
  return value.split(/\s+/)[0] || value
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function cryptoRandomId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
