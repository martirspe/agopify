import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  computed,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import type { PublicCatalogCard } from "@agopify/contracts";
import { RosalineProductCard } from "./product-card";
@Component({
  selector: "rosaline-search",
  imports: [RouterLink, RosalineProductCard],
  templateUrl: "./original-search.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineSearch {
  readonly products = input<PublicCatalogCard[]>([]);
  readonly submitted = output<{ event: Event; query: string }>();
  readonly closed = output<void>();
  readonly categories = computed(() => [
    ...new Set(this.products().flatMap((p) => p.categories)),
  ]);
}
