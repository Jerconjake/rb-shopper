(function () {
  'use strict';

  const BASE_URL = (function () {
    const scripts = document.querySelectorAll('script[src]');
    for (let i = scripts.length - 1; i >= 0; i--) {
      const src = scripts[i].getAttribute('src');
      if (src && src.includes('widget.js')) {
        try { return new URL(src).origin; } catch (e) {}
      }
    }
    return 'https://ena-advisor.onrender.com';
  })();

  const BLUE = '#1B6CA8';
  const BLUE_DARK = '#145486';
  const isMobile = () => window.innerWidth <= 768;

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    #nora-bubble {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 58px;
      height: 58px;
      background: ${BLUE};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 999998;
      box-shadow: 0 4px 20px rgba(27,108,168,0.45);
      transition: transform 0.2s, background 0.2s;
      border: none;
    }
    #nora-bubble:hover { transform: scale(1.08); background: ${BLUE_DARK}; }
    #nora-bubble svg { width: 26px; height: 26px; fill: white; }

    #nora-teaser {
      position: fixed;
      bottom: 92px;
      right: 24px;
      background: white;
      border-radius: 14px;
      padding: 14px 16px;
      box-shadow: 0 4px 24px rgba(27,108,168,0.18);
      z-index: 999997;
      max-width: 260px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      border: 1px solid rgba(27,108,168,0.12);
      animation: noraSlideUp 0.35s ease;
      cursor: pointer;
    }
    #nora-teaser-title {
      font-size: 13px;
      font-weight: 700;
      color: ${BLUE};
      margin-bottom: 4px;
    }
    #nora-teaser-body {
      font-size: 12px;
      color: #4A5568;
      line-height: 1.45;
    }
    #nora-teaser-close {
      position: absolute;
      top: 6px; right: 8px;
      background: none; border: none;
      font-size: 14px; color: #aaa;
      cursor: pointer; padding: 2px;
      line-height: 1;
    }

    #nora-window {
      position: fixed;
      z-index: 999999;
      box-shadow: 0 8px 40px rgba(27,108,168,0.22);
      border-radius: 18px;
      overflow: hidden;
      display: none;
      flex-direction: column;
      transition: opacity 0.25s, transform 0.25s;
      opacity: 0;
      transform: translateY(16px) scale(0.97);
      background: white;
    }
    #nora-window.nora-open {
      display: flex;
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    #nora-window.nora-desktop {
      bottom: 92px;
      right: 24px;
      width: 420px;
      height: 620px;
    }
    #nora-window.nora-mobile {
      top: 0; left: 0; right: 0; bottom: 0;
      width: 100vw; height: 100dvh;
      border-radius: 0;
    }
    #nora-window iframe {
      width: 100%; height: 100%; border: none; flex: 1;
    }

    @keyframes noraSlideUp {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);

  // Bubble
  const bubble = document.createElement('button');
  bubble.id = 'nora-bubble';
  bubble.setAttribute('aria-label', 'Chat with Nora');
  // Stethoscope / medical cross icon
  bubble.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 8h-1V3H6v5H5C3.34 8 2 9.34 2 11v4c0 3.31 2.69 6 6 6h1c1.3 0 2.5-.42 3.47-1.12A5.994 5.994 0 0 0 17 22a6 6 0 0 0 6-6v-3h-1a3 3 0 0 0-3-3zm-1 8a4 4 0 0 1-4 4 3.99 3.99 0 0 1-3.27-1.7A5.98 5.98 0 0 0 14 15v-1h-2v1c0 2.21-1.79 4-4 4s-4-1.79-4-4v-4c0-.55.45-1 1-1h1v2h2V5h6v7h2v-2h1c.55 0 1 .45 1 1v3z"/>
  </svg>`;
  document.body.appendChild(bubble);

  // Teaser
  const teaser = document.createElement('div');
  teaser.id = 'nora-teaser';
  teaser.style.display = 'none';
  teaser.innerHTML = `
    <button id="nora-teaser-close" aria-label="Dismiss">✕</button>
    <div id="nora-teaser-title">Chat with Nora 🩺</div>
    <div id="nora-teaser-body">Nurse or healthcare facility? Ask about joining our team, staffing coverage, or how Nurse Relief works →</div>
  `;
  document.body.appendChild(teaser);

  // Chat window
  const win = document.createElement('div');
  win.id = 'nora-window';
  const iframe = document.createElement('iframe');
  iframe.src = BASE_URL + '/';
  iframe.title = 'Nora — Nurse Relief Inc.';
  win.appendChild(iframe);
  document.body.appendChild(win);

  let isOpen = false;

  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [[523.25, 0], [659.25, 0.18]].forEach(([freq, delay]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + delay + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.6);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.65);
      });
    } catch (e) {}
  }

  function applyLayout() {
    win.className = 'nora-window' + (isOpen ? ' nora-open' : '') + (isMobile() ? ' nora-mobile' : ' nora-desktop');
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    hideTeaser();
    if (isMobile()) bubble.style.display = 'none';
    applyLayout();
    playChime();
    // Force display flex before animating
    win.style.display = 'flex';
    requestAnimationFrame(() => {
      win.classList.add('nora-open');
    });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    win.classList.remove('nora-open');
    if (isMobile()) bubble.style.display = 'flex';
    setTimeout(() => {
      if (!isOpen) win.style.display = 'none';
    }, 260);
  }

  function hideTeaser() {
    teaser.style.display = 'none';
  }

  bubble.addEventListener('click', () => { isOpen ? close() : open(); });
  teaser.addEventListener('click', (e) => {
    if (e.target.id === 'nora-teaser-close') { hideTeaser(); return; }
    open();
  });
  document.getElementById('nora-teaser-close').addEventListener('click', hideTeaser);

  window.addEventListener('resize', () => { if (isOpen) applyLayout(); });

  // Teaser: show after 3s, auto-hide after 15s
  setTimeout(() => {
    if (!isOpen) {
      teaser.style.display = 'block';
      setTimeout(() => { if (!isOpen) hideTeaser(); }, 15000);
    }
  }, 3000);

  // Public API
  window.NoraWidget = { open, close };
})();
