"""Draw the budget approval flow for the requirements document."""

from pathlib import Path
import math

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "文档/迭代/预算优化/图片/预算状态审批流转图.png"


def draw_budget_state_flow():
    scale = 2
    width, height = 1660, 1870
    canvas = Image.new("RGB", (width * scale, height * scale), "white")
    pen = ImageDraw.Draw(canvas)
    regular = Path("C:/Windows/Fonts/msyh.ttc")
    bold = Path("C:/Windows/Fonts/msyhbd.ttc")
    ink, blue, green, red = "#25384A", "#385E83", "#26734C", "#9F3C46"

    def box(bounds, fill, outline=None, radius=14):
        b = tuple(round(v * scale) for v in bounds)
        pen.rounded_rectangle(b, radius=radius * scale, fill=fill, outline=outline, width=2 * scale)

    def text(x, y, value, size=36, color=ink, weight=False, align="left", max_width=None):
        font = ImageFont.truetype(str(bold if weight else regular), size * scale)
        for row, line in enumerate(value.split("\n")):
            if max_width is not None:
                assert pen.textlength(line, font=font) <= max_width * scale, line
            anchor = "mt" if align == "center" else "lt"
            pen.text((x * scale, (y + row * size * 1.45) * scale), line, font=font, fill=color, anchor=anchor)

    def arrow(points, color=blue, dashed=False, head=True):
        for a, b in zip(points, points[1:]):
            ax, ay, bx, by = a[0] * scale, a[1] * scale, b[0] * scale, b[1] * scale
            if not dashed:
                pen.line((ax, ay, bx, by), fill=color, width=3 * scale)
                continue
            length = math.hypot(bx - ax, by - ay)
            if not length:
                continue
            for start in range(0, int(length), 20 * scale):
                end = min(start + 12 * scale, length)
                pen.line((ax + (bx - ax) * start / length, ay + (by - ay) * start / length,
                          ax + (bx - ax) * end / length, ay + (by - ay) * end / length), fill=color, width=3 * scale)
        if head:
            a, b = points[-2:]
            angle = math.atan2(b[1] - a[1], b[0] - a[0])
            back = 14
            tip = (b[0] * scale, b[1] * scale)
            sides = [((b[0] - back * math.cos(angle) + side * 7 * math.sin(angle)) * scale,
                      (b[1] - back * math.sin(angle) - side * 7 * math.cos(angle)) * scale) for side in (-1, 1)]
            pen.polygon([tip, *sides], fill=color)

    def node(y, title, detail, fill="#FFFFFF", color=blue, height=144):
        box((230, y, 965, y + height), fill, color)
        text(597, y + 18, title, size=42, color=color, weight=True, align="center", max_width=700)
        text(597, y + 81, detail, size=34, color=ink, align="center", max_width=700)

    lanes = [(0, 445, "申请\n提交"), (460, 790, "业务\n审批"),
             (805, 1325, "财务\n审批"), (1340, 1785, "使用\n结果")]
    for top, bottom, label in lanes:
        box((0, top, 1610, bottom), "#F6F8FB", radius=10)
        box((0, top, 165, bottom), "#E8EEF5", radius=10)
        label_y = (top + bottom) / 2 - 58
        text(82, label_y, label, size=40, color=blue, weight=True, align="center")

    # Connectors are drawn before nodes so every arrow terminates at a border.
    arrow([(597, 164), (597, 270)])
    text(625, 192, "正式提交校验通过", size=33)
    arrow([(597, 414), (597, 500)])
    arrow([(597, 644), (597, 850)])
    text(625, 677, "业务审批通过", size=34, weight=True)
    text(625, 729, "进入财务审批", size=33)
    arrow([(597, 994), (597, 1135)])
    text(625, 1036, "财务审批通过", size=34, weight=True)
    arrow([(597, 1279), (597, 1400)])
    text(625, 1312, "其余12类：支付成功", size=33)

    # Rejection and return for edits both release the current freeze.
    arrow([(965, 572), (1035, 572), (1035, 910), (1090, 910)], red)
    arrow([(965, 922), (1010, 922), (1010, 965), (1090, 965)], red)
    text(1110, 550, "业务／财务驳回或退回修改", size=33, color=red, max_width=490)
    text(1110, 604, "或撤回／作废／取消", size=33, color=red, max_width=490)
    text(1110, 658, "成功后执行释放", size=33, color=red, max_width=490)
    text(1110, 712, "修改保存不冻结，重提成功再冻结", size=30, color=red, max_width=490)
    box((1090, 835, 1580, 1030), "#FFF4F4", red)
    text(1335, 859, "已释放", size=42, color=red, weight=True, align="center")
    text(1335, 927, "驳回／退回修改等成功\n全额释放有效冻结", size=34, align="center", max_width=455)
    arrow([(1335, 1030), (1335, 1110)], red)
    box((1090, 1110, 1580, 1270), "#FFFFFF", blue)
    text(1335, 1132, "符合条件时修改后重提", size=34, weight=True, align="center", max_width=455)
    text(1335, 1194, "新版本重新校验并冻结", size=33, align="center", max_width=455)
    arrow([(1580, 1190), (1640, 1190), (1640, 342), (965, 342)], blue, dashed=True)
    text(1125, 279, "重新进入待审批", size=33, color=blue)

    node(20, "草稿", "预算未占用｜保存不冻结")
    node(270, "待审批", "冻结预算｜保存本次提交版本", fill="#EDF3FA")
    node(500, "业务审批中", "节点推进／转审／加签：保持冻结", fill="#EDF3FA")
    node(850, "待财务审批／财务审批中", "业务审批已通过｜预算继续冻结", fill="#EDF3FA")
    node(1135, "财务审批通过／待支付", "其余12类继续冻结，等待支付成功")
    node(1400, "已使用", "整单冻结归零｜已使用增加同额", fill="#EDF6EF", color=green)

    # Confirmed exceptions are named in the diagram and detailed after it.
    text(1105, 1380, "已确认节点", size=35, color=green, weight=True)
    text(1105, 1440, "内部调账单：财务确认\n费用记账单：整条流程通过", size=32, color=green, max_width=490)
    text(1105, 1554, "其余12类：支付成功", size=32, color=green, max_width=490)
    text(230, 1620, "整单转换：全部有效预算金额一次性转为已使用。", size=35, max_width=1350)
    text(230, 1688, "支付失败／结果未知：未满足确认节点时保持冻结。", size=35, max_width=1350)
    text(15, 1810, "适用于设有独立财务审批环节的单据；无此环节时按实际配置的流程执行。", size=33, max_width=1620)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUTPUT, dpi=(306, 306), optimize=True)
    return OUTPUT


if __name__ == "__main__":
    print(draw_budget_state_flow())
