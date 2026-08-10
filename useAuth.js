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
      .select('pro, pro_plan')
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
 
  return {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signInWithEmail,
    signOut,
    refreshProfile: () => session?.user && fetchProfile(session.user.id),
  };
}
 