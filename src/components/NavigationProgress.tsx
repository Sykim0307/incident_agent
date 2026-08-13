"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Slim top progress bar so clicking a nav link gives instant feedback
 * ("did my click register?") while the new route's server component
 * fetches data and renders. `isLoading` is derived during render (no
 * effect needed to detect completion) - once the pathname actually
 * changes away from where a click started, the bar is done by
 * definition.
 */
export default function NavigationProgress() {
  const pathname = usePathname();
  const [nav, setNav] = useState<{ active: boolean; fromPath: string | null }>({
    active: false,
    fromPath: null,
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      if (anchor.target === "_blank") return;
      if (href === window.location.pathname) return;
      setNav({ active: true, fromPath: window.location.pathname });
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const isLoading = nav.active && pathname === nav.fromPath;

  return (
    <div className="fixed top-0 left-0 right-0 h-0.5 z-50 pointer-events-none">
      <div
        className={`h-full bg-accent transition-all ease-out ${
          isLoading ? "w-3/4 opacity-100 duration-[1500ms]" : "w-full opacity-0 duration-200"
        }`}
      />
    </div>
  );
}
