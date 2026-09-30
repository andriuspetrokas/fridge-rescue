import type { FormEvent } from 'react';

type Props = {
  query: string;
  language: 'en' | 'lt';
  mode: 'ingredient' | 'name';
  translatedQuery: string;
  loading: boolean;
  onQuery: (value: string) => void;
  onLanguage: (value: 'en' | 'lt') => void;
  onMode: (value: 'ingredient' | 'name') => void;
  onSubmit: (event: FormEvent) => void;
};

export function SearchSection({ query, language, mode, translatedQuery, loading, onQuery, onLanguage, onMode, onSubmit }: Props) {
  const suggestions = language === 'lt'
    ? (mode === 'ingredient' ? ['vištiena', 'kiaušinis', 'lašiša'] : ['pica', 'makaronai', 'karis'])
    : (mode === 'ingredient' ? ['chicken', 'egg', 'salmon'] : ['Arrabiata', 'Pasta', 'Curry']);
  return <section className="hero">
    <div className="eyebrow">RECEPTŲ PAIEŠKA IŠ TURIMŲ PRODUKTŲ</div>
    <h1>Ką šiandien <em>gaminsime?</em></h1>
    <p>Ieškokite tiesiogiai anglų kalba arba pasirinkite lietuvišką paiešką – tuomet Gemini išvers užklausą, o TheMealDB suras receptus.</p>
    <div className="search-languages" role="group" aria-label="Paieškos kalba"><button type="button" className={language === 'en' ? 'active' : ''} disabled={loading} onClick={() => onLanguage('en')}>English · tiesiogiai</button><button type="button" className={language === 'lt' ? 'active' : ''} disabled={loading} onClick={() => onLanguage('lt')}>Lietuvių · su Gemini</button></div>
    <div className="search-modes" role="group" aria-label="Paieškos būdas"><button type="button" className={mode === 'ingredient' ? 'active' : ''} disabled={loading} onClick={() => onMode('ingredient')}>Pagal ingredientą</button><button type="button" className={mode === 'name' ? 'active' : ''} disabled={loading} onClick={() => onMode('name')}>Pagal pavadinimą</button></div>
    <form className="search" onSubmit={onSubmit} noValidate><label className="sr-only" htmlFor="query">{mode === 'ingredient' ? 'Ingredientas' : 'Patiekalo pavadinimas'}</label><span className="search-icon">⌕</span><input id="query" value={query} onChange={(event) => onQuery(event.target.value)} placeholder={mode === 'ingredient' ? (language === 'lt' ? 'Pvz., vištiena' : 'Pvz., chicken') : (language === 'lt' ? 'Pvz., vištienos karis' : 'Pvz., chicken curry')} maxLength={80} disabled={loading}/><button disabled={loading}>{loading ? (language === 'lt' ? 'Verčiama ir ieškoma...' : 'Ieškoma...') : 'Ieškoti receptų →'}</button></form>
    {loading && <p className="search-status" role="status">{language === 'lt' ? 'Gemini verčia užklausą, tada ieškome TheMealDB...' : 'Ieškome receptų TheMealDB duomenų bazėje...'}</p>}
    {language === 'lt' && translatedQuery && !loading && <p className="search-translation">Gemini vertimas paieškai: <b>{translatedQuery}</b></p>}
    <div className="chips"><span>Pabandykite:</span>{suggestions.map((item) => <button key={item} type="button" disabled={loading} onClick={() => onQuery(item)}>{item}</button>)}</div>
  </section>;
}
