"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_LAB, NAV_PRIMARY, NAV_UTILITY, activeItem } from "@/components/nav-items";

const TABS = NAV_PRIMARY.filter((i) => i.primary);
/** Everything the tab bar could not fit, reachable through "More". */
const OVERFLOW = [
  ...NAV_PRIMARY.filter((i) => !i.primary),
  ...NAV_LAB,
  ...NAV_UTILITY,
];

/**
 * Bottom tab bar for phones, mirroring the sidebar on desktop.
 *
 * Six rooms do not fit across a phone, so five ride the bar and the rest sit
 * behind a sheet. The rule is that every route stays reachable in two taps —
 * hiding a room behind a menu is acceptable, making it unreachable is not.
 */
export function MobileNav() {
  const pathname = usePathname();
  const current = activeItem(pathname);
  const [open, setOpen] = useState(false);

  const tabIndex = TABS.findIndex((t) => t.href === current?.href);
  const inOverflow = OVERFLOW.some((i) => i.href === current?.href);

  // A tap that navigates should close the sheet; the route change is the
  // signal, so this covers back-button dismissal too.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // The sheet is a modal surface — stop the page behind it from scrolling.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const slots = TABS.length + 1;

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="More sections"
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[color:var(--ink)]/40 backdrop-blur-[2px]"
          />
          <div className="absolute inset-x-0 bottom-0 border-t border-[color:var(--rule)] bg-[color:var(--surface)] pb-[max(env(safe-area-inset-bottom),1rem)]">
            <p className="gi-kicker px-5 pt-5">More</p>
            <div className="mt-2 px-2 pb-3">
              {OVERFLOW.map((item) => {
                const active = current?.href === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className="flex items-baseline justify-between gap-3 rounded-[3px] px-3.5 py-3.5 transition-colors"
                    style={{
                      color: active ? "var(--ink)" : "var(--muted)",
                      background: active ? "var(--green-soft)" : "transparent",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    <span className="text-[15px]">{item.label}</span>
                    <span className="text-[10px] tracking-[0.06em] text-[color:var(--faint)] uppercase">
                      {item.note}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--rule)] bg-[color:var(--surface)]/95 px-3 pt-2.5 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur-md lg:hidden"
      >
        <div className="relative flex">
          <div
            aria-hidden
            className="absolute top-0 h-[2px] bg-[color:var(--green)] transition-transform duration-[340ms] ease-[cubic-bezier(.22,1,.36,1)]"
            style={{
              width: `${100 / slots}%`,
              opacity: tabIndex >= 0 || inOverflow ? 1 : 0,
              transform: `translateX(${(tabIndex >= 0 ? tabIndex : TABS.length) * 100}%)`,
            }}
          />
          {TABS.map((item) => {
            const active = current?.href === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-1 flex-col items-center gap-1.5 px-0 pt-3 pb-1.5 transition-colors"
                style={{
                  color: active ? "var(--ink)" : "var(--muted)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span className="text-[11.5px] tracking-[0.03em] whitespace-nowrap">
                  {item.short ?? item.label}
                </span>
                <span className="text-[8.5px] tracking-[0.14em] text-[color:var(--faint)] uppercase">
                  {item.note}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex flex-1 flex-col items-center gap-1.5 px-0 pt-3 pb-1.5 transition-colors"
            style={{
              color: inOverflow || open ? "var(--ink)" : "var(--muted)",
              fontWeight: inOverflow || open ? 600 : 400,
            }}
          >
            <span className="text-[11.5px] tracking-[0.03em]">More</span>
            <span className="text-[8.5px] tracking-[0.14em] text-[color:var(--faint)] uppercase">
              {inOverflow ? current?.note : "···"}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
