'use client';

import { useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import type { KitchenItem, SavedMeal } from '@/lib/types';

type Props = {
  configured: boolean;
  user: User | null;
  email: string;
  password: string;
  authMode: 'login' | 'signup';
  kitchenInput: string;
  kitchenItems: KitchenItem[];
  saved: SavedMeal[];
  busyAuth: boolean;
  busyKitchen: boolean;
  busySaved: boolean;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onAuthMode: (value: 'login' | 'signup') => void;
  onKitchenInput: (value: string) => void;
  onAuth: (event: FormEvent) => void;
  onSignOut: () => void;
  onAddKitchen: (event: FormEvent) => void;
  onRemoveKitchen: (id: string) => void;
  onOpenMeal: (id: string) => void;
  onRemoveSaved: (id: string) => void;
};

export function KitchenSidebar(props: Props) {
  const [tab, setTab] = useState<'products' | 'recipes'>('products');
  const { configured, user } = props;
  return <aside className="sidebar"><section className="panel"><div className="panel-icon">♡</div><h3>Mano virtuvė</h3>{configured ? user ? <>
    <p className="muted">Prisijungta kaip <b>{user.email}</b></p><button className="text-button" onClick={props.onSignOut} disabled={props.busyAuth}>Atsijungti →</button>
    <div className="kitchen-tabs" role="tablist"><button type="button" className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Produktai ({props.kitchenItems.length})</button><button type="button" className={tab === 'recipes' ? 'active' : ''} onClick={() => setTab('recipes')}>Receptai ({props.saved.length})</button></div>
    {tab === 'products' ? <div className="kitchen-list"><form className="kitchen-form" onSubmit={props.onAddKitchen}><label className="sr-only" htmlFor="kitchen-item">Produkto pavadinimas</label><input id="kitchen-item" value={props.kitchenInput} onChange={(event) => props.onKitchenInput(event.target.value)} placeholder="Pvz., kiaušiniai" maxLength={60} disabled={props.busyKitchen}/><button type="submit" aria-label="Pridėti produktą" disabled={props.busyKitchen || !props.kitchenInput.trim()}>+</button></form>{props.kitchenItems.length ? <ul>{props.kitchenItems.map((item) => <li key={item.id}><span>{item.name}</span><button type="button" aria-label={`Pašalinti ${item.name}`} title="Pašalinti produktą" disabled={props.busyKitchen} onClick={() => props.onRemoveKitchen(item.id)}>×</button></li>)}</ul> : <p className="muted">Įrašykite produktus, kuriuos turite namuose.</p>}</div> : <div className="saved-list">{props.saved.length ? props.saved.map((item) => <div className="saved-item" key={item.meal_id}><button className="saved-open" onClick={() => props.onOpenMeal(item.meal_id)}><img src={item.meal_thumb} alt=""/><span>{item.meal_name}</span></button><button className="saved-remove" title="Pašalinti receptą" aria-label={`Pašalinti ${item.meal_name}`} disabled={props.busySaved} onClick={() => props.onRemoveSaved(item.meal_id)}>×</button></div>) : <p className="muted">Kol kas nieko neišsaugojote.</p>}</div>}
  </> : <><p className="muted">Prisijunkite, pridėkite turimus produktus ir išsaugokite receptus.</p><div className="auth-tabs"><button className={props.authMode === 'login' ? 'active' : ''} onClick={() => props.onAuthMode('login')}>Prisijungti</button><button className={props.authMode === 'signup' ? 'active' : ''} onClick={() => props.onAuthMode('signup')}>Registruotis</button></div><form className="auth-form" onSubmit={props.onAuth} noValidate><label>El. paštas<input type="email" value={props.email} onChange={(event) => props.onEmail(event.target.value)} required/></label><label>Slaptažodis<input type="password" value={props.password} onChange={(event) => props.onPassword(event.target.value)} minLength={6} required/></label><button className="primary" disabled={props.busyAuth}>{props.authMode === 'login' ? 'Prisijungti' : 'Sukurti paskyrą'}</button></form></> : <p className="muted">Norėdami naudoti paskyras, įrašykite Supabase duomenis į <code>.env.local</code>.</p>}</section><section className="tip"><span>✦ MAŽAS PATARIMAS</span><p>„Mano virtuvė“ produktus serveris saugiai pasiima iš Supabase, kai pritaikote receptą.</p></section></aside>;
}
