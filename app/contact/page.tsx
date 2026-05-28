'use client';

import { useState } from 'react';
import Link from 'next/link';
import Wordmark from '@/app/components/landing/Wordmark';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }
      setStatus('sent');
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setStatus('error');
    }
  }

  const inputStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    borderRadius: '0.75rem',
    padding: '0.625rem 1rem',
    fontSize: '0.875rem',
    width: '100%',
    outline: 'none',
  } as React.CSSProperties;

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <nav
        className="sticky top-0 z-20 backdrop-blur"
        style={{
          background: 'color-mix(in srgb, var(--bg) 80%, transparent)',
          borderBottom: '1px solid rgba(226, 75, 74, 0.22)',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center">
            <Wordmark size={28} />
          </Link>
          <Link
            href="/settings"
            aria-label="Close"
            className="flex items-center justify-center rounded-full w-8 h-8 transition-colors"
            style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex items-start justify-center px-6 py-16">
        <div className="w-full max-w-lg">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
              Contact us
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              Have feedback, a question, or found a bug? We'd love to hear from you.
            </p>
          </div>

          {status === 'sent' ? (
            <div
              className="rounded-2xl px-6 py-8 text-center"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              <div className="text-2xl mb-2">✓</div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
                Message sent
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                Thanks, we'll get back to you at {email}.
              </p>
              <button
                type="button"
                onClick={() => { setStatus('idle'); setName(''); setEmail(''); setMessage(''); }}
                className="mt-5 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                style={{ background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                Send another
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl px-6 py-6 space-y-4"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#E24B4A'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#E24B4A'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What's on your mind?"
                  required
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '120px' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#E24B4A'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                />
              </div>

              {status === 'error' && (
                <p className="text-sm" style={{ color: '#E24B4A' }}>{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(to right, #E24B4A, #D85A30)' }}
              >
                {status === 'sending' ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}

          <p className="mt-4 text-center text-xs" style={{ color: 'var(--text-dim)' }}>
            Or email us directly at{' '}
            <a
              href="mailto:hello@thecrawli.com"
              className="underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              hello@thecrawli.com
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
