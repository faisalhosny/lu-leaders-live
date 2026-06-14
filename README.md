# أكاديمية القادة — النسخة الحية (LU Leaders Live)

Live multiplayer review game (Kahoot-style) for **مقرر القيادة والريادة والابتكار** — Lusail University.
Prepared by **إيمان الحصني**. Real-time engine: Node.js + Socket.IO.

Students join from their phones (QR / room code + name — no passwords). The **lecturer controls the start**: the game never begins until the host clicks **ابدأ اللعبة**.

---

## Deploy live (Render — free) in 5 steps
1. Create an empty repo on **github.com** (no README), e.g. `lu-leaders-live`, and copy its URL.
2. Push this folder to it (or run `push.bat`):
   ```bash
   git remote add origin https://github.com/USERNAME/lu-leaders-live.git
   git branch -M main
   git push -u origin main
   ```
3. Go to **render.com → New → Web Service → Build and deploy from a Git repository**, connect the repo.
4. Render auto-detects Node (or reads `render.yaml`): Build `npm install`, Start `node server.js`, Plan **Free**. Click **Create Web Service**.
5. You get a public URL like `https://lu-leaders-live.onrender.com`. Open it on the classroom screen → **أنا المحاضِرة** → students scan the QR.

> Free tier sleeps after ~15 min idle (≈50s cold start). Open the URL ~2 minutes before class to wake it. For guaranteed always-on during exam week, switch the service to **Starter ($7/mo)** and cancel afterwards. Render supports WebSockets, which this app needs.

## Run locally (optional)
```bash
npm install
npm start          # http://localhost:3000
```
For a public link from your laptop without hosting, use the included `تشغيل اللعبة الحية.bat` (starts the server + a Cloudflare tunnel).

## How a session runs (best-practice timing)
- **Lobby:** students join; the host sees names appear live. Nothing starts automatically.
- **Start:** host clicks **ابدأ اللعبة** → a synced **3‑2‑1 countdown** on all devices → first question.
- **Question:** 10–20s per question (set in the lobby). Faster correct answers earn more points.
- **Reveal:** correct answer + **fastest‑10** + 👑 top scorer. The host advances with **التالي** — this is the "campfire" moment to discuss before moving on.

## Manage content with Excel (admin)
- **Import:** in the lobby, **⬆ استيراد أسئلة (Excel)** loads the «ساحة النخبة» sheet from `أكاديمية القادة - مراجعة الأسئلة والإجابات.xlsx` (correct answer = the green column).
- **Export:** after the game, **⬇ تصدير النتائج (Excel)** saves the final standings.

## Notes
- `PORT` is read from the environment automatically (Render sets it).
- Health check endpoint: `/health`.
- `test_client.js` is a dev-only harness (`npm test`) and is not used in production.
