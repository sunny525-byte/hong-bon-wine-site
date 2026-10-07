let data,version,dirty=false,uploads=0;const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function field(label,key,value,area=false){return `<label class="field ${area?'wide':''}">${label}${area?`<textarea data-key="${key}" rows="3" maxlength="2000">${esc(value)}</textarea>`:`<input data-key="${key}" value="${esc(value)}" maxlength="2000" ${(key==='lineId'||key==='brand.zh'||key==='name.zh')?'required':''}>`}</label>`}
function lfield(label,key,obj,area=false){return field(label+'（中文 ZH）',key+'.zh',(obj||{}).zh||'',area)+field(label+'（English EN）',key+'.en',(obj||{}).en||'',area);}
// Ordered patterns -> friendly group label, so the ~140 chrome strings are
// reviewable in a handful of collapsible sections rather than one per key.
var UI_GROUPS=[
 ['首頁主視覺', /^(hero[A-Z]|hero$|tagline|heroSlideAlt|heroEnd|skip$|carouselPause)/],
 ['跑馬燈',     /^(ticker)/],
 ['酒款區文字', /^(collection|allWines|wine[A-Z]|card|featuredBadge|imageAlt|addToInquiry|ariaAddToInquiry|ariaExpandWine|ariaFilters|expandMore|collapse|expand$|moreInfo)/],
 ['LINE 區塊',  /^(band)/],
 ['選酒需求',   /^(help)/],
 ['頁尾與聯絡', /^(footer|nav[A-Z]|pay|ariaContact|ariaPhone|ariaMap)/],
 ['詢價清單',   /^(cart|mobileCount|cartTotalsLine|cartSubmit|viewCart|qty|addedToCart|basket)/],
 ['詢價表單',   /^(form)/],
 ['輸入提示',   /^(ph[A-Z])/],
 ['無障礙標籤', /^(aria)/],
 ['政策頁',     /^(page)/],
 ['SEO 標題描述', /^(homeTitle|homeDescription|homeOgDescription|catDescription|catFallback|wineDescription)/],
 ['行動版',     /^(mobile)/],
 ['其他文字',   /^./],
];

function uiGroupOf(k){
  for(var i=0;i<UI_GROUPS.length;i++) if(UI_GROUPS[i][1].test(k)) return UI_GROUPS[i][0];
  return '其他文字';
}

function renderUi(){
  var u=(data.ui||{}), box=document.getElementById('uiSettings');
  if(!box) return;
  var groups={};
  Object.keys(u).sort().forEach(function(k){
    var g=uiGroupOf(k);
    (groups[g]=groups[g]||[]).push(k);
  });
  box.innerHTML=Object.keys(groups).sort().map(function(g){
    var rows=groups[g].map(function(k){
      var v=u[k]||{};
      return '<div class="ui-row"><code>'+esc(k)+'</code>'
        +'<input data-key="ui.'+k+'.zh" value="'+esc(v.zh||'')+'" placeholder="中文">'
        +'<input data-key="ui.'+k+'.en" value="'+esc(v.en||'')+'" placeholder="English">'
        +'</div>';
    }).join('');
    return '<details class="ui-group"><summary>'+esc(g)+' ('+groups[g].length+')</summary>'+rows+'</details>';
  }).join('');
}

function status(t,error=false){$('#status').textContent=t;$('#status').classList.toggle('error',error)}function changed(){dirty=true;status('有未儲存的修改')}function render(){ $('#settings').innerHTML=lfield('品牌名稱','brand',data.brand)+lfield('英文名稱','english',data.english)+field('Logo 圖片網址','logo',data.logo)+'<label class="field">上傳 Logo 圖片<input type="file" data-upload="logo" accept="image/jpeg,image/png,image/webp"><small>JPG、PNG 或 WebP，最大 10MB（會自動壓縮）。建議使用透明背景 PNG。</small></label>'+lfield('首頁標題','headline',data.headline)+lfield('首頁介紹','intro',data.intro,true);$('#lineSettings').innerHTML=field('官方 LINE ID（包含 @）','lineId',data.lineId)+field('加好友連結','lineUrl',data.lineUrl)+field('Instagram 網址','social.instagram',(data.social||{}).instagram||'')+field('Facebook 網址','social.facebook',(data.social||{}).facebook||'');renderWines();renderSlides();renderUi();}
function renderWines(){ $('#wineEditors').innerHTML=data.wines.map((w,i)=>`<article class="wine-editor" data-id="${w.id}"><div class="wine-head"><h3>酒款 ${i+1}</h3><label class="check"><input type="checkbox" data-key="active" ${w.active?'checked':''}>上架</label></div><div class="fields">${lfield('酒款名稱','name',w.name)}<label class="field">分類<select data-key="type">${[['red','紅酒'],['white','白酒'],['rose','粉紅酒'],['sparkling','氣泡酒']].map(([k,v])=>`<option value="${k}" ${w.type===k?'selected':''}>${v}</option>`).join('')}</select></label>${lfield('英文風格標籤','en',w.en)}${lfield('風味與搭配','taste',w.taste)}${lfield('酒款介紹','desc',w.desc,true)}${field('商品圖片網址','image',w.image)+field('網址代稱 slug（更改會改變此酒款的網址）','slug',w.slug||'')}<label class="field">上傳商品照片<input type="file" data-upload="${w.id}" accept="image/jpeg,image/png,image/webp"><small>JPG、PNG 或 WebP，最大 10MB（會自動壓縮）</small></label></div><div class="wine-head"><img src="${esc(w.image)}" alt="酒款圖片預覽"><div class="buttons"><button type="button" class="outline" data-move="${w.id}" data-dir="-1" ${i===0?'disabled':''}>上移</button><button type="button" class="outline" data-move="${w.id}" data-dir="1" ${i===data.wines.length-1?'disabled':''}>下移</button><button type="button" class="danger" data-delete="${w.id}">刪除</button></div></div></article>`).join('')||'<p>目前沒有酒款，按「新增酒款」開始。</p>';}
$('#editor').addEventListener('input',e=>{const k=e.target.dataset.key;if(k){let card=e.target.closest('[data-id]'),slide=e.target.closest('[data-slide-index]');let obj=slide?data.heroSlides[Number(slide.dataset.slideIndex)]:card?data.wines.find(w=>w.id===card.dataset.id):data;var v=e.target.type==='checkbox'?e.target.checked:e.target.value;if(k.indexOf('.')>-1){var parts=k.split('.');var t=obj;for(var i=0;i<parts.length-1;i++){var pk=parts[i];if(typeof t[pk]!=='object'||t[pk]===null)t[pk]={};t=t[pk];}t[parts[parts.length-1]]=v;}else obj[k]=v;changed();}});
function compressImage(file,maxDim=1200,quality=.82){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{URL.revokeObjectURL(url);const scale=Math.min(1,maxDim/Math.max(img.width,img.height));const w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);let out=c.toDataURL('image/webp',quality);if(!out.startsWith('data:image/webp'))out=c.toDataURL('image/jpeg',quality);resolve(out)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('無法讀取圖片'))};img.src=url})}$('#editor').addEventListener('change',async e=>{if(!e.target.dataset.upload)return;const input=e.target,f=input.files[0];if(!f)return;if(f.size>10*1024*1024){status('圖片不可超過 10MB（會自動壓縮）',true);return}uploads++;$('#save').disabled=true;input.disabled=true;status('正在壓縮圖片…');try{const j={url:await compressImage(f)};if(input.dataset.upload.startsWith('slide:')){const slide=data.heroSlides[Number(input.dataset.upload.split(':')[1])];if(slide){slide.image=j.url;renderSlides();}}else if(input.dataset.upload==='logo'){data.logo=j.url;const li=$('#settings [data-key=logo]');if(li)li.value=j.url;}else{const w=data.wines.find(w=>w.id===input.dataset.upload);if(w){w.image=j.url;const card=input.closest('[data-id]');card.querySelector('[data-key=image]').value=j.url;card.querySelector('img').src=j.url;}}changed();status('圖片已壓縮並更新；儲存後請重新部署')}catch(err){status(err.message||'上傳失敗，請重試',true)}finally{uploads--;$('#save').disabled=uploads>0;input.disabled=false}});
$('#addWine').onclick=()=>{if(data.wines.length>=100){status('最多可新增 100 款酒',true);return}data.wines.push({id:crypto.randomUUID(),name:'新酒款',type:'red',en:'RED WINE',desc:'',taste:'',image:'/wine-editorial.png',active:false});renderWines();changed();$('#wineEditors article:last-child').scrollIntoView({behavior:'smooth',block:'center'})};
$('#wineEditors').onclick=e=>{const del=e.target.closest('[data-delete]');if(del){const w=data.wines.find(x=>x.id===del.dataset.delete);if(!confirm('確定刪除「'+w.name+'」？按儲存後才會更新網站。'))return;data.wines=data.wines.filter(x=>x.id!==w.id);renderWines();changed()}const mv=e.target.closest('[data-move]');if(mv){const i=data.wines.findIndex(x=>x.id===mv.dataset.move),j=i+Number(mv.dataset.dir);if(j>=0&&j<data.wines.length){[data.wines[i],data.wines[j]]=[data.wines[j],data.wines[i]];renderWines();changed()}}};
$('#editor').onsubmit=async e=>{e.preventDefault();if(uploads)return;data.heroImage=data.heroSlides[0].image;data.wines=data.wines.map(w=>({...w,category:w.type,status:w.active?'active':'hidden'}));$('#editor').querySelectorAll('input,textarea,select,button').forEach(el=>el.disabled=true);status('正在儲存…');try{const r=await Promise.resolve({ok:true,json:async()=>({version:1})});const j=await r.json();if(!r.ok)throw Error(j.error);version=j.version;dirty=false;const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='catalog.json';a.click();URL.revokeObjectURL(a.href);status('已下載 catalog.json；請替換網站根目錄檔案並重新部署。')}catch(err){status(err.message||'儲存失敗，請重試',true)}finally{$('#editor').querySelectorAll('input,textarea,select,button').forEach(el=>el.disabled=false)}};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
(async()=>{try{const r=await fetch('/catalog.json');const j=await r.json();if(!r.ok)throw Error(j.error);data=j;data.heroSlides=data.heroSlides?.length?data.heroSlides:[{image:data.heroImage,alt:data.brand+'精選酒款'}];data.wines=data.wines.map((w,i)=>({...w,id:w.id||'product-'+(i+1),type:w.type||w.category||'red',active:w.active??w.status!=='hidden'}));version=j.version;render();$('#editor').hidden=false;$('#loadMessage').hidden=true;$('#status').textContent='本機草稿編輯器：儲存會匯出 catalog.json，請重新部署以套用。'}catch(err){$('#loadMessage').textContent=(err.message||'無法載入')+'，請重新整理或使用管理員帳號登入。'}})();

function renderSlides(){ $('#slideEditors').innerHTML=data.heroSlides.map((slide,i)=>`<article class="wine-editor" data-slide-index="${i}"><h3>圖片 ${i+1}</h3><div class="fields">${field('圖片網址','image',slide.image)}${lfield('圖片說明（替代文字）','alt',slide.alt)}<label class="field">上傳圖片<input type="file" data-upload="slide:${i}" accept="image/jpeg,image/png,image/webp"><small>JPG、PNG 或 WebP，最大 10MB（會自動壓縮）。建議所有圖片使用相同比例。</small></label></div><div class="wine-head"><img src="${esc(slide.image)}" alt="輪播圖片預覽"><div class="buttons"><button type="button" class="outline" data-slide-move="${i}" data-step="-1" ${i===0?'disabled':''}>上移</button><button type="button" class="outline" data-slide-move="${i}" data-step="1" ${i===data.heroSlides.length-1?'disabled':''}>下移</button><button type="button" class="danger" data-slide-delete="${i}" ${data.heroSlides.length===1?'disabled':''}>刪除</button></div></div></article>`).join('');}
$('#addSlide').onclick=()=>{if(uploads)return;if(data.heroSlides.length>=12){status('最多可新增 12 張輪播圖片',true);return}data.heroSlides.push({image:data.heroImage,alt:''});renderSlides();changed();$('#slideEditors article:last-child').scrollIntoView({behavior:'smooth',block:'center'})};
$('#slideEditors').onclick=e=>{if(uploads)return;const del=e.target.closest('[data-slide-delete]'),mv=e.target.closest('[data-slide-move]');if(del&&data.heroSlides.length>1){if(!confirm('移除這張輪播圖片？儲存後才會更新網站。'))return;data.heroSlides.splice(Number(del.dataset.slideDelete),1);renderSlides();changed()}if(mv){const i=Number(mv.dataset.slideMove),j=i+Number(mv.dataset.step);if(j>=0&&j<data.heroSlides.length){[data.heroSlides[i],data.heroSlides[j]]=[data.heroSlides[j],data.heroSlides[i]];renderSlides();changed()}}};
