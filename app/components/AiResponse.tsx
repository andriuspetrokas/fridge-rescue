function cleanHeading(line: string) {
  return line.replace(/^#{1,4}\s*/, '').replace(/^\*\*(.+)\*\*:?$/, '$1').replace(/:$/, '').trim();
}

export function AiResponse({ text }: { text: string }) {
  const knownHeadings = ['Ką jau turite', 'Ko trūksta', 'Kuo galima pakeisti', 'Pritaikyti ingredientai', 'Gaminimo žingsniai', 'Kas pakeista'];
  return <div className="ai-response">{text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    const heading = cleanHeading(line);
    if (knownHeadings.some((item) => heading.toLocaleLowerCase('lt') === item.toLocaleLowerCase('lt'))) return <h5 key={index}>{heading}</h5>;
    if (/^[-*•]\s+/.test(line)) return <div className="ai-response-item" key={index}>• {line.replace(/^[-*•]\s+/, '')}</div>;
    if (/^\d+[.)]\s+/.test(line)) return <div className="ai-response-step" key={index}>{line}</div>;
    return <p key={index}>{line}</p>;
  })}</div>;
}
