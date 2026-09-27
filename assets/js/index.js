import { $, esc, applyTheme, renderChrome, loadStudents, getJSON, store, fail } from "./core.js";

applyTheme();
renderChrome(null, "index");
(async () => {
  try {
    const [students, vocab] = await Promise.all([loadStudents(), getJSON("data/vocab.json")]);
    const cards = await Promise.all(students.map(async st => {
      const course = await getJSON(`data/courses/${st.course}.json`);
      const cats = st.categories || course.categories;
      const route = st.route || course.route;
      const words = vocab.words.filter(w => cats.includes(w.c));
      const S = store(st.id);
      const known = words.filter(w => S.known[w.id]).length;
      const goals = route.reduce((n, r) => n + r.goals.length, 0);
      const done = route.reduce((n, r) => n + r.goals.filter((_, i) => S.goals[r.k + i]).length, 0);
      return `<a class="stu" href="route.html?s=${encodeURIComponent(st.id)}">
        <span class="em" aria-hidden="true">${esc(st.emoji || "🖋️")}</span>
        <h3>${esc(st.name)}<span class="lvl">${esc(st.level)}</span>${st.status === "potential" ? '<span class="lvl warn">пока не решено</span>' : ""}</h3>
        <p>${esc(course.title)}${st.interest ? ` · интерес: ${esc(st.interest)}` : ""}</p>
        <p>${esc(st.schedule)}</p>
        <div class="stat"><span>Слова</span><span>${known} / ${words.length}</span></div>
        <div class="bar" aria-hidden="true"><i style="width:${words.length ? known / words.length * 100 : 0}%"></i></div>
        <div class="stat"><span>Цели маршрута</span><span>${done} / ${goals}</span></div>
        <div class="bar" aria-hidden="true"><i style="width:${goals ? done / goals * 100 : 0}%"></i></div>
      </a>`;
    }));
    $("#students").innerHTML = cards.join("");
  } catch (e) { fail(e); }
})();
