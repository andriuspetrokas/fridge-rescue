export type Notice = { text: string; kind: 'success' | 'warning' | 'error' | 'info' };

export function NoticeBanner({ notice, onFallback }: { notice: Notice; onFallback?: () => void }) {
  const icon = notice.kind === 'success' ? '✓' : notice.kind === 'error' ? '✕' : notice.kind === 'warning' ? '⚠' : 'ℹ';
  return <div className={`notice notice-${notice.kind}`} role="status"><span>{icon} {notice.text}</span>{onFallback && <button type="button" onClick={onFallback}>Pereiti į English paiešką</button>}</div>;
}
