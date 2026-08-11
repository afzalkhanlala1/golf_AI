"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import {
  NAV_LAB,
  NAV_PRIMARY,
  NAV_UTILITY,
  activeItem,
  type NavItem,
} from "@/components/nav-items";

/**
 * The green bar that slides between nav entries.
 *
 * Its position is measured off the live DOM rather than computed from a fixed
 * row height: the list is split into two groups with a heading between them,
 * so any arithmetic would have to encode the heading's height and would drift
 * the moment the type scale changed. Measuring is immune to all of that.
 */
function useMarker(pathname: string) {
  const navRef = useRef<HTMLDivElement>(null);
  const [mark, setMark] = useState<{ y: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    /**
     * A zero height means the sidebar has not been laid out yet — it is
     * `display:none` below the lg breakpoint, and stylesheets and webfonts
     * both land after the first layout pass. Measuring then would pin the
     * marker at the top forever, so a zero reading is discarded rather than
     * stored and we wait to be called again.
     */
    function measure() {
      const el = nav?.querySelector<HTMLElement>("[data-active='true']");
      if (!el) {
        setMark(null);
        return;
      }
      const h = el.offsetHeight;
      if (h === 0) return;
      setMark({ y: el.offsetTop, h });
    }

    measure();

    // Once more after the browser has actually laid the frame out.
    const raf = requestAnimationFrame(measure);

    // Webfonts change the row metrics when they swap in.
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });

    // Covers crossing the lg breakpoint, where the sidebar goes from
    // display:none to laid out and every offset changes at once.
    const ro =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (nav && ro) ro.observe(nav);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [pathname]);

  return { navRef, mark };
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      data-active={active}
      aria-current={active ? "page" : undefined}
      className="flex h-11 items-baseline justify-between gap-2.5 rounded-[3px] px-3.5 py-3 transition-colors duration-200 hover:bg-[color:var(--green-soft)]"
      style={{
        color: active ? "var(--ink)" : "var(--muted)",
        background: active ? "var(--green-soft)" : "transparent",
      }}
    >
      <span
        className="text-[14.5px] tracking-[0.005em]"
        style={{ fontWeight: active ? 600 : 400 }}
      >
        {item.label}
      </span>
      <span className="text-[10px] tracking-[0.06em] tabular-nums text-[color:var(--faint)]">
        {item.note}
      </span>
    </Link>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const current = activeItem(pathname);
  const { navRef, mark } = useMarker(pathname);

  return (
    <div ref={navRef} className="relative flex-1 px-3.5 py-4">
      <div
        aria-hidden
        className="absolute left-3.5 w-[3px] rounded-[2px] bg-[color:var(--green)] transition-all duration-[340ms] ease-[cubic-bezier(.22,1,.36,1)]"
        style={{
          top: 0,
          height: mark?.h ?? 0,
          opacity: mark ? 1 : 0,
          transform: `translateY(${mark?.y ?? 0}px)`,
        }}
      />
      <nav className="flex flex-col">
        {NAV_PRIMARY.map((item) => (
          <NavLink key={item.href} item={item} active={current?.href === item.href} />
        ))}
      </nav>

      <p className="mt-5 mb-1 px-3.5 text-[9px] tracking-[0.22em] text-[color:var(--faint)] uppercase">
        The lab
      </p>
      <nav className="flex flex-col">
        {NAV_LAB.map((item) => (
          <NavLink key={item.href} item={item} active={current?.href === item.href} />
        ))}
      </nav>

      <nav className="mt-5 flex flex-col border-t border-[color:var(--rule)] pt-2">
        {NAV_UTILITY.map((item) => (
          <NavLink key={item.href} item={item} active={current?.href === item.href} />
        ))}
      </nav>
    </div>
  );
}
