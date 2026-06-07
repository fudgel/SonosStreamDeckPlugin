import streamDeck, {
  SingletonAction,
  type SendToPluginEvent,
} from "@elgato/streamdeck"

import {
  pluginCore,
  type PropertyInspectorMessage,
} from "../core/plugin-core"
import type { SonosActionSettings } from "../core/settings"

export abstract class SonosAction extends SingletonAction<SonosActionSettings> {
  override onSendToPlugin(
    ev: SendToPluginEvent<PropertyInspectorMessage, SonosActionSettings>,
  ): void {
    const payload = ev.payload

    if (payload?.type === "set-target") {
      const target: SonosActionSettings = {
        householdId: payload.householdId,
        groupId: payload.groupId,
        groupName: payload.groupName,
      }

      streamDeck.logger.info(
        `Action PI set-target: context=${ev.action.id} household=${target.householdId ?? "none"} group=${target.groupId ?? "none"}`,
      )

      void ev.action
        .setSettings(target)
        .then(async () => {
          await streamDeck.ui.sendToPropertyInspector({
            type: "target-saved",
            settings: target,
          })
        })
        .catch(async (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          streamDeck.logger.warn(`Action PI set-target failed: ${message}`)
          await streamDeck.ui.sendToPropertyInspector({
            type: "target-save-failed",
            message,
          })
          if ("showAlert" in ev.action) {
            await ev.action.showAlert()
          }
        })
      return
    }

    streamDeck.logger.info(
      `Action PI message: ${typeof payload === "object" && payload && "type" in payload ? payload.type : "unknown"}`,
    )
    void pluginCore.handlePropertyInspectorMessage(payload)
  }
}
