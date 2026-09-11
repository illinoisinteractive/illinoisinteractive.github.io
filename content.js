/* ============================================================
   Illinois Interactive — temporary home
   1) Rotating hero word: "Illinois builds [word] you can play."
      Cycles every ~35s; the word list comes from the Google Doc
      (## Words section) with a built-in default fallback.
   2) Site content sync: renders content/site-content.json (the
      "Latest" strip + contact email) over the static defaults.
      If the fetch fails, the static HTML simply remains.
   ============================================================ */
(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1) Rotating hero word ---------- */

  const DEFAULT_WORDS = ["stories", "experiences", "ideas", "applications"];
  const SWAP_MS = 35000; // 30–45s territory; tweak to taste
  const FADE_MS = 450;

  const el = document.getElementById("rotator");

  let words = DEFAULT_WORDS.slice();
  let index = 0;
  let timer = null;

  // Size the slot to the widest word so "you can play." never reflows.
  function reserveWidth() {
    if (!el) return;
    const saved = el.textContent;
    let widest = 0;
    for (const word of words) {
      el.textContent = word;
      widest = Math.max(widest, el.offsetWidth);
    }
    el.textContent = saved;
    // Never shrink below the previously reserved width (no reflow when a
    // narrower doc list replaces the defaults).
    widest = Math.max(widest, parseInt(el.style.minWidth, 10) || 0);
    if (widest) el.style.minWidth = widest + "px";
  }

  function swap() {
    if (!el || words.length < 2) return;
    index = (index + 1) % words.length;
    if (reduced) {
      el.textContent = words[index];
    } else {
      el.classList.add("is-fading");
      setTimeout(() => {
        el.textContent = words[index];
        el.classList.remove("is-fading");
      }, FADE_MS);
    }
  }

  function startRotation() {
    if (!el) return;
    if (timer) clearInterval(timer);
    reserveWidth();
    if (words.length < 2) return;
    timer = setInterval(swap, SWAP_MS);
  }

  startRotation();
  if ("fonts" in document) {
    // The first reservation measured against the fallback font; re-measure
    // once the webfont has actually landed so the reserved width is true.
    document.fonts.ready.then(reserveWidth);
  }
  window.addEventListener(
    "resize",
    () => {
      if (!reduced) reserveWidth();
    },
    { passive: true }
  );

  /* ---------- 2) Google Doc content sync ---------- */

  const strip = document.getElementById("announcement-body");
  const stripSection = document.getElementById("latest");
  const mail = document.querySelector(".mail");

  fetch("content/site-content.json", { cache: "no-cache" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data || !data.sections) return;

      // Announcement strip
      if (strip && stripSection && data.sections.announcement) {
        // textContent — the browser escapes it; no markup can leak in
        strip.textContent = data.sections.announcement;
        stripSection.hidden = false;
      }

      // Contact email (first mailto found in the doc, if any)
      const email = data.mailtos && data.mailtos[0];
      if (email && mail) {
        mail.setAttribute("href", "mailto:" + email);
        const textNode = mail.firstChild;
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          textNode.textContent = email;
        }
      }

      // Rotating word list (## Words — one word per line)
      if (data.sections.words) {
        const parsed = data.sections.words
          .split("\n")
          .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
          .filter(Boolean)
          .slice(0, 12);
        if (parsed.length > 0 && parsed.join("|") !== words.join("|")) {
          words = parsed;
          index = 0;
          if (el) el.textContent = words[0];
          startRotation();
        }
      }
    })
    .catch(() => {
      /* offline or file:// — the static content stays, default words cycle */
    });
})();
