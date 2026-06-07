import { randomUUID } from "node:crypto"

import type { ConnectionStatus, GlobalSettings } from "../core/settings"

export type SonosTarget = {
  householdId: string
  groupId: string
  groupName?: string
}

export type SonosServiceObjectId = {
  objectId: string
  serviceId?: string
  accountId?: string
}

export type SonosCommand =
  | { type: "playback.toggle" }
  | { type: "playback.next" }
  | { type: "playback.previous" }
  | { type: "group.mute.toggle" }
  | { type: "playback.mode.cycle" }

export type SonosCommandFailureCode =
  | "not_connected"
  | "not_configured"
  | "invalid_target"
  | "timeout"
  | "service_unreachable"
  | "service_error"
  | "not_implemented"

export type SonosCommandResult =
  | {
      ok: true
      requestId: string
      accepted: true
    }
  | {
      ok: false
      requestId?: string
      code: SonosCommandFailureCode
      message: string
      retryable: boolean
    }

export type SonosFailureResult = {
  ok: false
  code: SonosCommandFailureCode
  message: string
  retryable: boolean
}

export type SonosGroupState = {
  playbackStatus: "unknown" | "playing" | "paused" | "idle"
  currentTrackTitle?: string
  currentArtistName?: string
  currentTrackId?: SonosServiceObjectId
  currentAlbumName?: string
  currentAlbumId?: SonosServiceObjectId
  currentTrackImageUrl?: string
  currentAlbumImageUrl?: string
  positionMillis?: number
  durationMillis?: number
  albumArtUrl?: string
  isMuted: boolean
  playModeLabel?: string
  availableActions: {
    canSkip: boolean
    canSkipBack: boolean
    canPause: boolean
  }
}

export type SonosDiscoveredGroup = {
  householdId: string
  householdName?: string
  groupId: string
  groupName: string
  label: string
}

export type SonosAuthorizationStartResult =
  | {
      ok: true
      authorizeUrl: string
      sessionRef: string
    }
  | SonosFailureResult

export type SonosConnectionState = {
  connectionStatus: ConnectionStatus
  sessionRef?: string
  connectedAccountLabel?: string
  lastError?: string
}

export type SonosConnectionFetchResult =
  | {
      ok: true
      connection: SonosConnectionState
    }
  | SonosFailureResult

export type SonosGroupsFetchResult =
  | {
      ok: true
      groups: SonosDiscoveredGroup[]
    }
  | SonosFailureResult

export type SonosStateFetchResult =
  | { ok: true; state: SonosGroupState }
  | {
      ok: false
      code: SonosCommandFailureCode
      message: string
      retryable: boolean
    }

export type SonosSubscription = {
  close(): void
}

export type SonosSubscribeResult =
  | { ok: true; subscription: SonosSubscription }
  | {
      ok: false
      code: SonosCommandFailureCode
      message: string
      retryable: boolean
    }

export interface SonosClient {
  startAuthorization(): Promise<SonosAuthorizationStartResult>

  fetchConnectionStatus(
    sessionRef?: string,
  ): Promise<SonosConnectionFetchResult>

  fetchGroups(): Promise<SonosGroupsFetchResult>

  sendCommand(input: {
    target: SonosTarget
    command: SonosCommand
  }): Promise<SonosCommandResult>

  fetchState(target: SonosTarget): Promise<SonosStateFetchResult>

  subscribe(
    target: SonosTarget,
    onEvent: (state: SonosGroupState) => void,
    onError?: (result: SonosFailureResult) => void,
  ): Promise<SonosSubscribeResult>
}

export class HttpSonosClient implements SonosClient {
  readonly #getGlobalSettings: () => GlobalSettings

  constructor(getGlobalSettings: () => GlobalSettings) {
    this.#getGlobalSettings = getGlobalSettings
  }

  async startAuthorization(): Promise<SonosAuthorizationStartResult> {
    const serviceContext = this.#getServiceContext()

    if (!serviceContext.ok) {
      return serviceContext
    }

    const requestUrl = buildRequestUrl(
      serviceContext.serviceBaseUrl,
      "/v1/sonos/auth/start",
    )

    if (!requestUrl) {
      return invalidServiceBaseUrlResult()
    }

    try {
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sessionRef: serviceContext.sessionRef,
        }),
        signal: AbortSignal.timeout(4000),
      })

      const body = await safeJson(response)

      if (!response.ok) {
        return asFailureResult(body, response.status)
      }

      const authStart = asAuthorizationStart(body)

      return authStart
        ? { ok: true, ...authStart }
        : {
            ok: false,
            code: "service_error",
            message: "Authorization response is invalid.",
            retryable: false,
          }
    } catch (error) {
      return asNetworkFailureResult(error)
    }
  }

  async fetchConnectionStatus(
    sessionRef?: string,
  ): Promise<SonosConnectionFetchResult> {
    const sessionContext = this.#getSessionContext(sessionRef)

    if (!sessionContext.ok) {
      return sessionContext
    }

    const requestUrl = buildRequestUrl(
      sessionContext.serviceBaseUrl,
      "/v1/sonos/connection",
    )

    if (!requestUrl) {
      return invalidServiceBaseUrlResult()
    }

    requestUrl.searchParams.set("sessionRef", sessionContext.sessionRef)

    try {
      const response = await fetch(requestUrl, {
        signal: AbortSignal.timeout(4000),
      })

      const body = await safeJson(response)

      if (!response.ok) {
        return asFailureResult(body, response.status)
      }

      const connection = asConnectionState(body)

      return connection
        ? { ok: true, connection }
        : {
            ok: false,
            code: "service_error",
            message: "Connection response is invalid.",
            retryable: false,
          }
    } catch (error) {
      return asNetworkFailureResult(error)
    }
  }

  async fetchGroups(): Promise<SonosGroupsFetchResult> {
    const sessionContext = this.#getConnectedSessionContext()

    if (!sessionContext.ok) {
      return sessionContext
    }

    const requestUrl = buildRequestUrl(
      sessionContext.serviceBaseUrl,
      "/v1/sonos/groups",
    )

    if (!requestUrl) {
      return invalidServiceBaseUrlResult()
    }

    requestUrl.searchParams.set("sessionRef", sessionContext.sessionRef)

    try {
      const response = await fetch(requestUrl, {
        signal: AbortSignal.timeout(4000),
      })

      const body = await safeJson(response)

      if (!response.ok) {
        return asFailureResult(body, response.status)
      }

      const groups = asGroups(body)

      return groups
        ? { ok: true, groups }
        : {
            ok: false,
            code: "service_error",
            message: "Groups response is invalid.",
            retryable: false,
          }
    } catch (error) {
      return asNetworkFailureResult(error)
    }
  }

  async sendCommand(input: {
    target: SonosTarget
    command: SonosCommand
  }): Promise<SonosCommandResult> {
    const requestContext = this.#getConnectedTargetContext(input.target)

    if (!requestContext.ok) {
      return requestContext
    }

    const requestUrl = buildRequestUrl(
      requestContext.serviceBaseUrl,
      "/v1/sonos/commands",
    )

    if (!requestUrl) {
      return invalidServiceBaseUrlResult()
    }

    const requestId = randomUUID()

    try {
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestId,
          sessionRef: requestContext.sessionRef,
          target: {
            householdId: input.target.householdId,
            groupId: input.target.groupId,
          },
          command: input.command,
        }),
        signal: AbortSignal.timeout(4000),
      })

      const body = await safeJson(response)

      if (response.ok) {
        return {
          ok: true,
          accepted: true,
          requestId,
        }
      }

      return asCommandFailureResult(body, response.status, requestId)
    } catch (error) {
      return {
        requestId,
        ...asNetworkFailureResult(error),
      }
    }
  }

  async fetchState(target: SonosTarget): Promise<SonosStateFetchResult> {
    const requestContext = this.#getConnectedTargetContext(target)

    if (!requestContext.ok) {
      return requestContext
    }

    const requestUrl = buildRequestUrl(
      requestContext.serviceBaseUrl,
      "/v1/sonos/state",
    )

    if (!requestUrl) {
      return invalidServiceBaseUrlResult()
    }

    applyStateSearchParams(requestUrl, requestContext.sessionRef, target)

    try {
      const response = await fetch(requestUrl, {
        signal: AbortSignal.timeout(4000),
      })

      const body = await safeJson(response)

      if (!response.ok) {
        return asFailureResult(body, response.status)
      }

      const state = asStateEnvelope(body)

      return state
        ? { ok: true, state }
        : {
            ok: false,
            code: "service_error",
            message: "State response is invalid.",
            retryable: false,
          }
    } catch (error) {
      return asNetworkFailureResult(error)
    }
  }

  async subscribe(
    target: SonosTarget,
    onEvent: (state: SonosGroupState) => void,
    onError?: (result: SonosFailureResult) => void,
  ): Promise<SonosSubscribeResult> {
    const requestContext = this.#getConnectedTargetContext(target)

    if (!requestContext.ok) {
      return requestContext
    }

    const requestUrl = buildRequestUrl(
      requestContext.serviceBaseUrl,
      "/v1/sonos/events",
    )

    if (!requestUrl) {
      return invalidServiceBaseUrlResult()
    }

    applyStateSearchParams(requestUrl, requestContext.sessionRef, target)

    try {
      const probeResponse = await fetch(requestUrl, {
        headers: {
          accept: "text/event-stream",
        },
        signal: AbortSignal.timeout(4000),
      })

      const probeBody = await safeJson(probeResponse)

      if (!probeResponse.ok) {
        return asFailureResult(probeBody, probeResponse.status)
      }

      void probeResponse.body?.cancel()
    } catch (error) {
      return asNetworkFailureResult(error)
    }

    let source: EventSource

    try {
      source = new EventSource(requestUrl)
    } catch {
      return {
        ok: false,
        code: "service_unreachable",
        message: "Sonos event stream is unreachable.",
        retryable: true,
      }
    }

    const handleMessage = ((event: Event) => {
      const message = event as MessageEvent<string>
      const body = parseJsonRecord(message.data)
      const state = asStateEnvelope(body)

      if (state) {
        onEvent(state)
      }
    }) as EventListener

    source.addEventListener("message", handleMessage)
    source.addEventListener("state", handleMessage)
    source.onerror = () => {
      source.removeEventListener("message", handleMessage)
      source.removeEventListener("state", handleMessage)
      source.close()
      onError?.({
        ok: false,
        code: "service_unreachable",
        message: "Sonos event stream disconnected.",
        retryable: true,
      })
    }

    return {
      ok: true,
      subscription: {
        close() {
          source.removeEventListener("message", handleMessage)
          source.removeEventListener("state", handleMessage)
          source.close()
        },
      },
    }
  }

  #getServiceContext(): ServiceContextResult {
    const settings = this.#getGlobalSettings()

    if (!settings.serviceBaseUrl) {
      return {
        ok: false,
        code: "not_configured",
        message: "Service base URL is missing.",
        retryable: false,
      }
    }

    return {
      ok: true,
      serviceBaseUrl: settings.serviceBaseUrl,
      sessionRef: settings.sessionRef,
    }
  }

  #getSessionContext(sessionRef?: string): SessionContextResult {
    const serviceContext = this.#getServiceContext()

    if (!serviceContext.ok) {
      return serviceContext
    }

    if (!sessionRef && !serviceContext.sessionRef) {
      return {
        ok: false,
        code: "not_configured",
        message: "Session reference is missing.",
        retryable: false,
      }
    }

    const resolvedSessionRef = sessionRef ?? serviceContext.sessionRef

    if (!resolvedSessionRef) {
      return {
        ok: false,
        code: "not_configured",
        message: "Session reference is missing.",
        retryable: false,
      }
    }

    return {
      ok: true,
      serviceBaseUrl: serviceContext.serviceBaseUrl,
      sessionRef: resolvedSessionRef,
    }
  }

  #getConnectedSessionContext(): SessionContextResult {
    const settings = this.#getGlobalSettings()

    if (settings.connectionStatus !== "connected") {
      return {
        ok: false,
        code: "not_connected",
        message: "Sonos is not connected.",
        retryable: false,
      }
    }

    return this.#getSessionContext()
  }

  #getConnectedTargetContext(target: SonosTarget): TargetRequestContextResult {
    const sessionContext = this.#getConnectedSessionContext()

    if (!sessionContext.ok) {
      return sessionContext
    }

    if (!target.householdId || !target.groupId) {
      return {
        ok: false,
        code: "invalid_target",
        message: "Select a Sonos group for this action.",
        retryable: false,
      }
    }

    return {
      ok: true,
      serviceBaseUrl: sessionContext.serviceBaseUrl,
      sessionRef: sessionContext.sessionRef,
    }
  }
}

type ServiceContextResult =
  | {
      ok: true
      serviceBaseUrl: string
      sessionRef?: string
    }
  | SonosFailureResult

type SessionContextResult =
  | {
      ok: true
      serviceBaseUrl: string
      sessionRef: string
    }
  | SonosFailureResult

type TargetRequestContextResult = SessionContextResult

async function safeJson(response: Response): Promise<Record<string, unknown> | undefined> {
  const contentType = response.headers.get("content-type")

  if (!contentType?.includes("application/json")) {
    return undefined
  }

  try {
    const body = await response.json()
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

function parseJsonRecord(value: string): Record<string, unknown> | undefined {
  try {
    const body = JSON.parse(value)
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

function asFailureCode(value: unknown): SonosCommandFailureCode {
  switch (value) {
    case "not_connected":
    case "not_configured":
    case "invalid_target":
    case "timeout":
    case "service_unreachable":
    case "service_error":
    case "not_implemented":
      return value
    default:
      return "service_error"
  }
}

function asFailureMessage(value: unknown, statusCode: number): string {
  return typeof value === "string" && value.trim()
    ? value
    : `Sonos request failed with HTTP ${statusCode}.`
}

function asFailureResult(
  body: Record<string, unknown> | undefined,
  statusCode: number,
): SonosFailureResult {
  if (statusCode === 401 || statusCode === 403) {
    return {
      ok: false,
      code: "not_connected",
      message:
        typeof body?.message === "string" && body.message.trim()
          ? body.message
          : "Sonos connection is no longer valid. Reconnect the plugin.",
      retryable: false,
    }
  }

  return {
    ok: false,
    code: asFailureCode(body?.code),
    message: asFailureMessage(body?.message, statusCode),
    retryable: statusCode === 408 || statusCode === 429 || statusCode >= 500,
  }
}

function asCommandFailureResult(
  body: Record<string, unknown> | undefined,
  statusCode: number,
  requestId: string,
): SonosCommandResult {
  return {
    ...asFailureResult(body, statusCode),
    requestId,
  }
}

function asNetworkFailureResult(error: unknown): SonosFailureResult {
  const isTimeout = error instanceof Error && error.name === "TimeoutError"

  return {
    ok: false,
    code: isTimeout ? "timeout" : "service_unreachable",
    message: isTimeout
      ? "Sonos service timed out."
      : "Sonos service is unreachable.",
    retryable: true,
  }
}

function invalidServiceBaseUrlResult(): SonosFailureResult {
  return {
    ok: false,
    code: "not_configured",
    message: "Service base URL is invalid.",
    retryable: false,
  }
}

function buildRequestUrl(
  serviceBaseUrl: string,
  pathname: string,
): URL | undefined {
  try {
    return new URL(pathname, serviceBaseUrl)
  } catch {
    return undefined
  }
}

function applyStateSearchParams(
  requestUrl: URL,
  sessionRef: string,
  target: SonosTarget,
): void {
  requestUrl.searchParams.set("sessionRef", sessionRef)
  requestUrl.searchParams.set("householdId", target.householdId)
  requestUrl.searchParams.set("groupId", target.groupId)
}

function asStateEnvelope(
  body: Record<string, unknown> | undefined,
): SonosGroupState | undefined {
  if (!body?.state || typeof body.state !== "object") {
    return undefined
  }

  return asGroupState(body.state as Record<string, unknown>)
}

function asGroupState(value: Record<string, unknown>): SonosGroupState | undefined {
  const playbackStatus = asPlaybackStatus(value.playbackStatus)
  const availableActions = asAvailableActions(value.availableActions)

  if (!playbackStatus || !availableActions) {
    return undefined
  }

  return {
    playbackStatus,
    currentTrackTitle: asOptionalString(value.currentTrackTitle),
    currentArtistName: asOptionalString(value.currentArtistName),
    currentTrackId: asOptionalServiceObjectId(value.currentTrackId),
    currentAlbumName: asOptionalString(value.currentAlbumName),
    currentAlbumId: asOptionalServiceObjectId(value.currentAlbumId),
    currentTrackImageUrl: asOptionalString(value.currentTrackImageUrl),
    currentAlbumImageUrl: asOptionalString(value.currentAlbumImageUrl),
    positionMillis: asOptionalNumber(value.positionMillis),
    durationMillis: asOptionalNumber(value.durationMillis),
    albumArtUrl: asOptionalString(value.albumArtUrl),
    isMuted: Boolean(value.isMuted),
    playModeLabel: asOptionalString(value.playModeLabel),
    availableActions,
  }
}

function asAuthorizationStart(
  body: Record<string, unknown> | undefined,
): {
  authorizeUrl: string
  sessionRef: string
} | undefined {
  const authorizeUrl = asOptionalString(body?.authorizeUrl)
  const sessionRef = asOptionalString(body?.sessionRef)

  return authorizeUrl && sessionRef ? { authorizeUrl, sessionRef } : undefined
}

function asConnectionState(
  body: Record<string, unknown> | undefined,
): SonosConnectionState | undefined {
  const connectionStatus = asConnectionStatus(body?.connectionStatus)

  if (!connectionStatus) {
    return undefined
  }

  return {
    connectionStatus,
    sessionRef: asOptionalString(body?.sessionRef),
    connectedAccountLabel: asOptionalString(body?.connectedAccountLabel),
    lastError: asOptionalString(body?.lastError),
  }
}

function asGroups(
  body: Record<string, unknown> | undefined,
): SonosDiscoveredGroup[] | undefined {
  if (!Array.isArray(body?.households)) {
    return undefined
  }

  const groups: SonosDiscoveredGroup[] = []

  for (const householdValue of body.households) {
    if (!householdValue || typeof householdValue !== "object") {
      return undefined
    }

    const household = householdValue as Record<string, unknown>
    const householdId = asOptionalString(household.householdId)
    const householdName = asOptionalString(household.householdName)

    if (!householdId || !Array.isArray(household.groups)) {
      return undefined
    }

    for (const groupValue of household.groups) {
      if (!groupValue || typeof groupValue !== "object") {
        return undefined
      }

      const group = groupValue as Record<string, unknown>
      const groupId = asOptionalString(group.groupId)
      const groupName = asOptionalString(group.groupName)

      if (!groupId || !groupName) {
        return undefined
      }

      groups.push({
        householdId,
        householdName,
        groupId,
        groupName,
        label: householdName
          ? `${groupName} - ${householdName}`
          : groupName,
      })
    }
  }

  return groups
}

function asConnectionStatus(value: unknown): ConnectionStatus | undefined {
  switch (value) {
    case "disconnected":
    case "authorizing":
    case "connected":
    case "error":
      return value
    default:
      return undefined
  }
}

function asPlaybackStatus(value: unknown): SonosGroupState["playbackStatus"] | undefined {
  switch (value) {
    case "unknown":
    case "playing":
    case "paused":
    case "idle":
      return value
    default:
      return undefined
  }
}

function asAvailableActions(
  value: unknown,
): SonosGroupState["availableActions"] | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const actions = value as Record<string, unknown>

  return {
    canSkip: Boolean(actions.canSkip),
    canSkipBack: Boolean(actions.canSkipBack),
    canPause: Boolean(actions.canPause),
  }
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function asOptionalServiceObjectId(
  value: unknown,
): SonosServiceObjectId | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const objectId = asOptionalString((value as Record<string, unknown>).objectId)

  if (!objectId) {
    return undefined
  }

  return {
    objectId,
    serviceId: asOptionalString((value as Record<string, unknown>).serviceId),
    accountId: asOptionalString((value as Record<string, unknown>).accountId),
  }
}
