import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {
    ANIM_MS, VIS_BARS, VIS_BAR_WIDTH, VIS_BAR_GAP,
    VIS_HEIGHT, VIS_TICK_MS,
} from './constants.js';

export class Visualizer {
    constructor(styles, {
        barCount = VIS_BARS,
        barWidth = VIS_BAR_WIDTH,
        barGap = VIS_BAR_GAP,
        height = VIS_HEIGHT,
        mirrorOf = null,
    } = {}) {
        this._bars = [];
        this._heightBindings = [];
        this._tickId = null;
        this._playing = false;
        this._active = false;
        this._height = height;
        this._minHeight = barWidth;

        this.actor = new St.BoxLayout({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            width: barCount * barWidth + (barCount - 1) * barGap,
            height,
            style: `spacing: ${barGap}px;`,
        });

        for (let i = 0; i < barCount; i++) {
            const bar = new St.Widget({
                width: barWidth,
                height: this._minHeight,
                y_expand: false,
                y_align: Clutter.ActorAlign.CENTER,
                style: styles.visualizerBar,
            });
            this.actor.add_child(bar);
            this._bars.push(bar);
        }

        // Follow each animation frame in reverse order, including the pause transition.
        if (mirrorOf) {
            this._heightBindings = this._bars.map((bar, index) =>
                mirrorOf._bars[barCount - 1 - index].bind_property(
                    'height', bar, 'height', GObject.BindingFlags.SYNC_CREATE));
        }
    }

    setStyle(styles) {
        for (const bar of this._bars)
            bar.style = styles.visualizerBar;
    }

    setPlaying(playing) {
        if (this._playing === playing)
            return;
        this._playing = playing;
        this._sync();
    }

    setActive(active) {
        if (this._active === active)
            return;
        this._active = active;
        this._sync();
    }

    _sync() {
        if (!this.actor || this._heightBindings.length > 0)
            return;
        if (this._playing && this._active)
            this._startTicker();
        else
            this._stopTicker();
    }

    _startTicker() {
        if (this._tickId)
            return;
        this._tick();
        this._tickId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, VIS_TICK_MS, () => {
            this._tick();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopTicker() {
        if (this._tickId) {
            GLib.Source.remove(this._tickId);
            this._tickId = null;
        }
        if (!this._playing)
            this._collapseToDots();
    }

    _tick() {
        const range = this._height - this._minHeight;
        for (const bar of this._bars) {
            const target = this._minHeight + Math.round(Math.random() * range);
            bar.remove_all_transitions();
            bar.ease({
                height: target,
                duration: VIS_TICK_MS,
                mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
            });
        }
    }

    _collapseToDots() {
        for (const bar of this._bars) {
            bar.remove_all_transitions();
            bar.ease({
                height: this._minHeight,
                duration: ANIM_MS,
                mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            });
        }
    }

    destroy() {
        for (const binding of this._heightBindings)
            binding.unbind();
        this._heightBindings = [];
        if (this._tickId) {
            GLib.Source.remove(this._tickId);
            this._tickId = null;
        }
        this.actor.destroy();
        this.actor = null;
        this._bars = [];
    }
}
