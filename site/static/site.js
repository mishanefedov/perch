// Copy buttons, and the creature chips that swap the live creature on this page.
(function () {
  document.querySelectorAll("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var text = b.getAttribute("data-copy");
      var done = function () { var l = b.textContent; b.textContent = "Copied"; setTimeout(function () { b.textContent = l; }, 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done); else done();
    });
  });
  document.querySelectorAll("[data-open-tuner]").forEach(function (b) {
    b.addEventListener("click", function () { window.dispatchEvent(new Event("perch:tuner")); });
  });
  var chips = document.querySelectorAll("[data-creature]");
  chips.forEach(function (b) {
    b.addEventListener("click", function () {
      if (!window.Perch) return;
      window.Perch.init({ creature: b.getAttribute("data-creature"), goal: "#install", stickiness: 0.6 });
      chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c === b)); });
    });
  });

  // a link to #extension (the creature's question) opens the install steps right there
  function openInstall() {
    if (location.hash !== "#extension" && location.hash !== "#install") return;
    var d = document.querySelector("#extension details.now, #ext-install details.now, .ext-install details.now");
    if (d) d.open = true;
  }
  addEventListener("hashchange", openInstall);
  openInstall();
})();
