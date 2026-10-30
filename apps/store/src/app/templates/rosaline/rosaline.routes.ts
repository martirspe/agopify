import { Routes } from "@angular/router";
import {
  catalogResolver,
  featuredResolver,
  productResolver,
  storeResolver,
} from "../../app.resolvers";
import { LEGAL_SLUGS } from "../../features/legal/legal-slugs";
import { RosalineShell } from "./rosaline-shell";
export const ROSALINE_ROUTES: Routes = [
  {
    path: "",
    component: RosalineShell,
    resolve: { store: storeResolver },
    children: [
      {
        path: "",
        pathMatch: "full",
        resolve: { featured: featuredResolver },
        loadComponent: () =>
          import("./home.page").then((m) => m.RosalineHomePage),
      },
      {
        path: "productos",
        resolve: { list: catalogResolver },
        runGuardsAndResolvers: "always",
        loadComponent: () =>
          import("./catalog.page").then((m) => m.RosalineCatalogPage),
      },
      {
        path: "producto/:handle",
        resolve: { product: productResolver },
        loadComponent: () =>
          import("../../features/product/product.page").then(
            (m) => m.ProductPage,
          ),
      },
      {
        path: "carrito",
        loadComponent: () =>
          import("../../features/cart/cart.page").then((m) => m.CartPage),
      },
      {
        path: "checkout",
        loadComponent: () =>
          import("../../features/checkout/checkout.page").then(
            (m) => m.CheckoutPage,
          ),
      },
      {
        path: "pedido/:id",
        loadComponent: () =>
          import("../../features/order/order.page").then((m) => m.OrderPage),
      },
      {
        path: "legal",
        loadComponent: () =>
          import("../../features/legal/legal.page").then((m) => m.LegalPage),
      },
      ...LEGAL_SLUGS.map((slug) => ({
        path: slug,
        data: { slug },
        loadComponent: () =>
          import("../../features/legal/legal.page").then((m) => m.LegalPage),
      })),
      {
        path: "**",
        loadComponent: () =>
          import("../../features/not-found/not-found.page").then(
            (m) => m.NotFoundPage,
          ),
      },
    ],
  },
];
