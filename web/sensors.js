/**
 * web/sensors.js — Hardware Device Sensors & Direct Touch Interaction Manager.
 * Stage 1 Shippable v0.1.0
 * 
 * Implements:
 * - Empirically verified shake detection with rolling window and direction reversals (rejects footsteps)
 * - Sustained tilt detection (500ms hold with deadzone)
 * - Sustained flip detection (400ms hold for true upside-down)
 * - Direct touch gestures on creature (ear tap, tail tap, body poke, hold pet, stroke, flick)
 * - Touch hint dismissal
 * - Desktop keyboard testing shortcuts (S, F, L, R, Z, Space, P)
 */

import { CONSTANTS } from './moods.js';

export class SensorManager {
  constructor(canvas, reactionEngine, onSensorStatus) {
    this.canvas = canvas;
    this.engine = reactionEngine;
    this.char = reactionEngine.char;
    this.updateStatus = onSensorStatus || (() => {});

    this.sensorsActive = false;
    this.shakeCooldown = 0;
    this.tiltCooldown = 0;

    // Rolling window history for shake direction reversals
    this.shakeHistory = [];

    // Sustained hold timers for tilt & flip
    this.tiltStartTime = 0;
    this.tiltDir = null;
    this.flipStartTime = 0;

    // Direct touch gesture tracking state
    this.pointerDown = false;
    this.pointerStart = { x: 0, y: 0, time: 0 };
    this.pointerLast = { x: 0, y: 0, time: 0, vx: 0, vy: 0 };
    this.holdTimer = null;
    this.isHeld = false;
    this.isStroking = false;
    this.hitZone = 'body';

    this._bindPointerEvents();
    this._bindKeyboardEvents();
  }

  // --- Hardware Sensors (devicemotion & deviceorientation) ---

  async requestMotionPermissions() {
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const motionPerm = await DeviceMotionEvent.requestPermission();
        if (motionPerm !== 'granted') {
          this.updateStatus('Motion permission denied');
          return false;
        }
      }

      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const orientPerm = await DeviceOrientationEvent.requestPermission();
        if (orientPerm !== 'granted') {
          this.updateStatus('Orientation permission denied');
          return false;
        }
      }

      this._enableListeners();
      this.sensorsActive = true;
      localStorage.setItem('companion_motion_unlocked', '1');
      this.updateStatus('Sensors Active (Shake / Tilt phone)');
      return true;
    } catch (err) {
      console.warn('[SensorManager] Sensor activation:', err);
      this.updateStatus('Desktop / Touch mode active');
      return false;
    }
  }

  autoUnlockIfGranted() {
    if (localStorage.getItem('companion_motion_unlocked') === '1') {
      this._enableListeners();
      this.sensorsActive = true;
      this.updateStatus('Sensors Active');
      return true;
    }
    return false;
  }

  _enableListeners() {
    // 1. Shake Detection: Rolling window & direction reversals check
    window.addEventListener('devicemotion', (e) => {
      const acc = e.accelerationIncludingGravity || e.acceleration;
      if (!acc) return;

      const mag = Math.hypot(acc.x || 0, acc.y || 0, acc.z || 0);
      const now = Date.now();
      const delta = Math.abs(mag - 9.8);

      // Record reading in rolling window
      const val = acc.x || acc.y || delta;
      this.shakeHistory.push({ time: now, val });
      this.shakeHistory = this.shakeHistory.filter(p => now - p.time < CONSTANTS.shakeWindowMs);

      // Count direction reversals in rolling window
      let reversals = 0;
      for (let i = 2; i < this.shakeHistory.length; i++) {
        const d1 = this.shakeHistory[i - 1].val - this.shakeHistory[i - 2].val;
        const d2 = this.shakeHistory[i].val - this.shakeHistory[i - 1].val;
        if ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) {
          reversals++;
        }
      }

      // Subtle carrying bounce when walking
      if (delta > 1.8 && delta < 5.5 && reversals < CONSTANTS.shakeReversalsNeeded && !this.engine.isSleeping && !this.engine.currentActionName) {
        this.char.tgt.bodyOffsetY = Math.sin(now * 0.01) * 2.5;
      }

      // Deliberate casual hand shake trigger
      if (delta > CONSTANTS.shakeThreshold && reversals >= CONSTANTS.shakeReversalsNeeded && now > this.shakeCooldown) {
        this.shakeCooldown = now + CONSTANTS.shakeCooldown;
        this.shakeHistory = [];
        this.engine.run('shake');
      }
    });

    // 2. Tilt & Flip Detection: Deadzone & Sustained hold checks
    window.addEventListener('deviceorientation', (e) => {
      if (this.engine.isSleeping || this.engine.isControlsMode) return;
      const gamma = e.gamma || 0; // Roll: Left (-90) to Right (+90)
      const beta = e.beta || 0;   // Pitch: Vertical (90) to Upside Down (180/-180)
      const now = Date.now();

      // True Upside-Down Flip (sustained 400ms hold)
      if (Math.abs(beta) > CONSTANTS.flipThresholdDeg) {
        if (!this.flipStartTime) {
          this.flipStartTime = now;
        } else if (now - this.flipStartTime >= CONSTANTS.flipHoldMs && now > this.tiltCooldown) {
          this.tiltCooldown = now + 3500;
          this.flipStartTime = 0;
          this.engine.run('flip');
          return;
        }
      } else {
        this.flipStartTime = 0;
      }

      // Sustained Tilt (500ms hold with deadzone)
      if (Math.abs(gamma) > CONSTANTS.tiltThresholdDeg) {
        const dir = gamma > 0 ? 'tiltR' : 'tiltL';
        if (this.tiltDir !== dir) {
          this.tiltDir = dir;
          this.tiltStartTime = now;
        } else if (now - this.tiltStartTime >= CONSTANTS.tiltHoldMs && now > this.tiltCooldown) {
          this.tiltCooldown = now + 2500;
          this.tiltStartTime = 0;
          this.tiltDir = null;
          this.engine.run(dir);
          return;
        }
      } else {
        this.tiltStartTime = 0;
        this.tiltDir = null;
      }

      // Smooth Ambient Gaze & Lean when held within gentle angle
      if (!this.engine.currentActionName || this.engine.currentActionName === 'neutral') {
        if (Math.abs(gamma) > CONSTANTS.tiltDeadzoneDeg) {
          const leanFactor = Math.max(-1.0, Math.min(1.0, (gamma) / 38.0));
          this.char.tgt.bodyTilt = leanFactor * 8.0;
          this.char.tgt.eyeGazeX = leanFactor * 0.6;
        }
      }
    });
  }

  // --- Direct Touch & Gesture Interactions ---

  _bindPointerEvents() {
    const canvas = this.canvas;

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const now = performance.now();
      this.pointerDown = true;
      this.pointerStart = { x: e.clientX, y: e.clientY, time: now };
      this.pointerLast = { x: e.clientX, y: e.clientY, time: now, vx: 0, vy: 0 };
      this.isHeld = false;
      this.isStroking = false;
      this.char.isInteracting = true;

      // Dismiss first-interaction visual hint if present
      const hint = document.getElementById('touchHint');
      if (hint && !hint.classList.contains('dismissed')) {
        hint.classList.add('dismissed');
        localStorage.setItem('companion_hint_dismissed', '1');
      }

      // Check Hit Information
      const hit = this.char.getHitInfo(e.clientX, e.clientY);
      if (this.engine.isControlsMode && hit && hit.type === 'control') {
        this.engine.handleControlClick(hit.zone);
        return;
      }

      this.hitZone = (hit && hit.zone) ? hit.zone : 'body';

      // Start Hold Timer for Petting
      clearTimeout(this.holdTimer);
      this.holdTimer = setTimeout(() => {
        if (this.pointerDown && !this.isStroking) {
          this.isHeld = true;
          this.engine.run('pet');
        }
      }, CONSTANTS.petHoldThreshold);
    });

    canvas.addEventListener('pointermove', (e) => {
      const now = performance.now();

      // Controls mode hover
      if (this.engine.isControlsMode) {
        const zone = this.char.getControlZoneAt(e.clientX, e.clientY);
        this.char.btnHover = {
          PREV: zone === 'PREV',
          PLAY: zone === 'PLAY',
          NEXT: zone === 'NEXT',
        };
        return;
      }

      // If dragging while pointer down
      if (this.pointerDown) {
        const dt = Math.max(1, now - this.pointerLast.time);
        const dx = e.clientX - this.pointerLast.x;
        const dy = e.clientY - this.pointerLast.y;
        const vx = dx / dt;
        const vy = dy / dt;

        this.pointerLast = { x: e.clientX, y: e.clientY, time: now, vx, vy };

        const totalDist = Math.hypot(e.clientX - this.pointerStart.x, e.clientY - this.pointerStart.y);

        if (totalDist > CONSTANTS.strokeThreshold) {
          clearTimeout(this.holdTimer);
          this.isStroking = true;
          this.engine.triggerStrokePet(1);
        }
      }

      // Gaze Tracking follows pointer
      if (!this.engine.isSleeping && this.char.activeMood === 'neutral') {
        const rect = canvas.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const gx = (e.clientX - cx) / (rect.width * 0.5);
        const gy = (e.clientY - cy) / (rect.height * 0.5);
        this.char.tgt.eyeGazeX = Math.max(-1.0, Math.min(1.0, gx));
        this.char.tgt.eyeGazeY = Math.max(-1.0, Math.min(1.0, gy));
      }
    });

    const finishPointer = (e) => {
      if (!this.pointerDown) return;
      this.pointerDown = false;
      this.char.isInteracting = false;
      clearTimeout(this.holdTimer);

      if (this.engine.isControlsMode) return;

      const duration = performance.now() - this.pointerStart.time;
      const totalDist = Math.hypot(e.clientX - this.pointerStart.x, e.clientY - this.pointerStart.y);
      const releaseSpeed = Math.hypot(this.pointerLast.vx || 0, this.pointerLast.vy || 0);

      // 1. Quick Flick Gesture: High release velocity
      if (releaseSpeed > CONSTANTS.flickVelocityThreshold && totalDist > 30) {
        this.engine.run('flick');
        return;
      }

      // 2. Stroke End: Drag petting release
      if (this.isStroking) {
        this.engine.endStrokePet();
        return;
      }

      // 3. Hold Pet was triggered
      if (this.isHeld) {
        this.isHeld = false;
        return;
      }

      // 4. Tap: Short click with minimal movement
      if (duration < 420 && totalDist < 22) {
        if (this.hitZone === 'earL' || this.hitZone === 'earR') {
          this.engine.run('tapEar');
        } else if (this.hitZone === 'tail') {
          this.engine.run('tapTail');
        } else {
          this.engine.run('tap');
        }
      }
    };

    canvas.addEventListener('pointerup', finishPointer);
    canvas.addEventListener('pointercancel', finishPointer);
    canvas.addEventListener('pointerleave', (e) => {
      if (this.pointerDown) finishPointer(e);
      this.char.tgt.eyeGazeX = 0;
      this.char.tgt.eyeGazeY = 0;
      this.char.btnHover = { PREV: false, PLAY: false, NEXT: false };
    });
  }

  // --- Desktop Keyboard Shortcuts for Quick Testing ---

  _bindKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        this.engine.run('shake');
      } else if (key === 'f') {
        e.preventDefault();
        this.engine.run('flip');
      } else if (key === 'l') {
        e.preventDefault();
        this.engine.run('tiltL');
      } else if (key === 'r') {
        e.preventDefault();
        this.engine.run('tiltR');
      } else if (key === 'z') {
        e.preventDefault();
        this.engine.run(this.engine.isSleeping ? 'wakeHappy' : 'sleep');
      } else if (key === ' ' || key === 'enter') {
        e.preventDefault();
        this.engine.run('tap');
      } else if (key === 'p') {
        e.preventDefault();
        this.engine.run('pet');
      }
    });
  }
}
