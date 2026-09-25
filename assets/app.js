let wines=[]; let settings={};
const state={filter:'all',query:'',cart:{}};const $=s=>document.querySelector(s);const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){let list=wines.filter(w=>w.status!=='hidden'&&(state.filter==='all'||w.type===state.filter)&&[w.name,w.desc,w.taste].join('').includes(state.query));$('#products').innerHTML=list.length?list.map(w=>`<article class="product"><div class="product-art"><img src="${escape(w.image)}" alt="${escape(w.name)}商品參考圖" style="object-position:50% center" loading="lazy"><span class="tag">${String(list.indexOf(w)+1).padStart(2,'0')}</span></div><div class="product-body"><span class="type mobile-summary" id="wine-type-${w.id}">${escape(w.en)}</span><h3 class="mobile-summary" id="wine-name-${w.id}">${escape(w.name)}</h3><p class="mobile-summary" id="wine-desc-${w.id}">${escape(w.desc)}</p><div class="tastes mobile-summary" id="wine-taste-${w.id}">${escape(w.taste)}</div><button type="button" class="wine-expand" data-expand aria-expanded="false" aria-controls="wine-type-${w.id} wine-name-${w.id} wine-desc-${w.id} wine-taste-${w.id}" aria-label="展開${escape(w.name)}的更多資訊" hidden>展開更多 ＋</button><div class="product-bottom"><span>專屬詢價</span><button class="add" data-add="${w.id}" aria-label="將${escape(w.name)}加入詢價">＋ 加入詢價</button></div></div></article>`).join(''):'<p class="empty">找不到符合的酒款，試試其他關鍵字或分類。</p>';requestAnimationFrame(updateWineExpandButtons);}
function total(){return Object.values(state.cart).reduce((a,b)=>a+b,0)}function update(){let n=total();$('#count').textContent=n;$('#mobileCount').textContent=n?`已選 ${Object.keys(state.cart).length} 款・共 ${n} 瓶`:'尚未選擇酒款';$('#cartItems').innerHTML=n?Object.entries(state.cart).map(([id,q])=>{let w=wines.find(x=>x.id===id);return `<div class="cart-row"><div><strong>${escape(w.name)}</strong><small>待確認酒款 · 專屬詢價</small></div><div class="quantity"><button data-adjust="${id}" data-step="-1" aria-label="減少${escape(w.name)}數量">−</button><span>${q}</span><button data-adjust="${id}" data-step="1" aria-label="增加${escape(w.name)}數量">＋</button></div></div>`}).join(''):'<p class="empty">清單還是空的。<br>先挑選一款喜歡的酒吧。</p>';$('#total').textContent=`共 ${Object.keys(state.cart).length} 款 / ${n} 瓶`;$('#copy').disabled=!n;}
let timer;function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('#toast').classList.remove('show'),2500)}
document.addEventListener('click',e=>{let a=e.target.closest('[data-add]');if(a){state.cart[a.dataset.add]=Math.min(99,(state.cart[a.dataset.add]||0)+1);update();toast('已加入詢價清單');}let q=e.target.closest('[data-adjust]');if(q){let id=q.dataset.adjust;state.cart[id]=Math.min(99,state.cart[id]+Number(q.dataset.step));if(state.cart[id]<=0)delete state.cart[id];update();}let f=e.target.closest('[data-filter]');if(f){state.filter=f.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b===f);b.setAttribute('aria-pressed',b===f)});render();}if(e.target.closest('.close'))e.target.closest('dialog').close();});
$('#search').addEventListener('input',e=>{state.query=e.target.value.trim();render()});['#openCart','#mobileCart'].forEach(s=>$(s).onclick=()=>{update();$('#cart').showModal()});$('#helpBtn').onclick=()=>$('#helpDialog').showModal();document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){let r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
async function copyText(text,fallback,btn){try{await navigator.clipboard.writeText(text);let old=btn.textContent;btn.textContent='已複製，請貼到 LINE 聊天室';setTimeout(()=>btn.textContent=old,3000)}catch{let el=$(fallback);el.hidden=false;el.value=text;el.focus();el.select();btn.textContent='請長按下方文字複製';}}
function sendLine(text){if(!settings.lineId){toast('酒單尚未載入，請稍後再試');return;}window.location.href='https://line.me/R/oaMessage/'+encodeURIComponent(settings.lineId)+'/?'+encodeURIComponent(text);}
$('#copy').onclick=()=>{if(!total())return;sendLine('您好，我想詢問以下酒款：\n'+Object.entries(state.cart).map(([id,q])=>wines.find(w=>w.id===id).name+' × '+q+' 瓶').join('\n')+'\n共 '+total()+' 瓶\n'+($('#notes').value?'補充需求：'+$('#notes').value+'\n':'')+'請協助確認價格與供貨，謝謝。'+(settings.demo?'\n（示範酒单體驗，非正式訂單）':''));};
$('#copyHelp').onclick=()=>sendLine('您好，想請您協助挑選酒款。\n場合：'+$('#occasion').value+'\n每瓶預算：'+($('#budget').value||'想先了解建議')+'\n口味與需求：'+($('#taste').value||'請協助推薦'));
async function loadCatalog(){try{const r=await fetch('/catalog.json');if(!r.ok)throw Error();settings=await r.json();wines=settings.wines;document.title=settings.brand+'｜專屬選酒';document.querySelectorAll('.brand').forEach(el=>{el.textContent=settings.brand+' ';const i=document.createElement('i');i.textContent=settings.english;el.append(i)});$('.intro h1').textContent=settings.headline;$('.intro p').textContent=settings.intro;initCarousel(settings);document.querySelectorAll('[data-line-link]').forEach(a=>a.href=settings.lineUrl);$('.demo-note').hidden=!settings.demo;$('#adminLink').hidden=false;render();update();}catch{$('#products').innerHTML='<p class="empty">酒單暫時無法載入。<button onclick="location.reload()">重新載入</button></p>';}}loadCatalog();

function initCarousel(settings){
 const slides=settings.heroSlides?.length?settings.heroSlides:[{image:settings.heroImage,alt:settings.brand+'精選酒款'}];
 const region=$('.hero-photo'), img=region.querySelector('img'), controls=$('.carousel-controls');let index=0, paused=matchMedia('(prefers-reduced-motion: reduce)').matches, hover=false, focused=false,startX=null;
 controls.hidden=slides.length<2;
 $('#slideDots').innerHTML=slides.map((_,i)=>`<button type="button" data-slide="${i}" aria-label="前往第 ${i+1} 張"></button>`).join('');
 function show(i){index=(i+slides.length)%slides.length;img.src=slides[index].image;img.alt=slides[index].alt||settings.brand+'精選圖片 '+(index+1);$('#slideCount').textContent=(index+1)+' / '+slides.length;region.querySelectorAll('[data-slide]').forEach((b,j)=>b.setAttribute('aria-current',String(j===index)));}
 function pauseLabel(){ $('#slidePause').textContent=paused?'播放':'暫停';$('#slidePause').setAttribute('aria-label',paused?'播放自動輪播':'暫停自動輪播');}
 $('#slidePrev').onclick=()=>show(index-1);$('#slideNext').onclick=()=>show(index+1);$('#slidePause').onclick=()=>{paused=!paused;pauseLabel()};$('#slideDots').onclick=e=>{const b=e.target.closest('[data-slide]');if(b)show(Number(b.dataset.slide))};
 region.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();show(index+(e.key==='ArrowLeft'?-1:1))}});
 region.addEventListener('mouseenter',()=>hover=true);region.addEventListener('mouseleave',()=>hover=false);region.addEventListener('focusin',()=>focused=true);region.addEventListener('focusout',e=>focused=region.contains(e.relatedTarget));
 region.addEventListener('touchstart',e=>startX=e.changedTouches[0].clientX,{passive:true});region.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-startX;if(startX!==null&&Math.abs(dx)>50)show(index+(dx<0?1:-1));startX=null},{passive:true});
 if(slides.length>1)setInterval(()=>{if(!paused&&!hover&&!focused&&!document.hidden)show(index+1)},5500);show(0);pauseLabel();
}

function updateWineExpandButtons(){
 const mobile=matchMedia('(max-width:800px)').matches;
 document.querySelectorAll('.product').forEach(card=>{
  const button=card.querySelector('[data-expand]');
  if(!button)return;
  button.hidden=!mobile||(!card.classList.contains('info-expanded')&&!Array.from(card.querySelectorAll('.mobile-summary')).some(el=>el.scrollHeight>el.clientHeight+1));
 });
}
document.addEventListener('click',e=>{
 const button=e.target.closest('[data-expand]');if(!button)return;
 const card=button.closest('.product'),expanded=card.classList.toggle('info-expanded');
 button.setAttribute('aria-expanded',String(expanded));button.textContent=expanded?'收合資訊 −':'展開更多 ＋';
 button.setAttribute('aria-label',(expanded?'收合':'展開')+card.querySelector('h3').textContent+'的更多資訊');
});
let wineResizeFrame;
window.addEventListener('resize',()=>{cancelAnimationFrame(wineResizeFrame);wineResizeFrame=requestAnimationFrame(updateWineExpandButtons)});
if(document.fonts)document.fonts.ready.then(updateWineExpandButtons);
