/**
 * sensors.js — Hardware Device Sensors & Touch/Pointer Interaction Manager.
 * Handles:
 * - Real DeviceMotionEvent shake detection with acceleration threshold
 * - DeviceOrientationEvent tilt (left/right tilt & flip)
 * - iOS 13+ permission request button
 * - Touch & Pointer interactions: Poke (tap) vs Pet (hold), gaze following, and Controls zone clicks.
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

    // Pointer hold tracking
    this.holdTimer = null;
    this.isHeld = false;
    this.pointerDownPos = { x: 0, y: 0 };

    this._bindPointerEvents();
    this._bindKeyboardEvents();
  }

  // --- Hardware Sensors (devicemotion & deviceorientation) ---

  async requestMotionPermissions() {
    try {
      // iOS 13+ requires explicit permission request via user gesture
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
      this.updateStatus('Sensors Active: Shake & Tilt your phone!');
      return true;
    } catch (err) {
      console.warn('[SensorManager] Sensor activation error:', err);
      this.updateStatus('Sensors not available (desktop/unsupported)');
      return false;
    }
  }

  _enableListeners() {
    // 1. Shake Detection via devicemotion
    window.addEventListener('devicemotion', (e) => {
      const acc = e.accelerationIncludingGravity || e.acceleration;
      if (!acc) return;

      const mag = Math.hypot(acc.x || 0, acc.y || 0, acc.z || 0);
      const now = Date.now();

      // Standard gravity is ~9.8 m/s^2; delta > 14 indicates deliberate shake
      if (Math.abs(mag - 9.8) > CONSTANTS.shakeThreshold && now > this.shakeCooldown) {
        this.shakeCooldown = now + 3200; // Cooldown to avoid re-triggering during shake
        this.engine.run('shake');
      }
    });

    // 2. Tilt & Flip Detection via deviceorientation
    window.addEventListener('deviceorientation', (e) => {
      if (this.engine.isSleeping || this.engine.isControlsMode) return;
      const gamma = e.gamma || 0; // Roll: Left (-90) to Right (+90)
      const beta = e.beta || 0;   // Pitch: Flat (0) to Vertical (90) to Upside Down (180/-180)
      const now = Date.now();

      // Flip (Upside Down Detection)
      if (Math.abs(beta) > 140 && now > this.tiltCooldown) {
        this.tiltCooldown = now + 4000;
        this.engine.run('flip');
        return;
      }

      // Strong Tilt Threshold Triggers
      if (gamma < -28 && now > this.tiltCooldown) {
        this.tiltCooldown = now + 2500;
        this.engine.run('tiltL');
        return;
      } else if (gamma > 28 && now > this.tiltCooldown) {
        this.tiltCooldown = now + 2500;
        this.engine.run('tiltR');
        return;
      }

      // Smooth Ambient Gaze & Lean when idle
      if (!this.engine.currentActionName || this.engine.currentActionName === 'neutral') {
        const leanFactor = Math.max(-1.0, Math.min(1.0, gamma / 35.0));
        this.char.tgt.bodyTilt = leanFactor * 8.0;
        this.char.tgt.eyeGazeX = leanFactor * 0.6;
      }
    });
  }

  // --- Touch & Pointer Interactions (Tap vs Pet) ---

  _bindPointerEvents() {
    const canvas = this.canvas;

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.pointerDownPos = { x: e.clientX, y: e.clientY };

      // Check if clicking in Controls mode
      if (this.engine.isControlsMode) {
        const zone = this.char.getControlZoneAt(e.clientX, e.clientY);
        if (zone) {
          this.engine.handleControlClick(zone);
          return;
        }
      }

      // Character mode: Start hold timer for Petting
      this.isHeld = false;
      clearTimeout(this.holdTimer);
      this.holdTimer = setTimeout(() => {
        this.isHeld = true;
        this.engine.run('pet');
      }, CONSTANTS.petHoldThreshold);
    });

    canvas.addEventListener('pointerup', (e) => {
      clearTimeout(this.holdTimer);

      // In controls mode, click was handled on pointerdown
      if (this.engine.isControlsMode) return;

      // If released before threshold, trigger Poke (tap)
      if (!this.isHeld) {
        this.engine.run('tap');
      }
      this.isHeld = false;
    });

    canvas.addEventListener('pointerleave', () => {
      clearTimeout(this.holdTimer);
      this.isHeld = false;
      this.char.tgt.eyeGazeX = 0;
      this.char.tgt.eyeGazeY = 0;
      this.char.btnHover = { PREV: false, PLAY: false, NEXT: false };
    });

    // Eye Gaze Tracking follows pointer on screen
    window.addEventListener('pointermove', (e) => {
      if (this.sensorsActive || this.engine.isSleeping) return;

      if (this.engine.isControlsMode) {
        const zone = this.char.getControlZoneAt(e.clientX, e.clientY);
        this.char.btnHover = {
          PREV: zone === 'PREV',
          PLAY: zone === 'PLAY',
          NEXT: zone === 'NEXT',
        };
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = (e.clientX - cx) / (window.innerWidth * 0.5);
      const dy = (e.clientY - cy) / (window.innerHeight * 0.5);

      if (this.char.activeMood === 'neutral') {
        this.char.tgt.eyeGazeX = Math.max(-1.0, Math.min(1.0, dx));
        this.char.tgt.eyeGazeY = Math.max(-1.0, Math.min(1.0, dy));
      }
    });
  }

  _bindKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.engine.run('tap');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.engine.run('shake');
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        this.engine.run('pet');
      }
    });
  }
}
