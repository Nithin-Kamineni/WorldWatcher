export interface World {
  id: string;
  name: string;
  imageSrc: string;
  /** Wide banner for the World Home page. Empty when the DM has not uploaded one - the page
   * then falls back to the bundled art for the two sample worlds, or a gradient. */
  coverImageSrc: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}
