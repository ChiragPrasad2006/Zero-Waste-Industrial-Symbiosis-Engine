import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { login, register } = useAuth();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const copy = useMemo(
    () =>
      mode === 'signup'
        ? {
            title: 'Create your exchange account',
            submit: 'Create Account',
            switchText: 'Already have an account?',
            switchAction: 'Login'
          }
        : {
            title: 'Welcome back',
            submit: 'Login',
            switchText: 'New to ZeroWaste?',
            switchAction: 'Create account'
          },
    [mode]
  );

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const switchMode = () => {
    const nextMode = mode === 'login' ? 'signup' : 'login';
    setMode(nextMode);
    setSearchParams({ mode: nextMode });
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (mode === 'signup') {
        await register({
          username: form.username,
          email: form.email,
          password: form.password
        });
      } else {
        await login({
          email: form.email,
          password: form.password
        });
      }
      navigate('/app', { replace: true });
    } catch (authError) {
      setError(authError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link to="/" className="back-link">
          Back to home
        </Link>
        <h1>{copy.title}</h1>
        <form onSubmit={submit}>
          {mode === 'signup' && <input placeholder="Username" value={form.username} onChange={updateField('username')} minLength="3" required />}
          <input type="email" placeholder="Email" value={form.email} onChange={updateField('email')} required />
          <input type="password" placeholder="Password" value={form.password} onChange={updateField('password')} minLength="6" required />
          {error && <p className="error-text">{error}</p>}
          <button disabled={saving}>{saving ? 'Please wait...' : copy.submit}</button>
        </form>
        <p>
          {copy.switchText}{' '}
          <button type="button" className="switch-link" onClick={switchMode}>
            {copy.switchAction}
          </button>
        </p>
      </section>
    </main>
  );
}
