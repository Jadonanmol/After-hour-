# AFTERHOURS Deployment Guide

## 1. LiveKit Cloud Setup (WebRTC Video & Audio)
1. Sign up for free at [LiveKit Cloud](https://cloud.livekit.io).
2. Create a new project (e.g. `afterhours-lounge`).
3. Under **Settings -> Keys**, copy your:
   - `LIVEKIT_URL` (e.g. `wss://afterhours-xyz.livekit.cloud`)
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
4. Set these in your production environment variables.
5. AFTERHOURS automatically generates short-lived room tokens via the server-side `/api/livekit/token` endpoint.

## 2. Supabase Setup (Optional Database & Auth)
1. Create a project at [Supabase](https://supabase.com).
2. Retrieve your project URL and public Anon key under **Project Settings -> API**.
3. Supply `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

## 3. Production Deployment (Cloud Run / Docker / Node.js)
Because AFTERHOURS utilizes persistent WebSockets (`socket.io`) for real-time stroke streaming and synchronized game state:
1. Ensure the start script executes `npm start` (`tsx server.ts`).
2. Set `PORT=3000` (or host provided port).
3. The server handles both HTTP requests, WebSocket upgrades, and static Vite frontend assets.

## 4. Verification & Testing Checklist
- [x] Host creates room and joins video call.
- [x] Microphone toggle actually mutes WebRTC audio track.
- [x] Camera toggle actually disables WebRTC video track.
- [x] Watch Together loads FrameX TV (`https://framextv.xyz/`) with persistent call docked in sidebar.
- [x] 3-2-1 Sync Countdown broadcasts to all friends in the room.
- [x] Pop Out button launches FrameX TV in a separate tab.
- [x] Skribbl game rotates drawers, hides secret words, and calculates live scores.
- [x] Games Hub features 7 playable games (Trivia, Would You Rather, Truth or Dare, Tic-Tac-Toe, Conversation Cards, Decision Spinner, Whiteboard).
- [x] Video call minimizes into a floating pill without dropping audio or video.
- [x] Mobile responsive layout (390px) verified.
