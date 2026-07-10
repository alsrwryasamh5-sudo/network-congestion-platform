"""
Report Generator Service
========================
 Generates professional PDF reports using ReportLab.
"""
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, ListFlowable, ListItem,
)
from reportlab.pdfgen import canvas

from app.utils.logger import logger


# --- Color palette (cyber theme) ---
COLOR_PRIMARY = colors.HexColor("#0EA5E9")  # cyan
COLOR_ACCENT = colors.HexColor("#8B5CF6")   # purple
COLOR_DANGER = colors.HexColor("#EF4444")
COLOR_SUCCESS = colors.HexColor("#10B981")
COLOR_WARNING = colors.HexColor("#F59E0B")
COLOR_BG = colors.HexColor("#0F172A")
COLOR_TEXT = colors.HexColor("#1E293B")
COLOR_MUTED = colors.HexColor("#64748B")
COLOR_LIGHT = colors.HexColor("#F1F5F9")


def _header_footer(canvas_obj: canvas.Canvas, doc):
    """Draw header & footer on each page."""
    canvas_obj.saveState()
    width, height = A4
    canvas_obj.setFillColor(COLOR_BG)
    canvas_obj.rect(0, height - 1.5 * cm, width, 1.5 * cm, fill=1, stroke=0)
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFont("Helvetica-Bold", 11)
    canvas_obj.drawString(2 * cm, height - 1 * cm, "Network Congestion Detection Platform")
    canvas_obj.setFont("Helvetica", 9)
    canvas_obj.drawRightString(width - 2 * cm, height - 1 * cm, datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"))
    canvas_obj.setFillColor(COLOR_BG)
    canvas_obj.rect(0, 0, width, 1 * cm, fill=1, stroke=0)
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.drawString(2 * cm, 0.35 * cm, "Confidential - Network Security Report")
    canvas_obj.drawRightString(width - 2 * cm, 0.35 * cm, f"Page {doc.page}")
    canvas_obj.restoreState()


def _build_styles() -> Dict[str, ParagraphStyle]:
    styles = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("CustomTitle", parent=styles["Title"], fontSize=24, textColor=COLOR_BG, spaceAfter=12, alignment=TA_CENTER),
        "subtitle": ParagraphStyle("CustomSubtitle", parent=styles["Normal"], fontSize=12, textColor=COLOR_MUTED, alignment=TA_CENTER, spaceAfter=24),
        "h1": ParagraphStyle("H1", parent=styles["Heading1"], fontSize=18, textColor=COLOR_PRIMARY, spaceBefore=18, spaceAfter=10),
        "h2": ParagraphStyle("H2", parent=styles["Heading2"], fontSize=14, textColor=COLOR_ACCENT, spaceBefore=12, spaceAfter=6),
        "body": ParagraphStyle("Body", parent=styles["Normal"], fontSize=10.5, textColor=COLOR_TEXT, leading=15, alignment=TA_JUSTIFY, spaceAfter=6),
        "small": ParagraphStyle("Small", parent=styles["Normal"], fontSize=8.5, textColor=COLOR_MUTED),
    }


def _metric_table(metrics: Dict[str, Any]) -> Table:
    """Build a metric grid using plain strings (more robust than Paragraphs in cells)."""
    keys = ["accuracy", "f1", "auc", "precision", "recall", "true_negatives", "false_positives", "false_negatives"]
    labels = ["Accuracy", "F1-Score", "ROC-AUC", "Precision", "Recall", "True Neg.", "False Pos.", "False Neg."]
    data = [["Metric", "Value", "Metric", "Value"]]
    for i in range(0, len(keys), 2):
        row = [labels[i], _fmt(metrics.get(keys[i]))]
        if i + 1 < len(keys):
            row += [labels[i + 1], _fmt(metrics.get(keys[i + 1]))]
        else:
            row += ["", ""]
        data.append(row)
    tbl = Table(data, colWidths=[3.5 * cm, 3 * cm, 3.5 * cm, 3 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BG),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, COLOR_MUTED),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_LIGHT]),
    ]))
    return tbl


def _fmt(v: Any) -> str:
    if v is None or v == "":
        return "—"
    if isinstance(v, float):
        return f"{v:.4f}"
    return str(v)


def _confusion_matrix_table(matrix: List[List[int]]) -> Table:
    """Render a 2x2 confusion matrix."""
    data = [
        ["", "Predicted Normal", "Predicted Congested", "Total"],
        ["Actual Normal", str(matrix[0][0]), str(matrix[0][1]), str(matrix[0][0] + matrix[0][1])],
        ["Actual Congested", str(matrix[1][0]), str(matrix[1][1]), str(matrix[1][0] + matrix[1][1])],
        ["Total", str(matrix[0][0] + matrix[1][0]), str(matrix[0][1] + matrix[1][1]), str(sum(sum(r) for r in matrix))],
    ]
    tbl = Table(data, colWidths=[4 * cm, 4 * cm, 4 * cm, 3 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BACKGROUND", (0, 1), (0, -1), COLOR_BG),
        ("TEXTCOLOR", (0, 1), (0, -1), colors.white),
        ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
        ("BACKGROUND", (1, 1), (1, 1), COLOR_SUCCESS),
        ("TEXTCOLOR", (1, 1), (1, 1), colors.white),
        ("BACKGROUND", (2, 2), (2, 2), COLOR_SUCCESS),
        ("TEXTCOLOR", (2, 2), (2, 2), colors.white),
        ("BACKGROUND", (2, 1), (2, 1), COLOR_DANGER),
        ("TEXTCOLOR", (2, 1), (2, 1), colors.white),
        ("BACKGROUND", (1, 2), (1, 2), COLOR_WARNING),
        ("TEXTCOLOR", (1, 2), (1, 2), colors.white),
        ("ALIGN", (1, 1), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BG),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, COLOR_MUTED),
    ]))
    return tbl


def _rca_table(rca: Dict[str, Any]) -> Table:
    """Render RCA breakdown table."""
    data = [
        ["Component", "Score", "Description"],
        ["Volume Contribution", _fmt(rca.get("volume_contribution")), "Outbound traffic surge vs baseline"],
        ["QoS Impact", _fmt(rca.get("qos_impact_score")), "Delay & packet loss degradation"],
        ["AI Support", _fmt(rca.get("ai_support_score")), "Model prediction confidence"],
        ["Spatial Penalty", _fmt(rca.get("spatial_penalty")), "DBSCAN cluster outlier score"],
        ["TOTAL", _fmt(rca.get("total_rca_score")), "Composite culprit score"],
    ]
    tbl = Table(data, colWidths=[5 * cm, 3 * cm, 8 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), COLOR_PRIMARY),
        ("TEXTCOLOR", (0, -1), (-1, -1), colors.white),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BG),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, COLOR_MUTED),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return tbl


def _shap_table(features: List[Dict[str, Any]]) -> Table:
    """Render SHAP top features table."""
    data = [["Rank", "Feature", "SHAP Value", "Contribution %"]]
    for i, f in enumerate(features[:10], 1):
        data.append([
            str(i),
            str(f.get("feature", "")),
            f"{f.get('shap_value', 0):.4f}",
            f"{f.get('contribution_pct', 0):.2f}%",
        ])
    tbl = Table(data, colWidths=[1.5 * cm, 7 * cm, 4 * cm, 4 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (1, 0), (1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BG),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, COLOR_MUTED),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_LIGHT]),
    ]))
    return tbl


def generate_pdf_report(
    output_path: str,
    title: str,
    metrics: Dict[str, Any],
    root_cause: Optional[Dict] = None,
    shap_top_features: Optional[List[Dict]] = None,
    recommendations: Optional[List[str]] = None,
    chart_images: Optional[Dict[str, str]] = None,
) -> str:
    """Build a professional PDF report."""
    styles = _build_styles()
    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2.2 * cm, bottomMargin=1.5 * cm,
    )

    elements: List = []

    # --- Cover ---
    elements.append(Spacer(1, 4 * cm))
    elements.append(Paragraph(title, styles["title"]))
    elements.append(Paragraph(
        "AI-Powered Network Congestion Detection & Root Cause Analysis",
        styles["subtitle"],
    ))
    elements.append(Spacer(1, 1 * cm))

    # Cover meta table
    meta_data = [
        ["Generated At", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")],
        ["Model Version", str(metrics.get("model_version", "1.0.0"))],
        ["Dataset", str(metrics.get("dataset", "NF-UNSW-NB15-v3"))],
        ["Total Samples", str(metrics.get("n_rows", "—"))],
        ["Report Type", str(metrics.get("report_type", "Executive"))],
    ]
    meta_tbl = Table(meta_data, colWidths=[5 * cm, 10 * cm])
    meta_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), COLOR_BG),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.white),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BG),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, COLOR_MUTED),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(meta_tbl)
    elements.append(PageBreak())

    # --- Executive Summary ---
    elements.append(Paragraph("1. Executive Summary", styles["h1"]))
    elements.append(Paragraph(
        "This report presents a comprehensive analysis of network congestion detection "
        "using a hybrid Stacking machine learning model. The system combines Decision Tree "
        "and XGBoost base learners with a Logistic Regression meta-learner to identify "
        "congested network flows with high precision. The analysis leverages the NF-UNSW-NB15 "
        "dataset, containing over 2.3 million NetFlow v3 records, and applies a QoS-aware "
        "congestion scoring methodology derived from delay, jitter, packet loss, and throughput "
        "deviations from a statistical baseline.",
        styles["body"],
    ))
    elements.append(Spacer(1, 0.5 * cm))

    elements.append(Paragraph("Key Performance Indicators", styles["h2"]))
    elements.append(_metric_table(metrics))
    elements.append(Spacer(1, 0.5 * cm))

    # --- Model Performance ---
    elements.append(Paragraph("2. Model Performance", styles["h1"]))
    elements.append(Paragraph(
        "The proposed Stacking classifier achieves superior performance compared to individual "
        "base learners. The Decision Tree baseline provides interpretable but limited accuracy, "
        "while XGBoost captures non-linear patterns. The Stacking ensemble combines their "
        "strengths through cross-validated probability stacking, resulting in the highest "
        "F1-Score and ROC-AUC among all evaluated models.",
        styles["body"],
    ))

    # Confusion matrix
    conf_matrix = metrics.get("confusion_matrix", [[0, 0], [0, 0]])
    if conf_matrix and len(conf_matrix) == 2:
        elements.append(Paragraph("Confusion Matrix", styles["h2"]))
        elements.append(_confusion_matrix_table(conf_matrix))
        elements.append(Spacer(1, 0.5 * cm))

    # ROC curve image
    if chart_images and "roc_curve" in chart_images and os.path.exists(chart_images["roc_curve"]):
        elements.append(Paragraph("ROC Curve", styles["h2"]))
        elements.append(Image(chart_images["roc_curve"], width=15 * cm, height=10 * cm))
        elements.append(Spacer(1, 0.3 * cm))

    # --- Root Cause Analysis ---
    if root_cause:
        elements.append(Paragraph("3. Root Cause Analysis", styles["h1"]))
        rca_text = (
            f"The root cause analysis identified host <b>{root_cause.get('host_responsible', 'unknown')}</b> "
            f"as the primary source of network congestion with a culprit score of "
            f"<b>{float(root_cause.get('total_rca_score', 0)):.1f}/100</b>. "
            f"The severity level is classified as <b>{str(root_cause.get('severity', 'unknown')).upper()}</b>. "
            f"Recommended mitigation: {root_cause.get('recommended_mitigation', 'No action required.')}"
        )
        elements.append(Paragraph(rca_text, styles["body"]))
        elements.append(_rca_table(root_cause))
        elements.append(Spacer(1, 0.4 * cm))

    # --- SHAP ---
    if shap_top_features:
        elements.append(Paragraph("4. SHAP Explainability", styles["h1"]))
        elements.append(Paragraph(
            "SHAP (SHapley Additive exPlanations) values reveal the contribution of each feature "
            "to the model's congestion predictions. The top contributing features are dominated "
            "by inter-arrival time statistics, confirming that traffic jitter and burstiness are "
            "the primary signals of network congestion.",
            styles["body"],
        ))
        elements.append(_shap_table(shap_top_features))
        elements.append(Spacer(1, 0.4 * cm))

    # --- Recommendations ---
    if recommendations:
        elements.append(Paragraph("5. Recommendations", styles["h1"]))
        rec_items = [ListItem(Paragraph(r, styles["body"]), value=i) for i, r in enumerate(recommendations, 1)]
        elements.append(ListFlowable(rec_items, bulletType="1", leftIndent=20))

    # --- Footer note ---
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph(
        "This report was generated automatically by the Network Congestion Detection Platform. "
        "All metrics are computed from the model's evaluation on a held-out test set.",
        styles["small"],
    ))

    doc.build(elements, onFirstPage=_header_footer, onLaterPages=_header_footer)
    logger.info(f"PDF report generated: {output_path}")
    return output_path
