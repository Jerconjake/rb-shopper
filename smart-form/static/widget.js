/**
 * SmartForm Chat Widget
 * Usage: <script src="https://[host]/widget.js?id=client_id"></script>
 *
 * Creates a floating chat bubble that opens an AI-powered chat.
 * Collects name + email first, then free-form conversation.
 * Works alongside embed.js (form) on the same page.
 */
(function () {
  var scripts = document.querySelectorAll('script[src*="widget.js"]');
  var clientId = '';
  var host = '';
  scripts.forEach(function(s) {
    var url = new URL(s.src, window.location.origin);
    var id = url.searchParams.get('id');
    if (id) {
      clientId = id;
      host = url.origin;
    }
  });
  if (!clientId || !host) return;

  var config = {};
  var isOpen = false;

  // Inject styles
  var style = document.createElement('style');
  style.textContent = '\
    .sfw-bubble{position:fixed;bottom:24px;right:24px;height:52px;border-radius:26px;\
      background:#2563eb;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;\
      gap:8px;padding:0 20px 0 16px;\
      box-shadow:0 4px 20px rgba(0,0,0,.2);z-index:999998;\
      transition:transform .3s cubic-bezier(.4,0,.2,1),box-shadow .3s ease;\
      font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;\
      font-size:15px;font-weight:600;letter-spacing:.01em}\
    .sfw-bubble:hover{transform:scale(1.05);box-shadow:0 6px 28px rgba(0,0,0,.25)}\
    .sfw-bubble svg{width:22px;height:22px;flex-shrink:0}\
    .sfw-bubble .sfw-bubble-label{white-space:nowrap}\
    .sfw-bubble.open .sfw-bubble-label{display:none}\
    .sfw-bubble.open{padding:0;width:48px;height:48px;border-radius:50%;justify-content:center}\
    .sfw-bubble.open svg.sfw-icon-msg{display:none}\
    .sfw-bubble:not(.open) svg.sfw-icon-close{display:none}\
    .sfw-panel{position:fixed;bottom:92px;right:24px;width:400px;max-width:calc(100vw - 32px);\
      height:560px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;\
      box-shadow:0 8px 40px rgba(0,0,0,.18);z-index:999997;overflow:hidden;\
      opacity:0;transform:translateY(16px) scale(.96);pointer-events:none;\
      transition:opacity .3s ease,transform .3s cubic-bezier(.4,0,.2,1);\
      display:flex;flex-direction:column}\
    .sfw-panel.open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}\
    .sfw-panel iframe{width:100%;flex:1;border:none;display:block}\
    @media(max-width:480px){\
      .sfw-panel{bottom:0;right:0;width:100vw;max-width:100vw;height:100vh;max-height:100vh;\
        border-radius:0;transform:translateY(100%)}\
      .sfw-panel.open{transform:translateY(0)}\
      .sfw-bubble.open{display:none}\
    }';
  document.head.appendChild(style);

  // Fetch config
  fetch(host + '/config/' + clientId).then(function(r){ return r.json(); }).then(function(cfg) {
    config = cfg;
    if (cfg.brand_color) {
      bubble.style.background = cfg.brand_color;
    }
    // Only show if widget is enabled for this client
    if (!cfg.widget_enabled) {
      bubble.style.display = 'none';
      return;
    }
  }).catch(function(){});

  // Bubble
  var bubble = document.createElement('button');
  bubble.className = 'sfw-bubble';
  bubble.setAttribute('aria-label', 'Chat with us');
  bubble.innerHTML = '\
    <svg class="sfw-icon-msg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>\
    </svg>\
    <span class="sfw-bubble-label">Chat with us</span>\
    <svg class="sfw-icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\
      <path d="M18 6L6 18M6 6l12 12"/>\
    </svg>';
  document.body.appendChild(bubble);

  // Panel with iframe
  var panel = document.createElement('div');
  panel.className = 'sfw-panel';
  var iframe = document.createElement('iframe');
  iframe.src = host + '/chat/' + clientId;
  iframe.setAttribute('title', 'Chat Assistant');
  panel.appendChild(iframe);
  document.body.appendChild(panel);

  function openWidget() {
    isOpen = true;
    bubble.classList.add('open');
    panel.classList.add('open');
  }
  function closeWidget() {
    isOpen = false;
    bubble.classList.remove('open');
    panel.classList.remove('open');
  }

  bubble.addEventListener('click', function() {
    if (isOpen) closeWidget(); else openWidget();
  });

  // Listen for messages from iframe
  window.addEventListener('message', function(e) {
    if (e.origin !== host) return;
    var d = e.data;
    if (!d || typeof d !== 'object') return;

    if (d.type === 'smartform_widget_lead') firePixel();
    if (d.type === 'smartform_widget_close') closeWidget();
  });

  // Pixel helper
  function firePixel() {
    if (window.fbq) window.fbq('track', 'Lead');
    if (window.gtag) {
      try {
        var metas = document.querySelectorAll('meta[name="smartform-gads"]');
        metas.forEach(function(m) {
          var val = m.getAttribute('content');
          if (val) window.gtag('event', 'conversion', { send_to: val });
        });
      } catch (e) {}
    }
  }

  // Public API
  window.SmartFormChat = {
    open: openWidget,
    close: closeWidget,
  };
})();
