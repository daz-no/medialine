import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const BAR_COUNT = 11;
const BAR_WIDTH = 2;
const BAR_GAP = 2;
const MIN_HEIGHT = 3;
const MAX_HEIGHT = 20;
const TICK_MS = 240;

// Both waveforms live inside the date menu's content box, leaving its clock,
// notification indicator, and click handling intact.
export class ClockWaveform {
    constructor(preferences, mprisManager) {
        this._preferences = preferences;
        this._mprisManager = mprisManager;
        this._tickId = null;
        this._playing = false;
        this._left = null;
        this._right = null;
        this._bars = [];

        this._clock = Main.panel.statusArea.dateMenu?._clockDisplay;
        const clockBox = this._clock?.get_parent();
        if (!clockBox)
            return;

        this._left = this._buildWaveform();
        this._right = this._buildWaveform();
        clockBox.insert_child_at_index(this._left, 0);
        clockBox.add_child(this._right);

        this._left.connectObject('notify::mapped', () => this._syncAnimation(), this);
        this._right.connectObject('notify::mapped', () => this._syncAnimation(), this);
        preferences.connectObject('changed::show-clock-waveform', () => this._sync(), this);
        this._clock.connectObject('style-changed', () => this._syncColor(), this);
        mprisManager.connectObject('media-changed', () => this._sync(), this);
        this._syncColor();
        this._sync();
    }

    _buildWaveform() {
        const box = new St.BoxLayout({
            reactive: false,
            can_focus: false,
            y_align: Clutter.ActorAlign.CENTER,
            width: BAR_COUNT * BAR_WIDTH + (BAR_COUNT - 1) * BAR_GAP,
            height: MAX_HEIGHT,
            style: `spacing: ${BAR_GAP}px; margin: 0 8px;`,
            visible: false,
        });

        const bars = [];
        for (let i = 0; i < BAR_COUNT; i++) {
            const bar = new St.Widget({
                reactive: false,
                width: BAR_WIDTH,
                height: MIN_HEIGHT,
                y_align: Clutter.ActorAlign.CENTER,
            });
            box.add_child(bar);
            bars.push(bar);
        }
        this._bars.push(bars);
        return box;
    }

    _syncColor() {
        const color = this._clock.get_theme_node().get_foreground_color();
        const style = `background-color: rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha / 255}); border-radius: 1px;`;
        for (const bars of this._bars) {
            for (const bar of bars)
                bar.style = style;
        }
    }

    _sync() {
        this._playing = this._preferences.showClockWaveform &&
            this._mprisManager.allMedia.some(media => media.status === 'Playing');
        this._left.visible = this._playing;
        this._right.visible = this._playing;
        this._syncAnimation();
    }

    _syncAnimation() {
        const animate = this._playing && this._left?.mapped && this._right?.mapped;
        if (!animate) {
            this._stop();
            return;
        }
        if (this._tickId)
            return;

        this._tick();
        this._tickId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TICK_MS, () => {
            this._tick();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _tick() {
        for (let i = 0; i < BAR_COUNT; i++) {
            const height = MIN_HEIGHT + Math.round(Math.random() * (MAX_HEIGHT - MIN_HEIGHT));
            // Mirror the motion on either side of the clock.
            for (const bar of [this._bars[0][i], this._bars[1][BAR_COUNT - 1 - i]]) {
                bar.ease({
                    height,
                    duration: TICK_MS,
                    mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
                });
            }
        }
    }

    _stop() {
        if (this._tickId) {
            GLib.Source.remove(this._tickId);
            this._tickId = null;
        }
        for (const bars of this._bars) {
            for (const bar of bars)
                bar.remove_all_transitions();
        }
    }

    destroy() {
        this._preferences.disconnectObject(this);
        this._mprisManager.disconnectObject(this);
        this._clock?.disconnectObject(this);
        this._left?.disconnectObject(this);
        this._right?.disconnectObject(this);
        this._stop();
        this._left?.destroy();
        this._right?.destroy();
        this._left = null;
        this._right = null;
        this._clock = null;
        this._bars = [];
    }
}
