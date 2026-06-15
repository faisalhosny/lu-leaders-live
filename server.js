// جامعة لوسيل - القيادة — النسخة الحية | خادم اللعب الجماعي الحي
// Authoritative real-time server: rooms, server-side timing, fastest-N, scoring.
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.send('ok'));

let DEFAULT_Q = [];
try { DEFAULT_Q = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8')); }
catch (e) { console.warn('questions.json not loaded:', e.message); }

// Admin (lecturer) credentials — override on the host via env vars ADMIN_USER / ADMIN_PASSWORD.
const ADMIN_USER = (process.env.ADMIN_USER || 'iman').trim().toLowerCase();
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'Leaders2026';

const rooms = {};
const newCode = () => { let c; do { c = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms[c]); return c; };

const lobby = r => ({ code: r.code, players: Object.values(r.players).map(p => p.name), count: Object.keys(r.players).length });
const answeredCount = r => Object.values(r.players).filter(p => p.answered).length;
const counts = r => { const c = [0, 0, 0, 0]; Object.values(r.players).forEach(p => { if (p.answered && p.lastChoice != null) c[p.lastChoice]++; }); return c; };
const allAnswered = r => { const ps = Object.values(r.players); return ps.length > 0 && ps.every(p => p.answered); };

io.on('connection', sock => {
  let myRoom = null, myRole = null;

  sock.on('host:create', (cfg, cb) => {
    const user = ((cfg && cfg.user) || '').toString().trim().toLowerCase();
    const pass = ((cfg && cfg.password) || '').toString();
    if (pass !== ADMIN_PASS || (ADMIN_USER && user !== ADMIN_USER)) {
      return cb && cb({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    const code = newCode();
    const qs = (cfg && Array.isArray(cfg.questions) && cfg.questions.length) ? cfg.questions : DEFAULT_Q;
    rooms[code] = { code, hostSock: sock.id, players: {}, phase: 'lobby', qIndex: -1, questions: qs, timeLimit: (cfg && cfg.timeLimit) || 25, timer: null, startAt: 0 };
    myRoom = code; myRole = 'host'; sock.join(code);
    cb && cb({ code, count: qs.length });
  });

  sock.on('player:join', ({ code, name }, cb) => {
    const r = rooms[code];
    if (!r) return cb && cb({ error: 'لا توجد غرفة بهذا الرمز' });
    if (r.phase !== 'lobby') return cb && cb({ error: 'بدأت اللعبة بالفعل — انتظر الجولة القادمة' });
    r.players[sock.id] = { sid: sock.id, name: (name || 'طالب').toString().trim().slice(0, 24) || 'طالب', score: 0, answered: false, lastTime: null, lastCorrect: null, lastChoice: null, lastPoints: 0 };
    myRoom = code; myRole = 'player'; sock.join(code);
    cb && cb({ ok: true, name: r.players[sock.id].name, code });
    io.to(r.hostSock).emit('host:lobby', lobby(r));
  });

  sock.on('host:start', (cfg) => {
    const r = rooms[myRoom]; if (!r || myRole !== 'host' || r.phase !== 'lobby') return;
    if (cfg) { if (cfg.timeLimit) r.timeLimit = Math.max(5, Math.min(180, parseInt(cfg.timeLimit) || 25)); if (Array.isArray(cfg.questions) && cfg.questions.length) r.questions = cfg.questions; }
    r.phase = 'countdown';
    io.to(r.code).emit('game:countdown', { n: 3 });   // synced "get ready" on all devices
    clearTimeout(r.timer);
    r.timer = setTimeout(() => startQ(r, 0), 3300);
  });
  sock.on('host:next', () => { const r = rooms[myRoom]; if (r && myRole === 'host') startQ(r, r.qIndex + 1); });

  sock.on('player:answer', ({ choice }) => {
    const r = rooms[myRoom]; if (!r || r.phase !== 'question') return;
    const p = r.players[sock.id]; if (!p || p.answered) return;
    const t = (Date.now() - r.startAt) / 1000;
    const correct = (choice === r.curCorrect);
    p.answered = true; p.lastTime = t; p.lastCorrect = correct; p.lastChoice = choice;
    p.lastPoints = correct ? (600 + Math.round(400 * Math.max(0, 1 - t / r.timeLimit))) : 0;
    p.score += p.lastPoints;
    sock.emit('player:ack', { t: +t.toFixed(1) });
    io.to(r.hostSock).emit('host:progress', { answered: answeredCount(r), total: Object.keys(r.players).length, counts: counts(r) });
    if (allAnswered(r)) { clearTimeout(r.timer); reveal(r); }
  });

  sock.on('disconnect', () => {
    const r = rooms[myRoom]; if (!r) return;
    if (myRole === 'host') { io.to(myRoom).emit('room:closed'); clearTimeout(r.timer); delete rooms[myRoom]; }
    else if (r.players[sock.id]) { delete r.players[sock.id]; if (r.hostSock) io.to(r.hostSock).emit('host:lobby', lobby(r)); }
  });
});

function startQ(r, idx) {
  if (idx >= r.questions.length) return gameOver(r);
  r.qIndex = idx; r.phase = 'question'; r.startAt = Date.now();
  Object.values(r.players).forEach(p => { p.answered = false; p.lastTime = null; p.lastCorrect = null; p.lastChoice = null; p.lastPoints = 0; });
  const q = r.questions[idx];
  const order = q.opts.map((_, i) => i).sort(() => Math.random() - 0.5);
  r.curOpts = order.map(i => q.opts[i]);
  r.curCorrect = order.indexOf(typeof q.correct === 'number' ? q.correct : 0);
  io.to(r.code).emit('q:show', { index: idx, total: r.questions.length, chapter: q.chapter || '', q: q.q, opts: r.curOpts, timeLimit: r.timeLimit });
  io.to(r.hostSock).emit('host:progress', { answered: 0, total: Object.keys(r.players).length, counts: [0, 0, 0, 0] });
  clearTimeout(r.timer);
  r.timer = setTimeout(() => reveal(r), r.timeLimit * 1000 + 500);
}

function reveal(r) {
  if (r.phase !== 'question') return; r.phase = 'reveal';
  const ps = Object.values(r.players);
  const correctOnes = ps.filter(p => p.lastCorrect).sort((a, b) => a.lastTime - b.lastTime);
  const fastest = correctOnes.slice(0, 10).map((p, i) => ({ rank: i + 1, name: p.name, time: +p.lastTime.toFixed(1), points: p.lastPoints }));
  const leaderboard = [...ps].sort((a, b) => b.score - a.score).slice(0, 10).map(p => ({ name: p.name, score: p.score }));
  const top = leaderboard[0] || { name: '—', score: 0 };
  const explain = (r.questions[r.qIndex] && r.questions[r.qIndex].explain) || '';
  io.to(r.hostSock).emit('host:reveal', { correct: r.curCorrect, correctText: r.curOpts[r.curCorrect], explain, counts: counts(r), fastest, leaderboard, top, index: r.qIndex, total: r.questions.length, answered: answeredCount(r), totalPlayers: ps.length });
  ps.forEach(p => {
    const rank = correctOnes.findIndex(x => x.sid === p.sid);
    io.to(p.sid).emit('player:reveal', { correct: p.lastCorrect, points: p.lastPoints, score: p.score, speedRank: p.lastCorrect ? rank + 1 : null, correctCount: correctOnes.length, correctIndex: r.curCorrect, correctText: r.curOpts[r.curCorrect], explain, top: leaderboard.slice(0, 3) });
  });
}

function gameOver(r) {
  r.phase = 'end';
  const final = Object.values(r.players).sort((a, b) => b.score - a.score).map((p, i) => ({ rank: i + 1, name: p.name, score: p.score, sid: p.sid }));
  io.to(r.hostSock).emit('host:over', { final: final.map(({ sid, ...x }) => x) });
  final.forEach(f => io.to(f.sid).emit('player:over', { rank: f.rank, score: f.score, total: final.length }));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('جامعة لوسيل - القيادة — النسخة الحية تعمل على المنفذ ' + PORT));
