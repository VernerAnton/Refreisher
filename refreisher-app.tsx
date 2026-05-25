import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Brain, Edit3, User, Sun, Moon,
  Trash2, Download, Upload, ChevronLeft,
  BarChart2, BookMarked, CheckCircle, Circle, Clock,
  X, FileText, Target, Award, Key
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────
type Mode = 'flashcards' | 'quiz' | 'brain_dump' | 'feynman';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';
type Status = 'not_started' | 'in_progress' | 'completed';
type Rating = 'easy' | 'medium' | 'hard';
type Tab = 'study' | 'library' | 'stats';
type StudyView = 'home' | 'setup' | 'session' | 'complete';

interface StudyItem {
  id: string;
  front?: string;
  back?: string;
  question?: string;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
  userResponse?: string;
  aiFeedback?: string;
  aiScores?: { clarity: number; accuracy: number; completeness: number; overall: number };
  persona?: string;
  userRating?: Rating;
  userAnswer?: number;
  isCorrect?: boolean;
  aiScore?: number;
  lastAttemptedAt?: string;
  _syncMeta?: { synced: boolean };
}

interface Session {
  id: string;
  deckId: string;
  topic: string;
  mode: Mode;
  difficulty: Difficulty;
  sessionLength: number;
  status: Status;
  score?: number;
  maxScore?: number;
  notes: string;
  ragFileId?: string;
  items: StudyItem[];
  createdAt: string;
  completedAt?: string;
  updatedAt: string;
  _syncMeta?: { synced: boolean; syncedAt?: string };
}

interface Deck {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _syncMeta?: { synced: boolean; syncedAt?: string };
}

interface StoredFile {
  id: string;
  name: string;
  content: string;
  uploadedAt: string;
}

interface AppData {
  version: string;
  decks: Deck[];
  sessions: Session[];
  ragFiles: StoredFile[];
  subjectHistory: string[];
}

// ─── Constants ────────────────────────────────────────────
const STORAGE_KEY = 'refreisher_v1';

const PERSONAS = [
  { id: 'child', name: '5-year-old', description: 'Very simple words, zero technical terms' },
  { id: 'teenager', name: 'High schooler', description: 'Basic concepts ok, stay accessible' },
  { id: 'friend', name: 'Non-expert friend', description: 'Smart but no domain background' },
  { id: 'graduate', name: 'Graduate student', description: 'Understands complex concepts' },
  { id: 'professor', name: 'Domain expert', description: 'Precise terminology, full depth' },
];

const MODE_CONFIG: Record<Mode, { label: string; accent: string; icon: React.ReactNode; description: string }> = {
  flashcards: { label: 'Flashcards', accent: '#FF6B89', icon: <BookOpen size={20} />, description: 'Flip cards to test recall' },
  quiz:        { label: 'Quiz',       accent: '#FF002C', icon: <Brain size={20} />,    description: 'Multiple-choice with immediate feedback' },
  brain_dump:  { label: 'Brain Dump', accent: '#C97B9E', icon: <Edit3 size={20} />,    description: 'Timed free recall — write everything you know' },
  feynman:     { label: 'Feynman',    accent: '#FF8C69', icon: <User size={20} />,     description: 'Explain the concept to an audience' },
};

const C = {
  bgDark: '#0D1628', bgLight: '#FFF0F3',
  fgDark: '#F8E8EC', fgLight: '#2A1520',
  accent: '#FF6B89', highlight: '#FF002C',
  cardDark: '#152035', cardLight: '#FFF8FA',
  green: '#4CAF50', amber: '#FF9800', red: '#F44336',
};

const DEFAULT_DATA: AppData = { version: '1.0', decks: [], sessions: [], ragFiles: [], subjectHistory: [] };

// ─── Helpers ──────────────────────────────────────────────
const uid = () => crypto.randomUUID();
const ts  = () => new Date().toISOString();

const loadData = (): AppData => {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? { ...DEFAULT_DATA, ...JSON.parse(r) } : DEFAULT_DATA; }
  catch { return DEFAULT_DATA; }
};

const parseAI = (raw: string): any => {
  let s = raw.trim();
  if (s.startsWith('```json')) s = s.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  else if (s.startsWith('```')) s = s.replace(/^```\s*/, '').replace(/\s*```$/, '');
  return JSON.parse(s);
};

const rag = (fileId: string | undefined, files: StoredFile[]): string => {
  if (!fileId) return '';
  const f = files.find(x => x.id === fileId);
  if (!f) return '';
  return `\n\nReference material — base your content primarily on this:\n---\n${f.content}\n---\n`;
};

const fmt = (secs: number) => `${Math.floor(secs/60).toString().padStart(2,'0')}:${(secs%60).toString().padStart(2,'0')}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ─── Prompts ──────────────────────────────────────────────
const pFlash = (topic: string, diff: string, n: number, r: string) =>
  `Generate ${n} flashcards for: "${topic}" at ${diff} level.${r}\nMix definitions, concepts, applications.\nRespond with valid JSON only, no markdown:\n{"flashcards":[{"front":"question","back":"answer"}]}`;

const pQuiz = (topic: string, diff: string, n: number, r: string) =>
  `Generate ${n} multiple-choice questions for: "${topic}" at ${diff} level.${r}\nEach needs exactly 4 options.\nRespond with valid JSON only, no markdown:\n{"questions":[{"question":"text","options":["A","B","C","D"],"correctIndex":0,"explanation":"why"}]}`;

const pBrain = (topic: string, resp: string, r: string) =>
  `Evaluate this brain dump about "${topic}".${r}\nStudent wrote: "${resp}"\nRespond with valid JSON only, no markdown:\n{"score":75,"strengths":["concept A"],"missing":["concept B"],"feedback":"overall","studyTips":["tip 1"]}`;

const pFeynman = (topic: string, resp: string, pid: string, r: string) => {
  const p = PERSONAS.find(x => x.id === pid) || PERSONAS[2];
  return `Evaluate explanation of "${topic}" for: ${p.name} (${p.description}).${r}\nStudent wrote: "${resp}"\nRespond with valid JSON only, no markdown:\n{"clarityScore":80,"accuracyScore":85,"completenessScore":70,"overallScore":78,"audienceFit":"did they pitch correctly?","feedback":"overall","suggestions":["suggestion 1"]}`;
};

// ─── API ──────────────────────────────────────────────────
const callClaudeAPI = async (key: string, prompt: string): Promise<string> => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-allow-browser': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error?.message || `API error ${res.status}`);
  }
  const json = await res.json();
  return json.content[0].text;
};

// ─── UI Primitives ────────────────────────────────────────
function Btn({ children, onClick, disabled = false, variant = 'primary', accent, sm }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: 'primary' | 'outline' | 'ghost'; accent?: string; sm?: boolean;
}) {
  const a = accent || C.accent;
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        transform: 'skewX(-8deg)',
        background: variant === 'primary' ? (disabled ? 'rgba(128,128,128,0.2)' : a) : 'transparent',
        border: variant === 'outline' ? `1.5px solid ${disabled ? 'rgba(128,128,128,0.3)' : a}` : 'none',
        color: variant === 'primary' ? (disabled ? 'rgba(128,128,128,0.4)' : '#fff') : (disabled ? 'rgba(128,128,128,0.4)' : a),
        padding: sm ? '5px 14px' : '9px 22px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 600, fontSize: sm ? 12 : 14,
        borderRadius: '2px 8px 2px 8px',
        transition: 'opacity 0.15s', opacity: disabled ? 0.55 : 1,
        letterSpacing: '0.02em', lineHeight: 1.4,
      }}>
      <span style={{ display: 'block', transform: 'skewX(8deg)' }}>{children}</span>
    </button>
  );
}

function Box({ children, dark, accent, style = {}, onClick }: {
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
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
      <Btn accent={C.green}  onClick={() => onRate('easy')}>Easy</Btn>
      <Btn accent={C.amber}  onClick={() => onRate('medium')}>Medium</Btn>
      <Btn accent={C.red}    onClick={() => onRate('hard')}>Hard</Btn>
    </div>
  );
}

function Bar({ cur, total, accent }: { cur: number; total: number; accent: string }) {
  return (
    <div style={{ width: '100%', height: 4, background: 'rgba(128,128,128,0.18)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: total > 0 ? `${(cur/total)*100}%` : '0%', height: '100%', background: accent, transition: 'width 0.3s', borderRadius: 2 }} />
    </div>
  );
}

function Pill({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────
export default function RefreisherApp() {
  const [data, setData]         = useState<AppData>(loadData);
  const [dark, setDark]         = useState(true);
  const [tab, setTab]           = useState<Tab>('study');
  const [view, setView]         = useState<StudyView>('home');
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const [apiKey, setApiKey]     = useState(() => localStorage.getItem('anthropic_api_key') || '');
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey]   = useState(false);

  // Setup
  const [topic, setTopic]       = useState('');
  const [mode, setMode]         = useState<Mode | null>(null);
  const [diff, setDiff]         = useState<Difficulty>('intermediate');
  const [len, setLen]           = useState(10);
  const [deckId, setDeckId]     = useState('');
  const [ragId, setRagId]       = useState<string | undefined>(undefined);
  const [persona, setPersona]   = useState('friend');
  const [tlimit, setTlimit]     = useState(5);
  const [showND, setShowND]     = useState(false);
  const [ndName, setNdName]     = useState('');

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

  const importRef = useRef<HTMLInputElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);

  useEffect(() => {
    if (!ton) return;
    if (tsecs <= 0) { setTon(false); return; }
    const id = setInterval(() => setTsecs(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [ton, tsecs]);

  // Theme
  const bg   = dark ? C.bgDark   : C.bgLight;
  const fg   = dark ? C.fgDark   : C.fgLight;
  const bdr  = dark ? 'rgba(255,107,137,0.18)' : 'rgba(255,107,137,0.28)';
  const muted = dark ? 'rgba(248,232,236,0.45)' : 'rgba(42,21,32,0.45)';
  const cardBg = dark ? C.cardDark : C.cardLight;
  const ma   = mode  ? MODE_CONFIG[mode].accent  : C.accent;
  const sa   = sesh  ? MODE_CONFIG[sesh.mode].accent : C.accent;
  const diag = (a = C.accent) => ({ backgroundImage: `repeating-linear-gradient(45deg,transparent,transparent 38px,${a}07 38px,${a}07 39px)` });

  // ─── API + key ───
  const call = (prompt: string) => callClaudeAPI(apiKey, prompt);

  const saveKey = () => {
    const k = keyInput.trim();
    if (!k) return;
    localStorage.setItem('anthropic_api_key', k);
    setApiKey(k);
    setKeyInput('');
    setShowKey(false);
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
      const sf: StoredFile = { id: uid(), name: f.name, content: ev.target?.result as string, uploadedAt: ts() };
      upd(s => ({ ...s, ragFiles: [...s.ragFiles, sf] }));
      setRagId(sf.id);
    };
    reader.readAsText(f); e.target.value = '';
  };

  const rmFile = (id: string) => {
    upd(s => ({ ...s, ragFiles: s.ragFiles.filter(f => f.id !== id) }));
    if (ragId === id) setRagId(undefined);
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
          const fIds = new Set(d.ragFiles.map(x => x.id));
          return {
            ...d,
            decks: [...d.decks, ...(imp.decks||[]).filter(x => !dIds.has(x.id))],
            sessions: [...d.sessions, ...(imp.sessions||[]).filter(x => !sIds.has(x.id))],
            ragFiles: [...d.ragFiles, ...(imp.ragFiles||[]).filter(x => !fIds.has(x.id))],
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
    const ok = i === item.correctIndex;
    setPicked(i); setAnswered(true);
    patch(item.id, { userAnswer: i, isCorrect: ok });
  };

  const submitBrain = async () => {
    if (!resp.trim() || !sesh) return;
    setBusy(true); setTon(false);
    try {
      const raw = await call(pBrain(sesh.topic, resp, rag(sesh.ragFileId, data.ragFiles)));
      const fb = parseAI(raw); setFbk(fb);
      patch(sesh.items[0].id, { userResponse: resp, aiFeedback: JSON.stringify(fb), aiScore: fb.score });
    } catch { setErr('Evaluation failed — please try again.'); }
    finally { setBusy(false); }
  };

  const submitFeynman = async () => {
    if (!resp.trim() || !sesh) return;
    setBusy(true);
    try {
      const raw = await call(pFeynman(sesh.topic, resp, persona, rag(sesh.ragFileId, data.ragFiles)));
      const fb = parseAI(raw); setFbk(fb);
      patch(sesh.items[0].id, {
        userResponse: resp, persona, aiFeedback: JSON.stringify(fb), aiScore: fb.overallScore,
        aiScores: { clarity: fb.clarityScore, accuracy: fb.accuracyScore, completeness: fb.completenessScore, overall: fb.overallScore },
      });
    } catch { setErr('Evaluation failed — please try again.'); }
    finally { setBusy(false); }
  };

  const finish = (s?: Session) => {
    const t = s || sesh; if (!t) return;
    let score: number | undefined, maxScore: number | undefined;
    if (t.mode === 'quiz') {
      const qs = t.items.filter(i => i.question !== undefined);
      score = qs.filter(i => i.isCorrect).length; maxScore = qs.length;
    } else if (t.mode === 'brain_dump' || t.mode === 'feynman') {
      score = t.items[0]?.aiScore; maxScore = 100;
    }
    const done: Session = { ...t, status: 'completed', score, maxScore, completedAt: ts(), updatedAt: ts() };
    syncSesh(done); setSesh(done); setView('complete');
  };

  const generate = async () => {
    if (!topic.trim() || !mode) return;
    setBusy(true); setErr(null);
    let did = deckId || mkDeck(topic);
    if (!deckId) setDeckId(did);
    const r = rag(ragId, data.ragFiles);
    try {
      let items: StudyItem[] = [];
      if (mode === 'flashcards') {
        const d = parseAI(await call(pFlash(topic, diff, len, r)));
        items = (d.flashcards||[]).map((f: any) => ({ id: uid(), front: f.front, back: f.back, _syncMeta: { synced: false } }));
      } else if (mode === 'quiz') {
        const d = parseAI(await call(pQuiz(topic, diff, len, r)));
        items = (d.questions||[]).map((q: any) => ({ id: uid(), question: q.question, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation, _syncMeta: { synced: false } }));
      } else {
        items = [{ id: uid(), _syncMeta: { synced: false } }];
      }
      const s: Session = {
        id: uid(), deckId: did, topic, mode, difficulty: diff, sessionLength: len,
        status: 'in_progress', notes: '', ragFileId: ragId, items,
        createdAt: ts(), updatedAt: ts(), _syncMeta: { synced: false },
      };
      upd(d => ({ ...d, sessions: [...d.sessions, s], subjectHistory: [topic, ...d.subjectHistory.filter(h => h !== topic)].slice(0,10) }));
      setSesh(s); setIdx(0); setFlipped(false); setPicked(null); setAnswered(false);
      setResp(''); setFbk(null); setNotes(''); setTsecs(tlimit*60); setTon(false);
      setView('session');
    } catch { setErr('Generation failed — please try again.'); }
    finally { setBusy(false); }
  };

  const weakSpots = () => {
    if (!sesh) return;
    const hard = sesh.items.filter(i => i.userRating === 'hard');
    if (!hard.length) return;
    const ws: Session = { ...sesh, id: uid(), items: hard.map(i => ({ ...i, id: uid(), userRating: undefined, userAnswer: undefined, isCorrect: undefined })), status: 'in_progress', score: undefined, completedAt: undefined, notes: '', createdAt: ts(), updatedAt: ts() };
    upd(d => ({ ...d, sessions: [...d.sessions, ws] }));
    setSesh(ws); setIdx(0); setFlipped(false); setPicked(null); setAnswered(false);
    setResp(''); setFbk(null); setNotes(''); setView('session');
  };

  const saveNotes = () => {
    if (!sesh) return;
    syncSesh({ ...sesh, notes, updatedAt: ts() });
  };

  // ─── Views ────────────────────────────────────────────────

  const Home = () => (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px' }}>
      <Box dark={dark} style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Subject / Topic</div>
        <input value={topic} onChange={e => setTopic(e.target.value)}
          placeholder="e.g. Salesforce Admin — Security & Access"
          style={{ width: '100%', background: 'transparent', border: `1px solid ${bdr}`, borderRadius: '8px 2px 8px 2px', padding: '10px 14px', color: fg, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
          onFocus={e => e.currentTarget.style.borderColor = C.accent}
          onBlur={e => e.currentTarget.style.borderColor = bdr}
        />
        {data.subjectHistory.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.subjectHistory.map(h => (
              <button key={h} onClick={() => setTopic(h)}
                style={{ transform: 'skewX(-5deg)', background: 'transparent', border: `1px solid ${bdr}`, color: muted, padding: '3px 10px', borderRadius: '2px 5px 2px 5px', cursor: 'pointer', fontSize: 11 }}>
                <span style={{ display: 'block', transform: 'skewX(5deg)' }}>{h}</span>
              </button>
            ))}
          </div>
        )}
      </Box>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <Box dark={dark}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Deck</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={deckId} onChange={e => setDeckId(e.target.value)}
              style={{ flex: 1, background: cardBg, border: `1px solid ${bdr}`, color: fg, borderRadius: '6px 2px 6px 2px', padding: '7px 10px', fontSize: 13, outline: 'none' }}>
              <option value="">Auto-create</option>
              {data.decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <Btn sm variant="outline" onClick={() => setShowND(v => !v)}>+</Btn>
          </div>
          {showND && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input value={ndName} onChange={e => setNdName(e.target.value)} placeholder="Deck name"
                style={{ flex: 1, background: 'transparent', border: `1px solid ${bdr}`, borderRadius: '4px', padding: '6px 10px', color: fg, fontSize: 12, outline: 'none' }}
                onKeyDown={e => { if (e.key === 'Enter' && ndName.trim()) { setDeckId(mkDeck(ndName.trim())); setNdName(''); setShowND(false); } }}
              />
              <Btn sm onClick={() => { if (ndName.trim()) { setDeckId(mkDeck(ndName.trim())); setNdName(''); setShowND(false); } }}>Create</Btn>
            </div>
          )}
        </Box>

        <Box dark={dark}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Reference File</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={ragId||''} onChange={e => setRagId(e.target.value||undefined)}
              style={{ flex: 1, background: cardBg, border: `1px solid ${bdr}`, color: fg, borderRadius: '6px 2px 6px 2px', padding: '7px 10px', fontSize: 13, outline: 'none' }}>
              <option value="">None</option>
              {data.ragFiles.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <Btn sm variant="outline" onClick={() => fileRef.current?.click()}>Upload</Btn>
            <input ref={fileRef} type="file" accept=".txt,.md,text/plain,text/markdown" style={{ display: 'none' }} onChange={uploadFile} />
          </div>
          {ragId && data.ragFiles.find(f => f.id === ragId) && (
            <div style={{ marginTop: 6, fontSize: 11, color: C.accent, display: 'flex', alignItems: 'center', gap: 4 }}>
              <FileText size={11} />{data.ragFiles.find(f => f.id === ragId)?.name}
              <button onClick={() => rmFile(ragId)} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', padding: '0 2px', marginLeft: 'auto' }}><X size={11} /></button>
            </div>
          )}
        </Box>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {(Object.keys(MODE_CONFIG) as Mode[]).map(m => {
          const cfg = MODE_CONFIG[m]; const can = !!topic.trim();
          return (
            <Box key={m} dark={dark} accent={can ? cfg.accent : undefined}
              style={{ cursor: can ? 'pointer' : 'not-allowed', opacity: can ? 1 : 0.45, transition: 'opacity 0.15s' }}
              onClick={() => can && (setMode(m), setView('setup'), setErr(null))}>
              <div style={{ color: cfg.accent, marginBottom: 8 }}>{cfg.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{cfg.label}</div>
              <div style={{ fontSize: 12, color: muted }}>{cfg.description}</div>
            </Box>
          );
        })}
      </div>
      {!topic.trim() && <div style={{ textAlign: 'center', fontSize: 12, color: muted, marginTop: 12 }}>Enter a topic above to unlock study modes</div>}
    </div>
  );

  const Setup = () => {
    if (!mode) return null;
    const cfg = MODE_CONFIG[mode];
    return (
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '0 16px' }}>
        <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, marginBottom: 20 }}>
          <ChevronLeft size={14} /> Back
        </button>
        <Box dark={dark} accent={cfg.accent} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: cfg.accent, marginBottom: 3 }}>{cfg.icon}<span style={{ fontWeight: 700, fontSize: 16 }}>{cfg.label}</span></div>
          <div style={{ fontSize: 13, color: muted }}>{topic}</div>
        </Box>

        <Box dark={dark} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Difficulty</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['beginner','intermediate','advanced'] as Difficulty[]).map(d => (
              <button key={d} onClick={() => setDiff(d)}
                style={{ flex: 1, transform: 'skewX(-6deg)', border: `1.5px solid ${diff===d ? cfg.accent : bdr}`, background: diff===d ? `${cfg.accent}18` : 'transparent', color: diff===d ? cfg.accent : muted, padding: '7px 0', borderRadius: '2px 6px 2px 6px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                <span style={{ display: 'block', transform: 'skewX(6deg)', textTransform: 'capitalize' }}>{d}</span>
              </button>
            ))}
          </div>
        </Box>

        {(mode === 'flashcards' || mode === 'quiz') && (
          <Box dark={dark} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Session Length</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[5,10,15,20].map(n => (
                <button key={n} onClick={() => setLen(n)}
                  style={{ flex: 1, transform: 'skewX(-6deg)', border: `1.5px solid ${len===n ? cfg.accent : bdr}`, background: len===n ? `${cfg.accent}18` : 'transparent', color: len===n ? cfg.accent : muted, padding: '7px 0', borderRadius: '2px 6px 2px 6px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                  <span style={{ display: 'block', transform: 'skewX(6deg)' }}>{n}</span>
                </button>
              ))}
            </div>
          </Box>
        )}

        {mode === 'brain_dump' && (
          <Box dark={dark} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Time Limit (minutes)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[2,5,10,15].map(n => (
                <button key={n} onClick={() => setTlimit(n)}
                  style={{ flex: 1, transform: 'skewX(-6deg)', border: `1.5px solid ${tlimit===n ? cfg.accent : bdr}`, background: tlimit===n ? `${cfg.accent}18` : 'transparent', color: tlimit===n ? cfg.accent : muted, padding: '7px 0', borderRadius: '2px 6px 2px 6px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                  <span style={{ display: 'block', transform: 'skewX(6deg)' }}>{n}</span>
                </button>
              ))}
            </div>
          </Box>
        )}

        {mode === 'feynman' && (
          <Box dark={dark} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Explain it to…</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PERSONAS.map(p => (
                <button key={p.id} onClick={() => setPersona(p.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', transform: 'skewX(-3deg)', border: `1.5px solid ${persona===p.id ? cfg.accent : bdr}`, background: persona===p.id ? `${cfg.accent}15` : 'transparent', color: persona===p.id ? cfg.accent : fg, padding: '8px 14px', borderRadius: '2px 8px 2px 8px', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ display: 'block', transform: 'skewX(3deg)' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: muted, marginLeft: 8 }}>{p.description}</span>
                  </span>
                  {persona === p.id && <CheckCircle size={13} style={{ transform: 'skewX(3deg)', flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          </Box>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <Btn accent={cfg.accent} onClick={generate} disabled={busy}>{busy ? 'Generating…' : `Start ${cfg.label}`}</Btn>
        </div>
        {err && <div style={{ marginTop: 10, textAlign: 'center', fontSize: 13, color: C.highlight }}>{err}</div>}
      </div>
    );
  };

  const FlashSession = () => {
    if (!sesh) return null;
    const item = sesh.items[idx]; const total = sesh.items.length;
    return (
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}><ChevronLeft size={14} /> Exit</button>
          <span style={{ fontSize: 13, color: muted }}>{idx+1} / {total}</span>
        </div>
        <Bar cur={idx+1} total={total} accent={sa} />
        <div onClick={() => setFlipped(f => !f)}
          style={{ marginTop: 20, marginBottom: 16, background: cardBg, border: `1.5px solid ${flipped ? sa : bdr}`, borderRadius: '16px 3px 16px 3px', padding: '44px 28px', minHeight: 180, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', transition: 'border-color 0.2s' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: flipped ? sa : muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{flipped ? 'Answer' : 'Question'}</div>
          <div style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.6 }}>{flipped ? item.back : item.front}</div>
          {!flipped && <div style={{ marginTop: 14, fontSize: 11, color: muted }}>tap to flip</div>}
        </div>
        {flipped ? (
          <><div style={{ textAlign: 'center', fontSize: 12, color: muted, marginBottom: 2 }}>How well did you know this?</div><Ratings onRate={rateNext} /></>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}><Btn accent={sa} onClick={() => setFlipped(true)}>Reveal Answer</Btn></div>
        )}
      </div>
    );
  };

  const QuizSession = () => {
    if (!sesh) return null;
    const item = sesh.items[idx]; const total = sesh.items.length;
    const correct = sesh.items.filter(i => i.isCorrect).length;
    return (
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}><ChevronLeft size={14} /> Exit</button>
          <div style={{ display: 'flex', gap: 14, fontSize: 13 }}>
            <span style={{ color: muted }}>{idx+1}/{total}</span>
            <span style={{ color: sa, fontWeight: 700 }}>{correct} correct</span>
          </div>
        </div>
        <Bar cur={idx+1} total={total} accent={sa} />
        <Box dark={dark} accent={answered ? (sesh.items[idx].isCorrect ? C.green : C.highlight) : undefined} style={{ marginTop: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.55 }}>{item.question}</div>
        </Box>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {(item.options||[]).map((opt, i) => {
            let bg2 = 'transparent'; let bc = bdr;
            if (answered) { if (i === item.correctIndex) { bg2 = '#4CAF5018'; bc = C.green; } else if (i === picked) { bg2 = '#F4433618'; bc = C.red; } }
            return (
              <button key={i} onClick={() => pickOpt(i)} disabled={answered}
                style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', transform: 'skewX(-3deg)', background: bg2, border: `1.5px solid ${bc}`, color: fg, padding: '11px 16px', borderRadius: '3px 10px 3px 10px', cursor: answered ? 'default' : 'pointer', fontSize: 14, transition: 'background 0.15s' }}>
                <span style={{ transform: 'skewX(3deg)', display: 'block', width: '100%' }}>
                  <span style={{ fontWeight: 700, marginRight: 8, color: answered && i === item.correctIndex ? C.green : (answered && i === picked && !item.isCorrect ? C.red : muted) }}>{['A','B','C','D'][i]}.</span>
                  {opt}
                </span>
              </button>
            );
          })}
        </div>
        {answered && (
          <>
            <Box dark={dark} accent={sesh.items[idx].isCorrect ? C.green : C.highlight} style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, marginBottom: 4, color: sesh.items[idx].isCorrect ? C.green : C.highlight }}>{sesh.items[idx].isCorrect ? '✓ Correct!' : '✗ Incorrect'}</div>
              {item.explanation}
            </Box>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: muted, marginBottom: 2 }}>How well did you know this?</div><Ratings onRate={rateNext} /></div>
          </>
        )}
      </div>
    );
  };

  const BrainSession = () => {
    if (!sesh) return null;
    const timerC = tsecs < 30 ? C.highlight : sa;
    return (
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '0 16px' }}>
        <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, marginBottom: 16 }}><ChevronLeft size={14} /> Exit</button>
        <Box dark={dark} style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div style={{ fontWeight: 700, fontSize: 15 }}>{sesh.topic}</div><div style={{ fontSize: 12, color: muted, marginTop: 2 }}>Write everything you know</div></div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: timerC, fontVariantNumeric: 'tabular-nums' }}>{tsecs > 0 ? fmt(tsecs) : `${tlimit}:00`}</div>
            <button onClick={() => { if (!ton) setTsecs(tsecs > 0 ? tsecs : tlimit*60); setTon(v => !v); }} style={{ background: 'none', border: 'none', color: sa, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
              {ton ? 'Pause' : tsecs > 0 ? 'Resume' : 'Start Timer'}
            </button>
          </div>
        </Box>
        {ton && <Bar cur={tsecs} total={tlimit*60} accent={timerC} />}
        {!fbk ? (
          <>
            <textarea value={resp} onChange={e => setResp(e.target.value)}
              placeholder={`Write everything you know about "${sesh.topic}"…`}
              style={{ width: '100%', minHeight: 220, background: cardBg, border: `1px solid ${bdr}`, borderRadius: '12px 3px 12px 3px', padding: '16px', color: fg, fontSize: 14, lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginTop: 12 }}
              onFocus={e => e.currentTarget.style.borderColor = sa}
              onBlur={e => e.currentTarget.style.borderColor = bdr}
            />
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <Btn accent={sa} onClick={submitBrain} disabled={busy || !resp.trim()}>{busy ? 'Evaluating…' : 'Get Feedback'}</Btn>
            </div>
          </>
        ) : (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 16 }}>
              <Pill label="Score" value={fbk.score} accent={sa} />
              <Pill label="Strengths" value={fbk.strengths?.length??0} accent={C.green} />
              <Pill label="Gaps" value={fbk.missing?.length??0} accent={C.red} />
            </div>
            <Box dark={dark} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Strengths</div>
              {(fbk.strengths||[]).map((s: string, i: number) => <div key={i} style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 10 }}>• {s}</div>)}
            </Box>
            <Box dark={dark} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.red, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Missing / Gaps</div>
              {(fbk.missing||[]).map((s: string, i: number) => <div key={i} style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 10 }}>• {s}</div>)}
            </Box>
            <Box dark={dark} style={{ marginBottom: 10 }}><div style={{ fontSize: 13, lineHeight: 1.7 }}>{fbk.feedback}</div></Box>
            {(fbk.studyTips?.length??0) > 0 && (
              <Box dark={dark} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: sa, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Study Tips</div>
                {fbk.studyTips.map((t: string, i: number) => <div key={i} style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 10 }}>→ {t}</div>)}
              </Box>
            )}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <div style={{ fontSize: 12, color: muted, marginBottom: 4 }}>How well did you know this overall?</div>
              <Ratings onRate={r => { patch(sesh.items[0].id, { userRating: r }); finish(); }} />
            </div>
          </div>
        )}
        {err && <div style={{ marginTop: 10, textAlign: 'center', fontSize: 13, color: C.highlight }}>{err}</div>}
      </div>
    );
  };

  const FeynSession = () => {
    if (!sesh) return null;
    const p = PERSONAS.find(x => x.id === persona) || PERSONAS[2];
    return (
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '0 16px' }}>
        <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, marginBottom: 16 }}><ChevronLeft size={14} /> Exit</button>
        <Box dark={dark} style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{sesh.topic}</div>
          <div style={{ fontSize: 13, color: sa }}>Explain to: <strong>{p.name}</strong></div>
          <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{p.description}</div>
        </Box>
        {!fbk ? (
          <>
            <textarea value={resp} onChange={e => setResp(e.target.value)}
              placeholder={`Explain "${sesh.topic}" to a ${p.name} in your own words…`}
              style={{ width: '100%', minHeight: 220, background: cardBg, border: `1px solid ${bdr}`, borderRadius: '12px 3px 12px 3px', padding: '16px', color: fg, fontSize: 14, lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.currentTarget.style.borderColor = sa}
              onBlur={e => e.currentTarget.style.borderColor = bdr}
            />
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <Btn accent={sa} onClick={submitFeynman} disabled={busy || !resp.trim()}>{busy ? 'Evaluating…' : 'Get Feedback'}</Btn>
            </div>
          </>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 16 }}>
              <Pill label="Clarity" value={fbk.clarityScore} accent={sa} />
              <Pill label="Accuracy" value={fbk.accuracyScore} accent={sa} />
              <Pill label="Complete" value={fbk.completenessScore} accent={sa} />
              <Pill label="Overall" value={fbk.overallScore} accent={C.accent} />
            </div>
            <Box dark={dark} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: sa, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Audience Fit</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>{fbk.audienceFit}</div>
            </Box>
            <Box dark={dark} style={{ marginBottom: 10 }}><div style={{ fontSize: 13, lineHeight: 1.7 }}>{fbk.feedback}</div></Box>
            {(fbk.suggestions?.length??0) > 0 && (
              <Box dark={dark} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: sa, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Suggestions</div>
                {fbk.suggestions.map((s: string, i: number) => <div key={i} style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 10 }}>→ {s}</div>)}
              </Box>
            )}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <div style={{ fontSize: 12, color: muted, marginBottom: 4 }}>How well did you know this overall?</div>
              <Ratings onRate={r => { patch(sesh.items[0].id, { userRating: r }); finish(); }} />
            </div>
          </div>
        )}
        {err && <div style={{ marginTop: 10, textAlign: 'center', fontSize: 13, color: C.highlight }}>{err}</div>}
      </div>
    );
  };

  const Complete = () => {
    if (!sesh) return null;
    const items = sesh.items;
    const easy = items.filter(i => i.userRating === 'easy').length;
    const med  = items.filter(i => i.userRating === 'medium').length;
    const hard = items.filter(i => i.userRating === 'hard').length;
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px' }}>
        <Box dark={dark} accent={sa} style={{ textAlign: 'center', marginBottom: 16 }}>
          <Award size={34} style={{ color: sa, margin: '0 auto 10px' }} />
          <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 4 }}>Session Complete</div>
          <div style={{ fontSize: 13, color: muted }}>{sesh.topic}</div>
          {sesh.mode === 'quiz' && sesh.score !== undefined && (
            <div style={{ marginTop: 12, fontSize: 30, fontWeight: 800, color: sa }}>
              {sesh.score}/{sesh.maxScore}
              <span style={{ fontSize: 14, fontWeight: 500, color: muted, marginLeft: 6 }}>({Math.round((sesh.score/(sesh.maxScore||1))*100)}%)</span>
            </div>
          )}
          {(sesh.mode === 'brain_dump' || sesh.mode === 'feynman') && sesh.score !== undefined && (
            <div style={{ marginTop: 12, fontSize: 30, fontWeight: 800, color: sa }}>{sesh.score}<span style={{ fontSize: 14, color: muted }}>/100</span></div>
          )}
        </Box>
        {(easy+med+hard) > 0 && (
          <Box dark={dark} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Self-Assessment</div>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <Pill label="Easy" value={easy} accent={C.green} />
              <Pill label="Medium" value={med} accent={C.amber} />
              <Pill label="Hard" value={hard} accent={C.red} />
            </div>
          </Box>
        )}
        <Box dark={dark} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Session Notes</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes}
            placeholder="What did you learn? Anything to revisit?"
            style={{ width: '100%', background: 'transparent', border: `1px solid ${bdr}`, borderRadius: '8px 2px 8px 2px', padding: '10px 12px', color: fg, fontSize: 13, lineHeight: 1.6, resize: 'none', outline: 'none', minHeight: 70, boxSizing: 'border-box' }}
          />
        </Box>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          {hard > 0 && <Btn accent={C.red} variant="outline" onClick={weakSpots}><Target size={12} style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />Review {hard} Hard Items</Btn>}
          <Btn accent={sa} onClick={() => { setView('home'); setMode(null); }}>New Session</Btn>
        </div>
      </div>
    );
  };

  const Library = () => {
    const deck = libDeck ? data.decks.find(d => d.id === libDeck) : null;
    if (deck) {
      const dSesh = data.sessions.filter(s => s.deckId === libDeck && (libFilt === 'all' || s.status === libFilt));
      return (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px' }}>
          <button onClick={() => setLibDeck(null)} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, marginBottom: 16 }}><ChevronLeft size={14} /> All Decks</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{deck.name}</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {(['all','not_started','in_progress','completed'] as const).map(f => (
                <button key={f} onClick={() => setLibFilt(f)}
                  style={{ transform: 'skewX(-5deg)', border: `1px solid ${libFilt===f ? C.accent : bdr}`, background: libFilt===f ? `${C.accent}18` : 'transparent', color: libFilt===f ? C.accent : muted, padding: '4px 10px', borderRadius: '2px 5px 2px 5px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  <span style={{ display: 'block', transform: 'skewX(5deg)' }}>{f==='all'?'All':f==='not_started'?'Not Started':f==='in_progress'?'In Progress':'Done'}</span>
                </button>
              ))}
            </div>
          </div>
          {dSesh.length === 0
            ? <div style={{ textAlign: 'center', color: muted, padding: '40px 0', fontSize: 14 }}>No sessions here yet</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dSesh.map(s => {
                  const mc = MODE_CONFIG[s.mode];
                  const si = s.status === 'completed' ? <CheckCircle size={12} color={C.green} /> : s.status === 'in_progress' ? <Clock size={12} color={C.amber} /> : <Circle size={12} color={String(muted)} />;
                  const hardCount = s.items.filter(i => i.userRating === 'hard').length;
                  return (
                    <Box key={s.id} dark={dark} accent={mc.accent}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>{si}<span style={{ fontWeight: 600, fontSize: 14 }}>{s.topic}</span></div>
                          <div style={{ display: 'flex', gap: 8, fontSize: 11, color: muted, flexWrap: 'wrap' }}>
                            <span style={{ color: mc.accent, fontWeight: 700 }}>{mc.label}</span>
                            <span>· {s.difficulty}</span>
                            {s.score !== undefined && <span>· {s.mode === 'quiz' ? `${s.score}/${s.maxScore}` : `${s.score}/100`}</span>}
                            <span>· {fmtDate(s.createdAt)}</span>
                            {hardCount > 0 && <span style={{ color: C.red }}>· {hardCount} hard</span>}
                          </div>
                          {s.notes && <div style={{ marginTop: 8, fontSize: 12, color: muted, borderLeft: `2px solid ${mc.accent}40`, paddingLeft: 8 }}>{s.notes}</div>}
                        </div>
                        <button onClick={() => upd(d => ({ ...d, sessions: d.sessions.filter(x => x.id !== s.id) }))}
                          style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', padding: 4, marginLeft: 8 }}><X size={13} /></button>
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
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Your Decks</div>
          {showLND ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={lndName} onChange={e => setLndName(e.target.value)} placeholder="Deck name" autoFocus
                style={{ background: 'transparent', border: `1px solid ${bdr}`, borderRadius: '4px', padding: '6px 10px', color: fg, fontSize: 13, outline: 'none' }}
                onKeyDown={e => { if (e.key === 'Enter' && lndName.trim()) { mkDeck(lndName.trim()); setLndName(''); setShowLND(false); } }}
              />
              <Btn sm onClick={() => { if (lndName.trim()) { mkDeck(lndName.trim()); setLndName(''); setShowLND(false); } }}>Create</Btn>
              <Btn sm variant="ghost" onClick={() => setShowLND(false)}>Cancel</Btn>
            </div>
          ) : <Btn sm onClick={() => setShowLND(true)}>+ New Deck</Btn>}
        </div>
        {data.decks.length === 0
          ? <div style={{ textAlign: 'center', color: muted, padding: '60px 0', fontSize: 14 }}>No decks yet — start a study session to create one automatically</div>
          : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {data.decks.map(d => {
                const ds = data.sessions.filter(s => s.deckId === d.id);
                const done = ds.filter(s => s.status === 'completed').length;
                return (
                  <Box key={d.id} dark={dark} onClick={() => setLibDeck(d.id)} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{d.name}</div>
                      <button onClick={e => { e.stopPropagation(); rmDeck(d.id); }} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', padding: 2 }}><Trash2 size={12} /></button>
                    </div>
                    <div style={{ fontSize: 12, color: muted, marginBottom: ds.length > 0 ? 10 : 0 }}>{ds.length} sessions · {done} completed</div>
                    {ds.length > 0 && <Bar cur={done} total={ds.length} accent={C.accent} />}
                  </Box>
                );
              })}
            </div>
        }
      </div>
    );
  };

  const Stats = () => {
    const total = data.sessions.length;
    const done  = data.sessions.filter(s => s.status === 'completed').length;
    const qSesh = data.sessions.filter(s => s.mode === 'quiz' && s.score !== undefined && s.maxScore);
    const avgQ  = qSesh.length > 0 ? Math.round(qSesh.reduce((acc, s) => acc + (s.score!/s.maxScore!)*100, 0) / qSesh.length) : null;
    const allHard = data.sessions.flatMap(s => s.items.filter(i => i.userRating === 'hard' && (i.front || i.question)));
    const modeB = (Object.keys(MODE_CONFIG) as Mode[]).map(m => ({ m, n: data.sessions.filter(s => s.mode === m).length }));
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
          {[{ l: 'Total', v: total, a: C.accent }, { l: 'Completed', v: done, a: C.green }, { l: 'Avg Quiz', v: avgQ !== null ? `${avgQ}%` : '—', a: C.amber }].map(({ l, v, a }) => (
            <Box key={l} dark={dark} accent={a} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: a }}>{v}</div>
              <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>{l}</div>
            </Box>
          ))}
        </div>
        <Box dark={dark} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>By Mode</div>
          {modeB.map(({ m, n }) => (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ color: MODE_CONFIG[m].accent, width: 16 }}>{MODE_CONFIG[m].icon}</div>
              <div style={{ width: 88, fontSize: 13 }}>{MODE_CONFIG[m].label}</div>
              <div style={{ flex: 1, height: 5, background: 'rgba(128,128,128,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: total > 0 ? `${(n/total)*100}%` : '0%', height: '100%', background: MODE_CONFIG[m].accent, borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: MODE_CONFIG[m].accent, width: 20, textAlign: 'right' }}>{n}</div>
            </div>
          ))}
        </Box>
        {allHard.length > 0 && (
          <Box dark={dark} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.red, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Weak Spots — {allHard.length} hard-rated items</div>
            {allHard.slice(0, 8).map((item, i) => (
              <div key={i} style={{ fontSize: 12, padding: '6px 10px', marginBottom: 5, background: `${C.red}10`, borderRadius: '3px 1px 3px 1px', borderLeft: `2px solid ${C.red}`, lineHeight: 1.5 }}>
                {item.front || item.question}
              </div>
            ))}
            {allHard.length > 8 && <div style={{ fontSize: 12, color: muted, textAlign: 'center', marginTop: 6 }}>and {allHard.length - 8} more</div>}
          </Box>
        )}
        {data.subjectHistory.length > 0 && (
          <Box dark={dark}>
            <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Subject History</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {data.subjectHistory.map(h => (
                <button key={h} onClick={() => { setTopic(h); setTab('study'); setView('home'); }}
                  style={{ transform: 'skewX(-5deg)', background: `${C.accent}12`, border: `1px solid ${C.accent}40`, color: C.accent, padding: '5px 12px', borderRadius: '2px 6px 2px 6px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  <span style={{ display: 'block', transform: 'skewX(5deg)' }}>{h}</span>
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
      case 'home':     return <Home />;
      case 'setup':    return <Setup />;
      case 'session':  return sessionRouter();
      case 'complete': return <Complete />;
    }
  };

  return (
    <div style={{ background: bg, color: fg, minHeight: '100vh', fontFamily: 'system-ui,-apple-system,sans-serif', ...diag(ma) }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${bdr}`, padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 52 }}>
        <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', cursor: 'pointer' }} onClick={() => { setTab('study'); setView('home'); }}>
          <span style={{ color: C.accent }}>Re</span>freisher
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => { setKeyInput(''); setShowKey(true); }} title={apiKey ? 'Change API key' : 'Set API key'}
            style={{ background: 'none', border: `1px solid ${apiKey ? bdr : C.highlight}`, color: apiKey ? muted : C.highlight, padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>
            <Key size={13} />
          </button>
          <button onClick={exportAll} title="Export" style={{ background: 'none', border: `1px solid ${bdr}`, color: muted, padding: '5px 10px', borderRadius: '4px 1px 4px 1px', cursor: 'pointer' }}><Download size={13} /></button>
          <button onClick={() => importRef.current?.click()} title="Import" style={{ background: 'none', border: `1px solid ${bdr}`, color: muted, padding: '5px 10px', borderRadius: '1px 4px 1px 4px', cursor: 'pointer' }}><Upload size={13} /></button>
          <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importAll} />
          <button onClick={() => setDark(v => !v)} style={{ background: 'none', border: `1px solid ${bdr}`, color: C.accent, padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>
            {dark ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${bdr}`, display: 'flex', padding: '0 20px' }}>
        {([
          { id: 'study'   as Tab, label: 'Study',   icon: <BookOpen size={13} /> },
          { id: 'library' as Tab, label: 'Library', icon: <BookMarked size={13} /> },
          { id: 'stats'   as Tab, label: 'Stats',   icon: <BarChart2 size={13} /> },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '11px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? C.accent : 'transparent'}`, color: tab === t.id ? C.accent : muted, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: -1, transition: 'color 0.15s' }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {err && (
        <div style={{ background: `${C.highlight}15`, borderBottom: `1px solid ${C.highlight}35`, padding: '9px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span style={{ color: C.highlight }}>{err}</span>
          <button onClick={() => setErr(null)} style={{ background: 'none', border: 'none', color: C.highlight, cursor: 'pointer' }}><X size={13} /></button>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '26px 20px' }}>
        {tab === 'study'   && studyRouter()}
        {tab === 'library' && <Library />}
        {tab === 'stats'   && <Stats />}
      </div>

      {/* API key modal */}
      {(showKey || !apiKey) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '0 20px' }}>
          <Box dark={dark} style={{ maxWidth: 420, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{apiKey ? 'Update API Key' : 'Anthropic API Key required'}</div>
              {apiKey && <button onClick={() => setShowKey(false)} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer' }}><X size={16} /></button>}
            </div>
            <div style={{ fontSize: 13, color: muted, marginBottom: 16, lineHeight: 1.6 }}>
              Your key is stored only in your browser's localStorage and sent directly to Anthropic — never to any other server.
            </div>
            <input
              type="password"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="sk-ant-api03-…"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && saveKey()}
              style={{ width: '100%', background: 'transparent', border: `1px solid ${bdr}`, borderRadius: '8px 2px 8px 2px', padding: '10px 14px', color: fg, fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 14 }}
              onFocus={e => e.currentTarget.style.borderColor = C.accent}
              onBlur={e => e.currentTarget.style.borderColor = bdr}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.accent, textDecoration: 'none' }}>
                Get a key →
              </a>
              <Btn onClick={saveKey} disabled={!keyInput.trim()}>Save Key</Btn>
            </div>
          </Box>
        </div>
      )}
    </div>
  );
}
