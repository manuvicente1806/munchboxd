'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type AuthMode = 'login' | 'register';

export default function AuthForm() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setMessage(null);
    setIsError(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setIsError(false);

    if (mode === 'register') {
      // Check if username is already taken before attempting signup
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .maybeSingle();

      if (existing) {
        setIsError(true);
        setMessage('Username is already taken. Try another.');
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username: username.toLowerCase() },
        },
      });

      if (error) {
        setIsError(true);
        setMessage(error.message);
      } else {
        setMessage(
          'Account created! If email confirmation is required, check your inbox before logging in.'
        );
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setIsError(true);
        setMessage(error.message);
      }
      // On success, onAuthStateChange in page.tsx handles the redirect automatically
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">🍔 Munchboxd</h1>
          <p className="text-slate-400 text-sm">Letterboxd for munchies. Log your combos.</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-lg">
          {/* Mode toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'login'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Log in
            </button>
            <button
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'register'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">
                  Username
                </label>
                <input
                  required
                  autoComplete="username"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="munchmaster420"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))
                  }
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">
                Email
              </label>
              <input
                required
                type="email"
                autoComplete="email"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">
                Password
              </label>
              <input
                required
                type="password"
                minLength={6}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 rounded-xl bg-emerald-500 text-slate-950 font-semibold py-3 text-sm disabled:opacity-60"
            >
              {loading ? 'Loading…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>

          {message && (
            <p
              className={`text-xs mt-4 text-center ${
                isError ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
