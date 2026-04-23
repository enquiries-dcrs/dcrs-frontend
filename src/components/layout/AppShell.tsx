'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import Header from '@/components/Header';
import { useGlobalStore } from '@/store/useGlobalStore';
import { createClient } from '@supabase/supabase-js';
import { api } from '@/lib/api';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

function isPublicPath(path: string | null): boolean {
  if (!path) return false;
  if (path === '/' || path === '/family') return true;
  if (path.startsWith('/auth')) return true;
  return false;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isAuthenticated = useGlobalStore((state) => state.isAuthenticated);
  const login = useGlobalStore((state) => state.login);
  const logout = useGlobalStore((state) => state.logout);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    let mounted = true;

    const verifySecureSession = async () => {
      if (!supabase) {
        if (mounted) setIsVerifyingSession(false);
        return;
      }

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error || !session) {
        if (isAuthenticated) logout();
        if (!isPublicPath(pathname)) router.push('/');
      } else if (!isAuthenticated && session) {
        try {
          const { data: me } = await api.get<{
            email: string;
            first_name: string | null;
            last_name: string | null;
            system_role: string;
          }>('/api/v1/auth/me');
          const displayName =
            `${me.first_name ?? ''} ${me.last_name ?? ''}`.trim() || me.email;
          login({
            name: displayName,
            email: me.email,
            role: me.system_role,
          });
        } catch {
          await supabase.auth.signOut();
          if (!isPublicPath(pathname)) router.push('/');
        }
      }

      setIsVerifyingSession(false);
    };

    void verifySecureSession();

    if (!supabase) {
      return () => {
        mounted = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        logout();
        router.push('/');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, isAuthenticated, login, logout, router]);

  if (isVerifyingSession && !isPublicPath(pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Verifying secure session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isPublicPath(pathname)) return null;

  if (pathname === '/') return <>{children}</>;

  if (pathname === '/family') return <>{children}</>;

  return (
    <div className="flex min-h-screen overflow-hidden bg-slate-50 font-sans text-gray-900">
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar />
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="z-30 flex shrink-0 items-center bg-[#1e293b] p-3 text-white shadow-md md:hidden">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="rounded p-1 hover:bg-slate-700 focus:outline-none"
          >
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-3 text-lg font-semibold tracking-wide">Menu</span>
        </div>

        <Header />

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
