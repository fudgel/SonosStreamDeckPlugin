export type ConnectionStatus =
  | "disconnected"
  | "authorizing"
  | "connected"
  | "error"

export type GlobalSettings = {
  connectionStatus: ConnectionStatus
  serviceBaseUrl?: string
  sessionRef?: string
  connectedAccountLabel?: string
  lastError?: string
}

export type SonosActionSettings = {
  householdId?: string
  groupId?: string
  groupName?: string
}

export const defaultGlobalSettings: GlobalSettings = {
  connectionStatus: "disconnected",
}

// Global settings may contain only non-secret connection metadata.
// Access and refresh tokens must remain outside Stream Deck plugin settings.
export function parseGlobalSettings(value: unknown): GlobalSettings {
  if (!value || typeof value !== "object") {
    return defaultGlobalSettings
  }

  const candidate = value as Record<string, unknown>
  const connectionStatus = normalizeConnectionStatus(candidate.connectionStatus)

  return {
    connectionStatus,
    serviceBaseUrl: asOptionalString(candidate.serviceBaseUrl),
    sessionRef: asOptionalString(candidate.sessionRef),
    connectedAccountLabel: asOptionalString(candidate.connectedAccountLabel),
    lastError:
      connectionStatus === "error"
        ? asOptionalString(candidate.lastError)
        : undefined,
  }
}

export function parseActionSettings(value: unknown): SonosActionSettings {
  if (!value || typeof value !== "object") {
    return {}
  }

  const candidate = value as Record<string, unknown>

  return {
    householdId: asOptionalString(candidate.householdId),
    groupId: asOptionalString(candidate.groupId),
    groupName: asOptionalString(candidate.groupName),
  }
}

function normalizeConnectionStatus(value: unknown): ConnectionStatus {
  switch (value) {
    case "authorizing":
    case "connected":
    case "error":
      return value
    default:
      return "disconnected"
  }
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}
