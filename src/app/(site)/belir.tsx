"use client";

import { useEffect, useRef } from "react";

/**
 * KAYDIRINCA BELİRME
 *
 * Görünür alana giren bölüm bir kez belirir (fade + 18px yükselme).
 * Hareketin kendisi CSS'te (`[data-belir]`); burası yalnızca "göründü"
 * bilgisini yazar.
 *
 * Neden IntersectionObserver: kaydırma olayını dinlemek her karede iş
 * yapar ve kaydırmayı tutuklaştırır. Observer, tarayıcıya "şu öğe girince
 * haber ver" der; arada hiçbir şey çalışmaz.
 *
 * Bir kez belirir ve gözlemci bırakılır (`unobserve`): aşağı yukarı
 * kaydırırken bölümlerin tekrar tekrar yanıp sönmesi dikkat dağıtır.
 *
 * Hareketi azalt ayarı açıksa (prefers-reduced-motion) CSS zaten hiçbir
 * şey oynatmaz; bu bileşen de öğeyi anında açık işaretler.
 */
export function Belir({
  children,
  className = "",
  gecikmeMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Ardışık bölümleri sırayla getirmek için küçük gecikme. */
  gecikmeMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const azalt = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (azalt || typeof IntersectionObserver === "undefined") {
      el.dataset.belir = "acik";
      return;
    }

    const gozlemci = new IntersectionObserver(
      (girdiler) => {
        for (const girdi of girdiler) {
          if (!girdi.isIntersecting) continue;
          const hedef = girdi.target as HTMLElement;
          hedef.style.transitionDelay = `${gecikmeMs}ms`;
          hedef.dataset.belir = "acik";
          gozlemci.unobserve(hedef);
        }
      },
      // Bölüm ekranın altından 12% girince başlar: tam kenarda tetiklenirse
      // kullanıcı hareketi göremeden bitmiş olur.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 },
    );

    gozlemci.observe(el);
    return () => gozlemci.disconnect();
  }, [gecikmeMs]);

  return (
    <div ref={ref} data-belir="kapali" className={className}>
      {children}
    </div>
  );
}
