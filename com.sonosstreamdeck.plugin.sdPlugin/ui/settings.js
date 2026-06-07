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
    pendingSettings: undefined,
    pendingAuth: undefined,
    saveTimer: undefined,
    settings: {},
    socket: undefined,
    uuid: "",
  }

  const refs = {
    authLink: document.getElementById("auth-link"),
    connectButton: document.getElementById("connect-button"),
    connectionCopy: document.getElementById("connection-copy"),
    connectionHint: document.getElementById("connection-hint"),
    connectionPill: document.getElementById("connection-pill"),
    groupSelect: document.getElementById("group-select"),
    groupsEmpty: document.getElementById("groups-empty"),
    groupsHint: document.getElementById("groups-hint"),
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
      sendToPlugin({ type: "request-snapshot" })
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
          const savedTarget = state.globalSettings.actionTargets?.[state.actionContext]
          if (savedTarget) {
            confirmSettings(parseTargetSettings(savedTarget))
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
      const serviceBaseUrl = refs.serviceBaseUrlInput.value.trim() || undefined
      persistServiceBaseUrl(serviceBaseUrl)
      sendToPlugin({
        type: "refresh-groups",
        serviceBaseUrl,
      })
    })

    refs.groupSelect.addEventListener("change", () => {
      const selectedGroup = state.groups.find(
        (group) => groupKey(group) === refs.groupSelect.value,
      )
      const nextSettings = selectedGroup
        ? {
            groupId: selectedGroup.groupId,
            groupName: selectedGroup.groupName,
            householdId: selectedGroup.householdId,
          }
        : {}

      saveActionSettings(nextSettings)
    })

    render()
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
      case "target-saved":
        confirmSettings(parseTargetSettings(payload.settings))
        state.groupsError = undefined
        if (state.groups.length > 0) {
          state.groupsStatus = "ready"
        }
        render()
        break
      case "target-save-failed":
        state.pendingSettings = undefined
        clearTimeout(state.saveTimer)
        state.groupsStatus = "error"
        state.groupsError =
          typeof payload.message === "string"
            ? payload.message
            : "Group selection failed."
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
    sendToPlugin({
      type: "sync-connection",
      serviceBaseUrl: globalSettings.serviceBaseUrl,
      sessionRef: globalSettings.sessionRef,
      connectionStatus: globalSettings.connectionStatus,
      connectedAccountLabel: globalSettings.connectedAccountLabel,
      lastError: globalSettings.lastError,
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
        sendToPlugin({ type: "refresh-groups", serviceBaseUrl })
        return
      }

      if (connectionBody.ok && connectionBody.connectionStatus === "error") {
        throw new Error(connectionBody.lastError || "Broker authorization failed.")
      }
    }

    throw new Error("Sonos authorization did not finish in time.")
  }

  function saveActionSettings(nextSettings) {
    clearTimeout(state.saveTimer)

    const actionTargets = {
      ...(state.globalSettings.actionTargets || {}),
      [state.actionContext]: nextSettings,
    }

    const nextGlobalSettings = {
      ...state.globalSettings,
      actionTargets,
    }

    state.globalSettings = nextGlobalSettings
    state.settings = nextSettings
    state.pendingSettings = undefined
    state.actionSettingsConfirmed = Boolean(groupKey(nextSettings))
    state.groupsError = undefined

    const sent = send({
      context: state.uuid,
      event: "setGlobalSettings",
      payload: nextGlobalSettings,
    })

    if (!sent) {
      state.groupsStatus = "error"
      state.groupsError = "Could not save the Sonos group selection."
      state.actionSettingsConfirmed = false
    }

    render()
  }

  function confirmSettings(settings) {
    state.settings = settings
    state.actionSettingsConfirmed = Boolean(groupKey(settings))

    if (settingsEqual(settings, state.pendingSettings)) {
      state.pendingSettings = undefined
      clearTimeout(state.saveTimer)
    }

    render()
  }

  function sendToPlugin(payload) {
    return send({
      action: state.actionInfo?.action,
      context: state.actionContext,
      event: "sendToPlugin",
      payload,
    })
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
    const selectedGroupKey = groupKey(state.settings)
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

    refs.groupsStatusCopy.textContent = state.pendingSettings
      ? "Saving"
      : titleCase(state.groupsStatus)
    refs.groupsHint.dataset.tone =
      state.groupsStatus === "error"
        ? "bad"
        : state.groupsStatus === "loading" || state.pendingSettings
          ? "warm"
          : "neutral"
    refs.groupsHint.textContent =
      state.pendingSettings
        ? "Saving this action's Sonos group..."
        : state.groupsError ||
          (state.groupsStatus === "loading"
            ? "Refreshing Sonos households and groups from the plugin..."
            : "Group choices are discovered by the plugin and stored per action.")

    renderGroupOptions(selectedGroupKey)

    refs.selectedGroupCopy.textContent = selectedGroupKey
      ? state.actionSettingsConfirmed
        ? `This action targets ${selectedGroupName(selectedGroupKey)}.`
        : `Saving target ${selectedGroupName(selectedGroupKey)}...`
      : "This action has not been assigned to a Sonos group yet."
    refs.groupsEmpty.hidden = state.groups.length > 0 || groupsAreReady
    refs.groupsEmpty.textContent =
      state.groupsStatus === "loading"
        ? "Loading Sonos groups..."
        : connectionStatus !== "connected"
          ? "Connect Sonos to load groups."
          : "No groups loaded yet."
  }

  function renderGroupOptions(selectedGroupKey) {
    const options = []

    if (!state.groups.length) {
      options.push(
        new Option(
          state.groupsStatus === "loading"
            ? "Loading Sonos groups..."
            : "Choose a Sonos group",
          "",
        ),
      )
    } else {
      options.push(new Option("Choose a Sonos group", ""))

      for (const group of state.groups) {
        options.push(new Option(group.label, groupKey(group)))
      }
    }

    refs.groupSelect.replaceChildren(...options)
    refs.groupSelect.disabled =
      state.globalSettings.connectionStatus !== "connected" ||
      state.groupsStatus === "loading"
    refs.groupSelect.value = selectedGroupKey || ""
  }

  function selectedGroupName(selectedGroupKey) {
    const group = state.groups.find((entry) => groupKey(entry) === selectedGroupKey)
    return group ? group.label : state.settings.groupName || "the selected Sonos group"
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

  function settingsEqual(left, right) {
    return (
      (!left && !right) ||
      Boolean(left && right &&
        left.groupId === right.groupId &&
        left.groupName === right.groupName &&
        left.householdId === right.householdId)
    )
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
