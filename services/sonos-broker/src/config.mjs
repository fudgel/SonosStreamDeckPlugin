export function loadConfig() {
  const host =
    process.env.SONOS_BROKER_PROD_HOST ||
    process.env.SONOS_BROKER_HOST ||
    "127.0.0.1"
  const port = Number(
    process.env.SONOS_BROKER_PROD_PORT ||
      process.env.SONOS_BROKER_PORT ||
      47832,
  )

  return {
    host,
    port,
    maxJsonBytes: 16 * 1024,
    publicBaseUrl:
      process.env.BROKER_PUBLIC_BASE_URL || `http://${host}:${port}`,
    sonos: {
      clientId: asNonEmptyString(process.env.SONOS_CLIENT_ID),
      clientSecret: asNonEmptyString(process.env.SONOS_CLIENT_SECRET),
      redirectUri: asNonEmptyString(process.env.SONOS_REDIRECT_URI),
    },
  }
}

export function isSonosConfigured(config) {
  return Boolean(
    config.sonos.clientId &&
      config.sonos.clientSecret &&
      config.sonos.redirectUri,
  )
}

function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}
