import { Link } from "@tanstack/react-router";

/**
 * The product wordmark, as a link home.
 *
 * Single source on purpose: the sidebar was rebranded to SEO.XEBRA while the
 * mobile header kept rendering its own hardcoded "OpenSEO", so the brand only
 * looked right on desktop. Anything showing the wordmark renders this.
 */
export function BrandWordmark({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <Link
      to="/"
      onClick={onNavigate}
      className={`font-brand tracking-tight text-base-content ${className ?? "text-base"}`}
    >
      SEO.XEBRA
    </Link>
  );
}
