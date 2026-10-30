/* Glyph Swell — a quiet grid of monospaced marks. Swells start wherever the pointer is
   and travel outward as rings, lifting each cell through denser glyphs and brighter ink;
   left alone, slow swells start from random cells. Used behind the expanded menu.

   var swell = glyphSwell(hostEl, { colors: [bg, ink, crest], ramp, cell, opacity });
   swell.start();  swell.stop();   // only animates (and listens) between start and stop */
(function () {
  window.glyphSwell = function (host, opts) {
    opts = opts || {};
    var colors = opts.colors || ["#050505", "#0bafe1", "#f5f5f5"];
    var ramp = opts.ramp || "·:-+=*#";
    var cell = opts.cell || 15;
    var noop = { start: function () {}, stop: function () {} };

    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.className = "glyph-swell";
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:0;opacity:" +
      (opts.opacity == null ? 1 : opts.opacity);
    host.prepend(canvas);
    var ctx = canvas.getContext("2d");
    if (!ctx) return noop;

    var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var coarse = !matchMedia("(hover: hover) and (pointer: fine)").matches;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var size = coarse ? Math.round(cell * 0.85) : cell;
    var L = ramp.length;

    // Glyph atlas: every mark pre-drawn once in ink and once in the crest colour.
    var atlas = document.createElement("canvas");
    var S = Math.ceil(size * dpr);
    atlas.width = S * L;
    atlas.height = S * 2;
    var a = atlas.getContext("2d");
    var paintAtlas = function () {
      a.clearRect(0, 0, atlas.width, atlas.height);
      a.textAlign = "center";
      a.textBaseline = "middle";
      a.font = "500 " + Math.round(size * 0.82 * dpr) + 'px "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace';
      [colors[1], colors[2]].forEach(function (c, row) {
        a.fillStyle = c;
        for (var i = 0; i < L; i++) a.fillText(ramp[i], i * S + S / 2, row * S + S / 2 + dpr * 0.5);
      });
    };
    paintAtlas();
    if (document.fonts) document.fonts.ready.then(paintAtlas);

    var W = 0, H = 0, cols = 0, rows = 0;
    var raf = 0, running = false, last = 0, lastIdle = 0, lastSpawn = 0, lastCell = -1;
    var swells = [];
    var t0 = performance.now();
    var now = function () { return (performance.now() - t0) / 1000; };

    var resize = function () {
      var w = host.clientWidth, h = host.clientHeight;
      if (w === W && h === H) return;
      W = w; H = h;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      cols = Math.ceil(W / size) + 1;
      rows = Math.ceil(H / size) + 1;
    };

    var frame = function (t) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      while (swells.length && t - swells[0].t > 6) swells.shift();
      var ox = ((W - (cols - 1) * size) / 2) * dpr, oy = ((H - (rows - 1) * size) / 2) * dpr;
      for (var j = 0; j < rows; j++) {
        for (var i = 0; i < cols; i++) {
          // A low murmur everywhere, so the field is never fully still.
          var v = 0.06 + 0.05 * Math.sin(i * 0.37 + t * 0.6) * Math.sin(j * 0.29 - t * 0.45);
          for (var k = 0; k < swells.length; k++) {
            var s = swells[k], age = t - s.t, d = Math.hypot(i - s.x, j - s.y), front = age * 17;
            var band = Math.exp(-((d - front) * (d - front)) / 8);
            if (band < 0.01) continue;
            v += (s.a * band * Math.exp(-age * 0.55)) / (1 + d * 0.015);
          }
          if (v < 0.035) continue;
          var lv = Math.min(L - 1, Math.floor(v * L * 1.05));
          ctx.globalAlpha = Math.min(1, 0.2 + v * 1.15);
          ctx.drawImage(atlas, lv * S, (v > 0.8 ? 1 : 0) * S, S, S, ox + i * size * dpr - S / 2, oy + j * size * dpr - S / 2, S, S);
        }
      }
      ctx.globalAlpha = 1;
    };

    var loop = function (ms) {
      if (!running || document.hidden) { raf = 0; return; }
      raf = requestAnimationFrame(loop);
      if (ms - last < (coarse ? 33 : 24)) return;
      last = ms;
      resize();
      var t = now();
      if (t - lastIdle > 1.9 && t - lastSpawn > 1.2) {
        lastIdle = t;
        swells.push({ x: Math.random() * cols, y: Math.random() * rows, t: t, a: 0.7 });
      }
      frame(t);
    };
    var wake = function () { if (running && !reduced && !raf && !document.hidden) raf = requestAnimationFrame(loop); };

    var at = function (e) {
      var r = host.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) return null;
      return { x: x / size, y: y / size };
    };
    // A new swell each time the pointer reaches a new cell, at most every 140ms.
    var onMove = function (e) {
      var c = at(e);
      if (!c) return;
      var id = Math.floor(c.y) * 10000 + Math.floor(c.x), t = now();
      if (id === lastCell || t - lastSpawn < 0.14) return;
      lastCell = id; lastSpawn = t;
      swells.push({ x: c.x, y: c.y, t: t, a: 0.8 });
      if (swells.length > 14) swells.shift();
    };
    var onDown = function (e) {
      var c = at(e);
      if (c) { swells.push({ x: c.x, y: c.y, t: now(), a: 1.6 }); lastSpawn = now(); }
    };

    return {
      start: function () {
        if (running) return;
        running = true;
        resize();
        if (reduced) {
          // A still frame mid-swell.
          swells = [{ x: cols * 0.35, y: rows * 0.45, t: 0, a: 1.1 }, { x: cols * 0.75, y: rows * 0.3, t: 0.6, a: 0.8 }];
          frame(1.4);
          return;
        }
        frame(now());
        if (!coarse) window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("pointerdown", onDown, { passive: true });
        document.addEventListener("visibilitychange", wake);
        wake();
      },
      stop: function () {
        running = false;
        cancelAnimationFrame(raf);
        raf = 0;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerdown", onDown);
        document.removeEventListener("visibilitychange", wake);
      }
    };
  };
})();
