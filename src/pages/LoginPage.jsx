import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register(username, password, displayName);
      } else {
        await login(username, password);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-ocean-blue via-indigo-600 to-rose-warm flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-sunset-orange/10 rounded-full translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="w-full max-w-md relative">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/15 backdrop-blur-sm mb-4 shadow-lg">
            <span className="text-4xl">🌅</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Our Adventures</h1>
          <p className="text-white/70 text-sm">Every journey together, remembered forever 💕</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Card header strip */}
          <div className="h-1.5 bg-gradient-to-r from-ocean-teal via-sunset-orange to-rose-warm" />

          <div className="p-8">
            <h2 className="text-xl font-bold text-ocean-dark mb-6 text-center">
              {isRegister ? '✨ Create Your Account' : '👋 Welcome Back'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ocean-teal focus:border-transparent transition-all placeholder-gray-400 text-sm"
                    placeholder="e.g. Alex & Jamie"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ocean-teal focus:border-transparent transition-all placeholder-gray-400 text-sm"
                  placeholder="Enter username"
                  required
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ocean-teal focus:border-transparent transition-all placeholder-gray-400 text-sm"
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                  <span>⚠️</span> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-ocean-blue to-ocean-teal text-white font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md mt-2"
              >
                {loading ? '⏳ Please wait…' : (isRegister ? 'Create Account' : 'Sign In')}
              </button>
            </form>

            <div className="mt-6 text-center border-t border-gray-100 pt-5">
              <button
                onClick={() => { setIsRegister(!isRegister); setError(''); }}
                className="text-sm text-ocean-teal hover:text-ocean-blue transition-colors font-medium"
              >
                {isRegister
                  ? 'Already have an account? Sign in →'
                  : "Don't have an account? Create one →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
