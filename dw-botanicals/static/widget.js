(function() {
  'use strict';

  if (window.__sageWidgetLoaded) return;
  window.__sageWidgetLoaded = true;

  var SAGE_URL = 'https://dw-botanicals.onrender.com';

  var scripts = document.querySelectorAll('script[src]');
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].src;
    if (src && src.indexOf('widget.js') !== -1) {
      var match = src.match(/^(https?:\/\/[^\/]+)/);
      if (match) { SAGE_URL = match[1]; }
      break;
    }
  }

  var LEAF_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="white" style="display:block"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-5 9z"/></svg>';
  var CLOSE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" style="display:block"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  var css = [
    /* Bubble */
    '#sage-bubble{position:fixed;bottom:24px;right:24px;z-index:999998;width:56px;height:56px;border-radius:50%;background:#7A9E7E;box-shadow:0 4px 16px rgba(0,0,0,0.22);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform 0.2s,box-shadow 0.2s,background 0.2s;padding:0;outline:none;}',
    '#sage-bubble:hover{transform:scale(1.08);box-shadow:0 6px 22px rgba(0,0,0,0.28);}',
    '#sage-bubble.open{background:#4e6b52;}',
    /* Chat window — desktop */
    '#sage-window{position:fixed;bottom:92px;right:24px;z-index:999997;width:420px;height:min(600px,calc(100vh - 120px));border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.18);overflow:hidden;border:none;display:none;opacity:0;transform:translateY(12px) scale(0.97);transition:opacity 0.22s ease,transform 0.22s ease;}',
    '#sage-window.open{display:block;opacity:1;transform:translateY(0) scale(1);}',
    /* Teaser bubble */
    '#sage-teaser{position:fixed;bottom:90px;right:86px;z-index:999998;background:#fff;color:#2d2d2d;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13.5px;line-height:1.45;padding:11px 14px;border-radius:12px 12px 2px 12px;box-shadow:0 4px 18px rgba(0,0,0,0.14);max-width:220px;cursor:pointer;opacity:0;transform:translateY(6px);transition:opacity 0.3s,transform 0.3s;pointer-events:none;}',
    '#sage-teaser.visible{opacity:1;transform:translateY(0);pointer-events:auto;}',
    '#sage-teaser strong{display:block;margin-bottom:3px;color:#2d2d2d;}',
    '#sage-teaser span{color:#7A9E7E;font-weight:600;}',
    '#sage-teaser-close{position:absolute;top:5px;right:7px;font-size:14px;color:#aaa;line-height:1;cursor:pointer;padding:0 2px;}',
    '#sage-teaser-close:hover{color:#666;}',
    /* Mobile — full screen takeover, hide bubble when open */
    '@media(max-width:480px){',
    '#sage-bubble{bottom:16px;right:16px;}',
    '#sage-bubble.mobile-hidden{display:none!important;}',
    '#sage-window{position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;border-radius:0;z-index:999999;}',
    '#sage-teaser{right:80px;bottom:80px;max-width:190px;font-size:13px;}',
    '}'
  ].join('');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Teaser bubble
  var teaser = document.createElement('div');
  teaser.id = 'sage-teaser';
  teaser.innerHTML = '<span id="sage-teaser-close">&times;</span><strong>Chat with Sage, our AI wellness advisor</strong><span>Ask about what you\'re dealing with, how to use our formulas, shipping, and more &rarr;</span>';
  document.body.appendChild(teaser);

  // Bubble button
  var bubble = document.createElement('button');
  bubble.id = 'sage-bubble';
  bubble.setAttribute('aria-label', 'Chat with Sage — Wellness Advisor');
  bubble.innerHTML = LEAF_SVG;
  document.body.appendChild(bubble);

  // Chat iframe
  var win = document.createElement('iframe');
  win.id = 'sage-window';
  win.src = SAGE_URL + '/?widget=1';
  win.title = 'Sage — Desert Willow Botanicals Wellness Advisor';
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

  function openWidget() {
    isOpen = true;
    hideTeaser();
    teaserDismissed = true;
    bubble.classList.add('open');
    bubble.innerHTML = CLOSE_SVG;
    // On mobile, hide bubble (close is inside iframe)
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
    bubble.innerHTML = LEAF_SVG;
    win.classList.remove('open');
    setTimeout(function() {
      if (!isOpen) { win.style.display = 'none'; }
    }, 230);
  }

  bubble.addEventListener('click', function() {
    if (isOpen) { closeWidget(); } else { openWidget(); }
  });

  teaser.addEventListener('click', function(e) {
    if (e.target.id === 'sage-teaser-close') {
      teaserDismissed = true;
      hideTeaser();
    } else {
      openWidget();
    }
  });

  // Show teaser after 3s, hide after 15s
  setTimeout(function() { showTeaser(); }, 3000);
  setTimeout(function() { hideTeaser(); }, 15000);

  // Allow iframe to send close signal
  window.addEventListener('message', function(e) {
    if (e.data === 'sage:close') { closeWidget(); }
  });

  // Public API — any button on the site can call SageWidget.open() or SageWidget.close()
  window.SageWidget = { open: openWidget, close: closeWidget };
})();
