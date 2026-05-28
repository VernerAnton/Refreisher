import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  BookOpen, Brain, Edit3, User, Sun, Moon,
  Trash2, Download, Upload, ChevronLeft,
  BarChart2, BookMarked, CheckCircle, Circle, Clock,
  X, FileText, Target, Award, Key, Search, Database, Info
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────
type Mode       = 'flashcards' | 'quiz' | 'brain_dump' | 'feynman';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';
type Status     = 'not_started' | 'in_progress' | 'completed';
type Rating     = 'easy' | 'medium' | 'hard';
type Tab        = 'study' | 'library' | 'sources' | 'stats';
type StudyView  = 'home' | 'setup' | 'session' | 'complete';

interface StudyItem {
  id: string;
  front?: string; back?: string;
  question?: string; options?: string[]; correctIndex?: number; explanation?: string;
  userResponse?: string; aiFeedback?: string;
  aiScores?: { clarity: number; accuracy: number; completeness: number; overall: number };
  persona?: string;
  userRating?: Rating; userAnswer?: number; isCorrect?: boolean; aiScore?: number;
  lastAttemptedAt?: string;
  _syncMeta?: { synced: boolean };
}

interface Session {
  id: string; deckId: string; topic: string; mode: Mode; difficulty: Difficulty;
  sessionLength: number; status: Status; score?: number; maxScore?: number; notes: string;
  sourceId?: string;
  ragFileId?: string; // legacy compat
  model?: string;
  items: StudyItem[];
  createdAt: string; completedAt?: string; updatedAt: string;
  _syncMeta?: { synced: boolean; syncedAt?: string };
}

interface Deck {
  id: string; name: string; createdAt: string; updatedAt: string;
  _syncMeta?: { synced: boolean; syncedAt?: string };
}

interface Source {
  id: string; name: string; content: string;
  origin: 'upload' | 'perplexity';
  query?: string;
  converted?: boolean;
  uploadedAt: string;
  _syncMeta?: { synced: boolean };
}

interface AppData {
  version: string; decks: Deck[]; sessions: Session[];
  sources: Source[]; subjectHistory: string[];
}

// ─── Constants ────────────────────────────────────────────
const STORAGE_KEY = 'refreisher_v1';

const PERSONAS = [
  { id: 'child',    name: '5-year-old',        description: 'Very simple words, zero technical terms' },
  { id: 'teenager', name: 'High schooler',      description: 'Basic concepts ok, stay accessible' },
  { id: 'friend',   name: 'Non-expert friend',  description: 'Smart but no domain background' },
  { id: 'graduate', name: 'Graduate student',   description: 'Understands complex concepts' },
  { id: 'professor',name: 'Domain expert',      description: 'Precise terminology, full depth' },
];

const MODE_CONFIG: Record<Mode, { label: string; accent: string; icon: React.ReactNode; description: string; tier: 'gen' | 'eval'; modelHint: string }> = {
  flashcards: {
    label: 'Flashcards', accent: '#FF6B89', icon: <BookOpen size={20} />,
    description: 'Flip cards to test recall',
    tier: 'gen',
    modelHint: 'Pure JSON generation — any fast model handles this perfectly. Best place to save cost.',
  },
  quiz: {
    label: 'Quiz', accent: '#FF002C', icon: <Brain size={20} />,
    description: 'Multiple-choice with immediate feedback',
    tier: 'gen',
    modelHint: 'Needs coherent distractors — a mid-tier model reduces nonsensical wrong answers.',
  },
  brain_dump: {
    label: 'Brain Dump', accent: '#C97B9E', icon: <Edit3 size={20} />,
    description: 'Timed free recall — write everything you know',
    tier: 'eval',
    modelHint: 'Has to read your response against the source and score it honestly. A stronger model gives meaningfully better feedback.',
  },
  feynman: {
    label: 'Feynman', accent: '#FF8C69', icon: <User size={20} />,
    description: 'Explain the concept to an audience',
    tier: 'eval',
    modelHint: 'Most demanding — judges clarity, accuracy, and audience fit, then suggests concrete rewrites. Worth upgrading here.',
  },
};

const GENERATION_MODELS = [
  { id: 'anthropic/claude-haiku-4-5-20251001', name: 'Claude Haiku',  note: 'fast' },
  { id: 'anthropic/claude-sonnet-4-6',         name: 'Claude Sonnet', note: 'balanced' },
];

const EVALUATION_MODELS = [
  { id: 'anthropic/claude-haiku-4-5-20251001', name: 'Claude Haiku',  note: 'fast' },
  { id: 'anthropic/claude-sonnet-4-6',         name: 'Claude Sonnet', note: 'balanced' },
];

const RESEARCH_MODEL = 'perplexity/sonar-deep-research';

const ALL_MODELS = [
  { id: 'anthropic/claude-haiku-4-5-20251001', name: 'Claude Haiku',  note: 'fast' },
  { id: 'anthropic/claude-sonnet-4-6',         name: 'Claude Sonnet', note: 'balanced' },
];

const C = {
  bgDark: '#0D1628', bgLight: '#FFF0F3',
  fgDark: '#F8E8EC', fgLight: '#2A1520',
  accent: '#FF6B89', highlight: '#FF002C',
  cardDark: '#152035', cardLight: '#FFF8FA',
  green: '#4CAF50', amber: '#FF9800', red: '#F44336',
};

const DEFAULT_DATA: AppData = {
  version: '1.0', decks: [], sessions: [], sources: [], subjectHistory: [],
};

// ─── Helpers ──────────────────────────────────────────────
const uid = () => crypto.randomUUID();
const ts  = () => new Date().toISOString();

const migrateApiKey = () => {
  const old = localStorage.getItem('anthropic_api_key');
  if (old && !localStorage.getItem('openrouter_api_key')) {
    localStorage.setItem('openrouter_api_key', old);
    localStorage.removeItem('anthropic_api_key');
  }
};

const loadData = (): AppData => {
  migrateApiKey();
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (!r) return DEFAULT_DATA;
    const p = JSON.parse(r);
    // migrate ragFiles → sources
    if (p.ragFiles && !p.sources) {
      p.sources = (p.ragFiles as any[]).map(f => ({ ...f, origin: 'upload' }));
      delete p.ragFiles;
    }
    // migrate session.ragFileId → session.sourceId
    if (p.sessions) {
      p.sessions = p.sessions.map((s: any) => ({ ...s, sourceId: s.sourceId ?? s.ragFileId }));
    }
    return { ...DEFAULT_DATA, ...p };
  } catch { return DEFAULT_DATA; }
};

const parseAI = (raw: string): any => {
  let s = raw.trim();
  if (s.startsWith('```json')) s = s.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  else if (s.startsWith('```')) s = s.replace(/^```\s*/, '').replace(/\s*```$/, '');
  return JSON.parse(s);
};

const shuffleOptions = (options: string[], correctIndex: number): { options: string[]; correctIndex: number } => {
  const indices = [0, 1, 2, 3];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return { options: indices.map(i => options[i]), correctIndex: indices.indexOf(correctIndex) };
};

const ragCtx = (sourceId: string | undefined, sources: Source[]): string => {
  if (!sourceId) return '';
  const f = sources.find(x => x.id === sourceId);
  if (!f) return '';
  return `\n\nReference document:\n---\n${f.content}\n---`;
};

const fmt     = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
const wc      = (s: string) => s.split(/\s+/).filter(Boolean).length;

// ─── API ──────────────────────────────────────────────────
const callOpenRouter = async (key: string, model: string, prompt: string, system?: string, jsonMode = false): Promise<string> => {
  const messages = system
    ? [{ role: 'system', content: system }, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }];
  const body: Record<string, unknown> = { model, max_tokens: 4096, messages };
  if (jsonMode) body.response_format = { type: 'json_object' };
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://refreisher.vercel.app',
      'X-Title': 'Refreisher',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).error?.message || `API error ${res.status}`);
  }
  return (await res.json()).choices[0].message.content;
};

// ─── System prompts ───────────────────────────────────────
const SYS_FLASH = `\
You are an expert flashcard creator specialising in active-recall study. \
Your entire response must be a single valid JSON object — no prose, no markdown fences, nothing else.

HOW TO USE THE REFERENCE DOCUMENT
When a reference document is supplied between --- markers in the user message:
• Generate cards EXCLUSIVELY from that material. Never introduce facts, terms, or concepts absent from the source.
• Cover the material comprehensively: key definitions, processes, relationships, rules, exceptions, and anything the source emphasises.
• If the source is long, prioritise concepts that appear frequently or are marked as important.

When no reference document is supplied, draw on accurate domain knowledge for the requested topic.

CARD QUALITY RULES
• Front: one focused question, term, or prompt — short enough to read in 3 seconds.
• Back: a complete but concise answer (1–4 sentences). Enough to fully resolve the front; no padding.
• Vary question types across the deck: definition → application → "what happens when…" → comparison → cause-and-effect.
• Beginner: plain language, foundational concepts only.
• Intermediate: technical terms introduced, moderate depth.
• Advanced: precise terminology, edge cases, nuance.
• Back values may use markdown (bold, bullet lists) where it aids clarity. Front values must be plain text.

OUTPUT — JSON only, schema:
{"flashcards":[{"front":"...","back":"..."}]}`;

const SYS_QUIZ = `\
You are an expert multiple-choice question writer for rigorous self-assessment. \
Your entire response must be a single valid JSON object — no prose, no markdown fences, nothing else.

HOW TO USE THE REFERENCE DOCUMENT
When a reference document is supplied between --- markers in the user message:
• Base ALL questions exclusively on that material. Do not test knowledge the source does not cover.
• Distractors should be plausible to someone who skimmed but clearly wrong to someone who studied the source carefully.
• Explanations must cite the logic from the source, not general domain knowledge.

When no reference document is supplied, draw on accurate domain knowledge for the requested topic.

QUESTION QUALITY RULES
• Exactly 4 options per question — labelled implicitly by position (index 0–3).
• One unambiguously correct answer. Three distinct distractors — use common misconceptions, inverted relationships, or terms from the source that belong to different concepts.
• No "all of the above" / "none of the above". No trick questions. No double negatives.
• Explanation: state clearly why the correct answer is right AND briefly why the most tempting wrong answer is wrong.
• Beginner: recall-level, straightforward wording.
• Intermediate: application and interpretation required.
• Advanced: analysis, edge cases, and nuanced distinctions.
• Question and option values must be plain text. Explanation values may use markdown where it aids clarity.

OUTPUT — JSON only, schema:
{"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}]}`;

const SYS_BRAIN = `\
You are a tutor evaluating a brain-dump exercise — the student wrote everything they could recall about a topic, \
from memory, without notes or time to organise. Your job is to give honest, specific, and encouraging feedback.

HOW TO USE THE REFERENCE DOCUMENT
When a reference document is supplied between --- markers in the user message:
• Treat it as the authoritative rubric. Identify the key concepts, facts, processes, and relationships it contains.
• Score the student on how thoroughly and accurately their response covers that material.
• List the important concepts from the source that the student missed or got wrong.
• Do not penalise for omitting information that is not present in the source.
• Strengths and missing items must reference the source material specifically, not generic domain knowledge.

When no reference document is supplied, evaluate against accurate domain knowledge for the topic.

SCORING GUIDE (0–100)
• 90–100: near-complete coverage with accurate details.
• 70–89: solid grasp, minor gaps or small inaccuracies.
• 50–69: core concepts present but significant gaps.
• 30–49: partial understanding, several key ideas missing or wrong.
• 0–29: fragmented or mostly inaccurate.

FEEDBACK RULES
• Strengths: quote or paraphrase what the student wrote when praising.
• Missing: name specific concepts from the source they omitted or got wrong.
• Feedback: one-paragraph overall assessment — honest, not harsh.
• Study tips: 2–4 actionable items ("re-read the section on X", "make a card for the difference between Y and Z").
• String values may use markdown (bold, bullet lists) where it aids clarity.

Your entire response must be a single valid JSON object — no prose, no markdown fences, nothing else.
OUTPUT schema:
{"score":75,"strengths":["..."],"missing":["..."],"feedback":"...","studyTips":["..."]}`;

const SYS_FEYNMAN = `\
You are a communication coach evaluating the Feynman Technique. The student was asked to explain a concept \
in plain language as if teaching it to a specific audience. Gaps in the explanation reveal gaps in understanding.

HOW TO USE THE REFERENCE DOCUMENT
When a reference document is supplied between --- markers in the user message:
• Use it as the factual ground truth for accuracy scoring.
• Check whether the student's explanation is consistent with the source.
• Do not penalise for simplifying or analogising — appropriate simplification for the audience is the whole point.
• Do penalise for factual errors or key omissions that contradict or ignore the source.

When no reference document is supplied, assess accuracy against correct domain knowledge.

SCORING DIMENSIONS (each 0–100)
• Clarity (30% weight): is the explanation easy to follow for the specified audience? Is the structure logical?
• Accuracy (35% weight): are the facts correct and consistent with the source / domain knowledge?
• Completeness (20% weight): are the core concepts covered, or are major ideas missing?
• Audience fit (15% weight): is the language, vocabulary, and depth right for the specified audience?

FEEDBACK RULES
• audienceFit field: one sentence assessing whether they pitched it correctly for the audience.
• feedback: one paragraph — quote specific phrases the student used when praising or correcting.
• suggestions: 2–4 concrete rewrites or additions, not abstract advice ("Instead of 'X', try saying…").
• String values may use markdown (bold, bullet lists) where it aids clarity.

Your entire response must be a single valid JSON object — no prose, no markdown fences, nothing else.
OUTPUT schema (do NOT include overallScore — it is computed externally):
{"clarityScore":80,"accuracyScore":85,"completenessScore":70,"audienceFitScore":75,"audienceFit":"...","feedback":"...","suggestions":["..."]}`;

const SYS_CONVERT = `You are a knowledge-base formatter for AI study systems. You receive raw research or document content and reformat it into a structured, AI-optimised knowledge base.

Rules:
- No introduction, no conclusion, no filler phrases
- Group information under clear ALL-CAPS section headers
- Under each header: tight bullet points, one fact per bullet
- Use explicit declarative sentences: "X is Y", "X controls Y", "X requires Y", "X differs from Y in that..."
- Where two things are commonly confused, add: "A vs B: A does [X], B does [Y]"
- Preserve all specific numbers, limits, and rules exactly as given
- Prefix exam-critical gotchas with "GOTCHA:"
- Prefix default behaviours with "DEFAULT:"
- Do not add, invent, or omit any facts — only restructure what is given
- Output only the reformatted knowledge base. No preamble or commentary.`;

// ─── Prompts (user message only — role/behavior is in system prompts) ─────────
const pFlash = (topic: string, diff: string, n: number, r: string) =>
  `Topic: "${topic}"\nDifficulty: ${diff}\nCard count: ${n}${r}`;

const pQuiz = (topic: string, diff: string, n: number, r: string) =>
  `Topic: "${topic}"\nDifficulty: ${diff}\nQuestion count: ${n}${r}`;

const pBrain = (topic: string, resp: string, r: string) =>
  `Topic: "${topic}"${r}\n\nStudent's brain dump:\n${resp}`;

const pFeynman = (topic: string, resp: string, pid: string, r: string) => {
  const p = PERSONAS.find(x => x.id === pid) || PERSONAS[2];
  return `Topic: "${topic}"\nTarget audience: ${p.name} — ${p.description}${r}\n\nStudent's explanation:\n${resp}`;
};

// ─── UI Primitives ────────────────────────────────────────
function Btn({ children, onClick, disabled=false, variant='primary', accent, sm }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: 'primary'|'outline'|'ghost'; accent?: string; sm?: boolean;
}) {
  const a = accent || C.accent;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      transform: 'skewX(-8deg)',
      background: variant==='primary' ? (disabled ? 'rgba(128,128,128,0.2)' : a) : 'transparent',
      border: variant==='outline' ? `1.5px solid ${disabled ? 'rgba(128,128,128,0.3)' : a}` : 'none',
      color: variant==='primary' ? (disabled ? 'rgba(128,128,128,0.4)' : '#fff') : (disabled ? 'rgba(128,128,128,0.4)' : a),
      padding: sm ? '5px 14px' : '9px 22px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: 600, fontSize: sm ? 12 : 14,
      borderRadius: '2px 8px 2px 8px',
      transition: 'opacity 0.15s', opacity: disabled ? 0.55 : 1,
      letterSpacing: '0.02em', lineHeight: 1.4,
    }}>
      <span style={{ display:'block', transform:'skewX(8deg)' }}>{children}</span>
    </button>
  );
}

function Md({ children, style }: { children: string; style?: React.CSSProperties }) {
  return (
    <div style={{ lineHeight: 1.65, ...style }}>
      <ReactMarkdown
        components={{
          p:      ({ children }) => <p style={{ margin: '0 0 6px' }}>{children}</p>,
          ul:     ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ul>,
          ol:     ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ol>,
          li:     ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
          strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
          code:   ({ children }) => <code style={{ fontFamily: 'monospace', fontSize: '0.9em', background: 'rgba(128,128,128,0.15)', padding: '1px 4px', borderRadius: 3 }}>{children}</code>,
          pre:    ({ children }) => <pre style={{ background: 'rgba(128,128,128,0.12)', borderRadius: 6, padding: '10px 14px', overflowX: 'auto', margin: '6px 0', fontSize: 13 }}>{children}</pre>,
        }}
      >{children}</ReactMarkdown>
    </div>
  );
}

function Box({ children, dark, accent, style={}, onClick }: {
  children: React.ReactNode; dark: boolean; accent?: string;
  style?: React.CSSProperties; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{
      background: dark ? C.cardDark : C.cardLight,
      border: `1px solid ${accent || (dark ? 'rgba(255,107,137,0.18)' : 'rgba(255,107,137,0.28)')}`,
      borderRadius: '14px 3px 14px 3px', padding: '18px 20px',
      cursor: onClick ? 'pointer' : 'default', ...style,
    }}>{children}</div>
  );
}

function Ratings({ onRate }: { onRate: (r: Rating) => void }) {
  return (
    <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:14 }}>
      <Btn accent={C.green}  onClick={() => onRate('easy')}>Easy</Btn>
      <Btn accent={C.amber}  onClick={() => onRate('medium')}>Medium</Btn>
      <Btn accent={C.red}    onClick={() => onRate('hard')}>Hard</Btn>
    </div>
  );
}

function Bar({ cur, total, accent }: { cur: number; total: number; accent: string }) {
  return (
    <div style={{ width:'100%', height:4, background:'rgba(128,128,128,0.18)', borderRadius:2, overflow:'hidden' }}>
      <div style={{ width: total>0 ? `${(cur/total)*100}%` : '0%', height:'100%', background:accent, transition:'width 0.3s', borderRadius:2 }} />
    </div>
  );
}

function Pill({ label, value, accent }: { label: string; value: number|string; accent: string }) {
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:26, fontWeight:800, color:accent }}>{value}</div>
      <div style={{ fontSize:11, opacity:0.55, marginTop:2 }}>{label}</div>
    </div>
  );
}

function ModelSelect({ label, subtitle, value, options, onChange, dark, bdr, fg, cardBg, accent }: {
  label: string; subtitle: string; value: string;
  options: { id: string; name: string; note: string }[];
  onChange: (v: string) => void;
  dark: boolean; bdr: string; fg: string; cardBg: string; accent: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 8 }}>{subtitle}</div>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', background: cardBg, border: `1px solid ${bdr}`, color: fg, borderRadius: '8px 2px 8px 2px', padding: '8px 12px', fontSize: 13, outline: 'none' }}>
        {options.map(m => (
          <option key={m.id} value={m.id}>{m.name} — {m.note}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────
export default function RefreisherApp() {
  const [data, setData]         = useState<AppData>(loadData);
  const [dark, setDark]         = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [tab, setTab]           = useState<Tab>('study');
  const [view, setView]         = useState<StudyView>('home');
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  // Settings
  const [apiKey, setApiKey]     = useState(() => localStorage.getItem('openrouter_api_key') || '');
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey]   = useState(() => !localStorage.getItem('openrouter_api_key'));
  const [genModel, setGenModel] = useState(() => {
    const v = localStorage.getItem('gen_model');
    return (v && !v.endsWith('-latest')) ? v : 'anthropic/claude-haiku-4-5-20251001';
  });
  const [evalModel, setEvalModel] = useState(() => {
    const v = localStorage.getItem('eval_model');
    return (v && !v.endsWith('-latest')) ? v : 'anthropic/claude-sonnet-4-6';
  });

  // Setup
  const [topic, setTopic]       = useState('');
  const [mode, setMode]         = useState<Mode | null>(null);
  const [sessionModel, setSessionModel] = useState(genModel);
  const [diff, setDiff]         = useState<Difficulty>('intermediate');
  const [len, setLen]           = useState(10);
  const [deckId, setDeckId]     = useState('');
  const [sourceId, setSourceId] = useState<string | undefined>(undefined);
  const [persona, setPersona]   = useState('friend');
  const [tlimit, setTlimit]     = useState(5);
  const [showND, setShowND]     = useState(false);
  const [ndName, setNdName]     = useState('');

  // Perplexity research
  const [researching, setResearching]     = useState(false);
  const [enhancing, setEnhancing]         = useState(false);
  const [converting, setConverting]       = useState(false);
  const [convertingSourceId, setConvertingSourceId] = useState<string | null>(null);
  const [researchQuery, setResearchQuery] = useState('');
  const [showResearch, setShowResearch]   = useState(false);

  // Session
  const [sesh, setSesh]         = useState<Session | null>(null);
  const [idx, setIdx]           = useState(0);
  const [flipped, setFlipped]   = useState(false);
  const [picked, setPicked]     = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [resp, setResp]         = useState('');
  const [fbk, setFbk]           = useState<any>(null);
  const [tsecs, setTsecs]       = useState(0);
  const [ton, setTon]           = useState(false);
  const [notes, setNotes]       = useState('');

  // Library
  const [libDeck, setLibDeck]   = useState<string | null>(null);
  const [libFilt, setLibFilt]   = useState<Status | 'all'>('all');
  const [showLND, setShowLND]   = useState(false);
  const [lndName, setLndName]   = useState('');

  // Sources tab
  const [previewSrcId, setPreviewSrcId] = useState<string | null>(null);

  const importRef = useRef<HTMLInputElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!ton) return;
    if (tsecs <= 0) { setTon(false); return; }
    const id = setInterval(() => setTsecs(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [ton, tsecs]);

  // Theme
  const bg     = dark ? C.bgDark   : C.bgLight;
  const fg     = dark ? C.fgDark   : C.fgLight;
  const bdr    = dark ? 'rgba(255,107,137,0.18)' : 'rgba(255,107,137,0.28)';
  const muted  = dark ? 'rgba(248,232,236,0.45)' : 'rgba(42,21,32,0.45)';
  const cardBg = dark ? C.cardDark : C.cardLight;
  const ma     = mode ? MODE_CONFIG[mode].accent : C.accent;
  const sa     = sesh ? MODE_CONFIG[sesh.mode].accent : C.accent;
  const diag   = (a = C.accent) => ({ backgroundImage: `repeating-linear-gradient(45deg,transparent,transparent 38px,${a}07 38px,${a}07 39px)` });

  // ─── API wrappers ───
  const research = (prompt: string) => callOpenRouter(apiKey, RESEARCH_MODEL, prompt);

  // ─── Settings ───
  const saveKey = () => {
    const k = keyInput.trim(); if (!k) return;
    localStorage.setItem('openrouter_api_key', k);
    setApiKey(k); setKeyInput(''); setShowKey(false);
  };

  const updateGenModel = (v: string) => {
    setGenModel(v); localStorage.setItem('gen_model', v);
  };

  const updateEvalModel = (v: string) => {
    setEvalModel(v); localStorage.setItem('eval_model', v);
  };

  // ─── Data ops ───
  const upd = (fn: (d: AppData) => AppData) => setData(p => fn(p));

  const mkDeck = (name: string): string => {
    const d: Deck = { id: uid(), name, createdAt: ts(), updatedAt: ts(), _syncMeta: { synced: false } };
    upd(s => ({ ...s, decks: [...s.decks, d] }));
    return d.id;
  };

  const rmDeck = (id: string) => {
    upd(s => ({ ...s, decks: s.decks.filter(d => d.id !== id), sessions: s.sessions.filter(s => s.deckId !== id) }));
    if (libDeck === id) setLibDeck(null);
  };

  const uploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src: Source = { id: uid(), name: f.name, content: ev.target?.result as string, origin: 'upload', uploadedAt: ts(), _syncMeta: { synced: false } };
      upd(s => ({ ...s, sources: [...s.sources, src] }));
      setSourceId(src.id);
    };
    reader.readAsText(f); e.target.value = '';
  };

  const rmSource = (id: string) => {
    upd(s => ({ ...s, sources: s.sources.filter(x => x.id !== id) }));
    if (sourceId === id) setSourceId(undefined);
    if (previewSrcId === id) setPreviewSrcId(null);
  };

  const convertSourceContent = async (raw: string): Promise<string> =>
    callOpenRouter(
      apiKey, evalModel,
      `Reformat the following content into a structured AI-optimised knowledge base:\n\n${raw}`,
      SYS_CONVERT
    );

  const convertSource = async (src: Source) => {
    if (!apiKey) { setErr('No API key set — add your OpenRouter key in Settings first.'); return; }
    setConvertingSourceId(src.id);
    try {
      const content = await convertSourceContent(src.content);
      upd(d => ({ ...d, sources: d.sources.map(s => s.id === src.id ? { ...s, content: content.trim(), converted: true } : s) }));
    } catch (e) { setErr(`Conversion failed: ${(e as Error).message}`); }
    finally { setConvertingSourceId(null); }
  };

  const submitResearch = async () => {
    if (!researchQuery.trim()) return;
    setResearching(true);
    try {
      const raw = await research(researchQuery);
      setResearching(false);
      setConverting(true);
      const content = await convertSourceContent(raw);
      const src: Source = { id: uid(), name: researchQuery, content: content.trim(), origin: 'perplexity', query: researchQuery, converted: true, uploadedAt: ts(), _syncMeta: { synced: false } };
      upd(d => ({ ...d, sources: [...d.sources, src] }));
      setSourceId(src.id);
      setShowResearch(false);
      setResearchQuery('');
    } catch (e) { setErr(`Research failed: ${(e as Error).message}`); }
    finally { setResearching(false); setConverting(false); }
  };

  const exportAll = () => {
    const blob = new Blob([JSON.stringify({ ...data, exportedAt: ts() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `refreisher-${new Date().toISOString().split('T')[0]}.json`; a.click();
  };

  const importAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imp: AppData = JSON.parse(ev.target?.result as string);
        upd(d => {
          const dIds = new Set(d.decks.map(x => x.id));
          const sIds = new Set(d.sessions.map(x => x.id));
          const fIds = new Set(d.sources.map(x => x.id));
          return {
            ...d,
            decks: [...d.decks, ...(imp.decks||[]).filter(x => !dIds.has(x.id))],
            sessions: [...d.sessions, ...(imp.sessions||[]).filter(x => !sIds.has(x.id))],
            sources: [...d.sources, ...(imp.sources||[]).filter(x => !fIds.has(x.id))],
            subjectHistory: [...new Set([...d.subjectHistory, ...(imp.subjectHistory||[])])].slice(0,10),
          };
        });
      } catch { setErr('Import failed — invalid file format.'); }
    };
    reader.readAsText(f); e.target.value = '';
  };

  // ─── Session ops ───
  const syncSesh = (s: Session) => {
    setSesh(s);
    upd(d => ({ ...d, sessions: d.sessions.map(x => x.id === s.id ? s : x) }));
  };

  const patch = (itemId: string, p: Partial<StudyItem>): Session | null => {
    if (!sesh) return null;
    const updated = { ...sesh, items: sesh.items.map(i => i.id === itemId ? { ...i, ...p, lastAttemptedAt: ts() } : i), updatedAt: ts() };
    syncSesh(updated); return updated;
  };

  const rateNext = (rating: Rating) => {
    if (!sesh) return;
    const updated = patch(sesh.items[idx].id, { userRating: rating });
    if (!updated) return;
    if (idx < sesh.items.length - 1) {
      setIdx(i => i+1); setFlipped(false); setPicked(null); setAnswered(false);
    } else { finish(updated); }
  };

  const pickOpt = (i: number) => {
    if (answered || !sesh) return;
    const item = sesh.items[idx];
    setPicked(i); setAnswered(true);
    patch(item.id, { userAnswer: i, isCorrect: i === item.correctIndex });
  };

  const submitBrain = async () => {
    if (!resp.trim() || !sesh) return;
    setBusy(true); setTon(false);
    try {
      const m = sesh.model || evalModel;
      const fb = parseAI(await callOpenRouter(apiKey, m, pBrain(sesh.topic, resp, ragCtx(sesh.sourceId, data.sources)), SYS_BRAIN, true));
      setFbk(fb);
      patch(sesh.items[0].id, { userResponse: resp, aiFeedback: JSON.stringify(fb), aiScore: fb.score });
    } catch (e) { setErr(`Evaluation failed: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };

  const submitFeynman = async () => {
    if (!resp.trim() || !sesh) return;
    setBusy(true);
    try {
      const m = sesh.model || evalModel;
      const fb = parseAI(await callOpenRouter(apiKey, m, pFeynman(sesh.topic, resp, persona, ragCtx(sesh.sourceId, data.sources)), SYS_FEYNMAN, true));
      const overallScore = Math.round(0.30 * (fb.clarityScore||0) + 0.35 * (fb.accuracyScore||0) + 0.20 * (fb.completenessScore||0) + 0.15 * (fb.audienceFitScore||0));
      const fbWithOverall = { ...fb, overallScore };
      setFbk(fbWithOverall);
      patch(sesh.items[0].id, {
        userResponse: resp, persona, aiFeedback: JSON.stringify(fbWithOverall), aiScore: overallScore,
        aiScores: { clarity: fb.clarityScore, accuracy: fb.accuracyScore, completeness: fb.completenessScore, overall: overallScore },
      });
    } catch (e) { setErr(`Evaluation failed: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };

  const finish = (s?: Session) => {
    const t = s || sesh; if (!t) return;
    let score: number|undefined, maxScore: number|undefined;
    if (t.mode === 'quiz') {
      const qs = t.items.filter(i => i.question !== undefined);
      score = qs.filter(i => i.isCorrect).length; maxScore = qs.length;
    } else if (t.mode === 'brain_dump' || t.mode === 'feynman') {
      score = t.items[0]?.aiScore; maxScore = 100;
    }
    const done: Session = { ...t, status:'completed', score, maxScore, completedAt:ts(), updatedAt:ts() };
    syncSesh(done); setSesh(done); setView('complete');
  };

  const generate = async () => {
    if (!topic.trim() || !mode || !sourceId) return;
    setBusy(true); setErr(null);
    let did = deckId || mkDeck(topic);
    if (!deckId) setDeckId(did);
    const r = ragCtx(sourceId, data.sources);
    const call = (prompt: string, sys: string) => callOpenRouter(apiKey, sessionModel, prompt, sys, true);
    try {
      let items: StudyItem[] = [];
      if (mode === 'flashcards') {
        const d = parseAI(await call(pFlash(topic, diff, len, r), SYS_FLASH));
        items = (d.flashcards||[]).map((f: any) => ({ id:uid(), front:f.front, back:f.back, _syncMeta:{synced:false} }));
      } else if (mode === 'quiz') {
        const d = parseAI(await call(pQuiz(topic, diff, len, r), SYS_QUIZ));
        items = (d.questions||[]).map((q: any) => {
          const shuffled = shuffleOptions(q.options, q.correctIndex);
          return { id:uid(), question:q.question, options:shuffled.options, correctIndex:shuffled.correctIndex, explanation:q.explanation, _syncMeta:{synced:false} };
        });
      } else {
        items = [{ id:uid(), _syncMeta:{synced:false} }];
      }
      const s: Session = {
        id:uid(), deckId:did, topic, mode, difficulty:diff, sessionLength:len,
        status:'in_progress', notes:'', sourceId, model:sessionModel, items,
        createdAt:ts(), updatedAt:ts(), _syncMeta:{synced:false},
      };
      upd(d => ({ ...d, sessions:[...d.sessions, s], subjectHistory:[topic, ...d.subjectHistory.filter(h=>h!==topic)].slice(0,10) }));
      setSesh(s); setIdx(0); setFlipped(false); setPicked(null); setAnswered(false);
      setResp(''); setFbk(null); setNotes(''); setTsecs(tlimit*60); setTon(false);
      setView('session');
    } catch (e) { setErr(`Generation failed: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };

  const weakSpots = () => {
    if (!sesh) return;
    const hard = sesh.items.filter(i => i.userRating==='hard');
    if (!hard.length) return;
    const ws: Session = { ...sesh, id:uid(), items:hard.map(i=>({...i,id:uid(),userRating:undefined,userAnswer:undefined,isCorrect:undefined})), status:'in_progress', score:undefined, completedAt:undefined, notes:'', createdAt:ts(), updatedAt:ts() };
    upd(d => ({ ...d, sessions:[...d.sessions, ws] }));
    setSesh(ws); setIdx(0); setFlipped(false); setPicked(null); setAnswered(false);
    setResp(''); setFbk(null); setNotes(''); setView('session');
  };

  const saveNotes = () => { if (!sesh) return; syncSesh({ ...sesh, notes, updatedAt:ts() }); };

  const enhanceQuery = async () => {
    if (!researchQuery.trim()) return;
    setEnhancing(true);
    try {
      const enhanced = await callOpenRouter(
        apiKey,
        evalModel,
        `Rewrite this brief research topic into a comprehensive, detailed research prompt that will produce thorough, well-structured results from a deep-research search engine. Expand it to specify relevant subtopics, depth of detail, and any important distinctions or nuances to cover. Return only the improved prompt — no explanation, no preamble.\n\nTopic: ${researchQuery}`,
        'You are a research query optimizer. Your output is always a single improved research prompt and nothing else — no labels, no explanation, just the text of the enhanced query.',
      );
      setResearchQuery(enhanced.trim());
    } catch (e) { setErr(`Enhance failed: ${(e as Error).message}`); }
    finally { setEnhancing(false); }
  };

  // ─── Shared research form ───
  const ResearchForm = ({ accentColor }: { accentColor: string }) => (
    <Box dark={dark} accent={C.amber} style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: C.amber, marginBottom: 10 }}>Sonar Deep Research</div>
      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        <input value={researchQuery} onChange={e => setResearchQuery(e.target.value)}
          placeholder="e.g. Salesforce Admin certification topics and requirements"
          style={{ flex:1, background:'transparent', border:`1px solid ${bdr}`, borderRadius:'8px 2px 8px 2px', padding:'9px 13px', color:fg, fontSize:14, outline:'none', boxSizing:'border-box' }}
          onFocus={e => e.currentTarget.style.borderColor = C.amber}
          onBlur={e => e.currentTarget.style.borderColor = bdr}
          onKeyDown={e => e.key==='Enter' && !researching && !enhancing && researchQuery.trim() && submitResearch()}
        />
        <Btn sm variant="outline" accent={C.amber} onClick={enhanceQuery} disabled={!researchQuery.trim() || enhancing || researching}>
          {enhancing ? '…' : '✦ Enhance'}
        </Btn>
      </div>
      {enhancing && (
        <div style={{ fontSize:12, color:C.amber, marginBottom:8, opacity:0.8 }}>
          Improving your prompt with Sonnet…
        </div>
      )}
      {researching ? (
        <div style={{ fontSize:13, color:C.amber, display:'flex', alignItems:'center', gap:8 }}>
          <Search size={13} style={{ animation:'spin 1s linear infinite' }} />
          Sonar Deep Research in progress… (30–120 seconds)
        </div>
      ) : converting ? (
        <div style={{ fontSize:13, color:C.amber, display:'flex', alignItems:'center', gap:8 }}>
          <Database size={13} style={{ animation:'spin 1s linear infinite' }} />
          Structuring for AI consumption… (a few seconds)
        </div>
      ) : (
        <div style={{ display:'flex', gap:8 }}>
          <Btn sm accent={C.amber} onClick={submitResearch} disabled={!researchQuery.trim() || enhancing}>Start Research</Btn>
          <Btn sm variant="ghost" accent={C.amber} onClick={() => { setShowResearch(false); setEnhancing(false); }}>Cancel</Btn>
        </div>
      )}
    </Box>
  );

  // ─── Views ────────────────────────────────────────────────

  const Home = () => (
    <div style={{ maxWidth:680, margin:'0 auto', padding:'0 16px' }}>
      <Box dark={dark} style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.accent, marginBottom:8, letterSpacing:'0.06em', textTransform:'uppercase' }}>Subject / Topic</div>
        <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Salesforce Admin — Security & Access"
          style={{ width:'100%', background:'transparent', border:`1px solid ${bdr}`, borderRadius:'8px 2px 8px 2px', padding:'10px 14px', color:fg, fontSize:15, outline:'none', boxSizing:'border-box' }}
          onFocus={e => e.currentTarget.style.borderColor = C.accent}
          onBlur={e => e.currentTarget.style.borderColor = bdr}
        />
        {data.subjectHistory.length > 0 && (
          <div style={{ marginTop:10, display:'flex', flexWrap:'wrap', gap:6 }}>
            {data.subjectHistory.map(h => (
              <button key={h} onClick={() => setTopic(h)}
                style={{ transform:'skewX(-5deg)', background:'transparent', border:`1px solid ${bdr}`, color:muted, padding:'3px 10px', borderRadius:'2px 5px 2px 5px', cursor:'pointer', fontSize:11 }}>
                <span style={{ display:'block', transform:'skewX(5deg)' }}>{h}</span>
              </button>
            ))}
          </div>
        )}
      </Box>

      <Box dark={dark} style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.accent, marginBottom:8, letterSpacing:'0.06em', textTransform:'uppercase' }}>Deck</div>
        <div style={{ display:'flex', gap:8 }}>
          <select value={deckId} onChange={e => setDeckId(e.target.value)}
            style={{ flex:1, background:cardBg, border:`1px solid ${bdr}`, color:fg, borderRadius:'6px 2px 6px 2px', padding:'7px 10px', fontSize:13, outline:'none' }}>
            <option value="">Auto-create from topic</option>
            {data.decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Btn sm variant="outline" onClick={() => setShowND(v => !v)}>+</Btn>
        </div>
        {showND && (
          <div style={{ display:'flex', gap:6, marginTop:8 }}>
            <input value={ndName} onChange={e => setNdName(e.target.value)} placeholder="Deck name"
              style={{ flex:1, background:'transparent', border:`1px solid ${bdr}`, borderRadius:'4px', padding:'6px 10px', color:fg, fontSize:12, outline:'none' }}
              onKeyDown={e => { if (e.key==='Enter' && ndName.trim()) { setDeckId(mkDeck(ndName.trim())); setNdName(''); setShowND(false); } }}
            />
            <Btn sm onClick={() => { if (ndName.trim()) { setDeckId(mkDeck(ndName.trim())); setNdName(''); setShowND(false); } }}>Create</Btn>
          </div>
        )}
      </Box>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        {(Object.keys(MODE_CONFIG) as Mode[]).map(m => {
          const cfg = MODE_CONFIG[m]; const can = !!topic.trim();
          return (
            <Box key={m} dark={dark} accent={can ? cfg.accent : undefined}
              style={{ cursor:can?'pointer':'not-allowed', opacity:can?1:0.45, transition:'opacity 0.15s' }}
              onClick={() => { if (!can) return; setMode(m); setSessionModel(MODE_CONFIG[m].tier === 'gen' ? genModel : evalModel); setView('setup'); setErr(null); setShowResearch(false); }}>
              <div style={{ color:cfg.accent, marginBottom:8 }}>{cfg.icon}</div>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:3 }}>{cfg.label}</div>
              <div style={{ fontSize:12, color:muted }}>{cfg.description}</div>
            </Box>
          );
        })}
      </div>
      {!topic.trim() && <div style={{ textAlign:'center', fontSize:12, color:muted, marginTop:12 }}>Enter a topic above to unlock study modes</div>}
    </div>
  );

  const Setup = () => {
    if (!mode) return null;
    const cfg = MODE_CONFIG[mode];
    const sel = sourceId ? data.sources.find(s => s.id === sourceId) : null;
    return (
      <div style={{ maxWidth:560, margin:'0 auto', padding:'0 16px' }}>
        <button onClick={() => { setView('home'); setMode(null); setShowResearch(false); }}
          style={{ background:'none', border:'none', color:muted, cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:13, marginBottom:20 }}>
          <ChevronLeft size={14} /> Back
        </button>

        {/* Mode header */}
        <Box dark={dark} accent={cfg.accent} style={{ marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, color:cfg.accent, marginBottom:3 }}>{cfg.icon}<span style={{ fontWeight:700, fontSize:16 }}>{cfg.label}</span></div>
          <div style={{ fontSize:13, color:muted }}>{topic}</div>
        </Box>

        {/* Source */}
        <Box dark={dark} style={{ marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
            <span style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em' }}>Source</span>
            <span style={{ position:'relative', display:'inline-flex', alignItems:'center' }}
              onMouseEnter={e => (e.currentTarget.querySelector('.src-tip') as HTMLElement|null)?.style && Object.assign((e.currentTarget.querySelector('.src-tip') as HTMLElement).style, { opacity:'1', pointerEvents:'auto' })}
              onMouseLeave={e => (e.currentTarget.querySelector('.src-tip') as HTMLElement|null)?.style && Object.assign((e.currentTarget.querySelector('.src-tip') as HTMLElement).style, { opacity:'0', pointerEvents:'none' })}>
              <Info size={12} style={{ color:muted, cursor:'default' }} />
              <div className="src-tip" style={{ opacity:0, pointerEvents:'none', transition:'opacity 0.15s', position:'absolute', bottom:'calc(100% + 6px)', left:'50%', transform:'translateX(-50%)', width:220, background:dark?'#1e2d45':'#2A1520', color:dark?'#F8E8EC':'#FFF0F3', fontSize:11, lineHeight:1.55, padding:'8px 10px', borderRadius:'8px 2px 8px 2px', zIndex:99, boxShadow:'0 4px 16px rgba(0,0,0,0.3)' }}>
                Best for <strong>focused, targeted study</strong> — one domain or sub-topic at a time. Keep sources concise (a single chapter, a cheat sheet, one concept area). This isn&apos;t built for broad memorization across a full textbook.
              </div>
            </span>
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:sel ? 10 : 0 }}>
            <select value={sourceId||''} onChange={e => setSourceId(e.target.value || undefined)}
              style={{ flex:1, background:cardBg, border:`1px solid ${bdr}`, color:fg, borderRadius:'6px 2px 6px 2px', padding:'8px 10px', fontSize:13, outline:'none' }}>
              <option value="">Select a source…</option>
              {data.sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Btn sm variant="outline" accent={cfg.accent} onClick={() => fileRef.current?.click()}>Upload</Btn>
            <input ref={fileRef} type="file" accept=".txt,.md,text/plain,text/markdown" style={{ display:'none' }} onChange={uploadFile} />
          </div>
          {sel && (
            <div style={{ padding:'9px 12px', background:`${cfg.accent}10`, borderRadius:'6px 2px 6px 2px', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                <span style={{ fontWeight:700, fontSize:13 }}>{sel.name}</span>
                <span style={{ fontSize:10, fontWeight:700, background:sel.origin==='perplexity'?`${C.amber}20`:`${C.accent}20`, color:sel.origin==='perplexity'?C.amber:C.accent, padding:'2px 6px', borderRadius:'3px' }}>
                  {sel.origin==='perplexity' ? 'Perplexity' : 'Upload'}
                </span>
                <span style={{ fontSize:11, color:muted }}>{wc(sel.content).toLocaleString()} words</span>
              </div>
              <div style={{ fontSize:12, color:muted, lineHeight:1.5 }}>{sel.content.slice(0,150)}{sel.content.length>150?'…':''}</div>
            </div>
          )}
          {!showResearch ? (
            <button onClick={() => { setResearchQuery(topic); setShowResearch(true); }}
              style={{ transform:'skewX(-6deg)', background:'transparent', border:`1px solid ${C.amber}`, color:C.amber, padding:'6px 14px', borderRadius:'2px 7px 2px 7px', cursor:'pointer', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ display:'flex', transform:'skewX(6deg)', alignItems:'center', gap:6 }}><Search size={12}/> Research with Perplexity</span>
            </button>
          ) : (
            <ResearchForm accentColor={cfg.accent} />
          )}
          {data.sources.length === 0 && !showResearch && (
            <div style={{ fontSize:11, color:muted, marginTop:8 }}>No sources yet — upload a file or research with Perplexity</div>
          )}
        </Box>

        {/* Difficulty */}
        <Box dark={dark} style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Difficulty</div>
          <div style={{ display:'flex', gap:8 }}>
            {(['beginner','intermediate','advanced'] as Difficulty[]).map(d => (
              <button key={d} onClick={() => setDiff(d)}
                style={{ flex:1, transform:'skewX(-6deg)', border:`1.5px solid ${diff===d?cfg.accent:bdr}`, background:diff===d?`${cfg.accent}18`:'transparent', color:diff===d?cfg.accent:muted, padding:'7px 0', borderRadius:'2px 6px 2px 6px', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                <span style={{ display:'block', transform:'skewX(6deg)', textTransform:'capitalize' }}>{d}</span>
              </button>
            ))}
          </div>
        </Box>

        {/* Session Length — flashcards / quiz */}
        {(mode==='flashcards'||mode==='quiz') && (
          <Box dark={dark} style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Session Length</div>
            <div style={{ display:'flex', gap:8 }}>
              {[5,10,15,20].map(n => (
                <button key={n} onClick={() => setLen(n)}
                  style={{ flex:1, transform:'skewX(-6deg)', border:`1.5px solid ${len===n?cfg.accent:bdr}`, background:len===n?`${cfg.accent}18`:'transparent', color:len===n?cfg.accent:muted, padding:'7px 0', borderRadius:'2px 6px 2px 6px', cursor:'pointer', fontSize:14, fontWeight:700 }}>
                  <span style={{ display:'block', transform:'skewX(6deg)' }}>{n}</span>
                </button>
              ))}
            </div>
          </Box>
        )}

        {/* Time Limit — brain dump */}
        {mode==='brain_dump' && (
          <Box dark={dark} style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Time Limit (minutes)</div>
            <div style={{ display:'flex', gap:8 }}>
              {[2,5,10,15].map(n => (
                <button key={n} onClick={() => setTlimit(n)}
                  style={{ flex:1, transform:'skewX(-6deg)', border:`1.5px solid ${tlimit===n?cfg.accent:bdr}`, background:tlimit===n?`${cfg.accent}18`:'transparent', color:tlimit===n?cfg.accent:muted, padding:'7px 0', borderRadius:'2px 6px 2px 6px', cursor:'pointer', fontSize:14, fontWeight:700 }}>
                  <span style={{ display:'block', transform:'skewX(6deg)' }}>{n}</span>
                </button>
              ))}
            </div>
          </Box>
        )}

        {/* Persona — feynman */}
        {mode==='feynman' && (
          <Box dark={dark} style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Explain it to…</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {PERSONAS.map(p => (
                <button key={p.id} onClick={() => setPersona(p.id)}
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center', transform:'skewX(-3deg)', border:`1.5px solid ${persona===p.id?cfg.accent:bdr}`, background:persona===p.id?`${cfg.accent}15`:'transparent', color:persona===p.id?cfg.accent:fg, padding:'8px 14px', borderRadius:'2px 8px 2px 8px', cursor:'pointer', textAlign:'left' }}>
                  <span style={{ display:'block', transform:'skewX(3deg)' }}>
                    <span style={{ fontWeight:600, fontSize:13 }}>{p.name}</span>
                    <span style={{ fontSize:11, color:muted, marginLeft:8 }}>{p.description}</span>
                  </span>
                  {persona===p.id && <CheckCircle size={13} style={{ transform:'skewX(3deg)', flexShrink:0 }} />}
                </button>
              ))}
            </div>
          </Box>
        )}

        {/* Model */}
        <Box dark={dark} style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Model</div>
          <div style={{ fontSize:12, color:muted, marginBottom:10, lineHeight:1.5 }}>{cfg.modelHint}</div>
          <select value={sessionModel} onChange={e => setSessionModel(e.target.value)}
            style={{ width:'100%', background:cardBg, border:`1px solid ${bdr}`, color:fg, borderRadius:'8px 2px 8px 2px', padding:'8px 12px', fontSize:13, outline:'none' }}>
            {ALL_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.name} — {m.note}</option>
            ))}
          </select>
        </Box>

        <div style={{ display:'flex', justifyContent:'center', marginTop:4 }}>
          <Btn accent={cfg.accent} onClick={generate} disabled={busy||!sourceId}>
            {busy ? 'Generating…' : `Start ${cfg.label}`}
          </Btn>
        </div>
        {err && <div style={{ marginTop:10, textAlign:'center', fontSize:13, color:C.highlight }}>{err}</div>}
      </div>
    );
  };

  const FlashSession = () => {
    if (!sesh) return null;
    const item = sesh.items[idx]; const total = sesh.items.length;
    return (
      <div style={{ maxWidth:540, margin:'0 auto', padding:'0 16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <button onClick={() => setView('home')} style={{ background:'none', border:'none', color:muted, cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:13 }}><ChevronLeft size={14} /> Exit</button>
          <span style={{ fontSize:13, color:muted }}>{idx+1} / {total}</span>
        </div>
        <Bar cur={idx+1} total={total} accent={sa} />
        <div onClick={() => setFlipped(f=>!f)}
          style={{ marginTop:20, marginBottom:16, background:cardBg, border:`1.5px solid ${flipped?sa:bdr}`, borderRadius:'16px 3px 16px 3px', padding:'44px 28px', minHeight:180, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', transition:'border-color 0.2s' }}>
          <div style={{ fontSize:10, fontWeight:700, color:flipped?sa:muted, marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>{flipped?'Answer':'Question'}</div>
          <div style={{ fontSize:17, fontWeight:500, lineHeight:1.6 }}>{flipped?<Md>{item.back!}</Md>:item.front}</div>
          {!flipped && <div style={{ marginTop:14, fontSize:11, color:muted }}>tap to flip</div>}
        </div>
        {flipped
          ? <><div style={{ textAlign:'center', fontSize:12, color:muted, marginBottom:2 }}>How well did you know this?</div><Ratings onRate={rateNext} /></>
          : <div style={{ display:'flex', justifyContent:'center' }}><Btn accent={sa} onClick={() => setFlipped(true)}>Reveal Answer</Btn></div>
        }
      </div>
    );
  };

  const QuizSession = () => {
    if (!sesh) return null;
    const item = sesh.items[idx]; const total = sesh.items.length;
    const correct = sesh.items.filter(i => i.isCorrect).length;
    return (
      <div style={{ maxWidth:580, margin:'0 auto', padding:'0 16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <button onClick={() => setView('home')} style={{ background:'none', border:'none', color:muted, cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:13 }}><ChevronLeft size={14} /> Exit</button>
          <div style={{ display:'flex', gap:14, fontSize:13 }}>
            <span style={{ color:muted }}>{idx+1}/{total}</span>
            <span style={{ color:sa, fontWeight:700 }}>{correct} correct</span>
          </div>
        </div>
        <Bar cur={idx+1} total={total} accent={sa} />
        <Box dark={dark} accent={answered?(sesh.items[idx].isCorrect?C.green:C.highlight):undefined} style={{ marginTop:16, marginBottom:12 }}>
          <div style={{ fontWeight:600, fontSize:16, lineHeight:1.55 }}>{item.question}</div>
        </Box>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
          {(item.options||[]).map((opt, i) => {
            let bg2='transparent', bc=bdr;
            if (answered) { if (i===item.correctIndex){bg2='#4CAF5018';bc=C.green;} else if (i===picked){bg2='#F4433618';bc=C.red;} }
            return (
              <button key={i} onClick={() => pickOpt(i)} disabled={answered}
                style={{ display:'flex', alignItems:'center', gap:10, textAlign:'left', transform:'skewX(-3deg)', background:bg2, border:`1.5px solid ${bc}`, color:fg, padding:'11px 16px', borderRadius:'3px 10px 3px 10px', cursor:answered?'default':'pointer', fontSize:14, transition:'background 0.15s' }}>
                <span style={{ transform:'skewX(3deg)', display:'block', width:'100%' }}>
                  <span style={{ fontWeight:700, marginRight:8, color:answered&&i===item.correctIndex?C.green:(answered&&i===picked&&!item.isCorrect?C.red:muted) }}>{['A','B','C','D'][i]}.</span>
                  {opt}
                </span>
              </button>
            );
          })}
        </div>
        {answered && (
          <>
            <Box dark={dark} accent={sesh.items[idx].isCorrect?C.green:C.highlight} style={{ marginBottom:12, fontSize:13, lineHeight:1.6 }}>
              <div style={{ fontWeight:700, marginBottom:4, color:sesh.items[idx].isCorrect?C.green:C.highlight }}>{sesh.items[idx].isCorrect?'✓ Correct!':'✗ Incorrect'}</div>
              <Md>{item.explanation!}</Md>
            </Box>
            <div style={{ textAlign:'center' }}><div style={{ fontSize:12, color:muted, marginBottom:2 }}>How well did you know this?</div><Ratings onRate={rateNext} /></div>
          </>
        )}
      </div>
    );
  };

  const BrainSession = () => {
    if (!sesh) return null;
    const timerC = tsecs < 30 ? C.highlight : sa;
    return (
      <div style={{ maxWidth:620, margin:'0 auto', padding:'0 16px' }}>
        <button onClick={() => setView('home')} style={{ background:'none', border:'none', color:muted, cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:13, marginBottom:16 }}><ChevronLeft size={14} /> Exit</button>
        <Box dark={dark} style={{ marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div><div style={{ fontWeight:700, fontSize:15 }}>{sesh.topic}</div><div style={{ fontSize:12, color:muted, marginTop:2 }}>Write everything you know</div></div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:28, fontWeight:800, color:timerC, fontVariantNumeric:'tabular-nums' }}>{tsecs>0?fmt(tsecs):`${tlimit}:00`}</div>
            <button onClick={() => { if (!ton) setTsecs(tsecs>0?tsecs:tlimit*60); setTon(v=>!v); }} style={{ background:'none', border:'none', color:sa, cursor:'pointer', fontSize:11, fontWeight:700 }}>
              {ton?'Pause':tsecs>0?'Resume':'Start Timer'}
            </button>
          </div>
        </Box>
        {ton && <Bar cur={tsecs} total={tlimit*60} accent={timerC} />}
        {!fbk ? (
          <>
            <textarea value={resp} onChange={e => setResp(e.target.value)} placeholder={`Write everything you know about "${sesh.topic}"…`}
              style={{ width:'100%', minHeight:220, background:cardBg, border:`1px solid ${bdr}`, borderRadius:'12px 3px 12px 3px', padding:'16px', color:fg, fontSize:14, lineHeight:1.7, resize:'vertical', outline:'none', boxSizing:'border-box', marginTop:12 }}
              onFocus={e => e.currentTarget.style.borderColor=sa}
              onBlur={e => e.currentTarget.style.borderColor=bdr}
            />
            <div style={{ display:'flex', justifyContent:'center', marginTop:14 }}>
              <Btn accent={sa} onClick={submitBrain} disabled={busy||!resp.trim()}>{busy?'Evaluating…':'Get Feedback'}</Btn>
            </div>
          </>
        ) : (
          <div style={{ marginTop:14 }}>
            <div style={{ display:'flex', justifyContent:'space-around', marginBottom:16 }}>
              <Pill label="Score" value={fbk.score} accent={sa} />
              <Pill label="Strengths" value={fbk.strengths?.length??0} accent={C.green} />
              <Pill label="Gaps" value={fbk.missing?.length??0} accent={C.red} />
            </div>
            <Box dark={dark} style={{ marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.green, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Strengths</div>
              {(fbk.strengths||[]).map((s:string,i:number) => <div key={i} style={{ fontSize:13, paddingLeft:10 }}><Md>{s}</Md></div>)}
            </Box>
            <Box dark={dark} style={{ marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.red, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Missing / Gaps</div>
              {(fbk.missing||[]).map((s:string,i:number) => <div key={i} style={{ fontSize:13, paddingLeft:10 }}><Md>{s}</Md></div>)}
            </Box>
            <Box dark={dark} style={{ marginBottom:10 }}><Md style={{ fontSize:13 }}>{fbk.feedback}</Md></Box>
            {(fbk.studyTips?.length??0)>0 && (
              <Box dark={dark} style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:sa, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Study Tips</div>
                {fbk.studyTips.map((t:string,i:number) => <div key={i} style={{ fontSize:13, paddingLeft:10 }}><Md>{t}</Md></div>)}
              </Box>
            )}
            <div style={{ textAlign:'center', marginTop:16 }}>
              <div style={{ fontSize:12, color:muted, marginBottom:4 }}>How well did you know this overall?</div>
              <Ratings onRate={r => { patch(sesh.items[0].id, { userRating:r }); finish(); }} />
            </div>
          </div>
        )}
        {err && <div style={{ marginTop:10, textAlign:'center', fontSize:13, color:C.highlight }}>{err}</div>}
      </div>
    );
  };

  const FeynSession = () => {
    if (!sesh) return null;
    const p = PERSONAS.find(x => x.id===persona)||PERSONAS[2];
    return (
      <div style={{ maxWidth:620, margin:'0 auto', padding:'0 16px' }}>
        <button onClick={() => setView('home')} style={{ background:'none', border:'none', color:muted, cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:13, marginBottom:16 }}><ChevronLeft size={14} /> Exit</button>
        <Box dark={dark} style={{ marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:2 }}>{sesh.topic}</div>
          <div style={{ fontSize:13, color:sa }}>Explain to: <strong>{p.name}</strong></div>
          <div style={{ fontSize:12, color:muted, marginTop:2 }}>{p.description}</div>
        </Box>
        {!fbk ? (
          <>
            <textarea value={resp} onChange={e => setResp(e.target.value)} placeholder={`Explain "${sesh.topic}" to a ${p.name} in your own words…`}
              style={{ width:'100%', minHeight:220, background:cardBg, border:`1px solid ${bdr}`, borderRadius:'12px 3px 12px 3px', padding:'16px', color:fg, fontSize:14, lineHeight:1.7, resize:'vertical', outline:'none', boxSizing:'border-box' }}
              onFocus={e => e.currentTarget.style.borderColor=sa}
              onBlur={e => e.currentTarget.style.borderColor=bdr}
            />
            <div style={{ display:'flex', justifyContent:'center', marginTop:14 }}>
              <Btn accent={sa} onClick={submitFeynman} disabled={busy||!resp.trim()}>{busy?'Evaluating…':'Get Feedback'}</Btn>
            </div>
          </>
        ) : (
          <div>
            <div style={{ display:'flex', justifyContent:'space-around', marginBottom:16 }}>
              <Pill label="Clarity" value={fbk.clarityScore} accent={sa} />
              <Pill label="Accuracy" value={fbk.accuracyScore} accent={sa} />
              <Pill label="Complete" value={fbk.completenessScore} accent={sa} />
              <Pill label="Overall" value={fbk.overallScore} accent={C.accent} />
            </div>
            <Box dark={dark} style={{ marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:sa, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Audience Fit</div>
              <Md style={{ fontSize:13 }}>{fbk.audienceFit}</Md>
            </Box>
            <Box dark={dark} style={{ marginBottom:10 }}><Md style={{ fontSize:13 }}>{fbk.feedback}</Md></Box>
            {(fbk.suggestions?.length??0)>0 && (
              <Box dark={dark} style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:sa, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Suggestions</div>
                {fbk.suggestions.map((s:string,i:number) => <div key={i} style={{ fontSize:13, paddingLeft:10 }}><Md>{s}</Md></div>)}
              </Box>
            )}
            <div style={{ textAlign:'center', marginTop:16 }}>
              <div style={{ fontSize:12, color:muted, marginBottom:4 }}>How well did you know this overall?</div>
              <Ratings onRate={r => { patch(sesh.items[0].id, { userRating:r }); finish(); }} />
            </div>
          </div>
        )}
        {err && <div style={{ marginTop:10, textAlign:'center', fontSize:13, color:C.highlight }}>{err}</div>}
      </div>
    );
  };

  const Complete = () => {
    if (!sesh) return null;
    const items = sesh.items;
    const easy=items.filter(i=>i.userRating==='easy').length;
    const med=items.filter(i=>i.userRating==='medium').length;
    const hard=items.filter(i=>i.userRating==='hard').length;
    return (
      <div style={{ maxWidth:520, margin:'0 auto', padding:'0 16px' }}>
        <Box dark={dark} accent={sa} style={{ textAlign:'center', marginBottom:16 }}>
          <Award size={34} style={{ color:sa, margin:'0 auto 10px' }} />
          <div style={{ fontSize:21, fontWeight:800, marginBottom:4 }}>Session Complete</div>
          <div style={{ fontSize:13, color:muted }}>{sesh.topic}</div>
          {sesh.mode==='quiz'&&sesh.score!==undefined&&(
            <div style={{ marginTop:12, fontSize:30, fontWeight:800, color:sa }}>
              {sesh.score}/{sesh.maxScore}<span style={{ fontSize:14, fontWeight:500, color:muted, marginLeft:6 }}>({Math.round((sesh.score/(sesh.maxScore||1))*100)}%)</span>
            </div>
          )}
          {(sesh.mode==='brain_dump'||sesh.mode==='feynman')&&sesh.score!==undefined&&(
            <div style={{ marginTop:12, fontSize:30, fontWeight:800, color:sa }}>{sesh.score}<span style={{ fontSize:14, color:muted }}>/100</span></div>
          )}
        </Box>
        {(easy+med+hard)>0&&(
          <Box dark={dark} style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>Self-Assessment</div>
            <div style={{ display:'flex', justifyContent:'space-around' }}>
              <Pill label="Easy" value={easy} accent={C.green} />
              <Pill label="Medium" value={med} accent={C.amber} />
              <Pill label="Hard" value={hard} accent={C.red} />
            </div>
          </Box>
        )}
        <Box dark={dark} style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Session Notes</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes} placeholder="What did you learn? Anything to revisit?"
            style={{ width:'100%', background:'transparent', border:`1px solid ${bdr}`, borderRadius:'8px 2px 8px 2px', padding:'10px 12px', color:fg, fontSize:13, lineHeight:1.6, resize:'none', outline:'none', minHeight:70, boxSizing:'border-box' }}
          />
        </Box>
        <div style={{ display:'flex', justifyContent:'center', gap:10, flexWrap:'wrap' }}>
          {hard>0&&<Btn accent={C.red} variant="outline" onClick={weakSpots}><Target size={12} style={{ marginRight:4, display:'inline', verticalAlign:'middle' }} />Review {hard} Hard Items</Btn>}
          <Btn accent={sa} onClick={() => { setView('home'); setMode(null); }}>New Session</Btn>
        </div>
      </div>
    );
  };

  const Library = () => {
    const deck = libDeck ? data.decks.find(d => d.id===libDeck) : null;
    if (deck) {
      const dSesh = data.sessions.filter(s => s.deckId===libDeck&&(libFilt==='all'||s.status===libFilt));
      return (
        <div style={{ maxWidth:680, margin:'0 auto', padding:'0 16px' }}>
          <button onClick={() => setLibDeck(null)} style={{ background:'none', border:'none', color:muted, cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:13, marginBottom:16 }}><ChevronLeft size={14} /> All Decks</button>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
            <div style={{ fontWeight:700, fontSize:17 }}>{deck.name}</div>
            <div style={{ display:'flex', gap:5 }}>
              {(['all','not_started','in_progress','completed'] as const).map(f => (
                <button key={f} onClick={() => setLibFilt(f)}
                  style={{ transform:'skewX(-5deg)', border:`1px solid ${libFilt===f?C.accent:bdr}`, background:libFilt===f?`${C.accent}18`:'transparent', color:libFilt===f?C.accent:muted, padding:'4px 10px', borderRadius:'2px 5px 2px 5px', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                  <span style={{ display:'block', transform:'skewX(5deg)' }}>{f==='all'?'All':f==='not_started'?'Not Started':f==='in_progress'?'In Progress':'Done'}</span>
                </button>
              ))}
            </div>
          </div>
          {dSesh.length===0
            ? <div style={{ textAlign:'center', color:muted, padding:'40px 0', fontSize:14 }}>No sessions here yet</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {dSesh.map(s => {
                  const mc=MODE_CONFIG[s.mode];
                  const si=s.status==='completed'?<CheckCircle size={12} color={C.green}/>:s.status==='in_progress'?<Clock size={12} color={C.amber}/>:<Circle size={12} color={String(muted)}/>;
                  const hardC=s.items.filter(i=>i.userRating==='hard').length;
                  return (
                    <Box key={s.id} dark={dark} accent={mc.accent}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>{si}<span style={{ fontWeight:600, fontSize:14 }}>{s.topic}</span></div>
                          <div style={{ display:'flex', gap:8, fontSize:11, color:muted, flexWrap:'wrap' }}>
                            <span style={{ color:mc.accent, fontWeight:700 }}>{mc.label}</span>
                            <span>· {s.difficulty}</span>
                            {s.score!==undefined&&<span>· {s.mode==='quiz'?`${s.score}/${s.maxScore}`:`${s.score}/100`}</span>}
                            <span>· {fmtDate(s.createdAt)}</span>
                            {hardC>0&&<span style={{ color:C.red }}>· {hardC} hard</span>}
                          </div>
                          {s.notes&&<div style={{ marginTop:8, fontSize:12, color:muted, borderLeft:`2px solid ${mc.accent}40`, paddingLeft:8 }}>{s.notes}</div>}
                        </div>
                        <button onClick={() => upd(d=>({...d,sessions:d.sessions.filter(x=>x.id!==s.id)}))}
                          style={{ background:'none', border:'none', color:muted, cursor:'pointer', padding:4, marginLeft:8 }}><X size={13}/></button>
                      </div>
                    </Box>
                  );
                })}
              </div>
          }
        </div>
      );
    }
    return (
      <div style={{ maxWidth:680, margin:'0 auto', padding:'0 16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:17 }}>Your Decks</div>
          {showLND?(
            <div style={{ display:'flex', gap:6 }}>
              <input value={lndName} onChange={e => setLndName(e.target.value)} placeholder="Deck name" autoFocus
                style={{ background:'transparent', border:`1px solid ${bdr}`, borderRadius:'4px', padding:'6px 10px', color:fg, fontSize:13, outline:'none' }}
                onKeyDown={e => { if (e.key==='Enter'&&lndName.trim()){mkDeck(lndName.trim());setLndName('');setShowLND(false);} }}
              />
              <Btn sm onClick={() => { if (lndName.trim()){mkDeck(lndName.trim());setLndName('');setShowLND(false);} }}>Create</Btn>
              <Btn sm variant="ghost" onClick={() => setShowLND(false)}>Cancel</Btn>
            </div>
          ):<Btn sm onClick={() => setShowLND(true)}>+ New Deck</Btn>}
        </div>
        {data.decks.length===0
          ? <div style={{ textAlign:'center', color:muted, padding:'60px 0', fontSize:14 }}>No decks yet — start a study session to create one automatically</div>
          : <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {data.decks.map(d => {
                const ds=data.sessions.filter(s=>s.deckId===d.id);
                const done=ds.filter(s=>s.status==='completed').length;
                return (
                  <Box key={d.id} dark={dark} onClick={() => setLibDeck(d.id)} style={{ cursor:'pointer' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div style={{ fontWeight:700, fontSize:15 }}>{d.name}</div>
                      <button onClick={e=>{e.stopPropagation();rmDeck(d.id);}} style={{ background:'none', border:'none', color:muted, cursor:'pointer', padding:2 }}><Trash2 size={12}/></button>
                    </div>
                    <div style={{ fontSize:12, color:muted, marginBottom:ds.length>0?10:0 }}>{ds.length} sessions · {done} completed</div>
                    {ds.length>0&&<Bar cur={done} total={ds.length} accent={C.accent}/>}
                  </Box>
                );
              })}
            </div>
        }
      </div>
    );
  };

  const SourcesTab = () => (
    <div style={{ maxWidth:680, margin:'0 auto', padding:'0 16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div style={{ fontWeight:700, fontSize:17 }}>Sources</div>
        <div style={{ display:'flex', gap:8 }}>
          <Btn sm variant="outline" onClick={() => fileRef.current?.click()}>Upload file</Btn>
          <Btn sm accent={C.amber} onClick={() => { setResearchQuery(''); setShowResearch(true); }}>
            <Search size={12} style={{ marginRight:4, display:'inline', verticalAlign:'middle' }} />Research
          </Btn>
          <input ref={fileRef} type="file" accept=".txt,.md,text/plain,text/markdown" style={{ display:'none' }} onChange={uploadFile} />
        </div>
      </div>

      {showResearch && <ResearchForm accentColor={C.amber} />}

      {data.sources.length===0&&!showResearch ? (
        <div style={{ textAlign:'center', color:muted, padding:'60px 0', fontSize:14 }}>
          No sources yet — upload a file or research a topic with Perplexity
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {data.sources.map(src => {
            const used=data.sessions.filter(s=>s.sourceId===src.id).length;
            const words=wc(src.content);
            const expanded=previewSrcId===src.id;
            const srcAccent=src.origin==='perplexity'?C.amber:C.accent;
            return (
              <Box key={src.id} dark={dark} accent={srcAccent} onClick={() => setPreviewSrcId(expanded?null:src.id)} style={{ cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                  <div style={{ fontWeight:700, fontSize:14, flex:1, paddingRight:8 }}>{src.name}</div>
                  <div style={{ display:'flex', gap:4, alignItems:'center', flexShrink:0 }}>
                    <span onClick={e => e.stopPropagation()}>
                      <Btn sm variant={src.converted?'primary':'outline'} accent={C.amber}
                        onClick={() => convertSource(src)}
                        disabled={!!convertingSourceId}
                      >{convertingSourceId===src.id?'…':src.converted?'✓ Converted':'✦ Convert'}</Btn>
                    </span>
                    <button onClick={e=>{e.stopPropagation();rmSource(src.id);}} style={{ background:'none', border:'none', color:muted, cursor:'pointer', padding:2 }}><X size={13}/></button>
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6, flexWrap:'wrap' }}>
                  <span style={{ fontSize:10, fontWeight:700, background:`${srcAccent}20`, color:srcAccent, padding:'2px 7px', borderRadius:'3px' }}>
                    {src.origin==='perplexity'?'Perplexity':'Upload'}
                  </span>
                  <span style={{ fontSize:11, color:muted }}>{words.toLocaleString()} words</span>
                  {used>0&&<span style={{ fontSize:11, color:muted }}>· {used} {used===1?'session':'sessions'}</span>}
                </div>
                <div style={{ fontSize:11, color:muted }}>{fmtDate(src.uploadedAt)}</div>
                {expanded&&(
                  <div style={{ marginTop:10, fontSize:12, color:muted, lineHeight:1.6, borderTop:`1px solid ${srcAccent}30`, paddingTop:10 }}>
                    {src.content.slice(0,500)}{src.content.length>500?'…':''}
                  </div>
                )}
                {!expanded&&<div style={{ fontSize:11, color:muted, marginTop:6, opacity:0.6 }}>Click to preview</div>}
              </Box>
            );
          })}
        </div>
      )}
    </div>
  );

  const Stats = () => {
    const total=data.sessions.length;
    const done=data.sessions.filter(s=>s.status==='completed').length;
    const qSesh=data.sessions.filter(s=>s.mode==='quiz'&&s.score!==undefined&&s.maxScore);
    const avgQ=qSesh.length>0?Math.round(qSesh.reduce((acc,s)=>acc+(s.score!/s.maxScore!)*100,0)/qSesh.length):null;
    const allHard=data.sessions.flatMap(s=>s.items.filter(i=>i.userRating==='hard'&&(i.front||i.question)));
    const modeB=(Object.keys(MODE_CONFIG) as Mode[]).map(m=>({m,n:data.sessions.filter(s=>s.mode===m).length}));
    return (
      <div style={{ maxWidth:680, margin:'0 auto', padding:'0 16px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:18 }}>
          {[{l:'Total',v:total,a:C.accent},{l:'Completed',v:done,a:C.green},{l:'Avg Quiz',v:avgQ!==null?`${avgQ}%`:'—',a:C.amber}].map(({l,v,a})=>(
            <Box key={l} dark={dark} accent={a} style={{ textAlign:'center' }}>
              <div style={{ fontSize:30, fontWeight:800, color:a }}>{v}</div>
              <div style={{ fontSize:11, color:muted, marginTop:3 }}>{l}</div>
            </Box>
          ))}
        </div>
        <Box dark={dark} style={{ marginBottom:18 }}>
          <div style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>By Mode</div>
          {modeB.map(({m,n})=>(
            <div key={m} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div style={{ color:MODE_CONFIG[m].accent, width:16 }}>{MODE_CONFIG[m].icon}</div>
              <div style={{ width:88, fontSize:13 }}>{MODE_CONFIG[m].label}</div>
              <div style={{ flex:1, height:5, background:'rgba(128,128,128,0.15)', borderRadius:2, overflow:'hidden' }}>
                <div style={{ width:total>0?`${(n/total)*100}%`:'0%', height:'100%', background:MODE_CONFIG[m].accent, borderRadius:2 }}/>
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:MODE_CONFIG[m].accent, width:20, textAlign:'right' }}>{n}</div>
            </div>
          ))}
        </Box>
        {allHard.length>0&&(
          <Box dark={dark} style={{ marginBottom:18 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.red, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Weak Spots — {allHard.length} hard-rated items</div>
            {allHard.slice(0,8).map((item,i)=>(
              <div key={i} style={{ fontSize:12, padding:'6px 10px', marginBottom:5, background:`${C.red}10`, borderRadius:'3px 1px 3px 1px', borderLeft:`2px solid ${C.red}`, lineHeight:1.5 }}>
                {item.front||item.question}
              </div>
            ))}
            {allHard.length>8&&<div style={{ fontSize:12, color:muted, textAlign:'center', marginTop:6 }}>and {allHard.length-8} more</div>}
          </Box>
        )}
        {data.subjectHistory.length>0&&(
          <Box dark={dark}>
            <div style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Subject History</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {data.subjectHistory.map(h=>(
                <button key={h} onClick={() => { setTopic(h); setTab('study'); setView('home'); }}
                  style={{ transform:'skewX(-5deg)', background:`${C.accent}12`, border:`1px solid ${C.accent}40`, color:C.accent, padding:'5px 12px', borderRadius:'2px 6px 2px 6px', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                  <span style={{ display:'block', transform:'skewX(5deg)' }}>{h}</span>
                </button>
              ))}
            </div>
          </Box>
        )}
      </div>
    );
  };

  const sessionRouter = () => {
    if (!sesh) return null;
    switch (sesh.mode) {
      case 'flashcards': return <FlashSession />;
      case 'quiz':       return <QuizSession />;
      case 'brain_dump': return <BrainSession />;
      case 'feynman':    return <FeynSession />;
    }
  };

  const studyRouter = () => {
    switch (view) {
      case 'home':     return Home();
      case 'setup':    return Setup();
      case 'session':  return sessionRouter();
      case 'complete': return Complete();
    }
  };

  return (
    <div style={{ background:bg, color:fg, minHeight:'100vh', fontFamily:'system-ui,-apple-system,sans-serif', ...diag(ma) }}>
      {/* Header */}
      <div style={{ borderBottom:`1px solid ${bdr}`, padding:'0 20px', display:'flex', justifyContent:'space-between', alignItems:'center', height:52 }}>
        <div style={{ fontWeight:800, fontSize:18, letterSpacing:'-0.02em', cursor:'pointer' }} onClick={() => { setTab('study'); setView('home'); }}>
          <span style={{ color:C.accent }}>Re</span>freisher
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <button onClick={() => { setKeyInput(''); setShowKey(true); }} title={apiKey?'Settings':'Configure API key'}
            style={{ background:'none', border:`1px solid ${apiKey?bdr:C.highlight}`, color:apiKey?C.accent:C.highlight, padding:'5px 10px', borderRadius:'4px', cursor:'pointer' }}>
            <Key size={13} />
          </button>
          <button onClick={exportAll} title="Export"
            style={{ background:'none', border:`1px solid ${bdr}`, color:muted, padding:'5px 10px', borderRadius:'4px 1px 4px 1px', cursor:'pointer' }}><Download size={13}/></button>
          <button onClick={() => importRef.current?.click()} title="Import"
            style={{ background:'none', border:`1px solid ${bdr}`, color:muted, padding:'5px 10px', borderRadius:'1px 4px 1px 4px', cursor:'pointer' }}><Upload size={13}/></button>
          <input ref={importRef} type="file" accept=".json" style={{ display:'none' }} onChange={importAll}/>
          <button onClick={() => setDark(v=>!v)}
            style={{ background:'none', border:`1px solid ${bdr}`, color:C.accent, padding:'5px 10px', borderRadius:'4px', cursor:'pointer' }}>
            {dark?<Sun size={13}/>:<Moon size={13}/>}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom:`1px solid ${bdr}`, display:'flex', padding:'0 20px' }}>
        {([
          { id:'study'   as Tab, label:'Study',   icon:<BookOpen size={13}/> },
          { id:'library' as Tab, label:'Library', icon:<BookMarked size={13}/> },
          { id:'sources' as Tab, label:'Sources', icon:<Database size={13}/> },
          { id:'stats'   as Tab, label:'Stats',   icon:<BarChart2 size={13}/> },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'11px 16px', background:'none', border:'none', borderBottom:`2px solid ${tab===t.id?C.accent:'transparent'}`, color:tab===t.id?C.accent:muted, cursor:'pointer', fontSize:13, fontWeight:600, marginBottom:-1, transition:'color 0.15s' }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {err && (
        <div style={{ background:`${C.highlight}15`, borderBottom:`1px solid ${C.highlight}35`, padding:'9px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13 }}>
          <span style={{ color:C.highlight }}>{err}</span>
          <button onClick={() => setErr(null)} style={{ background:'none', border:'none', color:C.highlight, cursor:'pointer' }}><X size={13}/></button>
        </div>
      )}

      {/* Content */}
      <div style={{ padding:'26px 20px' }}>
        {tab==='study'   && studyRouter()}
        {tab==='library' && <Library />}
        {tab==='sources' && <SourcesTab />}
        {tab==='stats'   && <Stats />}
      </div>

      {/* Settings modal */}
      {showKey && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:'0 20px' }}>
          <Box dark={dark} style={{ maxWidth:440, width:'100%', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ fontWeight:700, fontSize:16 }}>Settings</div>
              <button onClick={() => setShowKey(false)} style={{ background:'none', border:'none', color:muted, cursor:'pointer' }}><X size={16}/></button>
            </div>

            {/* API Key section */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.accent, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>OpenRouter API Key</div>
              <div style={{ fontSize:12, color:muted, marginBottom:10, lineHeight:1.6 }}>
                Stored only in your browser. All requests go directly to OpenRouter — never to any other server.
              </div>
              <input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)}
                placeholder={apiKey ? '••••••••••••••••' : 'sk-or-v1-…'}
                autoFocus onKeyDown={e => e.key==='Enter' && saveKey()}
                style={{ width:'100%', background:'transparent', border:`1px solid ${bdr}`, borderRadius:'8px 2px 8px 2px', padding:'10px 14px', color:fg, fontSize:14, outline:'none', boxSizing:'border-box', marginBottom:8 }}
                onFocus={e => e.currentTarget.style.borderColor=C.accent}
                onBlur={e => e.currentTarget.style.borderColor=bdr}
              />
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:C.accent, textDecoration:'none' }}>Get a key at openrouter.ai →</a>
                <Btn sm onClick={saveKey} disabled={!keyInput.trim()}>Save Key</Btn>
              </div>
            </div>

            <div style={{ borderTop:`1px solid ${bdr}`, paddingTop:20 }}>
              <ModelSelect
                label="Generation Model"
                subtitle="Flashcards & quiz creation — fast cheap models work great"
                value={genModel}
                options={GENERATION_MODELS}
                onChange={updateGenModel}
                dark={dark} bdr={bdr} fg={fg} cardBg={cardBg} accent={C.accent}
              />
              <ModelSelect
                label="Evaluation Model"
                subtitle="Brain dump & Feynman feedback — more judgment needed"
                value={evalModel}
                options={EVALUATION_MODELS}
                onChange={updateEvalModel}
                dark={dark} bdr={bdr} fg={fg} cardBg={cardBg} accent={MODE_CONFIG.feynman.accent}
              />
              <div style={{ fontSize:12, color:muted, marginTop:4, lineHeight:1.6 }}>
                Research (Sources) always uses <strong style={{ color:C.amber }}>Perplexity Sonar Deep Research</strong> — no model choice needed.
              </div>
            </div>
          </Box>
        </div>
      )}
    </div>
  );
}
