/**
 * reactions.js — Async Reaction Step Sequences, Cancel Token, Idle Micro-behaviors,
 * and Shake-to-Controls Morph Engine.
 */

import { CONSTANTS, MOODS } from './moods.js';

export class ReactionEngine {
  constructor(character, onSay, onPromptSmile, onControlAction) {
    this.char = character;
    this.say = onSay || (() => {});
    this.promptSmile = onPromptSmile || (() => {});
    this.onControlAction = onControlAction || (() => {});

    this.token = 0;
    this.isSleeping = false;
    this.lastActionTime = Date.now();
    this.currentActionName = null;
    this.lastIdleMicro = null;

    // Controls mode state
    this.isControlsMode = false;
    this.controlsTimer = null;

    // Start idle schedulers
    this._startIdleTimers();
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async run(name, customText = null) {
    const myToken = ++this.token;
    this.lastActionTime = Date.now();
    this.currentActionName = name;

    // If asleep and waking up, run wakeup transition first
    if (this.isSleeping && name !== 'sleep') {
      this.isSleeping = false;
      await this._executeStepSequence(myToken, this.SEQUENCES.wake);
      if (myToken !== this.token) return;
    }

    const sequence = this.SEQUENCES[name];
    if (!sequence) {
      console.warn(`[ReactionEngine] Unknown reaction: ${name}`);
      return;
    }

    // Execute step sequence
    await this._executeStepSequence(myToken, sequence, customText);
    if (myToken !== this.token) return;

    // Return to neutral
    this.char.setMood('neutral');
    this.say('');

    // If reaction was 'shake', automatically transition into Shake-to-Controls morph!
    if (name === 'shake') {
      await this.triggerControlsMorph();
      return;
    }

    // Prompt the Smile Test question after reaction finishes
    this.promptSmile(name);
  }

  async _executeStepSequence(myToken, sequence, customText) {
    for (let i = 0; i < sequence.length; i++) {
      if (myToken !== this.token) return; // Interrupted by newer reaction
      const step = sequence[i];

      // 1. Set character mood and text
      if (step.mood) this.char.setMood(step.mood);
      const text = (i === 0 && customText) ? customText : (step.text !== undefined ? step.text : '');
      this.say(text);

      // 2. Apply body / limb physics overrides
      if (step.body) this.char.applyPose(step.body);

      // 3. Wait for step duration
      await this.sleep(step.ms);
    }
  }

  async triggerControlsMorph() {
    const myToken = ++this.token;
    this.isControlsMode = true;
    this.say('MUSIC CONTROLS');
    
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
    this.say('');
    this.char.setMorphTarget(0.0);
    this.char.setMood('neutral');
    this.lastActionTime = Date.now();
  }

  handleControlClick(zoneName) {
    if (!this.isControlsMode) return;
    this.lastActionTime = Date.now();

    // Squish button on click
    this.char.triggerButtonPress(zoneName);

    // User feedback
    let feedback = '';
    if (zoneName === 'PREV') feedback = '⏮ Skipped to previous track';
    else if (zoneName === 'PLAY') feedback = '⏯ Music playback toggled';
    else if (zoneName === 'NEXT') feedback = '⏭ Skipped to next track';
    this.say(feedback);

    // Call external stub callback
    this.onControlAction(zoneName);

    // Reset auto-dismiss timer on interaction
    clearTimeout(this.controlsTimer);
    this.controlsTimer = setTimeout(() => {
      this.dismissControlsMorph();
      this.promptSmile('controlsTap');
    }, 2800);
  }

  // --- Idle Micro-Behaviors & Sleep Watchdog ---

  _startIdleTimers() {
    // 1. Idle Sleep Watchdog (falls asleep after 15s)
    setInterval(() => {
      const now = Date.now();
      if (!this.isSleeping && !this.isControlsMode && (now - this.lastActionTime > CONSTANTS.idleSleepTimeout)) {
        this.run('sleep');
      }
    }, 1000);

    // 2. Spontaneous Idle Micro-Behaviors (every 4-8s)
    const scheduleNextMicro = () => {
      const delay = CONSTANTS.idleMicroMin + Math.random() * (CONSTANTS.idleMicroMax - CONSTANTS.idleMicroMin);
      setTimeout(async () => {
        if (!this.isSleeping && !this.isControlsMode && (Date.now() - this.lastActionTime > 3000)) {
          await this._triggerRandomMicroBehavior();
        }
        scheduleNextMicro();
      }, delay);
    };
    scheduleNextMicro();
  }

  async _triggerRandomMicroBehavior() {
    const microList = ['lookAround', 'yawn', 'wave', 'footTap', 'hum'];
    // Filter out last one so it never repeats
    const available = microList.filter(m => m !== this.lastIdleMicro);
    const chosen = available[Math.floor(Math.random() * available.length)];
    this.lastIdleMicro = chosen;

    const myToken = ++this.token;
    const seq = this.MICRO_BEHAVIORS[chosen];
    if (seq) {
      await this._executeStepSequence(myToken, seq);
      if (myToken === this.token) {
        this.char.setMood('neutral');
        this.say('');
      }
    }
  }

  // --- Step Sequence Definitions ---

  SEQUENCES = {
    // 1. Poke (Tap): Squish down -> Anticipation -> Spring hop up -> Settle
    tap: [
      {
        mood: 'surprised',
        text: 'eep!',
        ms: 180,
        body: { bodyScaleX: 1.20, bodyScaleY: 0.80, bodyOffsetY: 14, leftHandY: 8, rightHandY: 8 },
      },
      {
        mood: 'happy',
        text: 'hehe, hi! ✨',
        ms: 700,
        body: { bodyScaleX: 0.90, bodyScaleY: 1.16, bodyOffsetY: -24, rightHandY: -22, isWaving: true },
      },
      {
        mood: 'happy',
        text: 'hehe, hi! ✨',
        ms: 600,
        body: { bodyScaleX: 1.0, bodyScaleY: 1.0, bodyOffsetY: 0, isWaving: true },
      },
    ],

    // 2. Pet (Hold): Leans into finger, heart eyes, glowing core, purring feet wiggle
    pet: [
      {
        mood: 'love',
        text: 'purrrrrr ❤️',
        ms: 1200,
        body: { bodyTilt: 9.0, bodyScaleX: 1.06, bodyScaleY: 0.94, corePulse: 1.6, footWiggle: true },
      },
      {
        mood: 'love',
        text: 'purrrrrr ❤️',
        ms: 1400,
        body: { bodyTilt: -7.0, bodyScaleX: 1.04, bodyScaleY: 0.96, corePulse: 1.4, footWiggle: true },
      },
    ],

    // 3. Shake: Frantic flailing hands & wobbling body -> Dizzy -> Annoyed -> Shake-to-Controls
    shake: [
      {
        mood: 'dizzy',
        text: 'woah woah woah! 😵',
        ms: 1100,
        body: { bodyWobble: 22.0, isFlailing: true, rightHandY: -28, leftHandY: -28 },
      },
      {
        mood: 'dizzy',
        text: 'woah woah woah! 😵',
        ms: 900,
        body: { bodyWobble: 12.0, isFlailing: true },
      },
      {
        mood: 'annoyed',
        text: 'okay, stop shaking me! 😤',
        ms: 1300,
        body: { bodyScaleX: 0.96, bodyScaleY: 1.02, leftHandY: 6, rightHandY: 6 },
      },
    ],

    // 4. Tilt Left: Leans left, gaze counter-balances, feet shuffle
    tiltL: [
      {
        mood: 'curious',
        text: 'whoa, leaning left~',
        ms: 1600,
        body: { bodyTilt: -15.0, eyeGazeX: 0.7, leftFootY: 5, rightFootY: 0 },
      },
    ],

    // 5. Tilt Right: Leans right, gaze counter-balances, feet shuffle
    tiltR: [
      {
        mood: 'curious',
        text: 'whoa, leaning right~',
        ms: 1600,
        body: { bodyTilt: 15.0, eyeGazeX: -0.7, leftFootY: 0, rightFootY: 5 },
      },
    ],

    // 6. Flip (Upside Down): Hands fly up, panic eyes, then annoyed
    flip: [
      {
        mood: 'surprised',
        text: 'WHOA! Upside down?! 🙃',
        ms: 1400,
        body: { leftHandY: -45, rightHandY: -45, bodyScaleY: 1.15, isFlailing: true },
      },
      {
        mood: 'annoyed',
        text: 'put me down, please! 🙄',
        ms: 1400,
        body: { leftHandY: -35, rightHandY: -35 },
      },
    ],

    // 7. Sleep: Yawn, droop down, eyelids close, slow breathing zzz
    sleep: [
      {
        mood: 'sleepy',
        text: '*yawn*... so sleepy...',
        ms: 1200,
        body: { mouthStyle: 'gasp', mouthOpen: 0.7, bodyScaleY: 1.08, bodyOffsetY: -4 },
      },
      {
        mood: 'sleepy',
        text: 'zzz... 💤',
        ms: 3000,
        body: { bodyScaleY: 0.92, bodyOffsetY: 10, leftHandY: 8, rightHandY: 8 },
      },
    ],

    // 8. Wake: Rubs eyes, tall stretch, happy morning greeting
    wake: [
      {
        mood: 'surprised',
        text: 'huh?! *stretch*',
        ms: 700,
        body: { bodyScaleY: 1.18, bodyScaleX: 0.88, bodyOffsetY: -16, rightHandY: -32, leftHandY: -32 },
      },
      {
        mood: 'happy',
        text: 'Good morning! ☀️',
        ms: 1000,
        body: { bodyScaleY: 1.0, bodyScaleX: 1.0, bodyOffsetY: 0, isWaving: true },
      },
    ],
  };

  MICRO_BEHAVIORS = {
    lookAround: [
      {
        mood: 'curious',
        text: '',
        ms: 900,
        body: { bodyTilt: -6.0, eyeGazeX: -0.85, eyeGazeY: -0.2 },
      },
      {
        mood: 'curious',
        text: '',
        ms: 900,
        body: { bodyTilt: 6.0, eyeGazeX: 0.85, eyeGazeY: 0.1 },
      },
    ],
    yawn: [
      {
        mood: 'sleepy',
        text: '*yawn* 🥱',
        ms: 1200,
        body: { mouthStyle: 'gasp', mouthOpen: 0.8, bodyScaleY: 1.1, bodyOffsetY: -6 },
      },
      {
        mood: 'neutral',
        text: '',
        ms: 600,
        body: { bodyScaleY: 1.0, bodyOffsetY: 0 },
      },
    ],
    wave: [
      {
        mood: 'happy',
        text: 'hey there! 👋',
        ms: 1300,
        body: { isWaving: true, rightHandY: -30 },
      },
    ],
    footTap: [
      {
        mood: 'neutral',
        text: '♪',
        ms: 350,
        body: { leftFootY: 8, rightFootY: 0, corePulse: 1.2 },
      },
      {
        mood: 'neutral',
        text: '♪',
        ms: 350,
        body: { leftFootY: 0, rightFootY: 8, corePulse: 1.3 },
      },
      {
        mood: 'neutral',
        text: '♪',
        ms: 350,
        body: { leftFootY: 8, rightFootY: 0, corePulse: 1.2 },
      },
    ],
    hum: [
      {
        mood: 'happy',
        text: 'hmmm 🎶',
        ms: 1200,
        body: { corePulse: 1.45, bodyOffsetY: -4, bodyScaleY: 1.05 },
      },
    ],
  };
}
