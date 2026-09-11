/* ============================================================
   Illinois Interactive — temporary home
   1) Scroll reveals (IntersectionObserver)
   2) Canvas background — two swappable engines, same palette:
        "net"  (default)  pixel nodes, links, drifting sprites
        "fall" (?bg=fall) falling pixel pieces — tetrominoes + fragments
   Pointer-aware, reduced-motion aware.
   ============================================================ */
(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  const GOLD = "255, 200, 87";
  const TEAL = "111, 213, 198";
  const POINTER_R = 160;

  /* ---------- 1) Reveal on scroll ---------- */
  const reveals = document.querySelectorAll("[data-reveal]");
  if (reveals.length) {
    if (reduced || !("IntersectionObserver" in window)) {
      reveals.forEach((el) => el.classList.add("is-revealed"));
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-revealed");
              io.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.12, rootMargin: "0px 0px -36px 0px" }
      );
      reveals.forEach((el) => io.observe(el));
    }
  }

  /* ---------- 2) Canvas background ---------- */
  const canvas = document.getElementById("net");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let w = 0;
  let h = 0;
  let running = false;
  let t = 0;
  const pointer = { x: -1e4, y: -1e4, active: false };

  /* Each engine assigns these */
  let step = null;
  let draw = null;
  let onResize = null;

  const mode =
    new URLSearchParams(location.search).get("bg") === "fall" ? "fall" : "net";

  if (mode === "fall") initFall();
  else initNet();

  /* ==========================================================
     Engine A — constellation: pixel nodes, links, sprites
     ========================================================== */
  function initNet() {
    /* Drifting pixel sprites — the playfield's little denizens */
    const SPRITE_DEFS = [
      {
        // heart
        map: [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."],
        color: GOLD,
        cell: 2,
      },
      {
        // invader
        map: [".#....#.", "..#..#..", ".######.", "##.##.##", "########", "#.####.#", "#.#..#.#", "..#..#.."],
        color: TEAL,
        cell: 2,
      },
      {
        // gem
        map: [".###.", "#####", "#####", ".###.", "..#.."],
        color: GOLD,
        cell: 2,
      },
    ];

    const LINK_DIST = 132;

    let nodes = [];
    let sprites = [];

    function targetCount() {
      // Scale node count with viewport area; keep it light on phones.
      return Math.round(Math.min(90, Math.max(32, (w * h) / 16000)));
    }

    function seed() {
      const target = targetCount();
      nodes = [];
      for (let i = 0; i < target; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          s: Math.random() < 0.35 ? 3 : 2,
          gold: Math.random() < 0.22,
          a: 0.22 + Math.random() * 0.5,
        });
      }
    }

    function seedSprites() {
      sprites = SPRITE_DEFS.map((def) => {
        const sw = def.map[0].length * def.cell;
        const sh = def.map.length * def.cell;
        return {
          def,
          sw,
          sh,
          x: Math.random() * Math.max(w - sw, 1),
          y: Math.random() * Math.max(h - sh, 1),
          vx: (Math.random() - 0.5) * 0.13,
          vy: (Math.random() - 0.5) * 0.13,
          phase: Math.random() * Math.PI * 2,
        };
      });
    }

    step = function () {
      t += 0.012;

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;

        // Wrap around edges
        if (n.x < -24) n.x = w + 24;
        else if (n.x > w + 24) n.x = -24;
        if (n.y < -24) n.y = h + 24;
        else if (n.y > h + 24) n.y = -24;

        // Gentle repulsion from the pointer
        if (pointer.active && finePointer) {
          const dx = n.x - pointer.x;
          const dy = n.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < POINTER_R * POINTER_R && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const force = (1 - d / POINTER_R) * 2.4;
            n.x += (dx / d) * force;
            n.y += (dy / d) * force;
          }
        }
      }

      for (const s of sprites) {
        s.x += s.vx;
        s.y += s.vy;
        const m = 28;
        if (s.x < -m) s.x = w + m;
        else if (s.x > w + m) s.x = -m;
        if (s.y < -m) s.y = h + m;
        else if (s.y > h + m) s.y = -m;

        if (pointer.active && finePointer) {
          const cx = s.x + s.sw / 2;
          const cy = s.y + s.sh / 2;
          const dx = cx - pointer.x;
          const dy = cy - pointer.y;
          const d2 = dx * dx + dy * dy;
          const reach = POINTER_R + Math.max(s.sw, s.sh) / 2;
          if (d2 < reach * reach && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const force = (1 - d / reach) * 1.8;
            s.x += (dx / d) * force;
            s.y += (dy / d) * force;
          }
        }
      }
    };

    draw = function () {
      ctx.clearRect(0, 0, w, h);

      // Links
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK_DIST * LINK_DIST) continue;

          const d = Math.sqrt(d2);
          let alpha = (1 - d / LINK_DIST) * 0.14;

          // Links near the pointer glow a little brighter
          if (pointer.active && finePointer) {
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const pdx = mx - pointer.x;
            const pdy = my - pointer.y;
            const pd = Math.sqrt(pdx * pdx + pdy * pdy);
            if (pd < POINTER_R) {
              alpha += (1 - pd / POINTER_R) * 0.22;
            }
          }

          ctx.strokeStyle =
            a.gold || b.gold
              ? "rgba(" + GOLD + ", " + alpha.toFixed(3) + ")"
              : "rgba(" + TEAL + ", " + alpha.toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Nodes — crisp pixels, not stars
      for (const n of nodes) {
        ctx.fillStyle =
          n.gold
            ? "rgba(" + GOLD + ", " + n.a.toFixed(3) + ")"
            : "rgba(" + TEAL + ", " + n.a.toFixed(3) + ")";
        const off = n.s >> 1;
        ctx.fillRect(Math.round(n.x) - off, Math.round(n.y) - off, n.s, n.s);
      }

      // Sprites — a soft pulse, like a sprite mid-animation
      for (const s of sprites) {
        const alpha = 0.14 + 0.06 * Math.sin(t * 1.4 + s.phase);
        ctx.fillStyle = "rgba(" + s.def.color + ", " + alpha.toFixed(3) + ")";
        const map = s.def.map;
        const cell = s.def.cell;
        const ox = Math.round(s.x);
        const oy = Math.round(s.y);
        for (let r = 0; r < map.length; r++) {
          const row = map[r];
          for (let c = 0; c < row.length; c++) {
            if (row.charAt(c) === "#") {
              ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
            }
          }
        }
      }
    };

    onResize = function () {
      if (nodes.length !== targetCount()) seed();
      if (!sprites.length) seedSprites();
    };
  }

  /* ==========================================================
     Engine B — fall: drifting tetrominoes + pixel fragments
     ========================================================== */
  function initFall() {
    const CELL = 6;
    const GAP = 2;
    const STRIDE = CELL + GAP;

    /* Tetrominoes first (indices 0–6), then loose fragments (7–10).
       Each shape lives in a size×size box; orientations are
       precomputed 90° clockwise steps. */
    const SHAPES = [
      { size: 4, cells: [[0, 0], [1, 0], [2, 0], [3, 0]] }, // I
      { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] }, // O
      { size: 3, cells: [[0, 0], [1, 0], [2, 0], [1, 1]] }, // T
      { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] }, // S
      { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] }, // Z
      { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] }, // J
      { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] }, // L
      { size: 1, cells: [[0, 0]] },                          // dust
      { size: 2, cells: [[0, 0], [1, 0]] },                  // domino
      { size: 2, cells: [[0, 0], [0, 1], [1, 1]] },          // corner
      { size: 2, cells: [[0, 0], [1, 0], [0, 1]] },          // corner'
    ];

    const shapes = SHAPES.map((s) => {
      const orients = [];
      let cells = s.cells.map((c) => [c[0], c[1]]);
      for (let k = 0; k < 4; k++) {
        orients.push(cells.map((c) => [c[0], c[1]]));
        cells = cells.map(([x, y]) => [s.size - 1 - y, x]);
      }
      return { size: s.size, orients };
    });

    let pieces = [];

    function pieceCount() {
      return Math.round(Math.min(15, Math.max(8, (w * h) / 100000)));
    }

    function pickShape() {
      // More loose fragments than full blocks — "some" are tetrominoes.
      if (Math.random() < 0.4) return shapes[(Math.random() * 7) | 0];
      return shapes[7 + ((Math.random() * 4) | 0)];
    }

    function makePiece(anywhere) {
      const shape = pickShape();
      const boxPx = shape.size * STRIDE;
      const big = shape.size >= 3;
      return {
        shape,
        orient: (Math.random() * 4) | 0,
        rotateIn: 240 + Math.random() * 600,
        x: Math.random() * Math.max(w - boxPx, 1),
        y: anywhere ? Math.random() * h : -boxPx - Math.random() * 140,
        vx: (Math.random() - 0.5) * 0.08,
        vy: big ? 0.14 + Math.random() * 0.28 : 0.24 + Math.random() * 0.4,
        gold: Math.random() < 0.25,
        a: 0.2 + Math.random() * 0.5,
      };
    }

    function seed(anywhere) {
      const n = pieceCount();
      pieces = [];
      for (let i = 0; i < n; i++) pieces.push(makePiece(anywhere));
    }

    step = function () {
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;

        const boxPx = p.shape.size * STRIDE;

        // Wrap horizontally
        if (p.x < -boxPx) p.x = w;
        else if (p.x > w) p.x = -boxPx;

        // Fell off the bottom — respawn above
        if (p.y > h + 40) {
          Object.assign(p, makePiece(false));
          continue;
        }

        // Occasional 90° snap rotation — the tetromino tick
        p.rotateIn -= 1;
        if (p.rotateIn <= 0) {
          p.orient = (p.orient + 1) % 4;
          p.rotateIn = 240 + Math.random() * 700;
        }

        // Gentle pointer repulsion — pieces are heavier than pixels
        if (pointer.active && finePointer) {
          const cx = p.x + boxPx / 2;
          const cy = p.y + boxPx / 2;
          const dx = cx - pointer.x;
          const dy = cy - pointer.y;
          const d2 = dx * dx + dy * dy;
          const reach = POINTER_R + boxPx / 2;
          if (d2 < reach * reach && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const force = (1 - d / reach) * 1.3;
            p.x += (dx / d) * force;
            p.y += (dy / d) * force;
          }
        }
      }
    };

    draw = function () {
      ctx.clearRect(0, 0, w, h);
      for (const p of pieces) {
        ctx.fillStyle =
          "rgba(" + (p.gold ? GOLD : TEAL) + ", " + p.a.toFixed(3) + ")";
        const cells = p.shape.orients[p.orient];
        const ox = Math.round(p.x);
        const oy = Math.round(p.y);
        for (const [cx, cy] of cells) {
          ctx.fillRect(
            ox + cx * STRIDE,
            oy + cy * STRIDE,
            CELL,
            CELL
          );
        }
      }
    };

    onResize = function () {
      if (pieces.length !== pieceCount()) seed(true);
    };
  }

  /* ---------- Shared wiring ---------- */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (onResize) onResize();
    if (reduced) draw();
  }

  function loop() {
    if (!running) return;
    step();
    draw();
    requestAnimationFrame(loop);
  }

  function start() {
    if (running || reduced || document.hidden) return;
    running = true;
    requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
  }

  window.addEventListener("resize", resize, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    },
    { passive: true }
  );

  document.addEventListener("mouseleave", () => {
    pointer.active = false;
  });

  window.addEventListener("blur", () => {
    pointer.active = false;
  });

  resize();
  if (reduced) draw();
  else start();
})();
