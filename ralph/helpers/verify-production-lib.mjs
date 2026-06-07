export function fail(message) {
  console.error(`FAIL  ${message}`)
  process.exit(1)
}

export function pass(message) {
  console.log(`PASS  ${message}`)
}

export const prodBaseUrl = () => {
  const host = process.env.SONOS_BROKER_PROD_HOST || "127.0.0.1"
  const port = process.env.SONOS_BROKER_PROD_PORT || "47832"
  return `http://${host}:${port}`
}
