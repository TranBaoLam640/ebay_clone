import type { CSSProperties } from 'react';

// Icon variants correspond to <symbol id="..."> entries in assets/icons.svg.
export type IconVariant =
  | 'icon-search'
  | 'icon-globe'
  | 'icon-cart'
  | 'icon-user'
  | 'icon-bell'
  | 'icon-star'
  | 'icon-star-fill'
  | 'icon-heart'
  | 'icon-sun'
  | 'icon-moon'
  | 'icon-chevron-down'
  | 'icon-chevron-right'
  | 'icon-close'
  | 'icon-check'
  | 'icon-loading'
  | 'icon-filter'
  | 'icon-eye'
  | 'icon-eye-off'
  | 'icon-trash'
  | 'icon-edit'
  | 'icon-plus'
  | 'icon-minus'
  | 'icon-home'
  | 'icon-package'
  | 'icon-logout'
  | 'icon-arrow-left'
  | 'icon-map-pin'
  | 'icon-shield'
  | 'icon-truck'
  | 'icon-refresh'
  | 'icon-headset'
  | 'icon-tag'
  | 'icon-sparkles'
  | 'icon-quote'
  | 'icon-arrow-right'
  | 'icon-lock'
  | 'icon-mail'
  | 'icon-phone'
  | 'icon-grid'
  | 'icon-menu'
  | 'icon-laptop'
  | 'icon-smartphone'
  | 'icon-shirt'
  | 'icon-watch'
  | 'icon-gamepad'
  | 'icon-book'
  | 'icon-camera'
  | 'icon-dumbbell'
  | 'icon-home-goods'
  | 'icon-gift'
  | 'icon-baby'
  | 'icon-heart-pulse';

interface IconProps {
  variant: IconVariant;
  size?: number;
  className?: string;
  style?: CSSProperties;
  spin?: boolean;
  'aria-hidden'?: boolean;
  title?: string;
}

/**
 * Renders an icon from the SVG sprite via <use href="#id">.
 * Inherits `currentColor`, so color follows surrounding text/theme.
 */
export function Icon({
  variant,
  size = 20,
  className,
  style,
  spin = false,
  title,
  ...rest
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      style={{ ...style, ...(spin ? { animation: 'spin 0.8s linear infinite' } : {}) }}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : rest['aria-hidden'] ?? true}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <use href={`#${variant}`} />
    </svg>
  );
}
