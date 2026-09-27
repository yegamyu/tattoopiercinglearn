import { $, $$, esc, boot } from "./core.js";

boot("route", ctx => {
  const { course, student, S } = ctx;
  $("#plan").textContent = `${course.subtitle}. ${student.schedule}. Отмечай цели по мере выполнения — точка на линии закрасится, когда закрыт весь этап.`;

  const render = () => {
    const total = course.route.reduce((n, r) => n + r.goals.length, 0);
    const done = course.route.reduce((n, r) => n + r.goals.filter((_, i) => S.goals[r.k + i]).length, 0);
    const known = ctx.vocab.filter(w => S.known[w.id]).length;
    $("#summary").innerHTML = `
      <div><b>${done} / ${total}</b><span>целей выполнено</span><div class="bar"><i style="width:${done / total * 100}%"></i></div></div>
      <div><b>${known} / ${ctx.vocab.length}</b><span>слов выучено</span><div class="bar"><i style="width:${known / ctx.vocab.length * 100}%"></i></div></div>`;
    $("#road").innerHTML = course.route.map(r => {
      const d = r.goals.filter((_, i) => S.goals[r.k + i]).length;
      return `<div class="stop ${d === r.goals.length ? "done" : ""}"><span class="dot">${esc(r.n)}</span>
        <h3>${esc(r.t)}<small>${esc(r.when)}</small></h3>
        <div class="cols">
          <div><h4>Грамматика</h4><ul>${r.g.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
          <div><h4>Умею делать</h4><ul>${r.s.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
          <div class="checks"><h4>Цели-проверки · ${d}/${r.goals.length}</h4>
            ${r.goals.map((x, i) => `<label class="${S.goals[r.k + i] ? "on" : ""}"><input type="checkbox" data-g="${esc(r.k + i)}" ${S.goals[r.k + i] ? "checked" : ""}><span>${esc(x)}</span></label>`).join("")}
            <div class="bar" aria-hidden="true"><i style="width:${d / r.goals.length * 100}%"></i></div></div>
        </div></div>`;
    }).join("");
    $$("[data-g]").forEach(c => c.onchange = () => { S.goals[c.dataset.g] = c.checked; S.save(); render(); });
  };
  render();
});
