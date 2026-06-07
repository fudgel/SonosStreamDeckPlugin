export function failure(code, message, retryable) {
  return {
    ok: false,
    code,
    message,
    retryable,
  }
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  }
}

export function sendOptions(res) {
  res.writeHead(204, corsHeaders())
  res.end()
}

export function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    ...corsHeaders(),
  })
  res.end(JSON.stringify(payload))
}

export function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    ...corsHeaders(),
  })
  res.end(html)
}

export async function readJsonBody(req, limitBytes) {
  let total = 0
  const chunks = []

  for await (const chunk of req) {
    total += chunk.length

    if (total > limitBytes) {
      throw new InputError(413, failure("service_error", "Request body too large.", false))
    }

    chunks.push(chunk)
  }

  if (!total) {
    return undefined
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"))
  } catch {
    throw new InputError(400, failure("service_error", "Request body is not valid JSON.", false))
  }
}

export class InputError extends Error {
  constructor(statusCode, payload) {
    super(payload.message)
    this.statusCode = statusCode
    this.payload = payload
  }
}

export function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

export function asTargetFromSearch(searchParams) {
  const householdId = asNonEmptyString(searchParams.get("householdId"))
  const groupId = asNonEmptyString(searchParams.get("groupId"))

  if (!householdId || !groupId) {
    return undefined
  }

  return { householdId, groupId }
}

export function connectionPayload(session) {
  return {
    ok: true,
    connectionStatus: session.connectionStatus,
    sessionRef: session.sessionRef,
    connectedAccountLabel: session.connectedAccountLabel,
    lastError: session.lastError,
  }
}
