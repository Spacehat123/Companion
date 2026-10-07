/**
 * web/species/fox.js — Fox-Spirit Cub (Kitsune) Visual Representation & Anatomy.
 * 
 * Implements full procedural Canvas 2D drawing:
 * - Big rounded head with soft cheek tufts and warm orange/cream palette
 * - Independently driven expressive fox ears (perked, flat, droopy, one-up-one-down)
 * - 5-segment spring-chain tail with follow-through (wag, puff, curl, swish)
 * - Glowing kitsune forehead crest with dynamic spirit pulse
 * - Tail tip celestial sparkle shimmer
 * - Ambient floating kitsune-bi spirit wisps with physics
 * - Huge glossy eyes with specular glints & mood shapes
 * - Pure Canvas vector emotes (!, ?, heart, music, sparkle, zzz) — zero font emoji!
 * - Accurate hit-testing for direct touch (ears, tail, head, body)
 */

export class FoxSpecies {
  constructor() {
    this.name = 'kitsune';

    // Ambient floating wisps (kitsune-bi)
    this.wisps = [
      { angle: 0.0, dist: 140, speed: 0.9, yOffset: -20, radius: 5.5, color: '#FFD166', pulse: 0 },
      { angle: 1.8, dist: 125, speed: -1.1, yOffset: 30, radius: 4.5, color: '#38BDF8', pulse: 1.2 },
      { angle: 3.5, dist: 155, speed: 0.7, yOffset: -50, radius: 6.0, color: '#F472B6', pulse: 2.4 },
      { angle: 4.9, dist: 130, speed: -0.85, yOffset: 10, radius: 5.0, color: '#FFE066', pulse: 3.6 },
    ];

    // Tail spring chain state (5 segments from base to tip)
    this.tailSegments = [
      { x: 0, y: 0, angle: 0 },
      { x: 0, y: 0, angle: 0 },
      { x: 0, y: 0, angle: 0 },
      { x: 0, y: 0, angle: 0 },
      { x: 0, y: 0, angle: 0 },
    ];

    // Sneeze wisp burst state
    this.sneezeBurst = null;
  }

  /**
   * Update internal physics like tail follow-through, wisps, and particles.
   */
  updatePhysics(dt, cur, now) {
    // 1. Update Tail Spring Chain
    // Base originates near back-right of body
    const baseAngle = (cur.tailAngle || 0) * (Math.PI / 180);
    const wagPhase = (now * 0.006 * (cur.tailWagSpeed || 1.0));
    const wagOffset = Math.sin(wagPhase) * (cur.tailWagAmp || 0.25);
    const curl = (cur.tailCurl || 0) * (Math.PI / 180);

    let targetAngle = baseAngle + wagOffset + curl;
    const segLen = 22 * (cur.tailPuff ? 1.15 : 1.0);

    for (let i = 0; i < this.tailSegments.length; i++) {
      const seg = this.tailSegments[i];
      const lag = 0.28 + i * 0.08; // progressive lag along tail
      seg.angle += (targetAngle - seg.angle) * (1 - Math.exp(-dt * 18 * lag));
      // Each subsequent segment adds progressive curve
      targetAngle = seg.angle + (curl * 0.35) + (wagOffset * 0.4);
    }

    // 2. Update Orbiting Wisps
    const speedMult = cur.wispSpeed || 1.0;
    for (const w of this.wisps) {
      w.angle += w.speed * dt * speedMult;
      w.pulse += dt * 3.0;
    }

    // 3. Update Sneeze Burst Particle if active
    if (this.sneezeBurst) {
      this.sneezeBurst.age += dt;
      this.sneezeBurst.x += this.sneezeBurst.vx * dt;
      this.sneezeBurst.y += this.sneezeBurst.vy * dt;
      this.sneezeBurst.alpha = Math.max(0, 1 - this.sneezeBurst.age / 1.2);
      if (this.sneezeBurst.age > 1.2) {
        this.sneezeBurst = null;
      }
    }
  }

  triggerSneezeWisp() {
    this.sneezeBurst = {
      x: 0,
      y: -25,
      vx: (Math.random() - 0.5) * 80 + 120,
      vy: -110 - Math.random() * 50,
      age: 0,
      alpha: 1.0,
      color: '#FFE066'
    };
  }

  /**
   * Main Render Entrypoint.
   * Coordinate space: 0,0 is the center of the creature stage (Virtual 360x360).
   */
  draw(ctx, cur, blinkScale, now) {
    ctx.save();

    // 1. Draw Ambient Background Wisps (Behind Fox)
    this._drawWisps(ctx, cur, now, false);

    // Apply creature master body transform
    const bodyBounce = Math.sin(now * 0.003 * cur.breathSpeed) * cur.breathAmp;
    const offsetY = (cur.bodyOffsetY || 0) + bodyBounce;
    const wobble = Math.sin(now * 0.04) * (cur.bodyWobble || 0);

    ctx.translate(wobble, offsetY);
    ctx.rotate((cur.bodyTilt || 0) * (Math.PI / 180));
    ctx.scale(cur.bodyScaleX || 1.0, cur.bodyScaleY || 1.0);

    // 2. Draw Fox Tail (Behind Body)
    this._drawTail(ctx, cur, now);

    // 3. Draw Body & Paws
    this._drawBody(ctx, cur, now);

    // 4. Draw Ears (Behind & on top of head base)
    this._drawEars(ctx, cur, now);

    // 5. Draw Head with Cheek Tufts & Muzzle
    this._drawHead(ctx, cur, now);

    // 6. Forehead Kitsune Spirit Mark
    this._drawForeheadMark(ctx, cur, now);

    // 7. Eyes with specular shine & mood shapes
    this._drawEyes(ctx, cur, blinkScale, now);

    // 8. Nose, Mouth, & Blush
    this._drawFaceDetails(ctx, cur, now);

    // 9. Floating Vector Emotes (!, ?, heart, music, zzz, etc.)
    this._drawEmote(ctx, cur, now);

    ctx.restore();

    // 10. Draw Foreground Wisps & Sneeze Burst (In front of Fox)
    this._drawWisps(ctx, cur, now, true);
    if (this.sneezeBurst) {
      this._drawSneezeBurst(ctx, now);
    }
  }

  // --- Detailed Anatomy Drawing Methods ---

  _drawWisps(ctx, cur, now, inFront) {
    ctx.save();
    for (const w of this.wisps) {
      // Depth check: wisps with positive sin(angle) are in front
      const isFront = Math.sin(w.angle) > 0;
      if (isFront !== inFront) continue;

      const x = Math.cos(w.angle) * w.dist;
      const z = Math.sin(w.angle);
      const y = w.yOffset + z * 24 + Math.sin(w.pulse) * 6;
      const size = w.radius * (0.8 + 0.3 * (z + 1));
      const glowSize = size * 3.5;

      // Glow halo
      const grad = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
      grad.addColorStop(0, w.color);
      grad.addColorStop(0.4, w.color + '66');
      grad.addColorStop(1, 'rgba(255,255,255,0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, glowSize, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, y, size * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawSneezeBurst(ctx, now) {
    const b = this.sneezeBurst;
    ctx.save();
    ctx.globalAlpha = b.alpha;
    ctx.translate(b.x, b.y);

    // Sparkle star
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 22);
    grad.addColorStop(0, '#FFF59D');
    grad.addColorStop(0.5, 'rgba(255, 215, 0, 0.6)');
    grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    // 4-point star burst
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + (now * 0.005);
      const rOuter = 16;
      const rInner = 4;
      ctx.lineTo(Math.cos(a) * rOuter, Math.sin(a) * rOuter);
      ctx.lineTo(Math.cos(a + Math.PI / 4) * rInner, Math.sin(a + Math.PI / 4) * rInner);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawTail(ctx, cur, now) {
    ctx.save();
    // Tail originates from lower right of body
    const startX = 35;
    const startY = 48;
    ctx.translate(startX, startY);

    // Compute chain point coordinates
    const points = [{ x: 0, y: 0 }];
    const segLen = 22 * (cur.tailPuff ? 1.25 : 1.0);
    let curX = 0;
    let curY = 0;

    for (let i = 0; i < this.tailSegments.length; i++) {
      const seg = this.tailSegments[i];
      curX += Math.cos(seg.angle - Math.PI * 0.45) * segLen;
      curY += Math.sin(seg.angle - Math.PI * 0.45) * segLen;
      points.push({ x: curX, y: curY });
    }

    // Build fluffy fox tail shape along spine
    const tip = points[points.length - 1];
    const mid = points[Math.floor(points.length / 2)];

    // Tail width scales outward then tapers to fluffy tip
    const puff = cur.tailPuff ? 1.4 : 1.0;

    // Tail Base to Mid gradient
    const tailGrad = ctx.createLinearGradient(0, 0, tip.x, tip.y);
    tailGrad.addColorStop(0, '#E65A20');
    tailGrad.addColorStop(0.65, '#FF7A38');
    tailGrad.addColorStop(0.82, '#FFF0D4');
    tailGrad.addColorStop(1.0, '#FFFFFF');

    ctx.fillStyle = tailGrad;
    ctx.strokeStyle = '#D14810';
    ctx.lineWidth = 2.5;

    // Draw main organic tail silhouette
    ctx.beginPath();
    ctx.moveTo(points[0].x - 8, points[0].y);

    // Left fluff side
    ctx.bezierCurveTo(
      points[1].x - 22 * puff, points[1].y,
      mid.x - 34 * puff, mid.y,
      tip.x, tip.y
    );

    // Right fluff side
    ctx.bezierCurveTo(
      mid.x + 30 * puff, mid.y,
      points[1].x + 18 * puff, points[1].y,
      points[0].x + 12, points[0].y
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tail tip sparkles
    const sparkleAlpha = 0.5 + 0.5 * Math.sin(now * 0.008);
    ctx.fillStyle = `rgba(255, 235, 150, ${sparkleAlpha})`;
    this._drawSparkleStar(ctx, tip.x, tip.y, 8, now * 0.003);
    this._drawSparkleStar(ctx, tip.x - 6, tip.y + 8, 5, -now * 0.004);

    ctx.restore();
  }

  _drawSparkleStar(ctx, cx, cy, radius, rot) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      ctx.lineTo(Math.cos(a + Math.PI / 4) * (radius * 0.32), Math.sin(a + Math.PI / 4) * (radius * 0.32));
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawBody(ctx, cur, now) {
    ctx.save();
    // Body is a soft rounded bean shape centered beneath the head
    const bx = 0;
    const by = 52;
    const bw = 54;
    const bh = 50;

    // Body shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
    ctx.beginPath();
    ctx.ellipse(0, 88, 52, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main orange torso
    const bodyGrad = ctx.createLinearGradient(0, by - bh, 0, by + bh);
    bodyGrad.addColorStop(0, '#FF8A48');
    bodyGrad.addColorStop(1, '#E65A20');

    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = '#D14810';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.ellipse(bx, by, bw, bh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Fluffy cream chest ruff
    const chestGrad = ctx.createLinearGradient(0, by - 25, 0, by + 30);
    chestGrad.addColorStop(0, '#FFFFFF');
    chestGrad.addColorStop(1, '#FFF2DE');

    ctx.fillStyle = chestGrad;
    ctx.beginPath();
    ctx.moveTo(bx, by - 18);
    ctx.bezierCurveTo(bx - 32, by - 12, bx - 26, by + 26, bx, by + 34);
    ctx.bezierCurveTo(bx + 26, by + 26, bx + 32, by - 12, bx, by - 18);
    ctx.closePath();
    ctx.fill();

    // Tiny front paws (mitten bean paws)
    const pawY = 80;
    const pawWiggle = cur.pawWiggle ? Math.sin(now * 0.02) * 4 : 0;

    // Left Paw
    this._drawPaw(ctx, -24, pawY - pawWiggle);
    // Right Paw
    this._drawPaw(ctx, 24, pawY + pawWiggle);

    ctx.restore();
  }

  _drawPaw(ctx, px, py) {
    ctx.save();
    // Warm cream paw with subtle chocolate toe dips
    const pawGrad = ctx.createRadialGradient(px, py - 2, 2, px, py, 12);
    pawGrad.addColorStop(0, '#FFFFFF');
    pawGrad.addColorStop(0.75, '#FFF2DE');
    pawGrad.addColorStop(1, '#D99B75');

    ctx.fillStyle = pawGrad;
    ctx.strokeStyle = '#D14810';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.ellipse(px, py, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 3 subtle toe grooves
    ctx.strokeStyle = '#C9754C';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px - 4, py - 1);
    ctx.lineTo(px - 4, py + 6);
    ctx.moveTo(px + 4, py - 1);
    ctx.lineTo(px + 4, py + 6);
    ctx.stroke();

    ctx.restore();
  }

  _drawEars(ctx, cur, now) {
    // Left and Right ears are independently driven!
    // Ear parameters: earLRot, earRRot, earLFold, earRFold
    const lRot = (cur.earLRot !== undefined ? cur.earLRot : 0) * (Math.PI / 180);
    const rRot = (cur.earRRot !== undefined ? cur.earRRot : 0) * (Math.PI / 180);
    const lFold = cur.earLFold !== undefined ? cur.earLFold : 1.0;
    const rFold = cur.earRFold !== undefined ? cur.earRFold : 1.0;

    // Left Ear
    this._drawSingleEar(ctx, -56, -42, lRot - 0.28, lFold, true, now);
    // Right Ear
    this._drawSingleEar(ctx, 56, -42, rRot + 0.28, rFold, false, now);
  }

  _drawSingleEar(ctx, rootX, rootY, angle, fold, isLeft, now) {
    ctx.save();
    ctx.translate(rootX, rootY);
    ctx.rotate(angle);
    ctx.scale(isLeft ? 1 : -1, fold); // fold compresses ear vertically

    // Ear dimensions
    const ew = 38;
    const eh = 68;

    // Outer ear gradient
    const earGrad = ctx.createLinearGradient(0, 0, 0, -eh);
    earGrad.addColorStop(0, '#FF8A48');
    earGrad.addColorStop(0.7, '#E65A20');
    earGrad.addColorStop(1, '#3D231E'); // Dark chocolate tip

    ctx.fillStyle = earGrad;
    ctx.strokeStyle = '#D14810';
    ctx.lineWidth = 2.5;

    // Fox ear curved triangle
    ctx.beginPath();
    ctx.moveTo(-ew * 0.5, 0);
    ctx.bezierCurveTo(-ew * 0.45, -eh * 0.6, -ew * 0.2, -eh * 0.95, 0, -eh);
    ctx.bezierCurveTo(ew * 0.2, -eh * 0.95, ew * 0.6, -eh * 0.5, ew * 0.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner fluffy ear cream lining
    const innerGrad = ctx.createLinearGradient(0, 0, 0, -eh * 0.75);
    innerGrad.addColorStop(0, '#FFF5E6');
    innerGrad.addColorStop(1, '#FFFFFF');

    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.moveTo(-ew * 0.28, -2);
    ctx.bezierCurveTo(-ew * 0.25, -eh * 0.45, -ew * 0.1, -eh * 0.72, 0, -eh * 0.76);
    ctx.bezierCurveTo(ew * 0.1, -eh * 0.72, ew * 0.35, -eh * 0.4, ew * 0.3, -2);
    ctx.closePath();
    ctx.fill();

    // Fluffy ear tuft wisps inside ear canal
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-ew * 0.15, -6);
    ctx.quadraticCurveTo(-ew * 0.35, -eh * 0.28, -ew * 0.05, -eh * 0.35);
    ctx.quadraticCurveTo(ew * 0.25, -eh * 0.25, 0, -8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  _drawHead(ctx, cur, now) {
    ctx.save();
    // Big round head with adorable cheek tufts
    const hx = 0;
    const hy = -10;
    const hw = 84;
    const hh = 74;

    // Head Gradient
    const headGrad = ctx.createRadialGradient(hx, hy - 25, 10, hx, hy, hw);
    headGrad.addColorStop(0, '#FFA066');
    headGrad.addColorStop(0.65, '#FF7A38');
    headGrad.addColorStop(1, '#E65A20');

    ctx.fillStyle = headGrad;
    ctx.strokeStyle = '#D14810';
    ctx.lineWidth = 2.5;

    // Custom path with cheek fluff flares
    ctx.beginPath();
    // Top of head
    ctx.moveTo(-hw * 0.65, hy - hh * 0.65);
    ctx.bezierCurveTo(-hw * 0.3, hy - hh * 0.98, hw * 0.3, hy - hh * 0.98, hw * 0.65, hy - hh * 0.65);

    // Right cheek tuft
    ctx.bezierCurveTo(hw * 0.95, hy - hh * 0.2, hw * 1.15, hy + hh * 0.25, hw * 0.92, hy + hh * 0.6);
    ctx.bezierCurveTo(hw * 0.75, hy + hh * 0.9, hw * 0.4, hy + hh * 0.96, 0, hy + hh * 0.96);

    // Left cheek tuft
    ctx.bezierCurveTo(-hw * 0.4, hy + hh * 0.96, -hw * 0.75, hy + hh * 0.9, -hw * 0.92, hy + hh * 0.6);
    ctx.bezierCurveTo(-hw * 1.15, hy + hh * 0.25, -hw * 0.95, hy - hh * 0.2, -hw * 0.65, hy - hh * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cream Muzzle & Cheek Fur Mask
    const maskGrad = ctx.createLinearGradient(0, hy + 5, 0, hy + hh);
    maskGrad.addColorStop(0, '#FFFFFF');
    maskGrad.addColorStop(1, '#FFF5E6');

    ctx.fillStyle = maskGrad;
    ctx.beginPath();
    ctx.moveTo(0, hy - 4);
    // Right cheek mask
    ctx.bezierCurveTo(hw * 0.35, hy + 2, hw * 0.88, hy + 25, hw * 0.72, hy + hh * 0.62);
    ctx.bezierCurveTo(hw * 0.45, hy + hh * 0.95, 0, hy + hh * 0.94, 0, hy + hh * 0.94);
    // Left cheek mask
    ctx.bezierCurveTo(0, hy + hh * 0.94, -hw * 0.45, hy + hh * 0.95, -hw * 0.72, hy + hh * 0.62);
    ctx.bezierCurveTo(-hw * 0.88, hy + 25, -hw * 0.35, hy + 2, 0, hy - 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  _drawForeheadMark(ctx, cur, now) {
    ctx.save();
    // Kitsune glowing spirit crest on forehead
    const cx = 0;
    const cy = -54;
    const glowMult = cur.foreheadGlow !== undefined ? cur.foreheadGlow : 1.0;
    const pulse = 0.85 + 0.25 * Math.sin(now * 0.005);
    const alpha = Math.min(1.0, glowMult * pulse);

    // Radial aura
    const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26);
    aura.addColorStop(0, `rgba(255, 215, 0, ${alpha * 0.8})`);
    aura.addColorStop(0.6, `rgba(255, 140, 0, ${alpha * 0.35})`);
    aura.addColorStop(1, 'rgba(255, 140, 0, 0)');

    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fill();

    // Diamond / Flame Kitsune Mark
    ctx.fillStyle = `rgba(255, 245, 180, ${alpha})`;
    ctx.strokeStyle = `rgba(255, 190, 40, ${alpha})`;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    // Central diamond
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx + 6, cy);
    ctx.lineTo(cx, cy + 12);
    ctx.lineTo(cx - 6, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Two small side spirit droplets
    ctx.beginPath();
    ctx.arc(cx - 10, cy - 4, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + 10, cy - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawEyes(ctx, cur, blinkScale, now) {
    const eyeSpacing = 36;
    const eyeCenterY = -14;

    // Left Eye
    this._drawSingleEye(
      ctx,
      -eyeSpacing,
      eyeCenterY,
      cur.eyeOpenL !== undefined ? cur.eyeOpenL : 1.0,
      blinkScale,
      cur,
      now,
      true
    );

    // Right Eye
    this._drawSingleEye(
      ctx,
      eyeSpacing,
      eyeCenterY,
      cur.eyeOpenR !== undefined ? cur.eyeOpenR : 1.0,
      blinkScale,
      cur,
      now,
      false
    );
  }

  _drawSingleEye(ctx, cx, cy, eyeOpen, blinkScale, cur, now, isLeft) {
    ctx.save();
    ctx.translate(cx, cy);

    const effOpen = Math.max(0.04, eyeOpen * blinkScale);
    const w = cur.eyeWidth || 28;
    const h = (cur.eyeHeight || 38) * effOpen;
    const shape = cur.eyeShape || 'capsule';

    // 1. Crescent Eyes (^ ^) for pure joy / happy
    if (shape === 'crescent') {
      ctx.strokeStyle = '#2A1B18';
      ctx.lineWidth = 5.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 4, w * 0.62, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // 2. Heart Eyes (Love / pet)
    if (shape === 'heart') {
      const s = (w / 28) * Math.min(1.0, effOpen * 1.2);
      ctx.scale(s, s);
      ctx.fillStyle = '#FF3366';
      ctx.shadowColor = '#FF3366';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.bezierCurveTo(-14, -14, -20, 4, 0, 18);
      ctx.bezierCurveTo(20, 4, 14, -14, 0, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
      return;
    }

    // 3. Spiral Eyes (Dizzy)
    if (shape === 'spiral') {
      ctx.strokeStyle = '#2A1B18';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      const rot = now * 0.015 * (isLeft ? 1 : -1);
      ctx.rotate(rot);
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.15) {
        const r = (a / (Math.PI * 5)) * (w * 0.58);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }

    // 4. Default Glossy Nebula Eye with Specular Highlights
    ctx.save();
    // Eye socket clipping path
    ctx.beginPath();
    if (shape === 'droopy') {
      ctx.ellipse(0, 0, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
    } else if (shape === 'squint') {
      ctx.ellipse(0, 0, w * 0.52, Math.min(h * 0.5, 9), 0, 0, Math.PI * 2);
    } else {
      ctx.ellipse(0, 0, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
    }
    ctx.clip();

    // Deep Starry Iris Gradient (Midnight indigo to celestial azure)
    const irisGrad = ctx.createLinearGradient(0, -h * 0.5, 0, h * 0.5);
    irisGrad.addColorStop(0, '#111827');
    irisGrad.addColorStop(0.45, '#1E3A8A');
    irisGrad.addColorStop(0.85, '#38BDF8');
    irisGrad.addColorStop(1.0, '#7DD3FC');

    ctx.fillStyle = irisGrad;
    ctx.fillRect(-w, -h, w * 2, h * 2);

    // Gaze-offset Pupil
    const gazeX = (cur.eyeGazeX || 0) * (w * 0.22);
    const gazeY = (cur.eyeGazeY || 0) * (h * 0.2);

    ctx.fillStyle = '#090D16';
    ctx.beginPath();
    ctx.ellipse(gazeX, gazeY, w * 0.26, h * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Starry specular glints (Huge glossy anime reflections)
    if ((cur.shineOpacity || 1.0) > 0.1) {
      ctx.fillStyle = `rgba(255, 255, 255, ${cur.shineOpacity || 1.0})`;

      // Main big sparkle top-right
      ctx.beginPath();
      ctx.ellipse(gazeX - w * 0.15, gazeY - h * 0.16, w * 0.16, h * 0.16, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Secondary smaller twinkle bottom-left
      ctx.beginPath();
      ctx.arc(gazeX + w * 0.16, gazeY + h * 0.14, w * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Eye Outline & Eyelid Crease
    ctx.strokeStyle = '#2A1B18';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  _drawFaceDetails(ctx, cur, now) {
    ctx.save();
    // 1. Petite Dark Chocolate Fox Nose
    const nx = 0;
    const ny = 6;
    ctx.fillStyle = '#2A1B18';
    ctx.beginPath();
    ctx.ellipse(nx, ny, 4.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Expressive Cat/Fox Mouth
    const mx = 0;
    const my = ny + 9;
    const curve = cur.mouthCurve !== undefined ? cur.mouthCurve : 0.5;
    const open = cur.mouthOpen || 0;
    const width = cur.mouthWidth || 18;

    ctx.strokeStyle = '#2A1B18';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';

    if (open > 0.25) {
      // Open mouth with cute pink tongue
      ctx.save();
      ctx.fillStyle = '#991B1B';
      ctx.beginPath();
      ctx.moveTo(-width * 0.5, my);
      ctx.quadraticCurveTo(0, my + open * 26, width * 0.5, my);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Little pink tongue
      ctx.fillStyle = '#F472B6';
      ctx.beginPath();
      ctx.ellipse(0, my + open * 16, width * 0.32, open * 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // Delicate w-smile mouth line
      ctx.beginPath();
      // Left curl
      ctx.moveTo(-width * 0.5, my - curve * 2);
      ctx.quadraticCurveTo(-width * 0.25, my + curve * 4, 0, my);
      // Right curl
      ctx.quadraticCurveTo(width * 0.25, my + curve * 4, width * 0.5, my - curve * 2);
      ctx.stroke();
    }

    // 3. Soft Rosy Blush Cheeks
    const blushAlpha = cur.blushOpacity !== undefined ? cur.blushOpacity : 0.65;
    if (blushAlpha > 0.05) {
      ctx.fillStyle = `rgba(255, 99, 132, ${blushAlpha * 0.55})`;
      // Left cheek
      ctx.beginPath();
      ctx.ellipse(-52, 10, 15, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      // Right cheek
      ctx.beginPath();
      ctx.ellipse(52, 10, 15, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // --- Pure Canvas Vector Emotes (!, ?, heart, music, sparkle, zzz) ---

  _drawEmote(ctx, cur, now) {
    const emote = cur.activeEmote;
    if (!emote) return;

    ctx.save();
    // Position floating above creature's head
    const ex = 54;
    const ey = -92 + Math.sin(now * 0.006) * 5;
    ctx.translate(ex, ey);

    // Cute bubble background
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#FF7A38';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Draw Vector Glyphs
    if (emote === 'exclamation' || emote === '!') {
      ctx.fillStyle = '#E11D48';
      ctx.fillRect(-2.5, -10, 5, 11);
      ctx.beginPath();
      ctx.arc(0, 6, 2.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (emote === 'question' || emote === '?') {
      ctx.strokeStyle = '#2563EB';
      ctx.fillStyle = '#2563EB';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(0, -5, 5.5, Math.PI, Math.PI * 2.2);
      ctx.lineTo(0, 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 7, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (emote === 'heart') {
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.bezierCurveTo(-8, -11, -12, 1, 0, 10);
      ctx.bezierCurveTo(12, 1, 8, -11, 0, -3);
      ctx.fill();
    } else if (emote === 'music') {
      ctx.fillStyle = '#8B5CF6';
      // Eighth note ♪
      ctx.beginPath();
      ctx.arc(-4, 5, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-2, -9, 3, 14);
      ctx.fillRect(-2, -9, 8, 4);
      ctx.fillRect(5, -9, 3, 9);
      ctx.beginPath();
      ctx.arc(4, 3, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (emote === 'sparkle') {
      ctx.fillStyle = '#F59E0B';
      this._drawSparkleStar(ctx, 0, 0, 11, now * 0.005);
    } else if (emote === 'zzz') {
      ctx.fillStyle = '#3B82F6';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Z', 0, 0);
    }

    ctx.restore();
  }

  /**
   * Hit-testing for Direct Touch Gestures.
   * Coordinate space: cx, cy is offset from virtual 360x360 center (0,0).
   * Returns: 'earL' | 'earR' | 'tail' | 'head' | 'body' | null
   */
  hitTest(cx, cy) {
    // 1. Left Ear Hitbox
    if (Math.hypot(cx - (-56), cy - (-54)) < 36) {
      return 'earL';
    }
    // 2. Right Ear Hitbox
    if (Math.hypot(cx - 56, cy - (-54)) < 36) {
      return 'earR';
    }
    // 3. Tail Hitbox (lower right area)
    if (cx > 20 && cy > 25 && cx < 125 && cy < 110) {
      return 'tail';
    }
    // 4. Head Hitbox
    if (Math.hypot(cx, cy - (-12)) < 68) {
      return 'head';
    }
    // 5. Body Hitbox
    if (Math.hypot(cx, cy - 54) < 55) {
      return 'body';
    }
    return null;
  }
}
