/**
 * character.js — Full HTML5 Canvas 2D Character Engine.
 * Faithfully ports the Physical AI Companion anatomy from PySide6:
 * - Sky-blue chassis with head highlight, amber ear nubs with mint LEDs
 * - Creamy belly patch, pulsing ruby heart gem, rosy blush cheeks
 * - Deep sapphire eyes with specular shine sparkles & happy ^ ^ crescents, heart & spiral eyes
 * - Animated mouth with tongue, mitten hands with waving/flailing, boots with glowing sole treads
 * - 3-Zone Shake-to-Controls morph layout with touch hit-testing.
 */

import { BASE_STATE, CONSTANTS, MOODS } from './moods.js';

export class CompanionCharacter {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Motion preference
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Current and Target Pose Parameters
    this.cur = { ...BASE_STATE };
    this.tgt = { ...BASE_STATE };
    this.activeMood = 'neutral';

    // Blinking State
    this.blinkScale = 1.0;
    this.isBlinking = false;
    this._startBlinkLoop();

    // Controls Button Spring Scales
    this.btnScales = { PREV: 1.0, PLAY: 1.0, NEXT: 1.0 };
    this.btnHover = { PREV: false, PLAY: false, NEXT: false };

    // Layout Dimensions (Virtual 360x360 coordinate system)
    this.VIRTUAL_SIZE = 360;
    this.dpr = window.devicePixelRatio || 1;
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());

    // Animation Loop
    this.lastTime = performance.now();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  _resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const cssSize = Math.min(rect.width || 340, rect.height || 340);
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = cssSize * this.dpr;
    this.canvas.height = cssSize * this.dpr;
    this.scaleFactor = (cssSize * this.dpr) / this.VIRTUAL_SIZE;
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
        if (this.activeMood !== 'sleepy' || Math.random() < 0.25) {
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

  animate(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this._updatePhysics(dt, now);
    this._render(now);

    requestAnimationFrame(this.animate);
  }

  _updatePhysics(dt, now) {
    const cur = this.cur;
    const tgt = this.tgt;

    // 1. Torso & Body Spring Physics
    const kBody = 1 - Math.exp(-dt * CONSTANTS.bodySpring);
    for (const key of ['bodyScaleX', 'bodyScaleY', 'bodyOffsetY', 'bodyTilt', 'bodyWobble', 'morphProgress', 'breathSpeed', 'corePulse', 'blushOpacity']) {
      cur[key] += (tgt[key] - cur[key]) * kBody;
    }

    // 2. Eyes & Gaze Spring Physics
    const kEye = 1 - Math.exp(-dt * CONSTANTS.eyeSpring);
    for (const key of ['eyeWidth', 'eyeHeight', 'eyeOpenL', 'eyeOpenR', 'eyeGazeX', 'eyeGazeY', 'shineOpacity', 'eyebrowSlant', 'mouthOpen', 'mouthWidth', 'mouthCurve']) {
      cur[key] += (tgt[key] - cur[key]) * kEye;
    }
    cur.eyeShape = tgt.eyeShape;
    cur.mouthStyle = tgt.mouthStyle;
    cur.coreColor = tgt.coreColor;
    cur.isWaving = tgt.isWaving;
    cur.isFlailing = tgt.isFlailing;
    cur.footWiggle = tgt.footWiggle;
    cur.zzz = tgt.zzz;
    cur.sweat = tgt.sweat;
    cur.hearts = tgt.hearts;
    cur.sparks = tgt.sparks;

    // 3. Limbs Follow-Through Lag (Hands and feet lag slightly behind)
    const kHand = 1 - Math.exp(-dt * CONSTANTS.handSpring);
    for (const key of ['leftHandX', 'leftHandY', 'leftHandRot', 'rightHandX', 'rightHandY', 'rightHandRot', 'leftFootY', 'rightFootY']) {
      cur[key] += (tgt[key] - cur[key]) * kHand;
    }

    // 4. Blink Easing
    const targetBlink = this.isBlinking ? 0.08 : 1.0;
    this.blinkScale += (targetBlink - this.blinkScale) * (1 - Math.exp(-dt * CONSTANTS.blinkSpeed));

    // 5. Button Spring Release
    for (const key in this.btnScales) {
      if (this.btnScales[key] < 1.0) {
        this.btnScales[key] += (1.0 - this.btnScales[key]) * 0.22;
        if (Math.abs(1.0 - this.btnScales[key]) < 0.01) this.btnScales[key] = 1.0;
      }
    }
  }

  // --- Rendering Pipeline ---

  _render(t) {
    const ctx = this.ctx;
    const S = this.VIRTUAL_SIZE;
    const cx = S / 2;
    const cy = S / 2;

    ctx.save();
    ctx.scale(this.scaleFactor, this.scaleFactor);
    ctx.clearRect(0, 0, S, S);

    // 1. Outer Ceramic Bezel & Display Screen
    this._drawBezel(ctx, S);

    const morph = this.cur.morphProgress;

    // 2. Render Living Character (opacity = 1 - morph)
    if (morph < 0.99) {
      ctx.save();
      ctx.globalAlpha = 1.0 - morph;
      this._drawCharacter(ctx, cx, cy, S, t);
      ctx.restore();
    }

    // 3. Render 3-Zone Shake-to-Controls (opacity = morph)
    if (morph > 0.01) {
      ctx.save();
      ctx.globalAlpha = morph;
      this._drawControls(ctx, cx, cy, S);
      ctx.restore();
    }

    ctx.restore();
  }

  _drawBezel(ctx, S) {
    const margin = 8;
    const cornerR = 44;

    // Outer Porcelain Ceramic Casing
    ctx.beginPath();
    ctx.roundRect(margin, margin, S - margin * 2, S - margin * 2, cornerR);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();

    // Inner Light Display Screen Surface
    const screenM = 18;
    const screenW = S - screenM * 2;
    const screenH = S - screenM * 2;
    ctx.beginPath();
    ctx.roundRect(screenM, screenM, screenW, screenH, cornerR - 8);
    const screenGrad = ctx.createLinearGradient(0, screenM, 0, screenM + screenH);
    screenGrad.addColorStop(0, '#FFFFFF');
    screenGrad.addColorStop(1, '#F1F5F9');
    ctx.fillStyle = screenGrad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#E2E8F0';
    ctx.stroke();
  }

  _drawCharacter(ctx, cx, cy, S, t) {
    const cur = this.cur;

    // Continuous Procedural Cycles
    const breathT = (t / 1000) * cur.breathSpeed * Math.PI * 1.5;
    const breath = Math.sin(breathT) * cur.breathAmp;
    const wobble = (!this.reduceMotion && cur.bodyWobble > 0.1) ? Math.sin(t / 25) * cur.bodyWobble : 0;

    const bodyW = S * 0.46;
    const bodyH = S * 0.48;
    const bodyCy = cy + 12 + cur.bodyOffsetY + breath;
    const totalTilt = cur.bodyTilt + (wobble * 0.4);

    ctx.save();
    // Tilt & Squash/Stretch Pivot around body center
    ctx.translate(cx + wobble, bodyCy);
    ctx.rotate((totalTilt * Math.PI) / 180);
    ctx.scale(cur.bodyScaleX, cur.bodyScaleY);
    ctx.translate(-cx, -bodyCy);

    // 1. Ear Caps / Headphone nubs (behind torso)
    this._drawEarNubs(ctx, cx, bodyCy, bodyW, bodyH);

    // 2. Feet & Boots (behind torso)
    this._drawFeet(ctx, cx, bodyCy, bodyW, bodyH, t);

    // 3. Body Chassis (Torso)
    this._drawBodyChassis(ctx, cx, bodyCy, bodyW, bodyH);

    // 4. Belly Patch (Creamy tummy)
    this._drawBellyPatch(ctx, cx, bodyCy, bodyW, bodyH);

    // 5. Chest Core (Pulsing Ruby Heart Gem)
    this._drawChestCore(ctx, cx, bodyCy, bodyH, t);

    // 6. Rosy Cheeks (Blush)
    this._drawCheeks(ctx, cx, bodyCy, bodyW, bodyH);

    // 7. Expressive Soulful Eyes
    this._drawEyes(ctx, cx, bodyCy, bodyW, bodyH, t);

    // 8. Expressive Mouth
    this._drawMouth(ctx, cx, bodyCy, bodyH, t);

    // 9. Hands & Mitten Arms
    this._drawHands(ctx, cx, bodyCy, bodyW, bodyH, t);

    // 10. Emotion Overlays (Zzz, Sweat, Hearts, Sparks)
    this._drawEmotionParticles(ctx, cx, bodyCy, bodyW, bodyH, t);

    ctx.restore();
  }

  _drawEarNubs(ctx, cx, bodyCy, bodyW, bodyH) {
    const earW = 9.0;
    const earH = 24.0;
    const ey = bodyCy - bodyH * 0.12;

    for (const [isLeft, ex] of [[true, cx - bodyW * 0.5 - earW + 3], [false, cx + bodyW * 0.5 - 3]]) {
      ctx.beginPath();
      ctx.roundRect(ex, ey - earH / 2, earW, earH, 4.5);
      const grad = ctx.createLinearGradient(ex, ey - earH / 2, ex, ey + earH / 2);
      grad.addColorStop(0, '#FBBF24');
      grad.addColorStop(1, '#F59E0B');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#D97706';
      ctx.stroke();

      // Glowing mint center LED dot
      ctx.beginPath();
      ctx.arc(ex + earW / 2, ey, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#10B981';
      ctx.fill();
    }
  }

  _drawFeet(ctx, cx, bodyCy, bodyW, bodyH, t) {
    const footW = 46.0;
    const footH = 26.0;
    const baseY = bodyCy + bodyH * 0.5 - 2;

    const wiggleL = (this.cur.footWiggle && !this.reduceMotion) ? Math.sin(t / 80) * 4.0 : 0;
    const wiggleR = (this.cur.footWiggle && !this.reduceMotion) ? Math.cos(t / 80) * 4.0 : 0;

    for (const [isLeft, fx, liftY] of [
      [true, cx - bodyW * 0.25 - footW / 2, this.cur.leftFootY + wiggleL],
      [false, cx + bodyW * 0.25 - footW / 2, this.cur.rightFootY + wiggleR],
    ]) {
      const fy = baseY - liftY;
      ctx.beginPath();
      ctx.roundRect(fx, fy, footW, footH, 11);
      const grad = ctx.createLinearGradient(fx, fy, fx, fy + footH);
      grad.addColorStop(0, '#0284C7');
      grad.addColorStop(1, '#0369A1');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0284C7';
      ctx.stroke();

      // Glowing white sole tread
      ctx.beginPath();
      ctx.moveTo(fx + 6, fy + footH - 3);
      ctx.lineTo(fx + footW - 6, fy + footH - 3);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    }
  }

  _drawBodyChassis(ctx, cx, bodyCy, bodyW, bodyH) {
    const bx = cx - bodyW / 2;
    const by = bodyCy - bodyH / 2;
    const cornerR = 46;

    // Ambient soft shadow on light screen
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, bodyCy + bodyH * 0.46, bodyW * 0.52, bodyH * 0.16, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.fill();
    ctx.restore();

    // Body Chassis: Vibrant Sky-Blue gradient
    ctx.beginPath();
    ctx.roundRect(bx, by, bodyW, bodyH, cornerR);
    const grad = ctx.createLinearGradient(cx, by, cx, by + bodyH);
    grad.addColorStop(0, '#38BDF8');   // Bright sky cyan
    grad.addColorStop(0.4, '#0EA5E9'); // Electric sky blue
    grad.addColorStop(1, '#0284C7');   // Royal cyan base
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0369A1';
    ctx.stroke();

    // Glossy curved head highlight arc
    ctx.beginPath();
    ctx.ellipse(cx, by + 18, bodyW * 0.34, 10, 0, Math.PI * 1.15, Math.PI * 1.85);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.stroke();
  }

  _drawBellyPatch(ctx, cx, bodyCy, bodyW, bodyH) {
    const bellyW = bodyW * 0.64;
    const bellyH = bodyH * 0.36;
    const bellyCy = bodyCy + bodyH * 0.25;

    ctx.beginPath();
    ctx.roundRect(cx - bellyW / 2, bellyCy - bellyH / 2, bellyW, bellyH, 22);
    const grad = ctx.createLinearGradient(cx, bellyCy - bellyH / 2, cx, bellyCy + bellyH / 2);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(1, '#F0F9FF');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#BAE6FD';
    ctx.stroke();
  }

  _drawChestCore(ctx, cx, bodyCy, bodyH, t) {
    const coreCy = bodyCy + bodyH * 0.25;
    const pulseAnim = (!this.reduceMotion) ? Math.sin((t / 1000) * 3.5) * 0.15 : 0;
    const pulse = Math.max(0.7, this.cur.corePulse + pulseAnim);

    const coreW = 22.0 * pulse;
    const coreH = 12.0 * pulse;

    // Glowing rosy pulse halo
    ctx.beginPath();
    ctx.arc(cx, coreCy, 16.0 * pulse, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(cx, coreCy, 0, cx, coreCy, 16.0 * pulse);
    glow.addColorStop(0, 'rgba(255, 107, 139, 0.6)');
    glow.addColorStop(0.7, 'rgba(244, 63, 94, 0.18)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fill();

    // Ruby Gem Node
    ctx.beginPath();
    ctx.roundRect(cx - coreW / 2, coreCy - coreH / 2, coreW, coreH, 6.0);
    const grad = ctx.createLinearGradient(cx - coreW / 2, coreCy, cx + coreW / 2, coreCy);
    grad.addColorStop(0, '#FF6B8B');
    grad.addColorStop(1, '#F43F5E');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.stroke();

    // Specular highlight sparkle
    ctx.beginPath();
    ctx.arc(cx - 3, coreCy - 2, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  }

  _drawCheeks(ctx, cx, bodyCy, bodyW, bodyH) {
    const cur = this.cur;
    if (cur.blushOpacity <= 0.05) return;

    const eyeSpacing = bodyW * 0.22;
    const cheekY = bodyCy - bodyH * 0.20 + 26;
    const cw = 16.0;
    const ch = 8.5;

    ctx.save();
    ctx.globalAlpha = cur.blushOpacity;
    for (const side of [-1, 1]) {
      const x = cx + side * (eyeSpacing + 12);
      ctx.beginPath();
      ctx.ellipse(x, cheekY, cw / 2, ch / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#FB7185';
      ctx.fill();
    }
    ctx.restore();
  }

  _drawEyes(ctx, cx, bodyCy, bodyW, bodyH, t) {
    const cur = this.cur;
    const eyeW = cur.eyeWidth;
    const eyeH = cur.eyeHeight * this.blinkScale;
    const eyeSpacing = bodyW * 0.20;
    const eyeCy = bodyCy - bodyH * 0.20 + cur.eyeGazeY * 5.0;

    const maxGaze = eyeW * 0.38;
    const gazeX = cur.eyeGazeX * maxGaze;

    for (const [isLeft, openness] of [[true, cur.eyeOpenL], [false, cur.eyeOpenR]]) {
      const side = isLeft ? -1 : 1;
      const eyeX = cx + side * (eyeSpacing + eyeW / 2) + gazeX;
      const currH = Math.max(3.0, eyeH * openness);
      const topY = eyeCy - currH / 2;

      // 1. Happy Crescent Eyes ^ ^
      if (cur.eyeShape === 'crescent' && this.blinkScale > 0.4) {
        ctx.beginPath();
        const arcW = eyeW * 0.88;
        ctx.moveTo(eyeX - arcW / 2, eyeCy + 2);
        ctx.quadraticCurveTo(eyeX, eyeCy - 11, eyeX + arcW / 2, eyeCy + 2);
        ctx.lineWidth = 3.4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0F172A';
        ctx.stroke();
        continue;
      }

      // 2. Love Heart Eyes ❤️
      if (cur.eyeShape === 'heart' && this.blinkScale > 0.4) {
        ctx.save();
        ctx.translate(eyeX, eyeCy);
        const heartScale = (1.2 + Math.sin(t / 150) * 0.15);
        ctx.scale(heartScale, heartScale);
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.bezierCurveTo(-10, -5, -8, -14, 0, -8);
        ctx.bezierCurveTo(8, -14, 10, -5, 0, 5);
        ctx.fillStyle = '#F43F5E';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();
        ctx.restore();
        continue;
      }

      // 3. Dizzy Spiral Eyes 🌀
      if (cur.eyeShape === 'spiral' && this.blinkScale > 0.4) {
        ctx.save();
        ctx.translate(eyeX, eyeCy);
        const rot = (t / 80) * (isLeft ? 1 : -1);
        ctx.rotate(rot);
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 4; a += 0.2) {
          const r = 1.2 * a;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0284C7';
        ctx.stroke();
        ctx.restore();
        continue;
      }

      // 4. Default / Surprised / Squint Capsule Eyes with Deep Sapphire & Specular Highlights
      ctx.beginPath();
      ctx.roundRect(eyeX - eyeW / 2, topY, eyeW, currH, Math.min(eyeW, currH) / 2);
      const grad = ctx.createLinearGradient(eyeX - eyeW / 2, topY, eyeX - eyeW / 2, topY + currH);
      if (cur.eyeShape === 'squint') {
        grad.addColorStop(0, '#1E293B');
        grad.addColorStop(1, '#EF4444');
      } else {
        grad.addColorStop(0, '#0F172A');
        grad.addColorStop(1, '#1E3A8A');
      }
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#0EA5E9';
      ctx.stroke();

      // Specular Reflection Highlights (The Pixar Spark!)
      if (this.blinkScale > 0.4 && cur.shineOpacity > 0.05 && cur.eyeShape !== 'squint') {
        ctx.save();
        ctx.globalAlpha = cur.shineOpacity;

        // Primary reflection highlight (top-left)
        ctx.beginPath();
        ctx.arc(eyeX - eyeW * 0.20, eyeCy - currH * 0.20, 3.6, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        // Secondary sparkle dot (bottom-right)
        ctx.beginPath();
        ctx.arc(eyeX + eyeW * 0.18, eyeCy + currH * 0.16, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  _drawMouth(ctx, cx, bodyCy, bodyH, t) {
    const cur = this.cur;
    const mouthCy = bodyCy - bodyH * 0.20 + 36;
    const mouthCx = cx + cur.eyeGazeX * 4.0;
    const mw = cur.mouthWidth;

    ctx.save();
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#E11D48';

    if (cur.mouthStyle === 'talking' || cur.mouthOpen > 0.4) {
      // Open animated cavity with soft pink tongue
      const flap = (!this.reduceMotion && cur.mouthStyle === 'talking') ? Math.abs(Math.sin(t / 80)) * 4.0 : 0;
      const mh = Math.max(5.0, 13.0 * cur.mouthOpen + flap);

      ctx.beginPath();
      ctx.roundRect(mouthCx - mw / 2, mouthCy - mh / 2, mw, mh, mh / 2);
      ctx.fillStyle = '#881337'; // Deep cherry cavity
      ctx.fill();
      ctx.stroke();

      // Pink Tongue
      ctx.beginPath();
      ctx.roundRect(mouthCx - mw * 0.28, mouthCy + mh * 0.08, mw * 0.56, mh * 0.42, 2.5);
      ctx.fillStyle = '#FDA4AF';
      ctx.fill();
    } else if (cur.mouthStyle === 'gasp') {
      // Surprised vertical O
      ctx.beginPath();
      ctx.ellipse(mouthCx, mouthCy, 5.5, 7.0, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#881337';
      ctx.fill();
      ctx.stroke();
    } else if (cur.mouthStyle === 'pout' || cur.mouthCurve < -0.2) {
      // Annoyed / grumpy flat line
      ctx.beginPath();
      ctx.moveTo(mouthCx - mw / 2, mouthCy + 1);
      ctx.lineTo(mouthCx + mw / 2, mouthCy + 1);
      ctx.stroke();
    } else if (cur.mouthStyle === 'cheeky') {
      // Cat / Smirk smirk arc
      ctx.beginPath();
      ctx.moveTo(mouthCx - mw * 0.4, mouthCy + 1);
      ctx.quadraticCurveTo(mouthCx, mouthCy + 5, mouthCx + mw * 0.5, mouthCy - 3);
      ctx.stroke();
    } else {
      // Cheerful gentle smile arc
      const depth = 5.0 * cur.mouthCurve;
      ctx.beginPath();
      ctx.moveTo(mouthCx - mw / 2, mouthCy - 2);
      ctx.quadraticCurveTo(mouthCx, mouthCy + depth, mouthCx + mw / 2, mouthCy - 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawHands(ctx, cx, bodyCy, bodyW, bodyH, t) {
    const cur = this.cur;
    const handW = 32.0;
    const handH = 44.0;

    // Hand Flailing oscillation
    const flailL = (cur.isFlailing && !this.reduceMotion) ? Math.sin(t / 50) * 25.0 : 0;
    const flailR = (cur.isFlailing && !this.reduceMotion) ? Math.cos(t / 50) * 25.0 : 0;

    // Left Hand (Pill mitten beside left hip)
    const lx = cx - bodyW * 0.54 - handW * 0.45 + cur.leftHandX;
    const ly = bodyCy + bodyH * 0.16 + cur.leftHandY + flailL;

    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate((cur.leftHandRot * Math.PI) / 180);
    ctx.beginPath();
    ctx.roundRect(-handW / 2, -handH / 2, handW, handH, handW / 2);
    const gradL = ctx.createLinearGradient(0, -handH / 2, 0, handH / 2);
    gradL.addColorStop(0, '#38BDF8');
    gradL.addColorStop(1, '#0284C7');
    ctx.fillStyle = gradL;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0369A1';
    ctx.stroke();

    // Left Palm Pad
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 2.0, 0, Math.PI * 2);
    ctx.fillStyle = '#FB7185';
    ctx.fill();
    ctx.restore();

    // Right Hand (Beside right hip or Waving)
    const rx = cx + bodyW * 0.54 + handW * 0.45 + cur.rightHandX;
    const ry = bodyCy + bodyH * 0.16 + cur.rightHandY + flailR;

    ctx.save();
    ctx.translate(rx, ry);
    const waveRot = (cur.isWaving && !this.reduceMotion) ? Math.sin(t / 80) * 22.0 : 0;
    ctx.rotate(((cur.rightHandRot + waveRot) * Math.PI) / 180);

    ctx.beginPath();
    ctx.roundRect(-handW / 2, -handH / 2, handW, handH, handW / 2);
    const gradR = ctx.createLinearGradient(0, -handH / 2, 0, handH / 2);
    gradR.addColorStop(0, '#38BDF8');
    gradR.addColorStop(1, '#0284C7');
    ctx.fillStyle = gradR;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0369A1';
    ctx.stroke();

    // Right Palm Pad
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 2.0, 0, Math.PI * 2);
    ctx.fillStyle = '#FB7185';
    ctx.fill();
    ctx.restore();
  }

  _drawEmotionParticles(ctx, cx, bodyCy, bodyW, bodyH, t) {
    const cur = this.cur;

    // 1. Floating Zzz (Sleepy)
    if (cur.zzz > 0.05) {
      ctx.save();
      ctx.globalAlpha = cur.zzz;
      ctx.fillStyle = '#0284C7';
      ctx.font = 'bold 22px Nunito, sans-serif';
      const bob = Math.sin(t / 400) * 4.0;
      ctx.fillText('z', cx + bodyW * 0.42, bodyCy - bodyH * 0.38 + bob);
      ctx.font = 'bold 15px Nunito, sans-serif';
      ctx.fillText('z', cx + bodyW * 0.55, bodyCy - bodyH * 0.50 - bob);
      ctx.restore();
    }

    // 2. Sweat Droplet (Dizzy, Annoyed, Sad)
    if (cur.sweat > 0.05) {
      ctx.save();
      ctx.globalAlpha = cur.sweat;
      const dropX = cx + bodyW * 0.45;
      const dropY = bodyCy - bodyH * 0.30 + Math.sin(t / 250) * 3.0;
      ctx.beginPath();
      ctx.moveTo(dropX, dropY - 8);
      ctx.bezierCurveTo(dropX + 5, dropY - 1, dropX + 5, dropY + 5, dropX, dropY + 5);
      ctx.bezierCurveTo(dropX - 5, dropY + 5, dropX - 5, dropY - 1, dropX, dropY - 8);
      ctx.fillStyle = '#38BDF8';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#0284C7';
      ctx.stroke();
      ctx.restore();
    }

    // 3. Floating Hearts (Love)
    if (cur.hearts > 0.05) {
      ctx.save();
      ctx.globalAlpha = cur.hearts;
      const hx = cx + bodyW * 0.42 + Math.cos(t / 300) * 4.0;
      const hy = bodyCy - bodyH * 0.38 - Math.sin(t / 300) * 4.0;
      ctx.translate(hx, hy);
      ctx.scale(1.2, 1.2);
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.bezierCurveTo(-6, -3, -5, -9, 0, -5);
      ctx.bezierCurveTo(5, -9, 6, -3, 0, 4);
      ctx.fillStyle = '#F43F5E';
      ctx.fill();
      ctx.restore();
    }

    // 4. Star Sparkles (Excited)
    if (cur.sparks > 0.05) {
      ctx.save();
      ctx.globalAlpha = cur.sparks;
      for (const [px, py, s] of [[cx - bodyW * 0.44, bodyCy - bodyH * 0.34, 1.0], [cx + bodyW * 0.44, bodyCy - bodyH * 0.38, 0.8]]) {
        ctx.save();
        ctx.translate(px, py);
        const rot = (t / 200);
        ctx.rotate(rot);
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          ctx.lineTo(Math.cos((i * Math.PI) / 2) * 8 * s, Math.sin((i * Math.PI) / 2) * 8 * s);
          ctx.lineTo(Math.cos((i * Math.PI) / 2 + Math.PI / 4) * 3 * s, Math.sin((i * Math.PI) / 2 + Math.PI / 4) * 3 * s);
        }
        ctx.closePath();
        ctx.fillStyle = '#FBBF24';
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
  }

  // --- 3-Zone Shake-to-Controls Layout ---

  _drawControls(ctx, cx, cy, S) {
    const btnW = 68;
    const btnH = 68;
    const offset = 92;

    const zones = [
      { id: 'PREV', label: 'PREV', icon: '⏮', x: cx - offset, y: cy + 18 },
      { id: 'PLAY', label: 'PLAY', icon: '⏯', x: cx, y: cy + 18 },
      { id: 'NEXT', label: 'NEXT', icon: '⏭', x: cx + offset, y: cy + 18 },
    ];

    ctx.save();
    // Header
    ctx.font = 'bold 13px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0284C7';
    ctx.fillText('SHAKE TO CONTROL', cx, cy - 64);

    for (const z of zones) {
      const scale = this.btnScales[z.id];
      const isHov = this.btnHover[z.id];
      const bw = btnW * scale;
      const bh = btnH * scale;

      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.beginPath();
      ctx.roundRect(-bw / 2, -bh / 2, bw, bh, bw / 2);

      if (isHov) {
        ctx.fillStyle = '#F0F9FF';
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#0284C7';
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.lineWidth = 2.0;
        ctx.strokeStyle = '#CBD5E1';
      }
      ctx.fill();
      ctx.stroke();

      // Icon
      ctx.font = 'bold 22px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0F172A';
      ctx.fillText(z.icon, 0, 0);

      // Label beneath
      ctx.font = 'bold 10px Nunito, sans-serif';
      ctx.fillStyle = '#64748B';
      ctx.fillText(z.label, 0, bh / 2 + 14);
      ctx.restore();
    }

    ctx.restore();
  }

  getControlZoneAt(screenX, screenY) {
    if (this.cur.morphProgress < 0.3) return null;

    const rect = this.canvas.getBoundingClientRect();
    const x = (screenX - rect.left) / this.scaleFactor;
    const y = (screenY - rect.top) / this.scaleFactor;

    const cx = this.VIRTUAL_SIZE / 2;
    const cy = this.VIRTUAL_SIZE / 2;
    const offset = 92;
    const radius = 38;

    const zones = [
      { id: 'PREV', x: cx - offset, y: cy + 18 },
      { id: 'PLAY', x: cx, y: cy + 18 },
      { id: 'NEXT', x: cx + offset, y: cy + 18 },
    ];

    for (const z of zones) {
      const dist = Math.hypot(x - z.x, y - z.y);
      if (dist <= radius) return z.id;
    }
    return null;
  }
}
