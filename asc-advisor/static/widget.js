(function(){
  var ORIGIN=document.currentScript&&document.currentScript.src?new URL(document.currentScript.src).origin:window.location.origin;
  var COLOR='#2E5A4B';
  var ACCENT='#C5A55A';

  // Styles
  var s=document.createElement('style');
  s.textContent=`
    #hope-bubble{position:fixed;bottom:24px;right:24px;width:62px;height:62px;border-radius:50%;background:${COLOR};cursor:pointer;z-index:999998;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.25);transition:transform .2s,box-shadow .2s;border:none}
    #hope-bubble:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(0,0,0,0.3)}
    #hope-bubble svg{width:30px;height:30px;fill:white}
    #hope-frame{position:fixed;bottom:24px;right:24px;width:400px;height:580px;border:none;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.2);z-index:999999;display:none;overflow:hidden;background:white}
    #hope-close{position:fixed;bottom:596px;right:28px;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,0.6);border:none;cursor:pointer;z-index:1000000;display:none;align-items:center;justify-content:center;color:white;font-size:18px;line-height:1}
    #hope-teaser{position:fixed;bottom:92px;right:24px;background:white;color:#2C2C2C;padding:12px 18px;border-radius:14px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:999997;font-family:-apple-system,system-ui,sans-serif;font-size:14px;line-height:1.45;max-width:280px;display:none;cursor:pointer}
    #hope-teaser-dismiss{position:absolute;top:4px;right:8px;background:none;border:none;cursor:pointer;font-size:16px;color:#999;line-height:1}
    @media(max-width:768px){
      #hope-frame{width:100vw;height:100vh;height:100dvh;bottom:0;right:0;border-radius:0}
      #hope-close{bottom:auto;top:12px;right:12px;z-index:1000000}
      #hope-bubble.hope-hidden{display:none!important}
    }
  `;
  document.head.appendChild(s);

  // Bubble
  var bubble=document.createElement('button');
  bubble.id='hope-bubble';
  bubble.setAttribute('aria-label','Chat with Hope');
  bubble.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
  document.body.appendChild(bubble);

  // Frame
  var frame=document.createElement('iframe');
  frame.id='hope-frame';
  frame.src=ORIGIN+'/';
  frame.setAttribute('loading','lazy');
  document.body.appendChild(frame);

  // Close button
  var closeBtn=document.createElement('button');
  closeBtn.id='hope-close';
  closeBtn.innerHTML='✕';
  document.body.appendChild(closeBtn);

  // Teaser
  var teaser=document.createElement('div');
  teaser.id='hope-teaser';
  teaser.innerHTML='<button id="hope-teaser-dismiss">✕</button><strong>Chat with Hope</strong><br>Have questions about therapy or not sure where to start? I\'m here to help — no commitment, just a conversation. →';
  document.body.appendChild(teaser);

  var isOpen=false;

  function openChat(){
    if(isOpen)return;
    isOpen=true;
    frame.style.display='block';
    closeBtn.style.display='flex';
    bubble.classList.add('hope-hidden');
    teaser.style.display='none';
    // Chime
    try{
      var ctx=new(window.AudioContext||window.webkitAudioContext)();
      function note(f,t){var o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=f;o.type='sine';g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.6);o.start(t);o.stop(t+0.6)}
      note(523.25,ctx.currentTime);note(659.25,ctx.currentTime+0.15);
    }catch(e){}
  }

  function closeChat(){
    if(!isOpen)return;
    isOpen=false;
    frame.style.display='none';
    closeBtn.style.display='none';
    bubble.classList.remove('hope-hidden');
  }

  bubble.onclick=openChat;
  teaser.onclick=openChat;
  closeBtn.onclick=closeChat;

  // Teaser timing
  setTimeout(function(){if(!isOpen)teaser.style.display='block'},3000);
  setTimeout(function(){if(!isOpen)teaser.style.display='none'},18000);

  // Public API
  window.HopeWidget={open:openChat,close:closeChat};
})();
