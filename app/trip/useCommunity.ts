"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Bbox } from "@/src/domain/community/geo";
import type { PresenceInput, PublicPresence } from "@/src/domain/community/presence";

export type CommunityUser = {
  uid: string;
  handle: string;
  isLocalGuide: boolean;
  guideAreas?: string[];
};

type ApiError = { error?: string };

async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

/**
 * Community client: who am I, sign-in via email code, and presence load/post/delete.
 * Cookies are same-origin so the session rides along automatically.
 */
export function useCommunity() {
  const [user, setUser] = useState<CommunityUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [presences, setPresences] = useState<PublicPresence[]>([]);
  const [loadingPresences, setLoadingPresences] = useState(false);
  const presenceAbortRef = useRef<AbortController | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      const res = await fetch("/api/community/auth/me");
      const json = (await res.json()) as { user: CommunityUser | null };
      setUser(json.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    // Async fetch sets state after the network resolves, not synchronously.
    void refreshMe(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [refreshMe]);

  const requestCode = useCallback(async (email: string): Promise<{ ok: boolean; error?: string }> => {
    const { ok, data } = await postJson<ApiError>("/api/community/auth/request-code", { email });
    return ok ? { ok: true } : { ok: false, error: data.error ?? "Couldn't send the code." };
  }, []);

  const verifyCode = useCallback(
    async (email: string, code: string): Promise<{ ok: boolean; error?: string }> => {
      const { ok, data } = await postJson<{ user?: CommunityUser } & ApiError>(
        "/api/community/auth/verify",
        { email, code }
      );
      if (ok && data.user) {
        setUser(data.user);
        return { ok: true };
      }
      return { ok: false, error: data.error ?? "Couldn't verify that code." };
    },
    []
  );

  const logout = useCallback(async () => {
    await fetch("/api/community/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  const loadPresences = useCallback(async (bbox: Bbox) => {
    presenceAbortRef.current?.abort();
    const ac = new AbortController();
    presenceAbortRef.current = ac;
    setLoadingPresences(true);
    try {
      const q = `bbox=${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
      const res = await fetch(`/api/community/presence?${q}`, { signal: ac.signal });
      const json = (await res.json()) as { presences?: PublicPresence[] };
      if (!ac.signal.aborted) setPresences(json.presences ?? []);
    } catch {
      if (!ac.signal.aborted) setPresences([]);
    } finally {
      if (!ac.signal.aborted) setLoadingPresences(false);
    }
  }, []);

  const clearPresences = useCallback(() => {
    presenceAbortRef.current?.abort();
    setPresences([]);
  }, []);

  const postPresence = useCallback(
    async (input: PresenceInput): Promise<{ ok: boolean; error?: string; presence?: PublicPresence }> => {
      const { ok, status, data } = await postJson<{ presence?: PublicPresence } & ApiError>(
        "/api/community/presence",
        input
      );
      if (ok && data.presence) {
        setPresences((prev) => [data.presence as PublicPresence, ...prev]);
        return { ok: true, presence: data.presence };
      }
      if (status === 401) return { ok: false, error: "Sign in to post." };
      return { ok: false, error: data.error ?? "Couldn't post that." };
    },
    []
  );

  const deletePresence = useCallback(async (id: string): Promise<boolean> => {
    const res = await fetch(`/api/community/presence/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPresences((prev) => prev.filter((p) => p.id !== id));
      return true;
    }
    return false;
  }, []);

  return {
    user,
    authReady,
    presences,
    loadingPresences,
    refreshMe,
    requestCode,
    verifyCode,
    logout,
    loadPresences,
    clearPresences,
    postPresence,
    deletePresence,
  };
}
