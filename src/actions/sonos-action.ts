import { SingletonAction } from "@elgato/streamdeck"

import type { SonosActionSettings } from "../core/settings"

export abstract class SonosAction extends SingletonAction<SonosActionSettings> {}
