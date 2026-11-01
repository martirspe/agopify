import { ProductDto } from '../../core/api/catalog-api.service';

export type CatalogListState = {
  kind: 'todos' | 'productos' | 'servicios' | 'digitales';
  query: string;
  status: 'todos' | 'activo' | 'borrador' | 'archivado' | 'disponibles' | 'pausados';
  publication: 'todos' | 'visibles' | 'ocultos' | 'whatsapp' | 'instagram';
  inventory?: 'todos' | 'agotados';
  sort: 'recientes' | 'antiguos' | 'nombre' | 'nombre-desc';
  page: number;
  pageSize: number;
};
const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

function channelPublished(product: ProductDto, channel: 'STORE' | 'WHATSAPP' | 'INSTAGRAM'): boolean {
  return product.channelListings?.some((row) => row.channel === channel && row.isPublished)
    ?? (channel === 'STORE' ? product.isPublishedOnStore : false);
}

/** Sets require component availability; do not infer it from their parent stock. */
export function catalogStock(product: ProductDto): number | null {
  if (product.kind !== 'PRODUCT' || product.components?.length) return null;
  if (product.variants?.length) {
    return product.variants.filter(variant => variant.isAvailable)
      .reduce((total, variant) => total + Math.max(variant.stockQty ?? 0, 0), 0);
  }
  return product.stockUnlimited ? null : Math.max(product.stockQty ?? 0, 0);
}

export function filterCatalog(products: ProductDto[], state: CatalogListState): ProductDto[] {
  const words = normalize(state.query.trim()).split(/\s+/).filter(Boolean);
  const kind = state.kind === 'todos' ? undefined : ({ productos: 'PRODUCT', servicios: 'SERVICE', digitales: 'DIGITAL' } as const)[state.kind];
  return products.filter(product => {
    if (kind && product.kind !== kind) return false;
    const status = product.status ?? (product.isAvailable ? 'ACTIVE' : 'DRAFT');
    if (state.status === 'activo' && status !== 'ACTIVE') return false;
    if (state.status === 'borrador' && status !== 'DRAFT') return false;
    if (state.status === 'archivado' && status !== 'ARCHIVED') return false;
    // Legacy query values from older bookmarks.
    if (state.status === 'disponibles' && status !== 'ACTIVE') return false;
    if (state.status === 'pausados' && status === 'ACTIVE') return false;
    if (state.publication === 'visibles' && !channelPublished(product, 'STORE')) return false;
    if (state.publication === 'ocultos' && channelPublished(product, 'STORE')) return false;
    if (state.publication === 'whatsapp' && !channelPublished(product, 'WHATSAPP')) return false;
    if (state.publication === 'instagram' && !channelPublished(product, 'INSTAGRAM')) return false;
    if (state.inventory === 'agotados' && catalogStock(product) !== 0) return false;
    const text = normalize([product.name, product.handle, product.sku, product.brand, product.line, ...product.categories, ...(product.variants ?? []).map(v => v.sku)].filter(Boolean).join(' '));
    return words.every(word => text.includes(word));
  }).sort((a, b) => {
    const byName = a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true });
    if (state.sort === 'nombre' || state.sort === 'nombre-desc') return (state.sort === 'nombre' ? byName : -byName) || a.id.localeCompare(b.id);
    const byDate = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return (state.sort === 'antiguos' ? byDate : -byDate) || byName || a.id.localeCompare(b.id);
  });
}

/** Export public catalog facts only; neutralize spreadsheet formulas in merchant text. */
export function catalogCsv(products: ProductDto[]): string {
  const cell = (value: string | number) => {
    let text = String(value);
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows: Array<Array<string | number>> = [['Nombre', 'SKU', 'Tipo', 'Moneda', 'Precio', 'Stock', 'Estado', 'Tienda', 'WhatsApp', 'Instagram', 'Marca', 'Colecciones']];
  for (const p of products) {
    const status = p.status ?? (p.isAvailable ? 'ACTIVE' : 'DRAFT');
    const statusLabel = status === 'ACTIVE' ? 'Activo' : status === 'ARCHIVED' ? 'Archivado' : 'Borrador';
    rows.push([
      p.name,
      p.sku ?? '',
      p.kind === 'SERVICE' ? 'Servicio' : p.kind === 'DIGITAL' ? 'Digital' : 'Producto',
      p.currency,
      (p.basePriceCents / 100).toFixed(2),
      p.stockUnlimited ? 'Ilimitado' : p.stockQty ?? '',
      statusLabel,
      channelPublished(p, 'STORE') ? 'Sí' : 'No',
      channelPublished(p, 'WHATSAPP') ? 'Sí' : 'No',
      channelPublished(p, 'INSTAGRAM') ? 'Sí' : 'No',
      p.brand ?? '',
      p.categories.join(', '),
    ]);
  }
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
