/**
 * moods.js — Mood Definitions, BASE State & Tuning Constants.
 * Defines the 10 core moods and full body parameters for the Physical AI Companion.
 */

export const CONSTANTS = {
  // Spring Physics Tuning (Stiffness & Damping)
  bodySpring: 12.0,       // Torso spring speed
  eyeSpring: 16.0,        // Eye and gaze spring speed
  handSpring: 9.0,        // Hands follow-through lag (lower = more lag)
  blinkSpeed: 38.0,       // Blink close/open speed
  
  // Timing
  idleMicroMin: 4000,     // Min ms between idle micro-behaviors (4s)
  idleMicroMax: 8000,     // Max ms between idle micro-behaviors (8s)
  idleSleepTimeout: 15000,// Inactivity time before falling asleep (15s)
  petHoldThreshold: 550,  // Milliseconds of hold to trigger 'pet' instead of 'poke'
  shakeThreshold: 14.0,   // Motion delta threshold (m/s^2) for shake detection
  controlsTimeout: 4200,  // Duration in ms that shake-to-controls stays open
  
  // Blink intervals
  blinkIntervalMin: 1800,
  blinkIntervalMax: 4800,
  blinkDuration: 110,
};

export const BASE_STATE = {
  // Body scale & displacement (squash / stretch)
  bodyScaleX: 1.0,
  bodyScaleY: 1.0,
  bodyOffsetY: 0.0,
  bodyTilt: 0.0,        // Degrees tilt (-15 to +15)
  bodyWobble: 0.0,      // Rapid oscillation amplitude

  // Breathing & Life Pulse
  breathSpeed: 1.0,
  breathAmp: 2.5,
  corePulse: 1.0,
  coreColor: '#FF6B8B',
  blushOpacity: 0.65,

  // Eyes Geometry
  eyeWidth: 26.0,
  eyeHeight: 36.0,
  eyeOpenL: 1.0,
  eyeOpenR: 1.0,
  eyeGazeX: 0.0,        // [-1.0 to 1.0]
  eyeGazeY: 0.0,        // [-1.0 to 1.0]
  eyeShape: 'capsule',  // 'capsule', 'crescent', 'heart', 'spiral', 'droopy', 'squint'
  shineOpacity: 1.0,
  eyebrowSlant: 0.0,    // Degrees: negative = worried/sad, positive = stern/annoyed

  // Mouth Geometry
  mouthStyle: 'smile',  // 'smile', 'talking', 'gasp', 'pout', 'cheeky', 'sad', 'neutral'
  mouthOpen: 0.1,       // [0.0 to 1.0]
  mouthWidth: 22.0,
  mouthCurve: 0.5,      // [-1.0 frown to +1.0 big smile]

  // Limbs (Hands & Arms)
  leftHandX: 0.0,
  leftHandY: 0.0,
  leftHandRot: 0.0,     // Degrees
  rightHandX: 0.0,
  rightHandY: 0.0,
  rightHandRot: 0.0,    // Degrees
  isWaving: false,
  isFlailing: false,

  // Limbs (Feet & Boots)
  leftFootY: 0.0,
  rightFootY: 0.0,
  footWiggle: false,

  // Particles & Overlays
  zzz: 0.0,
  sweat: 0.0,
  hearts: 0.0,
  sparks: 0.0,

  // Shake-to-Controls Morph Progress (0.0 = Character, 1.0 = 3-Button Controls)
  morphProgress: 0.0,
};

export const MOODS = {
  // 1. Neutral: Attentive, gentle breathing, relaxed smile
  neutral: {
    ...BASE_STATE,
  },

  // 2. Happy: Cheerful anime ^ ^ crescent eyes, wide warm smile, rosy cheeks, gentle bounce
  happy: {
    ...BASE_STATE,
    eyeShape: 'crescent',
    eyeHeight: 40.0,
    mouthStyle: 'smile',
    mouthOpen: 0.35,
    mouthCurve: 0.85,
    mouthWidth: 26.0,
    blushOpacity: 0.95,
    corePulse: 1.25,
    breathSpeed: 1.2,
    bodyOffsetY: -3.0,
  },

  // 3. Excited: Huge sparkly wide eyes, mouth wide open with tongue, star sparkles, rapid bounce
  excited: {
    ...BASE_STATE,
    eyeWidth: 29.0,
    eyeHeight: 44.0,
    mouthStyle: 'talking',
    mouthOpen: 0.75,
    mouthCurve: 0.9,
    mouthWidth: 28.0,
    blushOpacity: 1.0,
    corePulse: 1.45,
    sparks: 1.0,
    bodyOffsetY: -6.0,
    breathSpeed: 1.8,
  },

  // 4. Sleepy: Drooping heavy eyelids, slow calm breathing, tiny relaxed mouth, floating Zzz
  sleepy: {
    ...BASE_STATE,
    eyeOpenL: 0.28,
    eyeOpenR: 0.28,
    eyeShape: 'droopy',
    shineOpacity: 0.2,
    mouthStyle: 'neutral',
    mouthOpen: 0.05,
    mouthCurve: 0.2,
    mouthWidth: 16.0,
    blushOpacity: 0.3,
    corePulse: 0.65,
    breathSpeed: 0.45,
    breathAmp: 3.5,
    bodyOffsetY: 5.0,
    zzz: 1.0,
  },

  // 5. Curious: Asymmetrical tilt, gaze pointing sideways, one eyebrow raised, cat smile
  curious: {
    ...BASE_STATE,
    bodyTilt: 7.5,
    eyeOpenL: 1.05,
    eyeOpenR: 0.9,
    eyeGazeX: 0.45,
    eyeGazeY: -0.2,
    eyebrowSlant: 6.0,
    mouthStyle: 'cheeky',
    mouthOpen: 0.2,
    mouthCurve: 0.65,
    mouthWidth: 20.0,
    blushOpacity: 0.7,
    corePulse: 1.1,
  },

  // 6. Sad: Drooping eyes with downward slant, quivering frown, sweat tear, slumping body
  sad: {
    ...BASE_STATE,
    eyeOpenL: 0.65,
    eyeOpenR: 0.65,
    eyeShape: 'droopy',
    eyebrowSlant: -10.0,
    mouthStyle: 'sad',
    mouthOpen: 0.15,
    mouthCurve: -0.75,
    mouthWidth: 20.0,
    blushOpacity: 0.15,
    corePulse: 0.75,
    bodyScaleY: 0.94,
    bodyOffsetY: 6.0,
    sweat: 1.0,
  },

  // 7. Annoyed: Tight squinted eyes, flat horizontal pout line, hands on hips, zero blush
  annoyed: {
    ...BASE_STATE,
    eyeShape: 'squint',
    eyeHeight: 22.0,
    eyebrowSlant: 12.0,
    mouthStyle: 'pout',
    mouthOpen: 0.0,
    mouthCurve: -0.35,
    mouthWidth: 26.0,
    blushOpacity: 0.1,
    corePulse: 0.8,
    bodyScaleX: 0.96,
  },

  // 8. Love: Heart-shaped glowing eyes, max blush, throbbing ruby heart core, floating hearts
  love: {
    ...BASE_STATE,
    eyeShape: 'heart',
    eyeHeight: 38.0,
    mouthStyle: 'smile',
    mouthOpen: 0.3,
    mouthCurve: 0.8,
    mouthWidth: 24.0,
    blushOpacity: 1.0,
    corePulse: 1.5,
    hearts: 1.0,
    footWiggle: true,
    breathSpeed: 1.3,
  },

  // 9. Surprised: Extra-tall dilated pupils, open round O mouth, stretched body, raised paws
  surprised: {
    ...BASE_STATE,
    eyeWidth: 30.0,
    eyeHeight: 46.0,
    mouthStyle: 'gasp',
    mouthOpen: 0.85,
    mouthCurve: 0.0,
    mouthWidth: 16.0,
    blushOpacity: 0.5,
    bodyScaleX: 0.92,
    bodyScaleY: 1.12,
    bodyOffsetY: -10.0,
    leftHandY: -18.0,
    rightHandY: -18.0,
    corePulse: 1.3,
  },

  // 10. Dizzy: Spinning spiral eyes, body wobble, wavy mouth, sweat droplet
  dizzy: {
    ...BASE_STATE,
    eyeShape: 'spiral',
    eyeHeight: 36.0,
    mouthStyle: 'pout',
    mouthOpen: 0.3,
    mouthCurve: 0.1,
    mouthWidth: 24.0,
    bodyWobble: 14.0,
    sweat: 1.0,
    blushOpacity: 0.4,
    corePulse: 1.1,
  },
};
