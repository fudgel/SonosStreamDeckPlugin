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

@action({ UUID: "com.sonosstreamdeck.plugin.next-track" })
export class NextTrackAction extends SingletonAction<SonosActionSettings> {
  override async onWillAppear(
    ev: WillAppearEvent<SonosActionSettings>,
  ): Promise<void> {
    pluginCore.registerVisibleAction("next-track", ev.action, ev.payload.settings)
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<SonosActionSettings>,
  ): Promise<void> {
    pluginCore.updateVisibleAction("next-track", ev.action, ev.payload.settings)
  }

  override async onWillDisappear(
    ev: WillDisappearEvent<SonosActionSettings>,
  ): Promise<void> {
    pluginCore.unregisterVisibleAction(ev.action)
  }

  override async onKeyDown(ev: KeyDownEvent<SonosActionSettings>): Promise<void> {
    const result = await pluginCore.runCommand(ev.payload.settings, "next-track", {
      type: "playback.next",
    })

    if (!result.ok) {
      await ev.action.showAlert()
    }
  }
}
