'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (data.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || 'Authentication failed');
        setPassword('');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ctp-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Eye size={48} className="text-ctp-mauve mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-ctp-text">Overwatch</h1>
          <p className="text-sm text-ctp-overlay1 mt-1">Hermes Agent Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full bg-ctp-surface0/70 border border-ctp-surface1 rounded-lg px-4 py-3 text-sm text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none focus:border-ctp-mauve/50 transition-colors"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-ctp-red text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={!password || loading}
            className="w-full bg-ctp-mauve hover:bg-ctp-mauve disabled:opacity-40 disabled:cursor-not-allowed text-ctp-text font-medium py-3 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
