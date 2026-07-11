const STREAM_URL = 'https://n12.radiojar.com/8s5u5tpdtwzuv';

let audio: HTMLAudioElement | null = null;
let isPlaying = false;
let volume = Number(localStorage.getItem('quran_radio_volume') || '0.5');
const listeners = new Set<(playing: boolean) => void>();

// Live streams occasionally hiccup (network blip, server reconnect) and fire a
// 'pause'/'ended'/'error'/'stalled' event on their own — not because the user pressed
// stop. Without distinguishing that, the radio would silently go quiet and never
// resume. `manualStop` tracks whether WE intentionally told it to stop; if not, we
// retry instead of reporting the radio as stopped.
let manualStop = true;
let retryCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_RETRIES = 5;

const reconnect = () => {
  if (manualStop || !audio) return;
  if (retryCount >= MAX_RETRIES) {
    // Give up for real — report stopped so the UI reflects reality.
    isPlaying = false;
    notify();
    return;
  }
  retryCount++;
  const delay = Math.min(1000 * retryCount, 5000); // backoff, capped at 5s
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    if (manualStop || !audio) return;
    audio.src = STREAM_URL;
    audio.load();
    audio.play().catch(() => reconnect());
  }, delay);
};

const initAudio = () => {
  if (!audio) {
    audio = new Audio();
    audio.volume = volume;
    audio.addEventListener('play', () => {
      isPlaying = true;
      retryCount = 0; // successful (re)connect resets the backoff
      notify();
    });
    audio.addEventListener('pause', () => {
      if (manualStop) {
        isPlaying = false;
        notify();
      } else {
        reconnect();
      }
    });
    audio.addEventListener('ended', () => {
      // A live stream shouldn't naturally "end" — treat it as a dropped connection.
      if (manualStop) {
        isPlaying = false;
        notify();
      } else {
        reconnect();
      }
    });
    audio.addEventListener('error', () => {
      if (!manualStop) reconnect();
    });
    audio.addEventListener('stalled', () => {
      if (!manualStop) reconnect();
    });
  }
};

const notify = () => {
  listeners.forEach(l => l(isPlaying));
};

export const quranRadioManager = {
  subscribe(listener: (playing: boolean) => void) {
    initAudio();
    listeners.add(listener);
    listener(isPlaying);
    return () => {
      listeners.delete(listener);
    };
  },

  isPlaying() {
    return isPlaying;
  },

  play() {
    initAudio();
    manualStop = false;
    retryCount = 0;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (audio) {
      audio.volume = volume;
      audio.src = STREAM_URL;
      audio.load(); // Forces live stream reload
      audio.play().catch(err => {
        console.error('Quran Radio playback failed:', err);
        reconnect();
      });
    }
  },

  pause() {
    manualStop = true;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (audio) {
      audio.pause();
      audio.src = ''; // Cut off network request immediately
    }
    isPlaying = false;
    notify();
  },

  setVolume(vol: number) {
    volume = vol;
    localStorage.setItem('quran_radio_volume', String(vol));
    if (audio) {
      audio.volume = vol;
    }
  },

  getVolume() {
    return volume;
  }
};
