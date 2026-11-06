# AFTERHOURS — Real-Time Video Call, Multiplayer Gaming & Watch Together

**AFTERHOURS** is a virtual hangout lounge for friends to talk over persistent WebRTC video and audio, play real-time multiplayer games, and watch movies together with FrameX TV.

---

## 🌟 Core Architecture & Features

### 1. Persistent Live Video Call (WebRTC & LiveKit)
- **Zero Disconnection on Navigation**: The video call layout stays mounted across the entire experience. Switching between the Hangout lounge, FrameX TV, Skribbl, or Games Hub never interrupts or tears down the video call.
- **Adaptive Layout Modes**:
  - **Full Grid**: Comprehensive participant grid (default in Hangout lounge).
  - **Docked Sidebar**: Sleek persistent side panel alongside movies or games.
  - **Minimized Floating Strip**: Compact floating pill in the corner with participant mini-bubbles, live indicators, and 1-click expand.
- **Hardware Controls**:
  - Independent Microphone Mute/Unmute (mutes actual WebRTC track).
  - Camera Enable/Disable.
  - Real-Time WebRTC Screen Sharing.
  - Active Speaker Ring Detection (Web Audio API AnalyserNode).
  - Device Selector Modal (Microphone & Camera source switching).
  - Host Room Lock & Participant Removal.

### 2. Watch Together — FrameX TV Integration
- **Direct Embedded Player**: Loads `https://framextv.xyz/` in the theater viewport with `allow="autoplay; encrypted-media; fullscreen; picture-in-picture"`.
- **Sync Countdown Beacon (3-2-1)**: Room-wide synchronized countdown so all viewers hit play/seek at the exact same second.
- **Pop-Out Companion Mode**: One-click launcher opening FrameX TV in a separate tab.
- **Screen Share Mode**: Stream FrameX TV directly from a host's browser tab over WebRTC with synchronized group audio.
- **Independent Audio**: Movie volume and voice call are completely decoupled to prevent echo or automatic ducking.

### 3. Multiplayer Skribbl Drawing Game
- **Real-Time Stroke Synchronization**: Interactive HTML5 canvas with mouse and touch support.
- **Secret Word Delivery**: Authoritative server distributes secret word only to the active drawer, broadcasting masked hints (e.g. `R _ C _ E T`) to guessers.
- **Automatic Chat Guess Interception**: When a player guesses the secret word in chat, points are awarded based on speed and placement, celebratory confetti (`canvas-confetti`) fires, and the word is hidden from non-guessers to prevent spoilers.
- **Dynamic Drawer Rotation**: Rotates through participants each round with live score updates.

### 4. Lounge Games Hub
1. **Quick Trivia**: Timed questions across cinema, sci-fi, and gaming with instant answer reveals and scoreboard.
2. **Would You Rather**: Hilarious dilemmas with live voting percentages.
3. **Truth or Dare**: Chill and wild prompt decks with randomizer.
4. **Tic-Tac-Toe**: Interactive 3x3 match between two players with tie/win detection and rematch.
5. **Conversation Cards**: Curated philosophical, funny, and deep icebreakers.
6. **Decision Spinner**: Animated wheel spinner with Web Audio sound effects to settle what to order or watch.
7. **Collaborative Whiteboard**: Freeform scratchpad for doodling and notes.

### 5. Live Chat, Reactions & Sound Synthesizer
- Timestamped room chat and join/leave event feed.
- Floating emoji reactions (🔥, ❤️, 😂, 🎉, 🍿, 🚀, 👏, 💀).
- Web Audio API synthesizer for instant UI sound cues without external mp3 dependencies.

---

## 🛠️ Environment Variables & Setup

Create a `.env` file from `.env.example`:

```bash
# General
APP_URL="http://localhost:3000"
PORT=3000

# LiveKit Cloud (Optional: free tier at https://cloud.livekit.io)
LIVEKIT_URL="wss://your-project.livekit.cloud"
LIVEKIT_API_KEY="your-api-key"
LIVEKIT_API_SECRET="your-api-secret"

# Supabase (Optional: at https://supabase.com)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
```

*Note: If LiveKit Cloud credentials are not configured, AFTERHOURS automatically falls back to the built-in local media WebRTC engine so the app runs out-of-the-box.*

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run unit tests
npm test

# 3. Start full-stack development server (Express + Vite + Socket.IO)
npm run dev

# 4. Build for production
npm run build
```

---

## 🧪 Unit Tests

Run unit tests via Node 22's native test runner:
```bash
node --test src/game/gameLogic.test.ts src/server/roomManager.test.ts
```
Covers:
- Guess score calculations (speed ratio and placement bonus).
- Drawer reward calculation based on successful guesser percentage.
- Time remaining formatting.
- Word bank difficulty selection and masked hint generation.
- Chat spoiler word detection.
- Case-insensitive guess matching.
