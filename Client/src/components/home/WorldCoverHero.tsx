import { useRef, useState, type ChangeEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import type { World } from '../../types/world';
import { useWorldStore } from '../../store/useWorldStore';
import { uploadAsset } from '../../api/resources/assets';
import { isAllowedImageFile } from '../../utils/fileValidation';

/** Two hues from the world's name, so a world with no cover still gets a banner of its own
 * rather than the same grey slab as every other one. */
function nameGradient(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(120deg, hsl(${hue} 45% 22%) 0%, hsl(${(hue + 50) % 360} 50% 32%) 55%, hsl(${(hue + 110) % 360} 40% 18%) 100%)`;
}

/**
 * The World Home page's wide cover banner: the world's cover photo (worlds.cover_image_asset_id)
 * edge to edge, with the name and description over a bottom scrim so the text stays readable
 * on any image. The DM swaps it from the button in the corner - an upload, not a URL, so the
 * picture lives in the assets table like every other image in the app.
 */
export function WorldCoverHero({ world }: { world: World }) {
  const updateWorld = useWorldStore((s) => s.updateWorld);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!isAllowedImageFile(file)) {
      setError('That file is not a supported image.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const asset = await uploadAsset(file, 'world_image');
      await updateWorld(world.id, { coverImageAssetId: asset.id });
    } catch (err) {
      setError(err instanceof Error ? `Upload failed: ${err.message}` : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const hasCover = !!world.coverImageSrc;

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 3,
        mb: 3,
        // Wide on purpose: a banner, not a portrait. Clamped so it neither towers over the
        // page on a tall monitor nor collapses to a strip on a phone.
        aspectRatio: { xs: '16 / 9', sm: '21 / 7' },
        maxHeight: 360,
        minHeight: 180,
        backgroundColor: 'grey.900',
        backgroundImage: hasCover ? `url(${world.coverImageSrc})` : nameGradient(world.name),
        backgroundSize: 'cover',
        backgroundPosition: 'center 40%',
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      {/* bottom scrim - keeps white text legible over a bright sky */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0) 75%)',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ position: 'relative', p: { xs: 2, sm: 3 }, color: 'common.white', maxWidth: 820 }}>
        <Typography
          component="h1"
          variant="h4"
          sx={{ fontWeight: 700, textShadow: '0 2px 8px rgba(0,0,0,0.6)', lineHeight: 1.15 }}
        >
          {world.name}
        </Typography>
        {world.description && (
          <Typography variant="body1" sx={{ mt: 0.75, opacity: 0.92, textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>
            {world.description}
          </Typography>
        )}
        {error && (
          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'error.light' }}>
            {error}
          </Typography>
        )}
      </Box>

      <Button
        size="small"
        variant="contained"
        color="inherit"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        startIcon={uploading ? <CircularProgress size={14} /> : <AddPhotoAlternateOutlinedIcon fontSize="small" />}
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          bgcolor: 'rgba(0,0,0,0.45)',
          color: 'common.white',
          backdropFilter: 'blur(4px)',
          boxShadow: 'none',
          '&:hover': { bgcolor: 'rgba(0,0,0,0.65)', boxShadow: 'none' },
        }}
      >
        {uploading ? 'Uploading…' : hasCover ? 'Change cover' : 'Add cover photo'}
      </Button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
    </Box>
  );
}
