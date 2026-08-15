import type { IconVariant } from '@/components/icon';

/**
 * Resolves a sensible icon from a category name by keyword matching, so tiles
 * stop showing a random rotating icon. Rules are ordered most-specific first
 * (e.g. "gaming laptop" → gamepad beats laptop) and cover both English and
 * Vietnamese terms. Unknown categories fall back to a neutral tag icon.
 */
const RULES: { icon: IconVariant; keywords: string[] }[] = [
  // Audio must precede smartphone: "headphone" contains "phone".
  { icon: 'icon-headset', keywords: ['audio', 'headphone', 'headset', 'earphone', 'tai nghe', 'speaker', 'loa', 'sound', 'âm thanh'] },
  { icon: 'icon-gamepad', keywords: ['gaming', 'game', 'console', 'chơi game'] },
  { icon: 'icon-laptop', keywords: ['laptop', 'ultrabook', 'macbook', 'notebook', 'máy tính', 'computer', 'pc'] },
  { icon: 'icon-smartphone', keywords: ['smartphone', 'phone', 'mobile', 'điện thoại', 'iphone', 'android'] },
  { icon: 'icon-camera', keywords: ['camera', 'máy ảnh', 'photo', 'chụp ảnh', 'quay phim'] },
  { icon: 'icon-watch', keywords: ['watch', 'đồng hồ', 'wearable', 'smartwatch'] },
  { icon: 'icon-shirt', keywords: ['fashion', 'clothing', 'apparel', 'thời trang', 'quần áo', 'áo', 'giày', 'shoe', 'wear'] },
  { icon: 'icon-heart-pulse', keywords: ['health', 'beauty', 'sức khỏe', 'làm đẹp', 'mỹ phẩm', 'cosmetic', 'care'] },
  { icon: 'icon-dumbbell', keywords: ['sport', 'fitness', 'gym', 'thể thao', 'tập luyện'] },
  { icon: 'icon-baby', keywords: ['baby', 'kid', 'child', 'trẻ em', 'mẹ và bé', 'em bé', 'toy', 'đồ chơi'] },
  { icon: 'icon-book', keywords: ['book', 'sách', 'stationery', 'văn phòng phẩm', 'office'] },
  { icon: 'icon-home-goods', keywords: ['home', 'furniture', 'kitchen', 'nhà cửa', 'nội thất', 'gia dụng', 'bếp', 'decor'] },
  { icon: 'icon-gift', keywords: ['gift', 'quà', 'voucher', 'khuyến mãi', 'deal'] },
  { icon: 'icon-package', keywords: ['electronic', 'device', 'gadget', 'điện tử', 'thiết bị', 'tech', 'công nghệ', 'accessor', 'phụ kiện'] },
];

/** Pick an icon for a category name; deterministic, no backend field needed. */
export function categoryIcon(name: string): IconVariant {
  const n = name.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => n.includes(k))) return rule.icon;
  }
  return 'icon-tag';
}
