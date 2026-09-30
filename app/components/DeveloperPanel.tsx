'use client';

import { useState } from 'react';

export type DeveloperOperation = {
  system: string;
  path: string;
  endpoint: string;
  method: string;
  status: number | null;
  success: boolean;
  durationMs: number;
};

export function DeveloperPanel({ operation }: { operation: DeveloperOperation | null }) {
  const [expanded, setExpanded] = useState(true);

  async function copyDetails() {
    if (!operation) return;
    const text = [
      `Sistema: ${operation.system}`,
      `Kelias: ${operation.path}`,
      `Endpoint: ${operation.endpoint}`,
      `HTTP metodas: ${operation.method}`,
      `HTTP statusas: ${operation.status ?? 'Tinklo klaida'}`,
      `Pavyko: ${operation.success ? 'Taip' : 'Ne'}`,
      `Trukmė: ~${operation.durationMs} ms`,
    ].join('\n');
    await navigator.clipboard.writeText(text);
  }

  return <section className="developer-panel" aria-live="polite">
    <div className="developer-panel-heading">
      <div><strong>Developer Mode</strong><span>{operation ? `${operation.method} ${operation.endpoint} · ${operation.status ?? 'klaida'}` : 'Atlikite API veiksmą'}</span></div>
      <div className="developer-actions">{operation && <button type="button" onClick={copyDetails}>Kopijuoti</button>}<button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Suskleisti' : 'Išskleisti'}</button></div>
    </div>
    {expanded && (operation ? <dl><div><dt>Sistema</dt><dd>{operation.system}</dd></div><div><dt>Kelias</dt><dd>{operation.path}</dd></div><div><dt>Endpoint</dt><dd><code>{operation.endpoint}</code></dd></div><div><dt>HTTP metodas</dt><dd>{operation.method}</dd></div><div><dt>HTTP statusas</dt><dd>{operation.status ?? 'Tinklo klaida'}</dd></div><div><dt>Pavyko</dt><dd className={operation.success ? 'developer-success' : 'developer-failure'}>{operation.success ? 'Taip' : 'Ne'}</dd></div><div><dt>Trukmė</dt><dd>~{operation.durationMs} ms</dd></div></dl> : <p>Rodoma tik saugi paskutinės API operacijos informacija.</p>)}
  </section>;
}
