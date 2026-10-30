import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catalogResolver, storeResolver } from '../../app.resolvers';
import { LEGAL_SLUGS } from '../../features/legal/legal-slugs';
import { selectaCatalogResolver, selectaProductResolver } from './selecta-catalog';
import { SelectaShell } from './selecta-shell';

const legal = () => import('./legal.page').then((m) => m.SelectaLegalPage);

/** Selecta shop with legacy catalog aliases for existing integrations. */
export const SELECTA_ROUTES: Routes = [
  {
    path: '',
    component: SelectaShell,
    resolve: { store: storeResolver, catalog: selectaCatalogResolver },
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./home.page').then((m) => m.SelectaHomePage),
      },
      {
        path: 'tienda',
        pathMatch: 'full',
        loadComponent: () => import('../../features/catalog/catalog.page').then((m) => m.CatalogPage),
        resolve: { list: catalogResolver },
        runGuardsAndResolvers: 'always',
      },
      { path: 'productos', pathMatch: 'full', redirectTo: ({ queryParams }) => inject(Router).createUrlTree(['/tienda'], { queryParams }) },
      { path: 'catalogo', pathMatch: 'full', redirectTo: ({ queryParams }) => inject(Router).createUrlTree(['/tienda'], { queryParams }) },
      { path: 'productos/:handle', redirectTo: ({ params }) => `/producto/${params['handle']}` },
      { path: 'terminos', redirectTo: '/terminos-y-condiciones' },
      { path: 'privacidad', redirectTo: '/politica-de-privacidad' },
      {
        path: 'producto/:handle',
        resolve: { productLoaded: selectaProductResolver },
        loadComponent: () => import('./product.page').then((m) => m.SelectaProductPage),
      },
      {
        path: 'carrito',
        loadComponent: () => import('./cart.page').then((m) => m.SelectaCartPage),
      },
      {
        path: 'checkout',
        resolve: { productLoaded: selectaProductResolver },
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadComponent: () => import('./checkout.page').then((m) => m.SelectaCheckoutPage),
      },
      {
        path: 'pedido/:id',
        loadComponent: () => import('./order.page').then((m) => m.SelectaOrderPage),
      },
      { path: 'legal', loadComponent: legal },
      ...LEGAL_SLUGS.map((slug) => ({ path: slug, data: { slug }, loadComponent: legal })),
      {
        path: '**',
        loadComponent: () => import('./not-found.page').then((m) => m.SelectaNotFoundPage),
      },
    ],
  },
];
