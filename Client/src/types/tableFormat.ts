export interface TableFormat {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tier: 'core' | 'advanced';
  isSystem: boolean;
}
