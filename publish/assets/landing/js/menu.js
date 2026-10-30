/* Site menu for the Webflow landing page (same behaviour as the mobile menu in assets/js/motion.js). */
(function () {
  var doc = document.documentElement;
  var toggle = document.querySelector(".menu-toggle");
  if (!toggle) return;
  document.querySelectorAll(".mobile-menu a.big").forEach(function (a, n) { a.style.setProperty("--i", n); });
  var menuEl = document.querySelector(".mobile-menu");
  var swell = window.glyphSwell && menuEl ? window.glyphSwell(menuEl, { opacity: 0.7 }) : null, swellStop = 0;
  var setMenu = function (open) {
    doc.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.style.overflow = open ? "hidden" : "";
    if (swell) { // keep animating through the .7s close wipe
      clearTimeout(swellStop);
      if (open) swell.start(); else swellStop = setTimeout(swell.stop, 750);
    }
  };
  toggle.addEventListener("click", function () { setMenu(!doc.classList.contains("menu-open")); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
})();
