"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, Stethoscope, Activity, Home } from "lucide-react";

const ORGANS = [
  { href: "/brain", label: "Beyin", icon: Brain, color: "violet" },
  { href: "/liver", label: "Karaciğer", icon: Stethoscope, color: "emerald" },
  { href: "/pancreas", label: "Pankreas", icon: Activity, color: "amber" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function TopNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link
          href="/"
          className={`flex items-center gap-2.5 transition-all duration-200 ${
            isHome ? "opacity-100" : "opacity-80 hover:opacity-100"
          }`}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 shadow-sm">
            <Stethoscope className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <span className="font-semibold text-slate-900">RadAssist</span>
            <span className="text-slate-400 font-normal ml-1 text-sm">v2</span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1.5">
          {/* Home button */}
          <Link
            href="/"
            className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 ${
              isHome
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
            title="Ana Sayfa"
          >
            <Home className="w-4 h-4" />
          </Link>

          <div className="w-px h-5 bg-slate-200 mx-1.5" />

          {/* Organ links */}
          {ORGANS.map((o) => {
            const active = isActive(pathname, o.href);
            const Icon = o.icon;
            return (
              <Link
                key={o.href}
                href={o.href}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  active
                    ? o.color === "violet"
                      ? "bg-violet-600 text-white shadow-sm shadow-violet-200"
                      : o.color === "emerald"
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-200"
                      : "bg-amber-600 text-white shadow-sm shadow-amber-200"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{o.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
