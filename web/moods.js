/**
 * web/moods.js — Mood Definitions, BASE State & Tuning Constants for Kitsune Companion.
 * 
 * Defines the 10 core moods mapped to fox ears, multi-segment tail, eyes,
 * glowing forehead spirit crest, and floating wisps.
 */

export const CONSTANTS = {
  // Spring Physics Tuning (Stiffness & Damping)
  bodySpring: 13.0,       // Torso spring speed
  eyeSpring: 16.0,        // Eye and gaze spring speed
  earSpring: 14.0,        // Ears spring speed (independent perked/droop)
  tailSpring: 11.0,       // Tail spring follow-through speed
  blinkSpeed: 38.0,       // Blink close/open speed
  
  // Timing
  idleMicroMin: 3500,     // Min ms between autonomous micro-behaviors (3.5s)
  idleMicroMax: 7000,     // Max ms between autonomous micro-behaviors (7.0s)
  idleSleepTimeout: 30000,// Inactivity time before falling asleep (30s)
  petHoldThreshold: 450,  // Milliseconds of hold to trigger 'pet' instead of 'poke'
  strokeThreshold: 18,    // Pointer movement distance during hold to trigger stroke pet
  flickVelocityThreshold: 1.2, // Pointer drag release velocity to trigger fling/flick
  shakeThreshold: 14.0,   // Motion delta threshold (m/s^2) for shake detection
  controlsTimeout: 4200,  // Duration in ms that shake-to-controls stays open
  
  // Blink intervals
  blinkIntervalMin: 1800,
  blinkIntervalMax: 4800,
  blinkDuration: 110,
};

export const BASE_STATE = {
  // Body scale & displacement (squash / stretch / bounce)
  bodyScaleX: 1.0,
  bodyScaleY: 1.0,
  bodyOffsetY: 0.0,
  bodyTilt: 0.0,          // Degrees tilt (-20 to +20)
  bodyWobble: 0.0,        // Rapid oscillation amplitude

  // Breathing & Life Pulse
  breathSpeed: 1.0,
  breathAmp: 2.5,
  foreheadGlow: 1.0,      // Kitsune crest glow intensity [0.0 - 2.0]
  blushOpacity: 0.65,

  // Independently Driven Ears
  earLRot: 0.0,           // Left ear rotation (deg, negative = perked outwards)
  earRRot: 0.0,           // Right ear rotation (deg, positive = perked outwards)
  earLFold: 1.0,          // Left ear vertical compression [0.4 flat - 1.25 tall]
  earRFold: 1.0,          // Right ear vertical compression

  // Multi-Segment Tail Physics
  tailAngle: 0.0,         // Base tail angle relative to resting
  tailWagSpeed: 1.0,      // Wag oscillation frequency
  tailWagAmp: 0.25,       // Wag oscillation amplitude
  tailCurl: 0.0,          // Tail curvature along spine (deg)
  tailPuff: false,        // Fluff up tail (surprised / excited)

  // Floating Wisps
  wispSpeed: 1.0,

  // Eyes Geometry
  eyeWidth: 28.0,
  eyeHeight: 38.0,
  eyeOpenL: 1.0,
  eyeOpenR: 1.0,
  eyeGazeX: 0.0,          // [-1.0 to 1.0]
  eyeGazeY: 0.0,          // [-1.0 to 1.0]
  eyeShape: 'capsule',    // 'capsule', 'crescent', 'heart', 'spiral', 'droopy', 'squint'
  shineOpacity: 1.0,
  eyebrowSlant: 0.0,

  // Mouth & Face Details
  mouthStyle: 'smile',    // 'smile', 'talking', 'gasp', 'pout', 'cheeky', 'sad', 'neutral'
  mouthOpen: 0.0,         // [0.0 to 1.0]
  mouthWidth: 18.0,
  mouthCurve: 0.5,        // [-1.0 frown to +1.0 big smile]
  pawWiggle: false,

  // Vector Canvas Emote Badge (null, 'exclamation', 'question', 'heart', 'music', 'sparkle', 'zzz')
  activeEmote: null,

  // Shake-to-Controls Morph Progress (0.0 = Character, 1.0 = 3-Button Controls)
  morphProgress: 0.0,
};

export const MOODS = {
  // 1. Neutral: Ears gently perked, calm tail sway, warm gentle forehead glow
  neutral: {
    ...BASE_STATE,
  },

  // 2. Happy: Joyful ^ ^ eyes, ears perked and perky, brisk wagging tail, rosy cheeks
  happy: {
    ...BASE_STATE,
    eyeShape: 'crescent',
    eyeHeight: 40.0,
    earLRot: -6.0,
    earRRot: 6.0,
    earLFold: 1.08,
    earRFold: 1.08,
    tailAngle: 12.0,
    tailWagSpeed: 2.8,
    tailWagAmp: 0.55,
    tailCurl: 15.0,
    tailPuff: true,
    mouthStyle: 'smile',
    mouthOpen: 0.35,
    mouthCurve: 0.85,
    blushOpacity: 0.95,
    foreheadGlow: 1.3,
    breathSpeed: 1.25,
    bodyOffsetY: -3.0,
    activeEmote: 'music',
  },

  // 3. Excited: Sparkle wide eyes, ears perked tall, tail puffed & hyper-wagging, dancing wisps
  excited: {
    ...BASE_STATE,
    eyeWidth: 30.0,
    eyeHeight: 44.0,
    earLRot: -14.0,
    earRRot: 14.0,
    earLFold: 1.18,
    earRFold: 1.18,
    tailAngle: 22.0,
    tailWagSpeed: 4.2,
    tailWagAmp: 0.75,
    tailPuff: true,
    mouthStyle: 'talking',
    mouthOpen: 0.75,
    mouthCurve: 0.9,
    blushOpacity: 1.0,
    foreheadGlow: 1.6,
    wispSpeed: 2.2,
    activeEmote: 'sparkle',
    bodyOffsetY: -6.0,
    breathSpeed: 1.8,
  },

  // 4. Sleepy: Ears droop flat sideways, tail curls round body, heavy eyelids, slow breathing, zzz
  sleepy: {
    ...BASE_STATE,
    earLRot: 36.0,
    earRRot: -36.0,
    earLFold: 0.7,
    earRFold: 0.7,
    tailAngle: -35.0,
    tailWagSpeed: 0.25,
    tailWagAmp: 0.06,
    tailCurl: -48.0,
    eyeOpenL: 0.24,
    eyeOpenR: 0.24,
    eyeShape: 'droopy',
    shineOpacity: 0.25,
    mouthStyle: 'neutral',
    mouthOpen: 0.05,
    mouthCurve: 0.2,
    blushOpacity: 0.3,
    foreheadGlow: 0.35,
    breathSpeed: 0.45,
    breathAmp: 3.5,
    bodyOffsetY: 6.0,
    activeEmote: 'zzz',
  },

  // 5. Curious: One ear perked, one swiveled, head cocked sideways, tail tip twitching, '?'
  curious: {
    ...BASE_STATE,
    earLRot: -16.0,
    earRRot: 24.0,
    earLFold: 1.12,
    earRFold: 0.82,
    bodyTilt: 9.5,
    tailAngle: -10.0,
    tailWagSpeed: 2.2,
    tailWagAmp: 0.35,
    tailCurl: 20.0,
    eyeOpenL: 1.05,
    eyeOpenR: 0.88,
    eyeGazeX: 0.45,
    eyeGazeY: -0.2,
    eyebrowSlant: 6.0,
    mouthStyle: 'cheeky',
    mouthOpen: 0.15,
    mouthCurve: 0.65,
    blushOpacity: 0.7,
    foreheadGlow: 1.1,
    activeEmote: 'question',
  },

  // 6. Sad: Ears pinned flat, tail tucked low, downward droopy eyes, frown
  sad: {
    ...BASE_STATE,
    earLRot: 44.0,
    earRRot: -44.0,
    earLFold: 0.65,
    earRFold: 0.65,
    tailAngle: -40.0,
    tailWagSpeed: 0.2,
    tailWagAmp: 0.05,
    tailCurl: -25.0,
    eyeOpenL: 0.6,
    eyeOpenR: 0.6,
    eyeShape: 'droopy',
    eyebrowSlant: -10.0,
    mouthStyle: 'sad',
    mouthOpen: 0.15,
    mouthCurve: -0.75,
    blushOpacity: 0.15,
    foreheadGlow: 0.3,
    bodyScaleY: 0.94,
    bodyOffsetY: 6.0,
  },

  // 7. Annoyed: Airplane ears flat out, twitchy tail swish, tight squint, flat pout
  annoyed: {
    ...BASE_STATE,
    earLRot: 54.0,
    earRRot: -54.0,
    earLFold: 0.58,
    earRFold: 0.58,
    tailAngle: 25.0,
    tailWagSpeed: 3.5,
    tailWagAmp: 0.6,
    tailCurl: -12.0,
    eyeShape: 'squint',
    eyeHeight: 20.0,
    eyebrowSlant: 12.0,
    mouthStyle: 'pout',
    mouthOpen: 0.0,
    mouthCurve: -0.35,
    blushOpacity: 0.1,
    foreheadGlow: 0.7,
    bodyScaleX: 0.96,
  },

  // 8. Love: Heart glowing eyes, tail wrapping toward viewer, max blush, pulsating mark glow
  love: {
    ...BASE_STATE,
    earLRot: -8.0,
    earRRot: 8.0,
    earLFold: 1.05,
    earRFold: 1.05,
    eyeShape: 'heart',
    eyeHeight: 38.0,
    tailAngle: -15.0,
    tailWagSpeed: 1.6,
    tailWagAmp: 0.32,
    tailCurl: 36.0,
    tailPuff: true,
    mouthStyle: 'smile',
    mouthOpen: 0.3,
    mouthCurve: 0.8,
    blushOpacity: 1.0,
    foreheadGlow: 1.55,
    pawWiggle: true,
    breathSpeed: 1.3,
    activeEmote: 'heart',
  },

  // 9. Surprised: Both ears shot straight up, sudden stretch, tail puffed up, '!'
  surprised: {
    ...BASE_STATE,
    earLRot: -18.0,
    earRRot: 18.0,
    earLFold: 1.25,
    earRFold: 1.25,
    eyeWidth: 32.0,
    eyeHeight: 46.0,
    tailAngle: 28.0,
    tailWagSpeed: 0.5,
    tailWagAmp: 0.1,
    tailPuff: true,
    mouthStyle: 'gasp',
    mouthOpen: 0.85,
    mouthCurve: 0.0,
    blushOpacity: 0.5,
    bodyScaleX: 0.9,
    bodyScaleY: 1.15,
    bodyOffsetY: -12.0,
    foreheadGlow: 1.4,
    activeEmote: 'exclamation',
  },

  // 10. Dizzy: Spinning spiral eyes, asymmetric wobbly ears, disoriented wobble
  dizzy: {
    ...BASE_STATE,
    eyeShape: 'spiral',
    eyeHeight: 36.0,
    earLRot: 30.0,
    earRRot: 12.0,
    earLFold: 0.8,
    earRFold: 0.9,
    tailAngle: 0.0,
    tailWagSpeed: 4.0,
    tailWagAmp: 0.85,
    mouthStyle: 'pout',
    mouthOpen: 0.3,
    mouthCurve: 0.1,
    bodyWobble: 16.0,
    blushOpacity: 0.4,
    foreheadGlow: 0.9,
  },
};
