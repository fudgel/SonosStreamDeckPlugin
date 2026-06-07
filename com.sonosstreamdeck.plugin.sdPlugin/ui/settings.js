(function () {
  const state = {
    actionContext: "",
    actionInfo: undefined,
    actionSettingsConfirmed: false,
    groups: [],
    groupsError: undefined,
    groupsStatus: "idle",
    globalSettings: {
      connectionStatus: "disconnected",
    },
    pendingAuth: undefined,
    settings: {},
    socket: undefined,
    uuid: "",
  }

  const refs = {
    authLink: document.getElementById("auth-link"),
    connectButton: document.getElementById("connect-button"),
    clearOverrideButton: document.getElementById("clear-override-button"),
    connectionCopy: document.getElementById("connection-copy"),
    connectionHint: document.getElementById("connection-hint"),
    connectionPill: document.getElementById("connection-pill"),
    defaultGroupCopy: document.getElementById("default-group-copy"),
    defaultGroupSelect: document.getElementById("default-group-select"),
    defaultTargetHint: document.getElementById("default-target-hint"),
    groupSelect: document.getElementById("group-select"),
    groupsEmpty: document.getElementById("groups-empty"),
    keyTargetHint: document.getElementById("key-target-hint"),
    groupsStatusCopy: document.getElementById("groups-status-copy"),
    heroBadge: document.getElementById("hero-badge"),
    refreshGroupsButton: document.getElementById("refresh-groups-button"),
    selectedGroupCopy: document.getElementById("selected-group-copy"),
    serviceBaseUrlInput: document.getElementById("service-base-url"),
  }

  window.connectElgatoStreamDeckSocket = function connectElgatoStreamDeckSocket(
    port,
    uuid,
    registerEvent,
    _info,
    actionInfo,
  ) {
    state.uuid = uuid
    state.actionInfo = JSON.parse(actionInfo)
    state.actionContext = state.actionInfo?.context || ""
    state.settings = parseTargetSettings(state.actionInfo?.payload?.settings)
    state.actionSettingsConfirmed = Boolean(groupKey(state.settings))
    state.socket = new WebSocket(`ws://127.0.0.1:${port}`)

    state.socket.addEventListener("open", () => {
      send({ event: registerEvent, uuid })
      requestSettings()
      requestGlobalSettings()
      void refreshGroupsInPI()
    })

    state.socket.addEventListener("message", (messageEvent) => {
      const message = JSON.parse(messageEvent.data)

      switch (message.event) {
        case "didReceiveSettings":
          if (message.context === state.actionContext) {
            confirmSettings(parseTargetSettings(message.payload?.settings))
          }
          break
        case "didReceiveGlobalSettings":
          state.globalSettings = parseGlobalSettings(message.payload?.settings)
          syncTargetStateFromGlobal()
          if (
            state.globalSettings.connectionStatus === "connected" &&
            state.groups.length === 0
          ) {
            void refreshGroupsInPI()
          }
          render()
          break
        case "sendToPropertyInspector":
          handlePluginMessage(message.payload)
          break
        default:
          break
      }
    })

    refs.connectButton.addEventListener("click", () => {
      void requestConnect()
    })

    refs.authLink.addEventListener("click", (event) => {
      const href = refs.authLink.href
      const serviceBaseUrl =
        refs.serviceBaseUrlInput.value.trim() ||
        state.globalSettings.serviceBaseUrl ||
        ""
      const sessionRef = state.pendingAuth?.sessionRef || state.globalSettings.sessionRef

      if (state.pendingAuth) {
        event.preventDefault()
        void waitForBrokerConnection(state.pendingAuth)
        return
      }

      if (serviceBaseUrl && sessionRef) {
        event.preventDefault()
        state.pendingAuth = {
          serviceBaseUrl,
          sessionRef,
          authorizeUrl: href,
        }
        void waitForBrokerConnection(state.pendingAuth)
        return
      }

      if (!href || href === "#" || href.endsWith("#")) {
        event.preventDefault()
        refs.connectionHint.dataset.tone = "bad"
        refs.connectionHint.textContent =
          "No sign-in URL yet. Click Connect Sonos first."
      }
    })

    refs.serviceBaseUrlInput.addEventListener("input", () => {
      const serviceBaseUrl = refs.serviceBaseUrlInput.value.trim()
      refs.connectButton.disabled = !serviceBaseUrl
    })

    refs.serviceBaseUrlInput.addEventListener("change", () => {
      const serviceBaseUrl = refs.serviceBaseUrlInput.value.trim()
      if (serviceBaseUrl) {
        persistServiceBaseUrl(serviceBaseUrl)
      }
    })

    refs.refreshGroupsButton.addEventListener("click", () => {
      void refreshGroupsInPI()
    })

    refs.groupSelect.addEventListener("change", () => {
      const selectedGroup = state.groups.find(
        (group) => groupKey(group) === refs.groupSelect.value,
      )

      if (!selectedGroup) {
        clearActionOverride()
        return
      }

      saveActionOverride({
        groupId: selectedGroup.groupId,
        groupName: selectedGroup.groupName,
        householdId: selectedGroup.householdId,
      })
    })

    refs.defaultGroupSelect.addEventListener("change", () => {
      const selectedGroup = state.groups.find(
        (group) => groupKey(group) === refs.defaultGroupSelect.value,
      )

      saveDefaultTarget(
        selectedGroup
          ? {
              groupId: selectedGroup.groupId,
              groupName: selectedGroup.groupName,
              householdId: selectedGroup.householdId,
            }
          : {},
      )
    })

    refs.clearOverrideButton.addEventListener("click", () => {
      clearActionOverride()
    })

    render()
  }

  async function refreshGroupsInPI() {
    const serviceBaseUrl =
      refs.serviceBaseUrlInput.value.trim() ||
      state.globalSettings.serviceBaseUrl ||
      ""
    const sessionRef = state.globalSettings.sessionRef

    if (
      state.globalSettings.connectionStatus !== "connected" ||
      !serviceBaseUrl ||
      !sessionRef
    ) {
      return
    }

    state.groupsStatus = "loading"
    state.groupsError = undefined
    render()

    try {
      const response = await fetch(
        `${serviceBaseUrl}/v1/sonos/groups?sessionRef=${encodeURIComponent(sessionRef)}`,
      )
      const body = await response.json()

      if (!body.ok) {
        throw new Error(body.message || "Could not load Sonos groups.")
      }

      const groups = parseGroupsFromBrokerBody(body)

      if (!groups.length) {
        throw new Error("Broker returned no Sonos groups.")
      }

      state.groups = groups
      state.groupsStatus = "ready"
      state.groupsError = undefined
    } catch (error) {
      state.groupsStatus = "error"
      state.groupsError =
        error instanceof Error ? error.message : "Could not load Sonos groups."
    }

    render()
  }

  function parseGroupsFromBrokerBody(body) {
    if (!Array.isArray(body.households)) {
      return []
    }

    const groups = []

    for (const household of body.households) {
      if (!household || typeof household !== "object") {
        continue
      }

      const householdId = optionalString(household.householdId)
      const householdName = optionalString(household.householdName)

      if (!householdId || !Array.isArray(household.groups)) {
        continue
      }

      for (const group of household.groups) {
        if (!group || typeof group !== "object") {
          continue
        }

        const groupId = optionalString(group.groupId)
        const groupName = optionalString(group.groupName)

        if (!groupId || !groupName) {
          continue
        }

        groups.push({
          householdId,
          householdName,
          groupId,
          groupName,
          label: householdName ? `${groupName} - ${householdName}` : groupName,
        })
      }
    }

    return groups
  }

  function handlePluginMessage(payload) {
    if (!payload || typeof payload !== "object") {
      return
    }

    switch (payload.type) {
      case "snapshot":
        state.groups = Array.isArray(payload.groups) ? payload.groups : []
        state.groupsError =
          typeof payload.groupsError === "string" ? payload.groupsError : undefined
        state.groupsStatus =
          typeof payload.groupsStatus === "string" ? payload.groupsStatus : "idle"
        render()
        break
      case "open-auth-url":
        if (typeof payload.url === "string" && payload.url) {
          refs.authLink.href = payload.url
          refs.authLink.style.display = "inline-block"
          window.open(payload.url, "_blank", "noopener,noreferrer")
        }
        break
      default:
        break
    }
  }

  function requestSettings() {
    send({
      action: state.actionInfo?.action,
      context: state.actionContext,
      event: "getSettings",
    })
  }

  function requestGlobalSettings() {
    send({
      context: state.uuid,
      event: "getGlobalSettings",
    })
  }

  function persistServiceBaseUrl(serviceBaseUrl) {
    const nextGlobalSettings = {
      ...state.globalSettings,
      serviceBaseUrl,
    }

    state.globalSettings = nextGlobalSettings
    render()

    send({
      context: state.uuid,
      event: "setGlobalSettings",
      payload: nextGlobalSettings,
    })
  }

  function publishGlobalSettings(globalSettings) {
    send({
      context: state.uuid,
      event: "setGlobalSettings",
      payload: globalSettings,
    })
  }

  async function requestConnect() {
    const serviceBaseUrl = refs.serviceBaseUrlInput.value.trim()

    if (!serviceBaseUrl) {
      refs.connectionHint.dataset.tone = "bad"
      refs.connectionHint.textContent = "Enter the broker URL before connecting."
      return
    }

    refs.connectButton.disabled = true
    refs.connectionHint.dataset.tone = "warm"
    refs.connectionHint.textContent = "Contacting broker and starting Sonos authorization..."

    try {
      const authResponse = await fetch(`${serviceBaseUrl}/v1/sonos/auth/start`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "{}",
      })
      const authBody = await authResponse.json()

      if (!authBody.ok) {
        throw new Error(authBody.message || "Broker auth start failed.")
      }

      state.pendingAuth = {
        serviceBaseUrl,
        sessionRef: authBody.sessionRef,
        authorizeUrl: authBody.authorizeUrl,
      }

      refs.authLink.href = authBody.authorizeUrl
      refs.authLink.style.display = "inline-block"

      const nextGlobalSettings = {
        ...state.globalSettings,
        serviceBaseUrl,
        sessionRef: authBody.sessionRef,
        connectionStatus: "authorizing",
        connectedAccountLabel: undefined,
        lastError: undefined,
      }

      state.globalSettings = nextGlobalSettings
      render()
      publishGlobalSettings(nextGlobalSettings)

      refs.connectionHint.textContent =
        "Broker auth started. The stub auto-connects in about a second; optional sign-in link below."

      await waitForBrokerConnection(state.pendingAuth)
    } catch (error) {
      state.pendingAuth = undefined
      const message = error instanceof Error ? error.message : "Connect failed."
      state.globalSettings = {
        ...state.globalSettings,
        serviceBaseUrl,
        connectionStatus: "error",
        lastError: message,
        connectRequestedAt: undefined,
      }
      render()
      publishGlobalSettings(state.globalSettings)
    } finally {
      render()
    }
  }

  async function waitForBrokerConnection(pendingAuth) {
    const { serviceBaseUrl, sessionRef } = pendingAuth

    for (let attempt = 0; attempt < 15; attempt += 1) {
      await sleep(1000)

      const connectionResponse = await fetch(
        `${serviceBaseUrl}/v1/sonos/connection?sessionRef=${encodeURIComponent(sessionRef)}`,
      )
      const connectionBody = await connectionResponse.json()

      if (connectionBody.ok && connectionBody.connectionStatus === "connected") {
        state.pendingAuth = undefined
        const nextGlobalSettings = {
          ...state.globalSettings,
          serviceBaseUrl,
          sessionRef,
          connectionStatus: "connected",
          connectedAccountLabel: connectionBody.connectedAccountLabel,
          lastError: undefined,
          connectRequestedAt: undefined,
        }
        state.globalSettings = nextGlobalSettings
        render()
        publishGlobalSettings(nextGlobalSettings)
        void refreshGroupsInPI()
        return
      }

      if (connectionBody.ok && connectionBody.connectionStatus === "error") {
        throw new Error(connectionBody.lastError || "Broker authorization failed.")
      }
    }

    throw new Error("Sonos authorization did not finish in time.")
  }

  function syncTargetStateFromGlobal() {
    const override = state.globalSettings.actionTargets?.[state.actionContext]
    const effective = resolveEffectiveTarget(override, state.globalSettings.defaultTarget)
    confirmSettings(effective)
  }

  function resolveEffectiveTarget(override, defaultTarget) {
    if (override && groupKey(override)) {
      return parseTargetSettings(override)
    }

    if (defaultTarget && groupKey(defaultTarget)) {
      return parseTargetSettings(defaultTarget)
    }

    return {}
  }

  function saveDefaultTarget(nextSettings) {
    const nextGlobalSettings = {
      ...state.globalSettings,
      defaultTarget: groupKey(nextSettings) ? nextSettings : undefined,
    }

    state.globalSettings = nextGlobalSettings
    syncTargetStateFromGlobal()

    const sent = send({
      context: state.uuid,
      event: "setGlobalSettings",
      payload: nextGlobalSettings,
    })

    if (!sent) {
      refs.connectionHint.dataset.tone = "bad"
      refs.connectionHint.textContent = "Could not save the default Sonos group."
    }

    render()
  }

  function saveActionOverride(nextSettings) {
    const actionTargets = {
      ...(state.globalSettings.actionTargets || {}),
      [state.actionContext]: nextSettings,
    }

    const nextGlobalSettings = {
      ...state.globalSettings,
      actionTargets,
    }

    state.globalSettings = nextGlobalSettings
    syncTargetStateFromGlobal()
    state.groupsError = undefined

    const sent = send({
      context: state.uuid,
      event: "setGlobalSettings",
      payload: nextGlobalSettings,
    })

    if (!sent) {
      state.groupsStatus = "error"
      state.groupsError = "Could not save the group override."
      state.actionSettingsConfirmed = false
    }

    render()
  }

  function clearActionOverride() {
    const actionTargets = { ...(state.globalSettings.actionTargets || {}) }
    delete actionTargets[state.actionContext]

    const nextGlobalSettings = {
      ...state.globalSettings,
      actionTargets: Object.keys(actionTargets).length > 0 ? actionTargets : undefined,
    }

    state.globalSettings = nextGlobalSettings
    syncTargetStateFromGlobal()

    send({
      context: state.uuid,
      event: "setGlobalSettings",
      payload: nextGlobalSettings,
    })

    render()
  }

  function confirmSettings(settings) {
    state.settings = settings
    state.actionSettingsConfirmed = Boolean(groupKey(settings))
    render()
  }

  function send(message) {
    if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
      return false
    }

    state.socket.send(JSON.stringify(message))
    return true
  }

  function render() {
    const connectionStatus = normalizeConnectionStatus(
      state.globalSettings.connectionStatus,
    )
    const override = state.globalSettings.actionTargets?.[state.actionContext]
    const overrideKey = override && groupKey(override) ? groupKey(override) : ""
    const defaultTarget = state.globalSettings.defaultTarget || {}
    const defaultGroupKey = groupKey(defaultTarget)
    const effectiveKey = overrideKey || defaultGroupKey || groupKey(state.settings)
    const groupsAreReady = state.groupsStatus === "ready" && state.groups.length > 0
    const inputUrl = refs.serviceBaseUrlInput.value.trim()
    const persistedUrl = state.globalSettings.serviceBaseUrl || ""
    const serviceBaseUrl = inputUrl || persistedUrl

    if (document.activeElement !== refs.serviceBaseUrlInput) {
      refs.serviceBaseUrlInput.value = persistedUrl || inputUrl
    }

    refs.connectionPill.dataset.status = connectionStatus
    refs.connectionPill.textContent = titleCase(connectionStatus)
    refs.connectButton.disabled = !serviceBaseUrl
    refs.connectButton.textContent =
      connectionStatus === "connected" ? "Reconnect Sonos" : "Connect Sonos"
    refs.refreshGroupsButton.disabled = connectionStatus !== "connected"

    refs.heroBadge.textContent =
      connectionStatus === "connected"
        ? `Connected to ${state.globalSettings.connectedAccountLabel || "Sonos"}`
        : connectionStatus === "authorizing"
          ? "Authorizing Sonos broker session"
          : "Waiting for broker connection"

    refs.connectionCopy.textContent = connectionDescription(connectionStatus)
    refs.connectionHint.dataset.tone =
      connectionStatus === "error"
        ? "bad"
        : connectionStatus === "authorizing"
          ? "warm"
          : "neutral"
    refs.connectionHint.textContent =
      state.globalSettings.lastError ||
      (connectionStatus === "connected"
        ? state.globalSettings.connectedAccountLabel
          ? `Broker session ready for ${state.globalSettings.connectedAccountLabel}.`
          : "Broker session connected."
        : connectionStatus === "authorizing"
          ? "Waiting for the broker stub to report connected (no browser login required for the stub)."
          : "Set the broker URL, then click Connect Sonos. Keep the broker stub running during development.")

    refs.authLink.style.display = refs.authLink.href && refs.authLink.href !== "#"
      ? "inline-block"
      : "none"
    refs.authLink.textContent = "Open Sonos sign-in page"

    refs.groupsStatusCopy.textContent = titleCase(state.groupsStatus)

    const targetWarnings = getTargetWarnings(
      defaultGroupKey,
      overrideKey,
      connectionStatus,
      groupsAreReady,
    )

    refs.defaultTargetHint.dataset.tone = targetWarnings.defaultHintTone
    refs.defaultTargetHint.textContent = targetWarnings.defaultHintText

    refs.keyTargetHint.dataset.tone = targetWarnings.keyHintTone
    refs.keyTargetHint.textContent = targetWarnings.keyHintText

    refs.clearOverrideButton.hidden = !overrideKey

    renderDefaultGroupOptions(defaultGroupKey)
    renderGroupOptions(overrideKey)

    if (defaultGroupKey) {
      refs.defaultGroupCopy.textContent = targetWarnings.defaultStale
        ? `Saved default: ${savedTargetLabel(defaultTarget)} (stale — select a group again).`
        : `Default target: ${selectedGroupName(defaultGroupKey)}.`
    } else {
      refs.defaultGroupCopy.textContent =
        connectionStatus === "connected"
          ? "No default group selected yet — pick one below."
          : "Connect Sonos, then choose a default group for all actions."
    }

    if (effectiveKey) {
      refs.selectedGroupCopy.textContent = overrideKey
        ? targetWarnings.overrideStale
          ? `Override stale — ${savedTargetLabel(override)} was not found in discovery.`
          : `This key overrides the default and targets ${selectedGroupName(overrideKey)}.`
        : `This key uses the default group (${selectedGroupName(effectiveKey)}).`
    } else if (connectionStatus === "connected" && groupsAreReady) {
      refs.selectedGroupCopy.textContent =
        "No default group selected. Stream Deck keys may alert until you pick one above."
    } else {
      refs.selectedGroupCopy.textContent = "Connect Sonos and choose a default group."
    }
    refs.groupsEmpty.hidden = state.groups.length > 0 || groupsAreReady
    refs.groupsEmpty.textContent =
      state.groupsStatus === "loading"
        ? "Loading Sonos groups..."
        : connectionStatus !== "connected"
          ? "Connect Sonos to load groups."
          : "No groups loaded yet."
  }

  function renderDefaultGroupOptions(selectedGroupKey) {
    const options = []

    if (!state.groups.length) {
      options.push(
        new Option(
          state.groupsStatus === "loading"
            ? "Loading Sonos groups..."
            : "Choose a default group",
          "",
        ),
      )
    } else {
      options.push(new Option("Choose a default group", ""))

      for (const group of state.groups) {
        options.push(new Option(group.label, groupKey(group)))
      }

      appendStaleGroupOption(options, selectedGroupKey, state.globalSettings.defaultTarget)
    }

    refs.defaultGroupSelect.replaceChildren(...options)
    refs.defaultGroupSelect.disabled =
      state.globalSettings.connectionStatus !== "connected" ||
      state.groupsStatus === "loading"
    refs.defaultGroupSelect.value = selectedGroupKey || ""
  }

  function renderGroupOptions(overrideGroupKey) {
    const options = []

    if (!state.groups.length) {
      options.push(
        new Option(
          state.groupsStatus === "loading"
            ? "Loading Sonos groups..."
            : "Use default group",
          "",
        ),
      )
    } else {
      options.push(new Option("Use default group", ""))

      for (const group of state.groups) {
        options.push(new Option(group.label, groupKey(group)))
      }

      const override = state.globalSettings.actionTargets?.[state.actionContext]
      appendStaleGroupOption(options, overrideGroupKey, override)
    }

    refs.groupSelect.replaceChildren(...options)
    refs.groupSelect.disabled =
      state.globalSettings.connectionStatus !== "connected" ||
      state.groupsStatus === "loading"
    refs.groupSelect.value = overrideGroupKey || ""
  }

  function selectedGroupName(selectedGroupKey) {
    const group = state.groups.find((entry) => groupKey(entry) === selectedGroupKey)
    if (group) {
      return group.label
    }

    const override = state.globalSettings.actionTargets?.[state.actionContext]
    if (override && groupKey(override) === selectedGroupKey) {
      return savedTargetLabel(override)
    }

    const defaultTarget = state.globalSettings.defaultTarget
    if (defaultTarget && groupKey(defaultTarget) === selectedGroupKey) {
      return savedTargetLabel(defaultTarget)
    }

    return state.settings.groupName || "the selected Sonos group"
  }

  function isKnownGroupKey(selectedGroupKey) {
    if (!selectedGroupKey) {
      return false
    }

    return state.groups.some((entry) => groupKey(entry) === selectedGroupKey)
  }

  function savedTargetLabel(target) {
    if (!target) {
      return "Saved group"
    }

    return target.groupName || `${target.householdId}:${target.groupId}`
  }

  function appendStaleGroupOption(options, selectedGroupKey, savedTarget) {
    if (!selectedGroupKey || isKnownGroupKey(selectedGroupKey) || !savedTarget) {
      return
    }

    options.push(
      new Option(
        `${savedTargetLabel(savedTarget)} (stale — re-select)`,
        selectedGroupKey,
      ),
    )
  }

  function getTargetWarnings(defaultGroupKey, overrideKey, connectionStatus, groupsAreReady) {
    const defaultStale =
      Boolean(defaultGroupKey) && groupsAreReady && !isKnownGroupKey(defaultGroupKey)
    const overrideStale =
      Boolean(overrideKey) && groupsAreReady && !isKnownGroupKey(overrideKey)
    const missingDefault =
      connectionStatus === "connected" && groupsAreReady && !defaultGroupKey

    let defaultHintTone = "neutral"
    let defaultHintText =
      "Select a default group once — every action uses it unless a key overrides below."

    if (state.groupsError) {
      defaultHintTone = "bad"
      defaultHintText = state.groupsError
    } else if (state.groupsStatus === "loading") {
      defaultHintTone = "warm"
      defaultHintText = "Refreshing Sonos groups from the broker..."
    } else if (defaultStale) {
      defaultHintTone = "bad"
      defaultHintText =
        "Saved default group was not found in the latest discovery. Select a group again."
    } else if (missingDefault) {
      defaultHintTone = "warm"
      defaultHintText =
        "No default group selected yet. Stream Deck keys may alert on first press until you pick one."
    } else if (defaultGroupKey) {
      defaultHintText = "Default group saved. Keys use it automatically."
    }

    let keyHintTone = "neutral"
    let keyHintText = "Leave override empty to use the default group for all actions."

    if (overrideStale) {
      keyHintTone = "bad"
      keyHintText =
        "This key's override is stale and missing from discovery. Re-select a group or clear the override."
    } else if (overrideKey) {
      keyHintText = "This key uses its own group instead of the default."
    } else if (missingDefault) {
      keyHintTone = "warm"
      keyHintText = "No default group yet — select one above before pressing keys."
    }

    return {
      defaultStale,
      overrideStale,
      missingDefault,
      defaultHintTone,
      defaultHintText,
      keyHintTone,
      keyHintText,
    }
  }

  function groupKey(group) {
    return group?.householdId && group?.groupId
      ? `${group.householdId}:${group.groupId}`
      : ""
  }

  function parseGlobalSettings(value) {
    if (!value || typeof value !== "object") {
      return { connectionStatus: "disconnected" }
    }

    return {
      actionTargets: parseActionTargets(value.actionTargets),
      connectedAccountLabel: optionalString(value.connectedAccountLabel),
      connectRequestedAt:
        typeof value.connectRequestedAt === "number" ? value.connectRequestedAt : undefined,
      connectionStatus: normalizeConnectionStatus(value.connectionStatus),
      defaultTarget: groupKey(parseTargetSettings(value.defaultTarget))
        ? parseTargetSettings(value.defaultTarget)
        : undefined,
      lastError: optionalString(value.lastError),
      serviceBaseUrl: optionalString(value.serviceBaseUrl),
      sessionRef: optionalString(value.sessionRef),
    }
  }

  function parseActionTargets(value) {
    if (!value || typeof value !== "object") {
      return undefined
    }

    const entries = {}

    for (const [contextId, settings] of Object.entries(value)) {
      const parsed = parseTargetSettings(settings)
      if (groupKey(parsed)) {
        entries[contextId] = parsed
      }
    }

    return Object.keys(entries).length > 0 ? entries : undefined
  }

  function parseTargetSettings(value) {
    if (!value || typeof value !== "object") {
      return {}
    }

    return {
      groupId: optionalString(value.groupId),
      groupName: optionalString(value.groupName),
      householdId: optionalString(value.householdId),
    }
  }

  function optionalString(value) {
    return typeof value === "string" && value.trim() ? value : undefined
  }

  function normalizeConnectionStatus(value) {
    switch (value) {
      case "authorizing":
      case "connected":
      case "error":
        return value
      default:
        return "disconnected"
    }
  }

  function connectionDescription(connectionStatus) {
    switch (connectionStatus) {
      case "connected":
        return "The broker connection is live and this action can target a Sonos group."
      case "authorizing":
        return "The broker is waiting for Sonos authorization to complete."
      case "error":
        return "The broker reported an authorization or connection error."
      default:
        return "The broker has not been connected yet."
    }
  }

  function titleCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1)
  }

  function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }
})()
