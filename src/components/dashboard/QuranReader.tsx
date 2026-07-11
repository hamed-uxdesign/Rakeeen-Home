import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ChevronRight, ChevronLeft, Volume2, VolumeX, Square } from 'lucide-react';
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
const TRIGGER_ZONE = 80;

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

  // Refs to avoid stale closures in audio callbacks
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ayahsRef = useRef<Ayah[]>([]);
  const reciterRef = useRef<Reciter>(reciter);
  const mutedRef = useRef(muted);
  const pageRef = useRef(page);
  const pendingAutoPlay = useRef(false);

  useEffect(() => { ayahsRef.current = ayahs; }, [ayahs]);
  useEffect(() => { reciterRef.current = reciter; }, [reciter]);
  useEffect(() => { mutedRef.current = muted; if (audioRef.current) audioRef.current.volume = muted ? 0 : 1; }, [muted]);
  useEffect(() => { pageRef.current = page; }, [page]);

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

  // Build the audio chain starting at a given index in the provided ayahs array
  const buildChain = useCallback((idx: number, ayahsData: Ayah[]) => {
    const ayah = ayahsData[idx];
    if (!ayah) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
    const audio = new Audio(audioUrl(reciterRef.current, ayah.number));
    audio.volume = mutedRef.current ? 0 : 1;
    audioRef.current = audio;
    setPlayingIdx(idx);
    audio.play().catch(() => {});
    audio.onended = () => {
      const next = idx + 1;
      const currentAyahs = ayahsRef.current;
      if (next < currentAyahs.length) {
        buildChain(next, currentAyahs);
      } else if (pageRef.current < TOTAL_PAGES) {
        // Last ayah on page — flag to auto-play on next page load
        pendingAutoPlay.current = true;
        setPlayingIdx(null);
        setPage(p => Math.min(TOTAL_PAGES, p + 1));
      } else {
        setPlayingIdx(null);
      }
    };
  }, []);

  // On touch devices always show header/footer; on desktop use mouse proximity
  const isTouchDevice = 'ontouchstart' in window;
  useEffect(() => {
    if (isTouchDevice) { setShowHeader(true); setShowFooter(true); return; }
    const onMove = (e: MouseEvent) => {
      setShowHeader(e.clientY < TRIGGER_ZONE);
      setShowFooter(e.clientY > window.innerHeight - TRIGGER_ZONE);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [isTouchDevice]);

  // Fetch page
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    if (!pendingAutoPlay.current) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null; }
      setPlayingIdx(null);
    }
    fetch(`https://api.alquran.cloud/v1/page/${page}/quran-uthmani`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        if (json.code === 200) {
          const newAyahs: Ayah[] = json.data.ayahs ?? json.data;
          ayahsRef.current = newAyahs;
          setAyahs(newAyahs);
          localStorage.setItem(STORAGE_KEY, String(page));
          if (pendingAutoPlay.current && newAyahs.length > 0) {
            pendingAutoPlay.current = false;
            buildChain(0, newAyahs);
          }
        } else {
          setError('Failed to load page.');
        }
      })
      .catch(() => { if (!cancelled) setError('Network error.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, buildChain]);

  const playAyah = useCallback((idx: number) => {
    buildChain(idx, ayahsRef.current);
  }, [buildChain]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const goTo = useCallback((p: number) => {
    setPage(Math.min(TOTAL_PAGES, Math.max(1, p)));
  }, []);

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
  const headerVisible = showHeader || reciterOpen;

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
        style={{ ...barStyle, overflow: 'visible', opacity: headerVisible ? 1 : 0, pointerEvents: headerVisible ? 'auto' : 'none', transform: headerVisible ? 'translateY(0)' : 'translateY(-8px)' }}
      >
        <button onClick={() => { stopAudio(); navigate('devotion'); }} className="flex items-center gap-2 text-ink/40 hover:text-ink transition-colors group">
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="font-mono-main text-[10px] uppercase tracking-[0.25em] font-bold">Devotion</span>
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
          {/* Reciter dropdown — rendered relative to viewport to avoid clipping */}
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
                <>
                  {/* Invisible overlay to close on outside click */}
                  <div className="fixed inset-0 z-[9998]" onClick={() => setReciterOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    style={{ position: 'fixed', top: 52, right: 20, zIndex: 9999, minWidth: 130, background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {RECITERS.map(r => (
                      <button key={r.value} type="button"
                        onClick={() => { stopAudio(); setReciter(r.value); setReciterOpen(false); }}
                        className="w-full text-left font-mono-main cursor-pointer block"
                        style={{ padding: '10px 14px', fontSize: 11, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.07)', background: reciter === r.value ? '#000' : 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.background = reciter === r.value ? '#000' : 'rgba(255,255,255,0.06)')}
                        onMouseLeave={e => (e.currentTarget.style.background = reciter === r.value ? '#000' : 'transparent')}
                      >{r.label}</button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Floating stop button — always visible while playing ── */}
      <AnimatePresence>
        {isPlaying && (
          <div className="fixed z-50 flex justify-center" style={{ bottom: 72, left: 0, right: 0, pointerEvents: 'none' }}>
            <motion.button
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.15 }}
              onClick={stopAudio}
              className="flex items-center gap-2 cursor-pointer font-mono-main font-bold uppercase tracking-widest"
              style={{ fontSize: 11, padding: '12px 24px', background: '#C0392B', color: '#fff', border: 'none', borderRadius: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', pointerEvents: 'auto' }}
            >
              <Square size={12} fill="white" />
              Stop
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {/* ── Quran content ── */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center px-4 md:px-6">
        <div className="w-full max-w-[720px] py-8 md:py-16">
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
                        onClick={() => playingIdx === a.localIdx ? stopAudio() : playAyah(a.localIdx)}
                        className="cursor-pointer transition-all duration-200 rounded-sm px-0.5"
                        style={playingIdx === a.localIdx ? {
                          background: 'color-mix(in srgb, var(--sepia) 30%, transparent)',
                        } : {}}
                        onMouseEnter={e => { if (playingIdx !== a.localIdx) (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--ink) 5%, transparent)'; }}
                        onMouseLeave={e => { if (playingIdx !== a.localIdx) (e.currentTarget as HTMLElement).style.background = ''; }}
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
