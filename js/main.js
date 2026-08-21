/**
 * C.LO CAFE — Main Interactive Application Controller
 * Handles Ambient Audio, Special Offers copy-to-clipboard, Menu filtering,
 * Quick Order toasts, and VIP Club signups.
 * Professional, clean design with zero emojis.
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
    AppUtils.showToast('Cafe atmosphere audio playing');
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

// App Utilities & Interactive Handlers
window.AppUtils = (function () {
  
  // Show Toast Notification
  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerHTML = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(15px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 350);
    }, 3200);
  }

  // Copy Promo Code to Clipboard
  function copyCode(code, buttonElement) {
    navigator.clipboard.writeText(code).then(() => {
      const originalHtml = buttonElement.innerHTML;
      buttonElement.innerHTML = '<span>Code Copied</span>';
      buttonElement.style.background = '#2B6E4F';
      buttonElement.style.borderColor = '#2B6E4F';
      buttonElement.style.color = '#FFFFFF';

      showToast(`Promo code <strong>${code}</strong> copied to clipboard`);

      setTimeout(() => {
        buttonElement.innerHTML = originalHtml;
        buttonElement.style.background = '';
        buttonElement.style.borderColor = '';
        buttonElement.style.color = '';
      }, 2400);
    }).catch(() => {
      showToast(`Promo code: <strong>${code}</strong>`);
    });
  }

  // Category Filter for Menu
  function filterMenu(category, tabElement) {
    document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
    if (tabElement) {
      tabElement.classList.add('active');
    } else {
      const defaultTab = document.querySelector(`.filter-tab[onclick*="${category}"]`);
      if (defaultTab) defaultTab.classList.add('active');
    }

    const cards = document.querySelectorAll('#menu-grid .menu-card');
    cards.forEach(card => {
      const cardCategory = card.getAttribute('data-category') || '';
      if (category === 'all' || cardCategory.includes(category)) {
        card.style.display = 'flex';
        setTimeout(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, 30);
      } else {
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px)';
        setTimeout(() => { card.style.display = 'none'; }, 200);
      }
    });
  }

  // Quick Add Item to Order
  function addToOrder(itemName, price) {
    showToast(`Added <strong>${itemName}</strong> (${price}) to order`);
  }

  // VIP Club Newsletter Signup
  function handleVipSignup(e) {
    e.preventDefault();
    const input = document.getElementById('vip-email');
    if (!input || !input.value) return;

    const email = input.value;
    input.value = '';
    showToast(`Welcome! 15% discount code <strong>CLO15</strong> sent to ${email}`);
  }

  return {
    showToast,
    copyCode,
    filterMenu,
    addToOrder,
    handleVipSignup
  };
})();

// App Initialization
window.addEventListener('DOMContentLoaded', () => {
  if (window.MorphEngine) {
    MorphEngine.init();
  }

  // Keyboard navigation for chapters
  window.addEventListener('keydown', (e) => {
    if (!window.MorphEngine) return;
    if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
      const idx = parseInt(e.key, 10) - 1;
      MorphEngine.goToChapter(idx);
    }
  });

  // Top Scroll Progress Line for normal page scroll
  const progLine = document.getElementById('scroll-progress-line');
  function updateScrollProgress() {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (totalHeight > 0 && progLine) {
      const progress = (window.scrollY / totalHeight) * 100;
      progLine.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }
  }
  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  updateScrollProgress();

  // Smooth scrolling for anchor links with header offset
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '') return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        const headerHeight = document.querySelector('.site-header')?.offsetHeight || 75;
        const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - (headerHeight + 10);

        window.scrollTo({
          top: Math.max(0, targetPosition),
          behavior: 'smooth'
        });
      }
    });
  });

  console.log('C.Lo Cafe Ready (Professional Agency Reference Standard).');
});
