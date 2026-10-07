# Physical AI Companion 🦊✨

A keychain-sized, mythic physical AI companion device designed with **personality-first** interaction.

This repository implements the **Stage 1 Phone Character & The Smile Test** as a zero-dependency, 60 FPS mobile Web PWA featuring a **Kitsune Fox-Spirit Cub**.

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

The creature fills the entire screen on a soft atmospheric twilight scene with **no device frames and no buttons**. It feels alive on its own and responds to direct physical touch.

### 1. Direct Touch Gestures
* **Body / Head Tap (Poke)**: Squishes down with anticipation, hops up into a joyful bounce with sparkles.
* **Ear Tap**: The tapped ear twitches and folds down while the other perks high, tilting the head in surprise with a `?` emote.
* **Tail Tap**: Tail flicks away defensively as the fox swats around playfully.
* **Hold (Pet)**: Leans affectionately into your finger, purrs, switches to glowing heart eyes, and wiggles its paws.
* **Slow Stroke / Drag**: Continuous stroking purr that deepens with movement; half-closed blissful eyes and swaying tail.
* **Quick Flick / Swipe**: Fling the creature across the screen; it bounces back with spring overshoot, dizzy spiral eyes, and shakes it off.

### 2. Autonomous Life (No Touching Required)
Without any input, the kitsune spontaneously performs randomized, non-repeating micro-behaviors every 3.5–7 seconds:
* **Look Around**: Inquisitive head cock and ear swivel with darting gaze.
* **Yawn**: Sleepy wide mouth yawn with flattening ears and a slow stretch.
* **Stretch**: Front paws reach down, tail arches high, ears shake.
* **Chase Tail**: Circles around curiously chasing its glowing tail tip.
* **Sneeze Wisp**: Nose scrunches up, body tenses, and *achoo!* sneezes out a spirit wisp with a burst of starlight sparkles!
* **Ear Twitch**: Independent left-then-right ear flick to shake off dust.
* **Autonomous Sleep Watchdog**: If left untouched for ~30 seconds, it curls up with its tail wrapped around its body and drifts into a peaceful nap (`💤`).
* **Dynamic Wakeup**: Wakes happily (stretching, music note) if left in good spirits, or grumpy (sleepy pout, flat ears) if left after being shaken.

---

## 📱 Shake-to-Controls (Hero UX)

* **Physical Shake**: Accelerometer detects shake ($\Delta a > 14\text{ m/s}^2$). The fox wobbles with dizzy spiral eyes, gets mildly annoyed, and then morphs into **3 squishy media control pads**:
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

* **Unobtrusive Bottom Strip**: Appears smoothly 2.2 seconds after an interaction ends and auto-hides after 7 seconds, never covering the creature.
* **Metrics Tracked**:
  * Per-reaction Yes/No smile counts.
  * Overall smile conversion rate (%).
  * Time-to-first-smile stopwatch (recorded in seconds from page load).
* **Export**: Single-click `Export JSON` copies telemetry directly to your clipboard.

### URL Modes
* **Default (`/`)**: Clean full-bleed creature. Shows the first-run motion unlock overlay on first visit, then stays clean forever.
* **`?test=1`**: Blind tester mode. Hides all developer controls so testers experience the companion organically.
* **`?dev=1`**: Developer mode. Reveals real-time reaction buttons, 10 mood preview switches, and telemetry controls.

---

## 🚀 Quickstart & Run Instructions

### 1. Run Locally
```bash
cd web
python3 -m http.server 8080
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

### 2. HTTPS Deployment for Phone Sensors
> [!IMPORTANT]
> Mobile Safari (iOS) and Chrome (Android) require an **HTTPS secure context** to access `devicemotion` (shake) and `deviceorientation` (tilt).

#### Option A: GitHub Pages
```bash
git subtree push --prefix web origin gh-pages
```
Enable GitHub Pages in repo settings pointing to the `gh-pages` branch.

#### Option B: Instant Phone Tunneling
```bash
# Using Cloudflare Tunnel:
cloudflared tunnel --url http://localhost:8080

# Or using LocalTunnel:
npx localtunnel --port 8080
```
Open the generated HTTPS URL on your phone and tap once to unlock motion sensors!
