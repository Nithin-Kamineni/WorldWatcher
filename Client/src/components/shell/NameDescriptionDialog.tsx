import { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import CircularProgress from '@mui/material/CircularProgress';
import PublicIcon from '@mui/icons-material/Public';
import { uploadAsset } from '../../api/resources/assets';

interface NameDescriptionDialogProps {
  open: boolean;
  title: string;
  nameLabel?: string;
  initialName?: string;
  initialDescription?: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (name: string, description: string, imageAssetId?: string) => void | Promise<void>;
  /** Shows a logo/cover-image upload control above the name field (used for World create/edit
   * in the Dashboard - issues.txt: "upload our world logo or image ... while we create a new
   * world or edit"). Off by default since Campaign uses this same dialog and doesn't need it. */
  imageUpload?: boolean;
  initialImageUrl?: string;
}

/** Minimal create/edit dialog shared by "+ New world"/"+ New campaign" and
 * their edit-in-place counterparts. Pass initialName/initialDescription to seed edit mode;
 * pass imageUpload for the optional logo picker (World only). */
export function NameDescriptionDialog({
  open,
  title,
  nameLabel = 'Name',
  initialName = '',
  initialDescription = '',
  submitLabel,
  onClose,
  onSubmit,
  imageUpload,
  initialImageUrl,
}: NameDescriptionDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [submitting, setSubmitting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState(initialImageUrl ?? '');
  const [imageAssetId, setImageAssetId] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription);
      setImagePreview(initialImageUrl ?? '');
      setImageAssetId(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(name.trim(), description.trim(), imageAssetId);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickImage = async (file: File | undefined) => {
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    setImageUploading(true);
    try {
      const asset = await uploadAsset(file, 'world_image');
      setImageAssetId(asset.id);
    } finally {
      setImageUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {imageUpload && (
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar src={imagePreview || undefined} variant="rounded" sx={{ width: 64, height: 64 }}>
                  <PublicIcon />
                </Avatar>
                {imageUploading && (
                  <CircularProgress
                    size={64}
                    sx={{ position: 'absolute', top: 0, left: 0 }}
                  />
                )}
              </Box>
              <Stack spacing={0.5}>
                <Button size="small" variant="outlined" onClick={() => fileInputRef.current?.click()} disabled={imageUploading}>
                  {imagePreview ? 'Change logo' : 'Upload logo'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => handlePickImage(e.target.files?.[0])}
                />
              </Stack>
            </Stack>
          )}
          <TextField
            label={nameLabel}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            fullWidth
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!name.trim() || submitting || imageUploading}>
          {submitLabel ?? 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
