import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, KeyRound, Lock, AlertCircle, ArrowRight, UserCheck, Eye } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@ricoz.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.message || 'Invalid credentials');
      }
    } catch {
      setError('An unexpected error occurred during sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const setDemoAccount = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100 px-4 py-12 relative overflow-hidden">
      {/* Background Decorative Lighting Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 space-y-8">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/25 mb-1">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            RicozEndpoint
          </h1>
          <p className="text-sm text-slate-400">
            Enterprise Endpoint Discovery & Management Dashboard
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl space-y-6">
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Administrator Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ricoz.local"
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Fill Demo Roles */}
          <div className="pt-4 border-t border-slate-800/80 space-y-3">
            <span className="block text-xs font-medium text-slate-500 text-center uppercase tracking-wider">
              Quick Login Accounts (Demo Roles)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDemoAccount('admin@ricoz.local', 'admin123')}
                className={`flex flex-col items-center p-2.5 rounded-xl border text-xs font-medium transition ${
                  email === 'admin@ricoz.local'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <Shield className="w-4 h-4 mb-1 text-blue-400" />
                <span>Super Admin</span>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('operator@ricoz.local', 'operator123')}
                className={`flex flex-col items-center p-2.5 rounded-xl border text-xs font-medium transition ${
                  email === 'operator@ricoz.local'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <UserCheck className="w-4 h-4 mb-1 text-indigo-400" />
                <span>IT Operator</span>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('viewer@ricoz.local', 'viewer123')}
                className={`flex flex-col items-center p-2.5 rounded-xl border text-xs font-medium transition ${
                  email === 'viewer@ricoz.local'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <Eye className="w-4 h-4 mb-1 text-emerald-400" />
                <span>Viewer</span>
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-slate-600">
          RicozEndpoint v0.1.0 • Enterprise Security Platform
        </div>
      </div>
    </div>
  );
}
