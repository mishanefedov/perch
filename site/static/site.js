// Copy buttons, and the link that opens the settings panel on this page.
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
  // a link to #install opens the install steps on the extension page
  function openInstall() {
    if (location.hash !== "#install") return;
    var d = document.querySelector(".ext-install details.now");
    if (d) d.open = true;
  }
  addEventListener("hashchange", openInstall);
  openInstall();
})();
