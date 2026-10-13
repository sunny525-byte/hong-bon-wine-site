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

function status(t,error=false){$('#status').textContent=t;$('#status').classList.toggle('error',error)}function changed(){dirty=true;status('有未儲存的修改')}function render(){ $('#settings').innerHTML=lfield('品牌名稱','brand',data.brand)+lfield('英文名稱','english',data.english)+field('Logo 圖片網址','logo',data.logo)+'<label class="field">上傳 Logo 圖片<input type="file" data-upload="logo" accept="image/jpeg,image/png,image/webp"><small>JPG、PNG 或 WebP，最大 10MB（會自動壓縮）。建議使用透明背景 PNG。</small></label>'+lfield('首頁標題','headline',data.headline)+lfield('首頁介紹','intro',data.intro,true);$('#lineSettings').innerHTML=field('官方 LINE ID（包含 @）','lineId',data.lineId)+field('加好友連結','lineUrl',data.lineUrl)+field('Instagram 網址','social.instagram',(data.social||{}).instagram||'')+field('Facebook 網址','social.facebook',(data.social||{}).facebook||'');renderWines();renderRegions();renderWineries();renderSlides();renderUi();}
function renderWines(){ $('#wineEditors').innerHTML=data.wines.map((w,i)=>`<article class="wine-editor" data-id="${w.id}"><div class="wine-head"><h3>酒款 ${i+1}</h3><label class="check"><input type="checkbox" data-key="active" ${w.active?'checked':''}>上架</label></div><div class="fields">${lfield('酒款名稱','name',w.name)}<label class="field">分類<select data-key="type">${[['red','紅酒'],['white','白酒'],['rose','粉紅酒'],['sparkling','氣泡酒']].map(([k,v])=>`<option value="${k}" ${w.type===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="field">產區<select data-key="region">${optionList('region',w.region)}</select></label><label class="field">酒莊<select data-key="winery">${optionList('winery',w.winery)}</select></label>${lfield('英文風格標籤','en',w.en)}${lfield('風味與搭配','taste',w.taste)}${lfield('酒款介紹','desc',w.desc,true)}${field('商品圖片網址','image',w.image)+field('網址代稱 slug（更改會改變此酒款的網址）','slug',w.slug||'')}<label class="field">上傳商品照片<input type="file" data-upload="${w.id}" accept="image/jpeg,image/png,image/webp"><small>JPG、PNG 或 WebP，最大 10MB（會自動壓縮）</small></label></div><div class="wine-head"><img src="${esc(w.image)}" alt="酒款圖片預覽"><div class="buttons"><button type="button" class="outline" data-move="${w.id}" data-dir="-1" ${i===0?'disabled':''}>上移</button><button type="button" class="outline" data-move="${w.id}" data-dir="1" ${i===data.wines.length-1?'disabled':''}>下移</button><button type="button" class="danger" data-delete="${w.id}">刪除</button></div></div></article>`).join('')||'<p>目前沒有酒款，按「新增酒款」開始。</p>';}
$('#editor').addEventListener('input',e=>{const k=e.target.dataset.key;if(k){let card=e.target.closest('[data-id]'),slide=e.target.closest('[data-slide-index]'),rg=e.target.closest('[data-region]'),wg=e.target.closest('[data-winery]');let obj=slide?data.heroSlides[Number(slide.dataset.slideIndex)]:rg?(data.regions||[]).find(x=>x.slug===rg.dataset.region):wg?(data.wineries||[]).find(x=>x.slug===wg.dataset.winery):card?data.wines.find(w=>w.id===card.dataset.id):data;var v=e.target.type==='checkbox'?e.target.checked:e.target.value;if(k.indexOf('.')>-1){var parts=k.split('.');var t=obj;for(var i=0;i<parts.length-1;i++){var pk=parts[i];if(typeof t[pk]!=='object'||t[pk]===null)t[pk]={};t=t[pk];}t[parts[parts.length-1]]=v;}else obj[k]=v;changed();}});
function compressImage(file,maxDim=1200,quality=.82){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{URL.revokeObjectURL(url);const scale=Math.min(1,maxDim/Math.max(img.width,img.height));const w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);let out=c.toDataURL('image/webp',quality);if(!out.startsWith('data:image/webp'))out=c.toDataURL('image/jpeg',quality);resolve(out)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('無法讀取圖片'))};img.src=url})}$('#editor').addEventListener('change',async e=>{if(!e.target.dataset.upload)return;const input=e.target,f=input.files[0];if(!f)return;if(f.size>10*1024*1024){status('圖片不可超過 10MB（會自動壓縮）',true);return}uploads++;$('#save').disabled=true;input.disabled=true;status('正在壓縮圖片…');try{const j={url:await compressImage(f)};if(input.dataset.upload.startsWith('slide:')){const slide=data.heroSlides[Number(input.dataset.upload.split(':')[1])];if(slide){slide.image=j.url;renderSlides();}}else if(input.dataset.upload==='logo'){data.logo=j.url;const li=$('#settings [data-key=logo]');if(li)li.value=j.url;}else if(input.dataset.upload.startsWith('body:')){const p=input.dataset.upload.split(':'),o=(p[1]==='region'?(data.regions||[]):(data.wineries||[]))[+p[2]],b=o&&(o.body||[])[+p[3]];if(b){b.src=j.url;refreshPeople();}}else if(input.dataset.upload.startsWith('winery:')){const w=(data.wineries||[]).find(x=>x.slug===input.dataset.upload.slice(7));if(w){w.image=j.url;refreshPeople();}}else{const w=data.wines.find(w=>w.id===input.dataset.upload);if(w){w.image=j.url;const card=input.closest('[data-id]');card.querySelector('[data-key=image]').value=j.url;card.querySelector('img').src=j.url;}}changed();status('圖片已壓縮並更新；儲存後請重新部署')}catch(err){status(err.message||'上傳失敗，請重試',true)}finally{uploads--;$('#save').disabled=uploads>0;input.disabled=false}});
$('#addWine').onclick=()=>{if(data.wines.length>=100){status('最多可新增 100 款酒',true);return}data.wines.push({id:crypto.randomUUID(),name:'新酒款',type:'red',en:'RED WINE',desc:'',taste:'',image:'/assets/placeholder.svg',active:true});renderWines();changed();$('#wineEditors article:last-child').scrollIntoView({behavior:'smooth',block:'center'})};
$('#wineEditors').onclick=e=>{const del=e.target.closest('[data-delete]');if(del){const w=data.wines.find(x=>x.id===del.dataset.delete);if(!confirm('確定刪除「'+w.name+'」？按儲存後才會更新網站。'))return;data.wines=data.wines.filter(x=>x.id!==w.id);renderWines();changed()}const mv=e.target.closest('[data-move]');if(mv){const i=data.wines.findIndex(x=>x.id===mv.dataset.move),j=i+Number(mv.dataset.dir);if(j>=0&&j<data.wines.length){[data.wines[i],data.wines[j]]=[data.wines[j],data.wines[i]];renderWines();changed()}}};
// ---------------------------------------------------------------- publishing
// The editor is a static page, so it cannot write to the site itself. Publishing posts
// the catalogue to /api/publish, which commits it to the repository Netlify builds
// from — one click, and it reaches production by the same path as any other change.
// The GitHub credential lives only in Netlify's environment, never in the browser.
let baseSha=null,publishReady=false,publishDryRun=false,publishing=false;

function publishNote(html,error){const el=$('#publishInfo');if(!el)return;el.innerHTML=html;el.classList.toggle('error',!!error)}

function downloadCatalogue(){
  const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='catalog.json';a.click();URL.revokeObjectURL(a.href);
}

async function loadPublishStatus(){
  try{
    const r=await fetch('/api/publish');
    const j=await r.json().catch(()=>({}));
    if(r.status===401){publishReady=false;publishNote('發佈需要管理員登入（請重新整理並登入）。',true);return false}
    if(!r.ok)throw Error(j.error||('HTTP '+r.status));
    baseSha=j.sha||null;publishReady=!!j.configured;publishDryRun=!!j.dryRun;
    if(!publishReady){publishNote('尚未設定發佈功能：Netlify 需要 GITHUB_TOKEN 與 GITHUB_REPO 環境變數，目前只能下載備份。',true);return false}
    const withDate=j.lastCommit&&j.lastCommit.date;
    publishNote((publishDryRun?'<strong>測試模式</strong>：按發佈只會驗證，不會更新網站。':'')
      +'上次發佈：'+esc(withDate?new Date(withDate).toLocaleString():'尚無紀錄')
      +(j.lastCommit&&j.lastCommit.sha?' · '+esc(j.lastCommit.sha.slice(0,7)):''));
    return true;
  }catch(err){
    publishReady=false;
    publishNote('發佈功能尚未上線（'+esc(err.message||'無法連線')+'），目前只能下載備份。',true);
    return false;
  }
}

$('#editor').onsubmit=async e=>{e.preventDefault();if(uploads||publishing)return;if(!publishReady){downloadCatalogue();status('尚未設定發佈功能，已改為下載 catalog.json 備份。',true);return}if(!confirm(publishDryRun?'【測試模式】只會驗證內容，不會更新網站。確定繼續？':'確定要發佈到網站嗎？約一分鐘後生效，並會留下一筆紀錄（可還原）。'))return;publishing=true;const btn=$('#save'),label=btn.textContent;btn.disabled=true;btn.textContent='發佈中…';status('正在發佈…');try{data.heroImage=data.heroSlides[0].image;data.wines=data.wines.map(w=>({...w,category:w.type,status:w.active?'active':'hidden'}));const r=await fetch('/api/publish',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({catalogue:data,baseSha})});const j=await r.json().catch(()=>({}));if(r.status===401)throw Error('登入已逾時，請重新整理本頁並登入後再發佈。');if(r.status===409)throw Error('網站已被其他人更新。為免覆蓋對方的修改，請重新整理本頁後再發佈。');if(!r.ok)throw Error(j.error||('發佈失敗（HTTP '+r.status+'）'));if(j.dryRun){status('測試模式：內容通過驗證，未寫入任何內容。'+(j.uploadedImages&&j.uploadedImages.length?'（會新增 '+j.uploadedImages.length+' 張圖片）':''));return}if(j.catalogue){data=j.catalogue;render()}baseSha=j.sha||null;dirty=false;const n=j.uploadedImages?j.uploadedImages.length:0;status('已發佈！網站正在重新建置，約一分鐘後生效。'+(n?'（新增 '+n+' 張圖片）':''));publishNote('已發佈 '+esc(new Date().toLocaleString())+(j.url?' · <a href="'+esc(j.url)+'" target="_blank" rel="noopener">檢視紀錄</a>':''));}catch(err){status(err.message||'發佈失敗，請重試',true)}finally{publishing=false;btn.disabled=false;btn.textContent=label}};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
(async()=>{try{const r=await fetch('/catalog.json');const j=await r.json();if(!r.ok)throw Error(j.error);data=j;data.heroSlides=data.heroSlides?.length?data.heroSlides:[{image:data.heroImage,alt:data.brand+'精選酒款'}];data.wines=data.wines.map((w,i)=>({...w,id:w.id||'product-'+(i+1),type:w.type||w.category||'red',active:w.active??w.status!=='hidden'}));data.regions=(data.regions||[]).map(r=>({...r,body:Array.isArray(r.body)?r.body:[]}));data.wineries=(data.wineries||[]).map(w=>({...w,body:Array.isArray(w.body)?w.body:[]}));version=j.version;render();$('#editor').hidden=false;$('#loadMessage').hidden=true;$('#status').textContent='';await loadPublishStatus()}catch(err){$('#loadMessage').textContent=(err.message||'無法載入')+'，請重新整理或使用管理員帳號登入。'}})();

function renderSlides(){ $('#slideEditors').innerHTML=data.heroSlides.map((slide,i)=>`<article class="wine-editor" data-slide-index="${i}"><h3>圖片 ${i+1}</h3><div class="fields">${field('圖片網址','image',slide.image)}${lfield('圖片說明（替代文字）','alt',slide.alt)}<label class="field">上傳圖片<input type="file" data-upload="slide:${i}" accept="image/jpeg,image/png,image/webp"><small>JPG、PNG 或 WebP，最大 10MB（會自動壓縮）。建議所有圖片使用相同比例。</small></label></div><div class="wine-head"><img src="${esc(slide.image)}" alt="輪播圖片預覽"><div class="buttons"><button type="button" class="outline" data-slide-move="${i}" data-step="-1" ${i===0?'disabled':''}>上移</button><button type="button" class="outline" data-slide-move="${i}" data-step="1" ${i===data.heroSlides.length-1?'disabled':''}>下移</button><button type="button" class="danger" data-slide-delete="${i}" ${data.heroSlides.length===1?'disabled':''}>刪除</button></div></div></article>`).join('');}
$('#addSlide').onclick=()=>{if(uploads)return;if(data.heroSlides.length>=12){status('最多可新增 12 張輪播圖片',true);return}data.heroSlides.push({image:data.heroImage,alt:''});renderSlides();changed();$('#slideEditors article:last-child').scrollIntoView({behavior:'smooth',block:'center'})};
$('#downloadBackup').onclick=()=>{downloadCatalogue();status('已下載 catalog.json 備份。')};
$('#slideEditors').onclick=e=>{if(uploads)return;const del=e.target.closest('[data-slide-delete]'),mv=e.target.closest('[data-slide-move]');if(del&&data.heroSlides.length>1){if(!confirm('移除這張輪播圖片？儲存後才會更新網站。'))return;data.heroSlides.splice(Number(del.dataset.slideDelete),1);renderSlides();changed()}if(mv){const i=Number(mv.dataset.slideMove),j=i+Number(mv.dataset.step);if(j>=0&&j<data.heroSlides.length){[data.heroSlides[i],data.heroSlides[j]]=[data.heroSlides[j],data.heroSlides[i]];renderSlides();changed()}}};

// ---------------------------------------------------------------- regions & wineries
// Names are bilingual objects; this editor is Chinese-only, so a name falls back
// to the slug until the client fills the Chinese one in.
function optionList(kind,current){
  var list=kind==='region'?(data.regions||[]):(data.wineries||[]);
  return '<option value="">— 未指定 —</option>'+list.map(function(o){
    return '<option value="'+esc(o.slug)+'"'+(current===o.slug?' selected':'')+'>'+esc((o.name||{}).zh||o.slug)+'</option>';
  }).join('');
}
function draftRow(flag,key){
  return '<label class="check"><input type="checkbox" data-key="'+key+'"'+(flag?' checked':'')+'>草稿（文案尚未校對）</label>';
}
function bodyBlock(kind,i,bi,b){
  var pre='body.'+bi+'.';
  var bar='<div class="wine-head"><strong class="small">'+(b.type==='image'?'圖片 ':'文字 ')+(bi+1)+'</strong><div class="buttons">'
    +'<button type="button" class="outline" data-body-move="'+kind+':'+i+':'+bi+':-1"'+(bi===0?' disabled':'')+'>上移</button>'
    +'<button type="button" class="outline" data-body-move="'+kind+':'+i+':'+bi+':1">下移</button>'
    +'<button type="button" class="danger" data-body-delete="'+kind+':'+i+':'+bi+'">刪除</button></div></div>';
  var fields=b.type==='image'
    ? field('圖片網址',pre+'src',b.src||'')+lfield('圖片說明',pre+'caption',b.caption)
      +'<label class="field">上傳區塊圖片<input type="file" data-upload="body:'+kind+':'+i+':'+bi+'" accept="image/jpeg,image/png,image/webp"><small>JPG、PNG 或 WebP，最大 10MB（會自動壓縮）</small></label>'
    : lfield('段落文字',pre+'value',b.value,true);
  var shot=b.src?'<img src="'+esc(b.src)+'" alt="區塊圖片預覽">':'<span class="small">尚未上傳圖片</span>';
  return '<div class="body-block">'+bar+'<div class="fields">'+fields+'</div><div class="wine-head">'+shot+'</div></div>';
}
function bodyEditor(kind,i,owner){
  var blocks=Array.isArray(owner.body)?owner.body:[];
  return '<div class="body-blocks"><div class="wine-head"><strong class="small">頁面內容區塊（文字段落與圖片，會依序顯示在頁首之後）</strong><div class="buttons">'
    +'<button type="button" class="outline" data-body-add="'+kind+':'+i+'" data-kind="text">＋ 文字段落</button>'
    +'<button type="button" class="outline" data-body-add="'+kind+':'+i+'" data-kind="image">＋ 圖片</button></div></div>'
    +(blocks.map(function(b,bi){return bodyBlock(kind,i,bi,b)}).join('')||'<p class="small">尚未新增內容區塊。</p>')
    +'</div>';
}
function renderRegions(){
  var box=document.getElementById('regionEditors'); if(!box)return;
  box.innerHTML=(data.regions||[]).map(function(r,i){
    return '<article class="wine-editor" data-region="'+esc(r.slug)+'"><div class="wine-head"><h3>產區 '+(i+1)+'</h3>'+draftRow(r.introDraft,'introDraft')+'</div>'
      +'<div class="fields">'+lfield('產區名稱','name',r.name)+field('國家／地區（英文）','country',r.country)
      +field('網址代稱 slug（更改會改變網址，請一併檢查酒款對應）','slug',r.slug)
      +lfield('產區簡介（顯示在頁首）','intro',r.intro,true)+'</div>'
      +bodyEditor('region',i,r)
      +'<div class="wine-head"><span></span><div class="buttons"><button type="button" class="danger" data-region-delete="'+esc(r.slug)+'">刪除產區</button></div></div></article>';
  }).join('')||'<p>目前沒有產區，按「新增產區」開始。</p>';
}
function renderWineries(){
  var box=document.getElementById('wineryEditors'); if(!box)return;
  box.innerHTML=(data.wineries||[]).map(function(w,i){
    var n=data.wines.filter(function(x){return x.winery===w.slug}).length;
    return '<article class="wine-editor" data-winery="'+esc(w.slug)+'"><div class="wine-head"><h3>酒莊 '+(i+1)+'（'+n+' 款酒）</h3>'+draftRow(w.storyDraft,'storyDraft')+'</div>'
      +'<div class="fields">'+lfield('酒莊名稱','name',w.name)
      +'<label class="field">所屬產區<select data-key="region">'+optionList('region',w.region)+'</select></label>'
      +field('國家／地區（英文）','country',w.country)
      +field('網址代稱 slug（更改會改變網址，請一併檢查酒款對應）','slug',w.slug)
      +field('酒莊網站','website',w.website)
      +lfield('酒莊故事（顯示在頁首）','story',w.story,true)
      +field('主要圖片網址','image',w.image)
      +'<label class="field">上傳主要圖片<input type="file" data-upload="winery:'+esc(w.slug)+'" accept="image/jpeg,image/png,image/webp"><small>JPG、PNG 或 WebP，最大 10MB（會自動壓縮）</small></label></div>'
      +(w.image?'<div class="wine-head"><img src="'+esc(w.image)+'" alt="酒莊圖片預覽"></div>':'')
      +bodyEditor('winery',i,w)
      +'<div class="wine-head"><span></span><div class="buttons"><button type="button" class="danger" data-winery-delete="'+esc(w.slug)+'">刪除酒莊</button></div></div></article>';
  }).join('')||'<p>目前沒有酒莊，按「新增酒莊」開始。</p>';
}
function refreshPeople(){renderRegions();renderWineries();}
function personList(kind){return kind==='region'?(data.regions||[]):(data.wineries||[]);}
function bodyOwner(kind,i){return personList(kind)[i];}
function bodyEvent(e){
  var add=e.target.closest('[data-body-add]'),del=e.target.closest('[data-body-delete]'),mv=e.target.closest('[data-body-move]'),p,owner;
  if(!add&&!del&&!mv)return;
  if(add){
    p=add.dataset.bodyAdd.split(':');owner=bodyOwner(p[0],+p[1]);if(!owner)return;
    if(!Array.isArray(owner.body))owner.body=[];
    owner.body.push(add.dataset.kind==='image'?{type:'image',src:'',caption:{zh:'',en:''}}:{type:'text',value:{zh:'',en:''}});
  }else if(del){
    p=del.dataset.bodyDelete.split(':');owner=bodyOwner(p[0],+p[1]);if(!owner)return;
    if(!confirm('刪除這個內容區塊？儲存後才會更新網站。'))return;
    owner.body.splice(+p[2],1);
  }else{
    p=mv.dataset.bodyMove.split(':');owner=bodyOwner(p[0],+p[1]);if(!owner)return;
    var bi=+p[2],j=bi+Number(p[3]);
    if(j<0||j>=owner.body.length)return;
    var tmp=owner.body[bi];owner.body[bi]=owner.body[j];owner.body[j]=tmp;
  }
  refreshPeople();changed();
}
function unlinkWines(key,slug){data.wines.forEach(function(w){if(w[key]===slug)w[key]=''})}
function newSlug(base,list){var n=1;while(list.some(function(o){return o.slug===base+'-'+n}))n++;return base+'-'+n;}
function dropPerson(kind,slug){
  var list=personList(kind),i=list.findIndex(function(o){return o.slug===slug});
  if(i<0)return;
  var n=data.wines.filter(function(w){return w[kind]===slug}).length;
  var label=(kind==='region'?'產區':'酒莊');
  if(!confirm('刪除這個'+label+'？'+(n?'目前有 '+n+' 款酒屬於它，會一併取消指定。':'')+'儲存後才會更新網站。'))return;
  unlinkWines(kind,slug);list.splice(i,1);refreshPeople();renderWines();changed();
}
$('#regionEditors').onclick=bodyEvent;
$('#wineryEditors').onclick=bodyEvent;
$('#addRegion').onclick=function(){
  if(uploads)return;
  data.regions=data.regions||[];
  data.regions.push({slug:newSlug('region',data.regions),country:'',name:{zh:'新產區',en:''},intro:{zh:'',en:''},body:[],introDraft:true});
  refreshPeople();renderWines();changed();
};
$('#addWinery').onclick=function(){
  if(uploads)return;
  data.wineries=data.wineries||[];
  data.wineries.push({slug:newSlug('winery',data.wineries),region:'',country:'',name:{zh:'新酒莊',en:''},website:'',story:{zh:'',en:''},image:'',body:[],storyDraft:true});
  refreshPeople();renderWines();changed();
};
document.getElementById('editor').addEventListener('click',function(e){
  var rd=e.target.closest('[data-region-delete]'),wd=e.target.closest('[data-winery-delete]');
  if(rd)dropPerson('region',rd.dataset.regionDelete);
  if(wd)dropPerson('winery',wd.dataset.wineryDelete);
});
