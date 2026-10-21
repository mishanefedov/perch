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

  // After a few seconds the creature on this page asks the question itself.
  (function () {
    if (/^\/extension\//.test(location.pathname)) return;
    try { if (sessionStorage.getItem("perch-bubble") === "1") return; } catch (e) { /* storage can be blocked */ }
    var bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.setAttribute("role", "status");
    bubble.innerHTML = '<p>Want me on <strong>every</strong> website?</p><a class="btn primary" href="/extension/">Get the extension</a><button type="button" aria-label="Close">\u00d7</button>';
    document.body.appendChild(bubble);
    var raf = 0;
    var floor = function () { return document.querySelector("[data-perch-root]:not([data-perch-tuner])"); };
    function place() {
      var r = floor();
      if (r) {
        var b = r.getBoundingClientRect(), w = bubble.offsetWidth, h = bubble.offsetHeight;
        var cx = b.left + b.width / 2, x = Math.min(Math.max(8, cx - w / 2), innerWidth - w - 8);
        var below = b.top - h - 14 < 8, y = below ? b.bottom + 14 : b.top - h - 14;
        bubble.classList.toggle("below", below);
        bubble.style.setProperty("--tail", Math.min(Math.max(20, cx - x), w - 20) + "px");
        bubble.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
      }
      raf = requestAnimationFrame(place);
    }
    var timer = setTimeout(function () { bubble.classList.add("on"); place(); }, 7000);
    bubble.querySelector("button").addEventListener("click", function () {
      clearTimeout(timer); cancelAnimationFrame(raf); bubble.remove();
      try { sessionStorage.setItem("perch-bubble", "1"); } catch (e) { /* storage can be blocked */ }
    });
  })();
})();
