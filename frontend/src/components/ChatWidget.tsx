'use client';

import { useState, useEffect, useRef } from 'react';
import { X, MessageCircle, Send, ChevronLeft, Paperclip } from 'lucide-react';
import { useChat, type ConversationData, type MessageData } from '@/src/contexts/ChatContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

function headers() {
  const tok = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
  };
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Agora';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return d.toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short' });
}

export default function ChatWidget() {
  const { conversations, unreadTotal, loading, openWidget, setOpenWidget, sendMessage, fetchConversations } = useChat();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find(c => c.id === activeConvId) || null;

  // Fetch messages when entering a conversation
  useEffect(() => {
    if (!activeConvId) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/chat/${activeConvId}/`, { headers: headers() });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch {}
    })();
  }, [activeConvId]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll messages every 30s
  useEffect(() => {
    if (!activeConvId) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/chat/${activeConvId}/`, { headers: headers() });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
          fetchConversations();
        }
      } catch {}
    }, 30000);
    return () => clearInterval(iv);
  }, [activeConvId, fetchConversations]);

  const handleSend = async () => {
    if (!input.trim() || !activeConvId || sending) return;
    setSending(true);
    try {
      await sendMessage(activeConvId, input.trim());
      setInput('');
      // Refresh messages
      const res = await fetch(`${API_URL}/chat/${activeConvId}/`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        fetchConversations();
      }
    } catch {} finally { setSending(false); }
  };

  const formatMsgTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' });
  };

  if (!openWidget) return null;

  return (
    <div className="fixed bottom-0 right-4 w-full max-w-md z-50 flex flex-col bg-card border border-border rounded-t-2xl shadow-2xl" style={{ height: 'min(600px, 80vh)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        {activeConv ? (
          <>
            <button onClick={() => setActiveConvId(null)} className="p-1 hover:bg-muted rounded">
              <ChevronLeft size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{activeConv.subject}</p>
              <p className="text-xs text-muted-foreground">{activeConv.store_name}</p>
            </div>
          </>
        ) : (
          <>
            <MessageCircle size={18} className="text-accent" />
            <span className="font-bold flex-1">Mensagens</span>
            {unreadTotal > 0 && (
              <span className="bg-accent text-accent-foreground text-xs px-2 py-0.5 rounded-full">{unreadTotal}</span>
            )}
          </>
        )}
        <button onClick={() => setOpenWidget(false)} className="p-1 hover:bg-muted rounded">
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      {!activeConv ? (
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">A carregar...</p>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageCircle size={32} className="mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma conversa.</p>
              <p className="text-xs text-muted-foreground mt-1">Inicie uma conversa a partir de uma loja ou produto.</p>
            </div>
          ) : (
            conversations.map(conv => (
              <button key={conv.id} onClick={() => setActiveConvId(conv.id)}
                className="w-full px-4 py-3 border-b border-border hover:bg-muted/30 text-left transition-colors flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <MessageCircle size={18} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{conv.store_name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      {conv.last_message ? timeAgo(conv.last_message.created_at) : ''}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.last_message?.body || conv.subject}
                  </p>
                </div>
                {conv.unread_count > 0 && (
                  <span className="bg-accent text-accent-foreground text-[10px] px-1.5 py-0.5 rounded-full shrink-0">
                    {conv.unread_count}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  msg.is_mine ? 'bg-accent text-accent-foreground' : 'bg-muted'
                }`}>
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  <div className={`flex items-center gap-1 mt-1 ${msg.is_mine ? 'justify-end' : ''}`}>
                    <span className="text-[10px] opacity-70">{formatMsgTime(msg.created_at)}</span>
                    {msg.is_mine && msg.is_read && <span className="text-[10px] opacity-70">✓✓</span>}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-border flex items-center gap-2 shrink-0">
            <input
              type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Escreva uma mensagem..."
              className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button onClick={handleSend} disabled={!input.trim() || sending}
              className="p-2 bg-accent text-accent-foreground rounded-lg disabled:opacity-40">
              <Send size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
