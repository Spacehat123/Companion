# Physical AI Companion 🦊✨

A keychain-sized, mythic physical AI companion device designed with **personality-first** interaction.

This repository implements the **Stage 1 Phone Character & The Smile Test** as a zero-dependency, 60 FPS mobile Web PWA featuring a **Kitsune Fox-Spirit Cub**.

---

## 🔗 Live Application Links

* **Blind Tester Experience (Recommended for Testers)**:  
  👉 **[https://spacehat123.github.io/Companion/?test=1](https://spacehat123.github.io/Companion/?test=1)**
* **Direct Fullscreen App**:  
  👉 **[https://spacehat123.github.io/Companion/](https://spacehat123.github.io/Companion/)**
* **Developer Diagnostics & Tools**:  
  👉 **[https://spacehat123.github.io/Companion/?dev=1](https://spacehat123.github.io/Companion/?dev=1)**

> **Privacy Note**: 100% of telemetry and persistence stays strictly on the client device in `localStorage`; zero network calls, zero analytics cookies, and zero external trackers.

---

## 🌟 The Kitsune Spirit Character

The character is an expressive, non-verbal fox-spirit cub designed with warm organic shapes and modular species architecture:
* **Modular Species Architecture (`web/species/fox.js`)**: All rendering lives inside a swappable species file so creatures can be changed or expanded without touching the core spring-physics engine.
* **Expressive Ears & Tail**:
  * **Independently driven ears**: Perked, flat, droopy, airplane wings, or one-up-one-down curiosity.
  * **5-Segment spring-chain tail**: Organic follow-through lag for fast wags, curls, puffs, and defensive swishes.
* **Mythic Elements**:
  * Glowing kitsune forehead crest pulsing with celestial spirit light.
  * Shimmering tail tip with golden starlight sparkles.
  * Ambient floating spirit wisps (*kitsune-bi*) orbiting gently with 3D depth.
* **Pure Canvas Vector Emotes**: Completely non-verbal. Replaces text bubbles with vector-drawn glyphs (`!`, `?`, `♥`, `♪`, `✨`, `💤`) rendered cleanly across all screens with zero font emoji box-glitches.

---

## 🖐️ Direct Touch & Autonomous Life

The creature fills ~65-70% of the screen width on a soft atmospheric twilight scene with **no device frames and no buttons**. It feels alive on its own and responds to direct physical touch.

### 1. Direct Touch Gestures
* **Body / Head Tap (Poke)**: Squishes down with anticipation, hops up into a joyful bounce with sparkles.
* **Ear Tap**: The tapped ear twitches and folds down while the other perks high, tilting the head in surprise with a `?` emote.
* **Tail Tap**: Tail flicks away defensively as the fox swats around playfully.
* **Hold (Pet)**: Leans affectionately into your finger, purrs, switches to glowing heart eyes, and wiggles its paws.
* **Slow Stroke / Drag**: Continuous stroking purr that deepens with movement; half-closed blissful eyes and swaying tail.
* **Quick Flick / Swipe**: Fling the creature across the screen; it bounces back with spring overshoot, dizzy spiral eyes, and shakes it off.

### 2. Autonomous Life & Persistence
* **Spontaneous Micro-Behaviors**: Every 3.2–6.5 seconds with zero input, the kitsune spontaneously performs randomized, non-repeating micro-behaviors:
  * `lookAround`: Inquisitive head cock and ear swivel with darting gaze.
  * `yawn`: Sleepy wide mouth yawn with flattening ears and a slow stretch.
  * `stretch`: Front paws reach down, tail arches high, ears shake.
  * `chaseTail`: Circles around curiously chasing its glowing tail tip.
  * `sneezeWisp`: Nose scrunches up, body tenses, and *achoo!* sneezes out a spirit wisp with a burst of starlight sparkles!
  * `earTwitch`: Independent left-then-right ear flick to shake off dust.
* **Autonomous Sleep Watchdog**: If left untouched for ~48 seconds, it curls up with its tail wrapped around its body and drifts into a peaceful nap (`💤`).
* **Session Memory & Reunions**:
  * Remembers when you were last together in `localStorage`.
  * **Back after a few hours**: Jumps up with an excited, bouncy reunion greeting (`✨`, high tail wag).
  * **Back after a day or more**: Sulks with flattened airplane ears and turned-away posture until forgiven with a gentle pet or stroke.

---

## 📱 Shake-to-Controls (Hero UX)

* **Physical Shake**: Accelerometer detects shake with a rolling-window direction reversal filter to reject footsteps. The fox wobbles with dizzy spiral eyes, gets mildly annoyed, and then morphs into **3 squishy media control pads**:
  * **Left Zone**: `⏮ Previous Track`
  * **Center Zone**: `⏯ Play / Pause`
  * **Right Zone**: `⏭ Next Track`
* Tapping any zone provides haptic/spring feedback, flicks the corresponding ear, logs the action stub, and auto-dismisses after 4 seconds.

---

## 💻 Desktop Testing & Keyboard Shortcuts

When testing on desktop without touch or mobile accelerometer:
* **`S`**: Hardware Shake (wobble -> dizzy -> shake-to-controls morph)
* **`F`**: Upside-down Flip
* **`L`**: Tilt Left
* **`R`**: Tilt Right
* **`Z`**: Sleep / Wake toggle
* **`Space` / `Enter`**: Poke tap
* **`P`**: Pet hold
* **Mouse Pointer**: Eyes and head tilt follow pointer gaze across the screen.

---

## 😊 The Smile Test (Empirical Delight Validation)

* **Unobtrusive Bottom Strip**: Appears smoothly 2.2 seconds after an interaction ends and auto-hides after 6.5 seconds, never covering the creature.
* **Metrics Tracked**:
  * Per-reaction Yes/No smile counts and trigger frequencies.
  * Anonymous tester ID (`fox_xxxxxx`) and device categorization (iOS/Android/Desktop).
  * Active play time stopwatch and time-to-first-smile stopwatch.
* **Easy Mobile Export**:
  * Simply **triple-tap the top-right corner** of the screen on any phone to immediately copy JSON telemetry or view results.
  * In `?dev=1`, tap **Export** or **Send** to prefill a feedback message.

---

## ⚡ Performance & Battery Optimization

* **Dynamic Framerate**: 60 FPS when active or animating; throttles to ~30 FPS during calm idle.
* **Zero Background Drain**: Loop pauses completely when the tab is hidden or backgrounded via `visibilitychange`.
* **Retina GPU Guard**: `devicePixelRatio` capped at 2.0 to eliminate thermal throttling and battery drain on high-density OLED screens.
* **Leak-Free Memory**: Zero unbounded object growth over extended sessions.

---

## 🚀 Quickstart & Run Instructions

### 1. Run Locally
```bash
cd web
python3 -m http.server 8080
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

### 2. HTTPS Deployment for Phone Sensors
Mobile Safari (iOS) and Chrome (Android) require an **HTTPS secure context** to access `devicemotion` (shake) and `deviceorientation` (tilt).

* **GitHub Pages**: Pushes to `main` are automatically published via GitHub Actions to [https://spacehat123.github.io/Companion/](https://spacehat123.github.io/Companion/).
* **Instant Phone Tunneling**:
  ```bash
  cloudflared tunnel --url http://localhost:8080
  # or
  npx localtunnel --port 8080
  ```

---

## ⚠️ Known Limitations (Stage 1 Scope)

1. **iOS Motion Permissions**: Mobile Safari requires a single explicit user tap to unlock `DeviceMotionEvent` sensors. Handled by a friendly first-visit tap-to-awaken overlay, never shown again once granted.
2. **Offline Audio / Sound**: No audio synthesis or voice assistant is included in Stage 1 by design (non-verbal visual delight validation only).
3. **Ambient Light Sensing**: Screen dimming detection is currently modeled via viewport inactivity rather than the non-standard W3C Generic Ambient Light Sensor API (unsupported in Mobile Safari).
