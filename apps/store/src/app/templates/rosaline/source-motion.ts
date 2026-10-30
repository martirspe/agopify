import {
  Directive,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
} from "@angular/core";

/** Native equivalents of the supplied WOW and infiniteslide initialization. */
@Directive({ selector: "[rosalineSourceMotion]" })
export class RosalineSourceMotion {
  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const sizeSliders = () => {
        const width = window.innerWidth;
        for (const slider of host.querySelectorAll<HTMLElement>(
          ".tf-swiper.rosaline-native-slider",
        )) {
          const data = slider.dataset;
          const columns =
            width >= 1200
              ? data["preview"]
              : width >= 768
                ? data["tablet"]
                : width >= 575
                  ? (data["mobileSm"] ?? data["mobile"])
                  : width >= 425
                    ? (data["mobileSsm"] ?? data["mobile"])
                    : data["mobile"];
          const gap =
            width >= 1200
              ? (data["spaceLg"] ?? data["spaceMd"] ?? data["space"])
              : width >= 768
                ? (data["spaceMd"] ?? data["space"])
                : data["space"];
          slider.style.setProperty("--reference-columns", columns ?? "1");
          slider.style.setProperty("--reference-gap", (gap ?? "0") + "px");
        }
      };
      sizeSliders();
      const sliderMutations = new MutationObserver(sizeSliders);
      sliderMutations.observe(host, { childList: true, subtree: true });
      window.addEventListener("resize", sizeSliders, { passive: true });
      destroy.onDestroy(() => {
        sliderMutations.disconnect();
        window.removeEventListener("resize", sizeSliders);
      });
      const footerMedia = matchMedia("(max-width: 575px)");
      const animations = new Set<Animation>();
      const syncFooter = () => {
        for (const heading of host.querySelectorAll<HTMLElement>(
          ".footer-heading-mobile",
        )) {
          heading.parentElement?.classList.remove("open");
          (heading.nextElementSibling as HTMLElement | null)?.removeAttribute(
            "style",
          );
          if (footerMedia.matches) {
            heading.setAttribute("role", "button");
            heading.setAttribute("tabindex", "0");
            heading.setAttribute("aria-expanded", "false");
          } else {
            heading.removeAttribute("role");
            heading.removeAttribute("tabindex");
            heading.removeAttribute("aria-expanded");
          }
        }
      };
      const footerClick = (event: Event) => {
        if (!footerMedia.matches || !(event.target instanceof Element)) return;
        const heading = event.target.closest<HTMLElement>(
          ".footer-heading-mobile",
        );
        const content = heading?.nextElementSibling as HTMLElement | null;
        if (!heading || !content) return;
        const open = heading.parentElement!.classList.toggle("open");
        heading.setAttribute("aria-expanded", String(open));
        const start = content.getBoundingClientRect().height;
        content.style.display = "block";
        content.style.overflow = "hidden";
        const end = open ? content.scrollHeight : 0;
        const animation = content.animate(
          [{ height: `${start}px` }, { height: `${end}px` }],
          {
            duration: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? 0
              : 250,
            easing: "ease-in-out",
          },
        );
        animations.add(animation);
        animation.finished
          .then(() => {
            content.style.display = open ? "block" : "none";
            content.style.removeProperty("overflow");
            animations.delete(animation);
          })
          .catch(() => animations.delete(animation));
      };
      const footerKey = (event: KeyboardEvent) => {
        if (
          (event.key === "Enter" || event.key === " ") &&
          event.target instanceof HTMLElement &&
          event.target.matches(".footer-heading-mobile")
        ) {
          event.preventDefault();
          event.target.click();
        }
      };
      syncFooter();
      footerMedia.addEventListener("change", syncFooter);
      host.addEventListener("click", footerClick);
      host.addEventListener("keydown", footerKey);
      destroy.onDestroy(() => {
        footerMedia.removeEventListener("change", syncFooter);
        host.removeEventListener("click", footerClick);
        host.removeEventListener("keydown", footerKey);
        animations.forEach((animation) => animation.cancel());
      });
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const seen = new WeakSet<Element>();
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            element.style.visibility = "visible";
            element.classList.add("animated");
            observer.unobserve(element);
          }
      });
      const scan = () => {
        for (const element of host.querySelectorAll<HTMLElement>(".wow")) {
          if (seen.has(element)) continue;
          seen.add(element);
          element.style.visibility = "hidden";
          observer.observe(element);
        }
        for (const element of host.querySelectorAll<HTMLElement>(
          ".infiniteSlide-wrapper",
        )) {
          if (seen.has(element)) continue;
          seen.add(element);
          const children = Array.from(element.children);
          const distance = element.scrollWidth;
          const cloneCount = Number(element.dataset["clone"] || 2);
          for (let n = 0; n < cloneCount; n++)
            for (const child of children) {
              const clone = child.cloneNode(true) as HTMLElement;
              clone.setAttribute("aria-hidden", "true");
              clone.setAttribute("inert", "");
              element.appendChild(clone);
            }
          // The source plugin defaults to 50 pixels per second.
          element.style.setProperty(
            "--reference-marquee-distance",
            `${-distance}px`,
          );
          element.style.setProperty(
            "--reference-marquee-duration",
            `${distance / Number(element.dataset["speed"] || 50)}s`,
          );
          element.classList.add("rosaline-native-marquee");
        }
      };
      scan();
      const mutations = new MutationObserver(scan);
      mutations.observe(host, { childList: true, subtree: true });
      destroy.onDestroy(() => {
        observer.disconnect();
        mutations.disconnect();
      });
    });
  }
}
