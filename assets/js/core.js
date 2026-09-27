// Общий код всех страниц: загрузка данных, текущий ученик, прогресс, шапка, озвучка.

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const CUR_KEY = "te:current";
const THEME_KEY = "te:theme";

function lsGet(k, fallback) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим — прогресс не сохранится */ } }

const cache = {};
export async function getJSON(path) {
  if (!cache[path]) cache[path] = fetch(path, { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(path + ": " + r.status); return r.json(); });
  return cache[path];
}

export async function loadStudents() {
  const idx = await getJSON("data/students/index.json");
  return Promise.all(idx.students.map(id => getJSON(`data/students/${id}.json`)));
}

// ---------- прогресс ученика (localStorage, ключ на ученика) ----------
export function store(id) {
  const key = "te:" + id;
  const s = lsGet(key, {});
  s.known ??= {}; s.goals ??= {}; s.errs ??= {}; s.filter ??= {}; s.train ??= {}; s.export ??= {};
  s.save = () => { const { save, ...data } = s; lsSet(key, data); };
  return s;
}

// ---------- контекст страницы ----------
// Возвращает { student, course, vocab, cats, sources, S, moduleOf } или null, если ученик не выбран.
export async function loadContext() {
  const url = new URLSearchParams(location.search);
  const students = await loadStudents();
  let id = url.get("s") || lsGet(CUR_KEY, null);
  let student = students.find(s => s.id === id);
  if (!student) { location.replace("index.html"); return null; }
  lsSet(CUR_KEY, student.id);

  const [course, vocabData] = await Promise.all([getJSON(`data/courses/${student.course}.json`), getJSON("data/vocab.json")]);
  const merged = { ...course, ...Object.fromEntries(["route", "modules", "categories"].filter(k => student[k]).map(k => [k, student[k]])) };
  const cats = merged.categories;
  const vocab = vocabData.words.filter(w => cats.includes(w.c));
  // модуль слова: для «родных» слов курса — поле m, для остальных — первый модуль, где есть его категория
  const byCat = {};
  merged.modules.forEach(m => (m.c || []).forEach(c => { byCat[c] ??= m.n; }));
  const moduleOf = w => (w.track === merged.id ? w.m : byCat[w.c]) ?? null;
  vocab.forEach(w => { w.mod = moduleOf(w); });

  return { students, student, course: merged, vocab, cats: vocabData.cats, catOrder: cats, sources: vocabData.sources, S: store(student.id) };
}

export const link = (page, ctx, extra = "") => `${page}?s=${encodeURIComponent(ctx.student.id)}${extra}`;

// ---------- тема ----------
export function applyTheme() {
  const t = lsGet(THEME_KEY, "auto");
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  return t;
}
function themeButton() {
  const labels = { auto: "◐ Авто", light: "☀ Светлая", dark: "☾ Тёмная" };
  const b = document.createElement("button");
  b.className = "chip"; b.type = "button"; b.setAttribute("aria-label", "Тема оформления");
  const set = () => { b.textContent = labels[applyTheme()]; };
  b.onclick = () => { const order = ["auto", "light", "dark"]; lsSet(THEME_KEY, order[(order.indexOf(lsGet(THEME_KEY, "auto")) + 1) % 3]); set(); };
  set();
  return b;
}

// ---------- шапка и навигация ----------
const PAGES = [
  ["route", "Маршрут"], ["modules", "Модули"], ["dict", "Словарь"], ["train", "Тренажёр"], ["errors", "Ошибки"], ["howto", "Как работаем"],
];
export function renderChrome(ctx, active) {
  const top = $("#top");
  top.innerHTML = `<a class="brand" href="index.html">${esc(ctx ? ctx.course.title : "Tattoo English")}</a><span class="grow"></span>`;
  if (ctx) {
    const sel = document.createElement("select");
    sel.className = "chip"; sel.setAttribute("aria-label", "Ученик");
    sel.innerHTML = ctx.students.map(s => `<option value="${esc(s.id)}" ${s.id === ctx.student.id ? "selected" : ""}>${esc(s.emoji || "")} ${esc(s.name)} · ${esc(s.level)}</option>`).join("");
    sel.onchange = () => { location.href = `${active}.html?s=${encodeURIComponent(sel.value)}`; };
    top.append(sel);
  }
  top.append(themeButton());
  const nav = $("#nav");
  if (nav && ctx) {
    nav.innerHTML = PAGES.map(([p, t]) => `<a href="${link(p + ".html", ctx)}" ${p === active ? 'aria-current="page"' : ""}>${t}</a>`).join("");
    const cur = $("[aria-current]", nav);
    if (cur) cur.scrollIntoView({ block: "nearest", inline: "center" });
  }
}

export function fail(err) {
  console.error(err);
  const m = document.querySelector("main") || document.body;
  m.innerHTML = `<p class="note">Не удалось загрузить данные (${esc(err.message)}). Если открываешь файл напрямую с диска, запусти локальный сервер: <code>python3 -m http.server</code> и открой <code>http://localhost:8000</code>.</p>`;
}

// ---------- озвучка (Web Speech API, en-GB) ----------
let voice = null;
function pickVoice() {
  if (!("speechSynthesis" in window)) return;
  const vs = speechSynthesis.getVoices();
  voice = vs.find(v => /^en[-_]GB/i.test(v.lang) && /google|natural|premium|enhanced/i.test(v.name))
    || vs.find(v => /^en[-_]GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
}
if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.addEventListener?.("voiceschanged", pickVoice); }
export const canSpeak = () => "speechSynthesis" in window;
export function speak(text, slow = false) {
  if (!canSpeak()) return;
  try {
    const t = String(text).replace(/\(.*?\)|\[.*?\]/g, "").replace(/…/g, "").replace(/\s[–/]\s/g, ", ");
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "en-GB"; u.rate = slow ? 0.6 : 0.9;
    if (voice) u.voice = voice;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { /* нет голоса — молча */ }
}
// Делегирование: любой элемент с data-say произносит текст.
document.addEventListener("click", e => {
  const b = e.target.closest("[data-say]");
  if (b) speak(b.dataset.say, b.hasAttribute("data-slow"));
});
export const sayBtn = (text, label = "Произнести") => `<button class="say" type="button" data-say="${esc(text)}" aria-label="${esc(label)}: ${esc(text)}">🔊</button>`;

// ---------- общий фильтр словаря (словарь и тренажёр) ----------
export function filterWords(ctx, f) {
  const q = (f.q || "").trim().toLowerCase();
  return ctx.vocab.filter(w =>
    (!f.c || f.c === "all" || w.c === f.c) &&
    (!f.m || f.m === "all" || String(w.mod) === String(f.m)) &&
    (!f.src || f.src === "all" || w.src.includes(f.src)) &&
    (!f.st || f.st === "all" || (f.st === "new" ? !ctx.S.known[w.id] : !!ctx.S.known[w.id])) &&
    (!q || w.en.toLowerCase().includes(q) || w.ru.toLowerCase().includes(q) || (w.tr || "").toLowerCase().includes(q)));
}

// Рисует селекты фильтра в контейнере; onChange вызывается при изменении. Параметры URL (?c=, ?m=) имеют приоритет.
export function filterBar(ctx, box, onChange, { search = true } = {}) {
  const f = ctx.S.filter;
  const url = new URLSearchParams(location.search);
  if (url.has("m") || url.has("c")) { f.q = ""; f.src = "all"; f.st = "all"; f.c = url.get("c") || "all"; f.m = url.get("m") || "all"; ctx.S.save(); }
  const mods = [...new Set(ctx.vocab.map(w => w.mod).filter(m => m != null))].sort((a, b) => a - b);
  const srcs = Object.entries(ctx.sources).filter(([k]) => ctx.vocab.some(w => w.src.includes(k)));
  const opt = (v, t, cur) => `<option value="${esc(v)}" ${String(cur ?? "all") === String(v) ? "selected" : ""}>${esc(t)}</option>`;
  box.innerHTML = `
    ${search ? `<input id="fq" type="search" placeholder="Поиск: английский, русский, транскрипция" aria-label="Поиск" value="${esc(f.q || "")}">` : ""}
    <select id="fc" aria-label="Категория">${opt("all", "Все категории", f.c)}${ctx.catOrder.filter(c => ctx.vocab.some(w => w.c === c)).map(c => opt(c, ctx.cats[c], f.c)).join("")}</select>
    <select id="fm" aria-label="Модуль">${opt("all", "Все модули", f.m)}${mods.map(m => opt(m, "Модуль " + m, f.m)).join("")}</select>
    <select id="fs" aria-label="Источник">${opt("all", "Все наборы", f.src)}${srcs.map(([k, v]) => opt(k, v, f.src)).join("")}</select>
    <select id="ft" aria-label="Статус">${opt("all", "Все слова", f.st)}${opt("new", "Невыученные", f.st)}${opt("known", "Выученные", f.st)}</select>`;
  const upd = () => {
    f.q = $("#fq", box)?.value || ""; f.c = $("#fc", box).value; f.m = $("#fm", box).value; f.src = $("#fs", box).value; f.st = $("#ft", box).value;
    ctx.S.save(); onChange();
  };
  $$("input,select", box).forEach(el => el.addEventListener("input", upd));
}

export function scopeLabel(ctx) {
  const f = ctx.S.filter, parts = [];
  parts.push(f.c && f.c !== "all" ? ctx.cats[f.c] : "все категории");
  if (f.m && f.m !== "all") parts.push("модуль " + f.m);
  if (f.src && f.src !== "all") parts.push(ctx.sources[f.src]);
  if (f.st === "new") parts.push("невыученные"); else if (f.st === "known") parts.push("выученные");
  if (f.q) parts.push(`поиск «${f.q}»`);
  return parts.join(", ");
}

// Одна точка входа для страниц: тема, данные, шапка, обработка ошибок.
export async function boot(page, render) {
  applyTheme();
  try {
    const ctx = await loadContext();
    if (!ctx) return;
    renderChrome(ctx, page);
    document.title = `${document.title} · ${ctx.student.name}`;
    await render(ctx);
  } catch (e) { fail(e); }
}
