import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('zw_token'));
  const [user, setUser] = useState(null);
  const [pendingUpgrade, setPendingUpgrade] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  const syncUser = async () => {
    if (!localStorage.getItem('zw_token')) {
      setLoading(false);
      return;
    }

    try {
      const data = await api('/auth/me');
      setUser(data.user);
      setPendingUpgrade(data.pendingUpgrade);
    } catch (_error) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncUser();
  }, []);

  const persistAuth = (authToken, nextUser) => {
    localStorage.setItem('zw_token', authToken);
    setToken(authToken);
    setUser(nextUser);
  };

  const login = async (payload) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    persistAuth(data.token, data.user);
    await syncUser();
  };

  const register = async (payload) => {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    persistAuth(data.token, data.user);
    await syncUser();
  };

  const logout = () => {
    localStorage.removeItem('zw_token');
    setToken(null);
    setUser(null);
    setPendingUpgrade(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        pendingUpgrade,
        setUser,
        setPendingUpgrade,
        login,
        register,
        logout,
        syncUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

