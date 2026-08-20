/**
 * C.LO CAFE — Main App Controller
 * Audio generator, keyboard controls, and UI state handlers.
 */

// Ambient Audio Synthesizer
const AmbientAudio = (function () {
  let audioCtx;
  let isPlaying = false;
  let noiseNode, filterNode, gainNode;

  function toggle() {
    if (!audioCtx) initAudio();
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }

  function initAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();

    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.03;
      b6 = white * 0.115926;
    }

    noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = noiseBuffer;
    noiseNode.loop = true;

    filterNode = audioCtx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(450, audioCtx.currentTime);

    gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);

    noiseNode.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    noiseNode.start();
  }

  function play() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 1.2);
    isPlaying = true;
    updateUI(true);
  }

  function pause() {
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
    isPlaying = false;
    updateUI(false);
  }

  function updateUI(active) {
    const btn = document.getElementById('sound-btn');
    if (btn) {
      if (active) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }

  return { toggle };
})();

// App Initialization
window.addEventListener('DOMContentLoaded', () => {
  if (window.MorphEngine) {
    MorphEngine.init();
  }

  // Keyboard navigation for chapters
  window.addEventListener('keydown', (e) => {
    const container = document.getElementById('sequence-scroll-container');
    if (!container) return;

    const inSequence = window.scrollY < (container.offsetHeight - window.innerHeight);

    if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
      const idx = parseInt(e.key, 10) - 1;
      MorphEngine.scrollToChapter(idx);
    } else if (inSequence && (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown')) {
      const current = MorphEngine.getCurrentChapter();
      if (current < 5) {
        e.preventDefault();
        MorphEngine.scrollToChapter(current + 1);
      }
    } else if (inSequence && (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp')) {
      const current = MorphEngine.getCurrentChapter();
      if (current > 0) {
        e.preventDefault();
        MorphEngine.scrollToChapter(current - 1);
      }
    }
  });

  console.log('☕ C.Lo Cafe Ready.');
});
