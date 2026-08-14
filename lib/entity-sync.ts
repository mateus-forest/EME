const CHANNEL_NAME = "eme-entity-sync"

type EntitySyncType = "lead" | "property" | "broker"

export type EntitySyncMessage = {
  type: EntitySyncType
  entityId?: string
  sourceId?: string
  updatedAt: string
}

function createChannel() {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null
  return new BroadcastChannel(CHANNEL_NAME)
}

export function dispatchEntitySync(message: Omit<EntitySyncMessage, "updatedAt">) {
  if (typeof window === "undefined") return

  const payload: EntitySyncMessage = {
    ...message,
    updatedAt: new Date().toISOString(),
  }

  window.dispatchEvent(new CustomEvent(CHANNEL_NAME, { detail: payload }))

  const channel = createChannel()
  if (channel) {
    channel.postMessage(payload)
    channel.close()
  }
}

export function subscribeEntitySync(listener: (message: EntitySyncMessage) => void) {
  if (typeof window === "undefined") return () => undefined

  const onWindow = (event: Event) => {
    const customEvent = event as CustomEvent<EntitySyncMessage>
    if (customEvent.detail) listener(customEvent.detail)
  }

  window.addEventListener(CHANNEL_NAME, onWindow)

  const channel = createChannel()
  if (channel) {
    channel.onmessage = (event) => {
      if (event.data) listener(event.data as EntitySyncMessage)
    }
  }

  return () => {
    window.removeEventListener(CHANNEL_NAME, onWindow)
    channel?.close()
  }
}
