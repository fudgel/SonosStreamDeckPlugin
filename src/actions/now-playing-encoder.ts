import {
  action,
  type DidReceiveSettingsEvent,
  type DialDownEvent,
  SingletonAction,
  type TouchTapEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck"

import { pluginCore } from "../core/plugin-core"
import type { SonosActionSettings } from "../core/settings"

@action({ UUID: "com.sonosstreamdeck.plugin.now-playing-encoder" })
export class NowPlayingEncoderAction extends SingletonAction<SonosActionSettings> {
  override async onWillAppear(
    ev: WillAppearEvent<SonosActionSettings>,
  ): Promise<void> {
    pluginCore.registerVisibleAction(
      "now-playing-encoder",
      ev.action,
      ev.payload.settings,
    )
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<SonosActionSettings>,
  ): Promise<void> {
    pluginCore.updateVisibleAction(
      "now-playing-encoder",
      ev.action,
      ev.payload.settings,
    )
  }

  override async onWillDisappear(
    ev: WillDisappearEvent<SonosActionSettings>,
  ): Promise<void> {
    pluginCore.unregisterVisibleAction(ev.action)
  }

  override async onDialDown(ev: DialDownEvent<SonosActionSettings>): Promise<void> {
    const result = await pluginCore.runCommand(
      ev.payload.settings,
      "now-playing-encoder:push",
      {
        type: "playback.toggle",
      },
    )

    if (!result.ok) {
      await ev.action.showAlert()
    }
  }

  override async onTouchTap(ev: TouchTapEvent<SonosActionSettings>): Promise<void> {
    const result = await pluginCore.runCommand(
      ev.payload.settings,
      "now-playing-encoder:touch",
      {
        type: "playback.toggle",
      },
    )

    if (!result.ok) {
      await ev.action.showAlert()
    }
  }
}
