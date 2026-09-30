import type { FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import type { KitchenItem, Meal } from '@/lib/types';
import { AiResponse } from './AiResponse';

type Props = {
  meal: Meal;
  user: User | null;
  kitchenItems: KitchenItem[];
  saved: boolean;
  situation: string;
  minutes: 15 | 30 | 60;
  people: 1 | 2 | 4;
  goal: 'simpler' | 'cheaper' | 'healthier' | 'similar';
  adaptation: string;
  aiSaved: boolean;
  busyMealSave: boolean;
  busyAdapt: boolean;
  busyAiSave: boolean;
  onBack: () => void;
  onToggleSaved: () => void;
  onSituation: (value: string) => void;
  onMinutes: (value: 15 | 30 | 60) => void;
  onPeople: (value: 1 | 2 | 4) => void;
  onGoal: (value: 'simpler' | 'cheaper' | 'healthier' | 'similar') => void;
  onAdapt: (event: FormEvent) => void;
  onSaveAi: () => void;
};

export function RecipeDetails(props: Props) {
  const meal = props.meal;
  return <article className="detail"><button className="text-button" onClick={props.onBack}>← Atgal į receptus</button><img className="detail-image" src={meal.strMealThumb} alt={meal.strMeal}/><div className="detail-body"><div className="eyebrow">{meal.strArea || 'Pasaulio virtuvė'} · {meal.strCategory || 'Patiekalas'}</div><h2>{meal.strMeal}</h2><div className="detail-actions"><button className="primary" disabled={!props.user || props.busyMealSave} onClick={props.onToggleSaved}>{props.saved ? '❤️ Išsaugota' : '❤️ Išsaugoti'}</button>{!props.user && <span>Norint išsaugoti, prisijunkite.</span>}</div><div className="recipe-grid"><div><h3>Ingredientai</h3><ul className="ingredients">{meal.ingredients.map((item, index) => <li key={index}><span>{item.name}</span><small>{item.measure}</small></li>)}</ul></div><div><h3>Gaminimas</h3><p className="instructions">{meal.strInstructions}</p>{meal.strYoutube?.startsWith('https://') && <a href={meal.strYoutube} target="_blank" rel="noreferrer">Žiūrėti vaizdo įrašą ↗</a>}</div></div><section className="ai-box"><div className="eyebrow">GEMINI AI</div><h3>Pritaikykite sau</h3><p>Ko trūksta, ką norite pakeisti ar kokių mitybos poreikių turite?</p>{props.user && <p className="kitchen-context">Gemini iš Supabase gaus jūsų „Mano virtuvė“ sąrašą: <b>{props.kitchenItems.length ? props.kitchenItems.map((item) => item.name).join(', ') : 'sąrašas tuščias'}</b>.</p>}<form onSubmit={props.onAdapt}>
    <div className="ai-options">
      <label>Kiek laiko turiu?<select value={props.minutes} onChange={(event) => props.onMinutes(Number(event.target.value) as 15 | 30 | 60)}><option value={15}>15 min.</option><option value={30}>30 min.</option><option value={60}>60 min.</option></select></label>
      <label>Kiek žmonių?<select value={props.people} onChange={(event) => props.onPeople(Number(event.target.value) as 1 | 2 | 4)}><option value={1}>1 žmogui</option><option value={2}>2 žmonėms</option><option value={4}>4 žmonėms</option></select></label>
      <label>Ko noriu?<select value={props.goal} onChange={(event) => props.onGoal(event.target.value as Props['goal'])}><option value="simpler">Paprasčiau</option><option value="cheaper">Pigiau</option><option value="healthier">Sveikiau</option><option value="similar">Kuo panašiau į originalą</option></select></label>
    </div>
    <label className="sr-only" htmlFor="situation">Jūsų situacija</label><textarea id="situation" value={props.situation} onChange={(event) => props.onSituation(event.target.value)} maxLength={500} required placeholder="Pvz., neturiu pieno ir noriu vegetariško varianto"/><button className="primary" disabled={props.busyAdapt}>{props.busyAdapt ? 'Pritaikoma...' : '✨ Pritaikyti receptą'}</button>
  </form>{props.adaptation && <div className="adaptation"><h4>Jums pritaikytas variantas</h4><AiResponse text={props.adaptation}/>{props.user ? <button type="button" className="primary" onClick={props.onSaveAi} disabled={props.busyAiSave || props.aiSaved}>{props.aiSaved ? '💾 Išsaugota' : props.busyAiSave ? 'Saugoma...' : '💾 Išsaugoti pritaikytą receptą'}</button> : <p className="muted">Prisijunkite, kad išsaugotumėte pritaikytą receptą.</p>}</div>}</section></div></article>;
}
