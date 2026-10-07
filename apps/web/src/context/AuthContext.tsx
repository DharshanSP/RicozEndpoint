import { createContext, useContext, useState, useEffect, type ReactNode, type FC } from 'react';
import { fetchApi, UNAUTHORIZED_EVENT } from '../lib/api';

export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'IT_ADMIN' | 'OPERATOR' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  organizationName?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (payload: RegisterPayload) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  hasMinRole: (minRole: UserRole) => boolean;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; message?: string }>;
  switchOrganization: (
    organizationId: string
  ) => Promise<{ success: boolean; message?: string; organizationName?: string }>;
}

export interface RegisterPayload {
  organizationName: string;
  name: string;
  email: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'ricoz_auth_token';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 5,
  ORG_ADMIN: 4,
  IT_ADMIN: 3,
  OPERATOR: 2,
  VIEWER: 1,
};

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Any 401 from the API clears the session so ProtectedRoute redirects to /login.
  useEffect(() => {
    const onUnauthorized = () => {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // Fetch current user details on startup if token exists
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      const res = await fetchApi<User>('/auth/me');
      if (res.success && res.data) {
        setUser(res.data);
      } else {
        // Token expired or invalid
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
      setIsLoading(false);
    }

    loadUser();
  }, [token]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const res = await fetchApi<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (res.success && res.data) {
      localStorage.setItem(TOKEN_KEY, res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      setIsLoading(false);
      return { success: true };
    } else {
      setIsLoading(false);
      return {
        success: false,
        message: res.error?.message || 'Login failed. Please check your credentials.',
      };
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const register = async (payload: RegisterPayload) => {
    setIsLoading(true);
    const res = await fetchApi<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success && res.data) {
      localStorage.setItem(TOKEN_KEY, res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      setIsLoading(false);
      return { success: true };
    }
    setIsLoading(false);
    return {
      success: false,
      message: res.error?.message || 'Registration failed. Please try again.',
    };
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const res = await fetchApi<{ token: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (res.success && res.data?.token) {
      // Server rotates the session so the user stays signed in after the change.
      localStorage.setItem(TOKEN_KEY, res.data.token);
      setToken(res.data.token);
      return { success: true };
    }

    return {
      success: false,
      message: res.error?.message || 'Failed to change password.',
    };
  };

  const switchOrganization = async (organizationId: string) => {
    const res = await fetchApi<{ token: string; organization: { id: string; name: string } }>(
      '/auth/switch-organization',
      {
        method: 'POST',
        body: JSON.stringify({ organizationId }),
      }
    );

    if (res.success && res.data?.token) {
      localStorage.setItem(TOKEN_KEY, res.data.token);
      setToken(res.data.token);
      // Keep the cached profile in sync so headers and nav reflect the new tenant.
      setUser((prev) =>
        prev
          ? {
              ...prev,
              organizationId: res.data!.organization.id,
              organizationName: res.data!.organization.name,
            }
          : prev
      );
      return {
        success: true,
        organizationName: res.data.organization.name,
      };
    }

    return {
      success: false,
      message: res.error?.message || 'Failed to switch organization.',
    };
  };

  const hasRole = (allowedRoles: UserRole[]) => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return allowedRoles.includes(user.role);
  };

  const hasMinRole = (minRole: UserRole) => {
    if (!user) return false;
    const userWeight = ROLE_HIERARCHY[user.role] ?? 0;
    const minWeight = ROLE_HIERARCHY[minRole] ?? 1;
    return userWeight >= minWeight;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        hasRole,
        hasMinRole,
        changePassword,
        switchOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
