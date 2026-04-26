import {
  action,
  type DidReceiveSettingsEvent,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck"

import { pluginCore } from "../core/plugin-core"
import type { SonosActionSettings } from "../core/settings"

@action({ UUID: "com.sonosstreamdeck.plugin.previous-track" })
export class PreviousTrackAction extends SingletonAction<SonosActionSettings> {
  override async onWillAppear(
    ev: WillAppearEvent<SonosActionSettings>,
  ): Promise<void> {
    pluginCore.registerVisibleAction(
      "previous-track",
      ev.action,
      ev.payload.settings,
    )
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<SonosActionSettings>,
  ): Promise<void> {
    pluginCore.updateVisibleAction(
      "previous-track",
      ev.action,
      ev.payload.settings,
    )
  }

  override async onWillDisappear(
    ev: WillDisappearEvent<SonosActionSettings>,
  ): Promise<void> {
    pluginCore.unregisterVisibleAction(ev.action)
  }

  override async onKeyDown(ev: KeyDownEvent<SonosActionSettings>): Promise<void> {
    const result = await pluginCore.runCommand(
      ev.payload.settings,
      "previous-track",
      {
        type: "playback.previous",
      },
    )

    if (!result.ok) {
      await ev.action.showAlert()
    }
  }
}
