(function() {
  'use strict';

  if (window.__arbenWidgetLoaded) return;
  window.__arbenWidgetLoaded = true;

  var TSP_URL = 'https://tsp-advisor.onrender.com';

  var scripts = document.querySelectorAll('script[src]');
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].src;
    if (src && src.indexOf('widget.js') !== -1) {
      var match = src.match(/^(https?:\/\/[^\/]+)/);
      if (match) { TSP_URL = match[1]; }
      break;
    }
  }

  // Wrench SVG (open state)
  var WRENCH_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="white" style="display:block"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>';
  var CLOSE_SVG  = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" style="display:block"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  var css = [
    /* Bubble */
    '#arben-bubble{position:fixed;bottom:24px;right:24px;z-index:999998;width:56px;height:56px;border-radius:50%;background:#1863DC;box-shadow:0 4px 18px rgba(24,99,220,0.38);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform 0.2s,box-shadow 0.2s,background 0.2s;padding:0;outline:none;}',
    '#arben-bubble:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(24,99,220,0.48);}',
    '#arben-bubble.open{background:#1250B0;}',
    /* Chat window — desktop */
    '#arben-window{position:fixed;bottom:92px;right:24px;z-index:999997;width:420px;height:min(600px,calc(100vh - 120px));border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.18);overflow:hidden;border:none;display:none;opacity:0;transform:translateY(12px) scale(0.97);transition:opacity 0.22s ease,transform 0.22s ease;}',
    '#arben-window.open{display:block;opacity:1;transform:translateY(0) scale(1);}',
    /* Teaser */
    '#arben-teaser{position:fixed;bottom:90px;right:86px;z-index:999998;background:#fff;color:#1C2331;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13.5px;line-height:1.45;padding:11px 14px;border-radius:12px 12px 2px 12px;box-shadow:0 4px 18px rgba(0,0,0,0.13);max-width:230px;cursor:pointer;opacity:0;transform:translateY(6px);transition:opacity 0.3s,transform 0.3s;pointer-events:none;}',
    '#arben-teaser.visible{opacity:1;transform:translateY(0);pointer-events:auto;}',
    '#arben-teaser strong{display:block;margin-bottom:3px;color:#1C2331;}',
    '#arben-teaser span{color:#1863DC;font-weight:600;}',
    '#arben-teaser-close{position:absolute;top:5px;right:7px;font-size:14px;color:#aaa;line-height:1;cursor:pointer;padding:0 2px;}',
    '#arben-teaser-close:hover{color:#666;}',
    /* Mobile */
    '@media(max-width:480px){',
    '#arben-bubble{bottom:16px;right:16px;}',
    '#arben-bubble.mobile-hidden{display:none!important;}',
    '#arben-window{position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;border-radius:0;z-index:999999;}',
    '#arben-teaser{right:80px;bottom:80px;max-width:200px;font-size:13px;}',
    '}'
  ].join('');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Teaser
  var teaser = document.createElement('div');
  teaser.id = 'arben-teaser';
  teaser.innerHTML = '<span id="arben-teaser-close">&times;</span><strong>Need a part or not sure what to order?</strong><span>Ask Arben — TSP\'s AI parts advisor &rarr;</span>';
  document.body.appendChild(teaser);

  // Bubble
  var bubble = document.createElement('button');
  bubble.id = 'arben-bubble';
  bubble.setAttribute('aria-label', 'Chat with Arben — TSP Parts Advisor');
  bubble.innerHTML = WRENCH_SVG;
  document.body.appendChild(bubble);

  // Chat iframe
  var win = document.createElement('iframe');
  win.id = 'arben-window';
  win.src = TSP_URL + '/?widget=1';
  win.title = 'Arben — Toronto Spray Foam Parts Advisor';
  win.setAttribute('allow', 'autoplay');
  document.body.appendChild(win);

  var isOpen = false;
  var teaserDismissed = false;
  var isMobile = function() { return window.innerWidth <= 480; };

  function showTeaser() {
    if (teaserDismissed || isOpen) return;
    teaser.classList.add('visible');
  }
  function hideTeaser() {
    teaser.classList.remove('visible');
  }

  function playChime() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var notes = [1046.5, 1318.5];
      notes.forEach(function(freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    } catch(e) {}
  }

  function openWidget() {
    isOpen = true;
    hideTeaser();
    teaserDismissed = true;
    playChime();
    bubble.classList.add('open');
    bubble.innerHTML = CLOSE_SVG;
    if (isMobile()) { bubble.classList.add('mobile-hidden'); }
    win.style.display = 'block';
    requestAnimationFrame(function() {
      win.classList.add('open');
    });
  }

  function closeWidget() {
    isOpen = false;
    bubble.classList.remove('open');
    bubble.classList.remove('mobile-hidden');
    bubble.innerHTML = WRENCH_SVG;
    win.classList.remove('open');
    setTimeout(function() {
      if (!isOpen) { win.style.display = 'none'; }
    }, 230);
  }

  bubble.addEventListener('click', function() {
    if (isOpen) { closeWidget(); } else { openWidget(); }
  });

  teaser.addEventListener('click', function(e) {
    if (e.target.id === 'arben-teaser-close') {
      teaserDismissed = true;
      hideTeaser();
    } else {
      openWidget();
    }
  });

  // Teaser: show 3s after load, auto-hide after 15s
  setTimeout(function() { showTeaser(); }, 3000);
  setTimeout(function() { hideTeaser(); }, 15000);

  // Close signal from iframe
  window.addEventListener('message', function(e) {
    if (e.data === 'arben:close') { closeWidget(); }
  });

  // Public API
  window.ArbenWidget = { open: openWidget, close: closeWidget };
})();
