import { $, $$, esc, boot, shuffle, speak, sayBtn } from "./core.js";

// Английская часть «правильного» варианта для озвучки: без [транскрипции] и русских пояснений.
const spoken = s => s.replace(/\[.*?\]/g, "").replace(/[—–-]\s*«.*?»/g, "").replace(/[а-яё«»]+/gi, "").replace(/\s+/g, " ").trim();

boot("errors", ctx => {
  const { student, S } = ctx;
  const errs = student.errors || [];
  const E = i => S.errs[i] ??= { fixed: false, ok: 0, tries: 0 };

  const render = () => {
    if (!errs.length) { $("#errs").innerHTML = `<p class="note">Реестр пока пуст — ошибки появятся после первых уроков (поле <code>errors</code> в файле ученика).</p>`; $("#fixStart").classList.add("hidden"); return; }
    const order = errs.map((e, i) => i).sort((a, b) => (S.errs[a]?.fixed ? 1 : 0) - (S.errs[b]?.fixed ? 1 : 0));
    $("#errs").innerHTML = order.map(i => {
      const e = errs[i], s = S.errs[i] || {};
      return `<div class="err ${s.fixed ? "fixed" : ""}">
        <span class="x">❌ <s>${esc(e.wrong)}</s></span>
        <span class="ok">✅ ${esc(e.right)} ${spoken(e.right) ? sayBtn(spoken(e.right)) : ""}</span>
        <small>${esc(e.why)}${e.typical ? " · типичная ошибка, проверить на уроке" : ""}</small>
        <div class="meta"><label class="row" style="gap:6px"><input type="checkbox" data-fix="${i}" ${s.fixed ? "checked" : ""}> Ушла из речи</label>
        ${s.tries ? `<span>· упражнение: ${s.ok} из ${s.tries}</span>` : ""}</div>
      </div>`;
    }).join("");
    $$("[data-fix]").forEach(c => c.onchange = () => { E(c.dataset.fix).fixed = c.checked; S.save(); render(); });
  };

  // ---------- упражнение «исправь ошибку» ----------
  let deck = [], pos = 0, right = 0;
  const st = $("#stage");
  function start() {
    const active = errs.map((e, i) => i).filter(i => !S.errs[i]?.fixed);
    deck = shuffle(active.length ? active : errs.map((e, i) => i));
    pos = 0; right = 0;
    st.classList.remove("hidden");
    show();
    st.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function show() {
    if (pos >= deck.length) {
      st.innerHTML = `<p class="big">Готово</p><p class="sub">Исправлено сразу: ${right} из ${deck.length}</p>
        <div class="row" style="justify-content:center"><button class="btn" id="again" type="button">Ещё раз</button><button class="btn ghost" id="close" type="button">Закрыть</button></div>`;
      $("#again").onclick = start; $("#close").onclick = () => st.classList.add("hidden");
      return;
    }
    const i = deck[pos], e = errs[i];
    st.innerHTML = `<p class="score">${pos + 1} / ${deck.length}</p><p class="sub">Найди и исправь ошибку — скажи вслух или напиши:</p>
      <p class="big" style="font-size:clamp(20px,5vw,28px);color:var(--red)">${esc(e.wrong)}</p>
      <input class="spell" id="fixIn" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Правильный вариант" placeholder="Как правильно?">
      <button class="btn" id="showR" type="button">Показать ответ</button>
      <div id="ans" class="hidden"><p style="font-size:20px;color:var(--green);font-weight:600;margin:0 0 6px">✅ ${esc(e.right)}</p><p class="sub">${esc(e.why)}</p></div>
      <div class="row hidden" id="rate" style="justify-content:center"><button class="btn ghost" id="no" type="button">❌ Ещё ошибаюсь</button><button class="btn" id="yes" type="button">✅ Исправил сам</button></div>`;
    $("#fixIn").focus();
    $("#fixIn").onkeydown = ev => { if (ev.key === "Enter") $("#showR").click(); };
    $("#showR").onclick = () => { $("#ans").classList.remove("hidden"); $("#rate").classList.remove("hidden"); $("#showR").classList.add("hidden"); if (spoken(e.right)) speak(spoken(e.right)); };
    const rate = ok => { const s = E(i); s.tries++; if (ok) { s.ok++; right++; } S.save(); render(); pos++; show(); };
    $("#yes").onclick = () => rate(true); $("#no").onclick = () => rate(false);
  }
  $("#fixStart").onclick = start;
  render();
});
