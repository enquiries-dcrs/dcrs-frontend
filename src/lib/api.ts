/**
 * DCRS Production API Client Wrapper
 * Includes Axios Interceptors to attach the secure Supabase JWT Token
 * to every single outgoing request.
 */
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase to retrieve the active session token
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: The "VIP Pass"
api.interceptors.request.use(
  async (config) => {
    if (supabase) {
      try {
        // Use getSession() as it's faster and pulls from local storage first.
        // If the token is near expiration, Supabase will automatically refresh it here.
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('Supabase Auth Error in Interceptor:', error.message);
        }

        // If we found a valid token, attach it!
        if (session?.access_token) {
          config.headers.Authorization = `Bearer ${session.access_token}`;
        } else {
          console.warn('No active Supabase session found before making API request.');
        }
      } catch (err) {
        console.error('Critical failure retrieving session in interceptor:', err);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
