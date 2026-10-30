/* Tilted Grid — one row of images streaming right to left around the inside of a cylinder.
   The centre faces you flat, the ends bend toward you and fade into the page.

   Markup: a div.tilted-grid[data-tilted-grid] holding one img per item, each with its real width and
   height attributes and alt text. Those imgs are the item list, and also the no-JS and screen-reader
   version. Per img: data-video="clip.mp4" makes it that clip's poster; data-caption="Title|Sub" names it.
   Host options: data-curve, data-max-arc, data-tile-height, data-gap, data-axis, data-fade, data-max-width,
   data-seconds-per-item, data-captions (show the centred item's caption), data-interactive (drag,
   arrow keys, and buttons with data-tg-step="1|-1" in the same section scrub the row).
   Each tile keeps its own item's aspect ratio, so nothing is cropped; tiles are laid along the arc by
   their own widths.

   A CSS box can't bend, so every tile is cut into SLICES vertical strips, each a flat facet of the
   cylinder turned its own few degrees round the axis. The tile (preserve-3d) is what moves: one
   rotateY about that same axis carries it along the arc. JS sets each tile's angle per frame and
   hides it past the frame's edge, where it wraps to the far end of the row out of sight. Images load
   as their tile nears the frame; a clip plays only while its tile is in view, each strip drawing its
   slice of one shared <video> onto a canvas. */
(function () {
  var SLICES = 16;
  // Camera distance as a multiple of the cylinder's radius: just past the axis, so the ends swell.
  var CAMERA = 1.6;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var deg = function (rad) { return (rad * 180) / Math.PI; };
  var clamp = function (lo, v, hi) { return Math.max(lo, Math.min(hi, v)); };
  var mod = function (n, m) { return ((n % m) + m) % m; };
  // Cylinder radius, as a share of the width, that puts the frame's edge `bend` radians round the arc.
  var arc = function (bend) { return (CAMERA - 1 + Math.cos(bend)) / (2 * CAMERA * Math.sin(bend)); };

  var init = function (host) {
    var o = host.dataset;
    var tileHeight = +(o.tileHeight || 62), gap = +(o.gap || 6), axis = +(o.axis || 50);
    var fade = +(o.fade || 12), maxWidth = +(o.maxWidth || 70);
    // Largest tile height as a share of the radius: caps how much arc one tile can wrap.
    var maxArc = +(o.maxArc || 0.6);
    var secondsPerItem = +(o.secondsPerItem || 10.78);
    var items = Array.prototype.map.call(host.querySelectorAll(":scope > img"), function (im) {
      var cap = (im.getAttribute("data-caption") || "").split("|");
      return { src: im.getAttribute("src"), video: im.getAttribute("data-video") || "", title: cap[0] || "", sub: cap[1] || "",
               aspect: +im.getAttribute("width") / +im.getAttribute("height") || 1 };
    });
    if (!items.length) return;

    var band = document.createElement("div");
    band.className = "tg-band";
    band.setAttribute("aria-hidden", "true");
    host.appendChild(band);
    var caption = null;
    if ("captions" in o) {
      caption = document.createElement("p");
      caption.className = "tg-caption";
      caption.setAttribute("aria-hidden", "true"); // the imgs' alt text already names every item
      host.appendChild(caption);
    }
    host.classList.add("is-live");

    var tiles = [], L = 0, r = 0, unit = 0, speed = 0, s = 0, W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var raf = 0, last = 0, visible = true, centred = -1;
    var vel = 0, tween = null, drag = null; // interaction state (data-interactive)
    var turn = function (d) { return "translateZ(" + r.toFixed(2) + "px) rotateY(" + d.toFixed(4) + "deg) translateZ(-" + r.toFixed(2) + "px)"; };

    // One hidden, muted, looping <video> per clip, shared by every tile that shows it. Nothing loads
    // until a tile showing it comes into view.
    var videoFor = function (it) {
      if (it.el) return it.el;
      var v = (it.el = document.createElement("video"));
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = "none";
      v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
      v.src = it.video;
      v.addEventListener("loadeddata", function () { paint(); }); // first frame, also the reduced-motion still
      return v;
    };

    var build = function () {
      var w = host.clientWidth, h = host.clientHeight;
      if (!w || !h || (w === W && h === H)) return;
      var keep = L ? s / L : 0; // keep the row's place across a resize
      W = w; H = h;
      // Gentler curve on narrow screens, where a tight cylinder would wrap one tile round half the arc.
      var bend = (clamp(5, +(o.curve || 55) - (W < 700 ? 15 : 0), 85) * Math.PI) / 180;
      var maxA = Math.max.apply(null, items.map(function (i) { return i.aspect; }));
      r = W * arc(bend);
      var th = Math.min((tileHeight / 100) * H, (maxWidth / 100) * W / maxA, maxArc * r);
      unit = deg(th / r);
      var g = (gap / 100) * unit;
      // The loop reaches past both edges, so a tile only ever wraps out of sight.
      var need = 2 * deg(bend) + 2 * maxA * unit;
      var one = items.reduce(function (t, i) { return t + i.aspect * unit + g; }, 0);
      var reps = Math.min(30, Math.max(1, Math.ceil(need / one)));

      band.textContent = "";
      tiles = [];
      centred = -1;
      band.style.perspective = (r * CAMERA).toFixed(1) + "px";
      band.style.perspectiveOrigin = "50% " + axis + "%";
      band.style.webkitMaskImage = band.style.maskImage =
        "linear-gradient(90deg,transparent,#000 " + fade + "%,#000 " + (100 - fade) + "%,transparent)";

      var pos = 0;
      for (var rep = 0; rep < reps; rep++) items.forEach(function (it) {
        var a = it.aspect, tw = a * th, share = a / SLICES;
        var tile = document.createElement("div"), canvases = [], imgs = [];
        tile.className = "tg-tile";
        tile.style.cssText = "left:" + (W / 2 - tw / 2).toFixed(2) + "px;top:calc(" + axis + "% - " + (th / 2).toFixed(2) + "px);width:" + tw.toFixed(2) + "px;height:" + th.toFixed(2) + "px";
        for (var k = 0; k < SLICES; k++) {
          var strip = document.createElement("div");
          strip.className = "tg-strip" + (k === 0 ? " is-first" : k === SLICES - 1 ? " is-last" : "");
          // A pixel wider than its share so neighbouring facets overlap and no hairline opens.
          var sw = share * th + (k < SLICES - 1 ? 1 : 0);
          strip.style.cssText = "left:" + (((a - share) / 2) * th).toFixed(2) + "px;width:" + sw.toFixed(2) +
            "px;height:" + th.toFixed(2) + "px;transform:" + turn((a / 2 - (k + 0.5) * share) * unit);
          // Every strip shows the still (the clip's poster, for a video) until it has loaded.
          var img = document.createElement("img");
          img.alt = ""; img.draggable = false; img.decoding = "async";
          img.style.cssText = "left:" + (-k * share * th).toFixed(2) + "px;width:" + tw.toFixed(2) + "px;height:" + th.toFixed(2) + "px";
          imgs.push(img);
          strip.appendChild(img);
          if (it.video) {
            var cv = document.createElement("canvas");
            cv.width = Math.round(sw * dpr); cv.height = Math.round(th * dpr);
            cv.style.cssText = "left:0;width:100%;height:100%";
            cv.sx = k / SLICES; cv.sw = sw / tw;
            canvases.push(cv);
            strip.appendChild(cv);
          }
          tile.appendChild(strip);
        }
        band.appendChild(tile);
        var span = a * unit;
        tiles.push({ el: tile, it: it, imgs: imgs, loaded: false, base: pos + span / 2, limit: deg(bend) + span / 2,
                     vid: it.video ? videoFor(it) : null, canvases: canvases });
        pos += span + g;
      });
      L = pos;
      s = keep * L;
      // Same pace as the Work page reel: one of its items (width + gap) per `secondsPerItem`, at the row's centre.
      var itemPx = clamp(240, 0.28 * W, 420) + clamp(16, 0.02 * W, 28);
      speed = deg(itemPx / secondsPerItem / r);
      paint();
    };

    var drawVideo = function (t) {
      var v = t.vid, vw = v.videoWidth, vh = v.videoHeight;
      for (var c = 0; c < t.canvases.length; c++) {
        var cv = t.canvases[c], x0 = cv.sx * vw, w0 = Math.min(cv.sw * vw, vw - x0);
        cv.getContext("2d").drawImage(v, x0, 0, w0, vh, 0, 0, cv.width * (w0 / (cv.sw * vw)), cv.height);
      }
    };

    var paint = function () {
      var best = -1, bestA = 1e9, wanted = [];
      for (var i = 0; i < tiles.length; i++) {
        var t = tiles[i], a = mod(t.base - s + L / 2, L) - L / 2; // arc position, + is right of centre
        var on = Math.abs(a) < t.limit;
        // Fetch a tile's image a little before it comes round into view.
        if (!t.loaded && Math.abs(a) < t.limit + 25) {
          t.loaded = true;
          t.imgs.forEach(function (im) { im.src = t.it.src; });
        }
        t.el.style.visibility = on ? "visible" : "hidden";
        if (!on) continue;
        t.el.style.transform = turn(-a);
        if (t.vid) { wanted.push(t.vid); if (t.vid.readyState >= 2) drawVideo(t); }
        if (Math.abs(a) < bestA) { bestA = Math.abs(a); best = i; }
      }
      // Play exactly the clips that are on screen.
      tiles.forEach(function (t) {
        if (!t.vid) return;
        var want = visible && !document.hidden && wanted.indexOf(t.vid) >= 0;
        if (want && !reduce && t.vid.paused) { var p = t.vid.play(); if (p && p.catch) p.catch(function () {}); }
        else if (want && reduce && !t.vid.requested) { t.vid.requested = true; t.vid.preload = "auto"; t.vid.load(); } // one still frame
        else if (!want && !t.vid.paused) t.vid.pause();
      });
      if (caption && best >= 0 && tiles[best].it !== centred) {
        centred = tiles[best].it;
        caption.innerHTML = "";
        var b = document.createElement("b"); b.textContent = centred.title;
        var sp = document.createElement("span"); sp.textContent = centred.sub;
        caption.appendChild(b); caption.appendChild(sp);
      }
    };

    var tick = function (ms) {
      raf = 0;
      if (!visible || document.hidden) { last = 0; paint(); return; }
      var dt = last ? Math.min(0.05, (ms - last) / 1000) : 0;
      last = ms;
      if (tween) {
        var k = Math.min(1, (ms - tween.t0) / tween.dur), e = 1 - Math.pow(1 - k, 3);
        s = tween.from + (tween.to - tween.from) * e;
        if (k === 1) tween = null;
      } else if (!drag) {
        if (Math.abs(vel) > 0.5) { s += vel * dt; vel *= Math.pow(0.04, dt); } // fling after a drag
        else { vel = 0; if (!reduce) s += speed * dt; }
      }
      paint();
      if (!reduce || tween || drag || vel) raf = requestAnimationFrame(tick);
      else last = 0;
    };
    var wake = function () { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick); };

    // ---- data-interactive: drag, step buttons, arrow keys ----
    if ("interactive" in o) {
      // Step so the next (dir 1) or previous (dir -1) item lands at the centre.
      var step = function (dir) {
        vel = 0;
        var from = tween ? tween.to : s, best = null;
        tiles.forEach(function (t) {
          var d = mod(t.base - from, L); // how far round the row must move for this tile to centre
          if (dir < 0) d -= L;
          if (Math.abs(d) < unit * 0.25) return; // already centred
          if (best === null || Math.abs(d) < Math.abs(best)) best = d;
        });
        if (best === null) return;
        tween = { from: s, to: from + best, t0: performance.now(), dur: reduce ? 1 : 650 };
        wake();
      };
      host.addEventListener("pointerdown", function (e) {
        if (e.button !== 0) return;
        tween = null; vel = 0;
        drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, s0: s, lx: e.clientX, lt: performance.now(), on: false };
        wake();
      });
      window.addEventListener("pointermove", function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        var dx = e.clientX - drag.sx;
        if (!drag.on) {
          if (Math.abs(dx) < 6) return;
          if (e.pointerType !== "mouse" && Math.abs(e.clientY - drag.sy) > Math.abs(dx)) { drag = null; return; } // vertical swipe: let the page scroll
          drag.on = true;
          host.classList.add("is-dragging");
          try { host.setPointerCapture(e.pointerId); } catch (err) {}
        }
        var now = performance.now();
        vel = -deg((e.clientX - drag.lx) / r) / Math.max(1, now - drag.lt) * 1000;
        drag.lx = e.clientX; drag.lt = now;
        s = drag.s0 - deg(dx / r); // dragging left brings the next items in
      });
      var endDrag = function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        if (!drag.on || performance.now() - drag.lt > 80) vel = 0; // a held pointer drops its momentum
        drag = null;
        host.classList.remove("is-dragging");
        wake();
      };
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
      host.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); step(e.key === "ArrowRight" ? 1 : -1); }
      });
      var scope = host.closest("section") || document;
      Array.prototype.forEach.call(scope.querySelectorAll("[data-tg-step]"), function (b) {
        b.addEventListener("click", function () { step(+b.getAttribute("data-tg-step")); });
      });
    }

    build();
    new ResizeObserver(build).observe(host);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        visible = es[es.length - 1].isIntersecting; // newest entry wins when several are batched
        paint(); wake();
      }).observe(host);
    }
    document.addEventListener("visibilitychange", function () { paint(); wake(); });
    wake();
  };

  var start = function () { Array.prototype.forEach.call(document.querySelectorAll("[data-tilted-grid]"), init); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
