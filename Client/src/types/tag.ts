export interface Tag {
  id: string;
  namespace: string;
  value: string;
  label: string;
  isSystem: boolean;
}

export function tagKey(tag: Pick<Tag, 'namespace' | 'value'>): string {
  return `${tag.namespace}:${tag.value}`;
}
