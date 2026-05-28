# Refreisher — Handover Document

## What this is
An AI-powered study app built for Salesforce Admin exam prep but designed to work for any subject. Single-page React app deployed on Vercel. The user is about to start using it for the first time and will bring back functional deficiencies to fix.

## Repo & deployment
- **Repo**: github.com/verneranton/refreisher
- **Active branch**: `claude/hopeful-tesla-LJJWL` (all work goes here)
- **Vercel**: auto-deploys from the branch above
- **Never push to main directly**

## Tech stack
- React 18 + TypeScript — single file: `refreisher-app.tsx`
- Vite + `vite-plugin-pwa` (PWA configured, icons in `public/`)
- OpenRouter API (`https://openrouter.ai/api/v1/chat/completions`)
- localStorage only (no backend) — key: `refreisher_v1`
- Separate localStorage keys: `openrouter_api_key`, `gen_model`, `eval_model`

## The four study modes
| Mode | What it does | Model tier |
|---|---|---|
| Flashcards | Generates flip cards from source | Generation |
| Quiz | Multiple-choice with explanations | Generation |
| Brain Dump | Timed free recall → AI scores vs source | Evaluation |
| Feynman | Explain to an audience → AI judges clarity/accuracy | Evaluation |

## AI / API architecture
- **One API provider**: OpenRouter (covers Anthropic, Google, OpenAI, Perplexity under one key)
- **Two model tiers** (user sets defaults in Settings modal, can override per session):
  - Generation model default: `anthropic/claude-haiku-latest`
  - Evaluation model default: `anthropic/claude-sonnet-latest`
- **Research model** (hardcoded, not configurable): `perplexity/sonar-deep-research`
- Models use OpenRouter "latest" aliases — auto-update when Anthropic releases new versions
- `callOpenRouter(key, model, prompt, system?)` — takes optional system message

## System prompts
Each mode has a dedicated generic system prompt (no subject-specific content):
- `SYS_FLASH` — flashcard creator, EXCLUSIVELY from reference document
- `SYS_QUIZ` — MCQ writer, 4 options, one correct, plausible distractors
- `SYS_BRAIN` — tutor evaluating free recall against source as rubric, 0–100 scoring bands
- `SYS_FEYNMAN` — communication coach, 4 scored dimensions (clarity/accuracy/completeness/audience fit)

User message is lean: topic, difficulty, count, and raw source content between `---` markers.

## Sources (first-class concept)
- A **Source** is required before any session — no source = no Start button
- Sources have `origin: 'upload' | 'perplexity'`
- Perplexity flow: user types query → optional **✦ Enhance** button (Sonnet rewrites it into a detailed research prompt) → Sonar Deep Research runs (30–120s) → result saved as Source
- Sources tab (4th nav tab): manage all sources, preview content, delete, see session count

## Data model (localStorage)
```typescript
interface AppData {
  version: string; decks: Deck[]; sessions: Session[];
  sources: Source[]; subjectHistory: string[];
}
interface Session {
  id, deckId, topic, mode, difficulty, sessionLength,
  status, score, maxScore, notes,
  sourceId,        // required — links to Source
  model,           // which model was used (stored per session)
  ragFileId,       // legacy compat only
  items: StudyItem[], createdAt, completedAt, updatedAt, _syncMeta
}
interface Source {
  id, name, content, origin: 'upload'|'perplexity',
  query, uploadedAt, _syncMeta
}
```

Migration in `loadData()` handles old data: `ragFiles→sources`, `anthropic_api_key→openrouter_api_key`, `ragFileId→sourceId`.

## Study flow
**Home** (enter topic + pick deck) → click mode tile → **Setup** (single scrollable page: Source picker + Difficulty + Length/Persona/Time + Model dropdown) → **Session** → **Complete**

The `studyRouter()` calls views as plain functions (`Home()` not `<Home />`) — this is intentional to prevent React remounting on every keystroke (focus bug fix).

## Design system
Cherry blossom theme. Key values in `const C`:
- `bgDark: '#0D1628'`, `bgLight: '#FFF0F3'`
- `accent: '#FF6B89'`, `highlight: '#FF002C'`
- `cardDark: '#152035'`, `cardLight: '#FFF8FA'`

Per-mode accent colors: Flashcards `#FF6B89`, Quiz `#FF002C`, Brain Dump `#C97B9E`, Feynman `#FF8C69`.

UI primitives: `Btn` (skewX parallelogram shape), `Box` (asymmetric border-radius `14px 3px 14px 3px`), `Bar`, `Pill`, `ModelSelect`, `Ratings`.

Dark mode syncs with OS in real time via `matchMedia` event listener + manual toggle.

## PWA
- `vite-plugin-pwa` configured in `vite.config.ts`
- Icons in `public/`: `favicon.svg` (adaptive bg via CSS media query), `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
- SVG favicon background: `#FFF0F3` light / `#0D1628` dark

## What's next
The user is starting real usage now. Expect feedback on:
- Prompt quality (are flashcards grounded in the source? is brain dump feedback specific?)
- UX friction discovered during actual study sessions
- Any bugs in the session flow

No specific features are planned — wait for usage feedback before building anything new.

## Key files
| File | Purpose |
|---|---|
| `refreisher-app.tsx` | Entire app (~1400 lines) |
| `vite.config.ts` | Vite + PWA config |
| `index.html` | SVG favicon, theme-color meta, PWA apple-touch-icon |
| `public/` | Static assets (icons) |
| `src/main.tsx` | Entry point, imports RefreisherApp |
