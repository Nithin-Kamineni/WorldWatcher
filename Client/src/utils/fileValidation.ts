const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg'];

export function isAllowedImageFile(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.includes(file.type);
}
