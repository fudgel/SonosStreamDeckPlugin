import http from "node:http"
import { isSonosConfigured, loadConfig } from "./config.mjs"
import {
  InputError,
  asNonEmptyString,
  asTargetFromSearch,
  connectionPayload,
  corsHeaders,
  failure,
  readJsonBody,
  sendHtml,
  sendJson,
  sendOptions,
} from "./contract.mjs"
import {
  createAuthorizingSession,
  getConnectedSession,
  getSession,
} from "./sessions.mjs"

const config = loadConfig()
const sonosConfigured = isSonosConfigured(config)

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

    const requestUrl = new URL(req.url, `${config.publicBaseUrl}/`)

    if (req.method === "GET" && requestUrl.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: "sonos-broker",
        sonosConfigured,
      })
      return
    }

    if (req.method === "POST" && requestUrl.pathname === "/v1/sonos/auth/start") {
      await handleAuthStart(req, res)
      return
    }

    if (req.method === "GET" && requestUrl.pathname === "/oauth/pending") {
      handleOAuthPending(requestUrl, res)
      return
    }

    if (req.method === "GET" && requestUrl.pathname === "/v1/sonos/connection") {
      handleConnection(requestUrl, res)
      return
    }

    if (req.method === "GET" && requestUrl.pathname === "/v1/sonos/groups") {
      requireConnectedSession(requestUrl, res, () => {
        sendJson(
          res,
          503,
          failure(
            "not_connected",
            "Sonos group discovery is not wired yet (Loop 10).",
            false,
          ),
        )
      })
      return
    }

    if (req.method === "GET" && requestUrl.pathname === "/v1/sonos/state") {
      requireConnectedSessionAndTarget(requestUrl, res, () => {
        sendJson(
          res,
          503,
          failure(
            "not_connected",
            "Sonos state bootstrap is not wired yet (Loop 10).",
            false,
          ),
        )
      })
      return
    }

    if (req.method === "GET" && requestUrl.pathname === "/v1/sonos/events") {
      requireConnectedSessionAndTarget(requestUrl, res, () => {
        sendJson(
          res,
          503,
          failure(
            "not_connected",
            "Sonos event stream is not wired yet (Loop 12).",
            true,
          ),
        )
      })
      return
    }

    if (req.method === "POST" && requestUrl.pathname === "/v1/sonos/commands") {
      await handleCommand(req, res)
      return
    }

    sendJson(res, 404, failure("service_error", "Route not found.", false))
  } catch (error) {
    if (error instanceof InputError) {
      sendJson(res, error.statusCode, error.payload)
      return
    }

    console.error("[sonos-broker] unexpected error", error)

    if (!res.headersSent) {
      sendJson(res, 500, failure("service_error", "Unexpected broker error.", true))
    } else {
      res.end()
    }
  }
})

server.listen(config.port, config.host, () => {
  console.log(
    `[sonos-broker] listening on http://${config.host}:${config.port} sonosConfigured=${sonosConfigured}`,
  )
})

async function handleAuthStart(req, res) {
  if (!sonosConfigured) {
    sendJson(
      res,
      503,
      failure(
        "not_configured",
        "Sonos OAuth is not configured. Set SONOS_CLIENT_ID, SONOS_CLIENT_SECRET, and SONOS_REDIRECT_URI.",
        false,
      ),
    )
    return
  }

  const body = await readJsonBody(req, config.maxJsonBytes)
  const sessionRefFromBody =
    body && typeof body === "object"
      ? asNonEmptyString(body.sessionRef)
      : undefined
  const sessionRef = sessionRefFromBody || `sess_${cryptoRandomId()}`
  const session = createAuthorizingSession(sessionRef)

  sendJson(res, 200, {
    ok: true,
    sessionRef: session.sessionRef,
    authorizeUrl: `${config.publicBaseUrl}/oauth/pending?sessionRef=${encodeURIComponent(session.sessionRef)}`,
  })
}

function handleOAuthPending(requestUrl, res) {
  const sessionRef = asNonEmptyString(requestUrl.searchParams.get("sessionRef"))
  const session = sessionRef ? getSession(sessionRef) : undefined

  if (!session) {
    sendHtml(res, 404, "<h1>Invalid Sonos broker session</h1>")
    return
  }

  sendHtml(
    res,
    200,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Sonos OAuth Pending</title>
  </head>
  <body>
    <main>
      <h1>Sonos OAuth scaffold</h1>
      <p>Real Sonos authorization lands in Ralph Loop 09.</p>
      <p>Session: ${escapeHtml(session.sessionRef)}</p>
    </main>
  </body>
</html>`,
  )
}

function handleConnection(requestUrl, res) {
  const sessionRef = asNonEmptyString(requestUrl.searchParams.get("sessionRef"))
  const session = sessionRef ? getSession(sessionRef) : undefined

  if (!session) {
    sendJson(
      res,
      404,
      failure("not_connected", "Sonos session was not found.", false),
    )
    return
  }

  sendJson(res, 200, connectionPayload(session))
}

async function handleCommand(req, res) {
  if (!sonosConfigured) {
    sendJson(
      res,
      503,
      failure(
        "not_configured",
        "Sonos commands require broker OAuth configuration.",
        false,
      ),
    )
    return
  }

  const body = await readJsonBody(req, config.maxJsonBytes)
  const sessionRef =
    body && typeof body === "object"
      ? asNonEmptyString(body.sessionRef)
      : undefined
  const session = sessionRef ? getConnectedSession(sessionRef) : undefined

  if (!session) {
    sendJson(
      res,
      401,
      failure("not_connected", "Reconnect Sonos before sending commands.", false),
    )
    return
  }

  sendJson(
    res,
    503,
    failure(
      "not_connected",
      "Sonos command writes are not wired yet (Loop 11).",
      false,
    ),
  )
}

function requireConnectedSession(requestUrl, res, onConnected) {
  const sessionRef = asNonEmptyString(requestUrl.searchParams.get("sessionRef"))
  const session = sessionRef ? getConnectedSession(sessionRef) : undefined

  if (!sessionRef) {
    sendJson(
      res,
      400,
      failure(
        "invalid_target",
        "Missing sessionRef, householdId, or groupId.",
        false,
      ),
    )
    return
  }

  if (!session) {
    sendJson(
      res,
      401,
      failure("not_connected", "Reconnect Sonos before reading groups.", false),
    )
    return
  }

  onConnected(session)
}

function requireConnectedSessionAndTarget(requestUrl, res, onConnected) {
  const sessionRef = asNonEmptyString(requestUrl.searchParams.get("sessionRef"))
  const target = asTargetFromSearch(requestUrl.searchParams)
  const session = sessionRef ? getConnectedSession(sessionRef) : undefined

  if (!sessionRef || !target) {
    sendJson(
      res,
      400,
      failure(
        "invalid_target",
        "Missing sessionRef, householdId, or groupId.",
        false,
      ),
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

  onConnected(session, target)
}

function cryptoRandomId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}
