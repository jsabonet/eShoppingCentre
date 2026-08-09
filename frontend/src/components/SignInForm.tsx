"use client";

import React, { useState } from 'react';
import PasswordInput from './PasswordInput';

export default function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Simulate sign in
      if (!email || !password) {
        setError('Please fill in all fields');
        setIsLoading(false);
        return;
      }

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // In a real app, this would call an authentication API
      localStorage.setItem('user', JSON.stringify({ email, name: email.split('@')[0] }));
      localStorage.setItem('isLoggedIn', 'true');

      // Redirect to home page
      window.location.href = '/';
    } catch (err) {
      setError('Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background rounded-sm border border-border shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h1 className="text-3xl font-semibold">Entrar</h1>
        <p className="text-muted-foreground text-sm mt-2">Aceda à sua conta eShopping Centre</p>
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="your@email.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Password *</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border text-center">
        <p className="text-sm text-muted-foreground mb-2">
          Ainda não tem conta?
        </p>
        <a
          href="/signup"
          className="text-accent font-semibold hover:text-accent/80 transition-colors"
        >
          Criar conta
        </a>
      </div>
    </div>
  );
}
