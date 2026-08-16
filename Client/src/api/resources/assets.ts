import { apiUpload } from '../client';
import type { ApiAsset } from '../types';

export function uploadAsset(file: File, assetType: string): Promise<ApiAsset> {
  return apiUpload<ApiAsset>('/assets/upload', file, { asset_type: assetType });
}
