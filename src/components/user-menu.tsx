"use client";

import { UserButton } from "@clerk/nextjs";
import { isAuthDisabled } from "@/lib/auth-mode";

export function UserMenu() {
  if (isAuthDisabled()) {
    return null;
  }
  return <UserButton />;
}
