"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, ArrowLeft } from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="sticky top-0 z-50 bg-slate-900 text-white shadow-lg">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          {!isHome && (
            <Link
              href="/"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 transition-colors hover:bg-slate-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">Splitcito</span>
          </Link>
        </div>

        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
              isHome
                ? "bg-slate-800 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Home className="h-5 w-5" />
          </Link>
          <Link
            href="/groups/new"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white transition-colors hover:bg-emerald-600"
          >
            <Plus className="h-5 w-5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
