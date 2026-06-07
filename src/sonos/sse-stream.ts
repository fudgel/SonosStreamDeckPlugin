export type SseEventHandler = (eventName: string | undefined, data: string) => void

export async function pumpSseStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onEvent: SseEventHandler,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf("\n\n")

      while (boundary !== -1) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        dispatchSseBlock(block, onEvent)
        boundary = buffer.indexOf("\n\n")
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function dispatchSseBlock(block: string, onEvent: SseEventHandler): void {
  if (!block.trim() || block.trimStart().startsWith(":")) {
    return
  }

  let eventName: string | undefined
  const dataLines: string[] = []

  for (const line of block.split("\n")) {
    if (line.startsWith(":")) {
      continue
    }

    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim()
      continue
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (dataLines.length > 0) {
    onEvent(eventName, dataLines.join("\n"))
  }
}
