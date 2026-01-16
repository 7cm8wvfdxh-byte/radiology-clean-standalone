"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ORGANS = [
  { href: "/brain", label: "Beyin" },
  { href: "/liver", label: "Karaciğer" },
  { href: "/pancreas", label: "Pankreas" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function TopNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold">
          radiology-clean
        </Link>

        <div className="flex items-center gap-2">
          {ORGANS.map((o) => {
            const active = isActive(pathname, o.href);
            return (
              <Link
                key={o.href}
                href={o.href}
                className={[
                  "rounded-full px-3 py-1 text-sm transition",
                  active
                    ? "bg-black text-white"
                    : "border bg-white hover:bg-gray-50",
                ].join(" ")}
              >
                {o.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
