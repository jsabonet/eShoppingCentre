'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useChat } from '@/src/contexts/ChatContext';
import { useAuth } from '@/src/hooks/useAuth';

interface ChatButtonProps {
  storeId: string;
  storeName: string;
  subject: string;
  productId?: string;
  orderId?: string;
  className?: string;
  variant?: 'button' | 'link';
}

export default function ChatButton({ storeId, storeName, subject, productId, orderId, className = '', variant = 'button' }: ChatButtonProps) {
  const { startConversation, setOpenWidget, fetchConversations } = useChat();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(false);

  const handleClick = async () => {
    if (!user) {
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      return;
    }
    setLoading(true);
    try {
      // Find existing conversation for this store
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/chat/`, {
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('access_token') ? { Authorization: `Bearer ${localStorage.getItem('access_token')}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        const conversations = data.results || data || [];
        // Look for existing conversation with this store
        const existing = conversations.find((c: any) => c.store_name === storeName);
        if (existing) {
          // Open widget directly into this conversation (not the list)
          setOpenWidget(true);
          // Dispatch event to select this conversation
          window.dispatchEvent(new CustomEvent('select-chat-conversation', { detail: existing.id }));
          return;
        }
      }
      // Start new conversation
      const conv = await startConversation(storeId, subject, '', productId, orderId);
      if (conv) {
        setOpenWidget(true);
        // Auto-select the new conversation
        window.dispatchEvent(new CustomEvent('select-chat-conversation', { detail: conv.id }));
      }
      fetchConversations();
    } catch {} finally { setLoading(false); }
  };

  if (variant === 'link') {
    return (
      <button onClick={handleClick} disabled={loading} className={`text-accent hover:underline text-sm flex items-center gap-1 ${className}`}>
        <MessageCircle size={14} />
        {loading ? 'A iniciar...' : 'Falar com o Vendedor'}
      </button>
    );
  }

  return (
    <button onClick={handleClick} disabled={loading}
      className={`px-4 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors flex items-center gap-2 disabled:opacity-50 ${className}`}>
      <MessageCircle size={18} />
      {loading ? 'A iniciar...' : 'Falar com o Vendedor'}
    </button>
  );
}
