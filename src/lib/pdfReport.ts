import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ProjectInfo {
  projectName: string;
  projectNumber: string;
  engineerName: string;
  clientName: string;
  location: string;
  date: string;
  notes: string;
}

export interface GroundingResultForPdf {
  singleRodResistance: number;
  mutualResistance: number;
  totalResistance: number;
  efficiencyFactor: number;
  minimumRodsRequired: number;
  idealSpacing: number;
  status: "PASS" | "FAIL" | "WARNING";
  standardLimit: number;
  standardName: string;
  rodCurve: Array<{ rods: number; resistance: number; efficiencyFactor: number }>;
  recommendations: Array<{ type: string; message: string }>;
  soilCategory: string;
  formulaDetails: {
    dwightFormula: string;
    mutualFormula: string;
    parallelFormula: string;
    variables: Record<string, string>;
  };
}

export interface InputParams {
  soilResistivity: number;
  rodLength: number;
  rodDiameter: number;
  numberOfRods: number;
  rodSpacing: number;
  installationCategory: string;
  targetResistance?: number | null;
}

const ORANGE = [234, 88, 12] as const;
const DARK = [15, 23, 42] as const;
const GRAY = [100, 116, 139] as const;
const WHITE = [255, 255, 255] as const;
const LIGHT_BG = [248, 250, 252] as const;
const BORDER = [226, 232, 240] as const;
const GREEN = [34, 197, 94] as const;
const AMBER = [245, 158, 11] as const;
const RED = [239, 68, 68] as const;
const BLUE = [59, 130, 246] as const;

function setFont(doc: jsPDF, bold = false, size = 10) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
}

function drawHeaderBar(doc: jsPDF, pageWidth: number) {
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageWidth, 22, "F");
  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, 6, 22, "F");
  setFont(doc, true, 14);
  doc.setTextColor(...WHITE);
  doc.text("GROUNDCALC_", 14, 14);
  setFont(doc, false, 9);
  doc.setTextColor(180, 180, 180);
  doc.text("Grounding Resistance Engineering Calculator", 82, 14);
}

function drawSection(doc: jsPDF, title: string, y: number, pageWidth: number): number {
  doc.setFillColor(...ORANGE);
  doc.rect(14, y, 4, 6, "F");
  setFont(doc, true, 9);
  doc.setTextColor(...DARK);
  doc.text(title, 22, y + 4.5);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(14, y + 8, pageWidth - 14, y + 8);
  return y + 12;
}

function statusColor(status: string): readonly [number, number, number] {
  if (status === "PASS") return GREEN;
  if (status === "WARNING") return AMBER;
  return RED;
}

function recTypeColor(type: string): readonly [number, number, number] {
  if (type === "critical") return RED;
  if (type === "warning") return AMBER;
  if (type === "success") return GREEN;
  return BLUE;
}

function recTypeLabel(type: string): string {
  if (type === "critical") return "CRITICAL";
  if (type === "warning") return "WARNING";
  if (type === "success") return "OK";
  return "INFO";
}

function drawFooter(doc: jsPDF, pageNum: number, totalPages: number, pageWidth: number, pageHeight: number) {
  doc.setFillColor(...DARK);
  doc.rect(0, pageHeight - 14, pageWidth, 14, "F");
  setFont(doc, false, 8);
  doc.setTextColor(180, 180, 180);
  doc.text("GROUNDCALC Engineering Calculator  |  IEEE Std 142 / Dwight Formula", 14, pageHeight - 5);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 14, pageHeight - 5, { align: "right" });
}

export async function generatePdfReport(
  projectInfo: ProjectInfo,
  inputs: InputParams,
  result: GroundingResultForPdf
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  drawHeaderBar(doc, pageWidth);
  y = 32;

  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, "F");
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, "S");
  setFont(doc, true, 16);
  doc.setTextColor(...DARK);
  doc.text("GROUNDING RESISTANCE", margin + 8, y + 9);
  setFont(doc, true, 16);
  doc.setTextColor(...ORANGE);
  doc.text("CALCULATION REPORT", margin + 8, y + 17);
  const [sr, sg, sb] = statusColor(result.status);
  doc.setFillColor(sr, sg, sb);
  doc.roundedRect(pageWidth - margin - 34, y + 6, 30, 12, 2, 2, "F");
  setFont(doc, true, 11);
  doc.setTextColor(...WHITE);
  doc.text(result.status, pageWidth - margin - 19, y + 14, { align: "center" });
  y += 34;

  y = drawSection(doc, "PROJECT INFORMATION", y, pageWidth);
  const projRows = [
    ["Project Name", projectInfo.projectName || "—"],
    ["Project No.", projectInfo.projectNumber || "—"],
    ["Engineer", projectInfo.engineerName || "—"],
    ["Client / Owner", projectInfo.clientName || "—"],
    ["Location / Site", projectInfo.location || "—"],
    ["Calculation Date", projectInfo.date || new Date().toLocaleDateString("id-ID")],
  ];
  autoTable(doc, {
    startY: y, head: [["FIELD", "VALUE"]], body: projRows,
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 3.5 },
    headStyles: { fillColor: [...DARK] as [number, number, number], textColor: WHITE as unknown as [number, number, number], fontSize: 8, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold", textColor: GRAY as unknown as [number, number, number], fillColor: LIGHT_BG as unknown as [number, number, number] },
      1: { cellWidth: contentWidth - 42 },
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    tableLineColor: BORDER as unknown as [number, number, number], tableLineWidth: 0.3,
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (projectInfo.notes) {
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, "F");
    setFont(doc, true, 8); doc.setTextColor(...GRAY);
    doc.text("NOTES:", margin + 4, y + 5);
    setFont(doc, false, 8); doc.setTextColor(...DARK);
    const noteLines = doc.splitTextToSize(projectInfo.notes, contentWidth - 24);
    doc.text(noteLines, margin + 24, y + 5);
    y += 18;
  }

  y = drawSection(doc, "INPUT PARAMETERS", y, pageWidth);
  const catLabels: Record<string, string> = {
    substation: "Substation (IEEE Std 80)", lightning_protection: "Lightning Protection (NFPA 780)",
    general: "General / NEC", telecom: "Telecommunications",
  };
  const inputRows = [
    ["Soil Resistivity (ρ)", `${inputs.soilResistivity} Ω·m`, "Measured or estimated"],
    ["Soil Classification", result.soilCategory, "Based on ρ value"],
    ["Rod Length (L)", `${inputs.rodLength} m`, "Per rod depth"],
    ["Rod Diameter (d)", `${inputs.rodDiameter} m (${(inputs.rodDiameter * 1000).toFixed(1)} mm)`, "Physical rod diameter"],
    ["Number of Rods (n)", `${inputs.numberOfRods}`, "Total electrodes"],
    ["Rod Spacing (s)", `${inputs.rodSpacing} m`, `Ideal ≥ ${result.idealSpacing} m (2×L)`],
    ["Installation Standard", catLabels[inputs.installationCategory] || inputs.installationCategory, "Applied standard"],
    ["Target Resistance", inputs.targetResistance != null ? `${inputs.targetResistance} Ω` : `${result.standardLimit} Ω (standard limit)`, "Design target"],
  ];
  autoTable(doc, {
    startY: y, head: [["PARAMETER", "VALUE", "REMARK"]], body: inputRows,
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 3.5 },
    headStyles: { fillColor: [...DARK] as [number, number, number], textColor: WHITE as unknown as [number, number, number], fontSize: 8, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 56, fontStyle: "bold", textColor: GRAY as unknown as [number, number, number], fillColor: LIGHT_BG as unknown as [number, number, number] },
      1: { cellWidth: 60 }, 2: { cellWidth: contentWidth - 116, textColor: GRAY as unknown as [number, number, number], fontStyle: "italic" },
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    tableLineColor: BORDER as unknown as [number, number, number], tableLineWidth: 0.3,
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  y = drawSection(doc, "CALCULATION RESULTS", y, pageWidth);
  const metrics = [
    { label: "Total Resistance", value: `${result.totalResistance.toFixed(3)} Ω`, sub: `Limit: ${result.standardLimit} Ω` },
    { label: "Single Rod R₁", value: `${result.singleRodResistance.toFixed(3)} Ω`, sub: "Dwight formula" },
    { label: "Efficiency Factor", value: `${result.efficiencyFactor.toFixed(1)} %`, sub: "Rod interaction" },
    { label: "Min. Rods Required", value: `${result.minimumRodsRequired}`, sub: "To meet standard" },
  ];
  const boxW = contentWidth / 4 - 2;
  metrics.forEach((m, i) => {
    const bx = margin + i * (boxW + 2.67);
    const boxColor = i === 0 ? statusColor(result.status) : DARK;
    doc.setFillColor(boxColor[0], boxColor[1], boxColor[2]);
    doc.roundedRect(bx, y, boxW, 22, 2, 2, "F");
    setFont(doc, true, 14); doc.setTextColor(...WHITE);
    doc.text(m.value, bx + boxW / 2, y + 12, { align: "center" });
    setFont(doc, false, 7); doc.setTextColor(200, 200, 200);
    doc.text(m.label.toUpperCase(), bx + boxW / 2, y + 5, { align: "center" });
    doc.text(m.sub, bx + boxW / 2, y + 19, { align: "center" });
  });
  y += 28;

  autoTable(doc, {
    startY: y, head: [["RESULT PARAMETER", "VALUE", "NOTES"]],
    body: [
      ["Single Rod Resistance (R₁)", `${result.singleRodResistance.toFixed(4)} Ω`, "Dwight / IEEE Std 142"],
      ["Mutual Resistance (Rm)", `${result.mutualResistance.toFixed(4)} Ω`, "Between adjacent rods"],
      ["Total Resistance (Rn)", `${result.totalResistance.toFixed(4)} Ω`, `${inputs.numberOfRods} rods in parallel`],
      ["Efficiency Factor (η)", `${result.efficiencyFactor.toFixed(2)} %`, "100% = no rod interference"],
      ["Ideal Spacing", `${result.idealSpacing.toFixed(1)} m`, "Recommended 2 × L"],
      ["Standard Applied", result.standardName, `Limit: ${result.standardLimit} Ω`],
      ["Compliance Status", result.status, result.status === "PASS" ? "Design complies" : "Design requires revision"],
    ],
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 3.5 },
    headStyles: { fillColor: [...DARK] as [number, number, number], textColor: WHITE as unknown as [number, number, number], fontSize: 8, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 62, fontStyle: "bold", fillColor: LIGHT_BG as unknown as [number, number, number], textColor: GRAY as unknown as [number, number, number] },
      1: { cellWidth: 50 }, 2: { textColor: GRAY as unknown as [number, number, number], fontStyle: "italic" },
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    tableLineColor: BORDER as unknown as [number, number, number], tableLineWidth: 0.3,
    didDrawCell: (data) => {
      if (data.column.index === 1 && data.row.index === 6 && data.cell.section === "body") {
        const [cr, cg, cb] = statusColor(result.status);
        doc.setFillColor(cr, cg, cb);
        const pw = 22, ph = 7;
        const px = data.cell.x + 2;
        const py = data.cell.y + (data.cell.height - ph) / 2;
        doc.roundedRect(px, py, pw, ph, 1.5, 1.5, "F");
        setFont(doc, true, 8); doc.setTextColor(...WHITE);
        doc.text(result.status, px + pw / 2, py + ph / 2 + 2, { align: "center" });
      }
    },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  doc.addPage();
  drawHeaderBar(doc, pageWidth);
  y = 32;

  y = drawSection(doc, "CALCULATION METHOD — IEEE STD 142 / DWIGHT FORMULA", y, pageWidth);
  const formulaBoxes = [
    { label: "1. SINGLE ROD RESISTANCE (DWIGHT)", formula: result.formulaDetails.dwightFormula },
    { label: "2. MUTUAL RESISTANCE", formula: result.formulaDetails.mutualFormula },
    { label: "3. PARALLEL ROD RESISTANCE", formula: result.formulaDetails.parallelFormula },
  ];
  formulaBoxes.forEach((fb) => {
    doc.setFillColor(...DARK);
    doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "F");
    setFont(doc, true, 7.5); doc.setTextColor(...ORANGE);
    doc.text(fb.label, margin + 5, y + 5.5);
    setFont(doc, false, 10); doc.setTextColor(...WHITE);
    doc.text(fb.formula, margin + 5, y + 12.5);
    y += 20;
  });
  y += 4;
  setFont(doc, true, 8); doc.setTextColor(...GRAY);
  doc.text("VARIABLE DEFINITIONS:", margin, y);
  y += 5;
  const varRows = Object.entries(result.formulaDetails.variables).map(([k, v]) => [k, v]);
  autoTable(doc, {
    startY: y, head: [["SYMBOL", "DEFINITION & VALUE"]], body: varRows,
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 3.5 },
    headStyles: { fillColor: [...DARK] as [number, number, number], textColor: WHITE as unknown as [number, number, number], fontSize: 8, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: "bold", textColor: ORANGE as unknown as [number, number, number], fillColor: DARK as unknown as [number, number, number] },
    },
    tableLineColor: BORDER as unknown as [number, number, number], tableLineWidth: 0.3,
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  y = drawSection(doc, "ROD RESISTANCE CURVE DATA", y, pageWidth);
  const curveRows = result.rodCurve.map((pt) => [
    `${pt.rods}`, `${pt.resistance.toFixed(4)} Ω`, `${pt.efficiencyFactor.toFixed(1)} %`,
    pt.resistance <= result.standardLimit ? "PASS" : "FAIL",
  ]);
  autoTable(doc, {
    startY: y, head: [["RODS (n)", "RESISTANCE (Rn)", "EFFICIENCY (η)", "STATUS"]], body: curveRows,
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 3.5, halign: "center" },
    headStyles: { fillColor: [...DARK] as [number, number, number], textColor: WHITE as unknown as [number, number, number], fontSize: 8, fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 50 }, 2: { cellWidth: 40 }, 3: { cellWidth: 30 } },
    alternateRowStyles: { fillColor: LIGHT_BG as unknown as [number, number, number] },
    tableLineColor: BORDER as unknown as [number, number, number], tableLineWidth: 0.3,
    didDrawCell: (data) => {
      if (data.column.index === 3 && data.cell.section === "body") {
        const val = String(data.cell.raw);
        const [cr, cg, cb] = val === "PASS" ? GREEN : RED;
        doc.setFillColor(cr, cg, cb);
        const pw = 22, ph = 6;
        const px = data.cell.x + (data.cell.width - pw) / 2;
        const py = data.cell.y + (data.cell.height - ph) / 2;
        doc.roundedRect(px, py, pw, ph, 1.5, 1.5, "F");
        setFont(doc, true, 7.5); doc.setTextColor(...WHITE);
        doc.text(val, px + pw / 2, py + ph / 2 + 2, { align: "center" });
      }
    },
  });

  doc.addPage();
  drawHeaderBar(doc, pageWidth);
  y = 32;

  y = drawSection(doc, "SYSTEM DIAGNOSTICS & RECOMMENDATIONS", y, pageWidth);
  result.recommendations.forEach((rec) => {
    const [rr, rg, rb] = recTypeColor(rec.type);
    const label = recTypeLabel(rec.type);
    doc.setFillColor(rr, rg, rb);
    doc.roundedRect(margin, y, 20, 10, 2, 2, "F");
    setFont(doc, true, 7); doc.setTextColor(...WHITE);
    doc.text(label, margin + 10, y + 6.5, { align: "center" });
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(margin + 22, y, contentWidth - 22, 10, 2, 2, "F");
    doc.setDrawColor(rr, rg, rb); doc.setLineWidth(0.5);
    doc.roundedRect(margin + 22, y, contentWidth - 22, 10, 2, 2, "S");
    setFont(doc, false, 9); doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(rec.message, contentWidth - 32);
    doc.text(lines[0], margin + 26, y + 6.5);
    y += 14;
    if (lines.length > 1) {
      setFont(doc, false, 8.5); doc.setTextColor(...GRAY);
      for (let l = 1; l < lines.length; l++) { doc.text(lines[l], margin + 26, y); y += 5; }
      y += 2;
    }
  });
  y += 8;

  y = drawSection(doc, "APPLICABLE STANDARDS REFERENCE", y, pageWidth);
  autoTable(doc, {
    startY: y, head: [["STANDARD", "APPLICATION", "MAX RESISTANCE", "NOTES"]],
    body: [
      ["IEEE Std 80", "AC Substation Grounding", "1 Ω", "Power substations, switchyards"],
      ["NFPA 780", "Lightning Protection Systems", "10 Ω", "Structural lightning protection"],
      ["NEC / SNI", "General Electrical Installations", "25 Ω", "Buildings, general facilities"],
      ["ITU-T K.27", "Telecommunications", "5 Ω", "Telecom equipment, data centers"],
    ],
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 3.5 },
    headStyles: { fillColor: [...DARK] as [number, number, number], textColor: WHITE as unknown as [number, number, number], fontSize: 8, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: "bold", textColor: ORANGE as unknown as [number, number, number] },
      1: { cellWidth: 66 }, 2: { cellWidth: 34, halign: "center", fontStyle: "bold" },
      3: { textColor: GRAY as unknown as [number, number, number], fontStyle: "italic" },
    },
    alternateRowStyles: { fillColor: LIGHT_BG as unknown as [number, number, number] },
    tableLineColor: BORDER as unknown as [number, number, number], tableLineWidth: 0.3,
    didDrawCell: (data) => {
      if (data.column.index === 0 && data.row.section === "body") {
        const rowStd = ["substation", "lightning_protection", "general", "telecom"][data.row.index];
        if (rowStd === inputs.installationCategory) {
          doc.setFillColor(...ORANGE);
          doc.roundedRect(data.cell.x + data.cell.width - 7, data.cell.y + 1.5, 5, 5, 1, 1, "F");
          setFont(doc, true, 5.5); doc.setTextColor(...WHITE);
          doc.text("▶", data.cell.x + data.cell.width - 4.5, data.cell.y + 5.5, { align: "center" });
        }
      }
    },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(...AMBER); doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, "FD");
  setFont(doc, true, 8); doc.setTextColor(146, 64, 14);
  doc.text("DISCLAIMER", margin + 5, y + 7);
  setFont(doc, false, 7.5); doc.setTextColor(120, 53, 15);
  const disc = "This calculation report is generated for engineering estimation purposes using IEEE Std 142 Dwight formula. Results must be verified through on-site soil resistivity testing and reviewed by a qualified electrical engineer before implementation.";
  const discLines = doc.splitTextToSize(disc, contentWidth - 10);
  doc.text(discLines, margin + 5, y + 13);

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages, pageWidth, pageHeight);
  }

  const safeName = (projectInfo.projectName || "grounding-report").replace(/\s+/g, "-").toLowerCase();
  const dateStr = new Date().toISOString().split("T")[0];
  doc.save(`${safeName}_${dateStr}.pdf`);
}
