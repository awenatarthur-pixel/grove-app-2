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
      .select('pro, pro_plan, stripe_customer_id, sparks')
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

  // Used for perks like "invite a friend" that should grant real Pro status
  // to a signed-in user, not just a local demo flag.
  const grantFreePro = async () => {
    if (!session?.user) return;
    const { error } = await supabase.from('profiles').update({ pro: true }).eq('id', session.user.id);
    if (!error) fetchProfile(session.user.id);
  };

  // Adjusts the real Sparks balance for a signed-in user (positive to add, negative to spend).
  // Never goes below zero.
  const adjustSparks = async (delta) => {
    if (!session?.user) return;
    const current = profile?.sparks || 0;
    const next = Math.max(0, current + delta);
    const { error } = await supabase.from('profiles').update({ sparks: next }).eq('id', session.user.id);
    if (!error) fetchProfile(session.user.id);
  };

  return {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signInWithEmail,
    signOut,
    grantFreePro,
    adjustSparks,
    refreshProfile: () => session?.user && fetchProfile(session.user.id),
  };
}
