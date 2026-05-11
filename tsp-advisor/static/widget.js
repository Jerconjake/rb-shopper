(function () {
  if (document.getElementById('arben-widget-container')) return;

  var BASE_URL = (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src && scripts[i].src.includes('widget.js')) {
        var url = new URL(scripts[i].src);
        return url.origin;
      }
    }
    return '';
  })();

  var isMobile = window.innerWidth <= 600;
  var isOpen = false;

  // Styles
  var style = document.createElement('style');
  style.textContent = `
    #arben-bubble {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: #e05c00;
      cursor: pointer;
      z-index: 999998;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(224,92,0,0.45);
      transition: transform 0.2s, box-shadow 0.2s;
      border: none;
    }
    #arben-bubble:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 20px rgba(224,92,0,0.55);
    }
    #arben-bubble svg { width: 28px; height: 28px; }
    #arben-chat-frame {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 420px;
      height: min(580px, calc(100vh - 120px));
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.22);
      z-index: 999999;
      display: none;
      border: none;
      background: white;
    }
    #arben-teaser {
      position: fixed;
      bottom: 92px;
      right: 24px;
      background: #1c1c1c;
      color: white;
      padding: 10px 14px;
      border-radius: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      line-height: 1.45;
      max-width: 240px;
      z-index: 999997;
      box-shadow: 0 4px 14px rgba(0,0,0,0.25);
      cursor: pointer;
    }
    #arben-teaser::after {
      content: '';
      position: absolute;
      bottom: -7px;
      right: 22px;
      width: 0; height: 0;
      border-left: 7px solid transparent;
      border-right: 7px solid transparent;
      border-top: 7px solid #1c1c1c;
    }
    #arben-teaser-close {
      float: right;
      margin-left: 8px;
      margin-top: -2px;
      color: #aaa;
      cursor: pointer;
      font-size: 15px;
      line-height: 1;
    }
    #arben-teaser-close:hover { color: white; }
    @media (max-width: 600px) {
      #arben-chat-frame {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        width: 100vw;
        height: 100vh;
        border-radius: 0;
        bottom: auto;
        right: auto;
      }
    }
  `;
  document.head.appendChild(style);

  // Bubble
  var bubble = document.createElement('button');
  bubble.id = 'arben-bubble';
  bubble.setAttribute('aria-label', 'Chat with Arben, TSP Parts Advisor');
  bubble.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white"/>
    </svg>
  `;

  // Chat iframe
  var iframe = document.createElement('iframe');
  iframe.id = 'arben-chat-frame';
  iframe.src = BASE_URL + '/';
  iframe.title = 'Arben – TSP Parts Advisor';
  iframe.allow = 'autoplay';

  // Teaser
  var teaser = document.createElement('div');
  teaser.id = 'arben-teaser';
  teaser.innerHTML = '<span id="arben-teaser-close">&times;</span><strong>Need a part or not sure what you need?</strong><br>Ask Arben — TSP\'s AI parts advisor →';
  teaser.style.display = 'none';

  document.body.appendChild(teaser);
  document.body.appendChild(iframe);
  document.body.appendChild(bubble);

  function playChime() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      function note(freq, startTime, duration) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
      }
      note(523.25, 0, 0.35);
      note(659.25, 0.12, 0.45);
    } catch (e) {}
  }

  function openWidget() {
    isOpen = true;
    hideTeaser();
    iframe.style.display = 'block';
    bubble.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18" stroke="white" stroke-width="2.5" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>`;
    if (isMobile) bubble.style.display = 'none';
    iframe.contentWindow.postMessage('__INIT__', '*');
    playChime();
  }

  function closeWidget() {
    isOpen = false;
    iframe.style.display = 'none';
    bubble.style.display = 'flex';
    bubble.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white"/></svg>`;
  }

  function hideTeaser() {
    teaser.style.display = 'none';
  }

  bubble.addEventListener('click', function () {
    if (isOpen) closeWidget();
    else openWidget();
  });

  teaser.addEventListener('click', function (e) {
    if (e.target.id === 'arben-teaser-close') {
      hideTeaser();
    } else {
      openWidget();
    }
  });

  // Allow iframe to send close signal
  window.addEventListener('message', function (e) {
    if (e.data === 'sage-close') closeWidget();
  });

  // Teaser bubble — show after 3s, hide after 15s
  setTimeout(function () {
    if (!isOpen) {
      teaser.style.display = 'block';
      setTimeout(function () {
        if (!isOpen) hideTeaser();
      }, 15000);
    }
  }, 3000);

  // Public API
  window.ArbenWidget = {
    open: openWidget,
    close: closeWidget
  };

})();
