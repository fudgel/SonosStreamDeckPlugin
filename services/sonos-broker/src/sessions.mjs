const sessions = new Map()

export function createAuthorizingSession(sessionRef) {
  const session = {
    sessionRef,
    connectionStatus: "authorizing",
    connectedAccountLabel: undefined,
    lastError: undefined,
  }

  sessions.set(sessionRef, session)
  return session
}

export function getSession(sessionRef) {
  return sessionRef ? sessions.get(sessionRef) : undefined
}

export function getConnectedSession(sessionRef) {
  const session = getSession(sessionRef)

  return session && session.connectionStatus === "connected" ? session : undefined
}
