import React, { useState, useRef, useEffect } from 'react';
import { User, LogIn, LogOut, Settings, Heart } from 'lucide-react';

export default function AccountMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check login status on mount
  useEffect(() => {
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    setIsLoggedIn(false);
    setIsOpen(false);
  };

  const handleAccountSettings = () => {
    // Navigate to account settings page
    window.location.href = '/account-settings';
    setIsOpen(false);
  };

  const handleWishlist = () => {
    // Navigate to wishlist page
    window.location.href = '/wishlist';
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} className="relative">
      {/* Account Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:text-accent transition-colors"
        aria-label="Account"
      >
        <User size={20} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-background border border-border rounded-sm shadow-lg z-50">
          {isLoggedIn ? (
            <>
              <button
                onClick={handleAccountSettings}
                className="w-full text-left px-4 py-3 hover:bg-subtle transition-colors flex items-center gap-3 border-b border-border"
              >
                <Settings size={16} />
                <span className="text-sm">Account Settings</span>
              </button>
              <button
                onClick={handleWishlist}
                className="w-full text-left px-4 py-3 hover:bg-subtle transition-colors flex items-center gap-3 border-b border-border"
              >
                <Heart size={16} />
                <span className="text-sm">Wishlist</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-3 hover:bg-subtle transition-colors flex items-center gap-3 text-red-500 hover:text-red-600"
              >
                <LogOut size={16} />
                <span className="text-sm">Logout</span>
              </button>
            </>
          ) : (
            <a
              href="/sign-in"
              className="w-full block text-left px-4 py-3 hover:bg-subtle transition-colors flex items-center gap-3"
            >
              <LogIn size={16} />
              <span className="text-sm">Sign In</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
