# Rosaline · Bold Modern

The requested page is the supplied Rosaline 1.0.0 / Themesflat home-bold-modern.html. Its markup, class names, images, icon font and CSS are the visual reference. This integration does not introduce a replacement art direction.

## Source migration

The renderer lives in apps/store/src/app/templates/rosaline. The original-* templates retain the source section structure: floating header, hero, counters, product tabs, categories, brands, expert composition, five-step guide, image comparison, featured product, newsletter banner, three video cards and dark footer.

reference.css contains the original Bootstrap, Swiper, animate, image-compare, Icomoon and Rosaline styles. Selectors are scoped below body.tpl-rosaline .ro-shell, asset URLs are local, animations are namespaced and the icon family is renamed to Rosaline Icons. Visual declaration values are preserved. reference-provenance.json records SHA-256 source hashes. Regenerate with:

    node scripts/import-rosaline-reference.cjs <original-template-directory>

rosaline.scss provides local font declarations and the structural adapters needed by native dialogs, Angular component hosts, scroll sliders, comparison and keyboard focus. Typography, colors, gutters, breakpoints and component shapes come from the source stylesheet. Local fonts include Anton, Geist, Poppins and Instrument Serif with OFL notices. The original Icomoon glyphs are retained. No jQuery or vendor JavaScript runtime is loaded.

## Native runtime

Angular state replaces Bootstrap offcanvas/modals, tab changes, quantity controls, gallery navigation, ritual steps and image comparison. IntersectionObserver replaces WOW; the source marquee speed is retained. Carousel columns and gaps follow the original data attributes and breakpoints. Footer disclosures preserve the source mobile behavior.

Catalog cards and spotlight reuse the existing purchase component. The cart drawer uses CartService for lines, quantities and subtotal. Checkout, stock validation, host tenant resolution, SEO, signed previews and the visual editor remain in the existing engine. Product/cart/checkout/order/legal pages reuse existing domain views with Rosaline `--store-*` adapters (typography, square controls, brand CTAs); they are not ports of additional ThemeForest HTML pages.

The current console release is vendedoria/rosaline@1.1.0, available for every industry; v1.0.0 is preserved unchanged. Renderer rosaline@1 and the bold-modern preset retain the same presentation. A no-op migration preserves merchant content between these versions. Existing themes retain their identities and manifests. Shared editor field names retain existing sanitizer types and limits.

## Data boundaries and remaining differences

The isolated /_templates/rosaline/ demo contains source photography and sample copy. Orders and charges remain blocked by the existing demo interceptor. The reference serum has its original five gallery images. Tenant presets contain no sample products or proof claims; merchant data supplies production content.

Navigation destinations, product data, category counts, currency and legal destinations are mapped to the current store. Wishlist, account, newsletter subscriptions and vendor demo megamenus do not have equivalent platform capabilities. Sample-only decorative controls/forms remain inert where present; unsupported live controls are omitted. Merchant product tabs use real categories. Source testimonials/counters/certifications and before/after claims require merchant content and start hidden.

Native scrolling replaces Swiper internals; source drag physics, zoom/lightbox and all scroll-driven text effects are not certified as identical. This is a faithful source-based homepage migration with documented integration boundaries, not a verified pixel-identical port of the complete commercial template.

## License

The supplied directory is an HTTrack mirror without purchase certificate or SaaS redistribution terms. The manifest records LicenseRef-ThemeForest-Pending. Photography and commercial redistribution rights remain unverified. No production publication was performed.
