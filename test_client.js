// Dev test harness: drives a full game with 6 players at staggered times to verify
// fastest-N sorting, speed scoring, and podium. Not part of the deployed app.
const { io } = require('socket.io-client');
const fs = require('fs');
const Q = JSON.parse(fs.readFileSync(__dirname + '/questions.json', 'utf8'));
const URL = 'http://localhost:3000';
const log = (...a) => console.log(...a);

const mkHost = () => new Promise(r => { const s = io(URL); s.on('connect', () => s.emit('host:create', { user: 'iman', password: 'Leaders2026', timeLimit: 10 }, x => r({ s, ...x }))); });
const mkPlayer = (code, name) => new Promise(r => { const s = io(URL); s.on('connect', () => s.emit('player:join', { code, name }, x => r({ s, name, x }))); });

(async () => {
  const host = await mkHost();
  log('Room', host.code, '| default bank', host.count);
  const names = ['سارة', 'ناصر', 'عبير', 'راكان', 'منصور', 'نوف'];
  const players = [];
  for (const n of names) players.push(await mkPlayer(host.code, n));
  log('Joined:', players.map(p => p.name).join('، '));

  let qn = 0, ended = false;
  host.s.on('host:reveal', d => {
    log(`\n[كشف سؤال ${d.index + 1}] 👑 المتصدّر: ${d.top.name} (${d.top.score})`);
    log('  ⚡ أسرع: ' + (d.fastest.map(f => `${f.rank}.${f.name} ${f.time}ث +${f.points}`).join('  |  ') || '(لا أحد صحيح)'));
    log('  ✅ الصحيحة: ' + (d.correctText || '?') + (d.explain ? '  💡 ' + d.explain : '  (لا تفسير)'));
    qn++;
    setTimeout(() => host.s.emit('host:next'), 700);
  });
  host.s.on('host:over', d => { log('\n[🏆 المنصة] ' + d.final.map(f => `${f.rank}. ${f.name} = ${f.score}`).join('  |  ')); finish(); });

  players.forEach((p, pi) => {
    p.s.on('q:show', q => {
      const correctText = Q[q.index].opts[0];
      const correctIdx = q.opts.findIndex(o => o === correctText);
      const choice = (pi === 5) ? ((correctIdx + 1) % q.opts.length) : correctIdx; // نوف always wrong
      const delay = 300 + pi * 420; // staggered: سارة fastest
      setTimeout(() => p.s.emit('player:answer', { choice }), delay);
    });
  });

  host.s.emit('host:start', { timeLimit: 10, questions: Q.slice(0, 3) });

  function finish() { if (ended) return; ended = true; setTimeout(() => { players.forEach(p => p.s.close()); host.s.close(); process.exit(0); }, 200); }
  setTimeout(() => { log('\n(timeout)'); finish(); }, 25000);
})();
