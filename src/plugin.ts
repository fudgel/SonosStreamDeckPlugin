import streamDeck from "@elgato/streamdeck"

import { AlbumArtAction } from "./actions/album-art"
import { MuteToggleAction } from "./actions/mute-toggle"
import { NextTrackAction } from "./actions/next-track"
import { NowPlayingEncoderAction } from "./actions/now-playing-encoder"
import { PlayModeAction } from "./actions/play-mode"
import { PlayPauseAction } from "./actions/play-pause"
import { PreviousTrackAction } from "./actions/previous-track"
import { pluginCore } from "./core/plugin-core"

streamDeck.logger.setLevel("info")
pluginCore.initialize()

streamDeck.actions.registerAction(new PlayPauseAction())
streamDeck.actions.registerAction(new MuteToggleAction())
streamDeck.actions.registerAction(new NextTrackAction())
streamDeck.actions.registerAction(new PreviousTrackAction())
streamDeck.actions.registerAction(new PlayModeAction())
streamDeck.actions.registerAction(new AlbumArtAction())
streamDeck.actions.registerAction(new NowPlayingEncoderAction())

streamDeck.connect()
void pluginCore.hydrateSettings()
