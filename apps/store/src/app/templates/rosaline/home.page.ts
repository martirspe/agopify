import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { HomePage } from "../../features/home/home.page";
import { STORE_EDITOR } from "../../core/store-editor";
import { HomeBlockComponent } from "../../components/home-block.component";
import { storeHomeSections } from "../../core/store-layout";
import {
  RosalineHero,
  RosalineFacts,
  RosalineSelection,
  RosalineExplore,
  RosalineBrands,
  RosalineTrusted,
  RosalineRitual,
  RosalineCompare,
  RosalineClosing,
  RosalineShop,
} from "./original-sections";
import { RosalineSpotlight } from "./spotlight";
import { TemplateDemo } from "../../core/template-demo";
@Component({
  selector: "rosaline-home",
  imports: [
    STORE_EDITOR,
    RouterLink,
    HomeBlockComponent,
    RosalineHero,
    RosalineFacts,
    RosalineSelection,
    RosalineExplore,
    RosalineBrands,
    RosalineTrusted,
    RosalineRitual,
    RosalineCompare,
    RosalineClosing,
    RosalineShop,
    RosalineSpotlight,
  ],
  templateUrl: "./home.page.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineHomePage extends HomePage {
  readonly demo = inject(TemplateDemo);
  readonly sourceProducts = computed(() =>
    this.demo.active
      ? this.featured().items.slice(0, 4)
      : this.featured().items,
  );
  readonly spotlightProduct = computed(() =>
    this.demo.active
      ? (this.featured().items.find(
          (p) => p.handle === "rosaline-reference-serum",
        ) ?? this.featured().items[0])
      : this.featured().items[0],
  );
  readonly homeSections = computed(() => {
    const s = this.store();
    return s
      ? storeHomeSections(s, [
          "hero",
          "facts",
          "featured",
          "categories",
          "brands",
          "trusted",
          "ritual",
          "compare",
          "spotlight",
          "closing",
          "shop",
        ])
      : [];
  });
  fields(id: string): Record<string, string> {
    const s = this.store();
    return {
      ...(id === "hero"
        ? {
            image: this.heroImage() ?? "",
            eyebrow: s?.displayName ?? "",
            title: "CUIDADO EN SERIO.\nTU PROPIO ESTILO.",
            text: s?.tagline ?? "",
            cta: "Ver catálogo",
          }
        : {}),
      ...(s?.templateContent.sections[id] ?? {}),
    };
  }
}
