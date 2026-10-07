/**
 * web/character.js — Full HTML5 Canvas 2D Character Engine with Modular Species.
 * Stage 1 Shippable v0.1.0
 * 
 * Features:
 * - Dynamic FPS: 60 FPS when active, ~30 FPS during calm idle
 * - Battery saver: pauses loop completely when document.hidden
 * - DPR capped at 2.0 to conserve GPU memory and battery on retina screens
 * - Zero memory growth (fixed particle buffers)
 * - HiDPI scaling with modular species rendering
 * - Direct touch body-part hit-testing (ears, tail, head, body)
 */

import { BASE_STATE, CONSTANTS, MOODS } from './moods.js';
import { FoxSpecies } from './species/fox.js';

export class CompanionCharacter {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });

    // Motion preference
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Load Modular Species (Fox-Spirit Cub / Kitsune)
    this.species = new FoxSpecies();

    // Current and Target Pose Parameters
    this.cur = { ...BASE_STATE };
    this.tgt = { ...BASE_STATE };
    this.activeMood = 'neutral';
    this.isInteracting = false;

    // Blinking State
    this.blinkScale = 1.0;
    this.isBlinking = false;
    this._startBlinkLoop();

    // Controls Button Spring Scales & Hovers
    this.btnScales = { PREV: 1.0, PLAY: 1.0, NEXT: 1.0 };
    this.btnHover = { PREV: false, PLAY: false, NEXT: false };

    // Layout Dimensions (Virtual 360x360 coordinate system)
    this.VIRTUAL_SIZE = 360;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());

    // Performance & Battery Optimization
    this.lastTime = performance.now();
    this.lastRenderTime = 0;
    this.isPaused = false;
    this.rafId = null;

    this.animate = this.animate.bind(this);
    this._bindVisibilityHandler();

    this.rafId = requestAnimationFrame(this.animate);
  }

  _resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = rect.width || 360;
    const cssHeight = rect.height || 360;
    const cssSize = Math.min(cssWidth, cssHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    this.canvas.width = Math.round(cssSize * this.dpr);
    this.canvas.height = Math.round(cssSize * this.dpr);
    this.scaleFactor = this.canvas.width / this.VIRTUAL_SIZE;
  }

  _bindVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.isPaused = true;
        if (this.rafId) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
      } else {
        this.isPaused = false;
        this.lastTime = performance.now();
        this.lastRenderTime = performance.now();
        if (!this.rafId) {
          this.rafId = requestAnimationFrame(this.animate);
        }
      }
    });
  }

  setMood(moodName) {
    if (!MOODS[moodName]) return;
    this.activeMood = moodName;
    const moodParams = MOODS[moodName];
    for (const key in moodParams) {
      this.tgt[key] = moodParams[key];
    }
  }

  applyPose(poseOverrides) {
    for (const key in poseOverrides) {
      this.tgt[key] = poseOverrides[key];
    }
  }

  setMorphTarget(val) {
    this.tgt.morphProgress = val;
  }

  triggerButtonPress(zoneName) {
    if (this.btnScales[zoneName] !== undefined) {
      this.btnScales[zoneName] = 0.82;
    }
  }

  _startBlinkLoop() {
    const scheduleNext = () => {
      const delay = CONSTANTS.blinkIntervalMin + Math.random() * (CONSTANTS.blinkIntervalMax - CONSTANTS.blinkIntervalMin);
      setTimeout(() => {
        if (!this.isPaused && (this.activeMood !== 'sleepy' || Math.random() < 0.25)) {
          this.isBlinking = true;
          setTimeout(() => {
            this.isBlinking = false;
            // Occasional double-blink (20% chance)
            if (Math.random() < 0.22) {
              setTimeout(() => {
                this.isBlinking = true;
                setTimeout(() => { this.isBlinking = false; }, CONSTANTS.blinkDuration);
              }, 180);
            }
          }, CONSTANTS.blinkDuration);
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }

  isCalmIdle() {
    return (
      this.activeMood === 'neutral' &&
      !this.isInteracting &&
      this.cur.morphProgress < 0.05 &&
      Math.abs(this.cur.bodyWobble) < 0.5 &&
      Math.abs(this.cur.bodyOffsetY) < 1.0 &&
      Math.abs(this.cur.bodyScaleX - 1.0) < 0.02
    );
  }

  animate(now) {
    if (this.isPaused) return;

    // Dynamic Frame Rate: ~30 FPS during calm idle, 60 FPS when active
    const targetInterval = this.isCalmIdle() ? 32.0 : 15.5;
    const elapsedSinceRender = now - this.lastRenderTime;

    if (elapsedSinceRender < targetInterval) {
      this.rafId = requestAnimationFrame(this.animate);
      return;
    }

    const dt = Math.min(0.06, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.lastRenderTime = now;

    this._updatePhysics(dt, now);
    this._render(now);

    this.rafId = requestAnimationFrame(this.animate);
  }

  _updatePhysics(dt, now) {
    const cur = this.cur;
    const tgt = this.tgt;

    // 1. Torso & Body Spring Physics
    const kBody = 1 - Math.exp(-dt * CONSTANTS.bodySpring);
    for (const key of ['bodyScaleX', 'bodyScaleY', 'bodyOffsetY', 'bodyTilt', 'bodyWobble', 'morphProgress', 'breathSpeed', 'blushOpacity', 'foreheadGlow', 'wispSpeed']) {
      if (cur[key] !== undefined && tgt[key] !== undefined) {
        cur[key] += (tgt[key] - cur[key]) * kBody;
      }
    }

    // 2. Eyes & Gaze Spring Physics
    const kEye = 1 - Math.exp(-dt * CONSTANTS.eyeSpring);
    for (const key of ['eyeWidth', 'eyeHeight', 'eyeOpenL', 'eyeOpenR', 'eyeGazeX', 'eyeGazeY', 'shineOpacity', 'eyebrowSlant', 'mouthOpen', 'mouthWidth', 'mouthCurve']) {
      if (cur[key] !== undefined && tgt[key] !== undefined) {
        cur[key] += (tgt[key] - cur[key]) * kEye;
      }
    }

    // 3. Fox Ears Spring Physics (Independent left / right)
    const kEar = 1 - Math.exp(-dt * CONSTANTS.earSpring);
    for (const key of ['earLRot', 'earRRot', 'earLFold', 'earRFold']) {
      if (cur[key] !== undefined && tgt[key] !== undefined) {
        cur[key] += (tgt[key] - cur[key]) * kEar;
      }
    }

    // 4. Tail Parameters Easing
    const kTail = 1 - Math.exp(-dt * CONSTANTS.tailSpring);
    for (const key of ['tailAngle', 'tailWagSpeed', 'tailWagAmp', 'tailCurl']) {
      if (cur[key] !== undefined && tgt[key] !== undefined) {
        cur[key] += (tgt[key] - cur[key]) * kTail;
      }
    }

    // Discrete attributes
    cur.eyeShape = tgt.eyeShape;
    cur.mouthStyle = tgt.mouthStyle;
    cur.tailPuff = tgt.tailPuff;
    cur.pawWiggle = tgt.pawWiggle;
    cur.activeEmote = tgt.activeEmote;

    // 5. Update Species Physics (Tail spring-chain, wisps, sneeze bursts)
    if (this.species && this.species.updatePhysics) {
      this.species.updatePhysics(dt, cur, now);
    }

    // 6. Blink Easing
    const targetBlink = this.isBlinking ? 0.06 : 1.0;
    this.blinkScale += (targetBlink - this.blinkScale) * (1 - Math.exp(-dt * CONSTANTS.blinkSpeed));

    // 7. Button Spring Release
    for (const key in this.btnScales) {
      if (this.btnScales[key] < 1.0) {
        this.btnScales[key] += (1.0 - this.btnScales[key]) * 0.22;
        if (Math.abs(1.0 - this.btnScales[key]) < 0.01) this.btnScales[key] = 1.0;
      }
    }
  }

  // --- Rendering Pipeline ---

  _render(now) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    // Scale from virtual 360x360 coordinate system to device pixels
    ctx.scale(this.scaleFactor, this.scaleFactor);
    ctx.translate(180, 180);

    // 1. Draw Modular Species Character
    if (this.species) {
      this.species.draw(ctx, this.cur, this.blinkScale, now);
    }

    // 2. Draw Shake-to-Controls 3-Zone UI (Morph Overlay)
    if (this.cur.morphProgress > 0.02) {
      this._drawControlsOverlay(ctx, now);
    }

    ctx.restore();
  }

  _drawControlsOverlay(ctx, now) {
    const p = Math.min(1.0, this.cur.morphProgress);
    ctx.save();
    ctx.globalAlpha = p;

    // Frosted dark pill backdrop
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.roundRect(-155, 30, 310, 80, 40);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 3 Tactile Buttons
    this._drawControlButton(ctx, -95, 70, 32, this.btnScales.PREV, this.btnHover.PREV, 'PREV');
    this._drawControlButton(ctx, 0, 70, 36, this.btnScales.PLAY, this.btnHover.PLAY, 'PLAY');
    this._drawControlButton(ctx, 95, 70, 32, this.btnScales.NEXT, this.btnHover.NEXT, 'NEXT');

    ctx.restore();
  }

  _drawControlButton(ctx, cx, cy, radius, scale, hover, type) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const grad = ctx.createLinearGradient(0, -radius, 0, radius);
    if (type === 'PLAY') {
      grad.addColorStop(0, hover ? '#0284C7' : '#0369A1');
      grad.addColorStop(1, hover ? '#0369A1' : '#075985');
    } else {
      grad.addColorStop(0, hover ? '#334155' : '#1E293B');
      grad.addColorStop(1, hover ? '#1E293B' : '#0F172A');
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = hover ? '#38BDF8' : 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = hover ? 2.5 : 1.5;
    ctx.stroke();

    // Vector Glyphs
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (type === 'PREV') {
      ctx.fillRect(-10, -8, 2.5, 16);
      ctx.beginPath();
      ctx.moveTo(8, -8);
      ctx.lineTo(-4, 0);
      ctx.lineTo(8, 8);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'PLAY') {
      ctx.fillRect(-8, -9, 4, 18);
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 9);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'NEXT') {
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.lineTo(4, 0);
      ctx.lineTo(-8, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(8, -8, 2.5, 16);
    }

    ctx.restore();
  }

  getHitInfo(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const vx = (x * this.dpr) / this.scaleFactor - 180;
    const vy = (y * this.dpr) / this.scaleFactor - 180;

    // 1. Controls Mode Hit-Test
    if (this.cur.morphProgress > 0.5) {
      if (Math.hypot(vx - (-95), vy - 70) < 38) return { type: 'control', zone: 'PREV' };
      if (Math.hypot(vx - 0, vy - 70) < 42) return { type: 'control', zone: 'PLAY' };
      if (Math.hypot(vx - 95, vy - 70) < 38) return { type: 'control', zone: 'NEXT' };
      return null;
    }

    // 2. Creature Anatomy Hit-Test
    if (this.species && this.species.hitTest) {
      const zone = this.species.hitTest(vx, vy);
      if (zone) return { type: 'creature', zone };
    }

    return { type: 'creature', zone: 'body' };
  }

  getControlZoneAt(clientX, clientY) {
    const hit = this.getHitInfo(clientX, clientY);
    if (hit && hit.type === 'control') return hit.zone;
    return null;
  }
}
