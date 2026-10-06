# Physical AI Companion — Master State & Specification

> **NOTE FOR ANY AI ASSISTANT / RESUMED CONVERSATION**:
> This document is the single source of truth for the Physical AI Companion project. Read this file completely to understand 100% of the project vision, technical architecture, current progress, and immediate next steps. Do not start from scratch or re-invent fundamentals.

---

## 1. Project Vision & Philosophy

- **Product Concept**: A tiny, lightweight, keychain-sized physical AI companion device with a display covering most/all of its visible front (cube form-factor).
- **Core Mantra**:
  - **UTILITY** gets the device used.
  - **PERSONALITY** makes the user care about it.
- **The Physical Role**: The phone is the main computational hub. The physical device is the companion's:
  - Face & Eyes (OLED display, expressive procedural character)
  - Ears & Microphone (beat detection, ambient listening)
  - Physical Presence (on keys or desk, glanceable, always alive)
- **Ultimate Project Goal**: Build a real prototype → put it in people's hands → validate demand → **sell the first unit**.

---

## 2. Character Persona & Interaction Paradigm

- **Personality Type**: **Expressive / Non-verbal (Tamagotchi / Wall-E / Pokémon style)**.
  - Expressive animated eyes/face, procedural chirps/beeps/purrs, body language, glanceable icons.
  - Not an annoying voice assistant; an ambient living creature.
- **Core Interaction Layers**:
  1. **Ambient & Reactive (Always-on)**:
     - Follows user's face/gaze using camera.
     - Head-bobs and pulses to music beat automatically.
     - Emotively alerts on phone events (messages, calls, timers).
     - Sleeps when dark/alone, wakes up when user appears.
  2. **Tactile & Shake-to-Control (Hero Control UX)**:
     - **Shake the cube**: The character morphs into media controls:
       - **Left Hand** = `⏮ Previous`
       - **Body / Belly** = `⏯ Play / Pause`
       - **Right Hand** = `⏭ Next`
     - Tapping the respective zone fires the command with squishy visual feedback.
  3. **Life State & Evolution (Tamagotchi Layer)**:
     - Internal states: Attachment level, Energy, Boredom, Temperament.
     - Persists to disk; evolves based on how the user interacts over days.

---

## 3. Technical & AI Architecture

### 90–95% Deterministic / Specialized ML vs 5–10% SLM Reasoning
- **Deterministic & Fast (~90–95%)**:
  - 60 FPS Procedural Character Eye Renderer & Saccades (PySide6 / OpenGL).
  - Face / Iris tracking (OpenCV / MediaPipe).
  - Audio FFT / Beat onset detection (PyAudio / sounddevice / numpy).
  - FSM State transitions (Sleep, Idle, Engaged, Grooving, ControlMode, Alert).
- **Dual-Lane Routing Architecture**:
  1. **Fast Deterministic Lane (~90%)**:
     - Direct hardware actions: `NEXT_TRACK`, `PREVIOUS_TRACK`, `TAKE_PHOTO`, `SET_TIMER`.
     - Zero generative latency; executes action immediately with snappy visual/audio feedback.
  2. **AI Personality Lane (~10%)**:
     - Both `CONVERSATION` and unmapped/open-ended queries flow here.
     - **The companion NEVER tells the user "UNKNOWN" or emits robotic errors.**
     - `UNKNOWN` is purely an internal safety flag meaning *"do not touch camera or media controls"*. The character responds in playful persona, witty banter, or thoughtful deflections.
- **SLM Subconscious (~5–10%)**:
  - Model: `SmolLM2-135M-Instruct` or `SmolLM2-360M-Instruct` (Unsloth / local QLoRA).
  - Runs **asynchronously in the background** every 15–30s or on conversational triggers.
  - Acts as the "subconscious director": generates inner thoughts, adjusts mood bias, picks spontaneous micro-actions, handles rare natural language queries.

---

## 4. Five-Phase Implementation Roadmap

- [x] **Phase 1: The Living Cube & Morphing Controls** *(COMPLETE & TESTED)*
  - Standalone 360x360 OLED cube simulator window (frameless, dark mode, floating).
  - Procedural glowing cyan/mint eyes with damped spring gaze tracking, realistic blinks, saccades, and breathing.
  - Shake detection (mouse shake / 'S' key / spacebar) morphing the character into the 3-button control UI:
    - Left Hand = `⏮ Previous`
    - Belly = `⏯ Play / Pause`
    - Right Hand = `⏭ Next`
  - Squish hover/click animations, action logging, and auto-return to face mode.
- [x] **Phase 2: Live Perception (Webcam Gaze & Audio Beat)** *(COMPLETE & TESTED)*
  - OpenCV YuNet DNN neural face detector running in background thread; character eyes physically follow user's real face in 3D space.
  - Real-time audio FFT & RMS energy / beat onset detection; character head-bobs and pulses to music rhythm.
- [x] **Phase 3: Phone Event Console & Emotive Reactions** *(COMPLETE & TESTED)*
  - Dev Phone Simulator panel to trigger mock WhatsApp messages, incoming calls, timers, battery alerts, and Spotify state.
  - Expressive character animations & procedural audio SFX (Wall-E / R2-D2 style rising chirps, alert pings, clicks, whimpers).
- [x] **Phase 4: Tamagotchi Life State Engine** *(COMPLETE & TESTED)*
  - Persistent memory tracking attachment level (Stranger -> Soulmate), energy, boredom, and dynamic moods.
  - Saves locally to `data/life_state.json`; evolves dynamically across user interactions.
- [x] **Phase 5: SmolLM2-360M Subconscious Brain** *(COMPLETE & TESTED)*
  - Async background reasoning engine generating inner thoughts and contextual micro-actions every 18s or on events.
  - Press `[I]` on the cube to inspect the real-time AI Thought and Companion Status HUD.

## 5. Completed MVP Demonstration Architecture

1. **Perception**:
   - Neural Face Tracker (OpenCV YuNet DNN): detects person arrival (`PERSON_DETECTED`) and continuously tracks gaze vector in 3D.
   - Microphone Speech Recognition (`SpeechRecognition` + `pyaudio`): live voice listening in background.
   - Interactive Dev Console: one-click utterance buttons, custom typing bar, simulated phone events, keyboard gestures (`[S]` shake).
2. **Intent Engine**:
   - 6-class deterministic intent classifier (`NEXT_TRACK`, `PREVIOUS_TRACK`, `TAKE_PHOTO`, `SET_TIMER`, `CONVERSATION`, `UNKNOWN`) with parameter extraction (timer seconds).
3. **Actions**:
   - Song skip: advances playlist, updates memory, triggers system `playerctl`.
   - Take photo: captures frame and saves to `photos/photo_*.jpg`.
   - Set timer: real countdown timer ticking every second with audio alarm and notification on completion.
4. **Light Theme & Character Anatomy (V3 Colorful Edition)**:
   - **Light Theme Architecture**:
     - *Simulator Bezel*: Ceramic pearl off-white casing (`#F8FAFC`, border `#CBD5E1`) with 44px rounded corners.
     - *Screen Canvas*: Crisp modern light display surface (`#FFFFFF` to `#F1F5F9`, border `#E2E8F0`).
     - *Dev Phone Console*: Styled in matching clean light theme with white group cards and vibrant `#0284C7` accents.
     - *Dialogue Bubble*: Floating white pill card with soft drop shadow, `#0284C7` border, and crisp `#0F172A` text.
   - **Vibrant Character Anatomy**:
     - *Chassis / Torso*: Vibrant, cheerful Sky-Blue gradient (`#38BDF8` -> `#0EA5E9` -> `#0284C7`) with glossy curved head highlight arc and ambient drop shadow.
     - *Belly Patch*: Soft creamy rounded tummy (`#FFFFFF` to `#F0F9FF`, border `#BAE6FD`).
     - *Chest Core / Heart Gem*: Glowing pulsing rosy ruby power gem (`#FF6B8B` -> `#F43F5E`) centered in belly patch.
     - *Rosy Cheeks*: Soft blushing pink ovals (`#FB7185`) under eyes that pulse warmly with emotion.
     - *Expressive Eyes*: Deep glossy sapphire irises with electric cyan rims, bright dual specular shine highlights (Pixar/anime life spark), and curved joyful crescent `^ ^` eyes on happy/greetings.
     - *Animated Mouth*: Warm ruby lips (`#E11D48`) with soft pink tongue (`#FDA4AF`) when talking; curves into cheerful smile, flat pout, or open gasp.
     - *Hands & Paws*: Floating rounded pill mittens in matching sky-blue with soft white palm pads and rosy center dots. Right hand waves enthusiastically on greetings (`trigger_wave`).
     - *Legs & Boots*: Rounded deep azure boots beneath chassis with crisp white/cyan sole treads, tapping to audio beats.
     - *Ear Caps*: Golden amber headphone nubs (`#F59E0B`) with glowing mint LED centers on the sides of the head.
5. **Templates (No Generative Hallucination, Clean Fallbacks)**:
   - `NEXT_TRACK` -> "Skipping that one..." -> annoyed animation
   - `TAKE_PHOTO` -> "Say cheese! *click*" -> camera shutter flash
   - `SET_TIMER` -> "Timer set for {duration}!" -> attentive animation
   - `CONVERSATION` -> "Entertain yourself, mortal! Or tap my belly." -> cheeky animation
   - `PERSON_DETECTED` -> "I see you!" -> perked_up animation
6. **Basic Memory & Context**:
   - Stores current song, recent command history, active timer countdown, persistent preferences (`data/companion_memory.json`).
7. **Phone Bridge & Event Simulator**:
   - Simulates external phone push alerts (WhatsApp messages, incoming phone calls, low battery).
   - Routed cleanly via `process_phone_event()`, triggering contextual character dialogue reactions and procedural chime SFX without crashing intent classifier.

---

## 6. AI Model, Training Setup & Structured Semantic State

### Strict Semantic State Schema
Downstream consumers and the Behavior Engine receive a strict, deterministic schema:
```json
{
  "primary_intent": "NEXT_TRACK",
  "confidence": 0.96,
  "intent_scores": {
    "NEXT_TRACK": 0.96,
    "PREVIOUS_TRACK": 0.01,
    "TAKE_PHOTO": 0.01,
    "SET_TIMER": 0.01,
    "CONVERSATION": 0.01,
    "UNKNOWN": 0.00
  },
  "emotion": "annoyed",
  "attention": "user",
  "energy": 0.75,
  "parameters": {
    "duration_sec": null
  }
}
```

### Models & Training
- **Supported Models**: IBM Granite 4.0 / 3.0 (`ibm-granite/granite-4.0-micro-instruct` or `granite-3.0-1b-a400m-instruct`) or `unsloth/SmolLM2-135M-Instruct`.
- **Directory Layout**:
  - `ai/datasets/intent_train.jsonl` — 315+ records with full `semantic_state` targets, ASR noise, and duration slots.
  - `ai/datasets/intent_eval.jsonl` — 120 held-out evaluation records with full `semantic_state` targets.
  - `ai/training/train_unsloth.py` — QLoRA training script using native `tokenizer.apply_chat_template`.
  - `ai/evaluation/eval_suite.py` — Benchmark suite computing Confusion Matrix, Precision, Recall, and F1.
  - `ai/models/` — Saved LoRA checkpoints.

---

## 7. Current Project File Layout

```
ai-companion/
├── COMPANION_STATE.md       # Master specification and state
├── run_companion.py         # Main entry point for Full MVP
├── ai/
│   ├── datasets/
│   │   └── intent_train.jsonl  # Training dataset for Unsloth
│   └── training/
│       └── train_unsloth.py    # Unsloth fine-tuning script (SmolLM2-135M)
├── photos/                  # Saved webcam photos from TAKE_PHOTO
├── data/                    # Persistent memory & life state JSONs
└── src/
    ├── speech/              # Speech recognition listener (PyAudio + SR)
    ├── intent/              # 6-class intent classifier & parser
    ├── actions/             # Real actions (Music skip, photo save, timers)
    ├── templates/           # Personality templates & expression mappings
    ├── memory/              # Context memory (song, timer, command history)
    ├── renderer/            # 60 FPS Procedural OLED display & SFX
    ├── perception/          # Neural face tracking & audio beat detector
    └── phone_bridge/        # Dev test console & phone simulator
```
