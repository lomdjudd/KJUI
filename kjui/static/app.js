"use strict";
const $=s=>document.querySelector(s);
// replaceChildren ignore désormais les valeurs vides (sinon « null » s'affiche)
const _rc=Element.prototype.replaceChildren;Element.prototype.replaceChildren=function(...k){return _rc.apply(this,k.flat().filter(x=>x!=null&&x!==false))};
const KC={memory:[0,150,230],instruction:[255,150,30],conversation:[140,90,240],file:[30,190,120],image:[240,80,140]};
const KN={memory:'souvenir',instruction:'instruction',conversation:'message',file:'fichier',image:'image'};
const rgb=(c,a=1)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;
const fmt=n=>Number(n||0).toLocaleString('fr-FR');
function el(tag,attrs={},...kids){const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(v==null||v===false)continue;
  if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else e.setAttribute(k,v)}
  for(const c of kids.flat())if(c!=null&&c!==false)e.append(c);return e}
const EXTC={html:'#e8590c',htm:'#e8590c',css:'#1c7ed6',js:'#e0a800',ts:'#3178c6',tsx:'#3178c6',jsx:'#e0a800',json:'#6b7690',py:'#3572a5',apk:'#2f9e44',
  png:'#d6336c',jpg:'#d6336c',jpeg:'#d6336c',gif:'#d6336c',webp:'#d6336c',pdf:'#e03131',zip:'#7048e8',md:'#495057',txt:'#868e96',csv:'#1e8e5a',sh:'#343a40',yml:'#a63b8f',yaml:'#a63b8f'};
const extOf=b=>(b||'').split('.').pop().toLowerCase();
const extBadge=(ext,big)=>el('div',{class:'ext',style:`background:linear-gradient(160deg,${EXTC[ext]||'#6b7690'}dd,${EXTC[ext]||'#6b7690'})`},ext.slice(0,4)||'file');
const TEXTEXT=new Set(['html','htm','css','js','ts','tsx','jsx','json','py','md','txt','csv','sh','yml','yaml','xml','sql','java','c','h','cpp','cs','go','rs','rb','php','log','ini','cfg','toml','bat']);
const fmtSize=b=>b>1e6?(b/1e6).toFixed(1)+' Mo':b>1e3?Math.round(b/1e3)+' Ko':(b||0)+' o';
const clock=ts=>new Date(ts*1000).toLocaleTimeString('fr-FR');
function ago(ts){const s=Math.max(0,Date.now()/1000-ts);if(s<8)return"à l'instant";if(s<60)return`il y a ${Math.round(s)} s`;if(s<3600)return`il y a ${Math.round(s/60)} min`;
  if(s<86400)return`il y a ${Math.round(s/3600)} h`;return new Date(ts*1000).toLocaleDateString('fr-FR')}
const fileName=m=>{const s=(m.source||'');const p=s.includes(' · ')?s.split(' · ').pop():m.title;return(p.split(/[\\/]/).pop()||m.title).replace(/ \(\d+\)$/,'')};
const cleanQ=t=>(t||'').replace(/^(Toi|Claude) : /,'');

/* ---------- géométrie du cerveau (déterministe : les N premiers points ne changent jamais) ---------- */
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function dir(r){let x,y,z,l;do{x=r()*2-1;y=r()*2-1;z=r()*2-1;l=x*x+y*y+z*z}while(l>1||l<.05);l=Math.sqrt(l);return[x/l,y/l,z/l]}
const gyri=(x,y,z)=>Math.sin(x*9+Math.sin(z*7))*.5+Math.sin(y*8+z*6+x*3)*.3+Math.sin(z*11-x*5)*.2;
function samplePoint(r){
  const t=r();
  if(t<.10){const d=dir(r),s=r()<.8?1:.6+.4*r(),w=1+.06*Math.sin(d[1]*34);
    return[d[0]*.27*s*w,-.37+d[1]*.15*s*w,-.52+d[2]*.17*s*w]}
  if(t<.16){const a=r()*6.283,q=r(),rad=.055*(r()<.8?1:r());
    return[Math.cos(a)*rad,-.3-q*.42,-.3-q*.14+Math.sin(a)*rad]}
  for(;;){
    const side=r()<.5?-1:1,d=dir(r),sh=r()<.8?1:.5+.45*r(),g=1+.075*gyri(d[0],d[1],d[2]);
    let x=side*.2+d[0]*.37*sh*g,y=.06+d[1]*.42*sh*g,z=.02+d[2]*.64*sh*g;
    if(y<-.13)y=-.13+(y+.13)*.5;
    if(x*side<.018)continue;
    return[x,y,z];
  }
}
let pos=new Float32Array(0),S=0;
function ensureSlots(n){
  if(n<=S)return;const N=Math.max(n,4200),r=mulberry(7),p=new Float32Array(N*3);
  for(let i=0;i<N;i++){const v=samplePoint(r);p[i*3]=v[0];p[i*3+1]=v[1];p[i*3+2]=v[2]}
  pos=p;S=N;buildMesh();
}

/* ---------- état ---------- */
let nodes=[],slotOf=new Map(),nextSlot=0,used=new Uint8Array(0),edges=[],mesh=[];
let byId=new Map(),version='',active=new Map(),beams=[],pulses=[],rings=[];
let hover=null,selected=null;
const now=()=>performance.now()/1000;

function buildMesh(){
  const r=mulberry(99),cell=.075,g=new Map();mesh=[];
  for(let i=0;i<S;i++){const k=Math.floor(pos[i*3]/cell)+','+Math.floor(pos[i*3+1]/cell)+','+Math.floor(pos[i*3+2]/cell);(g.get(k)||g.set(k,[]).get(k)).push(i)}
  for(const arr of g.values()){if(arr.length<2||r()>.5)continue;const a=arr[0|r()*arr.length],b=arr[0|r()*arr.length];if(a!==b)mesh.push([a,b])}
}
function buildEdges(){
  used=new Uint8Array(S);edges=[];const cell=.2,g=new Map(),list=[];
  for(const n of nodes){const s=slotOf.get(n.id);used[s]=1;list.push([n,s]);
    const k=Math.floor(pos[s*3]/cell)+','+Math.floor(pos[s*3+1]/cell)+','+Math.floor(pos[s*3+2]/cell);(g.get(k)||g.set(k,[]).get(k)).push(s)}
  const seen=new Set();
  for(const [n,s] of list){
    const cx=Math.floor(pos[s*3]/cell),cy=Math.floor(pos[s*3+1]/cell),cz=Math.floor(pos[s*3+2]/cell),c=[];
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){const a=g.get((cx+x)+','+(cy+y)+','+(cz+z));if(a)for(const o of a)if(o!==s)c.push(o)}
    const d=o=>{const dx=pos[o*3]-pos[s*3],dy=pos[o*3+1]-pos[s*3+1],dz=pos[o*3+2]-pos[s*3+2];return dx*dx+dy*dy+dz*dz};
    c.sort((a,b)=>d(a)-d(b));
    for(const o of c.slice(0,2)){const k=s<o?s+'-'+o:o+'-'+s;if(!seen.has(k)&&d(o)<.05){seen.add(k);edges.push([s,o])}}
    if(edges.length>5000)break;
  }
}

function setGraph(data,animate){
  const fresh=[];
  for(const n of data.nodes){
    if(!slotOf.has(n.id)){slotOf.set(n.id,nextSlot++);if(animate)fresh.push(n.id)}
  }
  ensureSlots(nextSlot+3000);
  const old=byId;byId=new Map();
  nodes=data.nodes;for(const n of nodes){const o=old.get(n.id);n.birth=o?o.birth:(animate?now():-9);byId.set(n.id,n)}
  buildEdges();updateStats(data.stats);version=data.stats.version;
  onGraphChanged();
  for(const id of fresh){const n=byId.get(id);rings.push({slot:slotOf.get(id),t:now(),col:KC[n.kind]||KC.memory});}
}

/* ---------- rendu ---------- */
const cv=$('#c'),ctx=cv.getContext('2d');let W=0,H=0,DPR=1;
function resize(){DPR=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;cv.width=W*DPR;cv.height=H*DPR}
addEventListener('resize',resize);resize();
const beads={},glows={};
function bead(c){const k=c.join();if(beads[k])return beads[k];
  const o=document.createElement('canvas');o.width=o.height=128;const x=o.getContext('2d');
  let g=x.createRadialGradient(64,88,4,64,88,42);g.addColorStop(0,'rgba(40,60,100,.30)');g.addColorStop(1,'rgba(40,60,100,0)');
  x.fillStyle=g;x.fillRect(0,0,128,128);
  const lt=c.map(v=>Math.min(255,v+95)),dk=c.map(v=>Math.round(v*.6));
  g=x.createRadialGradient(50,44,3,64,64,40);
  g.addColorStop(0,'rgba(255,255,255,.96)');g.addColorStop(.22,rgb(lt,.93));g.addColorStop(.68,rgb(c,.93));g.addColorStop(1,rgb(dk,.96));
  x.fillStyle=g;x.beginPath();x.arc(64,64,40,0,6.283);x.fill();
  x.strokeStyle='rgba(255,255,255,.8)';x.lineWidth=2.5;x.beginPath();x.arc(64,64,37.5,Math.PI*1.05,Math.PI*1.6);x.stroke();
  x.strokeStyle=rgb(lt,.55);x.lineWidth=2;x.beginPath();x.arc(64,64,37.5,Math.PI*.1,Math.PI*.55);x.stroke();
  x.fillStyle='rgba(255,255,255,.9)';x.beginPath();x.ellipse(50,45,11,6,-.6,0,6.283);x.fill();
  return beads[k]=o}
function glow(c){const k=c.join();if(glows[k])return glows[k];const o=document.createElement('canvas');o.width=o.height=64;const x=o.getContext('2d');
  const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,rgb(c,.75));g.addColorStop(.35,rgb(c,.28));g.addColorStop(1,rgb(c,0));
  x.fillStyle=g;x.fillRect(0,0,64,64);return glows[k]=o}
let yaw=.6,pitch=.12,zoom=1,vyaw=.0018,drag=null,lastInteract=0;
let PX=new Float32Array(0),PY=new Float32Array(0),PZ=new Float32Array(0),PS=new Float32Array(0);
function project(t){
  if(PX.length<S){PX=new Float32Array(S);PY=new Float32Array(S);PZ=new Float32Array(S);PS=new Float32Array(S)}
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const L=layout(),cx=L.cx,cyy=L.cy,sc=L.sc*zoom*(1+.012*Math.sin(t*1.3));
  for(let i=0;i<S;i++){
    const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2];
    const x1=x*cy-z*sy,z1=x*sy+z*cy,y2=y*cp-z1*sp,z2=y*sp+z1*cp;
    const s=3.2/(3.2-z2);PX[i]=cx+x1*s*sc;PY[i]=cyy-y2*s*sc;PZ[i]=z2;PS[i]=s;
  }
}
function drawLines(list,style,w){
  ctx.strokeStyle=style;ctx.lineWidth=w;ctx.beginPath();
  for(const [a,b] of list){ctx.moveTo(PX[a],PY[a]);ctx.lineTo(PX[b],PY[b])}ctx.stroke();
}
function frame(){
  const t=now();
  if(!drag&&t-lastInteract>2.5)yaw+=vyaw;
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,W,H);
  if(!S){requestAnimationFrame(frame);return}
  project(t);
  for(const [id,ex] of active)if(ex<t)active.delete(id);
  const focusOn=active.size>0;
  drawLines(mesh,`rgba(80,110,170,${focusOn?.05:.09})`,.6);
  const wave=Math.sin(t*.5)*.75;const bk=[[],[],[],[],[]];
  for(let i=0;i<S;i++){if(used[i])continue;const z=PZ[i];
    let b=z<-.35?0:z<0?1:z<.35?2:3;if(Math.abs(z-wave)<.045)b=4;bk[b].push(i)}
  const alpha=[.2,.32,.48,.68,.95],size=[1.2,1.5,1.9,2.3,2.8],col=['110,135,185','95,120,175','80,105,165','65,90,155','10,120,255'];
  for(let b=0;b<5;b++){ctx.fillStyle=`rgba(${col[b]},${alpha[b]*(focusOn?.5:1)})`;ctx.beginPath();
    for(const i of bk[b]){const s=size[b]*PS[i];ctx.rect(PX[i]-s/2,PY[i]-s/2,s,s)}ctx.fill()}
  drawLines(edges,`rgba(60,110,190,${focusOn?.14:.26})`,.9);
  if(pulses.length<90&&edges.length&&Math.random()<.55){const e=edges[0|Math.random()*edges.length];
    const n=nodeAtSlot(e[0]);pulses.push({e,t:0,v:.5+Math.random()*.9,c:n?KC[n.kind]:KC.memory})}
  for(let i=pulses.length-1;i>=0;i--){const p=pulses[i];p.t+=p.v/60;if(p.t>=1){pulses.splice(i,1);continue}
    const a=p.e[0],b=p.e[1],x=PX[a]+(PX[b]-PX[a])*p.t,y=PY[a]+(PY[b]-PY[a])*p.t,r=8*PS[a];
    ctx.globalAlpha=Math.sin(p.t*Math.PI);ctx.drawImage(glow(p.c),x-r,y-r,r*2,r*2)}
  ctx.globalAlpha=1;
  for(let i=beams.length-1;i>=0;i--){const b=beams[i],age=t-b.t0;if(age>4){beams.splice(i,1);continue}
    const k=Math.min(1,age/.7),a=b.a,c=b.b,x=PX[a]+(PX[c]-PX[a])*k,y=PY[a]+(PY[c]-PY[a])*k;
    const fade=age<2.5?1:Math.max(0,1-(age-2.5)/1.5);
    const g=ctx.createLinearGradient(PX[a],PY[a],x,y);g.addColorStop(0,'rgba(255,170,20,0)');g.addColorStop(1,`rgba(255,160,10,${.9*fade})`);
    ctx.strokeStyle=g;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(PX[a],PY[a]);ctx.lineTo(x,y);ctx.stroke()}
  const heavy=nodes.length>2500,order=nodes.map(n=>[n,slotOf.get(n.id)]);
  if(!heavy)order.sort((p,q)=>PZ[p[1]]-PZ[q[1]]);
  const recent=nodes.length?nodes[Math.max(0,nodes.length-1200)].id:0;
  const GOLD=[255,176,20];
  for(const [n,s] of order){
    if(heavy&&n.id<recent&&!active.has(n.id)&&selected!==n.id&&hover!==n.id){const c=KC[n.kind]||KC.memory,z=Math.max(1.8,2.6*PS[s]);
      ctx.fillStyle=rgb(c,focusOn?.25:.8);ctx.fillRect(PX[s]-z/2,PY[s]-z/2,z,z);continue}
    const col=KC[n.kind]||KC.memory,act=active.get(n.id),isSel=selected===n.id,isHov=hover===n.id;
    const depth=.6+.4*((PZ[s]+.75)/1.5);
    let base=(3.2+Math.min(3,Math.log1p(n.hits)*.9)+(n.pinned?1.6:0))*PS[s];
    const age=t-n.birth;if(age<1.2)base*=1+2.2*Math.exp(-age*3.2)*Math.cos(age*8);
    const al=focusOn?(act?1:.3):depth;
    const r=base*(1+.12*Math.sin(t*2.2+s))*(act?1.45+.2*Math.sin(t*6):1)*(isHov||isSel?1.45:1);
    if(act){const G=r*7;ctx.globalAlpha=.55;ctx.drawImage(glow(GOLD),PX[s]-G,PY[s]-G,G*2,G*2)}
    const Hh=r*2.7;ctx.globalAlpha=Math.min(1,al);ctx.drawImage(bead(act?GOLD:col),PX[s]-Hh,PY[s]-Hh,Hh*2,Hh*2);
    ctx.globalAlpha=1;
    if(act||isSel){ctx.strokeStyle=act?'rgba(230,140,0,.75)':'rgba(26,33,51,.75)';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(PX[s],PY[s],r*2.5+2*Math.sin(t*4),0,6.283);ctx.stroke()}
  }
  for(let i=rings.length-1;i>=0;i--){const g=rings[i],age=t-g.t;if(age>2){rings.splice(i,1);continue}
    ctx.strokeStyle=rgb(g.col,1-age/2);ctx.lineWidth=2;ctx.beginPath();ctx.arc(PX[g.slot],PY[g.slot],age*70*PS[g.slot],0,6.283);ctx.stroke()}
  requestAnimationFrame(frame);
}
const slotNode=new Map();let slotVer=-1;
function nodeAtSlot(s){if(slotVer!==nodes){slotNode.clear();for(const n of nodes)slotNode.set(slotOf.get(n.id),n);slotVer=nodes}return slotNode.get(s)}


/* =====================================================================  INTERFACE  ===================================================================== */
function onGraphChanged(){$('#empty').style.display=nodes.length?'none':'block'}
function updateStats(s){
  $('#s-n').textContent=fmt(s.memories);$('#s-c').textContent=fmt(s.conversations);$('#s-r').textContent=fmt(s.recalls);$('#s-s').textContent=fmt(s.saved_tokens);
  const tot=s.saved_tokens+s.served_tokens;$('#s-bar').style.width=(tot?Math.round(100*s.saved_tokens/tot):0)+'%';
  $('#n-convs').textContent=s.conversations?fmt(s.conversations):'';$('#n-files').textContent=((s.kinds.file||0)+(s.kinds.image||0))?fmt((s.kinds.file||0)+(s.kinds.image||0)):'';
}
async function api(path,opt){const r=await fetch(path,opt);if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||r.status);return r.json()}
async function load(animate){setGraph(await api('/api/graph'),animate)}
let toastT;function toast(m){const t=$('#toast');t.textContent=m;t.style.opacity=1;clearTimeout(toastT);toastT=setTimeout(()=>t.style.opacity=0,2800)}

/* ---- mise en page → position du cerveau ---- */
let LC=null;
function layout(){
  const lp=$('#left').getBoundingClientRect(),rp=$('#right');
  const left=W>1000?lp.right+10:10,right=rp.classList.contains('open')?rp.getBoundingClientRect().left-10:W-10,top=76,bottom=H-92;
  const t={cx:(left+right)/2,cy:(top+bottom)/2,sc:Math.min(right-left,bottom-top)*.66};
  if(!LC)LC=t;else for(const k in t)LC[k]+=(t[k]-LC[k])*.12;
  return LC;
}

/* ---- clic / survol / rotation ---- */
function pick(mx,my){let best=null,bd=16*16;
  for(const n of nodes){const s=slotOf.get(n.id),dx=PX[s]-mx,dy=PY[s]-my,d=dx*dx+dy*dy;if(d<bd){bd=d;best=n.id}}return best}
cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,moved:false};cv.classList.add('drag');cv.setPointerCapture(e.pointerId);lastInteract=now()});
cv.addEventListener('pointermove',e=>{
  if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>3)drag.moved=true;
    yaw+=dx*.006;pitch=Math.max(-1.2,Math.min(1.2,pitch+dy*.005));drag.x=e.clientX;drag.y=e.clientY;lastInteract=now();return}
  hover=S?pick(e.clientX,e.clientY):null;cv.classList.toggle('hov',hover!==null);
  const tip=$('#tip');if(hover!==null){const n=byId.get(hover);tip.textContent=`${KN[n.kind]||n.kind} · ${n.title}`;
    tip.style.left=Math.min(e.clientX+14,W-330)+'px';tip.style.top=(e.clientY+14)+'px';tip.style.opacity=1}else tip.style.opacity=0});
cv.addEventListener('pointerup',e=>{cv.classList.remove('drag');const was=drag;drag=null;
  if(was&&!was.moved){const id=pick(e.clientX,e.clientY);if(id!==null)openMemory(id);else closeRight()}});
cv.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.5,Math.min(3,zoom*(e.deltaY<0?1.08:.93)));lastInteract=now()},{passive:false});

function lightUp(ids){active=new Map(ids.map(i=>[i,Infinity]));beams=[];const t=now();
  const slots=ids.map(i=>slotOf.get(i)).filter(s=>s!==undefined);slots.forEach((s,i)=>beams.push({a:i?slots[i-1]:slots[0],b:s,t0:t+i*.12}))}
function flash(ids,secs){const t=now(),sl=[];for(const i of ids){if(!byId.has(i))continue;if(active.get(i)!==Infinity)active.set(i,t+secs);sl.push(slotOf.get(i))}
  sl.forEach((s,i)=>beams.push({a:i?sl[i-1]:s,b:s,t0:t+i*.1}))}

/* ---- panneau de droite ---- */
let right={mode:null};
function openRight(title,...head){const h=$('#rhead');h.replaceChildren(el('h2',{},title),...head,el('button',{class:'btn sm x',onclick:closeRight,title:'Fermer'},'✕'));
  $('#right').classList.add('open');return $('#rbody')}
function closeRight(){$('#right').classList.remove('open');selected=null;right={mode:null};chat=null;document.querySelectorAll('.cv.on').forEach(e=>e.classList.remove('on'))}
const tag=(t,cls)=>el('span',{class:'tag '+(cls||'')},t);
async function textPreview(blob,ext){
  if(!TEXTEXT.has(ext))return null;const r=await fetch('/files/'+blob);const b=await r.blob();
  const t=await b.slice(0,24000).text();return el('pre',{},t+(b.size>24000?'\n… (aperçu tronqué — télécharge le fichier complet)':''))}
const dl=(m,name)=>el('a',{class:'btn sm',href:`/files/${m.blob}?dl=1&name=${encodeURIComponent(name||m.title)}`,style:'text-decoration:none'},'⬇ Télécharger');

async function openMemory(id){
  const m=await api('/api/memory/'+id);selected=id;right={mode:'mem',id};chat=null;
  const col=KC[m.kind]||KC.memory,body=openRight(m.title||'(sans titre)');
  body.replaceChildren(
    el('div',{class:'meta'},el('span',{class:'tag',style:`color:${rgb(col)}`},KN[m.kind]||m.kind),tag('#'+m.id),tag(fmt(m.tokens)+' tokens'),tag(m.hits+' rappels'),
      m.app?tag(m.app):null,m.pinned?tag('📌 épinglé'):null,...(m.tags?m.tags.split(' ').filter(Boolean).map(t=>tag('#'+t)):[])),
    m.blob&&/^image\/(png|jpeg|gif|webp)$/.test(m.mime)?el('img',{class:'thumb',style:'max-height:none;cursor:zoom-in',src:'/files/'+m.blob,onclick:()=>window.open('/files/'+m.blob)}):null,
    el('pre',{},m.content),
    el('div',{class:'row'},
      m.blob?dl(m,fileName(m)):null,
      m.conv?el('button',{class:'btn sm',onclick:()=>openConversation(m.conv,m.id)},'💬 Voir la conversation'):null,
      el('button',{class:'btn sm',onclick:async()=>{await api('/api/pin/'+id,{method:'POST',body:JSON.stringify({pinned:!m.pinned})});openMemory(id)}},m.pinned?'Désépingler':'📌 Épingler'),
      el('button',{class:'btn sm',onclick:()=>{navigator.clipboard?.writeText(m.content);toast('Copié')}},'Copier'),
      el('button',{class:'btn sm warn',onclick:async()=>{if(!confirm('Oublier ce souvenir ?'))return;await api('/api/memory/'+id,{method:'DELETE'});closeRight();scheduleGraph()}},'Oublier')),
    el('div',{class:'meta'},tag('source : '+(m.source||'—').slice(-70))),
    m.blob?await textPreview(m.blob,extOf(m.blob)).catch(()=>null):null);
  flash([id],3);
}

/* ---- conversation (bulles, en direct) ---- */
let chat=null;
function renderText(t){const f=document.createDocumentFragment();t.split('```').forEach((seg,i)=>{
  if(i%2){const nl=seg.indexOf('\n');f.append(el('pre',{},nl>=0&&nl<20?seg.slice(nl+1):seg))}else if(seg.trim())f.append(el('div',{class:'p'},seg.trim()))});return f}
function bubble(m){
  const claude=/claude/.test(m.tags)||(!/toi/.test(m.tags)&&m.app!=='Envoi'),who=claude?'claude':'toi';
  const wrap=el('div',{class:'msg '+who,'data-id':m.id});
  wrap.append(el('div',{class:'who'},(claude?'Claude':'Toi')+' · '+clock(m.created)));
  if(m.blob){
    const name=fileName(m),ext=extOf(m.blob);
    if(m.kind==='image'&&/^image\/(png|jpeg|gif|webp)$/.test(m.mime)){
      wrap.append(el('img',{class:'pic',src:'/files/'+m.blob,onclick:()=>window.open('/files/'+m.blob)}));
      const c=(m.content.split('\n').find(l=>l.startsWith('Contexte'))||'').replace('Contexte : ','');if(c)wrap.append(el('div',{class:'cap'},c));
    }else{
      const card=el('div',{class:'fcard'},extBadge(ext),el('div',{class:'fm'},el('div',{class:'fn'},name),el('div',{class:'fs'},ext.toUpperCase()+' · '+KN[m.kind])),
        dl(m,name),TEXTEXT.has(ext)?el('button',{class:'btn sm',onclick:async e=>{const b=e.target,nx=card.nextSibling;if(nx&&nx.dataset.pv){nx.remove();return}
          const pv=await textPreview(m.blob,ext);if(pv){pv.dataset.pv=1;pv.style.maxWidth='92%';card.after(pv)}}},'Voir'):null);
      wrap.append(card);
    }
  }else wrap.append(el('div',{class:'bub'},renderText(m.content)));
  return wrap;
}
async function openConversation(conv,focusId){
  selected=null;const items=await api('/api/conversation?id='+encodeURIComponent(conv));
  const info=convCache.get(conv)||{};const title=cleanQ(info.conv_title||info.first_q)||'Conversation';
  const body=openRight(title);right={mode:'chat',conv};
  $('#rhead').insertBefore(el('span',{class:'tag'},info.app||''),$('#rhead').lastChild);
  body.replaceChildren();chat={conv,last:0,blobs:new Set(),n:0};appendChat(items,true);
  const f=focusId&&body.querySelector(`[data-id="${focusId}"]`);if(f){f.scrollIntoView({block:'center'});f.style.outline='2px solid #0a84ff';f.style.outlineOffset='4px';f.style.borderRadius='18px'}else body.scrollTop=body.scrollHeight;
  document.querySelectorAll('.cv').forEach(e=>e.classList.toggle('on',e.dataset.conv===conv));
}
function appendChat(items,initial){
  const body=$('#rbody'),near=body.scrollHeight-body.scrollTop-body.clientHeight<140;
  for(const m of items){chat.last=Math.max(chat.last,m.id);
    if(m.blob){if(chat.blobs.has(m.blob))continue;chat.blobs.add(m.blob)}
    body.append(bubble(m));chat.n++}
  if(!initial&&near)body.scrollTop=body.scrollHeight;
}
async function refreshChat(){if(!chat)return;const items=await api(`/api/conversation?id=${encodeURIComponent(chat.conv)}&after=${chat.last}`);if(items.length&&chat)appendChat(items,false)}

/* ---- flux en direct ---- */
let filter='all',lastEv=0,feedN=0;
const VIA={hook:'injection automatique',mcp:'outil MCP',session:'démarrage de session',gui:'recherche manuelle'};
const evCat=e=>e.type==='recall'?'brain':((e.kind==='image'||(e.kind==='file'&&e.blob))?'files':'msgs');
function evCard(e,isNew){
  const d=e.data||{},cat=evCat(e);
  const card=el('div',{class:'ev'+(e.type==='recall'?' recall':'')+(isNew?' new':''),'data-cat':cat});
  let av,title,text,tags=[],extra=null;
  if(e.type==='recall'){
    av=el('div',{class:'av brain'},'🔍');title='Claude a consulté le cerveau';
    text=d.ids&&d.ids.length?(e.text?`« ${e.text} »`:'instructions de la session'):'';
    tags=[...(d.ids||[]).slice(0,4).map(i=>tag('#'+i)),tag(`≈${fmt(d.tokens)} tokens`),d.saved?tag(`−${fmt(d.saved)} économisés`,'g'):null,tag(VIA[d.via]||d.via||'','a')];
  }else if(e.kind==='conversation'){
    const toi=/^Toi/.test(e.title||'');av=el('div',{class:'av '+(toi?'toi':'claude')},toi?'T':'C');title=toi?'Toi':'Claude';text=e.preview;tags=[e.app?tag(e.app):null];
  }else if(e.kind==='image'&&e.blob){
    av=el('div',{class:'av k',style:`color:${rgb(KC.image)}`});title='Image';text=e.title;tags=[e.app?tag(e.app):null,tag('image')];
    if(/^image\/(png|jpeg|gif|webp)$/.test(e.mime))extra=el('img',{class:'thumb',src:'/files/'+e.blob,loading:'lazy'});
  }else if(e.blob){
    const ext=extOf(e.blob);av=extBadge(ext);title='Fichier';text=fileName(e);tags=[e.app?tag(e.app):null,tag(ext.toUpperCase())];
  }else{
    av=el('div',{class:'av k',style:`color:${rgb(KC[e.kind]||KC.memory)}`});title=KN[e.kind]||'souvenir';text=e.title||e.text;tags=[e.app?tag(e.app):null];
  }
  card.append(av,el('div',{class:'evm'},el('div',{class:'evt'},el('b',{},title),el('time',{},clock(e.ts))),text?el('div',{class:'evx'},text):null,extra,el('div',{class:'tags'},tags)));
  card.addEventListener('mouseenter',()=>{if(e.mem_id)hover=e.mem_id});card.addEventListener('mouseleave',()=>{hover=null});
  card.addEventListener('click',()=>{
    if(e.type==='recall'){const ids=d.ids||[];if(ids.length){lightUp(ids);openRecall(e,ids)}return}
    if(e.conv)openConversation(e.conv,e.mem_id);else if(e.mem_id)openMemory(e.mem_id);
    if(e.mem_id)flash([e.mem_id],3)});
  card.style.display=(filter==='all'||filter===cat)?'':'none';
  return card;
}
async function openRecall(e,ids){
  const d=e.data,body=openRight('Ce que Claude a lu');right={mode:'recall'};
  body.replaceChildren(el('div',{class:'meta'},tag(VIA[d.via]||d.via,'a'),tag(`≈${fmt(d.tokens)} tokens servis`),d.saved?tag(`−${fmt(d.saved)} économisés`,'g'):null),
    e.text?el('pre',{},'Requête : '+e.text):null,
    ...ids.map(id=>{const n=byId.get(id);return el('div',{class:'res',onclick:()=>openMemory(id)},el('span',{class:'dot',style:`color:${rgb(KC[n?.kind]||KC.memory)}`}),n?n.title:'#'+id)}));
}
function addEvents(list,animate){
  const feed=$('#feed'),empty=$('#feed-empty');if(list.length)empty.style.display='none';
  const burst=list.length>25;
  for(const e of list){lastEv=Math.max(lastEv,e.id);const c=evCard(e,animate&&!burst);feed.insertBefore(c,feed.firstChild===empty?empty.nextSibling:feed.firstChild);feedN++}
  while(feed.children.length>220)feed.lastChild.remove();
  $('#n-feed').textContent=feedN>0?fmt(Math.min(feedN,9999)):'';
}
function drawSpark(a){const c=$('#sp'),x=c.getContext('2d'),w=c.width,h=c.height,mx=Math.max(1,...a),bw=w/a.length;x.clearRect(0,0,w,h);
  a.forEach((v,i)=>{const bh=Math.max(4,v/mx*(h-6));const g=x.createLinearGradient(0,h-bh,0,h);g.addColorStop(0,v?'#0a84ff':'#c7d2e6');g.addColorStop(1,v?'#7cc4ff':'#dfe6f2');
    x.fillStyle=g;x.beginPath();x.roundRect?x.roundRect(i*bw+2,h-bh,bw-4,bh,4):x.rect(i*bw+2,h-bh,bw-4,bh);x.fill()})}
let graphT=null;function scheduleGraph(){clearTimeout(graphT);graphT=setTimeout(()=>load(true).catch(()=>{}),700)}
let downSince=0,feedInit=false;
async function pollEvents(){
  try{
    const r=await api('/api/events?since='+lastEv+(lastEv?'':'&limit=40'));
    $('#live').classList.remove('off');downSince=0;
    if(r.events.length){
      addEvents(r.events,feedInit);
      if(feedInit){
        const adds=r.events.filter(e=>e.type==='add'),rec=r.events.filter(e=>e.type==='recall');
        if(adds.length){scheduleGraph();if(document.querySelector('#filesv').hidden===false)loadFiles();
          if(chat&&adds.some(e=>e.conv===chat.conv))refreshChat().catch(()=>{})}
        if(rec.length){const ids=rec[rec.length-1].data.ids||[];if(ids.length&&!qi.value.trim())flash(ids,5)}
      }
    }
    feedInit=true;updateStats(r.stats);drawSpark(r.activity);
  }catch(e){$('#live').classList.add('off');downSince=downSince||Date.now()}
  setTimeout(pollEvents,1000);
}

/* ---- onglets ---- */
let tabNow='feed',convCache=new Map();
function setTab(t){tabNow=t;document.querySelectorAll('.tab').forEach(e=>e.classList.toggle('on',e.dataset.t===t));
  $('#feed').hidden=t!=='feed';$('#convs').hidden=t!=='convs';$('#filesv').hidden=t!=='files';$('#filters').hidden=t!=='feed';
  if(t==='convs')loadConvs();if(t==='files')loadFiles()}
document.querySelectorAll('.tab').forEach(e=>e.addEventListener('click',()=>setTab(e.dataset.t)));
document.querySelectorAll('.fchip').forEach(e=>e.addEventListener('click',()=>{filter=e.dataset.f;
  document.querySelectorAll('.fchip').forEach(x=>x.classList.toggle('on',x===e));
  document.querySelectorAll('#feed .ev').forEach(c=>c.style.display=(filter==='all'||c.dataset.cat===filter)?'':'none')}));
async function loadConvs(){
  const list=await api('/api/conversations'),box=$('#convs');convCache=new Map(list.map(c=>[c.conv,c]));box.replaceChildren();
  if(!list.length){box.append(el('div',{class:'hint'},el('b',{},'Aucune conversation pour l’instant'),'Elles apparaissent dès que tu utilises Claude Code ou claude.ai (avec l’extension).'));return}
  for(const c of list){const live=Date.now()/1000-c.updated<60;
    box.append(el('div',{class:'cv'+(chat&&chat.conv===c.conv?' on':''),'data-conv':c.conv,onclick:()=>openConversation(c.conv)},
      el('h4',{},el('span',{},cleanQ(c.conv_title||c.first_q)||'Conversation'),live?el('i',{class:'livedot'}):null),
      el('div',{class:'tags'},tag(c.app||'?'),tag(`${fmt(c.n)} éléments`),c.files?tag(`📎 ${c.files}`):null,tag(ago(c.updated)))))}
}
async function loadFiles(){
  const list=await api('/api/files'),box=$('#filesv');box.replaceChildren();
  if(!list.length){box.append(el('div',{class:'hint'},el('b',{},'Aucun fichier'),'Glisse-en ici, ou laisse Claude en créer : png, html, css, js, apk…'));return}
  const grid=el('div',{class:'grid'});
  for(const f of list){const ext=extOf(f.blob),img=/^image\/(png|jpeg|gif|webp)$/.test(f.mime);
    grid.append(el('div',{class:'ft',onclick:()=>openMemory(f.id)},el('div',{class:'pv'},img?el('img',{src:'/files/'+f.blob,loading:'lazy'}):extBadge(ext)),
      el('div',{class:'fi'},el('div',{class:'fn'},fileName(f)),el('div',{class:'fs'},`${ext.toUpperCase()} · ${fmtSize(f.size)} · ${ago(f.created)}`))))}
  box.append(grid);
}
setInterval(()=>{if(tabNow==='convs')loadConvs().catch(()=>{})},4000);

/* ---- connexion Claude & mises à jour ---- */
let lastStatus=null;
async function pollStatus(){
  try{const s=await api('/api/status');lastStatus=s;const c=s.connect,chip=$('#conn');
    const ok=c.connected,age=s.last_claude_call?s.now-s.last_claude_call:null;
    chip.className='chip glass '+(ok?'ok':'ko');
    $('#conn-t').textContent=ok?'Claude connecté':'Claude non connecté';
    $('#conn-s').textContent=ok?(age!==null&&age<600?'a lu le cerveau '+ago(s.last_claude_call):'en attente d’un message'):'clique pour connecter';
    $('#upd').hidden=!s.update.available}catch(e){}
}
$('#conn').addEventListener('click',()=>{
  const p=$('#pop'),s=lastStatus;if(p.classList.contains('open')){p.classList.remove('open');return}if(!s)return;const c=s.connect;
  const row=(l,v)=>el('div',{class:'stat'},el('span',{},l),el('b',{style:`color:${v===null?'#8994ad':v?'#0a9b64':'#e8590c'}`},v===null?'non installé':v?'✔ actif':'✘ inactif'));
  p.replaceChildren(el('h4',{},'Connexion à Claude'),row('Outils du cerveau (MCP)',c.claude_code_mcp),row('Injection automatique du contexte',c.hooks),
    row('Consigne globale (CLAUDE.md)',c.claude_md),row('Claude Desktop',c.desktop),
    c.error?el('div',{class:'hint'},c.error):null,
    el('div',{class:'row'},el('button',{class:'btn sm blue',onclick:async()=>{try{await api('/api/connect',{method:'POST',body:'{}'});toast('Connecté — redémarre Claude Code / Desktop');pollStatus();p.classList.remove('open')}catch(e){toast(e.message)}}},c.connected?'Reconnecter':'Connecter Claude'),
      c.connected?el('button',{class:'btn sm warn',onclick:async()=>{await api('/api/disconnect',{method:'POST',body:'{}'});pollStatus();p.classList.remove('open')}},'Déconnecter'):null),
    el('div',{class:'fs',style:'color:var(--mut);font-size:11.5px;margin-top:6px'},'Redémarre Claude Code après la connexion. Tes fichiers de config sont sauvegardés (*.kjui.bak).'));
  p.classList.add('open')});
document.addEventListener('click',e=>{if(!e.target.closest('#pop,#conn'))$('#pop').classList.remove('open')});
$('#upd').addEventListener('click',async()=>{
  if(!confirm('Installer la mise à jour ? L’application redémarre toute seule (tes données sont conservées).'))return;
  try{await api('/api/update/apply',{method:'POST',body:'{}'})}catch(e){toast(e.message);return}
  $('#overlay').classList.add('open');let down=false;
  const t=setInterval(async()=>{try{await api('/api/stats');if(down){clearInterval(t);location.reload()}}catch(e){down=true}},1200);
});

/* ---- recherche ---- */
let st;const qi=$('#q');
qi.addEventListener('input',()=>{clearTimeout(st);const v=qi.value.trim();
  if(!v){active=new Map();beams=[];return}
  st=setTimeout(async()=>{const r=await api('/api/search?q='+encodeURIComponent(v));lightUp(r.map(x=>x.id))},220)});
qi.addEventListener('keydown',async e=>{
  if(e.key==='Escape'){qi.value='';active=new Map();beams=[];return}
  if(e.key!=='Enter'||!qi.value.trim())return;
  const r=await api('/api/recall?q='+encodeURIComponent(qi.value.trim()));updateStats(r.stats);lightUp(r.matches);
  const body=openRight('Rappel : '+r.ids.length+' souvenir(s)');right={mode:'recall'};selected=null;
  body.replaceChildren(el('div',{class:'meta'},tag('≈'+fmt(r.tokens)+' tokens servis'),tag('≈'+fmt(r.saved)+' économisés','g')),
    ...r.ids.map(id=>{const n=byId.get(id);return el('div',{class:'res',onclick:()=>openMemory(id)},el('span',{class:'dot',style:`color:${rgb(KC[n?.kind]||KC.memory)}`}),n?n.title:'#'+id)}),
    el('pre',{},r.pack||'(aucun souvenir pertinent)'),
    el('div',{class:'row'},el('button',{class:'btn sm',onclick:()=>{navigator.clipboard?.writeText(r.pack);toast('Contexte copié — colle-le dans Claude')}},'Copier le contexte')));
});

/* ---- ajout / import ---- */
const modal=$('#modal');
$('#add').onclick=()=>{modal.classList.add('open');$('#m-content').focus()};
$('#m-cancel').onclick=()=>modal.classList.remove('open');
$('#m-save').onclick=async()=>{const c=$('#m-content').value.trim();if(!c)return;
  await api('/api/remember',{method:'POST',body:JSON.stringify({title:$('#m-title').value,content:c,kind:$('#m-kind').value,tags:$('#m-tags').value,pinned:$('#m-pin').checked})});
  for(const i of['#m-title','#m-content','#m-tags'])$(i).value='';modal.classList.remove('open');toast('Souvenir mémorisé')};
const TXT=/\.(md|markdown|txt|py|js|ts|tsx|jsx|json|csv|tsv|html|htm|css|ya?ml|toml|xml|sh|bat|log|ini|cfg|sql|java|c|h|cpp|cs|go|rs|rb|php|swift|kt|lua|rst)$/i;
const b64=f=>new Promise((ok,ko)=>{const r=new FileReader();r.onload=()=>ok(r.result.split(',')[1]||'');r.onerror=ko;r.readAsDataURL(f)});
async function upload(files){
  let n=0;const instr=$('#asInstr').checked;
  for(const f of files){const body={name:f.name,kind:instr?'instruction':undefined,pinned:instr};
    if(TXT.test(f.name))body.text=await f.text();else body.b64=await b64(f);
    try{n+=(await api('/api/upload',{method:'POST',body:JSON.stringify(body)})).chunks}catch(e){toast('Échec : '+f.name+' ('+e.message+')')}}
  toast(files.length+' fichier(s) mémorisé(s)');
}
$('#file').onchange=e=>{upload([...e.target.files]);e.target.value=''};
addEventListener('dragover',e=>{e.preventDefault();$('#drop').style.display='flex'});
addEventListener('dragleave',e=>{if(!e.relatedTarget)$('#drop').style.display='none'});
addEventListener('drop',e=>{e.preventDefault();$('#drop').style.display='none';upload([...e.dataTransfer.files])});

/* ---- démarrage ---- */
(async()=>{
  try{await load(false)}catch(e){}
  requestAnimationFrame(frame);
  pollEvents();pollStatus();setInterval(pollStatus,4000);
})();
