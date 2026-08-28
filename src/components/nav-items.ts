/**
 * One nav definition, read by the desktop sidebar, the mobile tab bar and the
 * top-bar breadcrumb. Keeping it here means a route added in one place shows
 * up in all three rather than in whichever the author remembered.
 *
 * `note` is the roman numeral shown beside the label — the numbering is a
 * reading order for the primary rooms, so it deliberately stops at the lab.
 */
export type NavItem = {
  href: string;
  label: string;
  note: string;
  /**
   * Label for the mobile tab bar, where each of the six slots is under 63px
   * on a 375px phone. Only set where the full label does not fit.
   */
  short?: string;
  /** Shown in the mobile tab bar. The rest live behind "More". */
  primary?: boolean;
};

export const NAV_PRIMARY: NavItem[] = [
  { href: "/progress", label: "Overview", note: "I", primary: true },
  { href: "/swings", label: "Swings", note: "II", primary: true },
  { href: "/upload", label: "Upload", note: "III", primary: true },
  { href: "/compare", label: "Compare", note: "IV", primary: true },
  { href: "/coach", label: "Live Coach", short: "Coach", note: "V", primary: true },
  { href: "/fitting", label: "Fitting", note: "VI" },
];

export const NAV_LAB: NavItem[] = [
  { href: "/lab/segmentation", label: "Segmentation", note: "lab" },
  { href: "/lab/preprocess", label: "Conditioning", note: "lab" },
];

/** Sits below the lab, unlabelled — housekeeping rather than a room. */
export const NAV_UTILITY: NavItem[] = [
  { href: "/settings", label: "Settings", note: "·" },
];

/** Internal ledger. Rendered only for allowlisted emails, never in the golfer nav. */
export const NAV_ADMIN: NavItem[] = [
  { href: "/admin", label: "Admin", note: "·" },
];

export const NAV_ALL: NavItem[] = [
  ...NAV_PRIMARY,
  ...NAV_LAB,
  ...NAV_UTILITY,
  ...NAV_ADMIN,
];

/**
 * Longest-prefix match, so /swings/<id> still lights up "Swings" while an
 * exact match on a shorter route never steals it.
 */
export function activeItem(pathname: string): NavItem | null {
  let best: NavItem | null = null;
  for (const item of NAV_ALL) {
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      if (!best || item.href.length > best.href.length) best = item;
    }
  }
  return best;
}

export function crumbFor(pathname: string): string {
  const item = activeItem(pathname);
  return item ? `Dashboard · ${item.label}` : "Dashboard";
}
