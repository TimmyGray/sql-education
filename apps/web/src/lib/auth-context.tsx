"use client";

import * as React from "react";
import type { User } from "@sql-edu/contracts";
import {
  tokenStore,
  setAuthFailureHandler,
  setTokenRefreshedHandler,
} from "./api-client";
import * as authApi from "./api/auth";

/**
 * Auth context.
 *
 * Holds the current `user` and `accessToken` IN MEMORY (never localStorage).
 * On mount it performs a SILENT refresh against the httpOnly cookie so a page
 * reload keeps the session: POST /auth/refresh; on 200, store the token + GET
 * /auth/me to hydrate the user; on failure, stay logged out.
 *
 * The async methods (login/register/activate/...) wrap the typed auth API and
 * keep the in-memory auth state in sync. They throw `ApiError` on failure so
 * callers can branch on `.status` (e.g. 403 PENDING -> /activate).
 */
export interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  /** True while the initial silent-refresh bootstrap is running. */
  isBootstrapping: boolean;
  /** Set the authenticated user + access token (also updates the tokenStore). */
  setAuth: (user: User | null, accessToken: string | null) => void;
  /** Clear all auth state (also clears the tokenStore). */
  clearAuth: () => void;
  /** POST /auth/login then hydrate the user. Throws ApiError on failure. */
  login: (email: string, password: string) => Promise<User>;
  /** POST /auth/register. Does not authenticate (account is PENDING). */
  register: (
    email: string,
    password: string,
    confirmPassword: string,
  ) => Promise<void>;
  /** POST /auth/activate then hydrate the user. Throws ApiError on failure. */
  activate: (email: string, code: string) => Promise<User>;
  /** POST /auth/resend-code. Throws ApiError (e.g. 429 cooldown). */
  resendCode: (email: string) => Promise<void>;
  /** POST /auth/logout and clear local auth state (best-effort network call). */
  logout: () => Promise<void>;
  /** PATCH /users/me and update the cached user. */
  updateProfile: (displayName: string) => Promise<User>;
  /** GET /auth/me and refresh the cached user. */
  refreshUser: () => Promise<User>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [user, setUser] = React.useState<User | null>(null);
  const [accessToken, setAccessToken] = React.useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = React.useState(true);

  const setAuth = React.useCallback(
    (nextUser: User | null, nextToken: string | null): void => {
      setUser(nextUser);
      setAccessToken(nextToken);
      tokenStore.set(nextToken);
    },
    [],
  );

  const clearAuth = React.useCallback((): void => {
    setUser(null);
    setAccessToken(null);
    tokenStore.clear();
  }, []);

  // Wire the api-client seams to React state so background token refreshes and
  // refresh failures (triggered deep inside request<T>()) reflect in the UI.
  React.useEffect(() => {
    setAuthFailureHandler(() => {
      clearAuth();
    });
    setTokenRefreshedHandler((nextToken) => {
      setAccessToken(nextToken);
    });
    return () => {
      setAuthFailureHandler(null);
      setTokenRefreshedHandler(null);
    };
  }, [clearAuth]);

  // Silent refresh on mount: revive the session from the httpOnly cookie.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tokens = await authApi.refresh();
        if (cancelled) return;
        tokenStore.set(tokens.accessToken);
        const me = await authApi.getMe();
        if (cancelled) return;
        setUser(me);
        setAccessToken(tokens.accessToken);
      } catch {
        // No valid refresh cookie — remain logged out.
        if (!cancelled) {
          clearAuth();
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearAuth]);

  const login = React.useCallback(
    async (email: string, password: string): Promise<User> => {
      const tokens = await authApi.login({ email, password });
      tokenStore.set(tokens.accessToken);
      const me = await authApi.getMe();
      setAuth(me, tokens.accessToken);
      return me;
    },
    [setAuth],
  );

  const register = React.useCallback(
    async (
      email: string,
      password: string,
      confirmPassword: string,
    ): Promise<void> => {
      await authApi.register({ email, password, confirmPassword });
    },
    [],
  );

  const activate = React.useCallback(
    async (email: string, code: string): Promise<User> => {
      const tokens = await authApi.activate({ email, code });
      tokenStore.set(tokens.accessToken);
      const me = await authApi.getMe();
      setAuth(me, tokens.accessToken);
      return me;
    },
    [setAuth],
  );

  const resendCode = React.useCallback(
    async (email: string): Promise<void> => {
      await authApi.resendCode({ email });
    },
    [],
  );

  const logout = React.useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Even if the server call fails, drop local auth so the user is logged out.
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  const updateProfile = React.useCallback(
    async (displayName: string): Promise<User> => {
      const updated = await authApi.updateProfile({ displayName });
      setUser(updated);
      return updated;
    },
    [],
  );

  const refreshUser = React.useCallback(async (): Promise<User> => {
    const me = await authApi.getMe();
    setUser(me);
    return me;
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isBootstrapping,
      setAuth,
      clearAuth,
      login,
      register,
      activate,
      resendCode,
      logout,
      updateProfile,
      refreshUser,
    }),
    [
      user,
      accessToken,
      isBootstrapping,
      setAuth,
      clearAuth,
      login,
      register,
      activate,
      resendCode,
      logout,
      updateProfile,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
