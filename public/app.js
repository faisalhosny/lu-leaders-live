/* جامعة لوسيل - القيادة — النسخة الحية | عميل المحاضِر + الطالب */
const socket = io();
const SHAPES = ['▲', '◆', '●', '■'];
const $ = id => document.getElementById(id);
const screens = ['landing','h-lobby','h-question','h-reveal','h-podium','p-join','p-wait','p-question','p-reveal','p-podium'];
function show(id){ screens.forEach(s=>$(s).classList.toggle('on', s===id)); window.scrollTo(0,0); }
function toast(msg){ const t=$('toast'); t.textContent=msg; t.style.display='block'; setTimeout(()=>t.style.display='none',3200); }

let ROLE=null, ROOM=null, customQuestions=null, finalStandings=null, cdTimer=null;

/* ---------- timer (cosmetic; server is authoritative) ---------- */
function startCountdown(limit){
  stopCountdown();
  const t0=Date.now();
  const ring=$('hring'), tn=$('htnum'), bar=$('pbar');
  const draw=()=>{
    const elapsed=(Date.now()-t0)/1000, rem=Math.max(0,limit-elapsed), frac=rem/limit;
    if(tn) tn.textContent=Math.ceil(rem);
    if(ring){ ring.style.strokeDashoffset=String(226*(1-frac)); ring.style.stroke = frac<.25?'#E39A9A':(frac<.5?'#D8BC78':'#C9A961'); }
    if(bar) bar.style.width=(frac*100)+'%';
    if(rem<=0) stopCountdown();
  };
  draw(); cdTimer=setInterval(draw,100);
}
function stopCountdown(){ if(cdTimer){ clearInterval(cdTimer); cdTimer=null; } }

/* ---- pre-game "get ready" countdown (synced on all devices) ---- */
let cdGo=null;
function showCountdown(n){
  const cd=$('cd'), cdn=$('cdn'), cdl=$('cdl');
  if(!cd) return;
  cd.classList.remove('hidden'); cdl.textContent='استعدّوا للبدء…';
  let k=n; cdn.className='cdn'; cdn.textContent=k;
  if(cdGo) clearInterval(cdGo);
  cdGo=setInterval(()=>{
    k--;
    if(k>0){ cdn.textContent=k; cdn.style.animation='none'; void cdn.offsetWidth; cdn.style.animation='cdpop .7s cubic-bezier(.2,.9,.3,1.2)'; }
    else { clearInterval(cdGo); cdGo=null; cdn.className='cdn go'; cdn.textContent='🚀 ابدؤوا'; cdl.textContent=''; }
  },1000);
}
function hideCountdown(){ if(cdGo){ clearInterval(cdGo); cdGo=null; } const cd=$('cd'); if(cd) cd.classList.add('hidden'); }

/* ================= UI entry ================= */
const UI = {
  showHostLogin(){ $('hostLogin').classList.remove('hidden'); const b=$('hostBtn'); if(b) b.classList.add('hidden'); setTimeout(()=>{const u=$('hUser'); if(u) u.focus();},100); },
  playerGo(){
    const code=($('joinCode').value||'').trim();
    if(!/^\d{4}$/.test(code)){ toast('أدخل رمز غرفة من 4 أرقام'); return; }
    PLAYER.prep(code);
  }
};

/* ================= HOST ================= */
const HOST = {
  login(){
    const user=($('hUser').value||'').trim(), password=$('hPass').value||'';
    if(!user||!password){ $('hErr').style.color='#E7A9A9'; $('hErr').textContent='أدخلي اسم المستخدم وكلمة المرور'; return; }
    $('hErr').style.color='var(--mute)'; $('hErr').textContent='جارٍ الدخول…';
    socket.emit('host:create', { user, password }, res => {
      if(!res || res.error){ $('hErr').style.color='#E7A9A9'; $('hErr').textContent=(res&&res.error)||'تعذّر الدخول'; return; }
      ROLE='host'; ROOM=res.code;
      $('roomCodeBadge').textContent='غرفة '+res.code; $('roomCodeBadge').classList.remove('hidden');
      $('lobbyCode').textContent=res.code;
      $('bankInfo').textContent=res.count+' سؤالاً';
      const url=location.origin+'/?room='+res.code;
      $('joinUrl').textContent=url.replace(/^https?:\/\//,'');
      if(window.QRCode){ const qb=$('qrcanvas'); qb.innerHTML=''; new QRCode(qb,{text:url,width:200,height:200,colorDark:'#0C1A2E',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M}); }
      show('h-lobby');
    });
  },
  start(){
    const tl=parseInt($('timeSel').value)||15;
    socket.emit('host:start', { timeLimit: tl, questions: customQuestions || undefined });
  },
  next(){ socket.emit('host:next'); },
  setPubUrl(){
    let base=($('pubUrl').value||'').trim().replace(/\/+$/,''); if(!base) return;
    if(!/^https?:\/\//.test(base)) base='https://'+base;
    const url=base+'/?room='+ROOM;
    $('joinUrl').textContent=url.replace(/^https?:\/\//,'');
    if(window.QRCode){ const qb=$('qrcanvas'); qb.innerHTML=''; new QRCode(qb,{text:url,width:200,height:200,colorDark:'#0C1A2E',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M}); }
    toast('تم تحديث رمز QR للرابط العام');
  },
  copyLink(){
    let base=($('pubUrl').value||'').trim().replace(/\/+$/,''); if(base&&!/^https?:\/\//.test(base)) base='https://'+base;
    const url=(base||location.origin)+'/?room='+ROOM;
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(()=>toast('تم نسخ رابط الطلاب — ألصقيه في منصة الطلاب أو المحادثة'),()=>toast(url)); }
    else { toast(url); }
  },
  importXlsx(ev){
    const f=ev.target.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=e=>{
      try{
        const wb=XLSX.read(e.target.result,{type:'array'});
        const sheet = wb.Sheets['⚡ ساحة النخبة'] || wb.Sheets[wb.SheetNames.find(n=>n.includes('ساحة')) || wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:''});
        const qs=[];
        rows.forEach(r=>{
          const q=(r[2]||'').toString().trim();
          const correct=(r[3]||'').toString().trim();
          const d=[r[4],r[5],r[6]].map(x=>(x||'').toString().trim());
          const explain=(r[7]||'').toString().trim();
          if(!q||!correct||!d[0]||q.includes('السؤال')||correct.includes('الإجابة الصحيحة')) return;
          qs.push({chapter:(r[1]||'').toString().trim(), q, opts:[correct,...d], correct:0, explain});
        });
        if(qs.length){ customQuestions=qs; $('bankInfo').textContent=qs.length+' سؤالاً (مستورد)'; toast('تم استيراد '+qs.length+' سؤالاً من الملف'); }
        else toast('لم أجد أسئلة بالتنسيق المتوقع في الملف');
      }catch(err){ toast('تعذّر قراءة الملف: '+err.message); }
    };
    rd.readAsArrayBuffer(f);
  },
  exportXlsx(){
    if(!finalStandings||!window.XLSX){ toast('لا توجد نتائج بعد'); return; }
    const aoa=[['الترتيب','اسم الطالب','النقاط']].concat(finalStandings.map(p=>[p.rank,p.name,p.score]));
    const ws=XLSX.utils.aoa_to_sheet(aoa); ws['!cols']=[{wch:8},{wch:28},{wch:12}];
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'النتائج');
    XLSX.writeFile(wb,'نتائج جامعة لوسيل - القيادة.xlsx');
  },
  lobby(d){
    $('joinCount').textContent=d.count;
    const c=$('chips'); c.innerHTML='';
    d.players.forEach(n=>{ const e=document.createElement('span'); e.className='chip'; e.textContent=n; c.appendChild(e); });
    $('startBtn').disabled = d.count<1;
    $('startBtn').textContent = d.count<1 ? '🚀 ابدأ اللعبة (بانتظار طلاب)' : `🚀 ابدأ اللعبة (${d.count} جاهزون)`;
  },
  question(p){
    $('hqCount').textContent=`سؤال ${p.index+1} / ${p.total}`;
    $('hqChap').textContent=p.chapter||'';
    $('hqAns').innerHTML=`أجاب: <span class="num">0</span> / <span class="num">0</span>`;
    $('hqText').textContent=p.q;
    const box=$('hTiles'); box.className='tiles'; box.innerHTML='';
    p.opts.forEach((o,i)=>{ box.insertAdjacentHTML('beforeend',
      `<div class="tile t${i}" data-i="${i}"><span class="shape">${SHAPES[i]}</span><span>${o}</span><span class="cnt num">0</span></div>`); });
    $('htnum').textContent=p.timeLimit;
    show('h-question'); startCountdown(p.timeLimit);
  },
  progress(d){ $('hqAns').innerHTML=`أجاب: <span class="num">${d.answered}</span> / <span class="num">${d.total}</span>`; this._counts=d.counts; },
  reveal(d){
    stopCountdown();
    // highlight on the question board first
    const box=$('hTiles'); box.classList.add('reveal-on');
    const counts=d.counts||this._counts||[0,0,0,0];
    box.querySelectorAll('.tile').forEach(t=>{ const i=+t.dataset.i; t.querySelector('.cnt').textContent=counts[i]||0; if(i===d.correct) t.classList.add('correct'); });
    $('hqAns').innerHTML=`أجاب: <span class="num">${d.answered}</span> / <span class="num">${d.totalPlayers}</span>`;
    setTimeout(()=>{
      $('rvTopName').textContent='المتصدّر: '+d.top.name;
      $('rvTopScore').textContent=d.top.score;
      $('rvSub').textContent=`من الأسرع إلى الأبطأ — بين من أجابوا صحيحاً (سؤال ${d.index+1})`;
      const rx=$('rvExplain'); if(d.explain||d.correctText){ rx.innerHTML=`<b>✅ ${d.correctText||''}</b>${d.explain?'<br>💡 '+d.explain:''}`; rx.classList.remove('hidden'); } else rx.classList.add('hidden');
      const L=$('rvList'); L.innerHTML='';
      if(!d.fastest.length) L.innerHTML='<div style="color:#9FB2C8;padding:20px">لم تُسجَّل إجابات صحيحة لهذا السؤال.</div>';
      d.fastest.forEach((p,i)=>{ L.insertAdjacentHTML('beforeend',
        `<div class="lrow" style="animation-delay:${i*0.05}s"><span class="lrank">${p.rank}</span><span class="lname">${p.name}</span>
         <span class="lspeedbar"><i style="width:${Math.max(12,100-p.time/(d.timeLimit||15)*100)}%"></i></span>
         <span class="ltime num">${p.time} ث</span><span class="lpts num">+${p.points}</span></div>`); });
      $('rvNext').textContent = d.index+1<d.total ? 'السؤال التالي ←' : 'النتائج النهائية 🏆';
      show('h-reveal');
    },1300);
  },
  over(d){
    finalStandings=d.final;
    const medals=['🥇','🥈','🥉'];
    const L=$('podList'); L.innerHTML='';
    d.final.slice(0,5).forEach((p,i)=>{ L.insertAdjacentHTML('beforeend',
      `<div class="brow" style="font-size:18px"><span style="font-size:24px;width:38px;text-align:center">${medals[i]||p.rank}</span><span class="lname">${p.name}</span><span class="lpts num">${p.score}</span></div>`); });
    show('h-podium');
  }
};

/* ================= PLAYER ================= */
const PLAYER = {
  prep(code){ ROOM=code; $('pCodeShow').textContent=code; $('pErr').textContent=''; show('p-join'); setTimeout(()=>$('pName').focus(),200); },
  join(){
    const name=($('pName').value||'').trim();
    if(!name){ $('pErr').textContent='اكتب اسمك أولاً'; return; }
    socket.emit('player:join',{code:ROOM,name},res=>{
      if(res.error){ $('pErr').textContent=res.error; return; }
      ROLE='player';
      $('pwName').textContent=res.name; $('pwIcon').textContent='✅'; $('pwMsg').textContent='تم الانضمام!'; $('pwSub').textContent='في انتظار بدء المحاضِرة...';
      show('p-wait');
    });
  },
  question(p){
    $('pqText').textContent=p.q;
    const box=$('pBtns'); box.innerHTML='';
    p.opts.forEach((o,i)=>{ const b=document.createElement('button'); b.className='pchoice t'+i;
      b.innerHTML=`<span class="ps">${SHAPES[i]}</span><span>${o}</span>`; b.onclick=()=>PLAYER.answer(i,b); box.appendChild(b); });
    this.answered=false;
    show('p-question'); startCountdown(p.timeLimit);
  },
  answer(i,btn){
    if(this.answered) return; this.answered=true;
    socket.emit('player:answer',{choice:i});
    document.querySelectorAll('#pBtns .pchoice').forEach((b,bi)=>{ if(bi!==i) b.classList.add('dim'); b.disabled=true; });
  },
  ack(d){ $('pwIcon').textContent='⚡'; $('pwMsg').textContent='سُجِّلت إجابتك!'; $('pwName').textContent=''; $('pwSub').textContent=`السرعة: ${d.t} ث — انتظر النتيجة...`; show('p-wait'); },
  reveal(d){
    stopCountdown();
    $('pfIcon').textContent=d.correct?'✅':'❌';
    $('pfTitle').textContent=d.correct?'إجابة صحيحة!':'إجابة غير صحيحة';
    $('pfTitle').className='ttl '+(d.correct?'good':'bad');
    const pts=$('pfPts'), rk=$('pfRank'), cr=$('pfCorrect'), tp=$('pfTop');
    if(d.correct){ pts.textContent='+'+d.points; pts.classList.remove('hidden'); } else pts.classList.add('hidden');
    if(d.correctText){ cr.innerHTML=`الإجابة الصحيحة:<br><b>${d.correctText}</b>`; cr.classList.remove('hidden'); } else cr.classList.add('hidden');
    const ex=$('pfExplain'); if(d.explain){ ex.innerHTML='💡 '+d.explain; ex.classList.remove('hidden'); } else ex.classList.add('hidden');
    if(d.correct&&d.speedRank){ rk.textContent=`⚡ ترتيب سرعتك: ${d.speedRank} من ${d.correctCount}`; rk.classList.remove('hidden'); } else rk.classList.add('hidden');
    $('pfScore').innerHTML=`رصيدك: <span class="num">${d.score}</span>`;
    if(d.top&&d.top.length){ tp.innerHTML=`<div class="pt-h">المتصدّرون</div>`+d.top.map((p,i)=>`<div class="pt-r"><span>${['🥇','🥈','🥉'][i]||''}</span><span class="pt-n">${p.name}</span><span class="pt-s num">${p.score}</span></div>`).join(''); tp.classList.remove('hidden'); } else tp.classList.add('hidden');
    show('p-reveal');
  },
  over(d){
    const medals=['🥇','🥈','🥉'];
    $('ppIcon').textContent = d.rank<=3?medals[d.rank-1]:'🎉';
    $('ppRank').textContent=d.rank;
    $('ppSub').innerHTML=`من ${d.total} · رصيدك <span class="num">${d.score}</span>`;
    show('p-podium');
  }
};

/* ================= socket wiring ================= */
socket.on('host:lobby', d=>HOST.lobby(d));
socket.on('host:progress', d=>{ if(ROLE==='host') HOST.progress(d); });
socket.on('host:reveal', d=>{ if(ROLE==='host') HOST.reveal(d); });
socket.on('host:over', d=>{ if(ROLE==='host') HOST.over(d); });
socket.on('game:countdown', d=>showCountdown(d.n||3));
socket.on('q:show', p=>{ hideCountdown(); if(ROLE==='host') HOST.question(p); else if(ROLE==='player') PLAYER.question(p); });
socket.on('player:ack', d=>PLAYER.ack(d));
socket.on('player:reveal', d=>PLAYER.reveal(d));
socket.on('player:over', d=>PLAYER.over(d));
socket.on('room:closed', ()=>{ toast('أُغلقت الغرفة من قِبل المحاضِرة'); setTimeout(()=>location.href=location.origin,1800); });
socket.on('connect_error', ()=>toast('تعذّر الاتصال بالخادم'));

/* deep link ?room=CODE → player join */
(function(){ const m=location.search.match(/room=(\d{4})/); if(m){ PLAYER.prep(m[1]); } })();
