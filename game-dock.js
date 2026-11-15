(() => {
  const dock=document.getElementById('game-dock');
  const toggle=document.getElementById('toggle-game-dock');
  const close=document.getElementById('close-game-dock');
  const frame=document.getElementById('game-frame');
  const extLink=document.getElementById('game-external-link');
  const gameUrl='https://play.ksool.minibig.pw/';
  if(frame && frame.src!==gameUrl) frame.src=gameUrl;
  if(extLink) extLink.href=gameUrl;
  const wide=window.matchMedia('(min-width: 1100px)');
  let chosen=false;
  function setOpen(open,restoreFocus=false){
    dock.hidden=!open;
    document.body.classList.toggle('game-dock-open',open);
    toggle.setAttribute('aria-expanded',String(open));
    if(restoreFocus)toggle.focus();
  }
  toggle.addEventListener('click',()=>{chosen=true;setOpen(dock.hidden);});
  close.addEventListener('click',()=>{chosen=true;setOpen(false,true);});
  wide.addEventListener('change',event=>{if(!chosen)setOpen(event.matches);});
  setOpen(wide.matches);
})();
