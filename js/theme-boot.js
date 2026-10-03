// Wird vor dem Design geladen, damit beim Start nichts kurz hell aufblitzt.
(function () {
  try {
    var t = localStorage.getItem('fh-theme');
    if (t === 'hell' || t === 'dunkel' || t === 'pink') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* privater Modus */ }
})();
