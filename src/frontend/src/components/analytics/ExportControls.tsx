type RowData = Array<Record<string, unknown>>;

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportCsv(filename: string, rows: RowData) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const lines = [keys.join(',')];
  rows.forEach((row) => {
    const line = keys
      .map((key) => {
        const raw = row[key] ?? '';
        const escaped = String(raw).replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(',');
    lines.push(line);
  });
  download(filename, lines.join('\n'), 'text/csv;charset=utf-8');
}

export function exportChartPng(
  filename: string,
  chartContainerId: string,
  options?: { backgroundColor?: string },
) {
  const root = document.getElementById(chartContainerId);
  const canvas = root?.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  // Flatten to an opaque background so exported images do not show transparency checkerboards.
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;

  const ctx = exportCanvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = options?.backgroundColor || '#bcc6ba';
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  ctx.drawImage(canvas, 0, 0);

  const url = exportCanvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}

export function ExportButtons({
  onCsv,
  onPng,
}: {
  onCsv: () => void;
  onPng?: () => void;
}) {
  return (
    <div className="analytics-actions analytics-actions-right analytics-actions-ghost">
      <button onClick={onCsv}>↓ CSV</button>
      {onPng ? <button onClick={onPng}>↓ PNG</button> : null}
    </div>
  );
}
