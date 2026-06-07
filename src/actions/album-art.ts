import {
  action,
  type DidReceiveSettingsEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck"

import { SonosAction } from "./sonos-action"
import { pluginCore } from "../core/plugin-core"
import type { SonosActionSettings } from "../core/settings"

@action({ UUID: "com.sonosstreamdeck.plugin.album-art" })
export class AlbumArtAction extends SonosAction {
  override async onWillAppear(
    ev: WillAppearEvent<SonosActionSettings>,
  ): Promise<void> {
    pluginCore.registerVisibleAction("album-art", ev.action, ev.payload.settings)
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<SonosActionSettings>,
  ): Promise<void> {
    pluginCore.updateVisibleAction("album-art", ev.action, ev.payload.settings)
  }

  override async onWillDisappear(
    ev: WillDisappearEvent<SonosActionSettings>,
  ): Promise<void> {
    pluginCore.unregisterVisibleAction(ev.action)
  }

  // Display-only action. Presses intentionally do nothing.
}
