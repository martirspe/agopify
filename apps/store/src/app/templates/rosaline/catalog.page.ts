import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DsIconComponent, DsSelectComponent } from "@agopify/ui";
import { CatalogPage } from "../../features/catalog/catalog.page";
import { CatalogFiltersComponent } from "../../components/catalog-filters.component";
import { RosalineProductCard } from "./product-card";
@Component({
  selector: "rosaline-catalog",
  imports: [
    RouterLink,
    DsIconComponent,
    DsSelectComponent,
    CatalogFiltersComponent,
    RosalineProductCard,
  ],
  templateUrl: "./catalog.page.html",
  styleUrl: "../../features/catalog/catalog.page.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineCatalogPage extends CatalogPage {}
