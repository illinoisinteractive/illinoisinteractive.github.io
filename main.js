/* ============================================================
   Illinois Interactive — temporary home
   1) Scroll reveals (IntersectionObserver)
   2) Canvas background — two swappable engines, same palette:
        "net"  (default)  pixel nodes, links, drifting sprites
        "fall" (?bg=fall) falling pixel pieces — tetrominoes, fragments,
                        power-ups, rocks & a steering ship; size-varied for depth
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
     Engine B — fall: tumbling pieces, power-ups, rocks,
     and one little player-ship that steers instead of falling
     ========================================================== */
  function initFall() {
    /* Rotatable blocks: tetrominoes (indices 0–6), loose fragments (7–10).
       Each lives in a size×size box; orientations precomputed in 90° steps. */
    const BLOCKS = [
      { size: 4, cells: [[0, 0], [1, 0], [2, 0], [3, 0]] }, // I
      { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] }, // O
      { size: 3, cells: [[0, 0], [1, 0], [2, 0], [1, 1]] }, // T
      { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] }, // S
      { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] }, // Z
      { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] }, // J
      { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] }, // L
      { size: 1, cells: [[0, 0]] },                        // dust
      { size: 2, cells: [[0, 0], [1, 0]] },                // domino
      { size: 2, cells: [[0, 0], [0, 1], [1, 1]] },        // corner
      { size: 2, cells: [[0, 0], [1, 0], [0, 1]] },        // corner'
    ];

    const blocks = BLOCKS.map((s) => {
      const orients = [];
      let cells = s.cells.map((c) => [c[0], c[1]]);
      for (let k = 0; k < 4; k++) {
        orients.push(cells.map((c) => [c[0], c[1]]));
        cells = cells.map(([x, y]) => [s.size - 1 - y, x]);
      }
      return { size: s.size, orients };
    });

    /* Recognizable 8-bit power-ups — monochrome silhouettes of generic
       forms (toadstool, sparkle, heart, ghost, gem). They nod to the
       platformer genre without copying protected character artwork:
       no faces, no trademark colors, no spots. */
    const POWERUPS = [
      {
        // mushroom
        map: ["..####..", ".######.", "########", "########", "..####..", "..####.."],
      },
      {
        // sparkle / star
        map: ["...#...", "..###..", ".#####.", "#######", ".#####.", "..###..", "...#..."],
      },
      {
        // heart
        map: [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."],
      },
      {
        // ghost
        map: [".######.", "########", "########", "########", "########", "##.##.##"],
      },
      {
        // gem
        map: [".###.", "#####", "#####", ".###.", "..#.."],
      },
    ];

    /* Tumbling rocks — a rock is a rock; zero risk, maximum mood. */
    const ROCKS = [
      { map: ["..###..", ".#####.", "#######", "#######", ".#####.", "..###.."] },
      { map: [".#####..", "#######.", "########", ".######.", "..####.."] },
    ];

    /* The little player-ship: a notched triangle — a generic geometric
       form, 1979-flavored but abstract. It doesn't fall: it steers,
       wraps at every edge, and dodges your cursor. */
    const SHIP = {
      map: [
        "....#....",
        "...###...",
        "..#####..",
        ".#######.",
        "#.#####.#",
        ".#.###.#.",
        ".........",
        ".........",
        ".........",
      ],
    };

    /* Precompute 90° orientations for string maps (padded to a square
       in both dimensions). */
    function mapOrients(map) {
      const size = Math.max(map.length, ...map.map((r) => r.length));
      const rows = [];
      for (let y = 0; y < size; y++) rows.push((map[y] || "").padEnd(size, "."));
      let cur = rows;
      const orients = [];
      for (let k = 0; k < 4; k++) {
        orients.push(cur);
        cur = cur.map((row, y) => cur.map((col, x) => cur[size - 1 - x][y]).join(""));
      }
      return orients;
    }

    const powerups = POWERUPS.map((d) => {
      const m = d.map.map((r) => r.padEnd(d.map[0].length, "."));
      return { map: m, orients: [m, m, m, m] }; // stay upright (readable)
    });
    const rocks = ROCKS.map((d) => ({ map: d.map, orients: mapOrients(d.map) }));
    const shipDef = { map: SHIP.map, orients: mapOrients(SHIP.map) };

    const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // ship headings

    const SCALES = [0.6, 0.85, 1, 1.3, 1.6];

    let pool = [];
    let ship = null;

    function poolCount() {
      return Math.round(Math.min(15, Math.max(8, (w * h) / 100000)));
    }

    function makePiece(anywhere) {
      // ~30% tetrominoes, ~35% fragments, ~15% rocks, ~20% power-ups.
      const roll = Math.random();
      const shape =
        roll < 0.3
          ? { kind: "block", rotates: true, def: blocks[(Math.random() * 7) | 0] }
          : roll < 0.65
          ? { kind: "block", rotates: true, def: blocks[7 + ((Math.random() * 4) | 0)] }
          : roll < 0.8
          ? { kind: "map", rotates: true, def: rocks[(Math.random() * rocks.length) | 0] }
          : { kind: "map", rotates: false, def: powerups[(Math.random() * powerups.length) | 0] };

      // Size doubles as a depth cue: small & faint = far, big & bright = near.
      const scale = SCALES[(Math.random() * SCALES.length) | 0];
      const cell = Math.max(2, Math.round(6 * scale));
      const gap = cell >= 7 ? 2 : 1;
      const stride = cell + gap;

      const cols = shape.kind === "map" ? shape.def.map[0].length : shape.def.size;
      const rows = shape.kind === "map" ? shape.def.map.length : shape.def.size;
      const pw = cols * stride;
      const ph = rows * stride;

      return {
        shape,
        orient: (Math.random() * 4) | 0,
        rotateIn: 240 + Math.random() * 600,
        cell,
        gap,
        pw,
        ph,
        x: Math.random() * Math.max(w - pw, 1),
        y: anywhere ? Math.random() * h : -ph - Math.random() * 140,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (0.12 + Math.random() * 0.25) * (0.5 + scale),
        gold: Math.random() < 0.25,
        a: Math.min(0.75, (0.16 + Math.random() * 0.5) * (0.5 + 0.5 * scale)),
      };
    }

    /* The one denizen that doesn't fall: gold, mid-size, always aboard. */
    function makeShip() {
      const cell = 5;
      const gap = 1;
      const box = shipDef.map[0].length * (cell + gap);
      const s = {
        shape: { kind: "map", rotates: true, def: shipDef },
        orient: (Math.random() * 4) | 0,
        rotateIn: 100 + Math.random() * 200,
        cell,
        gap,
        pw: box,
        ph: box,
        x: Math.random() * Math.max(w - box, 1),
        y: Math.random() * Math.max(h - box, 1),
        vx: 0,
        vy: 0,
        gold: true,
        a: 0.5,
        ship: true,
      };
      const speed = 0.3;
      s.vx = DIRS[s.orient][0] * speed;
      s.vy = DIRS[s.orient][1] * speed;
      return s;
    }

    function seed(anywhere) {
      const n = poolCount();
      pool = [];
      for (let i = 0; i < n; i++) pool.push(makePiece(anywhere));
      if (!ship) ship = makeShip();
    }

    function repel(p) {
      if (!pointer.active || !finePointer) return;
      const cx = p.x + p.pw / 2;
      const cy = p.y + p.ph / 2;
      const dx = cx - pointer.x;
      const dy = cy - pointer.y;
      const d2 = dx * dx + dy * dy;
      const reach = POINTER_R + Math.max(p.pw, p.ph) / 2;
      if (d2 < reach * reach && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const force = (1 - d / reach) * 1.3;
        p.x += (dx / d) * force;
        p.y += (dy / d) * force;
      }
    }

    /* The ship re-aims periodically; near the cursor, it dodges. */
    function steerShip(p) {
      if (pointer.active && finePointer) {
        const dx = p.x + p.pw / 2 - pointer.x;
        const dy = p.y + p.ph / 2 - pointer.y;
        const ranked = [0, 1, 2, 3].sort(
          (a, b) =>
            DIRS[b][0] * dx + DIRS[b][1] * dy - (DIRS[a][0] * dx + DIRS[a][1] * dy)
        );
        p.orient = Math.random() < 0.6 ? ranked[0] : (Math.random() * 4) | 0;
      } else if (Math.random() < 0.5) {
        p.orient = (p.orient + 1) % 4; // slow orbit
      }
      const speed = 0.25 + Math.random() * 0.3;
      p.vx = DIRS[p.orient][0] * speed;
      p.vy = DIRS[p.orient][1] * speed;
    }

    step = function () {
      for (const p of pool) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap horizontally
        if (p.x < -p.pw) p.x = w;
        else if (p.x > w) p.x = -p.pw;

        // Fell off the bottom — respawn above
        if (p.y > h + 40) {
          Object.assign(p, makePiece(false));
          continue;
        }

        // Tetrominoes & rocks tumble; power-ups stay upright (readable)
        if (p.shape.rotates) {
          p.rotateIn -= 1;
          if (p.rotateIn <= 0) {
            p.orient = (p.orient + 1) % 4;
            p.rotateIn = 240 + Math.random() * 700;
          }
        }

        repel(p);
      }

      // The ship: the one thing in the field that doesn't fall
      if (ship) {
        ship.x += ship.vx;
        ship.y += ship.vy;
        if (ship.x < -ship.pw) ship.x = w;
        else if (ship.x > w) ship.x = -ship.pw;
        if (ship.y < -ship.ph) ship.y = h;
        else if (ship.y > h) ship.y = -ship.ph;
        ship.rotateIn -= 1;
        if (ship.rotateIn <= 0) {
          steerShip(ship);
          ship.rotateIn = 120 + Math.random() * 240;
        }
        repel(ship);
      }
    };

    function drawPiece(p) {
      ctx.fillStyle =
        "rgba(" + (p.gold ? GOLD : TEAL) + ", " + p.a.toFixed(3) + ")";
      const ox = Math.round(p.x);
      const oy = Math.round(p.y);
      const stride = p.cell + p.gap;
      if (p.shape.kind === "block") {
        for (const [cx, cy] of p.shape.def.orients[p.orient]) {
          ctx.fillRect(ox + cx * stride, oy + cy * stride, p.cell, p.cell);
        }
      } else {
        const map = p.shape.def.orients[p.orient];
        for (let r = 0; r < map.length; r++) {
          const row = map[r];
          for (let c = 0; c < row.length; c++) {
            if (row.charAt(c) === "#") {
              ctx.fillRect(ox + c * stride, oy + r * stride, p.cell, p.cell);
            }
          }
        }
      }
    }

    draw = function () {
      ctx.clearRect(0, 0, w, h);
      for (const p of pool) drawPiece(p);
      if (ship) drawPiece(ship); // the player-ship draws on top
    };

    onResize = function () {
      if (pool.length !== poolCount()) seed(true);
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
