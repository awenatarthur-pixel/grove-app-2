import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Tracks the current Supabase auth session, and the user's Pro status
// from the `profiles` table. Re-fetches the profile whenever the session
// changes (e.g. right after a successful Stripe checkout redirect).
export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId) => {
    if (!userId) { setProfile(null); return; }
    const { data, error } = await supabase
      .from('profiles')
      .select('pro, pro_plan, stripe_customer_id, sparks, flowers, dragon_placed, referred_by')
      .eq('id', userId)
      .single();
    if (!error) setProfile(data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) fetchProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) fetchProfile(newSession.user.id);
      else setProfile(null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error };
  };

  const signOut = () => supabase.auth.signOut();

  // The browser can no longer write to the profiles table (Pro, Sparks and dragons are
  // server-controlled). Dragon changes go through /api/dragon, which checks the rules.
  const adjustFlowers = async (delta) => {
    if (!session?.access_token) return false;
    try {
      const res = await fetch('/api/dragon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: delta < 0 ? 'place' : 'remove' }),
      });
      const data = await res.json();
      if (data.success) { await fetchProfile(session.user.id); return true; }
    } catch (err) {}
    return false;
  };

  // Sparks are switched off for launch; kept as a harmless no-op so nothing can write them from the browser.
  const adjustSparks = async () => {};
  const grantFreePro = async () => {};

  return {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signInWithEmail,
    signOut,
    grantFreePro,
    adjustSparks,
    adjustFlowers,
    refreshProfile: () => session?.user && fetchProfile(session.user.id),
  };
}
