'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

// IntersectionObserver wrapper for scroll-triggered fade+slide reveals.
// Mounts children invisible, flips `data-in-view` to true on first
// intersection. Paired with tailwind `data-[in-view=true]:opacity-100` etc.
// Respects `prefers-reduced-motion` via globals.css transition-duration:0ms.
export const Reveal = ({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-in-view={inView}
      style={{ transitionDelay: `${delay}ms` }}
      className={`opacity-0 translate-y-4 data-[in-view=true]:opacity-100 data-[in-view=true]:translate-y-0 transition-all duration-500 ease-out ${className}`}
    >
      {children}
    </div>
  );
};
