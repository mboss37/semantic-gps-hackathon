'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MenuIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

const NAV_LINKS = [
  { name: 'Features', href: '#features' },
  { name: 'How it works', href: '#how-it-works' },
  { name: 'Architecture', href: '#architecture' },
  { name: 'BYO MCPs', href: '#integrations' },
  { name: 'Governance', href: '#governance' },
] as const;

const BrandMark = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden
  >
    <rect x="3" y="3" width="18" height="18" rx="4" fill="var(--brand)" />
    <circle cx="12" cy="12" r="3" fill="#ffffff" />
  </svg>
);

export const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-200 ${
        isScrolled || isMobileOpen
          ? 'bg-background/80 backdrop-blur-md border-b border-border'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <nav className="mx-auto max-w-[1400px]">
        <div className="flex items-center justify-between h-14 px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <BrandMark className="w-5 h-5 text-foreground" />
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                Semantic GPS
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-7">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-[13px] text-foreground/60 hover:text-foreground transition-colors"
                >
                  {link.name}
                </a>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-5">
            <Link
              href="/login"
              className="text-[13px] text-foreground/60 hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Button
              asChild
              size="sm"
              className="h-8 px-4 rounded-full bg-foreground text-background hover:bg-foreground/90 text-[13px] font-medium"
            >
              <Link href="/signup">Get started</Link>
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileOpen((v) => !v)}
            className="md:hidden p-2 -mr-2"
            aria-label="Toggle menu"
          >
            {isMobileOpen ? <XIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      <div
        className={`md:hidden fixed inset-0 top-14 bg-background z-40 transition-opacity duration-200 ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-col h-full px-6 pt-8 pb-8">
          <div className="flex-1 flex flex-col gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileOpen(false)}
                className="text-2xl font-medium text-foreground hover:text-foreground/70 transition-colors"
              >
                {link.name}
              </a>
            ))}
          </div>
          <div className="flex flex-col gap-3 pt-6 border-t border-border">
            <Button
              asChild
              className="h-11 rounded-full bg-foreground text-background hover:bg-foreground/90 text-[14px]"
            >
              <Link href="/signup" onClick={() => setIsMobileOpen(false)}>
                Get started
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-full border-foreground/20">
              <Link href="/login" onClick={() => setIsMobileOpen(false)}>
                Sign in
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
