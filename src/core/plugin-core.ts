import streamDeck, {
  type ActionContext,
  type DialAction,
  type KeyAction,
} from "@elgato/streamdeck"

import {
  type GlobalSettings,
  type SonosActionSettings,
  parseActionSettings,
  parseGlobalSettings,
} from "./settings"
import {
  type SonosTargetStateSnapshot,
  SonosStateStore,
} from "./state-store"
import {
  HttpSonosClient,
  type SonosClient,
  type SonosCommand,
  type SonosCommandResult,
  type SonosConnectionState,
  type SonosDiscoveredGroup,
  type SonosFailureResult,
  type SonosSubscription,
  type SonosTarget,
} from "../sonos/client"

type VisibleActionKind =
  | "album-art"
  | "mute-toggle"
  | "next-track"
  | "now-playing-encoder"
  | "play-mode"
  | "play-pause"
  | "previous-track"

type VisibleActionInstance = {
  kind: VisibleActionKind
  action: DialAction<SonosActionSettings> | KeyAction<SonosActionSettings>
  target: SonosActionSettings
}

type TargetRuntime = {
  disposed: boolean
  target: SonosTarget
  subscription?: SonosSubscription
  bootstrapping?: Promise<void>
}

type PropertyInspectorGroupsStatus = "idle" | "loading" | "ready" | "error"

export type PropertyInspectorMessage =
  | { type: "request-snapshot" }
  | { type: "refresh-groups"; serviceBaseUrl?: string }
  | { type: "start-auth"; serviceBaseUrl?: string }
  | {
      type: "set-target"
      householdId?: string
      groupId?: string
      groupName?: string
    }
  | {
      type: "sync-connection"
      serviceBaseUrl?: string
      sessionRef?: string
      connectionStatus: GlobalSettings["connectionStatus"]
      connectedAccountLabel?: string
      lastError?: string
    }

type PropertyInspectorSnapshot = {
  type: "snapshot"
  groups: SonosDiscoveredGroup[]
  groupsError?: string
  groupsStatus: PropertyInspectorGroupsStatus
}

export class PluginCore {
  readonly stateStore = new SonosStateStore()

  readonly sonosClient: SonosClient

  readonly #visibleActions = new Map<string, VisibleActionInstance>()

  readonly #targetRuntimes = new Map<string, TargetRuntime>()

  #availableGroups: SonosDiscoveredGroup[] = []

  #groupsStatus: PropertyInspectorGroupsStatus = "idle"

  #groupsError?: string

  #progressTimer?: ReturnType<typeof setInterval>

  #authPollVersion = 0

  #groupsRequestVersion = 0

  #subscriptionRetryTimers = new Map<string, ReturnType<typeof setTimeout>>()

  #lastConnectRequestedAt = 0

  constructor() {
    this.sonosClient = new HttpSonosClient(
      () => this.stateStore.getSnapshot().globalSettings,
    )

    this.stateStore.subscribe(() => {
      this.#syncProgressTimer()
      void this.#renderVisibleActions()
    })
  }

  initialize(): void {
    streamDeck.settings.useExperimentalMessageIdentifiers = true
    streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
      const persisted = parseGlobalSettings(ev.settings)
      const current = this.stateStore.getSnapshot().globalSettings
      const globalSettings = mergeGlobalSettings(current, persisted)
      streamDeck.logger.info(
        `Global settings received: connection=${globalSettings.connectionStatus} serviceBaseUrl=${Boolean(globalSettings.serviceBaseUrl)} session=${Boolean(globalSettings.sessionRef)} connectRequestedAt=${globalSettings.connectRequestedAt ?? "none"}`,
      )
      this.#applyGlobalSettings(globalSettings)
    })
    streamDeck.ui.onDidAppear(() => {
      void this.#handlePropertyInspectorAppear()
    })
  }

  async hydrateSettings(): Promise<void> {
    const globalSettings = mergeGlobalSettings(
      this.stateStore.getSnapshot().globalSettings,
      parseGlobalSettings(await streamDeck.settings.getGlobalSettings()),
    )
    this.#lastConnectRequestedAt = globalSettings.connectRequestedAt ?? 0
    this.#applyGlobalSettings(globalSettings)
  }

  syncActionTarget(settings: unknown): SonosActionSettings {
    return parseActionSettings(settings)
  }

  registerVisibleAction(
    kind: VisibleActionKind,
    action: DialAction<SonosActionSettings> | KeyAction<SonosActionSettings>,
    settings: unknown,
  ): void {
    const target = this.syncActionTarget(settings)
    streamDeck.logger.info(
      `Action visible: ${kind} context=${action.id} target=${targetLogValue(target)}`,
    )
    this.#visibleActions.set(action.id, {
      kind,
      action,
      target,
    })

    this.#syncProgressTimer()
    void this.#syncTargetRuntimes()
    void this.#renderVisibleAction(action.id)
  }

  updateVisibleAction(
    kind: VisibleActionKind,
    action: DialAction<SonosActionSettings> | KeyAction<SonosActionSettings>,
    settings: unknown,
  ): void {
    const visibleAction = this.#visibleActions.get(action.id)

    if (!visibleAction) {
      this.registerVisibleAction(kind, action, settings)
      return
    }

    visibleAction.kind = kind
    visibleAction.target = this.syncActionTarget(settings)
    streamDeck.logger.info(
      `Action settings updated: ${kind} context=${action.id} target=${targetLogValue(visibleAction.target)}`,
    )
    this.#syncProgressTimer()
    void this.#syncTargetRuntimes()
    void this.#renderVisibleAction(action.id)
  }

  unregisterVisibleAction(action: ActionContext): void {
    this.#visibleActions.delete(action.id)
    this.#syncProgressTimer()
    void this.#syncTargetRuntimes()
  }

  async runCommand(
    settings: unknown,
    commandName: string,
    command: SonosCommand,
    actionId?: string,
  ): Promise<SonosCommandResult> {
    await this.#synchronizeGlobalSettings()

    let target = this.syncActionTarget(settings)
    if (!target.groupId || !target.householdId) {
      const visible = actionId ? this.#visibleActions.get(actionId) : undefined
      if (visible?.target.groupId && visible.target.householdId) {
        target = visible.target
      } else if (actionId) {
        const fromGlobal =
          this.stateStore.getSnapshot().globalSettings.actionTargets?.[actionId]
        if (fromGlobal?.groupId && fromGlobal.householdId) {
          target = fromGlobal
        }
      }
    }
    const globalSettings = this.stateStore.getSnapshot().globalSettings
    streamDeck.logger.info(
      `Sonos command requested: ${commandName} connection=${globalSettings.connectionStatus} session=${Boolean(globalSettings.sessionRef)} target=${targetLogValue(target)}`,
    )
    const result = await this.sonosClient.sendCommand({
      target: {
        householdId: target.householdId ?? "",
        groupId: target.groupId ?? "",
        groupName: target.groupName,
      },
      command,
    })

    this.stateStore.recordCommandResult(commandName, result)

    if (result.ok) {
      streamDeck.logger.info(`Sonos command accepted: ${commandName}`)
    } else {
      if (result.code === "not_connected") {
        await this.#handleConnectionLoss(result.message)
      }

      streamDeck.logger.warn(
        `Sonos command failed: ${commandName} ${result.code} ${result.message}`,
      )
    }

    return result
  }

  async #handlePropertyInspectorAppear(): Promise<void> {
    await this.#sendPropertyInspectorSnapshot()

    if (this.#shouldRefreshGroupsOnInspectorOpen()) {
      void this.refreshAvailableGroups()
    }
  }

  async handlePropertyInspectorMessage(
    payload: PropertyInspectorMessage,
  ): Promise<void> {
    streamDeck.logger.info(`PI message received: ${payload.type}`)

    if (payload.type === "sync-connection") {
      await this.#persistGlobalSettings({
        ...this.stateStore.getSnapshot().globalSettings,
        serviceBaseUrl: payload.serviceBaseUrl?.trim() || undefined,
        sessionRef: payload.sessionRef,
        connectionStatus: payload.connectionStatus,
        connectedAccountLabel: payload.connectedAccountLabel,
        lastError: payload.lastError,
        connectRequestedAt: undefined,
      })

      if (payload.connectionStatus === "connected") {
        await this.refreshAvailableGroups()
      }

      await this.#sendPropertyInspectorSnapshot()
      return
    }

    if (payload.type === "request-snapshot") {
      await this.#sendPropertyInspectorSnapshot()

      if (this.#shouldRefreshGroupsOnInspectorOpen()) {
        void this.refreshAvailableGroups()
      }
      return
    }

    const persistedServiceBaseUrl = "serviceBaseUrl" in payload

    if (persistedServiceBaseUrl) {
      await this.#persistGlobalSettings({
        ...this.stateStore.getSnapshot().globalSettings,
        serviceBaseUrl: payload.serviceBaseUrl?.trim() || undefined,
      })
    } else {
      await this.#synchronizeGlobalSettings()
    }

    switch (payload.type) {
      case "refresh-groups":
        await this.refreshAvailableGroups()
        return
      case "start-auth":
        await this.startAuthorization()
        return
    }
  }

  async startAuthorization(): Promise<void> {
    streamDeck.logger.info("Starting Sonos authorization flow from PI action.")
    const globalSettings = this.stateStore.getSnapshot().globalSettings
    streamDeck.logger.info(
      `Sonos auth context: serviceBaseUrl=${Boolean(globalSettings.serviceBaseUrl)} session=${Boolean(globalSettings.sessionRef)} connection=${globalSettings.connectionStatus}`,
    )
    const result = await this.sonosClient.startAuthorization()

    if (!result.ok) {
      streamDeck.logger.warn(
        `Sonos authorization start failed: ${result.code} ${result.message}`,
      )
      await this.#persistGlobalSettings({
        ...globalSettings,
        connectRequestedAt: undefined,
        connectionStatus: "error",
        connectedAccountLabel: undefined,
        lastError: result.message,
      })
      this.#setGroupDiscovery([], "error", result.message)
      return
    }

    this.#setGroupDiscovery([], "idle")
    streamDeck.logger.info("Sonos authorization start accepted.")
    await this.#persistGlobalSettings({
      ...globalSettings,
      connectRequestedAt: undefined,
      connectionStatus: "authorizing",
      connectedAccountLabel: undefined,
      lastError: undefined,
      sessionRef: result.sessionRef,
    })
    await streamDeck.ui.sendToPropertyInspector({
      type: "open-auth-url",
      url: result.authorizeUrl,
    })
    void this.#pollConnectionStatus(result.sessionRef)
  }

  async refreshAvailableGroups(): Promise<void> {
    const globalSettings = await this.#synchronizeGlobalSettings()
    streamDeck.logger.info(
      `Refreshing Sonos groups: connection=${globalSettings.connectionStatus} session=${Boolean(globalSettings.sessionRef)} serviceBaseUrl=${Boolean(globalSettings.serviceBaseUrl)}`,
    )

    if (globalSettings.connectionStatus !== "connected") {
      this.#setGroupDiscovery([], "error", "Connect Sonos before loading groups.")
      return
    }

    const requestVersion = ++this.#groupsRequestVersion
    this.#setGroupDiscovery(this.#availableGroups, "loading")

    const result = await this.sonosClient.fetchGroups()

    if (requestVersion !== this.#groupsRequestVersion) {
      return
    }

    if (result.ok) {
      this.#setGroupDiscovery(result.groups, "ready")
      return
    }

    if (result.code === "not_connected") {
      await this.#handleConnectionLoss(result.message)
    }

    this.#setGroupDiscovery([], "error", result.message)
  }

  async #pollConnectionStatus(sessionRef: string): Promise<void> {
    const pollVersion = ++this.#authPollVersion

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const result = await this.sonosClient.fetchConnectionStatus(sessionRef)

      if (pollVersion !== this.#authPollVersion) {
        return
      }

      if (!result.ok) {
        await this.#persistGlobalSettings({
          ...this.stateStore.getSnapshot().globalSettings,
          connectionStatus: "error",
          connectedAccountLabel: undefined,
          lastError: result.message,
          sessionRef,
        })
        this.#setGroupDiscovery([], "error", result.message)
        return
      }

      const nextSettings = asGlobalSettings(
        this.stateStore.getSnapshot().globalSettings,
        result.connection,
        sessionRef,
      )

      await this.#persistGlobalSettings(nextSettings)

      if (result.connection.connectionStatus === "connected") {
        await this.refreshAvailableGroups()
        return
      }

      if (
        result.connection.connectionStatus === "error" ||
        result.connection.connectionStatus === "disconnected"
      ) {
        this.#setGroupDiscovery([], "error", result.connection.lastError)
        return
      }

      await sleep(1000)
    }

    await this.#persistGlobalSettings({
      ...this.stateStore.getSnapshot().globalSettings,
      connectionStatus: "error",
      connectedAccountLabel: undefined,
      lastError: "Sonos authorization did not finish in time.",
      sessionRef,
    })
    this.#setGroupDiscovery(
      [],
      "error",
      "Sonos authorization did not finish in time.",
    )
  }

  async #synchronizeGlobalSettings(): Promise<GlobalSettings> {
    const persisted = parseGlobalSettings(
      await streamDeck.settings.getGlobalSettings(),
    )
    const current = this.stateStore.getSnapshot().globalSettings
    const globalSettings = mergeGlobalSettings(current, persisted)

    this.#applyGlobalSettings(globalSettings)
    return globalSettings
  }

  async #persistGlobalSettings(globalSettings: GlobalSettings): Promise<void> {
    const previousSettings = this.stateStore.getSnapshot().globalSettings
    this.#applyGlobalSettings(globalSettings)

    if (areGlobalSettingsEqual(previousSettings, globalSettings)) {
      return
    }

    await streamDeck.settings.setGlobalSettings(globalSettings)
  }

  #applyGlobalSettings(globalSettings: GlobalSettings): void {
    const previousSettings = this.stateStore.getSnapshot().globalSettings
    const connectRequestedAt = globalSettings.connectRequestedAt ?? 0
    const shouldStartAuth =
      connectRequestedAt > 0 && connectRequestedAt > this.#lastConnectRequestedAt

    this.stateStore.replaceGlobalSettings(globalSettings)
    this.#syncVisibleActionTargetsFromGlobalSettings(globalSettings)

    if (shouldStartAuth) {
      this.#lastConnectRequestedAt = connectRequestedAt
      streamDeck.logger.info(
        `Connect requested via global settings at ${connectRequestedAt}`,
      )
      void this.startAuthorization()
    }

    const serviceIdentityChanged =
      previousSettings.serviceBaseUrl !== globalSettings.serviceBaseUrl ||
      previousSettings.sessionRef !== globalSettings.sessionRef

    if (serviceIdentityChanged) {
      this.#groupsRequestVersion += 1
    }

    if (serviceIdentityChanged) {
      this.#setGroupDiscovery(
        [],
        globalSettings.connectionStatus === "error" ? "error" : "idle",
        globalSettings.lastError,
      )
    } else if (globalSettings.connectionStatus === "error") {
      this.#setGroupDiscovery([], "error", globalSettings.lastError)
    } else if (globalSettings.connectionStatus !== "connected") {
      this.#setGroupDiscovery([], "idle")
    }

    if (
      previousSettings.connectionStatus !== "connected" &&
      globalSettings.connectionStatus === "connected"
    ) {
      void this.refreshAvailableGroups()
    }

    const actionTargetsChanged = !areActionTargetsEqual(
      previousSettings.actionTargets,
      globalSettings.actionTargets,
    )

    if (
      previousSettings.connectionStatus === globalSettings.connectionStatus &&
      !serviceIdentityChanged &&
      !actionTargetsChanged
    ) {
      return
    }

    this.stateStore.clearTargetStates()
    this.#disposeTargetRuntimes()
    this.#syncProgressTimer()
    void this.#syncTargetRuntimes()
  }

  #syncVisibleActionTargetsFromGlobalSettings(globalSettings: GlobalSettings): void {
    const actionTargets = globalSettings.actionTargets
    if (!actionTargets) {
      return
    }

    for (const [contextId, visibleAction] of this.#visibleActions) {
      const savedTarget = actionTargets[contextId]
      if (!savedTarget) {
        continue
      }

      visibleAction.target = parseActionSettings(savedTarget)
      streamDeck.logger.info(
        `Action target synced: ${visibleAction.kind} context=${contextId} target=${targetLogValue(visibleAction.target)}`,
      )
      void this.#renderVisibleAction(contextId)
    }

    if (Object.keys(actionTargets).length > 0) {
      void this.#syncTargetRuntimes()
    }
  }

  async #handleConnectionLoss(message: string): Promise<void> {
    await this.#persistGlobalSettings({
      ...this.stateStore.getSnapshot().globalSettings,
      connectionStatus: "disconnected",
      connectedAccountLabel: undefined,
      lastError: message,
    })
    this.#setGroupDiscovery([], "error", message)
  }

  #setGroupDiscovery(
    groups: SonosDiscoveredGroup[],
    status: PropertyInspectorGroupsStatus,
    error?: string,
  ): void {
    this.#availableGroups = groups
    this.#groupsStatus = status
    this.#groupsError = error
    void this.#sendPropertyInspectorSnapshot()
  }

  #shouldRefreshGroupsOnInspectorOpen(): boolean {
    const isConnected =
      this.stateStore.getSnapshot().globalSettings.connectionStatus === "connected"
    if (!isConnected) {
      return false
    }

    if (this.#groupsStatus === "loading") {
      return false
    }

    return this.#groupsStatus !== "ready" || this.#availableGroups.length === 0
  }

  async #sendPropertyInspectorSnapshot(): Promise<void> {
    await streamDeck.ui.sendToPropertyInspector({
      type: "snapshot",
      groups: this.#availableGroups,
      groupsError: this.#groupsError,
      groupsStatus: this.#groupsStatus,
    } satisfies PropertyInspectorSnapshot)
  }

  async #syncTargetRuntimes(): Promise<void> {
    const activeTargets = new Map<string, SonosTarget>()

    for (const visibleAction of this.#visibleActions.values()) {
      const target = asConfiguredTarget(visibleAction.target)

      if (!target) {
        continue
      }

      activeTargets.set(targetKey(target), target)
    }

    for (const [runtimeKey, runtime] of this.#targetRuntimes) {
      if (activeTargets.has(runtimeKey) && this.#canSyncTargetState()) {
        continue
      }

      this.#disposeTargetRuntime(runtime)
      this.#targetRuntimes.delete(runtimeKey)
    }

    if (!this.#canSyncTargetState()) {
      return
    }

    for (const [runtimeKey, target] of activeTargets) {
      const runtime = this.#targetRuntimes.get(runtimeKey)

      if (runtime) {
        runtime.target = target

        if (!runtime.subscription && !runtime.bootstrapping) {
          void this.#bootstrapTargetRuntime(runtime)
        }

        continue
      }

      const nextRuntime: TargetRuntime = {
        disposed: false,
        target,
      }

      this.#targetRuntimes.set(runtimeKey, nextRuntime)
      void this.#bootstrapTargetRuntime(nextRuntime)
    }
  }

  async #bootstrapTargetRuntime(runtime: TargetRuntime): Promise<void> {
    if (runtime.bootstrapping) {
      return runtime.bootstrapping
    }

    runtime.bootstrapping = this.#loadAndSubscribe(runtime).finally(() => {
      runtime.bootstrapping = undefined
    })

    return runtime.bootstrapping
  }

  async #loadAndSubscribe(runtime: TargetRuntime): Promise<void> {
    const fetchResult = await this.sonosClient.fetchState(runtime.target)

    if (runtime.disposed) {
      return
    }

    if (fetchResult.ok) {
      this.stateStore.replaceTargetState(runtime.target, fetchResult.state)
    } else {
      if (fetchResult.code === "not_connected") {
        await this.#handleConnectionLoss(fetchResult.message)
        return
      }

      if (
        fetchResult.code === "invalid_target" ||
        fetchResult.code === "not_configured"
      ) {
        streamDeck.logger.warn(
          `Sonos state fetch failed: ${runtime.target.groupId} ${fetchResult.code} ${fetchResult.message}`,
        )
        return
      }

      streamDeck.logger.warn(
        `Sonos state fetch failed: ${runtime.target.groupId} ${fetchResult.code} ${fetchResult.message}`,
      )
    }

    const subscribeResult = await this.sonosClient.subscribe(
      runtime.target,
      (state) => {
        if (!runtime.disposed) {
          this.stateStore.replaceTargetState(runtime.target, state)
        }
      },
      (error) => {
        if (!runtime.disposed) {
          this.#handleSubscriptionFailure(runtime, error)
        }
      },
    )

    if (runtime.disposed) {
      if (subscribeResult.ok) {
        subscribeResult.subscription.close()
      }

      return
    }

    if (subscribeResult.ok) {
      runtime.subscription = subscribeResult.subscription
      return
    }

    if (subscribeResult.code === "not_connected") {
      await this.#handleConnectionLoss(subscribeResult.message)
      return
    }

    streamDeck.logger.warn(
      `Sonos state subscription failed: ${runtime.target.groupId} ${subscribeResult.code} ${subscribeResult.message}`,
    )
  }

  #disposeTargetRuntimes(): void {
    for (const timer of this.#subscriptionRetryTimers.values()) {
      clearTimeout(timer)
    }

    this.#subscriptionRetryTimers.clear()

    for (const runtime of this.#targetRuntimes.values()) {
      this.#disposeTargetRuntime(runtime)
    }

    this.#targetRuntimes.clear()
  }

  #disposeTargetRuntime(runtime: TargetRuntime): void {
    runtime.disposed = true
    runtime.subscription?.close()
    runtime.subscription = undefined
    const retryKey = targetKey(runtime.target)
    const retryTimer = this.#subscriptionRetryTimers.get(retryKey)

    if (retryTimer) {
      clearTimeout(retryTimer)
      this.#subscriptionRetryTimers.delete(retryKey)
    }
  }

  #handleSubscriptionFailure(
    runtime: TargetRuntime,
    error: SonosFailureResult,
  ): void {
    runtime.subscription = undefined

    if (error.code === "not_connected") {
      void this.#handleConnectionLoss(error.message)
      return
    }

    const retryKey = targetKey(runtime.target)
    const existingRetry = this.#subscriptionRetryTimers.get(retryKey)

    if (existingRetry) {
      clearTimeout(existingRetry)
    }

    if (!error.retryable) {
      return
    }

    this.#subscriptionRetryTimers.set(
      retryKey,
      setTimeout(() => {
        this.#subscriptionRetryTimers.delete(retryKey)

        if (!runtime.disposed && !runtime.bootstrapping && this.#canSyncTargetState()) {
          void this.#bootstrapTargetRuntime(runtime)
        }
      }, 1500),
    )
  }

  #canSyncTargetState(): boolean {
    const { globalSettings } = this.stateStore.getSnapshot()

    return (
      globalSettings.connectionStatus === "connected" &&
      Boolean(globalSettings.serviceBaseUrl) &&
      Boolean(globalSettings.sessionRef)
    )
  }

  #syncProgressTimer(): void {
    const shouldAnimate = Array.from(this.#visibleActions.values()).some(
      (visibleAction) => {
        if (
          visibleAction.kind !== "album-art" &&
          visibleAction.kind !== "now-playing-encoder"
        ) {
          return false
        }

        const target = asConfiguredTarget(visibleAction.target)
        const state = target ? this.stateStore.getTargetState(target) : undefined

        return state?.playbackStatus === "playing"
      },
    )

    if (!shouldAnimate) {
      if (this.#progressTimer) {
        clearInterval(this.#progressTimer)
        this.#progressTimer = undefined
      }

      return
    }

    if (!this.#progressTimer) {
      this.#progressTimer = setInterval(() => {
        void this.#renderVisibleActions()
      }, 1000)
    }
  }

  async #renderVisibleActions(): Promise<void> {
    await Promise.all(
      Array.from(this.#visibleActions.keys(), (actionId) =>
        this.#renderVisibleAction(actionId),
      ),
    )
  }

  async #renderVisibleAction(actionId: string): Promise<void> {
    const visibleAction = this.#visibleActions.get(actionId)

    if (!visibleAction) {
      return
    }

    try {
      switch (visibleAction.kind) {
        case "album-art":
          await this.#renderAlbumArtAction(visibleAction)
          return
        case "mute-toggle":
          await this.#renderMuteToggleAction(visibleAction)
          return
        case "next-track":
          await this.#renderNextTrackAction(visibleAction)
          return
        case "now-playing-encoder":
          await this.#renderNowPlayingEncoderAction(visibleAction)
          return
        case "play-mode":
          await this.#renderPlayModeAction(visibleAction)
          return
        case "play-pause":
          await this.#renderPlayPauseAction(visibleAction)
          return
        case "previous-track":
          await this.#renderPreviousTrackAction(visibleAction)
          return
      }
    } catch (error) {
      streamDeck.logger.debug(
        `Render skipped for ${visibleAction.kind}: ${String(error)}`,
      )
    }
  }

  async #renderPlayPauseAction(
    visibleAction: VisibleActionInstance,
  ): Promise<void> {
    if (!visibleAction.action.isKey()) {
      return
    }

    const viewState = this.#getViewState(visibleAction.target)

    await Promise.all([
      visibleAction.action.setState(viewState.state?.playbackStatus === "playing" ? 1 : 0),
      visibleAction.action.setTitle(
        !viewState.target
          ? "No Group"
          : !viewState.isConnected
            ? "Auth"
            : !viewState.state
              ? "Sync"
              : viewState.state.playbackStatus === "playing"
                ? "Pause"
                : "Play",
      ),
    ])
  }

  async #renderMuteToggleAction(
    visibleAction: VisibleActionInstance,
  ): Promise<void> {
    if (!visibleAction.action.isKey()) {
      return
    }

    const viewState = this.#getViewState(visibleAction.target)

    await Promise.all([
      visibleAction.action.setState(viewState.state?.isMuted ? 1 : 0),
      visibleAction.action.setTitle(
        !viewState.target
          ? "No Group"
          : !viewState.isConnected
            ? "Auth"
            : !viewState.state
              ? "Sync"
              : viewState.state.isMuted
                ? "Unmute"
                : "Mute",
      ),
    ])
  }

  async #renderNextTrackAction(
    visibleAction: VisibleActionInstance,
  ): Promise<void> {
    if (!visibleAction.action.isKey()) {
      return
    }

    const viewState = this.#getViewState(visibleAction.target)

    await visibleAction.action.setTitle(
      !viewState.target ? "No Group" : !viewState.isConnected ? "Auth" : "Next",
    )
  }

  async #renderPreviousTrackAction(
    visibleAction: VisibleActionInstance,
  ): Promise<void> {
    if (!visibleAction.action.isKey()) {
      return
    }

    const viewState = this.#getViewState(visibleAction.target)

    await visibleAction.action.setTitle(
      !viewState.target ? "No Group" : !viewState.isConnected ? "Auth" : "Prev",
    )
  }

  async #renderPlayModeAction(
    visibleAction: VisibleActionInstance,
  ): Promise<void> {
    if (!visibleAction.action.isKey()) {
      return
    }

    const viewState = this.#getViewState(visibleAction.target)

    await visibleAction.action.setTitle(
      !viewState.target
        ? "No Group"
        : !viewState.isConnected
          ? "Auth"
          : !viewState.state
            ? "Sync"
            : shortenPlayModeLabel(viewState.state.playModeLabel),
    )
  }

  async #renderAlbumArtAction(
    visibleAction: VisibleActionInstance,
  ): Promise<void> {
    if (!visibleAction.action.isKey()) {
      return
    }

    const viewState = this.#getViewState(visibleAction.target)

    await Promise.all([
      visibleAction.action.setImage(albumArtImage(viewState)),
      visibleAction.action.setTitle(
        !viewState.target
          ? "No Group"
          : !viewState.isConnected
            ? trimLabel(visibleAction.target.groupName ?? "Auth", 8)
            : trimLabel(
                viewState.state?.currentArtistName ??
                  visibleAction.target.groupName ??
                  "Art",
                10,
              ),
      ),
    ])
  }

  async #renderNowPlayingEncoderAction(
    visibleAction: VisibleActionInstance,
  ): Promise<void> {
    if (!visibleAction.action.isDial()) {
      return
    }

    const viewState = this.#getViewState(visibleAction.target)

    await visibleAction.action.setFeedbackLayout("$B1")
    await visibleAction.action.setFeedback({
      title: trimLabel(
        viewState.state?.currentTrackTitle ??
          visibleAction.target.groupName ??
          "Sonos",
        18,
      ),
      value: trimLabel(
        !viewState.target
          ? "Select"
          : !viewState.isConnected
            ? "Connect"
            : formatProgress(viewState.state),
        16,
      ),
      indicator: progressPercent(viewState.state),
    })
    await visibleAction.action.setTriggerDescription(
      viewState.target && viewState.isConnected
        ? undefined
        : {
            push: "Connect Sonos",
            touch: "Connect Sonos",
            rotate: "Reserved",
            longTouch: "Reserved",
          },
    )
  }

  #getViewState(target: SonosActionSettings): {
    isConnected: boolean
    state?: SonosTargetStateSnapshot
    target?: SonosTarget
  } {
    const configuredTarget = asConfiguredTarget(target)
    const snapshot = this.stateStore.getSnapshot()

    return {
      isConnected: snapshot.globalSettings.connectionStatus === "connected",
      state: configuredTarget
        ? this.stateStore.getTargetState(configuredTarget)
        : undefined,
      target: configuredTarget,
    }
  }
}

export const pluginCore = new PluginCore()

export function shouldShowCommandAlert(result: SonosCommandResult): boolean {
  return (
    !result.ok &&
    result.code !== "invalid_target" &&
    result.code !== "not_configured" &&
    result.code !== "not_connected"
  )
}

function asConfiguredTarget(
  target: SonosActionSettings,
): SonosTarget | undefined {
  return target.householdId && target.groupId
    ? {
        householdId: target.householdId,
        groupId: target.groupId,
        groupName: target.groupName,
      }
    : undefined
}

function asGlobalSettings(
  previous: GlobalSettings,
  connection: SonosConnectionState,
  sessionRef: string,
): GlobalSettings {
  return {
    ...previous,
    connectionStatus: connection.connectionStatus,
    connectedAccountLabel: connection.connectedAccountLabel,
    lastError: connection.lastError,
    serviceBaseUrl: previous.serviceBaseUrl,
    sessionRef: connection.sessionRef ?? sessionRef,
  }
}

function areGlobalSettingsEqual(
  left: GlobalSettings,
  right: GlobalSettings,
): boolean {
  return (
    left.connectionStatus === right.connectionStatus &&
    left.serviceBaseUrl === right.serviceBaseUrl &&
    left.sessionRef === right.sessionRef &&
    left.connectedAccountLabel === right.connectedAccountLabel &&
    left.connectRequestedAt === right.connectRequestedAt &&
    left.lastError === right.lastError &&
    areActionTargetsEqual(left.actionTargets, right.actionTargets)
  )
}

function areActionTargetsEqual(
  left: GlobalSettings["actionTargets"],
  right: GlobalSettings["actionTargets"],
): boolean {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {})
}

function mergeGlobalSettings(
  current: GlobalSettings,
  persisted: GlobalSettings,
): GlobalSettings {
  return {
    connectionStatus: persisted.connectionStatus,
    serviceBaseUrl: persisted.serviceBaseUrl ?? current.serviceBaseUrl,
    sessionRef: persisted.sessionRef ?? current.sessionRef,
    connectedAccountLabel:
      persisted.connectedAccountLabel ?? current.connectedAccountLabel,
    connectRequestedAt: persisted.connectRequestedAt ?? current.connectRequestedAt,
    lastError:
      persisted.connectionStatus === "error"
        ? persisted.lastError
        : (persisted.lastError ?? current.lastError),
    actionTargets: mergeActionTargetMaps(current.actionTargets, persisted.actionTargets),
  }
}

function mergeActionTargetMaps(
  current: GlobalSettings["actionTargets"],
  persisted: GlobalSettings["actionTargets"],
): GlobalSettings["actionTargets"] {
  if (!current && !persisted) {
    return undefined
  }

  return {
    ...(current ?? {}),
    ...(persisted ?? {}),
  }
}

function targetLogValue(target: SonosActionSettings): string {
  return JSON.stringify({
    householdId: target.householdId,
    groupId: target.groupId,
    groupName: target.groupName,
  })
}

function targetKey(target: SonosTarget): string {
  return `${target.householdId}:${target.groupId}`
}

function progressPercent(state?: SonosTargetStateSnapshot): number {
  const durationMillis = state?.durationMillis
  const currentPositionMillis = estimatedPositionMillis(state)

  if (!durationMillis || currentPositionMillis === undefined) {
    return state?.playbackStatus === "playing" ? 10 : 0
  }

  return Math.max(
    0,
    Math.min(100, Math.round((currentPositionMillis / durationMillis) * 100)),
  )
}

function estimatedPositionMillis(
  state?: SonosTargetStateSnapshot,
): number | undefined {
  if (!state || state.positionMillis === undefined) {
    return undefined
  }

  if (state.playbackStatus !== "playing") {
    return state.positionMillis
  }

  const elapsedMillis = Math.max(0, Date.now() - state.receivedAtMillis)
  const estimatedPosition = state.positionMillis + elapsedMillis

  return state.durationMillis
    ? Math.min(state.durationMillis, estimatedPosition)
    : estimatedPosition
}

function formatProgress(state?: SonosTargetStateSnapshot): string {
  const currentPositionMillis = estimatedPositionMillis(state)

  if (
    currentPositionMillis !== undefined &&
    state?.durationMillis !== undefined
  ) {
    return `${formatClock(currentPositionMillis)} / ${formatClock(state.durationMillis)}`
  }

  return trimLabel(
    state?.currentArtistName ?? playbackValue(state),
    16,
  )
}

function formatClock(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function albumArtImage(viewState: {
  isConnected: boolean
  state?: SonosTargetStateSnapshot
  target?: SonosTarget
}): string {
  if (viewState.state?.albumArtUrl?.startsWith("data:image/")) {
    return viewState.state.albumArtUrl
  }

  const accent =
    viewState.state?.playbackStatus === "playing"
      ? ["#ff8a50", "#ffca28"]
      : ["#4db6ac", "#26c6da"]
  const title =
    viewState.state?.currentTrackTitle ??
    viewState.target?.groupName ??
    (!viewState.target ? "Select Group" : "Connect Sonos")
  const subtitle = !viewState.target
    ? "Choose a Sonos group in the inspector"
    : !viewState.isConnected
      ? "Finish Sonos auth to load artwork"
      : [
          viewState.state?.currentArtistName,
          shortenPlayModeLabel(viewState.state?.playModeLabel),
        ]
          .filter(Boolean)
          .join(" • ") || "Waiting for live state"

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent[0]}" />
      <stop offset="100%" stop-color="${accent[1]}" />
    </linearGradient>
  </defs>
  <rect width="144" height="144" rx="22" fill="#0f1820" />
  <rect x="8" y="8" width="128" height="128" rx="18" fill="url(#bg)" />
  <circle cx="114" cy="28" r="18" fill="rgba(255,255,255,0.18)" />
  <path d="M8 104C28 90 50 82 80 82C102 82 121 90 136 106V136H8Z" fill="rgba(0,0,0,0.2)" />
  <text x="18" y="28" fill="#fff8ef" font-size="10" font-family="Avenir Next, Segoe UI, sans-serif" letter-spacing="2">NOW</text>
  <text x="18" y="100" fill="#ffffff" font-size="15" font-weight="700" font-family="Avenir Next, Segoe UI, sans-serif">${escapeXml(trimLabel(title, 14))}</text>
  <text x="18" y="118" fill="rgba(255,255,255,0.88)" font-size="9" font-family="Avenir Next, Segoe UI, sans-serif">${escapeXml(trimLabel(subtitle, 26))}</text>
  <rect x="18" y="124" width="108" height="6" rx="3" fill="rgba(0,0,0,0.22)" />
  <rect x="18" y="124" width="${Math.max(8, Math.round((108 * progressPercent(viewState.state)) / 100))}" height="6" rx="3" fill="#ffffff" />
</svg>`

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
}

function trimLabel(value: string, maxLength: number): string {
  const trimmed = value.trim()

  return trimmed.length <= maxLength
    ? trimmed
    : `${trimmed.slice(0, maxLength - 1)}…`
}

function shortenPlayModeLabel(value?: string): string {
  if (!value) {
    return "Mode"
  }

  if (value.includes("Shuffle")) {
    return "Shuffle"
  }

  if (value.includes("Repeat")) {
    return "Repeat"
  }

  if (value.includes("Once")) {
    return "Once"
  }

  return trimLabel(value, 8)
}

function playbackValue(state?: SonosTargetStateSnapshot): string {
  switch (state?.playbackStatus) {
    case "playing":
      return state.isMuted ? "Muted" : "Playing"
    case "paused":
      return "Paused"
    case "idle":
      return "Idle"
    default:
      return "Sync"
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
