'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AuthError, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { KitchenItem, Meal, MealSummary, SavedAiRecipe, SavedMeal } from '@/lib/types';
import { AiRecipeLibrary } from './components/AiRecipeLibrary';
import { DeveloperPanel, type DeveloperOperation } from './components/DeveloperPanel';
import { KitchenSidebar } from './components/KitchenSidebar';
import { NoticeBanner, type Notice } from './components/NoticeBanner';
import { RecipeDetails } from './components/RecipeDetails';
import { SearchSection } from './components/SearchSection';

type AiRequest = { situation: string; minutes: 15 | 30 | 60; people: 1 | 2 | 4; goal: 'simpler' | 'cheaper' | 'healthier' | 'similar' };
type LoadingKey = 'search' | 'meal' | 'auth' | 'saved' | 'kitchen' | 'adapt' | 'saveAi';
type LoadingState = Record<LoadingKey, boolean>;

const developerModeAvailable = process.env.NEXT_PUBLIC_DEVELOPER_MODE !== 'false';
const initialLoading: LoadingState = { search: false, meal: false, auth: false, saved: false, kitchen: false, adapt: false, saveAi: false };

class ApiResponseError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function trackedFetch(endpoint: string, init: RequestInit | undefined, meta: Pick<DeveloperOperation, 'system' | 'path'>, report: (operation: DeveloperOperation) => void) {
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
  if (!response.ok) throw new ApiResponseError(data.error || 'Įvyko klaida.', response.status);
  return data;
}

function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case 'weak_password': return 'Slaptažodis neatitinka Supabase saugumo reikalavimų.';
    case 'user_already_exists':
    case 'email_exists': return 'Šis el. pašto adresas jau užregistruotas. Pabandykite prisijungti.';
    case 'invalid_credentials': return 'Neteisingas el. paštas arba slaptažodis.';
    case 'email_not_confirmed': return 'Pirmiausia patvirtinkite el. paštą, tada prisijunkite.';
    case 'signup_disabled':
    case 'email_provider_disabled': return 'Registracija el. paštu šiame Supabase projekte išjungta.';
    default: return `Nepavyko prisijungti arba užsiregistruoti: ${error.message}`;
  }
}

export default function Home() {
  const [query, setQuery] = useState('chicken');
  const [searchMode, setSearchMode] = useState<'ingredient' | 'name'>('ingredient');
  const [searchLanguage, setSearchLanguage] = useState<'en' | 'lt'>('en');
  const [translatedQuery, setTranslatedQuery] = useState('');
  const searchInProgress = useRef(false);
  const [meals, setMeals] = useState<MealSummary[]>([]);
  const [selected, setSelected] = useState<Meal | null>(null);
  const [saved, setSaved] = useState<SavedMeal[]>([]);
  const [aiRecipes, setAiRecipes] = useState<SavedAiRecipe[]>([]);
  const [kitchenItems, setKitchenItems] = useState<KitchenItem[]>([]);
  const [kitchenInput, setKitchenInput] = useState('');
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
  const [deletingAiId, setDeletingAiId] = useState('');
  const [loading, setLoading] = useState<LoadingState>(initialLoading);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [searchFallback, setSearchFallback] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  const [lastOperation, setLastOperation] = useState<DeveloperOperation | null>(null);
  const configured = !!supabase();

  function setBusy(key: LoadingKey, value: boolean) { setLoading((current) => ({ ...current, [key]: value })); }
  function notify(text: string, kind: Notice['kind'] = 'error') { setNotice({ text, kind }); }
  function clearNotice() { setNotice(null); setSearchFallback(false); }

  useEffect(() => {
    if (!developerModeAvailable) return;
    const timer = window.setTimeout(() => {
      const preference = window.localStorage.getItem('fridge-rescue-developer-mode');
      setDeveloperMode(preference === null ? true : preference === 'true');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const client = supabase();
    if (!client) return;
    client.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) { setSaved([]); setAiRecipes([]); setKitchenItems([]); setAdaptation(''); setGeneratedRequest(null); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  function toggleDeveloperMode() {
    setDeveloperMode((current) => {
      const next = !current;
      window.localStorage.setItem('fridge-rescue-developer-mode', String(next));
      return next;
    });
  }

  async function authHeaders(): Promise<HeadersInit> {
    const client = supabase();
    const { data } = client ? await client.auth.getSession() : { data: { session: null } };
    if (!data.session) throw new Error('Prisijunkite prie paskyros.');
    return { Authorization: `Bearer ${data.session.access_token}` };
  }

  async function loadSaved() {
    setBusy('saved', true);
    try {
      const data = await readJson(await trackedFetch('/api/saved', { headers: await authHeaders() }, { system: 'Supabase', path: 'Naršyklė → Fridge Rescue → Supabase' }, setLastOperation));
      setSaved(data.meals);
    } catch (error) { notify((error as Error).message); }
    finally { setBusy('saved', false); }
  }

  async function loadAiRecipes() {
    try {
      const data = await readJson(await trackedFetch('/api/ai-recipes', { headers: await authHeaders() }, { system: 'Supabase', path: 'Naršyklė → Fridge Rescue → Supabase' }, setLastOperation));
      setAiRecipes(data.recipes);
    } catch (error) { notify((error as Error).message); }
  }

  async function loadKitchen() {
    setBusy('kitchen', true);
    try {
      const data = await readJson(await trackedFetch('/api/kitchen', { headers: await authHeaders() }, { system: 'Supabase', path: 'Naršyklė → Fridge Rescue → Supabase' }, setLastOperation));
      setKitchenItems(data.items);
    } catch (error) { notify((error as Error).message); }
    finally { setBusy('kitchen', false); }
  }

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => { void loadSaved(); void loadAiRecipes(); void loadKitchen(); }, 0);
    return () => window.clearTimeout(timer);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function search(event?: FormEvent) {
    event?.preventDefault();
    if (searchInProgress.current) return;
    const term = query.trim();
    if (!term) { notify('Įveskite ingredientą arba patiekalo pavadinimą.', 'warning'); setMeals([]); return; }
    searchInProgress.current = true;
    setBusy('search', true); clearNotice(); setMeals([]); setSelected(null); setAdaptation(''); setGeneratedRequest(null); setAiSaved(false); setTranslatedQuery('');
    try {
      const params = new URLSearchParams({ mode: searchMode, language: searchLanguage, query: term });
      const meta = searchLanguage === 'lt' ? { system: 'Gemini + TheMealDB', path: 'Naršyklė → Fridge Rescue → Gemini → TheMealDB' } : { system: 'TheMealDB', path: 'Naršyklė → Fridge Rescue → TheMealDB' };
      const data = await readJson(await trackedFetch(`/api/meals?${params}`, undefined, meta, setLastOperation));
      setMeals(data.meals); setTranslatedQuery(data.translatedQuery);
      if (!data.meals.length) notify(`Receptų pagal „${data.translatedQuery}“ nerasta. Pabandykite kitą paiešką.`, 'warning');
    } catch (error) {
      notify((error as Error).message);
      if (searchLanguage === 'lt' && error instanceof ApiResponseError && [429, 503].includes(error.status)) setSearchFallback(true);
    } finally { searchInProgress.current = false; setBusy('search', false); }
  }

  function switchToEnglish() { setSearchLanguage('en'); setQuery(''); setTranslatedQuery(''); setSearchFallback(false); notify('Įveskite anglišką ingredientą arba patiekalo pavadinimą.', 'info'); }

  async function openMeal(id: string) {
    setBusy('meal', true); clearNotice(); setAdaptation(''); setGeneratedRequest(null); setAiSaved(false);
    try {
      const data = await readJson(await trackedFetch(`/api/meals/${id}`, undefined, { system: 'TheMealDB', path: 'Naršyklė → Fridge Rescue → TheMealDB' }, setLastOperation));
      setSelected(data.meal); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { notify((error as Error).message); }
    finally { setBusy('meal', false); }
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault(); const client = supabase(); if (!client) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { notify('Įveskite tinkamą el. pašto adresą.', 'warning'); return; }
    if (password.length < 6) { notify('Slaptažodis turi būti bent 6 simbolių.', 'warning'); return; }
    setBusy('auth', true); clearNotice(); const startedAt = performance.now(); const endpoint = authMode === 'login' ? '/auth/v1/token' : '/auth/v1/signup';
    try {
      const result = authMode === 'login' ? await client.auth.signInWithPassword({ email: email.trim(), password }) : await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
      setLastOperation({ system: 'Supabase Auth', path: 'Naršyklė → Supabase', endpoint, method: 'POST', status: result.error?.status ?? 200, success: !result.error, durationMs: Math.round(performance.now() - startedAt) });
      if (result.error) { notify(authErrorMessage(result.error)); return; }
      setPassword(''); notify(authMode === 'signup' && !result.data.session ? 'Patikrinkite el. paštą, patvirtinkite paskyrą ir tada prisijunkite.' : 'Prisijungta sėkmingai.', 'success');
    } catch { notify('Nepavyko susisiekti su Supabase. Patikrinkite ryšį.'); }
    finally { setBusy('auth', false); }
  }

  async function signOut() {
    const client = supabase(); if (!client) return;
    setBusy('auth', true); clearNotice(); const startedAt = performance.now();
    try {
      const { error } = await client.auth.signOut();
      setLastOperation({ system: 'Supabase Auth', path: 'Naršyklė → Supabase', endpoint: '/auth/v1/logout', method: 'POST', status: error?.status ?? 200, success: !error, durationMs: Math.round(performance.now() - startedAt) });
      if (error) notify(authErrorMessage(error)); else notify('Atsijungta.', 'success');
    } catch { notify('Nepavyko atsijungti. Bandykite dar kartą.'); }
    finally { setBusy('auth', false); }
  }

  async function toggleSaved() {
    if (!selected) return;
    setBusy('saved', true); clearNotice(); const isSaved = saved.some((item) => item.meal_id === selected.idMeal);
    try {
      await readJson(await trackedFetch(isSaved ? `/api/saved?mealId=${selected.idMeal}` : '/api/saved', { method: isSaved ? 'DELETE' : 'POST', headers: { ...(await authHeaders()), ...(!isSaved ? { 'Content-Type': 'application/json' } : {}) }, ...(!isSaved ? { body: JSON.stringify({ mealId: selected.idMeal }) } : {}) }, { system: 'Supabase', path: 'Naršyklė → Fridge Rescue → Supabase' }, setLastOperation));
      if (isSaved) setSaved((current) => current.filter((item) => item.meal_id !== selected.idMeal)); else await loadSaved();
      notify(isSaved ? 'Receptas pašalintas iš išsaugotų.' : 'Receptas išsaugotas.', 'success');
    } catch (error) { notify((error as Error).message); }
    finally { setBusy('saved', false); }
  }

  async function removeSaved(mealId: string) {
    setBusy('saved', true); clearNotice();
    try {
      await readJson(await trackedFetch(`/api/saved?mealId=${encodeURIComponent(mealId)}`, { method: 'DELETE', headers: await authHeaders() }, { system: 'Supabase', path: 'Naršyklė → Fridge Rescue → Supabase' }, setLastOperation));
      setSaved((current) => current.filter((item) => item.meal_id !== mealId)); notify('Receptas pašalintas iš „Mano receptai“.', 'success');
    } catch (error) { notify((error as Error).message); }
    finally { setBusy('saved', false); }
  }

  async function addKitchenItem(event: FormEvent) {
    event.preventDefault(); const name = kitchenInput.trim();
    if (!name) { notify('Įveskite produkto pavadinimą.', 'warning'); return; }
    setBusy('kitchen', true); clearNotice();
    try {
      const data = await readJson(await trackedFetch('/api/kitchen', { method: 'POST', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }, { system: 'Supabase', path: 'Naršyklė → Fridge Rescue → Supabase' }, setLastOperation));
      setKitchenItems((current) => [...current, data.item]); setKitchenInput(''); notify('Produktas pridėtas į „Mano virtuvė“.', 'success');
    } catch (error) { notify((error as Error).message); }
    finally { setBusy('kitchen', false); }
  }

  async function removeKitchenItem(id: string) {
    setBusy('kitchen', true); clearNotice();
    try {
      await readJson(await trackedFetch(`/api/kitchen?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: await authHeaders() }, { system: 'Supabase', path: 'Naršyklė → Fridge Rescue → Supabase' }, setLastOperation));
      setKitchenItems((current) => current.filter((item) => item.id !== id)); notify('Produktas pašalintas iš „Mano virtuvė“.', 'success');
    } catch (error) { notify((error as Error).message); }
    finally { setBusy('kitchen', false); }
  }

  async function adapt(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    setBusy('adapt', true); setAdaptation(''); setGeneratedRequest(null); setAiSaved(false); clearNotice();
    try {
      const headers = { 'Content-Type': 'application/json', ...(user ? await authHeaders() : {}) };
      const data = await readJson(await trackedFetch('/api/adapt', { method: 'POST', headers, body: JSON.stringify({ mealId: selected.idMeal, situation, minutes, people, goal }) }, { system: user ? 'Supabase + Gemini' : 'Gemini', path: user ? 'Naršyklė → Fridge Rescue → Supabase → TheMealDB → Gemini' : 'Naršyklė → Fridge Rescue → TheMealDB → Gemini' }, setLastOperation));
      setAdaptation(data.adaptation); setGeneratedRequest({ situation, minutes, people, goal });
    } catch (error) { notify((error as Error).message); }
    finally { setBusy('adapt', false); }
  }

  async function saveAiRecipe() {
    if (!user || !selected || !adaptation || !generatedRequest || aiSaved || loading.saveAi) return;
    setBusy('saveAi', true); clearNotice();
    try {
      const data = await readJson(await trackedFetch('/api/ai-recipes', { method: 'POST', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ mealId: selected.idMeal, mealName: selected.strMeal, ...generatedRequest, aiResult: adaptation }) }, { system: 'Supabase', path: 'Naršyklė → Fridge Rescue → Supabase' }, setLastOperation));
      setAiRecipes((current) => [data.recipe, ...current]); setAiSaved(true); notify('Pritaikytas receptas išsaugotas.', 'success');
    } catch (error) { notify((error as Error).message); }
    finally { setBusy('saveAi', false); }
  }

  async function removeAiRecipe(id: string) {
    setDeletingAiId(id); clearNotice();
    try {
      await readJson(await trackedFetch(`/api/ai-recipes?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: await authHeaders() }, { system: 'Supabase', path: 'Naršyklė → Fridge Rescue → Supabase' }, setLastOperation));
      setAiRecipes((current) => current.filter((recipe) => recipe.id !== id)); notify('AI receptas pašalintas.', 'success');
    } catch (error) { notify((error as Error).message); }
    finally { setDeletingAiId(''); }
  }

  function changeLanguage(value: 'en' | 'lt') { setSearchLanguage(value); setQuery(''); clearNotice(); setTranslatedQuery(''); }
  function changeMode(value: 'ingredient' | 'name') { setSearchMode(value); setQuery(''); clearNotice(); setTranslatedQuery(''); }

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="brand-icon">✳</span> Fridge Rescue</div><div className="top-actions"><span className="top-note">Mažiau švaistymo, daugiau idėjų</span>{developerModeAvailable && <label className="developer-toggle"><span>Developer Mode</span><input type="checkbox" checked={developerMode} onChange={toggleDeveloperMode}/><span className="toggle-track" aria-hidden="true"><span/></span></label>}</div></header>
    {developerMode && <DeveloperPanel operation={lastOperation}/>} 
    <SearchSection query={query} language={searchLanguage} mode={searchMode} translatedQuery={translatedQuery} loading={loading.search} onQuery={setQuery} onLanguage={changeLanguage} onMode={changeMode} onSubmit={search}/>
    {notice && <NoticeBanner notice={notice} onFallback={searchFallback ? switchToEnglish : undefined}/>} 
    <div className="content"><section className="main-column">
      {selected ? <RecipeDetails meal={selected} user={user} kitchenItems={kitchenItems} saved={saved.some((item) => item.meal_id === selected.idMeal)} situation={situation} minutes={minutes} people={people} goal={goal} adaptation={adaptation} aiSaved={aiSaved} busyMealSave={loading.saved} busyAdapt={loading.adapt} busyAiSave={loading.saveAi} onBack={() => setSelected(null)} onToggleSaved={toggleSaved} onSituation={setSituation} onMinutes={setMinutes} onPeople={setPeople} onGoal={setGoal} onAdapt={adapt} onSaveAi={saveAiRecipe}/>
        : <><div className="section-heading"><div><div className="eyebrow">ATRASKITE KĄ GAMINTI</div><h2>Receptų idėjos</h2></div><span>{meals.length ? `${meals.length} receptų` : 'Pradėkite nuo paieškos'}</span></div><div className="cards">{meals.map((meal) => <button className="card" disabled={loading.meal} key={meal.idMeal} onClick={() => openMeal(meal.idMeal)}><img src={meal.strMealThumb} alt="" loading="lazy"/><div className="card-text"><span>THEMEALDB RECEPTAS</span><strong>{meal.strMeal}</strong><span className="meal-id">Recepto ID: {meal.idMeal}</span><span className="card-link">Peržiūrėti receptą →</span></div></button>)}</div>{!meals.length && !loading.search && <div className="empty">🥕<h3>Jūsų skanus atradimas prasideda čia</h3><p>Įveskite ingredientą aukščiau ir paspauskite „Ieškoti receptų“.</p></div>}</>}
    </section><KitchenSidebar configured={configured} user={user} email={email} password={password} authMode={authMode} kitchenInput={kitchenInput} kitchenItems={kitchenItems} saved={saved} busyAuth={loading.auth} busyKitchen={loading.kitchen} busySaved={loading.saved} onEmail={setEmail} onPassword={setPassword} onAuthMode={setAuthMode} onKitchenInput={setKitchenInput} onAuth={submitAuth} onSignOut={signOut} onAddKitchen={addKitchenItem} onRemoveKitchen={removeKitchenItem} onOpenMeal={openMeal} onRemoveSaved={removeSaved}/></div>
    {user && <AiRecipeLibrary recipes={aiRecipes} deletingId={deletingAiId} onDelete={removeAiRecipe}/>} 
    <footer>Fridge Rescue · Receptai iš TheMealDB · Pritaikymas su Gemini</footer>
  </main>;
}
