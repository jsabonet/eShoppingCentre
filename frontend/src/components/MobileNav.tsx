import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function MobileNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { href: '/index#categories', label: 'Shop' },
    { href: '/rings', label: 'Rings' },
    { href: '/necklaces', label: 'Necklaces' },
    { href: '/diamonds', label: 'Diamonds' },
    { href: '/about', label: 'About' },
    { href: '/materials-care', label: 'Materials & Care' },
    { href: '/contact', label: 'Contact' },
  ];

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="md:hidden p-2 hover:text-accent transition-colors"
        aria-label="Toggle menu"
      >
        {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-30 transition-opacity duration-300 md:hidden ${
          isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMenuOpen(false)}
      />

      {/* Mobile Menu - Slides in from left */}
      <div
        className={`fixed top-0 left-0 h-screen w-full max-w-xs bg-background z-40 flex flex-col shadow-lg transition-transform duration-300 ease-out overflow-hidden md:hidden ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ height: '100vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <span className="text-lg font-semibold">Menu</span>
          <button
            onClick={() => setIsMenuOpen(false)}
            className="p-1 hover:bg-subtle rounded transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-col flex-1 overflow-y-auto">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-6 py-4 text-base font-medium hover:bg-subtle transition-colors border-b border-border last:border-b-0"
              onClick={() => setIsMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
