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
  connectRequestedAt?: number
  /** Default Sonos group for all actions unless overridden per key. */
  defaultTarget?: SonosActionSettings
  actionTargets?: Record<string, SonosActionSettings>
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
    connectRequestedAt: asOptionalNumber(candidate.connectRequestedAt),
    lastError:
      connectionStatus === "error"
        ? asOptionalString(candidate.lastError)
        : undefined,
    actionTargets: parseActionTargets(candidate.actionTargets),
    defaultTarget: parseDefaultTarget(candidate.defaultTarget),
  }
}

function parseDefaultTarget(value: unknown): SonosActionSettings | undefined {
  const parsed = parseActionSettings(value)

  if (parsed.householdId && parsed.groupId) {
    return parsed
  }

  return undefined
}

function parseActionTargets(
  value: unknown,
): Record<string, SonosActionSettings> | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const entries: Record<string, SonosActionSettings> = {}

  for (const [contextId, settings] of Object.entries(value)) {
    const parsed = parseActionSettings(settings)
    if (parsed.householdId && parsed.groupId) {
      entries[contextId] = parsed
    }
  }

  return Object.keys(entries).length > 0 ? entries : undefined
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

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

