/* ==========================================================================
   CAMPGRNDS motion.js — dependency-free animation layer for the inner pages.
   Every effect is opt-in through a data attribute, so pages stay readable
   with JS off. Honors prefers-reduced-motion.

   data-split            words rise out of a mask when in view
   data-reveal           fade + rise when in view   (data-reveal="clip" = image wipe)
   data-d="120"          delay in ms for the above
   data-stagger          children get increasing delays
   data-scrub            paragraph lights up word by word with scroll
   data-parallax="0.12"  drifts against the scroll
   data-count="55"       counts up from 0 when in view
   data-progress         sets --p (0..1) as the element scrolls through view
   data-preview="Label"  (on .row) shows the floating preview while hovered
   data-cursor="View"    cursor ring grows and shows the label
   data-magnetic         element leans toward the pointer
   .marquee-track        content is duplicated for a seamless loop
   data-progress="pin"   --p tracks a tall pinned section (horizontal reel)
   data-grow             banner scales up to full width as it enters
   .hf[data-hf]          Higgsfield slot: loads assets/hf/<id>.mp4 / .jpg when present
   #booking[data-booking-url]  embeds the booking calendar (Cal.com, Calendly...)
   ========================================================================== */
(function () {
  "use strict";
  var doc = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  if (!reduce && "IntersectionObserver" in window) doc.classList.add("motion");

  /* ---------- Images: keep the designed placeholder when a file is missing ---------- */
  $$(".media img").forEach(function (img) {
    var drop = function () { img.remove(); };
    if (img.complete && img.naturalWidth === 0) drop();
    else img.addEventListener("error", drop, { once: true });
  });

  /* ---------- Higgsfield slots: drop files into assets/hf/ and they appear ----------
     <figure class="hf" data-hf="about-hero" data-kind="video">  -> assets/hf/about-hero.mp4 (+ .jpg poster)
     <figure class="hf" data-hf="topic-espr" data-kind="image">  -> assets/hf/topic-espr.jpg
     Optional: data-src="assets/hf/custom-name.webp" to point at a specific file. */
  var hfLoad = function (fig) {
    var id = fig.dataset.hf, kind = fig.dataset.kind || "image";
    var base = (fig.dataset.dir || "assets/hf/") + id;
    var showImage = function (src) {
      var im = new Image();
      im.alt = fig.dataset.alt || ""; im.decoding = "async";
      im.onload = function () { fig.appendChild(im); requestAnimationFrame(function () { fig.classList.add("is-loaded"); }); };
      im.src = src;
    };
    if (fig.dataset.src) {
      if (/\.(mp4|webm)$/i.test(fig.dataset.src)) kind = "video-src"; else { showImage(fig.dataset.src); return; }
    }
    if ((kind === "video" || kind === "video-src") && !reduce) {
      var v = document.createElement("video");
      v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
      v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.preload = "auto";
      if (kind === "video") v.poster = base + ".jpg";
      v.addEventListener("loadeddata", function () { fig.classList.add("is-loaded"); var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }, { once: true });
      v.addEventListener("error", function () { v.remove(); showImage(base + ".jpg"); }, { once: true });
      v.src = kind === "video-src" ? fig.dataset.src : base + ".mp4";
      fig.appendChild(v);
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause(); });
        }).observe(fig);
      }
    } else {
      showImage(base + ".jpg");
    }
  };
  var hfSlots = $$(".hf[data-hf]");
  if ("IntersectionObserver" in window) {
    var hio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { hfLoad(e.target); hio.unobserve(e.target); } });
    }, { rootMargin: "600px 0px" });
    hfSlots.forEach(function (f) { hio.observe(f); });
  } else hfSlots.forEach(hfLoad);

  /* ---------- Booking calendar: set data-booking-url on #booking ---------- */
  var booking = $("#booking");
  if (booking && booking.dataset.bookingUrl) {
    var frame = document.createElement("iframe");
    frame.src = booking.dataset.bookingUrl; frame.title = "Book a consulting session"; frame.loading = "lazy";
    booking.appendChild(frame); booking.classList.add("is-live");
    $$("[data-book-link]").forEach(function (a) { a.href = booking.dataset.bookingUrl; a.target = "_blank"; a.rel = "noopener"; });
  }

  /* ---------- Split text into masked words ---------- */
  $$("[data-split]").forEach(function (el) {
    var i = 0;
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            var w = document.createElement("span"); w.className = "w";
            var wi = document.createElement("span"); wi.className = "wi"; wi.textContent = part;
            wi.style.setProperty("--i", i++);
            w.appendChild(wi); frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== "BR") { walk(child); }
      });
    };
    walk(el);
    el.classList.add("split");
    if (el.dataset.d) el.style.setProperty("--d", el.dataset.d);
  });

  /* ---------- Stagger + delays ---------- */
  $$("[data-stagger]").forEach(function (parent) {
    var step = parseInt(parent.dataset.stagger, 10) || 90;
    Array.prototype.slice.call(parent.children).forEach(function (c, n) {
      if (!c.hasAttribute("data-reveal")) c.setAttribute("data-reveal", "");
      c.style.setProperty("--d", n * step);
    });
  });
  $$("[data-reveal][data-d]").forEach(function (el) { el.style.setProperty("--d", el.dataset.d); });

  /* ---------- Reveal on view ---------- */
  var revealables = $$("[data-reveal], .split");
  if (doc.classList.contains("motion")) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revealables.forEach(function (el) { io.observe(el); });
    // Anything already on screen animates in right after first paint.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var vh = window.innerHeight;
        revealables.forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.top < vh && r.bottom > 0) el.classList.add("is-in");
        });
      });
    });
  } else {
    revealables.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- Counters ---------- */
  var counters = $$("[data-count]");
  var runCount = function (el) {
    var to = parseFloat(el.dataset.count), dur = 1600, t0 = null;
    if (reduce) { el.textContent = to; return; }
    var tick = function (t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(to * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { runCount(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.4 });
    counters.forEach(function (c) { cio.observe(c); });
  }

  /* ---------- Scrubbed paragraphs ---------- */
  var scrubs = $$("[data-scrub]").map(function (el) {
    var words = [];
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            var s = document.createElement("span"); s.className = "sw"; s.textContent = part;
            words.push(s); frag.appendChild(s);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) { walk(child); }
      });
    };
    walk(el);
    return { el: el, words: words };
  });

  /* ---------- Scroll-driven effects (one rAF loop) ---------- */
  var parallax = $$("[data-parallax]");
  var progress = $$("[data-progress]");
  var grows = $$("[data-grow]");
  var header = $(".site-header");
  var readBar = $(".progress-bar");
  var article = $(".article");
  var lastY = window.scrollY, ticking = false;

  var onScroll = function () {
    var y = window.scrollY, vh = window.innerHeight;
    if (header) {
      header.classList.toggle("is-scrolled", y > 40);
      if (!doc.classList.contains("menu-open")) header.classList.toggle("is-hidden", y > lastY && y > 320);
    }
    lastY = y;
    if (reduce) return;
    parallax.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var speed = parseFloat(el.dataset.parallax) || 0.1;
      var offset = (r.top + r.height / 2 - vh / 2) * -speed;
      el.style.transform = "translate3d(0," + offset.toFixed(1) + "px,0)";
    });
    progress.forEach(function (el) {
      var r = el.getBoundingClientRect(), p;
      if (el.dataset.progress === "pin") p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh)));
      else p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      el.style.setProperty("--p", p.toFixed(3));
    });
    grows.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var g = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.75)));
      el.style.setProperty("--g", g.toFixed(3));
    });
    scrubs.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (r.height + vh * 0.25)));
      var lit = Math.round(p * s.words.length);
      s.words.forEach(function (w, n) { w.classList.toggle("on", n < lit); });
    });
    if (readBar && article) {
      var a = article.getBoundingClientRect();
      var rp = Math.min(1, Math.max(0, -a.top / (a.height - vh)));
      readBar.style.setProperty("--read", rp.toFixed(3));
    }
  };
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(function () { onScroll(); ticking = false; }); }
  }, { passive: true });
  window.addEventListener("resize", onScroll);
  if (doc.classList.contains("motion")) progress.forEach(function (el) { el.style.setProperty("--p", 0); });
  onScroll();

  /* ---------- Marquee: duplicate content for a seamless loop ---------- */
  $$(".marquee-track").forEach(function (track) {
    track.innerHTML += track.innerHTML;
    Array.prototype.slice.call(track.children).forEach(function (c, n) { if (n >= track.children.length / 2) c.setAttribute("aria-hidden", "true"); });
  });

  /* ---------- Mobile menu ---------- */
  var toggle = $(".menu-toggle");
  if (toggle) {
    $$(".mobile-menu a.big").forEach(function (a, n) { a.style.setProperty("--i", n); });
    var menuEl = $(".mobile-menu");
    var swell = window.glyphSwell && menuEl ? window.glyphSwell(menuEl, { opacity: 0.7 }) : null, swellStop = 0;
    var setMenu = function (open) {
      doc.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (header) header.classList.remove("is-hidden");
      document.body.style.overflow = open ? "hidden" : "";
      if (swell) { // keep animating through the .7s close wipe
        clearTimeout(swellStop);
        if (open) swell.start(); else swellStop = setTimeout(swell.stop, 750);
      }
    };
    toggle.addEventListener("click", function () { setMenu(!doc.classList.contains("menu-open")); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
  }

  /* ---------- Cursor, hover previews, magnetic buttons ---------- */
  if (finePointer && !reduce) {
    doc.classList.add("has-cursor");
    var dot = document.createElement("div"); dot.className = "cursor";
    var ring = document.createElement("div"); ring.className = "cursor-ring";
    document.body.appendChild(dot); document.body.appendChild(ring);
    var mx = -100, my = -100, rx = -100, ry = -100;
    var preview = $(".hover-preview"), px = -100, py = -100;
    window.addEventListener("pointermove", function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
    var loop = function () {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      px += (mx - px) * 0.1; py += (my - py) * 0.1;
      dot.style.transform = "translate3d(" + mx + "px," + my + "px,0)";
      ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      if (preview) preview.style.transform = "translate3d(" + px + "px," + py + "px,0) translate(-50%,-50%) scale(" + (preview.classList.contains("is-on") ? 1 : 0.85) + ")";
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    document.addEventListener("pointerover", function (e) {
      var t = e.target.closest("a, button, summary, label.chip, [data-cursor]");
      ring.classList.remove("is-link", "is-label"); ring.textContent = "";
      if (!t) return;
      if (t.dataset.cursor) { ring.classList.add("is-label"); ring.textContent = t.dataset.cursor; }
      else ring.classList.add("is-link");
    });

    if (preview) {
      var pMedia = $(".media", preview), pImg = $("img", preview);
      $$("[data-preview]").forEach(function (row) {
        row.addEventListener("pointerenter", function () {
          pMedia.setAttribute("data-label", row.dataset.preview);
          if (row.dataset.img) {
            if (!pImg) { pImg = document.createElement("img"); pImg.alt = ""; pImg.addEventListener("error", function () { pImg.style.display = "none"; }); pMedia.appendChild(pImg); }
            pImg.style.display = ""; pImg.src = row.dataset.img;
          }
          preview.classList.add("is-on");
        });
        row.addEventListener("pointerleave", function () { preview.classList.remove("is-on"); });
      });
    }

    $$("[data-magnetic]").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.25, y = (e.clientY - r.top - r.height / 2) * 0.35;
        el.style.transform = "translate(" + x + "px," + y + "px)";
      });
      el.addEventListener("pointerleave", function () {
        el.style.transition = "transform .6s cubic-bezier(.16,1,.3,1)"; el.style.transform = "";
        setTimeout(function () { el.style.transition = ""; }, 600);
      });
    });
  }

  /* ---------- Tap ripple on click (the NFC "tap") ---------- */
  if (!reduce) {
    document.addEventListener("pointerdown", function (e) {
      var r = document.createElement("span"); r.className = "click-ring";
      r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px";
      document.body.appendChild(r);
      setTimeout(function () { r.remove(); }, 750);
    });
  }

  /* ---------- Page transitions (curtain) ---------- */
  var curtain = document.createElement("div"); curtain.className = "curtain"; curtain.setAttribute("aria-hidden", "true");
  document.body.appendChild(curtain);
  var cameFromSite = false;
  try { cameFromSite = sessionStorage.getItem("cg-transition") === "1"; sessionStorage.removeItem("cg-transition"); } catch (e) {}
  if (cameFromSite && !reduce) {
    curtain.classList.add("is-entering");
    requestAnimationFrame(function () { requestAnimationFrame(function () { curtain.classList.add("go"); }); });
    setTimeout(function () { curtain.className = "curtain"; }, 800);
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href]");
    if (!a || reduce || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    var href = a.getAttribute("href");
    if (a.target === "_blank" || href.charAt(0) === "#" || /^(mailto|tel|sms):/i.test(href)) return;
    var url; try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
    e.preventDefault();
    try { sessionStorage.setItem("cg-transition", "1"); } catch (err) {}
    curtain.classList.add("is-leaving");
    setTimeout(function () { location.href = url.href; }, 520);
  });
  window.addEventListener("pageshow", function (e) { if (e.persisted) curtain.className = "curtain"; });

  /* ---------- Footer: year + Newark local time ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  var clock = $("[data-clock]");
  if (clock) {
    var fmt = function () {
      try {
        clock.textContent = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" }).format(new Date()) + " ET";
      } catch (e) { clock.textContent = "ET"; }
    };
    fmt(); setInterval(fmt, 30000);
  }

  /* ---------- Contact form ---------- */
  var form = $("#contact-form");
  if (form) {
    var status = $(".form-status", form);
    var show = function (id, msg) { var el = $("#" + id + "-err"); if (el) el.textContent = msg || ""; };
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.name.value.trim(), email = form.email.value.trim(), msg = form.message.value.trim();
      var ok = true;
      show("name"); show("email"); show("message");
      if (!name) { show("name", "Add your name so we know who to reply to."); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { show("email", "Enter an email like you@brand.com."); ok = false; }
      if (msg.length < 10) { show("message", "Tell us a little more: what you make and what you want the garment to do."); ok = false; }
      if (!ok) return;
      var interests = $$("input[name=interest]:checked", form).map(function (i) { return i.value; }).join(", ");
      var endpoint = form.dataset.endpoint;
      var btn = $("button[type=submit]", form);
      if (endpoint) {
        btn.disabled = true; status.textContent = "Sending…";
        fetch(endpoint, { method: "POST", headers: { "Accept": "application/json" }, body: new FormData(form) })
          .then(function (r) {
            if (!r.ok) throw new Error("bad status");
            form.reset(); status.textContent = "Received. We reply within two business days.";
          })
          .catch(function () { status.textContent = "That didn't send. Email info@campgrnds.com and we'll pick it up from there."; })
          .then(function () { btn.disabled = false; });
      } else {
        var body = "Name: " + name + "\nEmail: " + email + "\nPhone: " + form.phone.value.trim() + "\nInterested in: " + (interests || "Not sure yet") + "\n\n" + msg;
        location.href = "mailto:info@campgrnds.com?subject=" + encodeURIComponent("Request a quote — " + name) + "&body=" + encodeURIComponent(body);
        status.textContent = "Your email app should open with this message filled in. If nothing opened, email info@campgrnds.com directly.";
      }
    });
  }

  /* ---------- Copy buttons ---------- */
  $$("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var text = b.dataset.copy, label = b.textContent;
      var done = function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = label; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
    });
  });
})();
