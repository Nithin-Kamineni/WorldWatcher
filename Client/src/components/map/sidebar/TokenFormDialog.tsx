import { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { isAllowedImageFile } from '../../../utils/fileValidation';
import {
  DEFAULT_RELATIVE_SIZE,
  MAX_RELATIVE_SIZE,
  MIN_RELATIVE_SIZE,
  type TokenDefinition,
} from '../../../types/token';

interface TokenFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (token: TokenDefinition) => void;
  initialToken?: TokenDefinition;
}

export function TokenFormDialog({ open, onClose, onSubmit, initialToken }: TokenFormDialogProps) {
  const isEditMode = !!initialToken;
  const [name, setName] = useState('');
  const [imageSrc, setImageSrc] = useState('');
  const [defaultSize, setDefaultSize] = useState(DEFAULT_RELATIVE_SIZE);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialToken?.name ?? '');
    setImageSrc(initialToken?.imageSrc ?? '');
    setDefaultSize(initialToken?.defaultSize ?? DEFAULT_RELATIVE_SIZE);
    setFileError(null);
  }, [open, initialToken]);

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!isAllowedImageFile(file)) {
      setFileError('Please upload a PNG or JPG image.');
      return;
    }
    setImageSrc(URL.createObjectURL(file));
  };

  const isValid = name.trim().length > 0 && imageSrc.length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    const token: TokenDefinition = {
      id: initialToken?.id ?? crypto.randomUUID(),
      name: name.trim(),
      imageSrc,
      isFavorite: initialToken?.isFavorite ?? false,
      defaultSize,
      currentSize: initialToken?.currentSize ?? defaultSize,
    };
    onSubmit(token);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{isEditMode ? 'Edit Token' : 'Add Token'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1, alignItems: 'center' }}>
          <Box
            onClick={() => fileInputRef.current?.click()}
            sx={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              overflow: 'hidden',
              cursor: 'pointer',
              border: '2px dashed',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'action.hover',
              flexShrink: 0,
            }}
          >
            {imageSrc ? (
              <Box component="img" src={imageSrc} alt={name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Box sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center', px: 1 }}>Click to upload</Box>
            )}
          </Box>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={handleFileSelected}
          />

          <TextField
            label="Token name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            autoFocus
          />

          <TextField
            label="Default size (× grid cell)"
            type="number"
            value={defaultSize}
            onChange={(e) => setDefaultSize(Number(e.target.value))}
            fullWidth
            helperText="1.0 = one full grid square. Used the next time this token is dragged onto the map."
            slotProps={{ htmlInput: { step: 0.1, min: MIN_RELATIVE_SIZE, max: MAX_RELATIVE_SIZE } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!isValid}>
          {isEditMode ? 'Save Changes' : 'Add Token'}
        </Button>
      </DialogActions>
      <Snackbar open={!!fileError} autoHideDuration={4000} onClose={() => setFileError(null)}>
        <Alert severity="error" onClose={() => setFileError(null)} sx={{ width: '100%' }}>
          {fileError}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}
