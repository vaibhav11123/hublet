export function AnalyticsLoading() {
  return <div className="analytics-loading">Loading analytics...</div>;
}

export function AnalyticsEmpty({ message }: { message: string }) {
  return <div className="analytics-empty">{message}</div>;
}

export function AnalyticsError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="analytics-error">
      <div>{message}</div>
      {onRetry ? <button onClick={onRetry}>Retry</button> : null}
    </div>
  );
}

export function AnalyticsWarnings({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return <div className="analytics-warnings">Warnings: {warnings.join(' | ')}</div>;
}
