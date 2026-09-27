import { $, esc, boot, link, sayBtn } from "./core.js";

boot("modules", ctx => {
  $("#mods").innerHTML = ctx.course.modules.map(m => {
    const cnt = ctx.vocab.filter(w => w.mod === m.n).length;
    const blocks = (m.blocks || []).map(b => `<div class="block"><h4>${esc(b.title)}</h4>
      ${b.items.map(it => `<div class="phr">${sayBtn(it.en)}<b>${esc(it.en)}</b><small>${esc(it.ru)}${it.note ? ` · <i>${esc(it.note)}</i>` : ""}</small></div>`).join("")}</div>`).join("");
    return `<details><summary><span class="n">${m.n}</span><span class="t">${esc(m.t)}<span class="lvl">${esc(m.l)}</span></span><span class="w">${esc(m.w)}</span></summary>
      <div class="modbody"><dl><dt>Грамматика</dt><dd>${esc(m.g)}</dd><dt>Лексика</dt><dd>${esc(m.v)}</dd><dt>Ситуация</dt><dd>${esc(m.sit)}</dd><dt>Итоговое ДЗ</dt><dd>${esc(m.hw)}</dd></dl>
      ${blocks}
      ${cnt ? `<div class="row"><a class="btn small" href="${link("dict.html", ctx, "&m=" + m.n)}">Слова модуля (${cnt})</a><a class="btn ghost small" href="${link("train.html", ctx, "&m=" + m.n)}">Тренировать</a></div>`
        : `<p class="note" style="margin:0">Словарь модуля соберём вместе ближе к старту — из реальных сообщений и постов.</p>`}</div></details>`;
  }).join("");
});
