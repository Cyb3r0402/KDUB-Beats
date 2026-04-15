"use client";

import { useEffect } from "react";

export default function ScrollEffects() {
  useEffect(() => {
    const root = document.documentElement;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      return;
    }

    root.classList.add("motion-enabled");

    const revealed = new Set<Element>();
    const parallaxItems = new Set<HTMLElement>();

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
      rafId = 0;

      const scrollHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const progress = window.scrollY / scrollHeight;
      root.style.setProperty("--scroll-progress", progress.toFixed(4));

      parallaxItems.forEach((element) => {
        const speed = Number(element.dataset.parallax || "0.08");
        const rect = element.getBoundingClientRect();
        const elementCenter = rect.top + rect.height / 2;
        const viewportCenter = window.innerHeight / 2;
        const offset = (viewportCenter - elementCenter) * speed;
        element.style.setProperty("--parallax-y", `${offset.toFixed(1)}px`);
      });
    }

    function requestSync() {
      if (rafId) {
        return;
      }

      rafId = window.requestAnimationFrame(syncScrollEffects);
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
    requestSync();

    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);

    return () => {
      revealObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);

      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }

      root.classList.remove("motion-enabled");
      root.style.removeProperty("--scroll-progress");
    };
  }, []);

  return null;
}
