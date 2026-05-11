(function() {
  'use strict';

  // Don't load twice
  if (window.__sageWidgetLoaded) return;
  window.__sageWidgetLoaded = true;

  // Config — update SAGE_URL if Render URL changes
  var SAGE_URL = 'https://dw-botanicals.onrender.com';

  // Detect script src to allow self-hosted URL override
  var scripts = document.querySelectorAll('script[src]');
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].src;
    if (src && src.indexOf('widget.js') !== -1) {
      var match = src.match(/^(https?:\/\/[^\/]+)/);
      if (match) { SAGE_URL = match[1]; }
      break;
    }
  }

  // Inject styles
  var style = document.createElement('style');
  style.textContent = [
    '#sage-bubble{position:fixed;bottom:24px;right:24px;z-index:999998;width:56px;height:56px;border-radius:50%;background:#7A9E7E;box-shadow:0 4px 16px rgba(0,0,0,0.2);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:26px;transition:transform 0.2s,box-shadow 0.2s;}',
    '#sage-bubble:hover{transform:scale(1.08);box-shadow:0 6px 20px rgba(0,0,0,0.25);}',
    '#sage-bubble.open{background:#5C7D60;}',
    '#sage-window{position:fixed;bottom:92px;right:24px;z-index:999997;width:380px;height:600px;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.18);overflow:hidden;border:none;display:none;transition:opacity 0.2s,transform 0.2s;opacity:0;transform:translateY(12px) scale(0.97);}',
    '#sage-window.open{display:block;opacity:1;transform:translateY(0) scale(1);}',
    '@media(max-width:480px){#sage-window{width:calc(100vw - 16px);height:calc(100dvh - 100px);bottom:84px;right:8px;left:8px;}#sage-bubble{bottom:16px;right:16px;}}',
    '#sage-badge{position:absolute;top:-3px;right:-3px;width:18px;height:18px;background:#C4773B;border-radius:50%;border:2px solid white;display:none;}'
  ].join('');
  document.head.appendChild(style);

  // Bubble button
  var bubble = document.createElement('button');
  bubble.id = 'sage-bubble';
  bubble.setAttribute('aria-label', 'Chat with Sage — Wellness Advisor');
  bubble.innerHTML = '🌿<span id="sage-badge"></span>';
  document.body.appendChild(bubble);

  // Chat iframe
  var win = document.createElement('iframe');
  win.id = 'sage-window';
  win.src = SAGE_URL + '/?widget=1';
  win.title = 'Sage — Desert Willow Botanicals Wellness Advisor';
  win.setAttribute('allow', 'autoplay');
  document.body.appendChild(win);

  var isOpen = false;

  function openWidget() {
    isOpen = true;
    bubble.classList.add('open');
    bubble.innerHTML = '✕<span id="sage-badge"></span>';
    win.classList.add('open');
    win.style.display = 'block';
    // Animate in next frame
    requestAnimationFrame(function() {
      win.style.opacity = '1';
      win.style.transform = 'translateY(0) scale(1)';
    });
  }

  function closeWidget() {
    isOpen = false;
    bubble.classList.remove('open');
    bubble.innerHTML = '🌿<span id="sage-badge"></span>';
    win.style.opacity = '0';
    win.style.transform = 'translateY(12px) scale(0.97)';
    setTimeout(function() {
      if (!isOpen) { win.classList.remove('open'); win.style.display = 'none'; }
    }, 200);
  }

  bubble.addEventListener('click', function() {
    if (isOpen) { closeWidget(); } else { openWidget(); }
  });

  // Allow iframe to close the widget (postMessage)
  window.addEventListener('message', function(e) {
    if (e.data === 'sage:close') { closeWidget(); }
  });
})();
