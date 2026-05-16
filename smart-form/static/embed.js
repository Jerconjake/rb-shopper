/**
 * SmartForm Embed Script
 * Usage: <script src="https://[host]/embed.js?id=client_id"></script>
 *
 * Modes:
 * 1. INLINE — If a <div data-smartform="inline"></div> exists, renders form inside it.
 * 2. WIDGET — Otherwise, renders a floating bubble + slide-up form panel.
 *
 * Listens for postMessage from iframe:
 *   smartform_lead     → fires Facebook Pixel Lead event in parent context
 *   smartform_redirect → redirects parent page to thank you URL
 *   smartform_resize   → adjusts iframe height (inline mode)
 */
(function () {
  // --- Extract client ID from script src ---
  const scripts = document.querySelectorAll('script[src*="embed.js"]');
  let clientId = '';
  let host = '';
  scripts.forEach(s => {
    const url = new URL(s.src, window.location.origin);
    const id = url.searchParams.get('id');
    if (id) {
      clientId = id;
      host = url.origin;
    }
  });
  if (!clientId || !host) return;

  const FORM_URL = `${host}/form/${clientId}`;

  // --- Check for inline target ---
  const inlineTarget = document.querySelector('[data-smartform="inline"]');

  if (inlineTarget) {
    renderInline(inlineTarget);
  } else {
    renderWidget();
  }

  // --- INLINE MODE ---
  function renderInline(container) {
    const iframe = document.createElement('iframe');
    iframe.src = FORM_URL;
    iframe.style.cssText = 'width:100%;border:none;overflow:hidden;min-height:520px;display:block;';
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('title', 'Contact Form');
    container.appendChild(iframe);

    // Height auto-adjust
    window.addEventListener('message', function (e) {
      if (e.origin !== host) return;
      const d = e.data;
      if (!d || typeof d !== 'object') return;

      if (d.type === 'smartform_resize' && d.height) {
        iframe.style.height = d.height + 'px';
      }
      if (d.type === 'smartform_lead') firePixel();
      if (d.type === 'smartform_redirect' && d.url) {
        window.location.href = d.url;
      }
      if (d.type === 'smartform-scroll-top') {
        iframe.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // --- WIDGET MODE ---
  function renderWidget() {
    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      .sf-bubble{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;
        background:#2563eb;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;
        justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,.2);z-index:999998;
        transition:transform .3s cubic-bezier(.4,0,.2,1),box-shadow .3s ease}
      .sf-bubble:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(0,0,0,.25)}
      .sf-bubble svg{width:26px;height:26px}
      .sf-bubble.open svg.icon-msg{display:none}
      .sf-bubble:not(.open) svg.icon-close{display:none}

      .sf-panel{position:fixed;bottom:92px;right:24px;width:400px;max-width:calc(100vw - 32px);
        background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.18);
        z-index:999997;overflow:hidden;opacity:0;transform:translateY(16px) scale(.96);
        pointer-events:none;transition:opacity .3s ease,transform .3s cubic-bezier(.4,0,.2,1)}
      .sf-panel.open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}
      .sf-panel iframe{width:100%;height:520px;border:none;display:block}

      @media(max-width:480px){
        .sf-panel{bottom:0;right:0;width:100vw;max-width:100vw;height:100vh;
          border-radius:0;transform:translateY(100%)}
        .sf-panel.open{transform:translateY(0)}
        .sf-bubble.open{display:none}
      }
    `;
    document.head.appendChild(style);

    // Fetch config for brand color
    fetch(`${host}/config/${clientId}`).then(r => r.json()).then(cfg => {
      if (cfg.brand_color) {
        bubble.style.background = cfg.brand_color;
      }
    }).catch(() => {});

    // Bubble
    const bubble = document.createElement('button');
    bubble.className = 'sf-bubble';
    bubble.setAttribute('aria-label', 'Contact us');
    bubble.innerHTML = `
      <svg class="icon-msg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
      <svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>`;
    document.body.appendChild(bubble);

    // Panel
    const panel = document.createElement('div');
    panel.className = 'sf-panel';
    const iframe = document.createElement('iframe');
    iframe.src = FORM_URL + '?mode=widget';
    iframe.setAttribute('title', 'Contact Form');
    panel.appendChild(iframe);
    document.body.appendChild(panel);

    let isOpen = false;
    bubble.addEventListener('click', () => {
      isOpen = !isOpen;
      bubble.classList.toggle('open', isOpen);
      panel.classList.toggle('open', isOpen);
    });

    // Listen for messages from iframe
    window.addEventListener('message', function (e) {
      if (e.origin !== host) return;
      const d = e.data;
      if (!d || typeof d !== 'object') return;

      if (d.type === 'smartform_resize' && d.height) {
        iframe.style.height = Math.min(d.height, window.innerHeight - 120) + 'px';
      }
      if (d.type === 'smartform_lead') firePixel();
      if (d.type === 'smartform_redirect' && d.url) {
        window.location.href = d.url;
      }
    });

    // Public API
    window.SmartForm = {
      open: function () { isOpen = true; bubble.classList.add('open'); panel.classList.add('open'); },
      close: function () { isOpen = false; bubble.classList.remove('open'); panel.classList.remove('open'); },
    };
  }

  // --- Pixel helper ---
  function firePixel() {
    if (window.fbq) window.fbq('track', 'Lead');
    if (window.gtag) {
      // Look for Google Ads conversion config in page
      try {
        const metas = document.querySelectorAll('meta[name="smartform-gads"]');
        metas.forEach(m => {
          const val = m.getAttribute('content');
          if (val) window.gtag('event', 'conversion', { send_to: val });
        });
      } catch (e) {}
    }
  }
})();
