import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register, token, loading: authLoading } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const nextMode = searchParams.get('mode');
    if (nextMode === 'login' || nextMode === 'signup') {
      setMode(nextMode);
    }
  }, [searchParams]);

  useEffect(() => {
    if (token && !authLoading) {
      navigate('/app', { replace: true });
    }
  }, [token, authLoading, navigate]);

  useEffect(() => {
    setError('');
    setForm((prev) => ({
      ...prev,
      password: ''
    }));
  }, [mode]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        await register({
          username: form.username.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password
        });
      } else {
        await login({ email: form.email.trim().toLowerCase(), username: form.email.trim(), password: form.password });
      }
      navigate('/app');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Link to="/" className="back-link">
          Back to start page
        </Link>
        <h1>{mode === 'login' ? 'Welcome Back' : 'Create Your Account'}</h1>
        <p>Factories, recyclers, and industrial buyers can collaborate here.</p>

        {mode === 'signup' && (
          <input
            placeholder="Unique username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />

        {error && <p className="error-text">{error}</p>}

        <button disabled={loading}>{loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Sign Up'}</button>
        <button type="button" className="switch-link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Login'}
        </button>
      </form>
    </main>
  );
}
