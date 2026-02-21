"""
PDF report generator using ReportLab.

Design: terminal aesthetic — black background, white/grey text, monospace font.
Each report is identified by a UUID printed prominently at the top.
"""
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT


# ─── Colours ──────────────────────────────────────────────────────────────────
BLACK      = colors.HexColor("#0a0a0a")
SURFACE    = colors.HexColor("#111111")
BORDER     = colors.HexColor("#2a2a2a")
TEXT       = colors.HexColor("#e0e0e0")
MUTED      = colors.HexColor("#888888")
WHITE      = colors.HexColor("#ffffff")
GREEN      = colors.HexColor("#22c55e")
BLUE       = colors.HexColor("#3b82f6")
RED        = colors.HexColor("#ef4444")

PAGE_W, PAGE_H = A4


# ─── Styles ───────────────────────────────────────────────────────────────────

def _make_styles():
    base = {
        "fontName": "Courier",
        "backColor": BLACK,
        "textColor": TEXT,
    }
    return {
        "h1": ParagraphStyle("h1", fontSize=18, fontName="Courier-Bold",
                              textColor=WHITE, spaceAfter=2),
        "h2": ParagraphStyle("h2", fontSize=11, fontName="Courier-Bold",
                              textColor=WHITE, spaceAfter=2),
        "label": ParagraphStyle("label", fontSize=8, fontName="Courier",
                                textColor=MUTED, spaceAfter=1),
        "value": ParagraphStyle("value", fontSize=13, fontName="Courier-Bold",
                                textColor=WHITE, spaceAfter=6),
        "body": ParagraphStyle("body", fontSize=8, fontName="Courier",
                               textColor=TEXT, spaceAfter=2, leading=12),
        "muted": ParagraphStyle("muted", fontSize=7, fontName="Courier",
                                textColor=MUTED, spaceAfter=2, leading=10),
        "uuid": ParagraphStyle("uuid", fontSize=9, fontName="Courier",
                               textColor=MUTED, alignment=TA_RIGHT),
        "center": ParagraphStyle("center", fontSize=8, fontName="Courier",
                                 textColor=MUTED, alignment=TA_CENTER),
    }


def _hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=8, spaceBefore=4)


def _section_header(text: str, styles: dict):
    return [
        Paragraph(f"// {text}", styles["h2"]),
        _hr(),
    ]


# ─── Probability bar ──────────────────────────────────────────────────────────

def _probability_bar(pct: float) -> str:
    """Returns an ASCII progress bar string, e.g. '████████████░░░░░░  73%'"""
    filled = round(pct / 5)   # 20 blocks total
    empty  = 20 - filled
    bar = "█" * filled + "░" * empty
    return f"{bar}  {pct:.0f}%"


# ─── Format helpers ───────────────────────────────────────────────────────────

def _fmt(value: float, symbol: str) -> str:
    return f"{symbol}{value:,.0f}"


# ─── Main generator ───────────────────────────────────────────────────────────

def generate_pdf(report_uuid: str, data: dict) -> bytes:
    """
    Generate a PDF report and return raw bytes.

    `data` dict must contain all fields from ComputeResponse plus goal_name.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    S = _make_styles()
    sym = data["currency_symbol"]
    story = []

    # ── Header ────────────────────────────────────────────────────────────────
    story.append(Paragraph("GOALBUILDER", S["h1"]))
    story.append(Paragraph("Investment Goal Simulation Report", S["label"]))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(f"UUID: {report_uuid}", S["uuid"]))
    story.append(Paragraph(
        f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        S["uuid"]
    ))
    story.append(_hr())
    story.append(Spacer(1, 2 * mm))

    # ── Goal summary ──────────────────────────────────────────────────────────
    story += _section_header("GOAL SUMMARY", S)

    goal_table_data = [
        ["Goal", data["goal_name"]],
        ["Target value (today's money)", _fmt(data["goal_value"], sym)],
        ["Inflation-adjusted target",    _fmt(data["inflation_adjusted_goal_value"], sym)],
        ["Time horizon",                 f"{data['time_horizon_years']} years ({data['time_horizon_months']} months)"],
        ["Country / Market",             data["country"]],
        ["Risk profile",                 data["risk_profile"].capitalize()],
        ["Inflation rate assumed",        f"{data['inflation_rate'] * 100:.1f}% per year"],
        ["Blended annual return assumed", f"{data['blended_annual_return'] * 100:.1f}% per year"],
    ]

    goal_table = Table(goal_table_data, colWidths=[80 * mm, 90 * mm])
    goal_table.setStyle(TableStyle([
        ("FONTNAME",    (0, 0), (-1, -1), "Courier"),
        ("FONTSIZE",    (0, 0), (-1, -1), 8),
        ("TEXTCOLOR",   (0, 0), (0, -1), MUTED),
        ("TEXTCOLOR",   (1, 0), (1, -1), TEXT),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [BLACK, SURFACE]),
        ("GRID",        (0, 0), (-1, -1), 0.3, BORDER),
        ("TOPPADDING",  (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(goal_table)
    story.append(Spacer(1, 6 * mm))

    # ── Core results ──────────────────────────────────────────────────────────
    story += _section_header("SIMULATION RESULTS  (1,000 runs)", S)

    results_data = [
        ["REQUIRED MONTHLY SAVINGS",   _fmt(data["required_monthly_savings"], sym)],
        ["Monthly surplus after saving", _fmt(data["surplus_after_savings"], sym)],
        ["Probability of success",       _probability_bar(data["probability_of_success"])],
    ]

    results_table = Table(results_data, colWidths=[80 * mm, 90 * mm])
    results_table.setStyle(TableStyle([
        ("FONTNAME",      (0, 0), (-1, -1), "Courier"),
        ("FONTSIZE",      (0, 0), (0, -1), 8),
        ("FONTSIZE",      (1, 0), (1, 0), 14),        # Big number for monthly savings
        ("FONTSIZE",      (1, 1), (1, -1), 9),
        ("FONTNAME",      (1, 0), (1, 0), "Courier-Bold"),
        ("TEXTCOLOR",     (0, 0), (0, -1), MUTED),
        ("TEXTCOLOR",     (1, 0), (1, 0), GREEN),
        ("TEXTCOLOR",     (1, 1), (1, 1), TEXT),
        ("TEXTCOLOR",     (1, 2), (1, 2), BLUE),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [BLACK, SURFACE, BLACK]),
        ("GRID",          (0, 0), (-1, -1), 0.3, BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
    ]))
    story.append(results_table)
    story.append(Spacer(1, 6 * mm))

    # ── Percentile outcomes table ─────────────────────────────────────────────
    story += _section_header("PROJECTED PORTFOLIO AT GOAL DATE", S)
    story.append(Paragraph(
        "Three scenarios from 1,000 Monte Carlo simulations:", S["muted"]
    ))
    story.append(Spacer(1, 2 * mm))

    pct_data = [
        ["SCENARIO",   "PORTFOLIO VALUE", "vs TARGET"],
        [
            "Pessimistic (10th percentile)",
            _fmt(data["final_p10"], sym),
            f"{(data['final_p10'] / data['inflation_adjusted_goal_value'] - 1) * 100:+.1f}%",
        ],
        [
            "Median (50th percentile)",
            _fmt(data["final_p50"], sym),
            f"{(data['final_p50'] / data['inflation_adjusted_goal_value'] - 1) * 100:+.1f}%",
        ],
        [
            "Optimistic (90th percentile)",
            _fmt(data["final_p90"], sym),
            f"{(data['final_p90'] / data['inflation_adjusted_goal_value'] - 1) * 100:+.1f}%",
        ],
    ]

    pct_table = Table(pct_data, colWidths=[90 * mm, 50 * mm, 30 * mm])
    pct_table.setStyle(TableStyle([
        ("FONTNAME",    (0, 0), (-1, -1), "Courier"),
        ("FONTSIZE",    (0, 0), (-1, -1), 8),
        ("FONTNAME",    (0, 0), (-1, 0), "Courier-Bold"),
        ("TEXTCOLOR",   (0, 0), (-1, 0), MUTED),       # Header row
        ("TEXTCOLOR",   (1, 1), (1, 1), RED),            # Pessimistic value
        ("TEXTCOLOR",   (1, 2), (1, 2), BLUE),           # Median value
        ("TEXTCOLOR",   (1, 3), (1, 3), GREEN),          # Optimistic value
        ("TEXTCOLOR",   (0, 1), (0, -1), TEXT),
        ("TEXTCOLOR",   (2, 0), (2, -1), MUTED),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [SURFACE, BLACK, SURFACE, BLACK]),
        ("GRID",        (0, 0), (-1, -1), 0.3, BORDER),
        ("TOPPADDING",  (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(pct_table)
    story.append(Spacer(1, 8 * mm))

    # ── Disclaimer ────────────────────────────────────────────────────────────
    story += _section_header("DISCLAIMER", S)
    story.append(Paragraph(
        "This report is for educational and illustrative purposes only. It does not "
        "constitute investment advice, financial advice, or a recommendation to buy or "
        "sell any securities. Projected returns are based on historical averages and "
        "are not guaranteed. Past performance is not indicative of future results. "
        "Always consult a qualified financial adviser before making investment decisions.",
        S["muted"]
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        "GoalBuilder is open-source software. github.com/goalbuilder",
        S["center"]
    ))

    # Build PDF
    doc.build(story, onFirstPage=_draw_background, onLaterPages=_draw_background)
    return buffer.getvalue()


def _draw_background(canvas, doc):
    """Fill every page with a black background."""
    canvas.saveState()
    canvas.setFillColor(BLACK)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=True, stroke=False)
    canvas.restoreState()
