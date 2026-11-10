import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { Visualizer } from './visualizer.js';

// Thinner bars with wider spacing keep each waveform close to its old 42px width.
const WAVEFORM_SIZE = { barCount: 11, barWidth: 1, barGap: 3, height: 20 };

// Both waveforms live inside the date menu's content box, leaving its clock,
// notification indicator, and click handling intact.
export class ClockWaveform {
    constructor(preferences, mprisManager) {
        this._preferences = preferences;
        this._mprisManager = mprisManager;
        this._visualizers = [];

        this._clock = Main.panel.statusArea.dateMenu?._clockDisplay;
        const clockBox = this._clock?.get_parent();
        if (!clockBox)
            return;

        this._visualizers = [
            new Visualizer({ visualizerBar: '' }, WAVEFORM_SIZE),
            new Visualizer({ visualizerBar: '' }, WAVEFORM_SIZE),
        ];
        clockBox.insert_child_at_index(this._visualizers[0].actor, 0);
        clockBox.add_child(this._visualizers[1].actor);

        for (const visualizer of this._visualizers)
            visualizer.actor.connectObject('notify::mapped', () => this._syncAnimation(), this);
        preferences.connectObject('changed::show-clock-waveform', () => this._sync(), this);
        this._clock.connectObject('style-changed', () => this._syncColor(), this);
        mprisManager.connectObject('media-changed', () => this._sync(), this);
        this._syncColor();
        this._sync();
    }

    _syncColor() {
        const color = this._clock.get_theme_node().get_foreground_color();
        const style = `background-color: rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha / 255}); border-radius: 999px;`;
        for (const visualizer of this._visualizers)
            visualizer.setStyle({ visualizerBar: style });
    }

    _sync() {
        const playing = this._mprisManager.allMedia.some(media => media.status === 'Playing');
        for (const visualizer of this._visualizers) {
            visualizer.actor.visible = this._preferences.showClockWaveform;
            visualizer.setPlaying(playing);
        }
        this._syncAnimation();
    }

    _syncAnimation() {
        for (const visualizer of this._visualizers)
            visualizer.setActive(this._preferences.showClockWaveform && visualizer.actor.mapped);
    }

    destroy() {
        this._preferences.disconnectObject(this);
        this._mprisManager.disconnectObject(this);
        this._clock?.disconnectObject(this);
        for (const visualizer of this._visualizers) {
            visualizer.actor.disconnectObject(this);
            visualizer.destroy();
        }
        this._visualizers = [];
        this._clock = null;
    }
}
