'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, Send, ChevronRight, X } from 'lucide-react';
import AccountLayout from '@/src/components/AccountLayout';
import { useChat, type MessageData } from '@/src/contexts/ChatContext';
import LoadingSpinner from '@/src/components/LoadingSpinner';

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

export default function AccountMessagesPage() {
  const { conversations, loading, sendMessage, fetchConversations } = useChat();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find(c => c.id === activeConvId) || null;

  useEffect(() => {
    if (!activeConvId) return;
    (async () => {
      const res = await fetch(`${API_URL}/chat/${activeConvId}/`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    })();
  }, [activeConvId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !activeConvId || sending) return;
    setSending(true);
    try {
      await sendMessage(activeConvId, input.trim());
      setInput('');
      const res = await fetch(`${API_URL}/chat/${activeConvId}/`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        fetchConversations();
      }
    } catch {} finally { setSending(false); }
  };

  const formatMsgTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AccountLayout>
      <div className="flex h-[calc(100vh-120px)] bg-card border border-border rounded-xl overflow-hidden">
        {/* Sidebar */}
        <div className={`${activeConv ? 'hidden md:flex' : 'flex'} md:flex flex-col w-full md:w-80 border-r border-border shrink-0`}>
          <div className="p-4 border-b border-border">
            <Link href="/account" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3">
              <ArrowLeft size={16} /> Minha Conta
            </Link>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <MessageCircle size={20} className="text-accent" /> Mensagens
            </h1>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="py-8"><LoadingSpinner size={24} message="A carregar..." /></div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageCircle size={40} className="mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Nenhuma conversa.</p>
                <p className="text-xs text-muted-foreground mt-1">Visite uma loja ou produto para iniciar.</p>
              </div>
            ) : (
              conversations.map(conv => (
                <button key={conv.id} onClick={() => setActiveConvId(conv.id)}
                  className={`w-full px-4 py-3 border-b border-border hover:bg-muted/30 text-left transition-colors ${activeConvId === conv.id ? 'bg-accent/5 border-l-2 border-l-accent' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{conv.store_name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {conv.last_message ? timeAgo(conv.last_message.created_at) : ''}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.subject}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {conv.last_message && (
                      <span className="text-xs text-muted-foreground truncate flex-1">{conv.last_message.body}</span>
                    )}
                    {conv.unread_count > 0 && (
                      <span className="bg-accent text-accent-foreground text-[10px] px-1.5 py-0.5 rounded-full shrink-0">{conv.unread_count}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className={`${activeConv ? 'flex' : 'hidden md:flex'} flex-col flex-1`}>
          {activeConv ? (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <button onClick={() => setActiveConvId(null)} className="md:hidden p-1 hover:bg-muted rounded">
                  <ArrowLeft size={18} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{activeConv.subject}</p>
                  <p className="text-xs text-muted-foreground">{activeConv.store_name}</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-xl px-3 py-2 text-sm ${
                      msg.is_mine ? 'bg-accent text-accent-foreground' : 'bg-muted'
                    }`}>
                      {!msg.is_mine && <p className="text-[10px] font-bold mb-0.5">{msg.sender_name}</p>}
                      <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        <span className="text-[10px] opacity-70">{formatMsgTime(msg.created_at)}</span>
                        {msg.is_mine && msg.is_read && <span className="text-[10px] opacity-70">✓✓</span>}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="px-3 py-3 border-t border-border flex items-center gap-2">
                <input type="text" value={input} onChange={e => setInput(e.target.value)}
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
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-sm">Seleccione uma conversa</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AccountLayout>
  );
}
