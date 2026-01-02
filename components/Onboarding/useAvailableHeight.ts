
// components/Onboarding/useAvailableHeight.ts
import { useEffect, useState } from "react";

/**
 * Returns the available height (in px) for the content panel:
 * viewport height - header height - bottom nav height.
 * headerId: the id of your header container
 * navId:    the id of your page-level back/next nav row
 */
export function useAvailableHeight(headerId: string, navId: string) {
  const [height, setHeight] = useState<number>(0);

  useEffect(() => {
    const compute = () => {
      const vh = window.innerHeight;
      const headerEl = document.getElementById(headerId);
      const navEl =
        document.getElementById(navId) ||
        (document.querySelector(".bottom-nav") as HTMLElement | null);

      const headerH = headerEl?.offsetHeight ?? 0;
      const navH = navEl?.offsetHeight ?? 0;

      setHeight(Math.max(0, vh - headerH - navH));
    };

    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [headerId, navId]);

  return height;
}
