'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MenuIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/brand-mark';

const NAV_LINKS = [
  { name: 'Features', href: '/#features' },
  { name: 'TRel', href: '/#architecture' },
  { name: 'Policies', href: '/policies' },
  { name: 'Governance', href: '/#governance' },
] as const;

export const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-200 ${
          isScrolled || isMobileOpen
            ? 'border-b border-white/10 bg-[#03050c]/78 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <nav className="mx-auto max-w-[1400px]">
          <div className="flex h-14 items-center justify-between px-6 lg:px-8">
            <div className="flex items-center gap-8">
              <Link href="/" className="group flex items-center gap-2">
                <BrandMark className="size-5" />
                <span className="text-[15px] font-semibold tracking-[-0.01em] text-white">
                  Semantic GPS
                </span>
              </Link>

              <div className="hidden items-center gap-7 md:flex">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className="text-[13px] text-white/52 transition-colors hover:text-white"
                  >
                    {link.name}
                  </a>
                ))}
              </div>
            </div>

            <div className="hidden items-center gap-5 md:flex">
              <Link
                href="/login"
                className="text-[13px] text-white/52 transition-colors hover:text-white"
              >
                Sign in
              </Link>
              <Button
                asChild
                size="sm"
                className="h-8 rounded-full bg-white px-4 text-[13px] font-semibold text-black hover:bg-white/90"
              >
                <Link href="/signup">Get started</Link>
              </Button>
            </div>

            <button
              type="button"
              onClick={() => setIsMobileOpen((v) => !v)}
              className="-mr-2 p-2 text-white md:hidden"
              aria-label="Toggle menu"
            >
              {isMobileOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile menu overlay must be a SIBLING of <header>, not a child:
          the header uses `backdrop-blur-xl` which sets `backdrop-filter`,
          and `backdrop-filter` creates a containing block for `fixed`
          descendants. Inside the header, this overlay's `bottom: 0`
          resolved to "bottom of the 56px header" → height collapsed to 0
          → fully transparent menu. Hoisting it to the root sibling makes
          its containing block the viewport again. */}
      <div
        className={`fixed inset-0 top-14 z-40 bg-[#03050c]/96 backdrop-blur-xl transition-opacity duration-200 md:hidden ${
          isMobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex h-full flex-col px-6 pt-8 pb-8">
          <div className="flex flex-1 flex-col gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileOpen(false)}
                className="text-2xl font-medium text-white transition-colors hover:text-white/70"
              >
                {link.name}
              </a>
            ))}
          </div>
          <div className="flex flex-col gap-3 border-t border-white/10 pt-6">
            <Button
              asChild
              className="h-11 rounded-full bg-white text-[14px] text-black hover:bg-white/90"
            >
              <Link href="/signup" onClick={() => setIsMobileOpen(false)}>
                Get started
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-full border-white/14 bg-white/[0.045] text-white hover:bg-white/[0.08] hover:text-white"
            >
              <Link href="/login" onClick={() => setIsMobileOpen(false)}>
                Sign in
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
