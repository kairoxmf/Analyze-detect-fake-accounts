function escapeCsvCell(value) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function exportResultsAsCsv(results, options) {
  if (!results || !results.length) return "";
  const cols = (options && options.columns) || [
    "username", "user_id", "fake_probability", "trust_score", "risk_level",
    "is_fake", "behavioral_score", "alert_score", "bot_ring_warning",
  ];
  const header = cols.map(escapeCsvCell).join(",");
  const rows = results.map(function (r) {
    return cols.map(function (c) { return escapeCsvCell(r[c]); }).join(",");
  });
  return [header].concat(rows).join("\r\n");
}

export function downloadCsv(results, filename) {
  filename = filename || "sentinel-report.csv";
  const csv = exportResultsAsCsv(results);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSummaryAsText(summary, results, meta) {
  meta = meta || {};
  const lines = [];
  lines.push("Sentinel – Analysis Summary");
  lines.push("==========================");
  lines.push("File: " + (meta.fileName || "—"));
  lines.push("Analyzed at: " + (meta.analyzedAt || "—"));
  lines.push("");
  if (summary) {
    lines.push("Total accounts: " + (summary.total != null ? summary.total : (results && results.length) || 0));
    lines.push("Fake: " + (summary.fake ?? 0));
    lines.push("Real: " + (summary.real ?? 0));
    const avg = summary.avg_fake_probability ?? 0;
    lines.push("Avg fake probability: " + (avg * 100).toFixed(1) + "%");
    const r = summary.risk_levels || {};
    lines.push("Risk – Low: " + (r.low ?? 0) + ", Medium: " + (r.medium ?? 0) + ", High: " + (r.high ?? 0));
    lines.push("Bot rings: " + (summary.bot_ring_count ?? 0));
  }
  lines.push("");
  lines.push("-- End of report --");
  return lines.join("\n");
}

export function downloadSummaryTxt(summary, results, meta, filename) {
  filename = filename || "sentinel-summary.txt";
  const text = exportSummaryAsText(summary, results, meta);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadPdf(summary, results, meta) {
  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const metaInfo = meta || {};
    doc.setFontSize(18);
    doc.text("Sentinel – Analysis Report", 20, 20);
    doc.setFontSize(10);
    doc.text(`File: ${metaInfo.fileName || "—"}`, 20, 30);
    doc.text(`Analyzed at: ${metaInfo.analyzedAt || "—"}`, 20, 36);
    doc.text("", 20, 42);
    if (summary) {
      doc.text(`Total accounts: ${summary.total ?? (results?.length || 0)}`, 20, 48);
      doc.text(`Fake: ${summary.fake ?? 0}`, 20, 54);
      doc.text(`Real: ${summary.real ?? 0}`, 20, 60);
      const avg = summary.avg_fake_probability ?? 0;
      doc.text(`Avg fake probability: ${(avg * 100).toFixed(1)}%`, 20, 66);
      const r = summary.risk_levels || {};
      doc.text(`Risk – Low: ${r.low ?? 0}, Medium: ${r.medium ?? 0}, High: ${r.high ?? 0}`, 20, 72);
    }
    let y = 82;
    if (results && results.length) {
      doc.setFontSize(12);
      doc.text("Top accounts:", 20, y);
      y += 8;
      doc.setFontSize(9);
      results.slice(0, 20).forEach((row, i) => {
        const id = row.username || row.user_id || "—";
        const prob = ((row.fake_probability || 0) * 100).toFixed(0);
        const risk = row.risk_level || "—";
        doc.text(`${i + 1}. ${id} – ${prob}% (${risk})`, 20, y);
        y += 6;
      });
    }
    doc.save(metaInfo.fileName ? `sentinel-${metaInfo.fileName.replace(/\.[^/.]+$/, "")}.pdf` : "sentinel-report.pdf");
  } catch (err) {
    console.error(err);
    throw new Error("PDF export failed");
  }
}
