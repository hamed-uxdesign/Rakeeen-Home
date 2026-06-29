import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ChevronRight, ChevronLeft, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Ayah {
  number: number;
  numberInSurah: number;
  text: string;
  surah: { number: number; name: string; englishName: string };
  page: number;
  juz: number;
}

type Reciter = 'ar.alafasy' | 'ar.minshawi';

const RECITERS: { value: Reciter; label: string }[] = [
  { value: 'ar.alafasy',  label: 'Al-Afasy' },
  { value: 'ar.minshawi', label: 'Al-Minshawi' },
];

const TOTAL_PAGES = 604;
const STORAGE_KEY = 'quran_last_page';
const TRIGGER_ZONE = 80; // px from edge to trigger header/footer

function audioUrl(reciter: Reciter, n: number) {
  return `https://cdn.islamic.network/quran/audio/128/${reciter}/${n}.mp3`;
}

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);
}

interface Props { navigate: (to: string) => void; }

export const QuranReader: React.FC<Props> = ({ navigate }) => {
  const [page, setPage] = useState<number>(() => {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? Math.min(TOTAL_PAGES, Math.max(1, Number(s))) : 1;
  });
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reciter, setReciter] = useState<Reciter>('ar.alafasy');
  const [reciterOpen, setReciterOpen] = useState(false);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [goInput, setGoInput] = useState('');
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('dark-theme'));
  const [showHeader, setShowHeader] = useState(false);
  const [showFooter, setShowFooter] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleTheme = () => {
    const next = !isDark;
    document.body.classList.toggle('dark-theme', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setIsDark(next);
  };

  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null; }
    setPlayingIdx(null);
  }, []);

  // Mouse proximity detection for header/footer
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const h = window.innerHeight;
      setShowHeader(e.clientY < TRIGGER_ZONE);
      setShowFooter(e.clientY > h - TRIGGER_ZONE);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Fetch page
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setPlayingIdx(null); stopAudio();
    fetch(`https://api.alquran.cloud/v1/page/${page}/quran-uthmani`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        if (json.code === 200) { setAyahs(json.data.ayahs ?? json.data); localStorage.setItem(STORAGE_KEY, String(page)); }
        else setError('Failed to load page.');
      })
      .catch(() => { if (!cancelled) setError('Network error.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page]);

  const playAyah = useCallback((idx: number, ayahNumber: number) => {
    stopAudio();
    const audio = new Audio(audioUrl(reciter, ayahNumber));
    audio.volume = muted ? 0 : 1;
    audioRef.current = audio;
    setPlayingIdx(idx);
    audio.play().catch(() => {});
    audio.onended = () => {
      setPlayingIdx(prev => {
        if (prev === null) return null;
        const next = prev + 1;
        if (next < ayahs.length) {
          const na = new Audio(audioUrl(reciter, ayahs[next].number));
          na.volume = muted ? 0 : 1;
          audioRef.current = na;
          na.play().catch(() => {});
          na.onended = audio.onended as any;
          return next;
        }
        return null;
      });
    };
  }, [reciter, muted, ayahs, stopAudio]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const goTo = useCallback((p: number) => {
    setPage(Math.min(TOTAL_PAGES, Math.max(1, p)));
  }, []);

  // Keyboard: ← = next (RTL forward), → = prev
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft')  goTo(page + 1);
      if (e.key === 'ArrowRight') goTo(page - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, goTo]);

  // Group ayahs by surah
  const groups: { surahNum: number; surahName: string; surahEn: string; ayahs: (Ayah & { localIdx: number })[] }[] = [];
  ayahs.forEach((a, i) => {
    const last = groups[groups.length - 1];
    if (!last || last.surahNum !== a.surah.number)
      groups.push({ surahNum: a.surah.number, surahName: a.surah.name, surahEn: a.surah.englishName, ayahs: [] });
    groups[groups.length - 1].ayahs.push({ ...a, localIdx: i });
  });

  const juz = ayahs[0]?.juz ?? null;
  const isPlaying = playingIdx !== null;
  const currentLabel = RECITERS.find(r => r.value === reciter)?.label ?? '';

  const barStyle: React.CSSProperties = {
    background: 'var(--paper)',
    borderColor: 'color-mix(in srgb, var(--ink) 10%, transparent)',
  };

  return (
    <div
      className="h-screen overflow-hidden flex flex-col text-ink font-sans-main transition-colors duration-300 relative"
      style={{ background: 'var(--paper)' }}
    >

      {/* ── Header — shows on mouse near top ── */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-5 py-3 border-b transition-all duration-300"
        style={{ ...barStyle, opacity: showHeader ? 1 : 0, pointerEvents: showHeader ? 'auto' : 'none', transform: showHeader ? 'translateY(0)' : 'translateY(-8px)' }}
      >
        <button onClick={() => { stopAudio(); navigate('prayer'); }} className="flex items-center gap-2 text-ink/40 hover:text-ink transition-colors group">
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="font-mono-main text-[10px] uppercase tracking-[0.25em] font-bold">Prayer</span>
        </button>

        <span />

        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="text-ink/40 hover:text-ink transition-colors cursor-pointer">
            {isDark
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
          <button onClick={() => setMuted(m => !m)} className="text-ink/40 hover:text-ink transition-colors cursor-pointer">
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          {isPlaying && (
            <button onClick={stopAudio} className="font-mono-main text-[9px] uppercase tracking-widest text-rust border border-rust/40 px-2 py-1 cursor-pointer" style={{ borderRadius: 0 }}>
              STOP
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setReciterOpen(o => !o)}
              className="font-mono-main font-bold text-left flex items-center gap-2 cursor-pointer"
              style={{ padding: '6px 12px', fontSize: 11, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)', minWidth: 110 }}
            >
              <span className="flex-1">{currentLabel}</span>
              <span style={{ fontSize: 8, opacity: 0.4 }}>▼</span>
            </button>
            <AnimatePresence>
              {reciterOpen && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 z-50"
                  style={{ top: '100%', marginTop: 2, minWidth: '100%', background: 'var(--paper-dark)', border: '1px solid color-mix(in srgb, var(--ink) 20%, transparent)' }}
                >
                  {RECITERS.map(r => (
                    <button key={r.value} type="button"
                      onClick={() => { stopAudio(); setReciter(r.value); setReciterOpen(false); }}
                      className="w-full text-left font-mono-main cursor-pointer block"
                      style={{ padding: '10px 14px', fontSize: 11, color: 'var(--ink)', borderBottom: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)', background: reciter === r.value ? 'color-mix(in srgb, var(--ink) 8%, transparent)' : 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--ink) 6%, transparent)')}
                      onMouseLeave={e => (e.currentTarget.style.background = reciter === r.value ? 'color-mix(in srgb, var(--ink) 8%, transparent)' : 'transparent')}
                    >{r.label}</button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Quran content — fills screen, text centered ── */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center px-6">
        <div className="w-full max-w-[720px] py-16">
          {loading && (
            <div className="flex items-center justify-center py-32">
              <div className="w-6 h-6 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
            </div>
          )}
          {error && <div className="text-center py-32 text-rust font-mono-main text-sm">{error}</div>}
          {!loading && !error && (
            <div dir="rtl">
              <div className="text-center mb-10">
                <span className="font-mono-main text-[10px] text-ink/25 uppercase tracking-[0.3em]">
                  Page {page}{juz ? ` · Juz ${juz}` : ''}
                </span>
              </div>

              {groups.map(group => (
                <div key={group.surahNum} className="mb-8">
                  <div className="flex items-center gap-4 my-10">
                    <div className="flex-1 h-px bg-ink/15" />
                    <div className="text-center">
                      <div className="text-ink text-2xl" style={{ fontFamily: "'Scheherazade New', serif" }}>{group.surahName}</div>
                      <div className="font-mono-main text-[9px] uppercase tracking-[0.25em] text-ink/30 mt-1">{group.surahEn}</div>
                    </div>
                    <div className="flex-1 h-px bg-ink/15" />
                  </div>

                  {group.ayahs[0]?.numberInSurah === 1 && group.surahNum !== 1 && group.surahNum !== 9 && (
                    <p className="text-center text-ink/70 text-2xl mb-6 leading-loose" style={{ fontFamily: "'Scheherazade New', serif" }}>
                      بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                    </p>
                  )}

                  <p className="text-ink leading-[2.6] text-[1.55rem] text-justify" style={{ fontFamily: "'Scheherazade New', serif", textAlignLast: 'center' }}>
                    {group.ayahs.map(a => (
                      <span
                        key={a.number}
                        onClick={() => playingIdx === a.localIdx ? stopAudio() : playAyah(a.localIdx, a.number)}
                        className={`cursor-pointer transition-colors rounded-sm px-0.5 ${playingIdx === a.localIdx ? 'bg-sepia/20' : 'hover:bg-ink/5'}`}
                      >
                        {a.text}{' '}
                        <span className="text-sepia text-[1.1rem] select-none">﴿{toArabicNum(a.numberInSurah)}﴾</span>{' '}
                      </span>
                    ))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer — shows on mouse near bottom ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-3 border-t transition-all duration-300"
        style={{ ...barStyle, opacity: showFooter ? 1 : 0, pointerEvents: showFooter ? 'auto' : 'none', transform: showFooter ? 'translateY(0)' : 'translateY(8px)' }}
      >
        <button onClick={() => goTo(page + 1)} disabled={page >= TOTAL_PAGES} className="btn-brutalist px-3 py-2 flex items-center cursor-pointer disabled:opacity-20">
          <ChevronLeft size={16} />
        </button>

        <form onSubmit={e => { e.preventDefault(); const n = parseInt(goInput); if (n) goTo(n); setGoInput(''); }} className="flex items-center gap-2">
          <input
            type="number" min={1} max={TOTAL_PAGES} value={goInput}
            onChange={e => setGoInput(e.target.value)} placeholder="Go to page"
            className="w-24 border border-ink/30 bg-transparent text-center font-mono-main text-xs py-1.5 outline-none"
            style={{ borderRadius: 0 }}
          />
          <button type="submit" className="btn-brutalist px-3 py-1.5 text-xs font-mono-main cursor-pointer">Go</button>
        </form>

        <button onClick={() => goTo(page - 1)} disabled={page <= 1} className="btn-brutalist px-3 py-2 flex items-center cursor-pointer disabled:opacity-20">
          <ChevronRight size={16} />
        </button>
      </div>

    </div>
  );
};
