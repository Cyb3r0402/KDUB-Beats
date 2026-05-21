"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

export default function ScrollEffects() {
  const isHydratedRef = useRef(false);

  useLayoutEffect(() => {
    isHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!isHydratedRef.current) return;

    const root = document.documentElement;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      return;
    }

    root.classList.add("motion-enabled");

    const revealed = new Set<Element>();
    const parallaxItems = new Set<HTMLElement>();
    const pointerCenter = {
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.24,
    };

    let targetScrollY = window.scrollY;
    let smoothScrollY = window.scrollY;
    let targetPointerX = pointerCenter.x;
    let targetPointerY = pointerCenter.y;
    let pointerX = targetPointerX;
    let pointerY = targetPointerY;

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      {
        threshold: 0.16,
        rootMargin: "0px 0px -10% 0px",
      }
    );

    function registerTargets() {
      const revealTargets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

      revealTargets.forEach((element, index) => {
        if (!revealed.has(element)) {
          element.style.setProperty("--reveal-order", String(index % 6));
          revealObserver.observe(element);
          revealed.add(element);
        }
      });

      document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((element) => {
        parallaxItems.add(element);
      });
    }

    let rafId = 0;

    function syncScrollEffects() {
      const scrollHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);

      smoothScrollY += (targetScrollY - smoothScrollY) * 0.08;
      pointerX += (targetPointerX - pointerX) * 0.12;
      pointerY += (targetPointerY - pointerY) * 0.12;

      const progress = smoothScrollY / scrollHeight;
      root.style.setProperty("--scroll-progress", progress.toFixed(4));
      root.style.setProperty("--page-depth", ((progress - 0.5) * 2).toFixed(4));
      root.style.setProperty("--scroll-sheen", (0.18 + progress * 0.82).toFixed(4));
      root.style.setProperty("--pointer-x", `${((pointerX / Math.max(window.innerWidth, 1)) * 100).toFixed(2)}%`);
      root.style.setProperty("--pointer-y", `${((pointerY / Math.max(window.innerHeight, 1)) * 100).toFixed(2)}%`);

      parallaxItems.forEach((element) => {
        const speed = Number(element.dataset.parallax || "0.08");
        const rect = element.getBoundingClientRect();
        const elementCenter = rect.top + rect.height / 2;
        const viewportCenter = window.innerHeight / 2;
        const offset = (viewportCenter - elementCenter) * speed;
        const normalizedDistance = (viewportCenter - elementCenter) / Math.max(window.innerHeight, 1);
        const clampedDistance = Math.max(-1.15, Math.min(1.15, normalizedDistance));
        const proximity = Math.max(0, 1 - Math.abs(clampedDistance));
        const lift = proximity * -16;

        const scale = 1 + Math.min(Math.abs(offset) * 0.00008, 0.018);
        element.style.setProperty("--parallax-y", `${offset.toFixed(1)}px`);
        element.style.setProperty("--parallax-scale", scale.toFixed(3));
        element.style.setProperty("--section-progress", proximity.toFixed(3));
        element.style.setProperty("--scroll-lift", `${lift.toFixed(1)}px`);
        element.style.setProperty("--scroll-tilt", `${(clampedDistance * -4.2).toFixed(2)}deg`);
        element.style.setProperty("--scroll-opacity", `${(0.88 + proximity * 0.12).toFixed(3)}`);
      });

      rafId = window.requestAnimationFrame(syncScrollEffects);
    }

    function requestSync() {
      targetScrollY = window.scrollY;
    }

    function handlePointerMove(event: PointerEvent) {
      targetPointerX = event.clientX;
      targetPointerY = event.clientY;
    }

    function handlePointerLeave() {
      targetPointerX = window.innerWidth / 2;
      targetPointerY = window.innerHeight * 0.24;
    }

    const mutationObserver = new MutationObserver(() => {
      registerTargets();
      requestSync();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    registerTargets();
    root.classList.add("page-ready");
    rafId = window.requestAnimationFrame(syncScrollEffects);

    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      revealObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);

      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }

      root.classList.remove("motion-enabled");
      root.classList.remove("page-ready");
      root.style.removeProperty("--scroll-progress");
      root.style.removeProperty("--page-depth");
      root.style.removeProperty("--scroll-sheen");
      root.style.removeProperty("--pointer-x");
      root.style.removeProperty("--pointer-y");
    };
  }, []);

  return null;
}
