'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import AuthForm from './components/AuthForm';

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
  user_id?: string | null;
  username?: string | null;
};

type Tab = 'dashboard' | 'new' | 'munchies' | 'feed';

export default function Home() {
  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Navigation
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Form state
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

  // Data — all munchies from everyone; filtered per-user where needed
  const [allMunchies, setAllMunchies] = useState<Munchie[]>([]);

  // ---------- Auth ----------

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ---------- Data loading ----------

  useEffect(() => {
    if (!user) return;

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
            product_type,
            user_id,
            profiles (
              username
            )
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
          user_id: row.sessions?.user_id ?? null,
          username: row.sessions?.profiles?.username ?? null,
        })) ?? [];

      setAllMunchies(mapped);
    };

    loadMunchies();
  }, [user]);

  // ---------- Form submit ----------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      // 1) Create session row
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          strain_name: strain || null,
          product_type: productType || null,
          brand: brand || null,
          high_rating: highRating || null,
          user_id: user?.id,
        })
        .select('id')
        .single();

      if (sessionError || !sessionData) {
        console.log('Session insert error:', sessionError);
        setMessage('Error saving session.');
        setIsSaving(false);
        return;
      }

      // 2) Create munchie row
      const { data: munchieData, error: munchieError } = await supabase
        .from('munchies')
        .insert({
          session_id: sessionData.id,
          food_name: foodName || null,
          source_type: sourceType || null,
          rating: munchieRating || null,
          description: description || null,
        })
        .select('*')
        .single();

      if (munchieError || !munchieData) {
        console.log('Munchie insert error:', munchieError);
        setMessage('Error saving munchie.');
        setIsSaving(false);
        return;
      }

      // 3) Optimistically prepend to local state
      const currentUsername = user?.user_metadata?.username ?? null;

      setAllMunchies((prev) => [
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
          user_id: user?.id ?? null,
          username: currentUsername,
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAllMunchies([]);
    setActiveTab('dashboard');
  };

  // ---------- Derived data ----------

  const myMunchies = allMunchies.filter((m) => m.user_id === user?.id);
  const username = user?.user_metadata?.username as string | undefined;

  // ---------- Render helpers ----------

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
        <p className="text-xs text-slate-300 mt-2">{message}</p>
      )}
    </form>
  );

  const renderMunchieCard = (m: Munchie, showUser = false) => (
    <div
      key={m.id}
      className="border border-slate-800 rounded-xl px-4 py-3 text-sm bg-slate-900/60"
    >
      {showUser && m.username && (
        <div className="flex items-center gap-2 mb-2">
          <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-slate-950 shrink-0">
            {m.username[0].toUpperCase()}
          </div>
          <span className="text-xs text-emerald-400 font-medium">@{m.username}</span>
        </div>
      )}
      <div className="flex justify-between items-center mb-1">
        <div className="uppercase text-[11px] tracking-[0.16em] text-slate-400">
          {m.strain_name || 'Unknown strain'} · {m.product_type || '?'}
        </div>
        <div className="text-amber-300 text-xs">
          {m.rating ? '★'.repeat(m.rating) : ''}
        </div>
      </div>
      <div className="font-medium">{m.food_name || 'Unknown food'}</div>
      <div className="text-[11px] text-slate-400 mt-1">
        {m.source_type || 'Unknown source'} ·{' '}
        {new Date(m.created_at).toLocaleString()}
      </div>
      {m.description && (
        <p className="text-xs text-slate-300 mt-2 line-clamp-3">{m.description}</p>
      )}
    </div>
  );

  const renderRecent = () => (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
      <h2 className="text-lg font-semibold mb-2">Recent munchies</h2>
      <p className="text-xs text-slate-400 mb-4">Your last few legendary combos.</p>

      {myMunchies.length === 0 ? (
        <p className="text-xs text-slate-500">No munchies logged yet.</p>
      ) : (
        <div className="space-y-4">
          {myMunchies.slice(0, 5).map((m) => renderMunchieCard(m))}
        </div>
      )}
    </div>
  );

  const renderMyMunchies = () => {
    if (myMunchies.length === 0) {
      return (
        <p className="text-sm text-slate-400">
          No munchies logged yet. Save your first session from the Dashboard tab.
        </p>
      );
    }
    return (
      <div className="space-y-3">{myMunchies.map((m) => renderMunchieCard(m))}</div>
    );
  };

  const renderFeed = () => {
    if (allMunchies.length === 0) {
      return (
        <p className="text-sm text-slate-400">No munchies posted yet. Be the first!</p>
      );
    }
    return (
      <div className="space-y-3">
        {allMunchies.map((m) => renderMunchieCard(m, true))}
      </div>
    );
  };

  // ---------- Auth gates ----------

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  // ---------- Main app ----------

  const navItems: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'new', label: 'Log new session' },
    { id: 'munchies', label: 'My munchies' },
    { id: 'feed', label: '🌍 Public feed' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-900 px-4 py-6 flex flex-col gap-6">
        <div>
          <div className="text-left font-bold tracking-tight text-xl mb-1">
            🍔 Munchboxd
          </div>
          <p className="text-xs text-slate-400">Letterboxd for munchies.</p>
        </div>

        {/* User badge */}
        <div className="flex items-center gap-3 bg-slate-900 rounded-xl px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-sm font-bold text-slate-950 shrink-0">
            {username?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">@{username ?? 'you'}</div>
            <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-2 text-sm">
          {navItems.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`text-left px-3 py-2 rounded-lg ${
                activeTab === id
                  ? 'bg-slate-800 text-emerald-300'
                  : 'text-slate-300 hover:bg-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Sign out at bottom */}
        <div className="mt-auto">
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-900 hover:text-slate-300 text-sm transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 px-10 py-10 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-8">
            {renderForm()}
            {renderRecent()}
          </div>
        )}

        {activeTab === 'new' && (
          <div className="max-w-3xl">{renderForm()}</div>
        )}

        {activeTab === 'munchies' && (
          <div className="max-w-4xl">
            <h2 className="text-lg font-semibold mb-4">My munchies</h2>
            {renderMyMunchies()}
          </div>
        )}

        {activeTab === 'feed' && (
          <div className="max-w-4xl">
            <h2 className="text-lg font-semibold mb-1">Public feed</h2>
            <p className="text-xs text-slate-400 mb-4">Everyone&apos;s legendary combos.</p>
            {renderFeed()}
          </div>
        )}
      </main>
    </div>
  );
}
