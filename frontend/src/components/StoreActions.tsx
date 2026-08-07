'use client';

import { useState, useEffect } from 'react';
import { Bell, BellRing, Star, MessageCircle } from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import { useChat } from '@/src/contexts/ChatContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface StoreActionsProps {
  storeId: string;
  storeSlug: string;
  storeName: string;
  storeType: 'physical' | 'digital' | 'course';
}

function headers() {
  const tok = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
  };
}

export default function StoreActions({ storeId, storeSlug, storeName, storeType }: StoreActionsProps) {
  const { user } = useAuth();
  const { startConversation, setOpenWidget } = useChat();
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [loadingFollow, setLoadingFollow] = useState(false);

  // Check follow status
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/stores/${storeSlug}/follow-status/`, { headers: headers() });
        if (res.ok) {
          const d = await res.json();
          setFollowing(d.following);
          setFollowersCount(d.followers_count);
        }
      } catch {}
    })();
  }, [storeSlug, user]);

  const toggleFollow = async () => {
    if (!user) {
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      return;
    }
    setLoadingFollow(true);
    try {
      const endpoint = following ? 'unfollow' : 'follow';
      const res = await fetch(`${API_URL}/stores/${storeSlug}/${endpoint}/`, {
        method: 'POST', headers: headers(),
      });
      if (res.ok) {
        const d = await res.json();
        setFollowing(d.following);
        setFollowersCount(d.followers_count);
      }
    } catch {} finally { setLoadingFollow(false); }
  };

  const handleChat = async () => {
    if (!user) {
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      return;
    }
    await startConversation(storeId, `Duvida sobre a loja ${storeName}`, '');
    setOpenWidget(true);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Follow */}
        <button onClick={toggleFollow} disabled={loadingFollow}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            following
              ? 'bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20'
              : 'bg-card border border-border hover:border-accent/50 hover:text-accent'
          }`}>
          {following ? <BellRing size={16} /> : <Bell size={16} />}
          {following ? 'A Seguir' : 'Seguir Loja'}
        </button>

        {/* Rate — scroll to reviews section */}
        <button onClick={() => {
          const el = document.getElementById('store-reviews');
          if (el) { el.scrollIntoView({ behavior: 'smooth' }); }
          // Dispatch event to open the form
          window.dispatchEvent(new CustomEvent('open-store-review-form'));
        }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-card border border-border hover:border-amber-400 hover:text-amber-500 transition-all">
          <Star size={16} />
          Avaliar
        </button>

        {/* Chat */}
        <button onClick={handleChat}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-card border border-border hover:border-accent/50 hover:text-accent transition-all">
          <MessageCircle size={16} />
          Conversar
        </button>
      </div>
    </>
  );
}
