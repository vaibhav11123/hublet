import { ReactNode } from 'react';
import { ExportButtons } from './ExportControls';

export function ChartCard({
  title,
  chartId,
  onExportCsv,
  onExportPng,
  children,
}: {
  title: string;
  chartId: string;
  onExportCsv: () => void;
  onExportPng?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="analytics-card" id={chartId}>
      <div className="analytics-card-header">
        <h3>{title}</h3>
        <ExportButtons onCsv={onExportCsv} onPng={onExportPng} />
      </div>
      {children}
    </section>
  );
}
