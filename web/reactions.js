/**
 * web/reactions.js — Async Reaction Step Sequences, Autonomous Life,
 * and Gestures for Kitsune Companion.
 * 
 * Non-verbal: Uses Canvas vector emotes instead of speech text.
 * Implements:
 * - Direct touch gestures: Tap (body, ear, tail), Pet (hold), Stroke (drag), Flick (quick swipe)
 * - Autonomous micro-behaviors (look around, yawn, stretch, chase tail, sneeze wisp, ear twitch)
 * - Inactivity sleep watchdog (30s) and dynamic wake (grumpy vs happy)
 * - Cancel tokens (new interactions immediately interrupt active ones)
 * - Shake-to-Controls 3-Zone morph
 */

import { CONSTANTS, MOODS } from './moods.js';

export class ReactionEngine {
  constructor(character, onPromptSmile, onControlAction) {
    this.char = character;
    this.promptSmile = onPromptSmile || (() => {});
    this.onControlAction = onControlAction || (() => {});

    this.token = 0;
    this.isSleeping = false;
    this.lastActionTime = Date.now();
    this.currentActionName = null;
    this.lastMoodBeforeSleep = 'neutral';
    this.lastIdleMicro = null;

    // Controls mode state
    this.isControlsMode = false;
    this.controlsTimer = null;

    // Stroke petting state
    this.strokeLevel = 0;

    // Start autonomous life schedulers
    this._startIdleTimers();
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async run(name, customArgs = null) {
    const myToken = ++this.token;
    this.lastActionTime = Date.now();
    this.currentActionName = name;

    // If asleep and waking up, run wakeup transition first
    if (this.isSleeping && name !== 'sleep') {
      this.isSleeping = false;
      const wakeSeq = (this.lastMoodBeforeSleep === 'annoyed' || this.lastMoodBeforeSleep === 'dizzy')
        ? this.SEQUENCES.wakeGrumpy
        : this.SEQUENCES.wakeHappy;
      await this._executeStepSequence(myToken, wakeSeq);
      if (myToken !== this.token) return;
    }

    if (name === 'sleep') {
      this.isSleeping = true;
      this.lastMoodBeforeSleep = this.char.activeMood;
    }

    const sequence = this.SEQUENCES[name];
    if (!sequence) {
      console.warn(`[ReactionEngine] Unknown reaction: ${name}`);
      return;
    }

    // Special trigger: sneeze wisp burst
    if (name === 'sneezeWisp' && this.char.species && this.char.species.triggerSneezeWisp) {
      this.char.species.triggerSneezeWisp();
    }

    // Execute step sequence
    await this._executeStepSequence(myToken, sequence);
    if (myToken !== this.token) return;

    // If sleeping, stay in sleep pose
    if (this.isSleeping) {
      this.char.setMood('sleepy');
      return;
    }

    // Return to neutral
    this.char.setMood('neutral');

    // If reaction was 'shake', automatically transition into Shake-to-Controls morph!
    if (name === 'shake') {
      await this.triggerControlsMorph();
      return;
    }

    // Prompt the Smile Test question unobtrusively after reaction finishes
    this.promptSmile(name);
  }

  async _executeStepSequence(myToken, sequence) {
    for (let i = 0; i < sequence.length; i++) {
      if (myToken !== this.token) return; // Interrupted by newer interaction
      const step = sequence[i];

      // 1. Set character mood if specified
      if (step.mood) this.char.setMood(step.mood);

      // 2. Apply body / limb / ear / tail overrides
      if (step.body) this.char.applyPose(step.body);

      // 3. Trigger special animations like sneeze burst
      if (step.triggerSneeze && this.char.species && this.char.species.triggerSneezeWisp) {
        this.char.species.triggerSneezeWisp();
      }

      // 4. Wait for step duration
      await this.sleep(step.ms);
    }
  }

  // --- Dynamic Gestures ---

  triggerStrokePet(amount = 1) {
    this.lastActionTime = Date.now();
    this.strokeLevel = Math.min(5, this.strokeLevel + amount);

    if (this.isSleeping) {
      this.run('wake');
      return;
    }

    // Gentle purring and leaning into finger
    this.char.applyPose({
      activeEmote: 'heart',
      bodyTilt: 8.0,
      earLRot: -12.0,
      earRRot: 10.0,
      tailAngle: -18.0,
      tailWagSpeed: 2.2,
      tailCurl: 28.0,
      blushOpacity: 1.0,
      foreheadGlow: 1.4,
      eyeOpenL: 0.65,
      eyeOpenR: 0.65,
      pawWiggle: true,
    });
  }

  endStrokePet() {
    if (this.strokeLevel > 1) {
      this.promptSmile('stroke');
    }
    this.strokeLevel = 0;
    setTimeout(() => {
      if (!this.isSleeping && this.currentActionName !== 'pet') {
        this.char.setMood('happy');
        setTimeout(() => {
          if (!this.isSleeping) this.char.setMood('neutral');
        }, 1200);
      }
    }, 400);
  }

  // --- Shake-to-Controls Morph ---

  async triggerControlsMorph() {
    const myToken = ++this.token;
    this.isControlsMode = true;
    
    // Smoothly morph to controls layout
    this.char.setMorphTarget(1.0);

    // Auto-timeout back to character mode
    clearTimeout(this.controlsTimer);
    this.controlsTimer = setTimeout(async () => {
      if (myToken !== this.token) return;
      this.dismissControlsMorph();
      this.promptSmile('shakeToControls');
    }, CONSTANTS.controlsTimeout);
  }

  dismissControlsMorph() {
    this.isControlsMode = false;
    this.char.setMorphTarget(0.0);
    this.char.setMood('neutral');
    this.lastActionTime = Date.now();
  }

  handleControlClick(zoneName) {
    if (!this.isControlsMode) return;
    this.lastActionTime = Date.now();

    // Squish button on click
    this.char.triggerButtonPress(zoneName);

    // Call external stub callback
    this.onControlAction(zoneName);

    // Brief happy ear flick on control touch
    this.char.applyPose({
      earLRot: zoneName === 'PREV' ? -22 : 0,
      earRRot: zoneName === 'NEXT' ? 22 : 0,
      activeEmote: 'music',
    });

    // Reset auto-dismiss timer on interaction
    clearTimeout(this.controlsTimer);
    this.controlsTimer = setTimeout(() => {
      this.dismissControlsMorph();
      this.promptSmile('controlsTap');
    }, 2800);
  }

  // --- Autonomous Life & Sleep Watchdog ---

  _startIdleTimers() {
    // 1. Idle Sleep Watchdog (falls asleep after 30s of inactivity)
    setInterval(() => {
      const now = Date.now();
      if (!this.isSleeping && !this.isControlsMode && (now - this.lastActionTime > CONSTANTS.idleSleepTimeout)) {
        this.run('sleep');
      }
    }, 1000);

    // 2. Autonomous Life Micro-Behaviors (every 3.5 - 7.0s)
    const scheduleNextMicro = () => {
      const delay = CONSTANTS.idleMicroMin + Math.random() * (CONSTANTS.idleMicroMax - CONSTANTS.idleMicroMin);
      setTimeout(async () => {
        if (!this.isSleeping && !this.isControlsMode && (Date.now() - this.lastActionTime > 3200)) {
          await this._triggerRandomMicroBehavior();
        }
        scheduleNextMicro();
      }, delay);
    };
    scheduleNextMicro();
  }

  async _triggerRandomMicroBehavior() {
    const microList = ['lookAround', 'yawn', 'stretch', 'chaseTail', 'sneezeWisp', 'earTwitch'];
    // Filter out last behavior so it never repeats the same one twice
    const available = microList.filter(m => m !== this.lastIdleMicro);
    const chosen = available[Math.floor(Math.random() * available.length)];
    this.lastIdleMicro = chosen;

    const myToken = ++this.token;
    const seq = this.MICRO_BEHAVIORS[chosen];
    if (seq) {
      await this._executeStepSequence(myToken, seq);
      if (myToken === this.token && !this.isSleeping) {
        this.char.setMood('neutral');
      }
    }
  }

  // --- Step Sequence Definitions ---

  SEQUENCES = {
    // 1. Poke (Body/Head Tap): Squish down -> Hop up -> Happy ear perk -> Settle
    tap: [
      {
        mood: 'surprised',
        ms: 160,
        body: { bodyScaleX: 1.22, bodyScaleY: 0.78, bodyOffsetY: 16, earLRot: -25, earRRot: 25 },
      },
      {
        mood: 'happy',
        ms: 650,
        body: { bodyScaleX: 0.88, bodyScaleY: 1.18, bodyOffsetY: -24, tailAngle: 18, tailWagSpeed: 3.5, activeEmote: 'sparkle' },
      },
      {
        mood: 'happy',
        ms: 550,
        body: { bodyScaleX: 1.0, bodyScaleY: 1.0, bodyOffsetY: 0, tailWagSpeed: 2.0 },
      },
    ],

    // 2. Ear Tap: Startled twitch of tapped ear, curious head cock
    tapEar: [
      {
        mood: 'curious',
        ms: 220,
        body: { earLRot: 38, earLFold: 0.5, bodyTilt: -8.0, activeEmote: 'question' },
      },
      {
        mood: 'curious',
        ms: 600,
        body: { earLRot: -12, earLFold: 1.15, earRRot: 20, bodyTilt: 10.0 },
      },
      {
        mood: 'happy',
        ms: 500,
        body: { earLRot: 0, earRRot: 0, bodyTilt: 0, activeEmote: 'sparkle' },
      },
    ],

    // 3. Tail Tap: Tail flicks away, fox playfully swats around
    tapTail: [
      {
        mood: 'surprised',
        ms: 200,
        body: { tailAngle: -45, tailCurl: -35, tailPuff: true, bodyTilt: 12, activeEmote: 'exclamation' },
      },
      {
        mood: 'happy',
        ms: 700,
        body: { tailAngle: 30, tailWagSpeed: 4.5, tailPuff: true, bodyOffsetY: -8, activeEmote: 'sparkle' },
      },
      {
        mood: 'happy',
        ms: 500,
        body: { tailAngle: 10, tailWagSpeed: 2.0, bodyOffsetY: 0 },
      },
    ],

    // 4. Pet (Hold): Leans in, purrs, heart eyes, tail curls in affectionately
    pet: [
      {
        mood: 'love',
        ms: 1200,
        body: { bodyTilt: 8.0, bodyScaleX: 1.06, bodyScaleY: 0.94, foreheadGlow: 1.6, pawWiggle: true, activeEmote: 'heart' },
      },
      {
        mood: 'love',
        ms: 1400,
        body: { bodyTilt: -6.0, bodyScaleX: 1.04, bodyScaleY: 0.96, foreheadGlow: 1.4, pawWiggle: true, activeEmote: 'heart' },
      },
    ],

    // 5. Flick (Quick Swipe): Fling across screen, dizzy bounce back, shakes it off
    flick: [
      {
        mood: 'surprised',
        ms: 240,
        body: { bodyOffsetY: -35, bodyTilt: -25, bodyScaleY: 1.25, earLRot: -35, earRRot: -35, activeEmote: 'exclamation' },
      },
      {
        mood: 'dizzy',
        ms: 1000,
        body: { bodyOffsetY: 12, bodyTilt: 15, bodyWobble: 18.0, earLFold: 0.6, earRFold: 0.8 },
      },
      {
        mood: 'annoyed',
        ms: 1100,
        body: { bodyScaleX: 0.94, earLRot: 50, earRRot: -50, bodyTilt: 0, bodyWobble: 0 },
      },
    ],

    // 6. Shake: Frantic flailing ears & tail -> Dizzy -> Annoyed -> Shake-to-Controls
    shake: [
      {
        mood: 'dizzy',
        ms: 1100,
        body: { bodyWobble: 24.0, earLRot: 40, earRRot: -40, tailWagSpeed: 5.5, tailWagAmp: 0.9 },
      },
      {
        mood: 'dizzy',
        ms: 800,
        body: { bodyWobble: 12.0, earLRot: 25, earRRot: -25 },
      },
      {
        mood: 'annoyed',
        ms: 1100,
        body: { bodyScaleX: 0.96, earLRot: 52, earRRot: -52, tailWagSpeed: 3.0 },
      },
    ],

    // 7. Tilt Left: Leans left, ears & tail counter-balance
    tiltL: [
      {
        mood: 'curious',
        ms: 1500,
        body: { bodyTilt: -16.0, eyeGazeX: 0.7, earLRot: -20, earRRot: 30, tailAngle: 25 },
      },
    ],

    // 8. Tilt Right: Leans right, ears & tail counter-balance
    tiltR: [
      {
        mood: 'curious',
        ms: 1500,
        body: { bodyTilt: 16.0, eyeGazeX: -0.7, earLRot: 30, earRRot: -20, tailAngle: -25 },
      },
    ],

    // 9. Flip (Upside Down): Panic ears flat, tail poofed, surprised -> annoyed
    flip: [
      {
        mood: 'surprised',
        ms: 1400,
        body: { earLRot: 55, earRRot: -55, earLFold: 0.6, earRFold: 0.6, tailPuff: true, bodyScaleY: 1.18, activeEmote: 'exclamation' },
      },
      {
        mood: 'annoyed',
        ms: 1400,
        body: { earLRot: 48, earRRot: -48, bodyScaleY: 1.0 },
      },
    ],

    // 10. Sleep: Yawn, droop ears, curl tail around body, slow breathing, zzz
    sleep: [
      {
        mood: 'sleepy',
        ms: 1100,
        body: { mouthStyle: 'gasp', mouthOpen: 0.75, bodyScaleY: 1.08, bodyOffsetY: -4, earLRot: 20, earRRot: -20 },
      },
      {
        mood: 'sleepy',
        ms: 3000,
        body: { bodyScaleY: 0.92, bodyOffsetY: 8, earLRot: 38, earRRot: -38, tailAngle: -35, tailCurl: -48, activeEmote: 'zzz' },
      },
    ],

    // 11. Wake Happy: Tall joyful morning stretch, perked ears, musical note
    wakeHappy: [
      {
        mood: 'surprised',
        ms: 700,
        body: { bodyScaleY: 1.20, bodyScaleX: 0.88, bodyOffsetY: -18, earLRot: -20, earRRot: 20, activeEmote: 'sparkle' },
      },
      {
        mood: 'happy',
        ms: 1100,
        body: { bodyScaleY: 1.0, bodyScaleX: 1.0, bodyOffsetY: 0, tailWagSpeed: 3.0, activeEmote: 'music' },
      },
    ],

    // 12. Wake Grumpy: Flat ears, slow grumble, sleepy annoyed pout
    wakeGrumpy: [
      {
        mood: 'sleepy',
        ms: 800,
        body: { bodyScaleX: 1.1, bodyScaleY: 0.9, bodyOffsetY: 6, earLRot: 45, earRRot: -45 },
      },
      {
        mood: 'annoyed',
        ms: 1200,
        body: { bodyScaleX: 0.96, earLRot: 50, earRRot: -50, mouthStyle: 'pout', mouthCurve: -0.3 },
      },
    ],
  };

  MICRO_BEHAVIORS = {
    // A. Look Around: Curious head & ear swivels, darting gaze
    lookAround: [
      {
        mood: 'curious',
        ms: 850,
        body: { bodyTilt: -7.0, eyeGazeX: -0.85, eyeGazeY: -0.1, earLRot: -18, earRRot: 22 },
      },
      {
        mood: 'curious',
        ms: 850,
        body: { bodyTilt: 7.0, eyeGazeX: 0.85, eyeGazeY: 0.1, earLRot: 22, earRRot: -18 },
      },
    ],

    // B. Yawn: Sleepy mouth open, ears flatten, slow body stretch
    yawn: [
      {
        mood: 'sleepy',
        ms: 1200,
        body: { mouthStyle: 'gasp', mouthOpen: 0.82, bodyScaleY: 1.12, bodyOffsetY: -6, earLRot: 26, earRRot: -26 },
      },
      {
        mood: 'neutral',
        ms: 600,
        body: { bodyScaleY: 1.0, bodyOffsetY: 0, mouthOpen: 0 },
      },
    ],

    // C. Stretch: Paws reach down, tail arches high, ears shake
    stretch: [
      {
        mood: 'neutral',
        ms: 800,
        body: { bodyScaleX: 1.14, bodyScaleY: 0.86, bodyOffsetY: 12, tailAngle: -30, tailCurl: 35, earLRot: 15, earRRot: -15 },
      },
      {
        mood: 'happy',
        ms: 700,
        body: { bodyScaleX: 0.92, bodyScaleY: 1.12, bodyOffsetY: -8, tailAngle: 15, tailWagSpeed: 2.8, activeEmote: 'sparkle' },
      },
    ],

    // D. Chase Tail: Fox playfully circles head toward tail tip
    chaseTail: [
      {
        mood: 'curious',
        ms: 600,
        body: { bodyTilt: 14.0, eyeGazeX: 0.9, tailAngle: 35, tailCurl: 40, tailWagSpeed: 4.5, activeEmote: 'sparkle' },
      },
      {
        mood: 'happy',
        ms: 700,
        body: { bodyTilt: -10.0, eyeGazeX: -0.7, tailAngle: -20, tailCurl: -30, tailWagSpeed: 4.0 },
      },
    ],

    // E. Sneeze Wisp: Nose scrunches, tenses, *achoo!* bursts out a glowing wisp!
    sneezeWisp: [
      {
        mood: 'annoyed',
        ms: 600,
        body: { bodyScaleX: 1.15, bodyScaleY: 0.85, bodyOffsetY: 10, eyeOpenL: 0.3, eyeOpenR: 0.3, earLRot: 30, earRRot: -30 },
      },
      {
        mood: 'surprised',
        ms: 450,
        triggerSneeze: true,
        body: { bodyScaleX: 0.85, bodyScaleY: 1.25, bodyOffsetY: -20, earLRot: -25, earRRot: 25, activeEmote: 'sparkle' },
      },
      {
        mood: 'happy',
        ms: 700,
        body: { bodyScaleX: 1.0, bodyScaleY: 1.0, bodyOffsetY: 0, tailWagSpeed: 2.5 },
      },
    ],

    // F. Ear Twitch: Independent left then right ear flick
    earTwitch: [
      {
        mood: 'neutral',
        ms: 220,
        body: { earLRot: 34, earLFold: 0.55 },
      },
      {
        mood: 'neutral',
        ms: 220,
        body: { earLRot: 0, earLFold: 1.0, earRRot: -34, earRFold: 0.55 },
      },
      {
        mood: 'neutral',
        ms: 300,
        body: { earLRot: 0, earRRot: 0, earLFold: 1.0, earRFold: 1.0 },
      },
    ],
  };
}
