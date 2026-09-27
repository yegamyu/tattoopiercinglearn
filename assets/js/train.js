import { $, $$, esc, boot, shuffle, speak, canSpeak, sayBtn, filterBar, filterWords, scopeLabel } from "./core.js";

boot("train", ctx => {
  const { S } = ctx;
  const T = S.train;
  T.mode ??= "cards"; T.dir ??= "en"; T.lopt ??= "ru"; T.size ??= "10";
  S.stats ??= {};
  $("#dir").value = T.dir; $("#lopt").value = T.lopt; $("#size").value = T.size;

  let deck = [], pos = 0, score = { r: 0, t: 0 }, missed = [];
  const st = $("#stage");
  const target = w => w.en.replace(/\s*\(.*?\)/g, "").trim();
  const front = w => T.dir === "en" ? w.en : w.ru;
  const back = w => T.dir === "en" ? w.ru : w.en;
  const pron = w => `<p class="sub">[${esc(w.ipa)}] · ${esc(w.tr)}</p>`;

  // Правильный ответ дважды подряд → слово выучено; ошибка → снова в невыученные.
  function record(w, ok) {
    const s = S.stats[w.id] ??= { ok: 0 };
    score.t++;
    if (ok) { score.r++; s.ok++; if (s.ok >= 2) S.known[w.id] = true; }
    else { s.ok = 0; delete S.known[w.id]; missed.push(w); }
    S.save();
  }

  function start() {
    $("#scope").textContent = scopeLabel(ctx);
    $$("[data-mode]").forEach(b => b.classList.toggle("ghost", b.dataset.mode !== T.mode));
    $("#dir").classList.toggle("hidden", T.mode === "spell" || T.mode === "listen");
    $("#lopt").classList.toggle("hidden", T.mode !== "listen");
    const ws = filterWords(ctx, S.filter);
    const unk = ws.filter(w => !S.known[w.id]), kn = ws.filter(w => S.known[w.id]);
    deck = [...shuffle(unk), ...shuffle(kn)];
    if (+T.size) deck = deck.slice(0, +T.size);
    pos = 0; score = { r: 0, t: 0 }; missed = [];
    if (!deck.length) { st.innerHTML = `<p class="big">Нет слов</p><p class="sub">Выбери другую категорию или сбрось фильтры.</p>`; return; }
    if (T.mode === "listen" && !canSpeak()) { st.innerHTML = `<p class="big">Нет озвучки</p><p class="sub">Этот браузер не умеет читать вслух. Попробуй Chrome или Safari.</p>`; return; }
    show();
  }

  function finish() {
    const res = T.mode === "cards" ? `Прошли ${deck.length} карточек` : `Результат: ${score.r} из ${score.t}`;
    st.innerHTML = `<p class="big">Готово</p><p class="sub">${res}</p>
      ${missed.length ? `<div style="text-align:left;width:100%;max-width:520px"><p class="score">Повторить:</p>${[...new Set(missed)].map(w => `<div class="phr">${sayBtn(w.en)}<b>${esc(w.en)}</b><small>${esc(w.ru)}</small></div>`).join("")}</div>` : ""}
      <button class="btn" id="again" type="button">Ещё раунд</button>`;
    $("#again").onclick = start;
  }

  function options(w, field) {
    const val = x => field === "en" ? x.en : x.ru;
    const pool = ctx.vocab.filter(x => x.id !== w.id && val(x) !== val(w));
    const same = shuffle(pool.filter(x => x.c === w.c));
    const rest = shuffle(pool.filter(x => x.c !== w.c));
    const picked = [];
    for (const x of [...same, ...rest]) { if (picked.length === 3) break; if (!picked.some(p => val(p) === val(x))) picked.push(x); }
    return shuffle([w, ...picked]).map(o => `<button class="opt" type="button" data-id="${esc(o.id)}">${esc(val(o))}</button>`).join("");
  }

  function choose(w, onDone) {
    let locked = false;
    $$(".opt", st).forEach(b => b.onclick = () => {
      if (locked) return; locked = true;
      const ok = b.dataset.id === w.id;
      record(w, ok);
      $$(".opt", st).forEach(x => { if (x.dataset.id === w.id) x.classList.add("right"); });
      if (!ok) b.classList.add("bad");
      onDone(ok);
      const next = document.createElement("button");
      next.className = "btn"; next.type = "button"; next.textContent = "Дальше →";
      next.onclick = () => { pos++; show(); };
      st.append(next); next.focus();
      if (ok) setTimeout(() => { if (next.isConnected) { pos++; show(); } }, 1400);
    });
  }

  function show() {
    if (pos >= deck.length) return finish();
    const w = deck[pos];
    const prog = `<p class="score">${pos + 1} / ${deck.length}${T.mode !== "cards" ? ` · верно ${score.r}` : ""}</p>`;

    if (T.mode === "cards") {
      st.innerHTML = `${prog}<p class="big">${esc(front(w))}</p>${T.dir === "en" ? pron(w) : ""}
        <div id="bk" class="hidden"><p style="font-size:20px;margin:0 0 6px">${esc(back(w))}</p>${T.dir === "ru" ? pron(w) : ""}<p class="sub">${esc(w.ex)}</p></div>
        <div class="row" style="justify-content:center"><button class="btn ghost" id="flip" type="button">Показать</button>${sayBtn(w.en)}</div>
        <div class="row hidden" id="rate" style="justify-content:center"><button class="btn ghost" id="again1" type="button">Повторить</button><button class="btn" id="know" type="button">Знаю</button></div>`;
      $("#flip").onclick = () => { $("#bk").classList.remove("hidden"); $("#rate").classList.remove("hidden"); $("#flip").classList.add("hidden"); if (T.dir === "ru") speak(w.en); $("#know").focus(); };
      $("#know").onclick = () => { S.known[w.id] = true; S.save(); pos++; show(); };
      $("#again1").onclick = () => { delete S.known[w.id]; S.save(); deck.push(w); pos++; show(); };
      if (T.dir === "en") speak(w.en);

    } else if (T.mode === "quiz") {
      st.innerHTML = `${prog}<p class="big">${esc(front(w))}</p>${T.dir === "en" ? pron(w) : ""}<div class="opts">${options(w, T.dir === "en" ? "ru" : "en")}</div><p class="fb" id="fb"></p>`;
      choose(w, ok => {
        $("#fb").className = "fb " + (ok ? "ok" : "no");
        $("#fb").textContent = ok ? "Right!" : `Запомни: ${w.en} — ${w.ru}`;
        speak(w.en);
      });

    } else if (T.mode === "listen") {
      st.innerHTML = `${prog}<button class="play" id="play" type="button" aria-label="Послушать ещё раз">🔊</button>
        <div class="row" style="justify-content:center"><button class="btn ghost small" id="slow" type="button">🐢 Медленно</button></div>
        <div class="opts">${options(w, T.lopt)}</div><div id="reveal"></div><p class="fb" id="fb"></p>`;
      $("#play").onclick = () => speak(w.en);
      $("#slow").onclick = () => speak(w.en, true);
      speak(w.en);
      choose(w, ok => {
        $("#fb").className = "fb " + (ok ? "ok" : "no");
        $("#fb").textContent = ok ? "Right!" : "Не то — послушай ещё раз";
        $("#reveal").innerHTML = `<p class="big" style="font-size:24px">${esc(w.en)}</p>${pron(w)}<p class="sub">${esc(w.ru)}</p>`;
        if (!ok) speak(w.en, true);
      });

    } else {
      const hint = w.ex ? esc(w.ex.replace(new RegExp(target(w).split(/\s[–/]\s/)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), "_____")) : "Напиши по-английски";
      st.innerHTML = `${prog}<p class="big">${esc(w.ru)}</p><p class="sub">${hint}</p>
        <input class="spell" id="sIn" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Ответ по-английски">
        <div class="row" style="justify-content:center"><button class="btn" id="chk" type="button">Проверить</button><button class="btn ghost" id="hear" type="button">🔊 Подсказка</button><button class="btn ghost" id="skip" type="button">Не знаю</button></div><p class="fb" id="fb"></p>`;
      const inp = $("#sIn"); inp.focus();
      const norm = s => s.toLowerCase().replace(/[’']/g, "'").replace(/[–—-]/g, "-").replace(/[?!.,…]/g, "").replace(/\s*([-/])\s*/g, "$1").replace(/\s+/g, " ").trim();
      const next = () => { pos++; show(); };
      const done = ok => {
        record(w, ok);
        $("#fb").className = "fb " + (ok ? "ok" : "no");
        $("#fb").innerHTML = ok ? "Correct!" : `Правильно: ${esc(target(w))} <span class="sub">[${esc(w.ipa)}]</span>`;
        speak(target(w));
        inp.readOnly = true;
        $("#chk").textContent = "Дальше →"; $("#chk").onclick = next; $("#chk").focus();
        $("#skip").classList.add("hidden"); $("#hear").classList.add("hidden");
        inp.onkeydown = e => { if (e.key === "Enter") next(); };
      };
      $("#hear").onclick = () => speak(target(w), true);
      $("#chk").onclick = () => done(norm(inp.value) === norm(target(w)));
      $("#skip").onclick = () => done(false);
      inp.onkeydown = e => { if (e.key === "Enter") $("#chk").click(); };
    }
  }

  $$("[data-mode]").forEach(b => b.onclick = () => { T.mode = b.dataset.mode; S.save(); start(); });
  ["#dir", "#lopt", "#size"].forEach(id => $(id).addEventListener("input", () => {
    T.dir = $("#dir").value; T.lopt = $("#lopt").value; T.size = $("#size").value; S.save(); start();
  }));
  filterBar(ctx, $("#filters"), start);
  start();
});
