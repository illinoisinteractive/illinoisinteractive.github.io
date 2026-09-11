#!/usr/bin/env python3
"""Sync a shared Google Doc into content/site-content.json.

The Doc is the leadership's content editor; this script is the bridge.

Conventions (keep the Doc simple):
  * Share the Doc as "Anyone with the link" (viewer).
  * Introduce each section with a Heading 2: "Announcement", "Contact", ...
  * Anything between headings is freeform text — newlines, lists, links.

Safety:
  * Content is flattened to plain text (no HTML is ever emitted), so the
    page cannot be injected with markup.
  * If the export parses to zero sections (e.g. the share setting was
    revoked and Google returns a sign-in page), the last good JSON is
    left untouched.

Usage:
  python3 convert_doc.py                 # fetch from Google, write JSON
  python3 convert_doc.py --from-file X   # parse a saved export (for tests)

DOC_ID accepts the bare ID or the whole address-bar URL. It must be the
Doc's EDIT url (docs.google.com/document/d/<ID>/edit). The "/pub" viewer
link that some Google menus offer does NOT work with the export endpoint
and is rejected with a helpful message.
"""
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

# What to paste in here: the Doc's address-bar URL (or just the ID),
# i.e. the EDIT url — not the "/pub" viewer link:
#   https://docs.google.com/document/d/ADFN-cskk.../edit?usp=sharing
DOC_ID = "REPLACE_WITH_DOC_ID"

OUT = Path(__file__).resolve().parents[2] / "content" / "site-content.json"
EXPORT_URL = "https://docs.google.com/document/d/{}/export?format=html"

VOID = {
    "area", "base", "br", "col", "embed", "hr",
    "img", "input", "link", "meta", "param", "source", "track", "wbr",
}
BLOCKS = {"p", "div", "h3", "h4", "h5", "li", "tr", "table"}
HARD_SKIP = {"script", "style", "iframe", "noscript", "template"}
SAFE_LINK = re.compile(r"^(https?:|mailto:)", re.I)


def resolve_id(spec):
    """Accept a bare doc ID or a full URL; return just the ID.

    Handles both ID shapes: the canonical one (ADFN-...) and Google's
    "e/2PACX-..." viewer IDs (which contain a slash, so we can't split
    naively on "/").
    """
    spec = spec.strip()
    m = re.search(r"/document/d/(.+?)(?:\?|$)", spec)
    if m:
        token = m.group(1)
        token = re.sub(r"/(?:edit|pub|view|preview|mobilebasic|export).*$", "", token)
        return token
    return spec


class Collector(HTMLParser):
    """Collects {section_key: plain_text} plus any mailto: addresses."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.sections = {}
        self.mails = []
        self._key = None       # active section key
        self._lines = []       # finished lines for the active section
        self._line = ""        # in-progress line
        self._h2 = None        # None, or text fragments while inside <h2>
        self._skip = 0         # depth inside a tag whose markup we drop
        self._hard = False     # True inside script/style/etc — drop text too

    # -- text ------------------------------------------------------------
    def _flush_line(self):
        line = re.sub(r"\s+", " ", self._line).strip()
        if line:
            self._lines.append(line)
        self._line = ""

    def _finish_section(self):
        self._flush_line()
        if self._key is not None and self._lines:
            self.sections[self._key] = "\n".join(self._lines)
        self._key = None
        self._lines = []
        self._line = ""

    def handle_data(self, data):
        if self._hard:
            return
        text = re.sub(r"\s+", " ", data).strip()
        if not text:
            return
        if self._h2 is not None:
            self._h2.append(text)
            return
        if self._key is None:
            return
        if not self._line:
            self._line = text
        elif text[0] in ",;:!?":
            self._line = self._line.rstrip() + text
        elif self._line.endswith(" "):
            self._line = self._line + text
        else:
            self._line = self._line + " " + text

    # -- tags ------------------------------------------------------------
    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            if tag == "br" and self._key is not None and not self._skip:
                self._flush_line()
            return
        if self._skip:
            self._skip += 1
            return
        if tag in HARD_SKIP:
            self._skip = 1
            self._hard = True
            return
        if tag == "h2":
            if self._key is not None:
                self._finish_section()
            self._h2 = []
            return
        if self._key is None:
            return
        if tag in BLOCKS:
            self._flush_line()
            if tag == "li":
                self._line = "• "
        elif tag == "a":
            href = dict(attrs).get("href", "")
            if href.lower().startswith("mailto:"):
                self.mails.append(href[7:].strip())
            if not SAFE_LINK.match(href):
                self._skip = 1  # keep the text, drop the link

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if self._skip:
            self._skip -= 1
            if self._skip == 0:
                self._hard = False
            return
        if tag == "h2":
            if self._h2 is None:
                return
            key = re.sub(r"[^a-z0-9]+", "-", " ".join(self._h2).lower()).strip("-")
            self._h2 = None
            if self._key is not None:
                self._finish_section()
            if key:
                self._key = key
            return
        if self._key is None:
            return
        if tag in BLOCKS:
            self._flush_line()

    def close(self):
        super().close()
        if self._key is not None:
            self._finish_section()


def main():
    if "--from-file" in sys.argv:
        path = Path(sys.argv[sys.argv.index("--from-file") + 1])
        doc_html = path.read_text(encoding="utf-8")
        doc_id = "local-test"
    else:
        doc_id = resolve_id(DOC_ID)
        if doc_id == "REPLACE_WITH_DOC_ID":
            print("Not configured: set DOC_ID in convert_doc.py. Nothing to do.")
            return 0
        if doc_id.startswith("e/"):
            print("DOC_ID is a /pub viewer link. Google's export endpoint "
                  "only knows the doc's EDIT id — open the Doc, copy the "
                  "address-bar URL (docs.google.com/document/d/<ID>/edit), "
                  "and paste it into DOC_ID. Last content kept.")
            return 0
        req = urllib.request.Request(
            EXPORT_URL.format(doc_id),
            headers={"User-Agent": "Mozilla/5.0 (Illinois Interactive content sync)"},
        )
        try:
            doc_html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
        except urllib.error.HTTPError as err:
            print(f"Google returned HTTP {err.code} for the doc export. Last content "
                  "kept — check the URL and the share setting.")
            return 0
        except urllib.error.URLError as err:
            print(f"Network error while fetching the doc: {err.reason}. Last content kept.")
            return 0

    # Google answers missing/unshared docs with a small error page, not a 404.
    if "errorMessage" in doc_html or "does not exist" in doc_html:
        print("Google reports this document does not exist or is no longer "
              "shared. Last content kept — check the URL and the share setting.")
        return 0

    collector = Collector()
    collector.feed(doc_html)
    collector.close()

    # A sign-in page or revoked share parses to no sections — keep last good.
    if not collector.sections:
        print("WARNING: no sections parsed. Is the doc still shared "
              "'Anyone with the link'? Last content kept.")
        return 0

    out = {
        "source": "google-doc",
        "doc_id": doc_id,
        "fetched": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sections": collector.sections,
        "mailtos": list(dict.fromkeys(collector.mails)),
    }
    new = json.dumps(out, ensure_ascii=False, indent=2) + "\n"
    if OUT.exists() and OUT.read_text(encoding="utf-8") == new:
        print("Content unchanged — nothing to write.")
        return 0
    OUT.write_text(new, encoding="utf-8")
    print(f"Wrote {OUT} — sections: {', '.join(out['sections'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
