/* ============================================================
   Illinois Interactive — temporary home
   Site content sync: renders content/site-content.json (populated
   from the founders' Google Doc) over the static defaults.
   If the fetch fails, the static HTML simply remains.
   ============================================================ */
(() => {
  "use strict";

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
    })
    .catch(() => {
      /* offline or file:// — the static content stays */
    });
})();
