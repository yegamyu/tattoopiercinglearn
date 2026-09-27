import { $, esc, boot, link, sayBtn, filterBar, filterWords } from "./core.js";

boot("dict", ctx => {
  const { S } = ctx;
  const X = S.export;
  X.sep ??= "tab"; X.dir ??= "en"; X.tr ??= "ipa"; X.ex ??= false;
  $("#xSep").value = X.sep; $("#xDir").value = X.dir; $("#xTr").value = X.tr; $("#xEx").checked = X.ex;

  const render = () => {
    const ws = filterWords(ctx, S.filter);
    const k = ws.filter(w => S.known[w.id]).length;
    $("#count").textContent = `${ws.length} слов · знаю ${k}`;
    $("#words").innerHTML = ws.map(w => `<div class="word ${S.known[w.id] ? "known" : ""}">
      ${sayBtn(w.en)}
      <div><div class="en">${esc(w.en)}</div>
        <div class="pr">[${esc(w.ipa)}] <span>· ${esc(w.tr)}</span></div>
        <div class="ru">${esc(w.ru)}</div>
        ${w.ex ? `<div class="ex"><button class="say mini" type="button" data-say="${esc(w.ex)}" aria-label="Произнести пример">▶</button>${esc(w.ex)}</div>` : ""}
        <div class="tags">${esc(ctx.cats[w.c])}${w.mod ? ` · модуль ${w.mod}` : ""} · ${w.src.map(s => esc(ctx.sources[s])).join(", ")}</div>
      </div>
      <button class="mark" type="button" data-k="${esc(w.id)}" aria-pressed="${!!S.known[w.id]}">${S.known[w.id] ? "✓ знаю" : "знаю"}</button>
    </div>`).join("") || `<p class="note" style="padding-top:12px">Ничего не найдено — сбрось фильтры.</p>`;
    $("#trainLink").href = link("train.html", ctx);
    if (!$("#exportBox").classList.contains("hidden")) fillExport(ws);
  };

  // ---------- экспорт в Quizlet ----------
  const clean = (s, sep) => sep === "dash" ? String(s).replace(/ - /g, " – ") : String(s).replace(/\t/g, " ");
  function line(w) {
    const pron = { ipa: `[${w.ipa}]`, ru: `(${w.tr})`, both: `[${w.ipa}] (${w.tr})`, none: "" }[X.tr];
    const en = [w.en, pron].filter(Boolean).join(" ");
    const ru = w.ru + (X.ex && w.ex ? ` — ${w.ex}` : "");
    const [term, def] = X.dir === "en" ? [en, ru] : [ru, en];
    return clean(term, X.sep) + (X.sep === "tab" ? "\t" : " - ") + clean(def, X.sep);
  }
  function fillExport(ws = filterWords(ctx, S.filter)) {
    $("#exportText").value = ws.map(line).join("\n");
    $("#xHelp").textContent = `${ws.length} карточек. Quizlet → Создать → Импорт → вставь текст. «Между термином и определением»: ${X.sep === "tab" ? "Табуляция" : "Свой вариант: « - » (пробел, дефис, пробел)"}; «Между карточками»: Новая строка.`;
  }
  $("#exportBtn").onclick = () => {
    const box = $("#exportBox"); box.classList.toggle("hidden");
    $("#exportBtn").setAttribute("aria-expanded", !box.classList.contains("hidden"));
    fillExport();
  };
  ["#xSep", "#xDir", "#xTr", "#xEx"].forEach(id => $(id).addEventListener("input", () => {
    X.sep = $("#xSep").value; X.dir = $("#xDir").value; X.tr = $("#xTr").value; X.ex = $("#xEx").checked; S.save(); fillExport();
  }));
  $("#copyBtn").onclick = async () => {
    const t = $("#exportText");
    try { await navigator.clipboard.writeText(t.value); $("#copyMsg").textContent = "Скопировано"; }
    catch (e) { t.select(); try { document.execCommand("copy"); $("#copyMsg").textContent = "Скопировано"; } catch (_) { $("#copyMsg").textContent = "Выделено — нажми Ctrl+C / ⌘C"; } }
  };
  $("#dlBtn").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([$("#exportText").value], { type: "text/plain;charset=utf-8" }));
    a.download = `quizlet-${ctx.student.id}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  $("#words").addEventListener("click", e => {
    const k = e.target.closest("[data-k]");
    if (k) { S.known[k.dataset.k] = !S.known[k.dataset.k]; if (!S.known[k.dataset.k]) delete S.known[k.dataset.k]; S.save(); render(); }
  });

  filterBar(ctx, $("#filters"), render);
  render();
});
