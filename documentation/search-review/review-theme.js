// A review-only preference shared across the four local meeting pages.
(()=>{
 const root=document.documentElement,key='sv-review-color-theme';
 let saved;try{saved=localStorage.getItem(key);}catch{}
 root.dataset.reviewTheme=saved==='light'?'light':'dark';
 function mount(){
  if(document.getElementById('review-theme-switch'))return;
  const button=document.createElement('button');button.id='review-theme-switch';button.type='button';button.className='review-theme-switch';
  function label(){button.textContent=root.dataset.reviewTheme==='dark'?'Light theme':'Dark theme';button.setAttribute('aria-label','Switch to '+button.textContent.toLowerCase());}
  button.addEventListener('click',()=>{root.dataset.reviewTheme=root.dataset.reviewTheme==='dark'?'light':'dark';try{localStorage.setItem(key,root.dataset.reviewTheme);}catch{}label();});
  label();document.body.append(button);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
