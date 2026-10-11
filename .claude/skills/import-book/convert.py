#!/usr/bin/env python3
"""Convert a book (epub/pdf/txt/md) into chapter markdown files. Detects omnibus editions.

usage: convert.py <book-file> <out-dir> [--pattern REGEX] [--books auto|off]

Single book:  <out-dir>/C01.md, C02.md … plus _full.md
Omnibus:      <out-dir>/B1/C01.md …, <out-dir>/B2/… plus books.tsv (id, title, chapters, words)
              Book boundaries are where chapter numbering restarts at one. Titles come from a
              master contents list if one matches the number of books, else "Book N".
Front matter before a book's first chapter (copyright, contents, dedications) is kept in
_front.md (per book), never as a chapter. Prints an index to stdout.
"""
import argparse, html, re, subprocess, sys, zipfile
from html.parser import HTMLParser
from pathlib import Path

# A heading is a short line that IS a chapter marker, not a sentence that starts with one.
NUM_WORDS = ("one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen "
             "seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred").split()
DEFAULT_PATTERN = (r"^\s*(?:#{1,3}\s+\S.{0,60}"
                   r"|(?:chapter|kapitel|kapittel|chapitre|capítulo|capitolo|luku|hoofdstuk|rozdział)\s+[\w\-–]+\.?(?:\s*[:.\-–]\s*.{0,50})?"
                   r"|(?:prologue|epilogue|prolog|epilog|prólogo|epílogo|interlude|afterword)\b.{0,50})\s*$")
WORD_VALUE = {w: i + 1 for i, w in enumerate(NUM_WORDS[:19])}
WORD_VALUE.update({"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90})
ROMAN = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100}


def chapter_number(heading):
    """'CHAPTER ONE' → 1, 'Chapter 12' → 12, 'Kapitel XIV' → 14, 'CHAPTER TWENTY-THREE' → 23. None if unknown."""
    m = re.search(r"\b(?:chapter|kapitel|kapittel|chapitre|capítulo|capitolo|luku|hoofdstuk|rozdział)\s+([\w\-–]+)", heading, re.I)
    if not m:
        return None
    tok = m.group(1).lower().strip(".")
    if tok.isdigit():
        return int(tok)
    if re.fullmatch(r"[ivxlc]+", tok):
        total, prev = 0, 0
        for ch in reversed(tok):
            v = ROMAN[ch]
            total, prev = (total - v, prev) if v < prev else (total + v, v)
        return total
    parts = re.split(r"[-–\s]+", tok)
    if all(p in WORD_VALUE for p in parts):
        return sum(WORD_VALUE[p] for p in parts)
    return None


class _Text(HTMLParser):
    BLOCK = {"p", "div", "br", "li", "tr", "blockquote", "section"}
    def __init__(self):
        super().__init__(); self.out = []; self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"): self.skip += 1
        elif re.fullmatch(r"h[1-3]", tag): self.out.append("\n\n# ")
        elif tag in self.BLOCK: self.out.append("\n\n")
        elif tag in ("i", "em"): self.out.append("*")
    def handle_endtag(self, tag):
        if tag in ("script", "style"): self.skip -= 1
        elif re.fullmatch(r"h[1-3]", tag): self.out.append("\n\n")
        elif tag in ("i", "em"): self.out.append("*")
    def handle_data(self, d):
        if not self.skip: self.out.append(d)


def epub_text(p):
    z = zipfile.ZipFile(p)
    container = z.read("META-INF/container.xml").decode()
    opf_path = re.search(r'full-path="([^"]+)"', container).group(1)
    opf = z.read(opf_path).decode("utf-8", "ignore")
    base = str(Path(opf_path).parent)
    items = dict(re.findall(r'<item[^>]*?id="([^"]+)"[^>]*?href="([^"]+)"', opf))
    items.update({i: h for h, i in re.findall(r'<item[^>]*?href="([^"]+)"[^>]*?id="([^"]+)"', opf)})
    parts = []
    for idref in re.findall(r'<itemref[^>]*idref="([^"]+)"', opf):
        href = items.get(idref)
        if not href: continue
        name = f"{base}/{href}" if base not in ("", ".") else href
        t = _Text(); t.feed(z.read(html.unescape(name)).decode("utf-8", "ignore"))
        parts.append("".join(t.out))
    return "\n\n".join(parts)


def read_txt(p):
    """Old Swedish .txt files are often cp1252/latin-1, not UTF-8."""
    b = p.read_bytes()
    try:
        return b.decode("utf-8-sig")
    except UnicodeDecodeError:
        return b.decode("cp1252", errors="replace")


def docx_text(p):
    """Paragraphs of a .docx (word/document.xml), headings as markdown, table rows as "a | b". Stdlib only."""
    xml = zipfile.ZipFile(p).read("word/document.xml").decode("utf-8", "ignore")
    xml = re.sub(r"<w:(?:br|cr)\b[^>]*/>", "<w:t>\n</w:t>", xml).replace("<w:tab/>", "<w:t>\t</w:t>")
    xml = re.sub(r"</w:tc>\s*<w:tc>", "<w:p><w:r><w:t> | </w:t></w:r></w:p>", xml)  # cells of a row on one line
    out = []
    for para in re.findall(r"<w:p[ >].*?</w:p>|<w:tr[ >].*?</w:tr>", xml, re.S):
        style = re.search(r'<w:pStyle w:val="([^"]+)"', para)
        text = "".join(html.unescape(t) for t in re.findall(r"<w:t(?: [^>]*)?>(.*?)</w:t>", para, re.S))
        lvl = re.match(r"(?:Heading|Rubrik)(\d)", style.group(1)) if style else None
        out.append(("#" * int(lvl.group(1)) + " " + text) if lvl and text.strip() else text)
    return "\n\n".join(out)


def pdf_text(p):
    return subprocess.run(["pdftotext", "-layout", str(p), "-"], capture_output=True, text=True, check=True).stdout


def clean(text):
    text = text.replace("\f", "\n")
    lines = [l.rstrip() for l in text.splitlines()]
    lines = [l for l in lines if not re.fullmatch(r"\s*\d{1,4}\.?\s*", l)]  # bare page numbers
    text = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def split_chapters(lines, rx):
    """→ (front_lines, [ {heading, title, num, lines} ])"""
    starts = [i for i, l in enumerate(lines) if l.strip() and len(l.strip()) <= 80 and rx.match(l)]
    front = lines[: starts[0]] if starts else lines
    chapters = []
    for s, e in zip(starts, starts[1:] + [len(lines)]):
        body = lines[s:e]
        heading = body[0].strip().lstrip("# ").strip()
        title = ""
        for l in body[1:4]:  # chapter title is usually the next short line
            if l.strip():
                if len(l.strip()) <= 70 and not l.strip().endswith((".", ",", ";")):
                    title = l.strip()
                break
        chapters.append({"heading": heading, "title": title, "num": chapter_number(heading), "lines": body})
    return front, chapters


def words(ch):
    return sum(len(l.split()) for l in ch["lines"])


def group_books(chapters):
    """Start a new book whenever chapter numbering restarts at 1 (after a higher number).
    Short unnumbered pieces just before a restart (a contents entry like "EPILOGUE", an epigraph)
    belong to the next book's front matter, not to the previous book. → (books, extra_front_per_book)"""
    books, cur, last, extra = [], [], 0, {}
    for ch in chapters:
        if ch["num"] == 1 and last >= 2 and cur:
            tail = []
            while len(cur) > 1 and cur[-1]["num"] is None and words(cur[-1]) < 400:
                tail.insert(0, cur.pop())
            books.append(cur); cur = []
            if tail:
                extra[len(books)] = [l for t in tail for l in t["lines"]]
        cur.append(ch)
        if ch["num"]:
            last = ch["num"]
    if cur:
        books.append(cur)
    return books, extra


def master_titles(front_lines, n):
    """Find n consecutive short title-like lines in the opening contents (e.g. the series' book list)."""
    cand = [l.strip() for l in front_lines[:400] if l.strip()]
    for i in range(len(cand) - n + 1):
        run = cand[i : i + n]
        if all(4 <= len(t) <= 80 and not re.search(r"[.;]$|©|isbn|rights|contents", t, re.I) for t in run) and len({t.split()[0] for t in run}) <= max(2, n // 2):
            return run
    return None


def write_book(out, chapters, front):
    out.mkdir(parents=True, exist_ok=True)
    if front and any(l.strip() for l in front):
        (out / "_front.md").write_text("\n".join(front).strip() + "\n", encoding="utf-8")
    rows = []
    for n, ch in enumerate(chapters, 1):
        body = "\n".join(ch["lines"]).strip()
        (out / f"C{n:02d}.md").write_text(body + "\n", encoding="utf-8")
        label = ch["heading"] + (f" — {ch['title']}" if ch["title"] else "")
        rows.append((f"C{n:02d}", len(body.split()), label[:80]))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("book"); ap.add_argument("out")
    ap.add_argument("--pattern", default=DEFAULT_PATTERN)
    ap.add_argument("--books", choices=["auto", "off"], default="auto")
    ap.add_argument("--whole", action="store_true", help="no chapter split: write the cleaned text to <out>/_full.md only (archive files)")
    a = ap.parse_args()
    src, out = Path(a.book), Path(a.out)
    ext = src.suffix.lower()
    text = (epub_text(src) if ext == ".epub" else pdf_text(src) if ext == ".pdf" else docx_text(src) if ext == ".docx"
            else src.read_bytes().decode("utf-8", errors="ignore") if ext != ".txt" else read_txt(src))
    text = clean(text)
    out.mkdir(parents=True, exist_ok=True)
    (out / "_full.md").write_text(text, encoding="utf-8")
    if a.whole:
        print(f"{len(text.split()):,} words -> {out / '_full.md'}", file=sys.stderr)
        return

    lines = text.splitlines()
    front, chapters = split_chapters(lines, re.compile(a.pattern, re.I))
    if not chapters:
        print("No chapter headings found. Try --pattern with this book's heading style.", file=sys.stderr)
        sys.exit(2)
    books, extra = group_books(chapters) if a.books == "auto" else ([chapters], {})

    if len(books) == 1:
        rows = write_book(out, books[0], front)
        for cid, words, label in rows:
            print(f"{cid}\t{words:>6} words\t{label}")
        print(f"{len(rows)} chapters, {sum(r[1] for r in rows):,} words -> {out}", file=sys.stderr)
        return

    titles = master_titles(front, len(books)) or [f"Book {i + 1}" for i in range(len(books))]
    # The next book's front matter (title page, copyright, contents) trails the previous book's last
    # chapter: cut it off there and keep it as that next book's _front.md.
    fronts = [front] + [None] * (len(books) - 1)
    marker = re.compile(r"^\s*(contents|table of contents|innehåll|inhalt|sommaire)\s*$|©|all rights reserved|isbn", re.I)
    for i in range(len(books) - 1):
        last = books[i][-1]["lines"]
        cut = next((k for k, l in enumerate(last) if k > 5 and marker.search(l)), None)
        if cut is not None:
            back = cut
            while back > 1 and last[back - 1].strip() and len(last[back - 1].strip()) < 70:
                back -= 1  # include the title lines just above the copyright/contents block
            fronts[i + 1] = last[back:]
            books[i][-1]["lines"] = last[:back]
    for i, lines in extra.items():
        fronts[i] = (fronts[i] or []) + lines
    tsv = ["id\ttitle\tchapters\twords"]
    for i, chs in enumerate(books):
        bid = f"B{i + 1}"
        rows = write_book(out / bid, chs, fronts[i])
        words = sum(r[1] for r in rows)
        tsv.append(f"{bid}\t{titles[i]}\t{len(rows)}\t{words}")
        print(f"{bid}\t{titles[i]}\t{len(rows)} chapters\t{words:,} words\t(first: {rows[0][2]} · last: {rows[-1][2]})")
    (out / "books.tsv").write_text("\n".join(tsv) + "\n", encoding="utf-8")
    print(f"omnibus: {len(books)} books, {sum(len(b) for b in books)} chapters -> {out} (see books.tsv)", file=sys.stderr)


if __name__ == "__main__":
    main()
