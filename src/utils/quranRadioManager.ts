const STREAM_URL = 'https://n12.radiojar.com/8s5u5tpdtwzuv';

let audio: HTMLAudioElement | null = null;
let isPlaying = false;
let volume = Number(localStorage.getItem('quran_radio_volume') || '0.5');
const listeners = new Set<(playing: boolean) => void>();

const initAudio = () => {
  if (!audio) {
    audio = new Audio();
    audio.volume = volume;
    audio.addEventListener('play', () => {
      isPlaying = true;
      notify();
    });
    audio.addEventListener('pause', () => {
      isPlaying = false;
      notify();
    });
    audio.addEventListener('ended', () => {
      isPlaying = false;
      notify();
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
    if (audio) {
      audio.volume = volume;
      audio.src = STREAM_URL;
      audio.load(); // Forces live stream reload
      audio.play().catch(err => {
        console.error('Quran Radio playback failed:', err);
        isPlaying = false;
        notify();
      });
    }
  },

  pause() {
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
