import {
  action,
  type DidReceiveSettingsEvent,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck"

import { SonosAction } from "./sonos-action"
import { pluginCore, shouldShowCommandAlert } from "../core/plugin-core"
import type { SonosActionSettings } from "../core/settings"

@action({ UUID: "com.sonosstreamdeck.plugin.play-mode" })
export class PlayModeAction extends SonosAction {
  override async onWillAppear(
    ev: WillAppearEvent<SonosActionSettings>,
  ): Promise<void> {
    pluginCore.registerVisibleAction("play-mode", ev.action, ev.payload.settings)
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<SonosActionSettings>,
  ): Promise<void> {
    pluginCore.updateVisibleAction("play-mode", ev.action, ev.payload.settings)
  }

  override async onWillDisappear(
    ev: WillDisappearEvent<SonosActionSettings>,
  ): Promise<void> {
    pluginCore.unregisterVisibleAction(ev.action)
  }

  override async onKeyDown(ev: KeyDownEvent<SonosActionSettings>): Promise<void> {
    const result = await pluginCore.runCommand(
      ev.payload.settings,
      "play-mode",
      {
        type: "playback.mode.cycle",
      },
      ev.action.id,
    )

    if (shouldShowCommandAlert(result)) {
      await ev.action.showAlert()
    }
  }
}
