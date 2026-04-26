import {
  defaultGlobalSettings,
  type GlobalSettings,
} from "./settings"
import type {
  SonosCommandResult,
  SonosGroupState,
  SonosTarget,
} from "../sonos/client"

export type SonosTargetStateSnapshot = SonosGroupState & {
  receivedAtMillis: number
  target: SonosTarget
}

export type SonosStateSnapshot = {
  globalSettings: GlobalSettings
  targetStates: Record<string, SonosTargetStateSnapshot>
  lastCommand?: string
  lastCommandResult?: SonosCommandResult
}

type Listener = (snapshot: SonosStateSnapshot) => void

const defaultSnapshot: SonosStateSnapshot = {
  globalSettings: defaultGlobalSettings,
  targetStates: {},
}

export function getTargetKey(target: {
  householdId?: string
  groupId?: string
}): string | undefined {
  return target.householdId && target.groupId
    ? `${target.householdId}:${target.groupId}`
    : undefined
}

export class SonosStateStore {
  #snapshot: SonosStateSnapshot = defaultSnapshot

  readonly #listeners = new Set<Listener>()

  getSnapshot(): SonosStateSnapshot {
    return this.#snapshot
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener)

    return () => {
      this.#listeners.delete(listener)
    }
  }

  replaceGlobalSettings(globalSettings: GlobalSettings): void {
    this.#update({ globalSettings })
  }

  getTargetState(target: {
    householdId?: string
    groupId?: string
  }): SonosTargetStateSnapshot | undefined {
    const targetKey = getTargetKey(target)

    return targetKey ? this.#snapshot.targetStates[targetKey] : undefined
  }

  replaceTargetState(target: SonosTarget, state: SonosGroupState): void {
    const targetKey = getTargetKey(target)

    if (!targetKey) {
      return
    }

    const previousTargetState = this.#snapshot.targetStates[targetKey]

    this.#update({
      targetStates: {
        ...this.#snapshot.targetStates,
        [targetKey]: {
          ...state,
          receivedAtMillis: Date.now(),
          target: {
            ...previousTargetState?.target,
            ...target,
          },
        },
      },
    })
  }

  clearTargetStates(): void {
    if (!Object.keys(this.#snapshot.targetStates).length) {
      return
    }

    this.#update({ targetStates: {} })
  }

  recordPlaceholderCommand(commandName: string): void {
    this.#update({ lastCommand: commandName })
  }

  recordCommandResult(
    commandName: string,
    result: SonosCommandResult,
  ): void {
    this.#update({
      lastCommand: commandName,
      lastCommandResult: result,
    })
  }

  #update(patch: Partial<SonosStateSnapshot>): void {
    this.#snapshot = {
      ...this.#snapshot,
      ...patch,
    }

    for (const listener of this.#listeners) {
      listener(this.#snapshot)
    }
  }
}
