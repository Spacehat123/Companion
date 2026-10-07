/**
 * web/reactions.js — Async Reaction Step Sequences, Autonomous Life,
 * and Persistence Engine for Kitsune Companion (Stage 1 Shippable v0.1.0).
 */

import { CONSTANTS, MOODS } from './moods.js';

export class ReactionEngine {
  constructor(character, onPromptSmile, onControlAction) {
    this.char = character;
    this.promptSmile = onPromptSmile || (() => {});
    this.onControlAction = onControlAction || (() => {});

    this.token = 0;
    this.isSleeping = false;
    this.isSulky = false;
    this.lastActionTime = Date.now();
    this.currentActionName = null;
    this.lastMoodBeforeSleep = 'neutral';
    this.lastIdleMicro = null;

    // Controls mode state
    this.isControlsMode = false;
    this.controlsTimer = null;

    // Stroke petting state
    this.strokeLevel = 0;

    // Track autonomous behavior count in session
    this.autonomousCount = 0;

    // Initialize Persistence and Greeting
    this._initPersistence();

    // Start autonomous life schedulers
    this._startIdleTimers();
  }

  _initPersistence() {
    const STORAGE_KEY = 'companion_last_seen_ts';
    const lastSeenStr = localStorage.getItem(STORAGE_KEY);

    // Heartbeat updates timestamp while active (every 4s)
    const heartbeat = () => {
      if (!document.hidden) {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
      }
    };
    setInterval(heartbeat, 4000);

    // Initial greeting based on time elapsed
    setTimeout(() => {
      // Record current session after reading previous
      localStorage.setItem(STORAGE_KEY, Date.now().toString());

      if (!lastSeenStr) {
        // First visit: normal wake up stretch
        this.run('wakeHappy');
      } else {
        const elapsedHours = (Date.now() - parseInt(lastSeenStr, 10)) / (1000 * 60 * 60);
        if (elapsedHours > 24.0) {
          // Gone for over a day: Sulky greeting!
          this.isSulky = true;
          this.run('greetSulky');
        } else if (elapsedHours > 2.0) {
          // Gone for a few hours: Excited reunion greeting!
          this.run('greetExcited');
        } else {
          // Recent return: gentle morning wake
          this.run('wakeHappy');
        }
      }
    }, 350);
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async run(name) {
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

    // If sulky and user gives a pet or stroke, trigger forgiveness!
    if (this.isSulky && (name === 'pet' || name === 'stroke')) {
      this.isSulky = false;
      await this._executeStepSequence(myToken, this.SEQUENCES.forgive);
      if (myToken !== this.token) return;
      this.char.setMood('happy');
      this.promptSmile('forgive');
      return;
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

    // If still sulky, stay in sulky pout until stroked/petted
    if (this.isSulky) {
      this.char.applyPose({
        earLRot: 40,
        earRRot: -40,
        earLFold: 0.65,
        earRFold: 0.65,
        mouthStyle: 'pout',
        mouthCurve: -0.3,
        bodyTilt: -8.0,
      });
      return;
    }

    // Return to neutral
    this.char.setMood('neutral');

    // If reaction was 'shake', transition into Shake-to-Controls morph!
    if (name === 'shake') {
      await this.triggerControlsMorph();
      return;
    }

    // Prompt the Smile Test question unobtrusively after reaction finishes
    this.promptSmile(name);
  }

  async _executeStepSequence(myToken, sequence) {
    for (let i = 0; i < sequence.length; i++) {
      if (myToken !== this.token) return;
      const step = sequence[i];

      if (step.mood) this.char.setMood(step.mood);
      if (step.body) this.char.applyPose(step.body);

      if (step.triggerSneeze && this.char.species && this.char.species.triggerSneezeWisp) {
        this.char.species.triggerSneezeWisp();
      }

      await this.sleep(step.ms);
    }
  }

  // --- Dynamic Gestures ---

  triggerStrokePet(amount = 1) {
    this.lastActionTime = Date.now();
    this.strokeLevel = Math.min(6, this.strokeLevel + amount);

    if (this.isSleeping) {
      this.run('wakeHappy');
      return;
    }

    if (this.isSulky) {
      this.run('pet');
      return;
    }

    this.char.applyPose({
      activeEmote: 'heart',
      bodyTilt: 8.0,
      earLRot: -12.0,
      earRRot: 10.0,
      tailAngle: -18.0,
      tailWagSpeed: 2.2,
      tailCurl: 28.0,
      blushOpacity: 1.0,
      foreheadGlow: 1.45,
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
      if (!this.isSleeping && this.currentActionName !== 'pet' && !this.isSulky) {
        this.char.setMood('happy');
        setTimeout(() => {
          if (!this.isSleeping && !this.isSulky) this.char.setMood('neutral');
        }, 1200);
      }
    }, 350);
  }

  // --- Shake-to-Controls Morph ---

  async triggerControlsMorph() {
    const myToken = ++this.token;
    this.isControlsMode = true;
    this.char.setMorphTarget(1.0);

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

    this.char.triggerButtonPress(zoneName);
    this.onControlAction(zoneName);

    this.char.applyPose({
      earLRot: zoneName === 'PREV' ? -22 : 0,
      earRRot: zoneName === 'NEXT' ? 22 : 0,
      activeEmote: 'music',
    });

    clearTimeout(this.controlsTimer);
    this.controlsTimer = setTimeout(() => {
      this.dismissControlsMorph();
      this.promptSmile('controlsTap');
    }, 2800);
  }

  // --- Autonomous Life & Sleep Watchdog ---

  _startIdleTimers() {
    // 1. Idle Sleep Watchdog (sleeps after ~48s of zero input)
    setInterval(() => {
      const now = Date.now();
      if (!this.isSleeping && !this.isControlsMode && (now - this.lastActionTime > CONSTANTS.idleSleepTimeout)) {
        this.run('sleep');
      }
    }, 1000);

    // 2. Autonomous Life Micro-Behaviors (every 3.2 - 6.5s)
    const scheduleNextMicro = () => {
      const delay = CONSTANTS.idleMicroMin + Math.random() * (CONSTANTS.idleMicroMax - CONSTANTS.idleMicroMin);
      setTimeout(async () => {
        if (!this.isSleeping && !this.isControlsMode && !this.isSulky && (Date.now() - this.lastActionTime > 3000)) {
          await this._triggerRandomMicroBehavior();
        }
        scheduleNextMicro();
      }, delay);
    };
    scheduleNextMicro();
  }

  async _triggerRandomMicroBehavior() {
    const microList = ['lookAround', 'yawn', 'stretch', 'chaseTail', 'sneezeWisp', 'earTwitch'];
    const available = microList.filter(m => m !== this.lastIdleMicro);
    const chosen = available[Math.floor(Math.random() * available.length)];
    this.lastIdleMicro = chosen;
    this.autonomousCount++;

    const myToken = ++this.token;
    const seq = this.MICRO_BEHAVIORS[chosen];
    if (seq) {
      await this._executeStepSequence(myToken, seq);
      if (myToken === this.token && !this.isSleeping && !this.isSulky) {
        this.char.setMood('neutral');
      }
    }
  }

  // --- Step Sequence Definitions ---

  SEQUENCES = {
    // 1. Poke (Body/Head Tap): Squish down -> Hop up -> Happy ear perk
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

    // 4. Pet (Hold): Leans in, purrs, heart eyes, tail curls in
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

    // 5. Flick: Fling across screen, dizzy bounce back, shakes it off
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

    // 6. Shake: Wobble -> Dizzy -> Annoyed -> Shake-to-Controls
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

    // 7. Tilt Left
    tiltL: [
      {
        mood: 'curious',
        ms: 1500,
        body: { bodyTilt: -16.0, eyeGazeX: 0.7, earLRot: -20, earRRot: 30, tailAngle: 25 },
      },
    ],

    // 8. Tilt Right
    tiltR: [
      {
        mood: 'curious',
        ms: 1500,
        body: { bodyTilt: 16.0, eyeGazeX: -0.7, earLRot: 30, earRRot: -20, tailAngle: -25 },
      },
    ],

    // 9. Flip: Upside Down
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

    // 10. Sleep: Yawn, droop ears, curl tail around body, zzz
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

    // 11. Wake Happy
    wakeHappy: [
      {
        mood: 'surprised',
        ms: 650,
        body: { bodyScaleY: 1.20, bodyScaleX: 0.88, bodyOffsetY: -18, earLRot: -20, earRRot: 20, activeEmote: 'sparkle' },
      },
      {
        mood: 'happy',
        ms: 1100,
        body: { bodyScaleY: 1.0, bodyScaleX: 1.0, bodyOffsetY: 0, tailWagSpeed: 3.0, activeEmote: 'music' },
      },
    ],

    // 12. Wake Grumpy
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

    // 13. Greet Excited (Back after 2 - 24 hours)
    greetExcited: [
      {
        mood: 'excited',
        ms: 800,
        body: { bodyOffsetY: -22, bodyScaleY: 1.2, earLRot: -25, earRRot: 25, tailAngle: 30, tailWagSpeed: 5.0, activeEmote: 'sparkle' },
      },
      {
        mood: 'happy',
        ms: 1200,
        body: { bodyOffsetY: -6, bodyScaleY: 1.05, tailWagSpeed: 3.5, activeEmote: 'music' },
      },
    ],

    // 14. Greet Sulky (Back after > 24 hours)
    greetSulky: [
      {
        mood: 'sad',
        ms: 900,
        body: { bodyTilt: -10.0, earLRot: 45, earRRot: -45, earLFold: 0.6, earRFold: 0.6, bodyOffsetY: 8 },
      },
      {
        mood: 'annoyed',
        ms: 1400,
        body: { bodyTilt: -12.0, earLRot: 48, earRRot: -48, mouthStyle: 'pout', mouthCurve: -0.35, eyeGazeX: -0.7 },
      },
    ],

    // 15. Forgive Sulkiness (Triggered by Petting / Stroking when sulky)
    forgive: [
      {
        mood: 'surprised',
        ms: 500,
        body: { bodyScaleY: 1.15, bodyOffsetY: -12, earLRot: -15, earRRot: 15, activeEmote: 'sparkle' },
      },
      {
        mood: 'love',
        ms: 1600,
        body: { bodyTilt: 6.0, bodyOffsetY: 0, foreheadGlow: 1.6, pawWiggle: true, activeEmote: 'heart' },
      },
    ],
  };

  MICRO_BEHAVIORS = {
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
