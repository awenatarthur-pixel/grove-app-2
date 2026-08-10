import React, { useState } from 'react';

// Drop this into the Plans page (or wherever you want sign-in to live).
// Pass in the useAuth() hook's values as props.
export default function AuthPanel({ user, signInWithEmail, signOut }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    setError(null);
    const { error } = await signInWithEmail(email.trim());
    setSending(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  if (user) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderRadius: 12, background: 'var(--parchment-100)',
        fontFamily: "'Manrope', sans-serif", fontSize: 13, marginBottom: 10,
      }}>
        <span>Signed in as <strong>{user.email}</strong></span>
        <button onClick={signOut} style={{
          border: 'none', background: 'none', color: 'var(--blush-500)', cursor: 'pointer',
          fontWeight: 700, fontSize: 12,
        }}>Sign out</button>
      </div>
    );
  }

  if (sent) {
    return (
      <div style={{
        padding: '12px 14px', borderRadius: 12, background: 'rgba(233,196,106,0.2)',
        fontFamily: "'Manrope', sans-serif", fontSize: 13, marginBottom: 10,
      }}>
        🌱 Check <strong>{email}</strong> for a sign-in link.
      </div>
    );
  }

  return (
    <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      <input
        type="email" value={email} onChange={e => setEmail(e.target.value)}
        placeholder="you@email.com" required
        style={{
          flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--parchment-100)',
          fontFamily: "'Manrope', sans-serif", fontSize: 13, outline: 'none',
        }}
      />
      <button type="submit" disabled={sending} style={{
        padding: '10px 16px', borderRadius: 10, border: 'none', cursor: sending ? 'default' : 'pointer',
        background: 'var(--forest-900)', color: 'var(--gold-500)',
        fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 13,
      }}>{sending ? 'Sending…' : 'Sign in'}</button>
      {error && <div style={{ color: 'var(--blush-500)', fontSize: 12 }}>{error}</div>}
    </form>
  );
}