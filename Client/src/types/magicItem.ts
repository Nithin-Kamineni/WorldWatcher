export type MagicItemRarity = 'common' | 'uncommon' | 'rare' | 'very-rare' | 'legendary' | 'artifact';

export interface MagicItemRarityOption {
  value: MagicItemRarity;
  label: string;
  color: 'default' | 'success' | 'info' | 'secondary' | 'warning' | 'error';
}

export const MAGIC_ITEM_RARITY_OPTIONS: MagicItemRarityOption[] = [
  { value: 'common', label: 'Common', color: 'default' },
  { value: 'uncommon', label: 'Uncommon', color: 'success' },
  { value: 'rare', label: 'Rare', color: 'info' },
  { value: 'very-rare', label: 'Very Rare', color: 'secondary' },
  { value: 'legendary', label: 'Legendary', color: 'warning' },
  { value: 'artifact', label: 'Artifact', color: 'error' },
];

export function getMagicItemRarityOption(rarity: MagicItemRarity): MagicItemRarityOption {
  return MAGIC_ITEM_RARITY_OPTIONS.find((o) => o.value === rarity) ?? MAGIC_ITEM_RARITY_OPTIONS[0];
}

export interface MagicItem {
  id: string;
  name: string;
  type: string;
  rarity: MagicItemRarity;
  attunement: boolean;
  attunementRequirement?: string;
  description: string;
  imageSrc: string;
  createdAt: number;
  updatedAt: number;
}
