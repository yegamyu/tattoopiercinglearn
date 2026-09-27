import { $, esc, boot } from "./core.js";

boot("howto", ctx => {
  const { student } = ctx;
  const total = student.lesson.reduce((n, p) => n + p.min, 0);
  $("#howto").innerHTML = `
    <p class="note">${esc(student.goal)}</p>
    <h2>Урок · ${total} минут</h2>
    <p class="note" style="margin-bottom:6px">${esc(student.schedule)}.</p>
    <div class="lesson" role="img" aria-label="${esc(student.lesson.map(p => `${p.t} ${p.min} минут`).join(", "))}">
      ${student.lesson.map(p => `<div style="flex:${p.min}">${p.min}′</div>`).join("")}
    </div>
    <dl class="lessonparts">${student.lesson.map(p => `<dt>${p.min}′</dt><dd><b>${esc(p.t)}</b> — ${esc(p.d)}</dd>`).join("")}</dl>
    <h2>Инструменты</h2>
    <p class="note">Что нужно запомнить — в Quizlet; что нужно исправить — в Google Docs; что нужно сказать — на Meet.</p>
    <div class="tools">${(student.tools || []).map(t => `<div class="tool"><h3>${esc(t.t)}</h3>${t.d.map(x => `<p>${esc(x)}</p>`).join("")}</div>`).join("")}</div>
    <h2>Quizlet из словаря</h2>
    <p class="note">Словарь → фильтр по категории или модулю → «Экспорт в Quizlet» → выбери разделитель (TAB или « - ») → «Скопировать» → в Quizlet: Создать → Импорт → вставить. Один набор на категорию.</p>
    <h2>Прогресс</h2>
    <p class="note">Отметки «знаю», цели маршрута и реестр ошибок хранятся только в этом браузере, отдельно для каждого ученика. На другом устройстве или домене прогресс начнётся заново.</p>`;
});
