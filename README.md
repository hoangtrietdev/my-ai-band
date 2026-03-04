# 🎵 Virtual AI Band

A **GarageBand-inspired AI music production studio** built for hackathons. Describe the music you want in plain English and the AI band generates bass, drums, melody, keys, and vocal tracks — fully playable in the browser with Tone.js.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **6-Track DAW UI** | GarageBand-style track lanes with color-coded waveform blocks, per-track mute/solo/volume, and a real-time playhead |
| **AI Band Generation** | Enter a text prompt and the AI produces coordinated MIDI data for bass, drums, melody, keys, and vocal |
| **Arm-to-Record** | Click the red record button on Guitar or Vocal tracks to record live audio via your microphone — stored per-track without overlap |
| **Genre-Aware Engine** | 7 genres (**jazz, pop, blues, funk, bossa nova, lo-fi, rock**) each with unique bass patterns, drum grooves, melody scales, chord voicings, and vocal syllables |
| **Mock Mode** | Toggle mock mode for instant offline generation — no API key needed, great for demos |
| **SSE Streaming** | Real-time agent log shows producer ↔ musician communication streamed via Server-Sent Events |
| **Responsive** | Fully responsive from phone to desktop — compact track lanes, fluid modal, adaptive header controls |
| **Export** | Download the generated MIDI data as JSON |

## 🛠 Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org) (Pages Router, TypeScript strict)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com) with custom GarageBand-inspired design tokens
- **Audio Engine:** [Tone.js](https://tonejs.github.io) — lazy-loaded synths, per-track Volume nodes, master Compressor
- **Schema Validation:** [Zod v4](https://zod.dev)
- **Fonts:** Inter + JetBrains Mono (Google Fonts)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm / yarn / pnpm

### Install & Run

```bash
# Clone the repo
git clone <repo-url>
cd my-ai-band

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

Create a `.env` file in the project root:

```env
# Required for real API mode (not needed in mock mode)
GROQ_API_KEY=your_groq_api_key_here

# Optional — display backend label in the UI
NEXT_PUBLIC_IS_GROQ=true
```

> **Tip:** Toggle **Mock** mode in the top-right corner to skip the API and generate music instantly.

## 🎛 Architecture

```
src/
├── pages/
│   ├── index.tsx              # Main DAW page — header, production board, agent log
│   └── api/
│       └── orchestrate-band.ts  # SSE endpoint — orchestrates AI band via LLM
├── components/
│   ├── ProductionBoard.tsx    # Track lane container + transport controls
│   ├── TrackStrip.tsx         # Single track — color stripe, M/S, volume, waveform
│   ├── WaveformBlock.tsx      # Colored note-block visualization
│   ├── RecordModal.tsx        # Arm-to-record modal with live waveform
│   ├── AgentTerminal.tsx      # Scrolling agent log with typewriter effect
│   └── StatusBadge.tsx        # Idle / Processing / Ready badge
├── lib/
│   ├── toneEngine.ts          # Tone.js — synths, scheduling, playback, mute/solo
│   ├── mockApiResponse.ts     # Genre-aware randomized MIDI generator
│   ├── schemas.ts             # Zod schemas for MIDI data types
│   └── exportHelpers.ts       # JSON export utility
├── hooks/
│   ├── useAudioRecorder.ts    # MediaRecorder hook (mic → Blob)
│   ├── usePlayhead.ts         # Transport position tracker
│   └── useTypewriter.ts       # Character-by-character text animation
└── styles/
    └── globals.css             # DAW design tokens + responsive primitives
```

### Audio Signal Chain

```
Synths/Players → per-track Volume node → master Compressor → Destination
                                       ↗ Drums Reverb (short room)
                                       ↗ Bass LowPass Filter (340 Hz)
```

### Genre Engine

Each genre produces unique patterns:

| Genre | Bass | Drums | Melody | Keys | Vocal |
|-------|------|-------|--------|------|-------|
| **Jazz** | Walking quarter notes, chromatic approach | Swing ride, brush snare | Bebop chromaticism, wide leaps | Rootless voicings, swing comp | Scat syllables |
| **Rock** | Driving eighths, power root | Heavy kick, crash-heavy | Pentatonic riffs | Power chords | Strong, anthemic |
| **Blues** | Shuffle, root-♭7 | Shuffle ride, triplet feel | Blues scale, lazy phrasing | Dominant 7ths | Soulful |
| **Funk** | Syncopated 16ths, slap | 16th hi-hats, ghost snares | Staccato, rhythmic | Choppy stabs | Percussive |
| **Bossa Nova** | Root-fifth alternation | Rim click, cross-stick | Gentle stepwise | Maj7 comping | Soft, breathy |
| **Lo-fi** | Warm long tones | Sparse, mellow | Dreamy pentatonic | Suspended washes | Ethereal |
| **Pop** | Root-fifth, straight | 4-on-floor | Catchy, stepwise | Triad pads | Clear, singable |

## 📱 Responsive Design

- **Phone (< 640px):** Compact track lanes, smaller controls, stacked header params, fluid record modal
- **Tablet (640–1023px):** Relaxed spacing, side-by-side params
- **Desktop (1024px+):** Full DAW layout with collapsible agent log side panel

## 📄 License

MIT
