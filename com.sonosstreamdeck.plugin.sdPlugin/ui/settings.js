(function () {
  const state = {
    actionInfo: undefined,
    authorizeUrl: undefined,
    groups: [],
    groupsError: undefined,
    groupsStatus: "idle",
    globalSettings: {
      connectionStatus: "disconnected",
    },
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
          if (message.context === state.actionInfo?.context) {
            state.settings = message.payload?.settings || {}
            render()
          }
          break
        case "didReceiveGlobalSettings":
          state.globalSettings = message.payload?.settings || {
            connectionStatus: "disconnected",
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

    refs.connectButton.addEventListener("click", async () => {
      await persistServiceBaseUrl()
      sendToPlugin({
        type: "start-auth",
        serviceBaseUrl: refs.serviceBaseUrlInput.value.trim() || undefined,
      })
    })

    refs.refreshGroupsButton.addEventListener("click", async () => {
      await persistServiceBaseUrl()
      sendToPlugin({
        type: "refresh-groups",
        serviceBaseUrl: refs.serviceBaseUrlInput.value.trim() || undefined,
      })
    })

    refs.groupSelect.addEventListener("change", () => {
      const selectedGroup = state.groups.find(
        (group) => groupKey(group) === refs.groupSelect.value,
      )

      setSettings(
        selectedGroup
          ? {
              groupId: selectedGroup.groupId,
              groupName: selectedGroup.groupName,
              householdId: selectedGroup.householdId,
            }
          : {
              groupId: undefined,
              groupName: undefined,
              householdId: undefined,
            },
      )
    })

    refs.serviceBaseUrlInput.addEventListener("change", () => {
      void persistServiceBaseUrl()
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
          typeof payload.groupsStatus === "string"
            ? payload.groupsStatus
            : "idle"
        render()
        break
      case "open-auth-url":
        if (typeof payload.url === "string" && payload.url) {
          state.authorizeUrl = payload.url
          render()
          window.open(payload.url, "_blank", "noopener,noreferrer")
        }
        break
      default:
        break
    }
  }

  async function persistServiceBaseUrl() {
    const nextServiceBaseUrl = refs.serviceBaseUrlInput.value.trim()
    const nextGlobalSettings = {
      ...state.globalSettings,
      serviceBaseUrl: nextServiceBaseUrl || undefined,
    }

    state.globalSettings = nextGlobalSettings
    render()
    setGlobalSettings(nextGlobalSettings)
  }

  function requestSettings() {
    send({
      action: state.actionInfo?.action,
      context: state.actionInfo?.context,
      event: "getSettings",
    })
  }

  function requestGlobalSettings() {
    send({
      context: state.uuid,
      event: "getGlobalSettings",
    })
  }

  function setSettings(payload) {
    send({
      action: state.actionInfo?.action,
      context: state.actionInfo?.context,
      event: "setSettings",
      payload,
    })
  }

  function setGlobalSettings(payload) {
    send({
      context: state.uuid,
      event: "setGlobalSettings",
      payload,
    })
  }

  function sendToPlugin(payload) {
    send({
      action: state.actionInfo?.action,
      context: state.actionInfo?.context,
      event: "sendToPlugin",
      payload,
    })
  }

  function send(message) {
    if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
      return
    }

    state.socket.send(JSON.stringify(message))
  }

  function render() {
    refs.serviceBaseUrlInput.value = state.globalSettings.serviceBaseUrl || ""

    const connectionStatus = normalizeConnectionStatus(
      state.globalSettings.connectionStatus,
    )
    const selectedGroupKey = groupKey(state.settings)
    const groupsAreReady = state.groupsStatus === "ready" && state.groups.length > 0
    const canConnect = Boolean(state.globalSettings.serviceBaseUrl?.trim())
    refs.connectionPill.dataset.status = connectionStatus
    refs.connectionPill.textContent = titleCase(connectionStatus)
    refs.connectButton.disabled = !canConnect
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
          ? "Finish the Sonos sign-in page that opened in your browser, then return here."
          : "Use the local broker stub during development, then replace the base URL with your real integration service later.")
    refs.authLink.style.display =
      connectionStatus === "authorizing" && state.authorizeUrl ? "inline-block" : "none"
    refs.authLink.href = state.authorizeUrl || "#"

    refs.groupsStatusCopy.textContent = titleCase(state.groupsStatus)
    refs.groupsHint.dataset.tone =
      state.groupsStatus === "error"
        ? "bad"
        : state.groupsStatus === "loading"
          ? "warm"
          : "neutral"
    refs.groupsHint.textContent =
      state.groupsError ||
      (state.groupsStatus === "loading"
        ? "Refreshing Sonos households and groups from the broker..."
        : "Group choices are discovered live from the broker and stored per action.")

    renderGroupOptions(selectedGroupKey)

    refs.selectedGroupCopy.textContent = selectedGroupKey
      ? `This action targets ${selectedGroupName(selectedGroupKey)}.`
      : "This action has not been assigned to a Sonos group yet."
    refs.groupsEmpty.hidden = groupsAreReady
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
    refs.groupSelect.disabled = state.globalSettings.connectionStatus !== "connected"
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
})()
