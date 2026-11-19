/* Реєстр вмісту. Підключається ПЕРЕД файлами з папки content/.
   Кожен файл вмісту викликає GUIDE.register("назва", { ... }). */
(function () {
  "use strict";
  var G = (window.GUIDE = {
    data: {},
    errors: [],
    expected: [
      "config", "home", "start",
      "module-1", "module-2", "module-3", "module-4", "module-5", "module-6",
      "finish", "dovidnyk", "about"
    ]
  });

  G.register = function (name, obj) {
    G.data[name] = obj;
  };

  // Якщо у файлі вмісту синтаксична помилка, він не завантажиться.
  // Запам'ятовуємо помилку, щоб показати її на сторінці "Перевірка вмісту".
  window.addEventListener("error", function (e) {
    if (e && e.filename) {
      G.errors.push({
        file: String(e.filename).split("/").pop(),
        line: e.lineno || 0,
        message: e.message || "помилка"
      });
    }
  });
})();
