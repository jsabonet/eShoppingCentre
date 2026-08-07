'use client';

import {
  createContext, useContext, useState, useEffect, useCallback,
  type ReactNode,
} from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface LastMessage {
  body: string;
  sender_name: string;
  created_at: string;
}

export interface ConversationData {
  id: string;
  subject: string;
  store_name: string;
  store_slug: string;
  buyer_name: string;
  seller_name: string;
  product_name: string | null;
  product_slug: string | null;
  order_id: string | null;
  last_message: LastMessage | null;
  unread_count: number;
  is_archived_by_buyer: boolean;
  is_archived_by_seller: boolean;
  last_message_at: string;
  created_at: string;
}

export interface MessageData {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  attachment: string | null;
  is_read: boolean;
  is_mine: boolean;
  created_at: string;
}

interface ChatContextType {
  conversations: ConversationData[];
  unreadTotal: number;
  loading: boolean;
  openWidget: boolean;
  setOpenWidget: (v: boolean) => void;
  startConversation: (storeId: string, subject: string, body: string, productId?: string, orderId?: string) => Promise<ConversationData | null>;
  fetchConversations: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  sendMessage: (conversationId: string, body: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

function headers() {
  const tok = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
  };
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [openWidget, setOpenWidget] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/chat/`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        const list = data.results || data || [];
        setConversations(list);
        setUnreadTotal(list.reduce((sum: number, c: ConversationData) => sum + (c.unread_count || 0), 0));
      }
    } catch {} finally { setLoading(false); }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/chat/unread-count/`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setUnreadTotal(data.unread_count || 0);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Poll unread count every 30s
  useEffect(() => {
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const startConversation = useCallback(async (
    storeId: string, subject: string, body: string,
    productId?: string, orderId?: string,
  ): Promise<ConversationData | null> => {
    try {
      const payload: Record<string, string> = { store_id: storeId, subject, body };
      if (productId) payload.product_id = productId;
      if (orderId) payload.order_id = orderId;
      const res = await fetch(`${API_URL}/chat/`, {
        method: 'POST', headers: headers(), body: JSON.stringify(payload),
      });
      if (res.ok) {
        const conv = await res.json();
        await fetchConversations();
        return conv;
      }
    } catch {}
    return null;
  }, [fetchConversations]);

  const sendMessage = useCallback(async (conversationId: string, body: string) => {
    try {
      const res = await fetch(`${API_URL}/chat/${conversationId}/messages/`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error('Erro ao enviar');
    } catch { throw new Error('Erro ao enviar mensagem.'); }
  }, []);

  return (
    <ChatContext.Provider value={{
      conversations, unreadTotal, loading, openWidget, setOpenWidget,
      startConversation, fetchConversations, fetchUnreadCount, sendMessage,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
