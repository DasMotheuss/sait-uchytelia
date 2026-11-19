/* Сайт-гайд: рушій. Тексти тут не правляться, вони лежать у папці content/. */
(function () {
  "use strict";

  var G = window.GUIDE;
  var D = G.data;
  var cfg = D.config || {};
  var DRAFT = cfg.draft !== false;
  var MODULES = [1, 2, 3, 4, 5, 6];
  var VARIANTS = ["klas", "vizytivka", "portfolio"];
  var COMPONENTS = ["motyv", "znannia", "diyalnist"];
  var COMPONENT_LABELS = {
    motyv: "Мотиваційний компонент",
    znannia: "Знаннєвий компонент",
    diyalnist: "Діяльнісний компонент"
  };
  var main = document.getElementById("main");

  /* ------------------------------------------------------------ сховище */

  var KEY = "sg.v1";
  var state = {};
  try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { state = {}; }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* приватний режим */ }
  }
  function box(name) {
    if (!state[name] || typeof state[name] !== "object") state[name] = {};
    return state[name];
  }

  /* ------------------------------------------------------------ копія нотаток */

  var EXPORT_APP = "sait-hayd";
  var BACKUP_KEY = KEY + ".before-import";
  var ioFlash = "";      // повідомлення, яке показуємо в "Моїх даних" після перемальовування
  var ioFlashBad = false;

  function plainObj(x) { return x && typeof x === "object" && !Array.isArray(x) ? x : {}; }
  function safeKeys(o) {
    return Object.keys(o).filter(function (k) {
      return k !== "__proto__" && k !== "constructor" && k !== "prototype";
    }).slice(0, 300);
  }
  function numOrNull(x) { return typeof x === "number" && isFinite(x) ? x : null; }

  // Пропускає з файла тільки те, що рушій уміє показати. Чужий або зіпсований вміст відкидається.
  function cleanState(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    var out = {};

    var notes = plainObj(raw.notes);
    out.notes = {};
    safeKeys(notes).forEach(function (k) {
      var v = notes[k];
      if (typeof v === "number") v = String(v);
      if (typeof v === "string" && v) out.notes[k] = v.slice(0, 20000);
    });

    var quiz = plainObj(raw.quiz);
    out.quiz = {};
    safeKeys(quiz).forEach(function (k) {
      if (Array.isArray(quiz[k])) out.quiz[k] = quiz[k].slice(0, 50).map(numOrNull);
    });

    var steps = plainObj(raw.steps);
    out.steps = {};
    safeKeys(steps).forEach(function (k) { if (steps[k] === true) out.steps[k] = true; });

    var checks = plainObj(raw.checks);
    out.checks = {};
    safeKeys(checks).forEach(function (k) {
      if (Array.isArray(checks[k])) out.checks[k] = checks[k].slice(0, 100).map(function (x) { return x === true; });
    });

    var builder = plainObj(raw.builder);
    out.builder = {};
    VARIANTS.concat(["own"]).forEach(function (k) {
      if (Array.isArray(builder[k])) {
        out.builder[k] = builder[k].filter(function (x) { return typeof x === "string" && x.trim(); })
          .slice(0, 40).map(function (x) { return x.slice(0, 80); });
      }
    });

    var helper = plainObj(raw.helper);
    out.helper = {};
    if (Array.isArray(helper.answers)) out.helper.answers = helper.answers.slice(0, 20).map(numOrNull);
    if (typeof helper.type === "string") out.helper.type = helper.type.slice(0, 40);
    if (typeof helper.platform === "string") out.helper.platform = helper.platform.slice(0, 40);

    var diag = plainObj(raw.diag);
    out.diag = {};
    ["start", "finish"].forEach(function (kind) {
      var r = plainObj(diag[kind]), k = plainObj(r.k), a = plainObj(r.answers);
      var ok = COMPONENTS.concat(["overall"]).every(function (c) {
        return typeof k[c] === "number" && k[c] >= 0 && k[c] <= 1;
      }) && COMPONENTS.every(function (c) { return Array.isArray(a[c]); });
      if (!ok) return;
      var res = { k: {}, answers: {}, date: typeof r.date === "string" ? r.date.slice(0, 10) : "" };
      COMPONENTS.concat(["overall"]).forEach(function (c) { res.k[c] = k[c]; });
      COMPONENTS.forEach(function (c) { res.answers[c] = a[c].slice(0, 50).map(numOrNull); });
      out.diag[kind] = res;
    });

    if (VARIANTS.indexOf(raw.variant) >= 0) out.variant = raw.variant;
    if (typeof raw.code === "string" && raw.code.trim()) out.code = raw.code.trim().slice(0, 12);
    return out;
  }

  function hasData(s) {
    s = s || {};
    return ["notes", "quiz", "steps", "checks", "builder", "helper", "diag"].some(function (k) {
      return Object.keys(plainObj(s[k])).length > 0;
    }) || !!s.code;
  }

  function today() {
    var d = new Date();
    function two(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate());
  }
  // 2026-11-20 -> 20.11.2026
  function dateUa(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    return m ? m[3] + "." + m[2] + "." + m[1] : "";
  }

  function exportText() {
    return JSON.stringify({ app: EXPORT_APP, version: 1, saved: today(), data: cleanState(state) });
  }

  // Повертає { data, saved } або { error }.
  function parseImport(text) {
    var raw;
    text = String(text || "").trim();
    if (!text) return { error: "Порожньо: немає що відновлювати." };
    try { raw = JSON.parse(text); } catch (e) {
      return { error: "Не вдалося прочитати. Схоже, це не копія нотаток із цього гайду або текст скопійовано не повністю." };
    }
    if (!raw || raw.app !== EXPORT_APP || !raw.data) {
      return { error: "Це не копія нотаток із цього гайду." };
    }
    var data = cleanState(raw.data);
    if (!data || !hasData(data)) return { error: "У цій копії немає нотаток." };
    return { data: data, saved: typeof raw.saved === "string" ? raw.saved : "" };
  }

  // Повідомлення без перемальовування сторінки (щоб не стерти вставлений текст).
  function ioSay(msg, bad) {
    var el = document.getElementById("io-msg");
    if (!el) return;
    el.textContent = msg;
    el.className = "io-msg" + (bad ? " bad" : "");
    el.hidden = !msg;
  }

  function applyImport(text) {
    var res = parseImport(text);
    if (res.error) { ioSay(res.error, true); return; }
    if (hasData(state)) {
      var when = dateUa(res.saved);
      if (!window.confirm("Нотатки з копії" + (when ? " від " + when : "") +
        " замінять усе, що зараз є в Записнику на цьому пристрої. Продовжити?")) return;
      try { localStorage.setItem(BACKUP_KEY, JSON.stringify(state)); } catch (e) { /* не критично */ }
    }
    state = res.data;
    save();
    track("/podiia/notatky-vidnovleno", true);
    ioFlash = "Нотатки відновлено."; ioFlashBad = false;
    render(true);
  }

  function copyText(text, ok) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { copyFallback(text, ok); });
    } else {
      copyFallback(text, ok);
    }
  }
  function copyFallback(text, ok) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed"; ta.style.top = "0"; ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { if (document.execCommand("copy")) ok(); } catch (err) { /* нічого */ }
    document.body.removeChild(ta);
  }

  function downloadCopy() {
    var text = exportText();
    var name = "zapysnyk-" + today() + ".json";
    try {
      var blob = new Blob([text], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = name; a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
    } catch (e) {
      ioSay("Цей браузер не дав зберегти файл. Скористайтеся способом нижче: скопіюйте нотатки як текст.", true);
      return;
    }
    state.exportedAt = today(); save();
    track("/podiia/notatky-kopiia", true);
    ioFlash = "Копію збережено у файл " + name + ". Шукайте його в завантаженнях. Якщо файла там немає, скопіюйте нотатки як текст (спосіб нижче).";
    ioFlashBad = false;
    render(true);
  }

  /* ------------------------------------------------------------ текст */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Рядок із розміткою: **жирний**, [текст](посилання), службові позначки.
  function inline(s) {
    var t = esc(String(s == null ? "" : s).trim());

    t = t.replace(/\[ФОТО:\s*([\w.\-]+)\s*(?:\|\s*([^\]]*))?\]/g, function (m, file, cap) {
      cap = (cap || "").trim();
      return '<span class="photo"><img src="assets/img/' + file + '" alt="' + cap +
        '" loading="lazy" data-file="' + file + '">' +
        (cap ? '<span class="cap">' + cap + "</span>" : "") + "</span>";
    });
    t = t.replace(/\[СКРИНШОТ:\s*([^\]]*)\]/g, function (m, what) {
      return '<span class="shot"><b>Тут буде знімок екрана.</b> ' + what.trim() + "</span>";
    });
    t = t.replace(/\[ЗАПОВНИТИ([^\]]*)\]/g, function (m, brief) {
      brief = brief.replace(/^[:\s]+/, "").trim();
      return '<span class="mark mark-todo">Текст готується' +
        (DRAFT && brief ? ": " + brief : "") + "</span>";
    });
    t = t.replace(/\[(ПЕРЕВІРИТИ НОРМУ|ДЖЕРЕЛО\?|ДАНІ)\]/g, function (m, kind) {
      return DRAFT ? '<span class="mark mark-law">' + kind.toLowerCase() + "</span>" : "";
    });
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, text, url) {
      if (/^https?:\/\//.test(url)) {
        return '<a href="' + url + '" target="_blank" rel="noopener">' + text + "</a>";
      }
      if (/^(#\/|mailto:)/.test(url)) return '<a href="' + url + '">' + text + "</a>";
      return text;
    });
    return t;
  }

  // Текст із абзацами та списками. Абзаци розділяються порожнім рядком.
  function md(s) {
    var text = String(s == null ? "" : s).replace(/\r/g, "").trim();
    if (!text) return "";
    return text.split(/\n\s*\n/).map(function (block) {
      var lines = block.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) return "";
      if (lines.every(function (l) { return /^- /.test(l); })) {
        return "<ul>" + lines.map(function (l) { return "<li>" + inline(l.slice(2)) + "</li>"; }).join("") + "</ul>";
      }
      if (lines.every(function (l) { return /^\d+[.)]\s/.test(l); })) {
        return "<ol>" + lines.map(function (l) {
          return "<li>" + inline(l.replace(/^\d+[.)]\s/, "")) + "</li>";
        }).join("") + "</ol>";
      }
      return "<p>" + inline(lines.join(" ")) + "</p>";
    }).join("");
  }

  function arr(x) { return Array.isArray(x) ? x : []; }
  function mod(n) { return D["module-" + n]; }

  /* ------------------------------------------------------------ іконки */

  var TONES = ["mint", "sand", "sky"];
  // Іконки пʼяти частин модуля: Теза, Приклад, Крок, Перевір себе, Занотуй.
  var PART_ICONS = ["lightbulb", "message-square-quote", "footprints", "list-checks", "pen-line"];
  function icon(name, cls) {
    var body = (G.icons || {})[name];
    if (!body) return "";
    return '<svg class="ico' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + "</svg>";
  }
  function tile(name, tone, small) {
    return '<span class="ico-tile' + (small ? " sm" : "") + (tone ? " tone-" + tone : "") + '">' + icon(name) + "</span>";
  }
  // Українська множина: 1 сторінка, 2 сторінки, 5 сторінок.
  function plural(n, one, few, many) {
    var d = n % 10, h = n % 100;
    if (d === 1 && h !== 11) return one;
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
    return many;
  }

  /* ------------------------------------------------------------ рівні */

  function levelOf(k) {
    var levels = arr(cfg.levels).slice().sort(function (a, b) { return b.min - a.min; });
    for (var i = 0; i < levels.length; i++) if (k >= levels[i].min) return levels[i];
    return levels[levels.length - 1] || { id: "low", label: "початковий", min: 0 };
  }
  function pct(k) { return Math.round(k * 100); }

  /* ------------------------------------------------------------ прогрес */

  function moduleParts(n) {
    var m = mod(n) || {};
    var id = "m" + n;
    var quiz = arr(box("quiz")[id]);
    var total = arr(m.perevir).length;
    var answered = 0;
    for (var i = 0; i < total; i++) if (typeof quiz[i] === "number") answered++;
    var notes = box("notes");
    var fields = arr(m.zanotuy);
    var filled = fields.filter(function (f) { return String(notes[f.key] || "").trim(); }).length;
    return {
      quiz: total > 0 && answered === total,
      step: !!box("steps")[id],
      notes: fields.length > 0 && filled === fields.length,
      any: answered > 0 || filled > 0 || !!box("steps")[id]
    };
  }
  function moduleStatus(n) {
    var p = moduleParts(n);
    if (p.quiz && p.step && p.notes) return "done";
    return p.any ? "progress" : "none";
  }
  function stepStatus(id) {
    if (id === "start") return box("diag").start ? "done" : "none";
    if (id === "finish") return box("diag").finish ? "done" : "none";
    return moduleStatus(Number(id));
  }
  var STATUS_LABEL = { none: "Не розпочато", progress: "У роботі", done: "Виконано" };
  var STATUS_ICON = { none: "circle-dashed", progress: "pen-line", done: "check" };
  function chip(status) {
    return '<span class="chip chip-' + status + '">' + icon(STATUS_ICON[status]) + STATUS_LABEL[status] + "</span>";
  }
  var MODULE_ICONS = { 1: "target", 2: "blocks", 3: "list-tree", 4: "pencil-ruler", 5: "shield-check", 6: "rocket" };
  function routeSteps() {
    var steps = [{ id: "start", href: "#/start", icon: "compass", title: "Старт. Самодіагностика", result: "Ваш рівень і порада, з чого почати" }];
    MODULES.forEach(function (n) {
      var m = mod(n) || {};
      steps.push({ id: String(n), href: "#/modul/" + n, icon: MODULE_ICONS[n], title: "Модуль " + n + ". " + (m.title || ""), result: m.result || "", time: m.time || "" });
    });
    steps.push({ id: "finish", href: "#/finish", icon: "flag", title: "Фініш", result: "Підсумкова самодіагностика і \"Паспорт мого сайту\"" });
    return steps;
  }
  function nextStep() {
    var steps = routeSteps();
    for (var i = 0; i < steps.length; i++) if (stepStatus(steps[i].id) !== "done") return steps[i];
    return null;
  }

  /* ------------------------------------------------------------ лічильник відвідувань */

  var gcLoaded = false;
  function track(path, isEvent) {
    var code = cfg.analytics && cfg.analytics.goatcounter;
    if (!code) return;
    if (!gcLoaded) {
      gcLoaded = true;
      window.goatcounter = window.goatcounter || {};
      window.goatcounter.no_onload = true;
      var s = document.createElement("script");
      s.async = true;
      s.src = "https://gc.zgo.at/count.js";
      s.setAttribute("data-goatcounter", "https://" + code + ".goatcounter.com/count");
      s.onload = function () { send(path, isEvent); };
      document.head.appendChild(s);
      return;
    }
    send(path, isEvent);
  }
  function send(path, isEvent) {
    try {
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: path, title: path, event: !!isEvent });
      }
    } catch (e) { /* лічильник не має ламати сайт */ }
  }

  /* ------------------------------------------------------------ спільні блоки */

  function pageHead(kicker, title, lead) {
    return '<div class="page-head">' +
      (kicker ? '<p class="kicker">' + esc(kicker) + "</p>" : "") +
      '<h1 tabindex="-1">' + inline(title) + "</h1>" +
      (lead ? '<p class="lead">' + inline(lead) + "</p>" : "") + "</div>";
  }

  function checklistHtml(id, cl, withPrintNote) {
    if (!cl) return '<p class="mark mark-todo">Чек-лист "' + esc(id) + "\" не знайдено в dovidnyk.js</p>";
    var saved = arr(box("checks")[id]);
    var items = arr(cl.items);
    var done = items.filter(function (x, i) { return saved[i]; }).length;
    return '<div class="tool checklist" id="cl-' + esc(id) + '">' +
      '<h3>' + inline(cl.title) + "</h3>" +
      (cl.intro ? md(cl.intro) : "") +
      '<p class="count" data-count="' + esc(id) + '">Позначено ' + done + " із " + items.length + "</p>" +
      '<ul class="checks">' + items.map(function (it, i) {
        return '<li><label><input type="checkbox" data-check="' + esc(id) + '" data-i="' + i + '"' +
          (saved[i] ? " checked" : "") + "><span>" + inline(it) + "</span></label></li>";
      }).join("") + "</ul>" +
      (withPrintNote ? '<p class="small">Версія для друку - у <a href="#/dovidnyk/chek-lysty">Довіднику</a>.</p>' : "") +
      "</div>";
  }

  function variantTabs(current) {
    var labels = variantLabels();
    return '<div class="tabs" role="group" aria-label="Тип сайту">' + VARIANTS.map(function (v) {
      return '<button type="button" class="tab' + (v === current ? " is-on" : "") +
        '" data-variant="' + v + '" aria-pressed="' + (v === current) + '">' + esc(labels[v]) + "</button>";
    }).join("") + "</div>";
  }
  function variantLabels() {
    var l = cfg.variantLabels || {};
    return {
      klas: l.klas || "Сайт класу",
      vizytivka: l.vizytivka || "Сайт-візитівка",
      portfolio: l.portfolio || "Сайт-портфоліо"
    };
  }
  function currentVariant() {
    return VARIANTS.indexOf(state.variant) >= 0 ? state.variant : "klas";
  }

  /* ------------------------------------------------------------ головна */

  // Превʼю "Паспорта мого сайту" на першому екрані.
  // Поки вчитель нічого не записав - показуємо приклад; далі - його власні відповіді.
  function passportPreview() {
    var pp = (D.home || {}).passport || {};
    var notes = box("notes");
    var b = box("builder");
    var pages = 0;
    VARIANTS.forEach(function (v) { pages = Math.max(pages, arr(b[v]).length); });
    var real = [
      notes.meta,
      [notes.site_type, notes.platform].filter(function (x) { return String(x || "").trim(); }).join(", "),
      pages ? pages + " " + plural(pages, "сторінка", "сторінки", "сторінок") + " у меню" : "",
      notes.update_plan,
      notes.site_url
    ].map(function (x) { return String(x || "").trim(); });
    var mine = real.some(Boolean);
    var rows = arr(pp.rows);
    var done = mine ? real.filter(Boolean).length : rows.length;

    var html = '<div class="passport-wrap"><div class="passport-card">' +
      '<span class="passport-tag">' + (mine ? "Ваш паспорт" : "Приклад") + "</span>" +
      '<div class="passport-head">' + tile("file-check", "mint") + "<div><h2>" + inline(pp.title || "Паспорт мого сайту") + "</h2>" +
      "<p>Заповнено " + done + " із " + rows.length + "</p></div></div>" +
      '<ul class="passport-rows">' + rows.map(function (r, i) {
        var value = mine ? real[i] : r.value;
        var ok = !!value;
        return "<li>" + '<span class="tick' + (ok ? "" : " empty") + '">' + (ok ? icon("check") : "") + "</span>" +
          '<span><span class="p-label">' + inline(r.label) + "</span>" +
          '<span class="p-value' + (ok ? "" : " todo") + '">' + (ok ? esc(value) : "ще попереду") + "</span></span></li>";
      }).join("") + "</ul>" +
      '<p class="passport-foot">' + (mine ? '<a href="#/zapysnyk">Відкрити Записник</a>' : inline(pp.caption)) + "</p>" +
      "</div></div>";
    return html;
  }

  function viewHome() {
    var h = D.home || {};
    var steps = routeSteps();
    var next = nextStep();
    var doneCount = steps.filter(function (s) { return stepStatus(s.id) === "done"; }).length;
    var started = doneCount > 0 || steps.some(function (s) { return stepStatus(s.id) === "progress"; });

    var cta = next
      ? '<a class="btn btn-primary" href="' + next.href + '">' + (started ? "Продовжити: " : "Почати: ") + esc(next.title) + icon("arrow-right") + "</a>"
      : '<a class="btn btn-primary" href="#/zapysnyk">Відкрити "Паспорт мого сайту"' + icon("arrow-right") + "</a>";

    var html = '<section class="hero"><div class="wrap hero-grid"><div class="hero-text">' +
      '<p class="kicker">' + inline(h.kicker || "Сайт-гайд") + "</p>" +
      '<h1 tabindex="-1">' + inline(h.heroTitle) + "</h1>" +
      '<p class="lead">' + inline(h.heroLead) + "</p>" +
      '<div class="hero-actions">' + cta +
      '<a class="btn btn-ghost" href="#/dovidnyk">' + icon("book-open") + "Довідник</a></div>" +
      (h.timeNote ? '<p class="hero-note">' + icon("clock") + "<span>" + inline(h.timeNote) + "</span></p>" : "") +
      "</div>" + passportPreview() + "</div></section>";

    html += '<div class="wrap">';
    if (arr(h.benefits).length) {
      html += '<section class="benefits" aria-label="Що ви отримаєте">' + h.benefits.map(function (b, i) {
        return '<div class="card">' + tile(b.icon || "sparkles", TONES[i % 3]) + "<h3>" + inline(b.title) + "</h3>" + md(b.text) + "</div>";
      }).join("") + "</section>";
    }

    html += '<section class="route"><div class="section-head"><h2>Ваш маршрут</h2>' +
      '<p class="route-progress">Пройдено ' + doneCount + " із " + steps.length + "</p></div>" +
      '<div class="bar"><span style="width:' + Math.round(doneCount / steps.length * 100) + '%"></span></div>' +
      '<ol class="steps">' + steps.map(function (s, i) {
        var st = stepStatus(s.id);
        return '<li class="step step-' + st + " tone-" + TONES[i % 3] + '"><a href="' + s.href + '">' +
          tile(st === "done" ? "check" : s.icon, TONES[i % 3]) +
          '<span class="step-body"><span class="step-title">' + inline(s.title) + "</span>" +
          (s.result ? '<span class="step-result">' + inline(s.result) + "</span>" : "") +
          '<span class="step-meta">' + chip(st) + (s.time ? '<span class="time">' + icon("clock") + esc(s.time) + "</span>" : "") + "</span>" +
          "</span></a></li>";
      }).join("") + "</ol></section>";

    if (arr(h.howSteps).length) {
      html += '<section class="flow-section"><h2>' + inline(h.howTitle || "Як побудовано кожен модуль") + "</h2>" +
        (h.howLead ? '<p class="lead">' + inline(h.howLead) + "</p>" : "") +
        '<ol class="flow">' + h.howSteps.map(function (s, i) {
          return '<li class="flow-step tone-' + TONES[i % 3] + '"><span class="flow-num" aria-hidden="true">' + (i + 1) + "</span>" +
            tile(PART_ICONS[i] || "sparkles", TONES[i % 3]) +
            '<div class="flow-text"><h3>' + inline(s.title) + "</h3><p>" + inline(s.text) + "</p></div></li>";
        }).join("") + "</ol></section>";
    }

    var across = [
      { href: "#/dovidnyk", icon: "book-open", title: "Довідник", text: "Глосарій, відповіді на запитання, шаблони текстів, чек-листи, порівняння платформ." },
      { href: "#/zapysnyk", icon: "notebook-pen", title: "Записник", text: "Ваші нотатки з модулів складаються в \"Паспорт мого сайту\". Його можна надрукувати." },
      { href: "#/dovidnyk/zrazok", icon: "layout-template", title: "Зразок сайту класу", text: "Готовий приклад, який можна відкрити й узяти за основу." }
    ];
    html += '<section class="across"><h2>Завжди під рукою</h2><div class="grid3">' + across.map(function (a, i) {
      return '<a class="card link-card tone-' + TONES[i % 3] + '" href="' + a.href + '">' + tile(a.icon, TONES[i % 3]) +
        "<h3>" + a.title + "</h3><p>" + a.text + '</p><span class="go">Відкрити' + icon("arrow-right") + "</span></a>";
    }).join("") + "</div></section>";

    if (h.forWhom) {
      html += '<section class="for-whom"><div class="for-whom-text"><h2>' + inline(h.forWhomTitle || "Для кого цей гайд") + "</h2>" + md(h.forWhom) + "</div>" +
        (h.forWhomNote ? '<div class="for-whom-note">' + icon("sparkles") + "<div>" + md(h.forWhomNote) + "</div></div>" : "") + "</section>";
    }
    html += "</div>";
    return html;
  }

  /* ------------------------------------------------------------ самодіагностика */

  function diagForm(kind) {
    var s = D.start || {};
    var html = '<form class="diag" data-diag="' + kind + '" novalidate>';

    var mv = s.motyv || {};
    html += '<fieldset class="diag-part"><legend><span class="badge">1</span> ' + inline(mv.title) + "</legend>" + md(mv.hint);
    arr(mv.items).forEach(function (it, i) {
      html += '<div class="q" data-q="motyv-' + i + '"><p class="q-text">' + (i + 1) + ". " + inline(it.text) + "</p>" +
        '<div class="scale">' + arr(mv.scale).map(function (lab, v) {
          return '<label><input type="radio" name="motyv-' + i + '" value="' + (v + 1) + '"><span><b>' + (v + 1) + "</b> " + inline(lab) + "</span></label>";
        }).join("") + "</div></div>";
    });
    html += "</fieldset>";

    var zn = s.znannia || {};
    html += '<fieldset class="diag-part"><legend><span class="badge">2</span> ' + inline(zn.title) + "</legend>" + md(zn.hint);
    arr(zn.items).forEach(function (it, i) {
      html += '<div class="q" data-q="znannia-' + i + '"><p class="q-text">' + (i + 1) + ". " + inline(it.q) + "</p>" +
        '<div class="options">' + arr(it.options).map(function (o, v) {
          return '<label class="opt"><input type="radio" name="znannia-' + i + '" value="' + v + '"><span>' + inline(o) + "</span></label>";
        }).join("") + "</div></div>";
    });
    html += "</fieldset>";

    var dy = s.diyalnist || {};
    html += '<fieldset class="diag-part"><legend><span class="badge">3</span> ' + inline(dy.title) + "</legend>" + md(dy.hint);
    arr(dy.items).forEach(function (it, i) {
      html += '<div class="q" data-q="diyalnist-' + i + '"><p class="q-text">' + (i + 1) + ". " + inline(it.text) + "</p>" +
        '<div class="scale scale3">' + arr(dy.scale).map(function (lab, v) {
          return '<label><input type="radio" name="diyalnist-' + i + '" value="' + v + '"><span>' + inline(lab) + "</span></label>";
        }).join("") + "</div></div>";
    });
    html += "</fieldset>";

    html += '<p class="form-msg" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-primary">Показати результат</button></form>';
    return html;
  }

  function computeDiag(form) {
    var s = D.start || {};
    var answers = { motyv: [], znannia: [], diyalnist: [] };
    var missing = [];
    function val(name) {
      var el = form.querySelector('input[name="' + name + '"]:checked');
      return el ? Number(el.value) : null;
    }
    COMPONENTS.forEach(function (c) {
      arr((s[c] || {}).items).forEach(function (it, i) {
        var v = val(c + "-" + i);
        answers[c][i] = v;
        if (v === null) missing.push(c + "-" + i);
      });
    });
    if (missing.length) return { missing: missing };

    var mi = arr(s.motyv.items), zi = arr(s.znannia.items), di = arr(s.diyalnist.items);
    var sm = 0;
    mi.forEach(function (it, i) { sm += it.reverse ? 6 - answers.motyv[i] : answers.motyv[i]; });
    var correct = 0;
    zi.forEach(function (it, i) { if (answers.znannia[i] === it.correct) correct++; });
    var sd = 0;
    di.forEach(function (it, i) { sd += answers.diyalnist[i]; });

    var k = {
      motyv: mi.length ? (sm - mi.length) / (4 * mi.length) : 0,
      znannia: zi.length ? correct / zi.length : 0,
      diyalnist: di.length ? sd / (2 * di.length) : 0
    };
    k.overall = (k.motyv + k.znannia + k.diyalnist) / 3;
    return { k: k, answers: answers, date: new Date().toISOString().slice(0, 10) };
  }

  function diagResult(res, kind) {
    var s = D.start || {};
    var rec = s.recommendations || {};
    var overall = levelOf(res.k.overall);
    var html = '<div class="result"><h2>Ваш результат</h2>' +
      '<p class="result-main">Загальний рівень готовності: <strong>' + esc(overall.label) + "</strong> (" + pct(res.k.overall) + " зі 100)</p>" +
      (rec.overall && rec.overall[overall.id] ? md(rec.overall[overall.id]) : "") +
      '<div class="meters">';
    COMPONENTS.forEach(function (c) {
      var lv = levelOf(res.k[c]);
      html += '<div class="meter"><div class="meter-top"><span>' + COMPONENT_LABELS[c] + "</span><span>" +
        esc(lv.label) + " · " + pct(res.k[c]) + "</span></div>" +
        '<div class="bar"><span style="width:' + pct(res.k[c]) + '%"></span></div>' +
        (rec[c] && rec[c][lv.id] ? '<div class="meter-rec">' + md(rec[c][lv.id]) + "</div>" : "") + "</div>";
    });
    html += "</div>";

    if (kind === "finish") {
      var st = box("diag").start;
      if (st) {
        html += '<h3>Було і стало</h3><div class="table-wrap"><table><thead><tr><th>Компонент</th><th>На старті</th><th>На фініші</th></tr></thead><tbody>';
        COMPONENTS.concat(["overall"]).forEach(function (c) {
          html += "<tr><td>" + (COMPONENT_LABELS[c] || "Загалом") + "</td><td>" + pct(st.k[c]) + " · " + esc(levelOf(st.k[c]).label) +
            "</td><td>" + pct(res.k[c]) + " · " + esc(levelOf(res.k[c]).label) + "</td></tr>";
        });
        html += "</tbody></table></div>";
      }
      // На фініші показуємо правильні відповіді тесту з поясненнями.
      var zi = arr((s.znannia || {}).items);
      html += "<h3>Відповіді на запитання тесту</h3><ol class=\"answers\">" + zi.map(function (it, i) {
        var ok = res.answers.znannia[i] === it.correct;
        return "<li><p>" + inline(it.q) + '</p><p class="' + (ok ? "ok" : "no") + '">' +
          (ok ? "Правильно. " : "Правильна відповідь: ") + inline(arr(it.options)[it.correct]) + "</p>" +
          (it.explain ? '<p class="small">' + inline(it.explain) + "</p>" : "") + "</li>";
      }).join("") + "</ol>";
    } else {
      html += '<p class="small">Правильні відповіді на запитання тесту ви побачите на фініші: так буде чесніше порівнювати "було" і "стало".</p>';
    }
    html += '<p class="small">Результат збережено ' + esc(res.date) + ' тільки у вашому браузері.</p>' +
      '<div class="row-actions">' +
      (kind === "start" ? '<a class="btn btn-primary" href="#/modul/1">Перейти до модуля 1</a>' : '<a class="btn btn-primary" href="#/zapysnyk">Відкрити "Паспорт мого сайту"</a>') +
      '<button type="button" class="btn btn-ghost" data-act="diag-retry" data-kind="' + kind + '">Пройти ще раз</button></div></div>';
    return html;
  }

  function codeField() {
    return '<div class="field code-field"><label for="code">Код учасника дослідження</label>' +
      '<input id="code" type="text" inputmode="text" autocomplete="off" maxlength="12" placeholder="наприклад, У-07" data-code value="' + esc(state.code || "") + '">' +
      '<p class="small">Заповнюйте, тільки якщо отримали код від автора гайду. Код зберігається у вашому браузері й потрібен, щоб поєднати ваші анкети "до" і "після" без імені.</p></div>';
  }

  function formLink(url, label) {
    if (url) return '<a class="btn btn-ghost" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + "</a>";
    return DRAFT ? '<span class="mark mark-todo">Посилання на форму "' + esc(label) + "\" ще не додано в config.js</span>" : "";
  }

  function viewStart() {
    var s = D.start || {};
    var links = cfg.links || {};
    var res = box("diag").start;
    var html = '<div class="wrap narrow">' + pageHead("Старт", s.title, s.lead) + md(s.intro) + codeField();
    if (links.formStart || DRAFT) {
      html += '<div class="note"><p><strong>Учасникам дослідження:</strong> спершу заповніть вхідну анкету.</p>' + formLink(links.formStart, "Вхідна анкета") + "</div>";
    }
    html += res && !state.retryStart ? diagResult(res, "start") : diagForm("start");
    html += pager(null, { href: "#/modul/1", title: "Модуль 1" }) + "</div>";
    return html;
  }

  function viewFinish() {
    var f = D.finish || {};
    var links = cfg.links || {};
    var res = box("diag").finish;
    var notes = box("notes");
    var html = '<div class="wrap narrow">' + pageHead("Фініш", f.title, f.lead) + md(f.intro);

    var undone = MODULES.filter(function (n) { return moduleStatus(n) !== "done"; });
    if (undone.length) {
      html += '<div class="note"><p>Ще не завершено: ' + undone.map(function (n) {
        return '<a href="#/modul/' + n + '">модуль ' + n + "</a>";
      }).join(", ") + ". Фініш можна пройти й зараз, але результат буде точнішим після всіх модулів.</p></div>";
    }

    html += '<section class="block"><h2>' + inline(f.siteTitle || "Адреса вашого сайту") + "</h2>" + md(f.siteUrlHint) +
      '<div class="field"><label for="n-site_url">Посилання на опублікований сайт</label>' +
      '<input id="n-site_url" type="url" inputmode="url" placeholder="https://" data-note="site_url" value="' + esc(notes.site_url || "") + '">' +
      '<div class="print-value" data-print="site_url" aria-hidden="true">' + esc(notes.site_url || "") + "</div>" +
      '<p class="saved" data-saved="site_url" aria-live="polite"></p></div></section>';

    html += '<section class="block"><h2>Підсумкова самодіагностика</h2>' + md(f.diagIntro) +
      (res && !state.retryFinish ? diagResult(res, "finish") : diagForm("finish")) + "</section>";

    html += '<section class="block"><h2>' + inline(f.formsTitle || "Ваш відгук") + "</h2>" + md(f.formsIntro) +
      '<div class="row-actions">' + formLink(links.formFinish, "Підсумкова анкета") + formLink(links.formFeedback, "Відгук про сайт-гайд") + "</div></section>";

    html += md(f.thanks) + pager({ href: "#/modul/6", title: "Модуль 6" }, { href: "#/zapysnyk", title: "Записник" }) + "</div>";
    return html;
  }

  /* ------------------------------------------------------------ модуль */

  function toolHtml(t, n) {
    if (!t) return "";
    if (t.type === "checklist") return checklistHtml(t.ref, ((D.dovidnyk || {}).checklists || {})[t.ref], true);
    if (t.type === "cards") return cardsTool(t);
    if (t.type === "table") return tableTool(t);
    if (t.type === "platforms") return platformsTable((D.dovidnyk || {}).platforms, t.title);
    if (t.type === "helper") return helperTool(t);
    if (t.type === "builder") return builderTool(t);
    return "";
  }

  function cardsTool(t) {
    return '<div class="tool"><h3>' + inline(t.title) + "</h3>" + md(t.intro) + '<div class="cases">' + arr(t.cards).map(function (c, i) {
      return '<div class="case tone-' + TONES[i % 3] + '"><p class="case-tag">' + inline(c.tag) + "</p><h4>" + inline(c.title) + "</h4>" +
        (c.text ? md(c.text) : "") +
        (arr(c.good).length ? '<p class="case-h good">Що вдалося</p><ul>' + c.good.map(function (x) { return "<li>" + inline(x) + "</li>"; }).join("") + "</ul>" : "") +
        (arr(c.fix).length ? '<p class="case-h fix">Що варто змінити</p><ul>' + c.fix.map(function (x) { return "<li>" + inline(x) + "</li>"; }).join("") + "</ul>" : "") +
        "</div>";
    }).join("") + "</div>" + (t.note ? '<p class="small">' + inline(t.note) + "</p>" : "") + "</div>";
  }

  function tableTool(t) {
    return '<div class="tool"><h3>' + inline(t.title) + "</h3>" + md(t.intro) +
      '<div class="table-wrap"><table><thead><tr>' + arr(t.head).map(function (h) { return "<th>" + inline(h) + "</th>"; }).join("") +
      "</tr></thead><tbody>" + arr(t.rows).map(function (r) {
        return "<tr>" + arr(r).map(function (c, i) { return (i === 0 ? "<th scope=\"row\">" : "<td>") + inline(c) + (i === 0 ? "</th>" : "</td>"); }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>" + (t.note ? '<p class="small">' + inline(t.note) + "</p>" : "") + "</div>";
  }

  function platformsTable(p, title) {
    if (!p) return "";
    return '<div class="tool"><h3>' + inline(title || p.title) + "</h3>" + md(p.intro) +
      '<div class="table-wrap"><table class="platforms"><thead><tr><th>Ознака</th>' + arr(p.platforms).map(function (x) {
        return "<th>" + (x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.name) + "</a>" : esc(x.name)) + "</th>";
      }).join("") + "</tr></thead><tbody>" + arr(p.criteria).map(function (c, i) {
        return '<tr><th scope="row">' + inline(c) + "</th>" + arr(p.platforms).map(function (x) {
          return "<td>" + inline(arr(x.values)[i]) + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>" + (p.note ? '<p class="small">' + inline(p.note) + "</p>" : "") + "</div>";
  }

  function helperTool(t) {
    var h = box("helper");
    var ans = arr(h.answers);
    var html = '<div class="tool helper" id="helper"><h3>' + inline(t.title) + "</h3>" + md(t.intro) + '<form data-helper novalidate>';
    arr(t.questions).forEach(function (q, i) {
      html += '<div class="q"><p class="q-text">' + (i + 1) + ". " + inline(q.q) + '</p><div class="options">' + arr(q.options).map(function (o, v) {
        return '<label class="opt"><input type="radio" name="h-' + i + '" value="' + v + '"' + (ans[i] === v ? " checked" : "") + "><span>" + inline(o.label) + "</span></label>";
      }).join("") + "</div></div>";
    });
    html += '<p class="form-msg" role="alert" hidden></p><button type="submit" class="btn btn-primary">Показати рекомендацію</button></form>';
    if (h.type || h.platform) {
      var rt = ((t.results || {}).types || {})[h.type];
      var rp = ((t.results || {}).platforms || {})[h.platform];
      html += '<div class="result"><h4>Рекомендація</h4>' +
        (rt ? "<p><strong>Тип сайту: " + inline(rt.title) + ".</strong></p>" + md(rt.text) : "") +
        (rp ? "<p><strong>Платформа: " + inline(rp.title) + ".</strong></p>" + md(rp.text) : "") +
        '<p class="small">Це порада, а не вирок: остаточний вибір запишіть нижче, у блоці "Занотуй".</p></div>';
    }
    return html + "</div>";
  }

  function builderTool(t) {
    var v = currentVariant();
    var b = box("builder");
    var chosen = arr(b[v]);
    var own = arr(b.own);
    var min = t.min || 5, max = t.max || 7;
    var pages = arr((t.pages || {})[v]);
    var count = chosen.length;
    var verdict = count < min ? "Замало: додайте ще " + (min - count) + "." : (count > max ? "Забагато: приберіть " + (count - max) + ". Довге меню важко читати з телефона." : "Саме те.");
    var html = '<div class="tool builder" id="builder"><h3>' + inline(t.title) + "</h3>" + md(t.intro) + variantTabs(v) +
      '<ul class="checks">' + pages.concat(own.map(function (name) { return { name: name, desc: "ваша сторінка", own: true }; })).map(function (p) {
        var on = chosen.indexOf(p.name) >= 0;
        return '<li><label><input type="checkbox" data-build="' + esc(p.name) + '"' + (on ? " checked" : "") + "><span><strong>" + inline(p.name) + "</strong>" +
          (p.recommended ? ' <em class="rec">радимо</em>' : "") + "<br>" + inline(p.desc) + "</span></label></li>";
      }).join("") + "</ul>" +
      '<div class="field inline-field"><label for="build-own">Своя сторінка</label><div class="inline-row"><input id="build-own" type="text" maxlength="40" placeholder="назва сторінки">' +
      '<button type="button" class="btn btn-ghost" data-act="build-add">Додати</button></div></div>' +
      '<p class="count' + (count >= min && count <= max ? " ok" : "") + '">Обрано сторінок: ' + count + ". Радимо " + min + "-" + max + ". " + verdict + "</p>" +
      (count ? '<div class="sitemap"><p class="small">Ваше меню:</p><ol>' + chosen.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ol></div>" : "") +
      '<p class="small">Карта сайту зберігається автоматично й потрапляє в Записник.</p></div>';
    return html;
  }

  function quizHtml(n, m) {
    var id = "m" + n;
    var saved = arr(box("quiz")[id]);
    return arr(m.perevir).map(function (q, i) {
      var a = saved[i];
      var answered = typeof a === "number";
      return '<div class="q quiz-q' + (answered ? (a === q.correct ? " is-ok" : " is-no") : "") + '" data-quiz-q="' + i + '">' +
        '<p class="q-text">' + (i + 1) + ". " + inline(q.q) + '</p><div class="options">' + arr(q.options).map(function (o, v) {
          var cls = "opt";
          if (answered && v === q.correct) cls += " opt-ok";
          if (answered && v === a && a !== q.correct) cls += " opt-no";
          return '<label class="' + cls + '"><input type="radio" name="quiz-' + id + "-" + i + '" value="' + v + '" data-quiz="' + id + '" data-q="' + i + '"' +
            (a === v ? " checked" : "") + "><span>" + inline(o) + "</span></label>";
        }).join("") + "</div>" +
        '<div class="feedback" aria-live="polite">' + (answered ? "<p><strong>" + (a === q.correct ? "Так." : "Не зовсім.") + "</strong> " + inline(q.explain) + "</p>" : "") + "</div></div>";
    }).join("");
  }

  function noteField(f) {
    var notes = box("notes");
    var v = notes[f.key] || "";
    var id = "n-" + f.key;
    var input;
    if (f.type === "choice") {
      input = '<select id="' + id + '" data-note="' + esc(f.key) + '"><option value="">Оберіть</option>' + arr(f.options).map(function (o) {
        return "<option" + (o === v ? " selected" : "") + ">" + esc(o) + "</option>";
      }).join("") + "</select>";
    } else if (f.type === "text") {
      input = '<input id="' + id + '" type="text" data-note="' + esc(f.key) + '" value="' + esc(v) + '">';
    } else {
      input = '<textarea id="' + id + '" rows="' + (f.rows || 3) + '" data-note="' + esc(f.key) + '">' + esc(v) + "</textarea>";
    }
    return '<div class="field"><label for="' + id + '">' + inline(f.label) + "</label>" +
      (f.hint ? '<p class="hint">' + inline(f.hint) + "</p>" : "") + input +
      // На папері поле вводу обрізало б довгий текст, тому друкується цей блок із повним текстом.
      '<div class="print-value" data-print="' + esc(f.key) + '" aria-hidden="true">' + esc(v) + "</div>" +
      '<p class="saved" data-saved="' + esc(f.key) + '" aria-live="polite"></p></div>';
  }

  function sectionHead(num, id, label) {
    return '<h2 id="' + id + '">' + tile(PART_ICONS[num - 1], TONES[(num - 1) % 3]) +
      '<span><span class="sec-step">Частина ' + num + ' із 5</span><span class="sec-label">' + label + "</span></span></h2>";
  }

  function viewModule(n) {
    var m = mod(n);
    if (!m) return view404();
    var id = "m" + n;
    var v = currentVariant();
    var krok = m.krok || {};
    var variants = arr(krok.variants);
    var tools = arr(m.tools);
    function toolsAt(place) {
      return tools.filter(function (t) { return (t.place || "after-krok") === place; }).map(function (t) { return toolHtml(t, n); }).join("");
    }

    var html = '<div class="wrap narrow module">' +
      '<div class="page-head"><p class="kicker">Модуль ' + n + " із 6 · " + esc(m.time || "") + ' <span data-status="' + n + '">' + chip(moduleStatus(n)) + "</span></p>" +
      '<h1 tabindex="-1">' + inline(m.title) + '</h1><p class="lead">' + inline(m.lead) + "</p></div>" +
      '<nav class="mini" aria-label="Частини модуля">' +
      [["teza", "Теза"], ["pryklad", "Приклад"], ["krok", "Крок"], ["perevir", "Перевір себе"], ["zanotuy", "Занотуй"]].map(function (x, i) {
        return '<a href="#/modul/' + n + "/" + x[0] + '">' + icon(PART_ICONS[i]) + x[1] + "</a>";
      }).join("") + "</nav>";

    html += '<section class="sec">' + sectionHead(1, "teza", "Теза") + '<div class="theses">' + arr(m.teza).map(function (t, i) {
      return '<div class="thesis tone-' + TONES[i % 3] + '"><span class="thesis-n" aria-hidden="true">' + (i + 1) + "</span><h3>" +
        inline(t.title) + "</h3>" + md(t.text) + "</div>";
    }).join("") + "</div>" + toolsAt("after-teza") + "</section>";

    var p = m.pryklad || {};
    html += '<section class="sec">' + sectionHead(2, "pryklad", "Приклад") + '<div class="example"><h3>' + inline(p.title) + "</h3>" + md(p.text) +
      (p.takeaway ? '<p class="takeaway">' + inline(p.takeaway) + "</p>" : "") + "</div>" + toolsAt("after-pryklad") + "</section>";

    html += '<section class="sec">' + sectionHead(3, "krok", "Крок") + md(krok.intro) + toolsAt("before-krok");
    if (variants.length) {
      html += '<p class="small">Оберіть тип свого сайту - завдання трохи відрізняються.</p>' + variantTabs(v);
      variants.forEach(function (va) {
        html += '<div class="variant"' + (va.type === v ? "" : " hidden") + ' data-variant-panel="' + esc(va.type) + '">' +
          "<ol class=\"todo\">" + arr(va.steps).map(function (s) { return "<li>" + inline(s) + "</li>"; }).join("") + "</ol>" +
          (va.result ? '<p class="takeaway"><strong>Що має вийти:</strong> ' + inline(va.result) + "</p>" : "") + "</div>";
      });
    }
    html += toolsAt("after-krok") +
      '<label class="done-check"><input type="checkbox" data-step="' + id + '"' + (box("steps")[id] ? " checked" : "") + "><span>" +
      inline(krok.doneLabel || "Крок виконано") + "</span></label></section>";

    html += '<section class="sec">' + sectionHead(4, "perevir", "Перевір себе") + quizHtml(n, m) + "</section>";

    html += '<section class="sec">' + sectionHead(5, "zanotuy", "Занотуй") + md(m.zanotuyIntro || "Ці відповіді збережуться у вашому браузері й потраплять у \"Паспорт мого сайту\".") +
      arr(m.zanotuy).map(noteField).join("") + '<p><a href="#/zapysnyk">Відкрити Записник</a></p></section>';

    var prev = n === 1 ? { href: "#/start", title: "Старт" } : { href: "#/modul/" + (n - 1), title: "Модуль " + (n - 1) };
    var next = n === 6 ? { href: "#/finish", title: "Фініш" } : { href: "#/modul/" + (n + 1), title: "Модуль " + (n + 1) };
    html += pager(prev, next) + "</div>";
    return html;
  }

  function pager(prev, next) {
    return '<nav class="pager" aria-label="Перехід між кроками">' +
      (prev ? '<a class="btn btn-ghost" href="' + prev.href + '">' + icon("arrow-left") + esc(prev.title) + "</a>" : "<span></span>") +
      (next ? '<a class="btn btn-primary" href="' + next.href + '">' + esc(next.title) + icon("arrow-right") + "</a>" : "<span></span>") + "</nav>";
  }

  /* ------------------------------------------------------------ довідник */

  var DOV_SECTIONS = [
    { id: "glosarii", label: "Глосарій" },
    { id: "zapytannia", label: "Запитання" },
    { id: "shablony", label: "Шаблони" },
    { id: "chek-lysty", label: "Чек-листи" },
    { id: "platformy", label: "Платформи" },
    { id: "zrazok", label: "Зразок сайту" }
  ];

  function viewDovidnyk(section) {
    var d = D.dovidnyk || {};
    section = DOV_SECTIONS.some(function (s) { return s.id === section; }) ? section : "glosarii";
    var html = '<div class="wrap narrow">' + pageHead("Довідник", d.title || "Довідник", d.lead) +
      '<nav class="mini mini-wrap" aria-label="Розділи довідника">' + DOV_SECTIONS.map(function (s) {
        return '<a href="#/dovidnyk/' + s.id + '"' + (s.id === section ? ' aria-current="page" class="is-on"' : "") + ">" + s.label + "</a>";
      }).join("") + "</nav>";

    if (section === "glosarii") {
      var terms = arr(d.glossary).slice().sort(function (a, b) { return String(a.term).localeCompare(String(b.term), "uk"); });
      html += '<section class="block"><h2>Глосарій</h2><div class="field"><label for="gl-filter">Знайти термін</label>' +
        '<input id="gl-filter" type="search" placeholder="почніть вводити слово"></div><dl class="glossary">' + terms.map(function (t) {
          return '<div class="term" data-term="' + esc(String(t.term).toLowerCase()) + '"><dt>' + inline(t.term) + "</dt><dd>" + inline(t.def) + "</dd></div>";
        }).join("") + '</dl><p class="small" id="gl-empty" hidden>Такого терміна поки немає.</p></section>';
    }
    if (section === "zapytannia") {
      html += '<section class="block"><h2>Запитання й відповіді</h2>' + arr(d.faq).map(function (f) {
        return "<details><summary>" + inline(f.q) + "</summary>" + md(f.a) + "</details>";
      }).join("") + "</section>";
    }
    if (section === "shablony") {
      html += '<section class="block"><h2>Шаблони текстів</h2>' + md(d.templatesIntro) + arr(d.templates).map(function (t) {
        return '<div class="template"><h3>' + inline(t.title) + "</h3>" + (t.note ? '<p class="small">' + inline(t.note) + "</p>" : "") +
          '<pre class="tpl" id="tpl-' + esc(t.id) + '">' + esc(String(t.text || "").trim()) + "</pre>" +
          '<button type="button" class="btn btn-ghost no-print" data-act="copy" data-target="tpl-' + esc(t.id) + '">' + icon("copy") + "<span>Скопіювати текст</span></button></div>";
      }).join("") + "</section>";
    }
    if (section === "chek-lysty") {
      var cls = d.checklists || {};
      html += '<section class="block"><h2>Чек-листи</h2><button type="button" class="btn btn-ghost no-print" data-act="print">' + icon("printer") + "Надрукувати або зберегти як PDF</button>" +
        Object.keys(cls).map(function (k) { return checklistHtml(k, cls[k], false); }).join("") + "</section>";
    }
    if (section === "platformy") {
      html += '<section class="block">' + platformsTable(d.platforms, (d.platforms || {}).title || "Порівняння платформ") + "</section>";
    }
    if (section === "zrazok") {
      var z = d.sample || {};
      var url = (cfg.links || {}).sampleSite;
      html += '<section class="block"><h2>' + inline(z.title || "Зразок сайту класу") + "</h2>" + md(z.text) +
        (url ? '<a class="btn btn-primary" href="' + esc(url) + '" target="_blank" rel="noopener">Відкрити зразок</a>'
             : (DRAFT ? '<p class="mark mark-todo">Посилання на зразок ще не додано в config.js</p>' : "")) + "</section>";
    }
    return html + "</div>";
  }

  /* ------------------------------------------------------------ записник */

  function viewZapysnyk() {
    var labels = variantLabels();
    var html = '<div class="wrap narrow passport">' + pageHead("Записник", "Паспорт мого сайту", "Тут збираються ваші відповіді з блоків \"Занотуй\". Їх можна правити, надрукувати або зберегти як PDF.") +
      '<div class="row-actions no-print"><button type="button" class="btn btn-primary" data-act="print">' + icon("printer") + "Надрукувати або зберегти як PDF</button>" +
      '<button type="button" class="btn btn-ghost" data-act="to-data">' + icon("download") + "Зберегти або перенести нотатки</button></div>" +
      '<p class="small print-only">' + esc(cfg.siteTitle || "Сайт-гайд") + ". Надруковано " + dateUa(today()) + ".</p>";

    if (state.code) html += '<p class="small">Код учасника: ' + esc(state.code) + "</p>";

    MODULES.forEach(function (n) {
      var m = mod(n) || {};
      html += '<section class="block"><h2>Модуль ' + n + ". " + inline(m.title) + "</h2>";
      if (n === 2) {
        var h = box("helper");
        var t2 = arr(m.tools).filter(function (t) { return t.type === "helper"; })[0];
        if (t2 && (h.type || h.platform)) {
          var rt = ((t2.results || {}).types || {})[h.type];
          var rp = ((t2.results || {}).platforms || {})[h.platform];
          html += '<p class="small">Порада "Помічника вибору": ' + (rt ? inline(rt.title) : "") + (rt && rp ? ", " : "") + (rp ? inline(rp.title) : "") + ".</p>";
        }
      }
      if (n === 3) {
        var b = box("builder");
        var maps = VARIANTS.filter(function (v) { return arr(b[v]).length; });
        if (!maps.length) {
          html += '<h3>Карта сайту</h3><p class="small">Ще не складено. <a href="#/modul/3/krok">Скласти в модулі 3</a></p>';
        }
        maps.forEach(function (v) {
          html += "<h3>Карта сайту (" + esc(labels[v]) + ")</h3><ol>" +
            arr(b[v]).map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ol>";
        });
      }
      html += arr(m.zanotuy).map(noteField).join("") + "</section>";
    });

    var dg = box("diag");
    if (dg.start || dg.finish) {
      html += '<section class="block"><h2>Самодіагностика</h2><div class="table-wrap"><table><thead><tr><th>Компонент</th><th>Старт' +
        (dg.start ? " (" + esc(dg.start.date) + ")" : "") + "</th><th>Фініш" + (dg.finish ? " (" + esc(dg.finish.date) + ")" : "") + "</th></tr></thead><tbody>";
      COMPONENTS.concat(["overall"]).forEach(function (c) {
        function cell(r) { return r ? pct(r.k[c]) + " · " + esc(levelOf(r.k[c]).label) : "-"; }
        html += "<tr><td>" + (COMPONENT_LABELS[c] || "Загалом") + "</td><td>" + cell(dg.start) + "</td><td>" + cell(dg.finish) + "</td></tr>";
      });
      html += "</tbody></table></div></section>";
    }

    var saved = dateUa(state.exportedAt);
    html += '<section class="block no-print" id="moi-dani"><h2>Мої дані</h2>' +
      '<p>Усе, що ви вводите, зберігається тільки в цьому браузері на цьому пристрої. На іншому телефоні чи комп\'ютері Записник буде порожнім, а після очищення браузера нотатки зникнуть.</p>' +
      '<div class="tool"><h3>Копія нотаток</h3>' +
      "<p>Збережіть копію у файл, щоб не втратити нотатки. З цього ж файла їх можна відновити тут або перенести на інший пристрій: відкрийте там гайд, зайдіть у Записник і натисніть \"Відновити з файла\".</p>" +
      '<p class="small">' + (saved ? "Копію востаннє зберігали " + saved + "." : "Копію ще не зберігали.") + "</p>" +
      '<div class="row-actions"><button type="button" class="btn btn-primary" data-act="export-file">' + icon("download") + "Зберегти копію у файл</button>" +
      '<button type="button" class="btn btn-ghost" data-act="import-pick">' + icon("upload") + "Відновити з файла</button>" +
      '<input type="file" id="io-file" accept=".json,application/json" hidden></div>' +
      '<p id="io-msg" role="status" class="io-msg' + (ioFlashBad ? " bad" : "") + '"' + (ioFlash ? "" : " hidden") + ">" + esc(ioFlash) + "</p>" +
      "<details><summary>Файл не зберігається або не відкривається?</summary>" +
      "<p>Таке буває, якщо гайд відкрито у вікні месенджера. Тоді перенесіть нотатки як текст: скопіюйте їх тут, відкрийте гайд у звичайному браузері або на іншому пристрої, зайдіть у Записник і вставте текст у поле нижче.</p>" +
      '<button type="button" class="btn btn-ghost" data-act="export-copy">' + icon("copy") + "<span>Скопіювати нотатки як текст</span></button>" +
      '<div class="field"><label for="io-text">Вставте сюди скопійований текст</label>' +
      '<textarea id="io-text" rows="3" autocomplete="off" spellcheck="false"></textarea></div>' +
      '<button type="button" class="btn btn-ghost" data-act="import-text">' + icon("upload") + "Відновити з тексту</button></details></div>" +
      '<button type="button" class="btn btn-danger" data-act="wipe">' + icon("trash-2") + "Стерти всі мої відповіді</button></section></div>";
    ioFlash = ""; ioFlashBad = false;
    return html;
  }

  /* ------------------------------------------------------------ про проєкт */

  function viewAbout() {
    var a = D.about || {};
    var html = '<div class="wrap narrow">' + pageHead("Про проєкт", a.title, a.lead);
    arr(a.blocks).forEach(function (b) {
      html += '<section class="block"><h2>' + inline(b.title) + "</h2>" + md(b.text) + "</section>";
    });
    if (a.privacy) html += '<section class="block" id="privacy"><h2>' + inline(a.privacy.title) + "</h2>" + md(a.privacy.text) + "</section>";
    return html + "</div>";
  }

  function view404() {
    return '<div class="wrap narrow">' + pageHead("", "Такої сторінки немає", "Можливо, посилання застаріло.") +
      '<a class="btn btn-primary" href="#/">На головну</a></div>';
  }

  /* ------------------------------------------------------------ перевірка вмісту */

  function deepStrings(obj, cb, path) {
    path = path || "";
    if (typeof obj === "string") { cb(obj, path); return; }
    if (Array.isArray(obj)) { obj.forEach(function (x, i) { deepStrings(x, cb, path + "[" + i + "]"); }); return; }
    if (obj && typeof obj === "object") Object.keys(obj).forEach(function (k) { deepStrings(obj[k], cb, path ? path + "." + k : k); });
  }

  function need(msgs, cond, text) { if (!cond) msgs.push(text); }
  function between(x, a, b) { return arr(x).length >= a && arr(x).length <= b; }

  function validate(name, o) {
    var m = [];
    if (/^module-/.test(name)) {
      ["title", "lead", "time", "result"].forEach(function (k) { need(m, o[k], "немає поля " + k); });
      need(m, between(o.teza, 3, 5), "теза: має бути 3-5 положень, зараз " + arr(o.teza).length);
      arr(o.teza).forEach(function (t, i) { need(m, t.title && t.text, "теза " + (i + 1) + ": потрібні title і text"); });
      need(m, o.pryklad && o.pryklad.title && o.pryklad.text, "приклад: потрібні title і text");
      var vs = arr((o.krok || {}).variants);
      need(m, vs.length === 3, "крок: має бути 3 варіанти (klas, vizytivka, portfolio), зараз " + vs.length);
      vs.forEach(function (v) {
        need(m, VARIANTS.indexOf(v.type) >= 0, "крок: невідомий тип варіанта \"" + v.type + "\"");
        need(m, arr(v.steps).length >= 3, "крок (" + v.type + "): потрібно щонайменше 3 дії");
        need(m, v.result, "крок (" + v.type + "): немає поля result");
      });
      need(m, arr(o.perevir).length === 3, "перевір себе: має бути рівно 3 запитання, зараз " + arr(o.perevir).length);
      arr(o.perevir).forEach(function (q, i) {
        need(m, between(q.options, 3, 4), "запитання " + (i + 1) + ": 3-4 варіанти відповіді");
        need(m, typeof q.correct === "number" && q.correct >= 0 && q.correct < arr(q.options).length, "запитання " + (i + 1) + ": correct поза межами варіантів");
        need(m, q.explain, "запитання " + (i + 1) + ": немає пояснення explain");
      });
      need(m, between(o.zanotuy, 2, 4), "занотуй: має бути 2-4 поля, зараз " + arr(o.zanotuy).length);
      arr(o.zanotuy).forEach(function (f, i) { need(m, f.key && f.label, "занотуй, поле " + (i + 1) + ": потрібні key і label"); });
      arr(o.tools).forEach(function (t) {
        if (t.type === "checklist") need(m, ((D.dovidnyk || {}).checklists || {})[t.ref], "інструмент: чек-листа \"" + t.ref + "\" немає в dovidnyk.js");
        if (t.type === "helper") {
          need(m, arr(t.questions).length === 5, "помічник вибору: має бути 5 запитань, зараз " + arr(t.questions).length);
          var res = t.results || {};
          arr(t.questions).forEach(function (q, qi) {
            arr(q.options).forEach(function (op) {
              Object.keys((op.add || {}).t || {}).forEach(function (k) { need(m, (res.types || {})[k], "помічник, запитання " + (qi + 1) + ": тип \"" + k + "\" не описано в results.types"); });
              Object.keys((op.add || {}).p || {}).forEach(function (k) { need(m, (res.platforms || {})[k], "помічник, запитання " + (qi + 1) + ": платформу \"" + k + "\" не описано в results.platforms"); });
            });
          });
        }
        if (t.type === "builder") VARIANTS.forEach(function (v) { need(m, arr((t.pages || {})[v]).length >= 7, "конструктор: для \"" + v + "\" потрібно щонайменше 7 сторінок на вибір"); });
        if (t.type === "cards") need(m, arr(t.cards).length >= 4, "картки: потрібно щонайменше 4");
      });
    }
    if (name === "start") {
      need(m, between((o.motyv || {}).items, 5, 6), "мотиваційний блок: 5-6 тверджень");
      need(m, arr((o.motyv || {}).scale).length === 5, "мотиваційний блок: шкала з 5 позначок");
      need(m, between((o.znannia || {}).items, 6, 8), "знаннєвий блок: 6-8 запитань");
      arr((o.znannia || {}).items).forEach(function (q, i) {
        need(m, arr(q.options).length === 4, "тест, запитання " + (i + 1) + ": 4 варіанти");
        need(m, typeof q.correct === "number" && q.correct >= 0 && q.correct < 4, "тест, запитання " + (i + 1) + ": correct від 0 до 3");
      });
      need(m, between((o.diyalnist || {}).items, 6, 8), "діяльнісний блок: 6-8 пунктів");
      need(m, arr((o.diyalnist || {}).scale).length === 3, "діяльнісний блок: шкала з 3 позначок");
      COMPONENTS.concat(["overall"]).forEach(function (c) {
        arr(cfg.levels).forEach(function (l) { need(m, ((o.recommendations || {})[c] || {})[l.id], "рекомендації: немає тексту для " + c + " / " + l.id); });
      });
    }
    if (name === "dovidnyk") {
      need(m, between(o.glossary, 25, 30), "глосарій: 25-30 термінів, зараз " + arr(o.glossary).length);
      need(m, arr(o.faq).length >= 10, "запитання: має бути щонайменше 10, зараз " + arr(o.faq).length);
      need(m, arr(o.templates).length >= 3, "шаблони: щонайменше 3");
      var c = o.checklists || {};
      need(m, c.bezpeka && arr(c.bezpeka.items).length === 10, "чек-лист безпеки: 10 пунктів");
      need(m, c.yakist && arr(c.yakist.items).length === 12, "чек-лист якості: 12 пунктів");
      need(m, c.progres && arr(c.progres.items).length >= 8, "чек-лист прогресу: щонайменше 8 пунктів");
      var p = o.platforms || {};
      arr(p.platforms).forEach(function (x) { need(m, arr(x.values).length === arr(p.criteria).length, "платформи: у \"" + x.name + "\" кількість значень не збігається з кількістю ознак"); });
    }
    if (name === "home") {
      ["heroTitle", "heroLead"].forEach(function (k) { need(m, o[k], "немає поля " + k); });
      need(m, arr(o.benefits).length === 3, "benefits: має бути 3 картки, зараз " + arr(o.benefits).length);
      arr(o.benefits).forEach(function (b) { need(m, !b.icon || (G.icons || {})[b.icon], "benefits: немає іконки \"" + b.icon + "\""); });
      need(m, arr(o.howSteps).length === 5, "howSteps: має бути 5 кроків, зараз " + arr(o.howSteps).length);
      need(m, arr((o.passport || {}).rows).length === 5, "passport.rows: має бути 5 рядків, зараз " + arr((o.passport || {}).rows).length);
    }
    if (name === "about") need(m, o.privacy && o.privacy.text, "немає політики конфіденційності");
    if (name === "config") {
      need(m, arr(o.levels).length === 3, "levels: має бути 3 рівні");
      ["formStart", "formFinish", "formFeedback", "sampleSite"].forEach(function (k) { need(m, (o.links || {})[k], "links." + k + ": посилання ще не додано"); });
    }
    return m;
  }

  function viewCheck() {
    var totals = { todo: 0, shot: 0, law: 0, src: 0, problems: 0 };
    var photos = [];
    var rows = G.expected.map(function (name) {
      var o = D[name];
      var file = name + ".js";
      if (!o) {
        totals.problems++;
        var err = G.errors.filter(function (e) { return e.file === file; })[0];
        return '<div class="check-file bad"><h3>' + file + "</h3><p><strong>Файл не завантажився.</strong> " +
          (err ? "Помилка в рядку " + err.line + ": " + esc(err.message) : "Найчастіше це пропущена кома, дужка або зворотна лапка `.") + "</p></div>";
      }
      var c = { todo: 0, shot: 0, law: 0, src: 0 };
      var where = [];
      deepStrings(o, function (s, path) {
        var t = (s.match(/\[ЗАПОВНИТИ/g) || []).length; c.todo += t;
        if (t) where.push(path);
        c.shot += (s.match(/\[СКРИНШОТ:/g) || []).length;
        c.law += (s.match(/\[ПЕРЕВІРИТИ НОРМУ\]/g) || []).length;
        c.src += (s.match(/\[(ДЖЕРЕЛО\?|ДАНІ)\]/g) || []).length;
        var re = /\[ФОТО:\s*([\w.\-]+)/g, mm;
        while ((mm = re.exec(s))) photos.push(mm[1]);
      });
      Object.keys(c).forEach(function (k) { totals[k] += c[k]; });
      var msgs = validate(name, o);
      totals.problems += msgs.length;
      var clean = !msgs.length && !c.todo && !c.shot && !c.law && !c.src;
      return '<div class="check-file ' + (clean ? "good" : (msgs.length ? "bad" : "warn")) + '"><h3>' + file + (clean ? " - готово" : "") + "</h3>" +
        (msgs.length ? "<p><strong>Структура:</strong></p><ul>" + msgs.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
        "<p>Не заповнено: " + c.todo + " · скриншотів бракує: " + c.shot + " · \"перевірити норму\": " + c.law + " · \"джерело?\" і \"дані\": " + c.src + "</p>" +
        (where.length ? '<details><summary>Де саме не заповнено</summary><p class="small">' + where.slice(0, 80).map(esc).join(", ") + "</p></details>" : "") + "</div>";
    }).join("");

    var ready = !totals.problems && !totals.todo && !totals.shot && !totals.law && !totals.src;
    var html = '<div class="wrap narrow">' + pageHead("Службова сторінка", "Перевірка вмісту", "Показує, що ще не заповнено у файлах папки content. Учителі цю сторінку не бачать у меню.") +
      '<div class="note"><p><strong>' + (ready ? "Вміст готовий до публікації." : "Вміст ще не готовий.") + "</strong> Не заповнено: " + totals.todo +
      " · скриншотів бракує: " + totals.shot + " · \"перевірити норму\": " + totals.law + " · \"джерело?\" і \"дані\": " + totals.src + " · зауважень до структури: " + totals.problems + "</p>" +
      "<p>Режим чернетки: <strong>" + (DRAFT ? "увімкнено" : "вимкнено") + "</strong> (config.js, поле draft). Перед показом учителям поставте draft: false.</p></div>" + rows;

    var uniq = photos.filter(function (f, i) { return photos.indexOf(f) === i; });
    html += '<div class="check-file"><h3>Зображення в assets/img</h3>' + (uniq.length ? '<ul id="photo-check">' + uniq.map(function (f) {
      return '<li data-photo="' + esc(f) + '">' + esc(f) + " - перевіряю...</li>";
    }).join("") + "</ul>" : "<p>У текстах поки немає позначок [ФОТО: ...].</p>") + "</div></div>";
    return html;
  }

  function checkPhotos() {
    var list = document.querySelectorAll("[data-photo]");
    Array.prototype.forEach.call(list, function (li) {
      var f = li.getAttribute("data-photo");
      var im = new Image();
      im.onload = function () { li.textContent = f + " - є"; };
      im.onerror = function () { li.textContent = f + " - файла немає в assets/img"; li.className = "no"; };
      im.src = "assets/img/" + f;
    });
  }

  /* ------------------------------------------------------------ маршрутизація */

  var NAV = [
    { href: "#/", label: "Маршрут", icon: "route", match: /^(|start|modul|finish)$/ },
    { href: "#/dovidnyk", label: "Довідник", icon: "book-open", match: /^dovidnyk$/ },
    { href: "#/zapysnyk", label: "Записник", icon: "notebook-pen", match: /^zapysnyk$/ },
    { href: "#/pro-proiekt", label: "Про проєкт", icon: "info", match: /^pro-proiekt$/ }
  ];

  // Меню на вузьких екранах ховається в кнопку.
  var navToggle = document.getElementById("nav-toggle");
  function setNav(open) {
    if (!navToggle) return;
    document.body.classList.toggle("nav-open", open);
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    navToggle.setAttribute("aria-label", open ? "Закрити меню" : "Відкрити меню");
    navToggle.innerHTML = icon(open ? "x" : "menu");
  }
  if (navToggle) {
    navToggle.addEventListener("click", function () {
      setNav(!document.body.classList.contains("nav-open"));
    });
    document.getElementById("nav").addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) setNav(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("nav-open")) { setNav(false); navToggle.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (document.body.classList.contains("nav-open") && e.target.closest && !e.target.closest(".site-header")) setNav(false);
    });
  }

  function parts() {
    return decodeURIComponent(location.hash.replace(/^#\/?/, "")).split("/").filter(Boolean);
  }

  function render(keepScroll) {
    var p = parts();
    var top = p[0] || "";
    var y = window.scrollY;
    var html, title;

    if (top === "") { html = viewHome(); title = ""; }
    else if (top === "start") { html = viewStart(); title = "Старт"; }
    else if (top === "modul" && MODULES.indexOf(Number(p[1])) >= 0) { html = viewModule(Number(p[1])); title = "Модуль " + p[1]; }
    else if (top === "finish") { html = viewFinish(); title = "Фініш"; }
    else if (top === "dovidnyk") { html = viewDovidnyk(p[1]); title = "Довідник"; }
    else if (top === "zapysnyk") { html = viewZapysnyk(); title = "Записник"; }
    else if (top === "pro-proiekt") { html = viewAbout(); title = "Про проєкт"; }
    else if (top === "perevirka") { html = viewCheck(); title = "Перевірка вмісту"; }
    else { html = view404(); title = "Сторінку не знайдено"; }

    main.innerHTML = html;
    setNav(false);
    document.title = (title ? title + " - " : "") + (cfg.siteTitle || "Сайт-гайд");
    document.getElementById("nav").innerHTML = NAV.map(function (n) {
      var on = n.match.test(top);
      return '<a href="' + n.href + '"' + (on ? ' aria-current="page"' : "") + ">" + icon(n.icon) + n.label + "</a>";
    }).join("");

    if (top === "perevirka") checkPhotos();

    if (keepScroll) { window.scrollTo(0, y); return; }

    var anchor = top === "modul" && p[2] ? document.getElementById(p[2]) : null;
    if (anchor) {
      anchor.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
      var h1 = main.querySelector("h1");
      if (h1 && lastTop !== null) h1.focus({ preventScroll: true });
    }
    if (lastPath !== location.hash) track("/" + p.slice(0, 2).join("/"), false);
    lastPath = location.hash;
    lastTop = top;
  }
  var lastPath = null;
  var lastTop = null;

  /* ------------------------------------------------------------ події */

  var saveTimers = {};
  function noteSaved(key) {
    var els = document.querySelectorAll('[data-saved="' + key + '"]');
    Array.prototype.forEach.call(els, function (el) { el.textContent = "Збережено"; });
    clearTimeout(saveTimers[key]);
    saveTimers[key] = setTimeout(function () {
      Array.prototype.forEach.call(els, function (el) { el.textContent = ""; });
    }, 2000);
  }
  function refreshStatus() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-status]"), function (el) {
      el.innerHTML = chip(moduleStatus(Number(el.getAttribute("data-status"))));
    });
  }

  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-note")) {
      var nk = t.getAttribute("data-note");
      box("notes")[nk] = t.value;
      Array.prototype.forEach.call(document.querySelectorAll("[data-print]"), function (el) {
        if (el.getAttribute("data-print") === nk) el.textContent = t.value;
      });
      save(); noteSaved(nk); refreshStatus();
    } else if (t.hasAttribute("data-code")) {
      state.code = t.value.trim(); save();
    } else if (t.id === "gl-filter") {
      var q = t.value.trim().toLowerCase(), shown = 0;
      Array.prototype.forEach.call(document.querySelectorAll(".term"), function (el) {
        var hit = !q || el.getAttribute("data-term").indexOf(q) >= 0 || el.textContent.toLowerCase().indexOf(q) >= 0;
        el.hidden = !hit; if (hit) shown++;
      });
      document.getElementById("gl-empty").hidden = shown > 0;
    }
  });

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-quiz")) {
      var id = t.getAttribute("data-quiz"), qi = Number(t.getAttribute("data-q"));
      var q = box("quiz"); if (!Array.isArray(q[id])) q[id] = [];
      q[id][qi] = Number(t.value); save();
      var n = Number(id.slice(1));
      if (moduleParts(n).quiz) track("/podiia/test-modul-" + n, true);
      render(true);
    } else if (t.hasAttribute("data-step")) {
      box("steps")[t.getAttribute("data-step")] = t.checked; save(); refreshStatus();
      if (t.checked) track("/podiia/krok-" + t.getAttribute("data-step"), true);
    } else if (t.hasAttribute("data-check")) {
      var cid = t.getAttribute("data-check"), c = box("checks");
      if (!Array.isArray(c[cid])) c[cid] = [];
      c[cid][Number(t.getAttribute("data-i"))] = t.checked; save();
      var total = document.querySelectorAll('[data-check="' + cid + '"]').length;
      var done = document.querySelectorAll('[data-check="' + cid + '"]:checked').length;
      var el = document.querySelector('[data-count="' + cid + '"]');
      if (el) el.textContent = "Позначено " + done + " із " + total;
      if (done === total) track("/podiia/chek-lyst-" + cid, true);
    } else if (t.id === "io-file") {
      var file = t.files && t.files[0];
      if (!file) return;
      if (file.size > 2000000) { ioSay("Файл завеликий: це не копія нотаток із цього гайду.", true); t.value = ""; return; }
      var reader = new FileReader();
      reader.onload = function () { applyImport(reader.result); };
      reader.onerror = function () { ioSay("Не вдалося прочитати файл.", true); };
      reader.readAsText(file);
      t.value = "";
    } else if (t.hasAttribute("data-build")) {
      var b = box("builder"), v = currentVariant();
      if (!Array.isArray(b[v])) b[v] = [];
      var name = t.getAttribute("data-build"), i = b[v].indexOf(name);
      if (t.checked && i < 0) b[v].push(name);
      if (!t.checked && i >= 0) b[v].splice(i, 1);
      save(); render(true);
    }
  });

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-variant],[data-act]") : null;
    if (!t) return;
    if (t.hasAttribute("data-variant")) {
      state.variant = t.getAttribute("data-variant"); save(); render(true); return;
    }
    var act = t.getAttribute("data-act");
    if (act === "print") { window.print(); }
    else if (act === "wipe") {
      if (window.confirm("Стерти всі ваші відповіді, нотатки й результати самодіагностики? Скасувати це буде неможливо.")) {
        state = {}; save();
        try { localStorage.removeItem(BACKUP_KEY); } catch (e2) { /* приватний режим */ }
        render(false);
      }
    }
    else if (act === "copy") {
      var el = document.getElementById(t.getAttribute("data-target"));
      if (!el) return;
      var lab = t.querySelector("span") || t;
      copyText(el.textContent, function () {
        lab.textContent = "Скопійовано"; setTimeout(function () { lab.textContent = "Скопіювати текст"; }, 2000);
      });
    }
    else if (act === "to-data") {
      var sec = document.getElementById("moi-dani");
      if (sec) sec.scrollIntoView();
    }
    else if (act === "export-file") { downloadCopy(); }
    else if (act === "export-copy") {
      var lab2 = t.querySelector("span") || t;
      copyText(exportText(), function () {
        state.exportedAt = today(); save();
        track("/podiia/notatky-kopiia", true);
        lab2.textContent = "Скопійовано";
        setTimeout(function () { lab2.textContent = "Скопіювати нотатки як текст"; }, 2500);
        ioSay("Текст скопійовано. Вставте його в Записнику на іншому пристрої або в іншому браузері.", false);
      });
    }
    else if (act === "import-pick") {
      var fi = document.getElementById("io-file");
      if (fi) fi.click();
    }
    else if (act === "import-text") {
      var box2 = document.getElementById("io-text");
      applyImport(box2 ? box2.value : "");
    }
    else if (act === "diag-retry") {
      state[t.getAttribute("data-kind") === "finish" ? "retryFinish" : "retryStart"] = true; render(false);
    }
    else if (act === "build-add") {
      var inp = document.getElementById("build-own");
      var name = inp ? inp.value.trim() : "";
      if (!name) return;
      var b = box("builder"), v = currentVariant();
      if (!Array.isArray(b.own)) b.own = [];
      if (!Array.isArray(b[v])) b[v] = [];
      if (b.own.indexOf(name) < 0) b.own.push(name);
      if (b[v].indexOf(name) < 0) b[v].push(name);
      save(); render(true);
    }
  });

  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (form.hasAttribute("data-diag")) {
      e.preventDefault();
      var kind = form.getAttribute("data-diag");
      var res = computeDiag(form);
      var msg = form.querySelector(".form-msg");
      Array.prototype.forEach.call(form.querySelectorAll(".q.is-missing"), function (q) { q.classList.remove("is-missing"); });
      if (res.missing) {
        res.missing.forEach(function (id) {
          var q = form.querySelector('[data-q="' + id + '"]'); if (q) q.classList.add("is-missing");
        });
        msg.hidden = false;
        msg.textContent = "Залишилося без відповіді: " + res.missing.length + ". Ці пункти підсвічено.";
        var first = form.querySelector(".q.is-missing"); if (first) first.scrollIntoView({ block: "center" });
        return;
      }
      box("diag")[kind] = res;
      state[kind === "finish" ? "retryFinish" : "retryStart"] = false;
      save(); track("/podiia/samodiahnostyka-" + kind, true); render(false);
    } else if (form.hasAttribute("data-helper")) {
      e.preventDefault();
      var m2 = mod(2) || {};
      var tool = arr(m2.tools).filter(function (x) { return x.type === "helper"; })[0];
      if (!tool) return;
      var answers = [], sums = { t: {}, p: {} }, miss = 0;
      arr(tool.questions).forEach(function (q, i) {
        var el = form.querySelector('input[name="h-' + i + '"]:checked');
        if (!el) { miss++; return; }
        answers[i] = Number(el.value);
        var add = (arr(q.options)[answers[i]] || {}).add || {};
        ["t", "p"].forEach(function (g) {
          Object.keys(add[g] || {}).forEach(function (k) { sums[g][k] = (sums[g][k] || 0) + add[g][k]; });
        });
      });
      var hm = form.querySelector(".form-msg");
      if (miss) { hm.hidden = false; hm.textContent = "Дайте відповідь на всі запитання: залишилося " + miss + "."; return; }
      function best(o) { var bk = null; Object.keys(o).forEach(function (k) { if (bk === null || o[k] > o[bk]) bk = k; }); return bk; }
      var h = box("helper");
      h.answers = answers; h.type = best(sums.t); h.platform = best(sums.p);
      if (VARIANTS.indexOf(h.type) >= 0) state.variant = h.type;
      save(); track("/podiia/pomichnyk-vyboru", true); render(true);
      var hEl = document.getElementById("helper"); if (hEl) hEl.querySelector(".result").scrollIntoView({ block: "center" });
    }
  });

  // Якщо знімка екрана ще немає у папці, показуємо зрозумілу заглушку.
  document.addEventListener("error", function (e) {
    var t = e.target;
    if (t && t.tagName === "IMG" && t.hasAttribute("data-file")) {
      var span = document.createElement("span");
      span.className = "shot";
      span.innerHTML = "<b>Немає файла зображення.</b> Покладіть " + esc(t.getAttribute("data-file")) + " у папку assets/img";
      if (t.parentNode) t.parentNode.replaceChild(span, t);
    }
  }, true);

  /* ------------------------------------------------------------ запуск */

  function footer() {
    var a = cfg.author || {};
    document.getElementById("footer").innerHTML = '<div class="wrap footer-row"><p>' + esc(cfg.siteTitle || "Сайт-гайд") + ". " +
      esc(a.name || "") + (a.year ? ", " + esc(a.year) : "") + '.</p><p><a href="#/pro-proiekt">Про проєкт і конфіденційність</a>' +
      (DRAFT ? ' · <a href="#/perevirka">Перевірка вмісту (чернетка)</a>' : "") + "</p></div>";
    var mark = document.querySelector(".brand-mark");
    if (mark) mark.innerHTML = icon("route");
    if (cfg.siteTitle) document.getElementById("brand-title").textContent = cfg.siteTitle;
    if (cfg.siteSub) document.getElementById("brand-sub").textContent = cfg.siteSub;
  }

  window.addEventListener("hashchange", function () { render(false); });
  footer();
  render(false);
})();
