(function() {
  'use strict';

  var BASE_URL = (function() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src;
      if (src && src.indexOf('widget.js') !== -1) {
        return src.replace('/widget.js', '');
      }
    }
    return '';
  })();

  var isMobile = window.innerWidth <= 768;
  var isOpen = false;
  var teaserTimer = null;
  var teaserHideTimer = null;

  // Inject styles
  var style = document.createElement('style');
  style.textContent = `
    #pdp-widget-bubble {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      background: #EFC050;
      border-radius: 50%;
      cursor: pointer;
      z-index: 99998;
      box-shadow: 0 4px 20px rgba(239,192,80,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #pdp-widget-bubble:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 28px rgba(239,192,80,0.5);
    }
    #pdp-widget-bubble svg {
      width: 28px; height: 28px; fill: #000;
    }
    #pdp-teaser {
      position: fixed;
      bottom: 96px;
      right: 24px;
      background: #000;
      border: 1px solid #EFC050;
      border-radius: 12px;
      padding: 12px 16px;
      width: 270px;
      z-index: 99997;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      animation: pdpFadeIn 0.3s ease;
      cursor: pointer;
    }
    #pdp-teaser p {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      color: #f0f0f0;
      line-height: 1.5;
      margin: 0;
    }
    #pdp-teaser p span {
      color: #EFC050;
      font-weight: 600;
    }
    #pdp-teaser-close {
      position: absolute;
      top: 6px; right: 10px;
      font-size: 16px;
      color: #666;
      cursor: pointer;
      line-height: 1;
      background: none;
      border: none;
      padding: 0;
    }
    #pdp-teaser-close:hover { color: #EFC050; }
    #pdp-widget-frame {
      position: fixed;
      z-index: 99999;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
      border-radius: 16px;
      overflow: hidden;
      display: none;
      transition: opacity 0.25s;
    }
    @keyframes pdpFadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);

  // Bubble
  var bubble = document.createElement('div');
  bubble.id = 'pdp-widget-bubble';
  bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
  document.body.appendChild(bubble);

  // Teaser
  var teaser = document.createElement('div');
  teaser.id = 'pdp-teaser';
  teaser.style.display = 'none';
  teaser.innerHTML = '<button id="pdp-teaser-close">×</button><p><span>Ask Alex</span> — our photography assistant<br>Questions about services, process, pricing, or booking a free consultation →</p>';
  document.body.appendChild(teaser);

  // iFrame
  var frame = document.createElement('iframe');
  frame.id = 'pdp-widget-frame';
  frame.src = BASE_URL + '/';
  frame.setAttribute('frameborder', '0');
  frame.setAttribute('allowtransparency', 'true');
  document.body.appendChild(frame);

  function setFrameSize() {
    isMobile = window.innerWidth <= 768;
    if (isMobile) {
      frame.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;border-radius:0;z-index:99999;';
    } else {
      frame.style.cssText = 'position:fixed;bottom:96px;right:24px;width:400px;height:580px;border-radius:16px;z-index:99999;';
    }
  }

  function openWidget() {
    isOpen = true;
    setFrameSize();
    frame.style.display = 'block';
    if (isMobile) bubble.style.display = 'none';
    hideTeaser();
  }

  function closeWidget() {
    isOpen = false;
    frame.style.display = 'none';
    bubble.style.display = 'flex';
  }

  function hideTeaser() {
    teaser.style.display = 'none';
    if (teaserTimer) clearTimeout(teaserTimer);
    if (teaserHideTimer) clearTimeout(teaserHideTimer);
  }

  bubble.addEventListener('click', function() {
    if (isOpen) closeWidget(); else openWidget();
  });

  teaser.addEventListener('click', function(e) {
    if (e.target.id !== 'pdp-teaser-close') openWidget();
  });

  document.getElementById('pdp-teaser-close').addEventListener('click', function(e) {
    e.stopPropagation();
    hideTeaser();
    localStorage.setItem('pdp_teaser_dismissed', '1');
  });

  // Show teaser after 3s, auto-hide after 15s
  var dismissed = localStorage.getItem('pdp_teaser_dismissed');
  if (!dismissed) {
    teaserTimer = setTimeout(function() {
      teaser.style.display = 'block';
      teaserHideTimer = setTimeout(function() {
        teaser.style.display = 'none';
      }, 15000);
    }, 3000);
  }

  window.addEventListener('resize', function() {
    if (isOpen) setFrameSize();
  });

  // Public API
  window.PDPWidget = {
    open: openWidget,
    close: closeWidget
  };

})();
