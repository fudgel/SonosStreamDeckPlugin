import type { SonosGroupState } from "../sonos/client"

import type { SonosTargetStateSnapshot } from "./state-store"

type CapabilityState = Pick<SonosGroupState, "availableActions"> | SonosTargetStateSnapshot | undefined

export function isSkipForwardAvailable(state: CapabilityState): boolean {
  return state?.availableActions?.canSkip !== false
}

export function isSkipBackAvailable(state: CapabilityState): boolean {
  return state?.availableActions?.canSkipBack !== false
}

export function isPauseAvailable(state: CapabilityState): boolean {
  return state?.availableActions?.canPause !== false
}

export function capabilityKeyTitle(base: string, available: boolean): string {
  return available ? base : "Off"
}

export function playPauseKeyTitle(
  playbackStatus: SonosGroupState["playbackStatus"] | undefined,
  state: CapabilityState,
): string {
  if (playbackStatus === "playing") {
    return isPauseAvailable(state) ? "Pause" : "Locked"
  }

  return "Play"
}

export function encoderPushDescription(
  state: CapabilityState,
  playbackStatus: SonosGroupState["playbackStatus"] | undefined,
): string | undefined {
  if (playbackStatus === "playing" && !isPauseAvailable(state)) {
    return "Pause unavailable"
  }

  return undefined
}
