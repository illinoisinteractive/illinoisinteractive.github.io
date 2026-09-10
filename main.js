/* ============================================================
   Illinois Interactive — temporary home
   1) Scroll reveals (IntersectionObserver)
   2) Gentle node-network canvas, pointer-aware, reduced-motion aware
   ============================================================ */
(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

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

  /* ---------- 2) Node network canvas ---------- */
  const canvas = document.getElementById("net");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const LINK_DIST = 132;
  const POINTER_R = 160;
  const GOLD = "255, 200, 87";
  const TEAL = "111, 213, 198";

  let w = 0;
  let h = 0;
  let nodes = [];
  let running = false;
  const pointer = { x: -1e4, y: -1e4, active: false };

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
        r: 1 + Math.random() * 1.6,
        gold: Math.random() < 0.22,
        a: 0.22 + Math.random() * 0.5,
      });
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (nodes.length !== targetCount()) seed();
    if (reduced) draw();
  }

  function step() {
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;

      // Wrap around edges
      if (n.x < -24) n.x = w + 24;
      else if (n.x > w + 24) n.x = -24;
      if (n.y < -24) n.y = h + 24;
      else if (n.y > h + 24) n.y = -24;

      // Gentle repulsion from the pointer — the "responsive" whisper
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
  }

  function draw() {
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

    // Nodes
    for (const n of nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle =
        n.gold
          ? "rgba(" + GOLD + ", " + n.a.toFixed(3) + ")"
          : "rgba(" + TEAL + ", " + n.a.toFixed(3) + ")";
      ctx.fill();
    }
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

  /* ---------- Wiring ---------- */
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
  if (!reduced) start();
})();
