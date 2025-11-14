'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Munchie = {
  id: number;
  food_name: string | null;
  rating: number | null;
  description: string | null;
  source_type: string | null;
  created_at: string;
  session_id: number | null;
  strain_name?: string | null;
  product_type?: string | null;
};

type Tab = 'dashboard' | 'new' | 'munchies';

export default function Home() {
  // which tab in the sidebar is active
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // form state
  const [strain, setStrain] = useState('');
  const [productType, setProductType] = useState('Pre-roll');
  const [brand, setBrand] = useState('');
  const [highRating, setHighRating] = useState(4);
  const [foodName, setFoodName] = useState('');
  const [sourceType, setSourceType] = useState('Homemade');
  const [munchieRating, setMunchieRating] = useState(5);
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // all munchies from the database (we'll slice this for "Recent" vs "All")
  const [recentMunchies, setRecentMunchies] = useState<Munchie[]>([]);

  // Load ALL munchies from Supabase when the page loads
  useEffect(() => {
    const loadMunchies = async () => {
      const { data, error } = await supabase
        .from('munchies')
        .select(
          `
          id,
          food_name,
          rating,
          description,
          source_type,
          created_at,
          session_id,
          sessions (
            strain_name,
            product_type
          )
        `
        )
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Supabase load error:', error);
        return;
      }

      const mapped =
        data?.map((row: any) => ({
          id: row.id,
          food_name: row.food_name,
          rating: row.rating,
          description: row.description,
          source_type: row.source_type,
          created_at: row.created_at,
          session_id: row.session_id,
          strain_name: row.sessions?.strain_name ?? null,
          product_type: row.sessions?.product_type ?? null,
        })) ?? [];

      setRecentMunchies(mapped);
    };

    loadMunchies();
  }, []);

  // Save a new session + munchie
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      // 1) create session row
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          strain_name: strain || null,
          product_type: productType || null,
          brand: brand || null,
          high_rating: highRating || null,
        })
        .select('id')
        .single();

      if (sessionError || !sessionData) {
        console.log('Session insert error:', sessionError, sessionData);
        setMessage('Error saving session.');
        setIsSaving(false);
        return;
      }

      const sessionId = sessionData.id;

      // 2) create munchie row
      const { data: munchieData, error: munchieError } = await supabase
        .from('munchies')
        .insert({
          session_id: sessionId,
          food_name: foodName || null,
          source_type: sourceType || null,
          rating: munchieRating || null,
          description: description || null,
        })
        .select('*')
        .single();

      if (munchieError || !munchieData) {
        console.log('Munchie insert error:', munchieError, munchieData);
        setMessage('Error saving munchie.');
        setIsSaving(false);
        return;
      }

      // add new munchie to the top of the list so it shows immediately
      setRecentMunchies((prev) => [
        {
          id: munchieData.id,
          food_name: munchieData.food_name,
          rating: munchieData.rating,
          description: munchieData.description,
          source_type: munchieData.source_type,
          created_at: munchieData.created_at,
          session_id: munchieData.session_id,
          strain_name: strain || null,
          product_type: productType || null,
        },
        ...prev,
      ]);

      // Reset form
      setStrain('');
      setProductType('Pre-roll');
      setBrand('');
      setHighRating(4);
      setFoodName('');
      setSourceType('Homemade');
      setMunchieRating(5);
      setDescription('');

      setMessage('Session saved ✅');
    } catch (err) {
      console.log('Unhandled error in handleSubmit:', err);
      setMessage('Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- Small helper render functions ----------

  const renderForm = () => (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6"
    >
      <h2 className="text-lg font-semibold mb-2">Quick log</h2>
      <p className="text-xs text-slate-400 mb-4">
        Save what you smoked and what you ate.
      </p>

      <div className="grid md:grid-cols-[1.3fr,0.7fr] gap-4">
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">
              Strain
            </label>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="e.g. GMO Cookies"
              value={strain}
              onChange={(e) => setStrain(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">
              Brand / dispo
            </label>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="e.g. Sunnyside, RISE"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">
              What did you eat?
            </label>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="e.g. spicy ramen w/ crushed takis"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">
              Why was it hitting?
            </label>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Texture, flavors, how it felt while high..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">
              Product type
            </label>
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
            >
              <option>Pre-roll</option>
              <option>Flower</option>
              <option>Cart</option>
              <option>Edible</option>
              <option>Dab</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">
              High rating
            </label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Lowkey</span>
              <input
                type="range"
                min={1}
                max={5}
                value={highRating}
                onChange={(e) => setHighRating(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs text-slate-400">Galactic</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">
              Source
            </label>
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
            >
              <option>Homemade</option>
              <option>Fast food</option>
              <option>Restaurant</option>
              <option>Gas station</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">
              Munchie rating
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setMunchieRating(star)}
                  className={`h-9 w-9 rounded-full flex items-center justify-center border text-lg ${
                    star <= munchieRating
                      ? 'bg-emerald-400 text-slate-950 border-emerald-400'
                      : 'bg-slate-900 text-slate-500 border-slate-700'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className="w-full mt-4 rounded-xl bg-emerald-500 text-slate-950 font-semibold py-3 text-sm disabled:opacity-60"
      >
        {isSaving ? 'Saving…' : 'Save session'}
      </button>

      {message && (
        <p className="text-xs text-slate-300 mt-2">
          {message}
        </p>
      )}
    </form>
  );

  const renderRecent = () => {
    const lastFive = recentMunchies.slice(0, 5);

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-2">Recent munchies</h2>
        <p className="text-xs text-slate-400 mb-4">
          Your last few legendary combos.
        </p>

        {lastFive.length === 0 && (
          <p className="text-xs text-slate-500">No munchies logged yet.</p>
        )}

        <div className="space-y-4">
          {lastFive.map((m) => (
            <div
              key={m.id}
              className="border border-slate-800 rounded-xl px-4 py-3 text-sm"
            >
              <div className="flex justify-between items-center mb-1">
                <div className="uppercase text-[11px] tracking-[0.16em] text-slate-400">
                  {m.strain_name || 'Unknown strain'} · {m.product_type || '?'}
                </div>
                <div className="text-amber-300 text-xs">
                  {'★'.repeat(m.rating ?? 0)}
                </div>
              </div>
              <div className="font-medium">
                {m.food_name || 'Unknown food'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {m.source_type || 'Unknown source'}
              </div>
              {m.description && (
                <p className="text-xs text-slate-300 mt-2 line-clamp-3">
                  {m.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAllMunchies = () => {
    if (recentMunchies.length === 0) {
      return (
        <p className="text-sm text-slate-400">
          No munchies logged yet. Save your first session from the Dashboard tab.
        </p>
      );
    }

    return (
      <div className="space-y-3">
        {recentMunchies.map((m) => (
          <div
            key={m.id}
            className="border border-slate-800 rounded-xl px-4 py-3 text-sm bg-slate-900/60"
          >
            <div className="flex justify-between items-center mb-1">
              <div className="uppercase text-[11px] tracking-[0.16em] text-slate-400">
                {m.strain_name || 'Unknown strain'} · {m.product_type || '?'}
              </div>
              <div className="text-amber-300 text-xs">
                {m.rating ? '★'.repeat(m.rating) : ''}
              </div>
            </div>
            <div className="font-medium">
              {m.food_name || 'Unknown food'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {m.source_type || 'Unknown source'} ·{' '}
              {new Date(m.created_at).toLocaleString()}
            </div>
            {m.description && (
              <p className="text-xs text-slate-300 mt-2">{m.description}</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  // ---------- MAIN LAYOUT ----------

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-900 px-4 py-6 flex flex-col gap-6">
        <div>
          <div className="text-left font-bold tracking-tight text-xl mb-1">
            🍔 Munchboxd
          </div>
          <p className="text-xs text-slate-400">
            Letterboxd for munchies. Log your combos & see them all.
          </p>
        </div>

        <nav className="flex flex-col gap-2 text-sm">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`text-left px-3 py-2 rounded-lg ${
              activeTab === 'dashboard'
                ? 'bg-slate-800 text-emerald-300'
                : 'text-slate-300 hover:bg-slate-900'
            }`}
          >
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab('new')}
            className={`text-left px-3 py-2 rounded-lg ${
              activeTab === 'new'
                ? 'bg-slate-800 text-emerald-300'
                : 'text-slate-300 hover:bg-slate-900'
            }`}
          >
            Log new session
          </button>

          <button
            onClick={() => setActiveTab('munchies')}
            className={`text-left px-3 py-2 rounded-lg ${
              activeTab === 'munchies'
                ? 'bg-slate-800 text-emerald-300'
                : 'text-slate-300 hover:bg-slate-900'
            }`}
          >
            My munchies (all logs)
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 px-10 py-10">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-8">
            {renderForm()}
            {renderRecent()}
          </div>
        )}

        {activeTab === 'new' && (
          <div className="max-w-3xl">
            {renderForm()}
          </div>
        )}

        {activeTab === 'munchies' && (
          <div className="max-w-4xl">
            <h2 className="text-lg font-semibold mb-4">All munchies</h2>
            {renderAllMunchies()}
          </div>
        )}
      </main>
    </div>
  );
}