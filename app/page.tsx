'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AuthError, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Meal, MealSummary, SavedAiRecipe, SavedMeal } from '@/lib/types';

type AiRequest = { situation: string; minutes: 15 | 30 | 60; people: 1 | 2 | 4; goal: 'simpler' | 'cheaper' | 'healthier' | 'similar' };
type DeveloperOperation = {
  system: string;
  path: string;
  endpoint: string;
  method: string;
  status: number | null;
  success: boolean;
  durationMs: number;
};

const developerModeAvailable = process.env.NEXT_PUBLIC_DEVELOPER_MODE !== 'false';

async function trackedFetch(
  endpoint: string,
  init: RequestInit | undefined,
  meta: Pick<DeveloperOperation, 'system' | 'path'>,
  report: (operation: DeveloperOperation) => void,
) {
  const startedAt = performance.now();
  const method = init?.method?.toUpperCase() ?? 'GET';
  try {
    const response = await fetch(endpoint, init);
    report({ ...meta, endpoint, method, status: response.status, success: response.ok, durationMs: Math.round(performance.now() - startedAt) });
    return response;
  } catch (error) {
    report({ ...meta, endpoint, method, status: null, success: false, durationMs: Math.round(performance.now() - startedAt) });
    throw error;
  }
}

async function readJson(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Įvyko klaida.');
  return data;
}

function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case 'weak_password':
      return 'Slaptažodis neatitinka Supabase nustatytų saugumo reikalavimų. Pasirinkite ilgesnį ir stipresnį slaptažodį.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Šis el. pašto adresas jau užregistruotas. Pabandykite prisijungti.';
    case 'invalid_credentials':
      return 'Neteisingas el. paštas arba slaptažodis.';
    case 'email_not_confirmed':
      return 'Pirmiausia patvirtinkite el. paštą, tada prisijunkite.';
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'Registracija el. paštu šiame Supabase projekte išjungta.';
    default:
      return `Nepavyko prisijungti arba užsiregistruoti: ${error.message}`;
  }
}

export default function Home() {
  const [query, setQuery] = useState('chicken');
  const [searchMode, setSearchMode] = useState<'ingredient' | 'name'>('ingredient');
  const searchInProgress = useRef(false);
  const [meals, setMeals] = useState<MealSummary[]>([]);
  const [selected, setSelected] = useState<Meal | null>(null);
  const [saved, setSaved] = useState<SavedMeal[]>([]);
  const [aiRecipes, setAiRecipes] = useState<SavedAiRecipe[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [situation, setSituation] = useState('');
  const [minutes, setMinutes] = useState<15 | 30 | 60>(30);
  const [people, setPeople] = useState<1 | 2 | 4>(2);
  const [goal, setGoal] = useState<'simpler' | 'cheaper' | 'healthier' | 'similar'>('similar');
  const [adaptation, setAdaptation] = useState('');
  const [generatedRequest, setGeneratedRequest] = useState<AiRequest | null>(null);
  const [aiSaved, setAiSaved] = useState(false);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');
  const [developerMode, setDeveloperMode] = useState(false);
  const [lastOperation, setLastOperation] = useState<DeveloperOperation | null>(null);
  const configured = !!supabase();

  useEffect(() => {
    if (!developerModeAvailable) return;
    const timer = window.setTimeout(() => {
      const savedPreference = window.localStorage.getItem('fridge-rescue-developer-mode');
      setDeveloperMode(savedPreference === null ? true : savedPreference === 'true');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleDeveloperMode() {
    setDeveloperMode((current) => {
      const next = !current;
      window.localStorage.setItem('fridge-rescue-developer-mode', String(next));
      return next;
    });
  }

  useEffect(() => {
    const client = supabase();
    if (!client) return;
    client.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); if (!session) { setSaved([]); setAiRecipes([]); setAdaptation(''); setGeneratedRequest(null); } });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function authHeaders(): Promise<HeadersInit> {
    const client = supabase();
    const { data } = client ? await client.auth.getSession() : { data: { session: null } };
    if (!data.session) throw new Error('Prisijunkite prie paskyros.');
    return { Authorization: `Bearer ${data.session.access_token}` };
  }

  async function loadSaved() {
    try {
      const data = await readJson(await trackedFetch('/api/saved', { headers: await authHeaders() }, { system: 'Supabase', path: 'Naršyklė → Fridge Rescue → Supabase' }, setLastOperation));
      setSaved(data.meals);
    } catch (error) { setMessage((error as Error).message); }
  }

  async function loadAiRecipes() {
    try {
      const data = await readJson(await trackedFetch('/api/ai-recipes', { headers: await authHeaders() }, { system: 'Supabase', path: 'Naršyklė → Fridge Rescue → Supabase' }, setLastOperation));
      setAiRecipes(data.recipes);
    } catch (error) { setMessage((error as Error).message); }
  }

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      void loadSaved();
      void loadAiRecipes();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function search(event?: FormEvent) {
    event?.preventDefault();
    if (searchInProgress.current) return;
    const term = query.trim();
    if (!term) { setMessage('Įveskite ingredientą arba patiekalo pavadinimą.'); setMeals([]); return; }
    searchInProgress.current = true;
    setLoading('search'); setMessage(''); setMeals([]); setSelected(null); setAdaptation(''); setGeneratedRequest(null); setAiSaved(false);
    try {
      const params = new URLSearchParams({ mode: searchMode, query: term });
      const data = await readJson(await trackedFetch(`/api/meals?${params}`, undefined, { system: 'TheMealDB', path: 'Naršyklė → Fridge Rescue → TheMealDB' }, setLastOperation));
      setMeals(data.meals);
      if (!data.meals.length) setMessage('Receptų nerasta. Pabandykite kitą anglišką ingredientą arba patiekalo pavadinimą.');
    } catch (error) { setMessage((error as Error).message); }
    finally { searchInProgress.current = false; setLoading(''); }
  }

  async function openMeal(id: string) {
    setLoading('meal'); setMessage(''); setAdaptation(''); setGeneratedRequest(null); setAiSaved(false);
    try {
      const data = await readJson(await trackedFetch(`/api/meals/${id}`, undefined, { system: 'TheMealDB', path: 'Naršyklė → Fridge Rescue → TheMealDB' }, setLastOperation));
      setSelected(data.meal);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { setMessage((error as Error).message); }
    finally { setLoading(''); }
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    const client = supabase();
    if (!client) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setMessage('Įveskite tinkamą el. pašto adresą.'); return; }
    if (password.length < 6) { setMessage('Slaptažodis turi būti bent 6 simbolių.'); return; }
    setLoading('auth'); setMessage('');
    const startedAt = performance.now();
    const authEndpoint = authMode === 'login' ? '/auth/v1/token' : '/auth/v1/signup';
    try {
      const result = authMode === 'login'
        ? await client.auth.signInWithPassword({ email: email.trim(), password })
        : await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
      setLastOperation({ system: 'Supabase Auth', path: 'Naršyklė → Supabase', endpoint: authEndpoint, method: 'POST', status: result.error?.status ?? 200, success: !result.error, durationMs: Math.round(performance.now() - startedAt) });
      if (result.error) { setMessage(authErrorMessage(result.error)); return; }
      setPassword('');
      setMessage(authMode === 'signup' && !result.data.session
        ? 'Jei reikia patvirtinimo, patikrinkite el. paštą ir paspauskite laiške esančią nuorodą. Tada prisijunkite. Jei paskyrą jau turite, pasirinkite „Prisijungti“.'
        : 'Prisijungta sėkmingai.');
    } catch {
      setLastOperation({ system: 'Supabase Auth', path: 'Naršyklė → Supabase', endpoint: authEndpoint, method: 'POST', status: null, success: false, durationMs: Math.round(performance.now() - startedAt) });
      setMessage('Nepavyko susisiekti su Supabase. Patikrinkite ryšį ir bandykite dar kartą.');
    }
    finally { setLoading(''); }
  }

  async function signOut() {
    const client = supabase();
    if (!client) return;
    setLoading('auth'); setMessage('');
    const startedAt = performance.now();
    try {
      const { error } = await client.auth.signOut();
      setLastOperation({ system: 'Supabase Auth', path: 'Naršyklė → Supabase', endpoint: '/auth/v1/logout', method: 'POST', status: error?.status ?? 200, success: !error, durationMs: Math.round(performance.now() - startedAt) });
      setMessage(error ? authErrorMessage(error) : 'Atsijungta.');
    } catch {
      setLastOperation({ system: 'Supabase Auth', path: 'Naršyklė → Supabase', endpoint: '/auth/v1/logout', method: 'POST', status: null, success: false, durationMs: Math.round(performance.now() - startedAt) });
      setMessage('Nepavyko atsijungti. Bandykite dar kartą.');
    }
    finally { setLoading(''); }
  }

  async function toggleSaved() {
    if (!selected) return;
    setLoading('save'); setMessage('');
    const isSaved = saved.some((item) => item.meal_id === selected.idMeal);
    try {
      await readJson(await trackedFetch(isSaved ? `/api/saved?mealId=${selected.idMeal}` : '/api/saved', {
        method: isSaved ? 'DELETE' : 'POST',
        headers: { ...(await authHeaders()), ...(!isSaved ? { 'Content-Type': 'application/json' } : {}) },
        ...(!isSaved ? { body: JSON.stringify({ mealId: selected.idMeal }) } : {}),
      }, { system: 'Supabase', path: 'Naršyklė → Fridge Rescue → Supabase' }, setLastOperation));
      await loadSaved();
      setMessage(isSaved ? 'Receptas pašalintas iš išsaugotų.' : 'Receptas išsaugotas.');
    } catch (error) { setMessage((error as Error).message); }
    finally { setLoading(''); }
  }

  async function removeSaved(mealId: string) {
    setLoading('save'); setMessage('');
    try {
      await readJson(await trackedFetch(`/api/saved?mealId=${encodeURIComponent(mealId)}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      }, { system: 'Supabase', path: 'Naršyklė → Fridge Rescue → Supabase' }, setLastOperation));
      setSaved((current) => current.filter((item) => item.meal_id !== mealId));
      setMessage('Receptas pašalintas iš „Mano receptai“.');
    } catch (error) { setMessage((error as Error).message); }
    finally { setLoading(''); }
  }

  async function adapt(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setLoading('adapt'); setAdaptation(''); setGeneratedRequest(null); setAiSaved(false); setMessage('');
    try {
      const data = await readJson(await trackedFetch('/api/adapt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mealId: selected.idMeal, situation, minutes, people, goal }) }, { system: 'Gemini', path: 'Naršyklė → Fridge Rescue → TheMealDB → Gemini' }, setLastOperation));
      setAdaptation(data.adaptation);
      setGeneratedRequest({ situation, minutes, people, goal });
    } catch (error) { setMessage((error as Error).message); }
    finally { setLoading(''); }
  }

  async function saveAiRecipe() {
    if (!user || !selected || !adaptation || !generatedRequest || aiSaved || loading === 'saveAi') return;
    setLoading('saveAi'); setMessage('');
    try {
      const data = await readJson(await trackedFetch('/api/ai-recipes', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealId: selected.idMeal, mealName: selected.strMeal, ...generatedRequest, aiResult: adaptation }),
      }, { system: 'Supabase', path: 'Naršyklė → Fridge Rescue → Supabase' }, setLastOperation));
      setAiRecipes((current) => [data.recipe, ...current]);
      setAiSaved(true);
      setMessage('Pritaikytas receptas išsaugotas skiltyje „Mano AI receptai“.');
    } catch (error) { setMessage((error as Error).message); }
    finally { setLoading(''); }
  }

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="brand-icon">✳</span> Fridge Rescue</div><div className="top-actions"><span className="top-note">Mažiau švaistymo, daugiau idėjų</span>{developerModeAvailable && <label className="developer-toggle"><span>Developer Mode</span><input type="checkbox" checked={developerMode} onChange={toggleDeveloperMode}/><span className="toggle-track" aria-hidden="true"><span/></span></label>}</div></header>
    {developerMode && <section className="developer-panel" aria-live="polite"><div className="developer-panel-heading"><strong>Developer Mode</strong><span>Rodoma tik saugi paskutinės API operacijos informacija</span></div>{lastOperation ? <dl><div><dt>Sistema</dt><dd>{lastOperation.system}</dd></div><div><dt>Kelias</dt><dd>{lastOperation.path}</dd></div><div><dt>Endpoint</dt><dd><code>{lastOperation.endpoint}</code></dd></div><div><dt>HTTP metodas</dt><dd>{lastOperation.method}</dd></div><div><dt>HTTP statusas</dt><dd>{lastOperation.status ?? 'Tinklo klaida'}</dd></div><div><dt>Pavyko</dt><dd className={lastOperation.success ? 'developer-success' : 'developer-failure'}>{lastOperation.success ? 'Taip' : 'Ne'}</dd></div><div><dt>Trukmė</dt><dd>~{lastOperation.durationMs} ms</dd></div></dl> : <p>Atlikite paiešką ar kitą API veiksmą – čia bus parodyta jo informacija.</p>}</section>}
    <section className="hero"><div className="eyebrow">RECEPTŲ PAIEŠKA IŠ TURIMŲ PRODUKTŲ</div><h1>Ką šiandien <em>gaminsime?</em></h1><p>Ieškokite pagal ingredientą arba patiekalo pavadinimą. TheMealDB geriausiai supranta angliškus žodžius, pavyzdžiui, <b>chicken</b>, <b>egg</b> ar <b>salmon</b>.</p>
      <div className="search-modes" role="group" aria-label="Paieškos būdas"><button type="button" className={searchMode === 'ingredient' ? 'active' : ''} disabled={loading === 'search'} onClick={() => { setSearchMode('ingredient'); setQuery(''); setMessage(''); }}>Pagal ingredientą</button><button type="button" className={searchMode === 'name' ? 'active' : ''} disabled={loading === 'search'} onClick={() => { setSearchMode('name'); setQuery(''); setMessage(''); }}>Pagal pavadinimą</button></div>
      <form className="search" onSubmit={search} noValidate><label className="sr-only" htmlFor="query">{searchMode === 'ingredient' ? 'Ingredientas' : 'Patiekalo pavadinimas'}</label><span className="search-icon">⌕</span><input id="query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchMode === 'ingredient' ? 'Pvz., chicken' : 'Pvz., Arrabiata'} maxLength={80} disabled={loading === 'search'}/><button disabled={loading === 'search'}>{loading === 'search' ? 'Ieškoma...' : 'Ieškoti receptų →'}</button></form>
      {loading === 'search' && <p className="search-status" role="status">Ieškome receptų TheMealDB duomenų bazėje...</p>}
      <div className="chips"><span>Pabandykite:</span>{(searchMode === 'ingredient' ? ['chicken', 'egg', 'salmon'] : ['Arrabiata', 'Pasta', 'Curry']).map((item) => <button key={item} type="button" disabled={loading === 'search'} onClick={() => setQuery(item)}>{item}</button>)}</div>
    </section>
    {message && <div className="notice" role="status">{message}</div>}
    <div className="content">
      <section className="main-column">
        {selected ? <article className="detail"><button className="text-button" onClick={() => setSelected(null)}>← Atgal į receptus</button><img className="detail-image" src={selected.strMealThumb} alt={selected.strMeal}/><div className="detail-body"><div className="eyebrow">{selected.strArea || 'Pasaulio virtuvė'} · {selected.strCategory || 'Patiekalas'}</div><h2>{selected.strMeal}</h2><div className="detail-actions"><button className="primary" disabled={!user || loading === 'save'} onClick={toggleSaved}>{saved.some((item) => item.meal_id === selected.idMeal) ? '❤️ Išsaugota' : '❤️ Išsaugoti'}</button>{!user && <span>Norint išsaugoti, prisijunkite.</span>}</div><div className="recipe-grid"><div><h3>Ingredientai</h3><ul className="ingredients">{selected.ingredients.map((item, index) => <li key={index}><span>{item.name}</span><small>{item.measure}</small></li>)}</ul></div><div><h3>Gaminimas</h3><p className="instructions">{selected.strInstructions}</p>{selected.strYoutube?.startsWith('https://') && <a href={selected.strYoutube} target="_blank" rel="noreferrer">Žiūrėti vaizdo įrašą ↗</a>}</div></div><section className="ai-box"><div className="eyebrow">GEMINI AI</div><h3>Pritaikykite sau</h3><p>Ko trūksta, ką norite pakeisti ar kokių mitybos poreikių turite?</p><form onSubmit={adapt}>
  <div className="ai-options">
    <label>Kiek laiko turiu?<select value={minutes} onChange={(e) => setMinutes(Number(e.target.value) as 15 | 30 | 60)}><option value={15}>15 min.</option><option value={30}>30 min.</option><option value={60}>60 min.</option></select></label>
    <label>Kiek žmonių?<select value={people} onChange={(e) => setPeople(Number(e.target.value) as 1 | 2 | 4)}><option value={1}>1 žmogui</option><option value={2}>2 žmonėms</option><option value={4}>4 žmonėms</option></select></label>
    <label>Ko noriu?<select value={goal} onChange={(e) => setGoal(e.target.value as 'simpler' | 'cheaper' | 'healthier' | 'similar')}><option value="simpler">Paprasčiau</option><option value="cheaper">Pigiau</option><option value="healthier">Sveikiau</option><option value="similar">Kuo panašiau į originalą</option></select></label>
  </div>
  <label className="sr-only" htmlFor="situation">Jūsų situacija</label><textarea id="situation" value={situation} onChange={(e) => setSituation(e.target.value)} maxLength={500} required placeholder="Pvz., neturiu pieno ir noriu vegetariško varianto"/><button className="primary" disabled={loading === 'adapt'}>{loading === 'adapt' ? 'Pritaikoma...' : '✨ Pritaikyti receptą'}</button></form>{adaptation && <div className="adaptation"><h4>Jums pritaikytas variantas</h4><p>{adaptation}</p>{user ? <button type="button" className="primary" onClick={saveAiRecipe} disabled={loading === 'saveAi' || aiSaved}>{aiSaved ? '💾 Išsaugota' : loading === 'saveAi' ? 'Saugoma...' : '💾 Išsaugoti pritaikytą receptą'}</button> : <p className="muted">Prisijunkite, kad išsaugotumėte pritaikytą receptą.</p>}</div>}</section></div></article> : <><div className="section-heading"><div><div className="eyebrow">ATRASKITE KĄ GAMINTI</div><h2>Receptų idėjos</h2></div><span>{meals.length ? `${meals.length} receptų` : 'Pradėkite nuo paieškos'}</span></div><div className="cards">{meals.map((meal) => <button className="card" key={meal.idMeal} onClick={() => openMeal(meal.idMeal)}><img src={meal.strMealThumb} alt="" loading="lazy"/><div className="card-text"><span>THEMEALDB RECEPTAS</span><strong>{meal.strMeal}</strong><span className="meal-id">Recepto ID: {meal.idMeal}</span><span className="card-link">Peržiūrėti receptą →</span></div></button>)}</div>{!meals.length && loading !== 'search' && <div className="empty">🥕<h3>Jūsų skanus atradimas prasideda čia</h3><p>Įveskite ingredientą aukščiau ir paspauskite „Ieškoti receptų“.</p></div>}</>}
      </section>
      <aside className="sidebar"><section className="panel"><div className="panel-icon">♡</div><h3>Mano virtuvė</h3>{configured ? user ? <><p className="muted">Prisijungta kaip <b>{user.email}</b></p><button className="text-button" onClick={signOut} disabled={loading === 'auth'}>Atsijungti →</button><div className="saved-list"><h4>Mano receptai ({saved.length})</h4>{saved.length ? saved.map((item) => <div className="saved-item" key={item.meal_id}><button className="saved-open" onClick={() => openMeal(item.meal_id)}><img src={item.meal_thumb} alt=""/><span>{item.meal_name}</span></button><button className="saved-remove" title="Pašalinti receptą" aria-label={`Pašalinti ${item.meal_name}`} disabled={loading === 'save'} onClick={() => removeSaved(item.meal_id)}>×</button></div>) : <p className="muted">Kol kas nieko neišsaugojote.</p>}</div></> : <><p className="muted">Prisijunkite ir išsaugokite patikusius receptus.</p><div className="auth-tabs"><button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Prisijungti</button><button className={authMode === 'signup' ? 'active' : ''} onClick={() => setAuthMode('signup')}>Registruotis</button></div><form className="auth-form" onSubmit={submitAuth} noValidate><label>El. paštas<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required/></label><label>Slaptažodis<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required/></label><button className="primary" disabled={loading === 'auth'}>{authMode === 'login' ? 'Prisijungti' : 'Sukurti paskyrą'}</button></form></> : <p className="muted">Norėdami naudoti paskyras, įrašykite Supabase duomenis į <code>.env.local</code>.</p>}</section><section className="tip"><span>✦ MAŽAS PATARIMAS</span><p>Turite kelis produktus? Pradėkite nuo pagrindinio. Pasirinktą receptą vėliau galėsite pritaikyti su AI.</p></section></aside>
    </div>
    {user && <section className="ai-library" aria-labelledby="ai-library-title"><div className="section-heading"><div><div className="eyebrow">JŪSŲ IŠSAUGOTI VARIANTAI</div><h2 id="ai-library-title">Mano AI receptai</h2></div><span>{aiRecipes.length} receptų</span></div>{aiRecipes.length ? <div className="ai-recipe-list">{aiRecipes.map((recipe) => <details key={recipe.id}><summary><strong>{recipe.original_meal_name}</strong><small>{new Date(recipe.created_at).toLocaleDateString('lt-LT')}</small></summary><div className="ai-recipe-content"><h3>Jūsų prašymas</h3><p>{recipe.user_request}</p><h3>Pritaikytas receptas</h3><p>{recipe.ai_result}</p></div></details>)}</div> : <p className="muted">Kol kas neišsaugojote AI pritaikytų receptų.</p>}</section>}
    <footer>Fridge Rescue · Receptai iš TheMealDB · Pritaikymas su Gemini</footer>
  </main>;
}
