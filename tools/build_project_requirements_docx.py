"""Build the ERP-I005 Word review copy from the maintained Markdown source."""
from pathlib import Path
from copy import deepcopy
import re
from urllib.parse import quote
from zipfile import ZipFile

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from lxml import etree


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "文档/迭代/项目管理优化"
SOURCE = BASE / "详细需求说明.md"
OUTPUT = BASE / "项目管理优化详细需求说明_V1.0.docx"
USER_BASELINE = BASE / "来源资料/用户修订需求基线_2026-11-24.docx"
WIDTH = 6.9


def element(tag, **attributes):
    node = OxmlElement("w:" + tag)
    for key, value in attributes.items():
        node.set(qn("w:" + key), str(value))
    return node


def font(run, size=None, bold=None):
    run.font.name = "Calibri"
    rpr = run._element.get_or_add_rPr()
    fonts = rpr.find(qn("w:rFonts"))
    if fonts is None:
        fonts = element("rFonts")
        rpr.insert(0, fonts)
    for key, name in [("ascii", "Calibri"), ("hAnsi", "Calibri"), ("eastAsia", "Microsoft YaHei")]:
        fonts.set(qn("w:" + key), name)
    run.font.color.rgb = RGBColor(0, 0, 0)
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold


def hyperlink(paragraph, label, target=None, anchor=None):
    link = element("hyperlink")
    if anchor:
        link.set(qn("w:anchor"), anchor)
    else:
        rid = paragraph.part.relate_to(quote(target, safe=":/#%?=&"), RT.HYPERLINK, is_external=True)
        link.set(qn("r:id"), rid)
    run = element("r")
    run.append(element("rPr"))
    run[0].append(element("rFonts", ascii="Calibri", hAnsi="Calibri", eastAsia="Microsoft YaHei"))
    run[0].append(element("color", val="1F4E79"))
    run[0].append(element("u", val="single"))
    text = element("t")
    text.text = label
    run.append(text)
    link.append(run)
    paragraph._p.append(link)


TOKEN = re.compile(r"(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))")


def inline(paragraph, text, size=None, bold=False):
    for token in TOKEN.split(text):
        if not token:
            continue
        match = re.fullmatch(r"\[([^\]]+)\]\(([^)]+)\)", token)
        if match:
            hyperlink(paragraph, match[1], target=match[2])
            continue
        strong = token.startswith("**") and token.endswith("**")
        code = token.startswith("`") and token.endswith("`")
        value = token[2:-2] if strong else token[1:-1] if code else token
        run = paragraph.add_run(value)
        font(run, size=size, bold=bold or strong)


def bookmark(paragraph, name, number):
    paragraph._p.insert(0, element("bookmarkStart", id=number, name=name))
    paragraph._p.append(element("bookmarkEnd", id=number))


def setup(doc):
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Inches(8.5), Inches(11)
    sec.left_margin = sec.right_margin = Inches(.8)
    sec.top_margin, sec.bottom_margin = Inches(.75), Inches(.7)
    sec.header_distance = sec.footer_distance = Inches(.3)
    for name, size in [("Normal", 11), ("Title", 24), ("Heading 1", 16), ("Heading 2", 13), ("Heading 3", 11.5)]:
        style = doc.styles[name]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.color.rgb = RGBColor(0, 0, 0)
        style._element.get_or_add_rPr().append(element("rFonts", ascii="Calibri", hAnsi="Calibri", eastAsia="Microsoft YaHei"))
        pf = style.paragraph_format
        pf.line_spacing = 1.18
        pf.space_after = Pt(6)
        if name.startswith("Heading"):
            style.font.bold = True
            pf.space_before, pf.space_after = Pt(13), Pt(6)
            pf.keep_with_next = True
        pf.widow_control = True
    header = sec.header.paragraphs[0]
    inline(header, "ERP-I005  项目管理优化  研发与测试评审稿 V1.0", size=8)
    footer = sec.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    inline(footer, "第 ", size=9)
    field = element("fldSimple", instr="PAGE")
    field.append(element("r"))
    field[0].append(element("t"))
    field[0][0].text = "1"
    footer._p.append(field)
    inline(footer, " 页", size=9)
    doc.settings.element.append(element("updateFields", val="true"))


def table(doc, rows):
    cols = len(rows[0])
    if rows[0][0].startswith("编号／级别"):
        # The decision register contains extended prose; readable records retain
        # every cell without forcing paragraphs into narrow columns.
        inline(doc.add_paragraph(), "评审事项按编号／级别分列如下")
        for row in rows[1:]:
            p = doc.add_paragraph(style="Heading 3")
            inline(p, row[0])
            for label, value in zip(rows[0][1:], row[1:]):
                p = doc.add_paragraph()
                inline(p, label + "：", bold=True)
                inline(p, value)
        return
    if cols == 5:
        weights = [.55, 1.4, 1.1, 1.65, 2.2]
    elif cols == 4:
        weights = [.65, 1.45, 2.45, 2.35] if rows[0][0] in ("序号", "当月序号") else [1.2, 1.8, 2.0, 1.9]
    elif cols == 2:
        weights = [1.65, 5.25]
    elif cols == 3 and rows[0][0] == "序号及字段":
        weights = [1.6, 3.35, 1.95]
    elif cols == 3:
        weights = [.55, 2.8, 3.55] if rows[0][0] == "编号" else [1.4, 2.4, 3.1]
    else:
        weights = [1] * cols
    widths = [WIDTH * w / sum(weights) for w in weights]
    tab = doc.add_table(rows=1, cols=cols)
    tab.autofit = False
    tab.alignment = WD_TABLE_ALIGNMENT.CENTER
    for col, width in zip(tab.columns, widths):
        col.width = Inches(width)
    for ri, values in enumerate(rows):
        row = tab.rows[0] if ri == 0 else tab.add_row()
        if ri == 0:
            row._tr.get_or_add_trPr().append(element("tblHeader", val="true"))
        # Allow long records to span a page rather than leave large gaps.
        for ci, value in enumerate(values):
            cell = row.cells[ci]
            cell.width = Inches(widths[ci])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            pr = cell._tc.get_or_add_tcPr()
            borders = element("tcBorders")
            for side in ("top", "left", "bottom", "right"):
                borders.append(element(side, val="single", sz="4", color="D9D9D9"))
            pr.append(borders)
            margins = element("tcMar")
            for side, val in [("top", 85), ("bottom", 85), ("start", 95), ("end", 95)]:
                margins.append(element(side, w=val, type="dxa"))
            pr.append(margins)
            if ri == 0:
                pr.append(element("shd", fill="DFE8F1", val="clear"))
            p = cell.paragraphs[0]
            p.paragraph_format.line_spacing = 1.12
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.keep_with_next = False
            if ci == 0 and len(value) < 16:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            inline(p, value, size=10, bold=ri == 0)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.line_spacing = Pt(3)


def build_from_user_baseline():
    """Replace only chapters 5 and 6; keep the user's other XML parts intact."""
    source = SOURCE.read_text(encoding="utf-8")
    module_text = re.search(r"^## 5\. 项目分析\n.*", source, re.M | re.S)
    if module_text is None or "## 6. 项目人效分析" not in module_text.group(0):
        raise ValueError("项目分析及人效分析章节缺失")
    generated = Document(USER_BASELINE)
    for child in list(generated.element.body):
        if child.tag != qn("w:sectPr"):
            generated.element.body.remove(child)
    lines = module_text.group(0).splitlines()
    idx = 0
    while idx < len(lines):
        line = lines[idx].strip()
        if not line:
            idx += 1
            continue
        if line.startswith("|"):
            rows = []
            while idx < len(lines) and lines[idx].startswith("|"):
                cells = [v.strip() for v in re.split(r"(?<!\\)\|", lines[idx])[1:-1]]
                if not all(re.fullmatch(r":?-+:?", v) for v in cells):
                    rows.append(cells)
                idx += 1
            table(generated, rows)
            continue
        match = re.match(r"^(#{2,4})\s+(.+)$", line)
        paragraph = generated.add_paragraph(
            style="Heading " + str(len(match[1]) - 1) if match else "Normal"
        )
        inline(paragraph, match[2] if match else line)
        idx += 1
    nodes = [deepcopy(child) for child in generated.element.body if child.tag != qn("w:sectPr")]
    with ZipFile(USER_BASELINE) as original:
        xml = etree.fromstring(original.read("word/document.xml"))
        body = xml.find(qn("w:body"))
        children = list(body)
        namespaces = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        start = next(i for i, child in enumerate(children)
                     if "".join(child.xpath(".//w:t/text()", namespaces=namespaces)) == "5. 项目分析")
        end = next((i for i in range(start + 1, len(children))
                    if children[i].tag == qn("w:sectPr")), len(children))
        for child in children[start:end]:
            body.remove(child)
        for offset, child in enumerate(nodes):
            body.insert(start + offset, child)
        replacement = etree.tostring(xml, xml_declaration=True, encoding="UTF-8", standalone=True)
        with ZipFile(OUTPUT, "w") as result:
            for entry in original.infolist():
                result.writestr(entry, replacement if entry.filename == "word/document.xml" else original.read(entry.filename))
    print(OUTPUT)


def build():
    if USER_BASELINE.exists():
        build_from_user_baseline()
        return
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    doc = Document()
    setup(doc)
    inline(doc.add_paragraph(style="Title"), lines[0].lstrip("# "))
    idx = 1
    while idx < len(lines) and (not lines[idx].strip() or lines[idx].startswith(">")):
        if lines[idx].startswith(">"):
            inline(doc.add_paragraph(), lines[idx].lstrip("> ").strip())
        idx += 1
    doc.add_page_break()
    inline(doc.add_paragraph(style="Heading 1"), "目录")
    headings = [(i, line[3:]) for i, line in enumerate(lines) if re.match(r"^## \d+\.", line)]
    for number, (line_index, text) in enumerate(headings, 1):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        hyperlink(p, text, anchor="chapter_" + str(number))
    doc.add_page_break()
    heading_map = {line: number for number, (line, text) in enumerate(headings, 1)}
    while idx < len(lines):
        line = lines[idx].rstrip()
        if not line:
            idx += 1
            continue
        if line.startswith("```"):
            code = []
            idx += 1
            while idx < len(lines) and not lines[idx].startswith("```"):
                code.append(lines[idx])
                idx += 1
            for code_line in code:
                p = doc.add_paragraph()
                p.paragraph_format.left_indent = Inches(.15)
                p.paragraph_format.space_after = Pt(2)
                inline(p, code_line, size=10)
            idx += 1
            continue
        if line.startswith("|"):
            rows = []
            while idx < len(lines) and lines[idx].startswith("|"):
                cells = [v.strip() for v in re.split(r"(?<!\\)\|", lines[idx])[1:-1]]
                if not all(re.fullmatch(r":?-+:?", v) for v in cells):
                    rows.append(cells)
                idx += 1
            table(doc, rows)
            continue
        match = re.match(r"^(#{2,4})\s+(.+)$", line)
        if match:
            level = len(match[1]) - 1
            p = doc.add_paragraph(style="Heading " + str(level))
            inline(p, match[2])
            if idx in heading_map:
                bookmark(p, "chapter_" + str(heading_map[idx]), heading_map[idx])
        elif line.startswith("- "):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(.16)
            p.paragraph_format.first_line_indent = Inches(-.16)
            inline(p, "• " + line[2:])
        else:
            p = doc.add_paragraph()
            if re.match(r"^\d+\.\s", line):
                p.paragraph_format.left_indent = Inches(.24)
                p.paragraph_format.first_line_indent = Inches(-.24)
            inline(p, line)
        idx += 1
    doc.core_properties.title = "项目管理优化详细需求说明"
    doc.core_properties.subject = "ERP-I005 开发与测试评审稿 V1.0"
    doc.core_properties.author = "ERP 项目组"
    doc.core_properties.keywords = "项目管理,项目核算,人效分析,需求,测试,快照,权限"
    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()
