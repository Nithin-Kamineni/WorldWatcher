import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import CasinoIcon from '@mui/icons-material/Casino';
import TuneIcon from '@mui/icons-material/Tune';
import { isAllowedImageFile } from '../../utils/fileValidation';
import { TipTapArticleEditor } from './richtext/TipTapArticleEditor';
import { toEditorHtml } from './richtext/bbcodeMigration';
import { getArticleBodyTemplate } from './richtext/articleBodyTemplates';
import { ArticleContentView } from './ArticleContentView';
import { ItemListField } from '../dm/ItemListField';
import { useArticleRandomBankStore, pickRandomFromBank, randomTavernName } from '../../store/useArticleRandomBankStore';
import {
  ARTICLE_TEMPLATES,
  ARTICLE_VISIBILITY_OPTIONS,
  DEFAULT_ARTICLE_COVER_IMAGE,
  getVisibleSections,
  type Article,
  type ArticleCategory,
  type ArticleFolder,
  type ArticleLinkedEntityType,
  type ArticleVisibility,
} from '../../types/article';

interface ArticleFormProps {
  worldId: string;
  category: ArticleCategory;
  folders: ArticleFolder[];
  initialArticle?: Article;
  /** Set when this article is being created to document a "real" NPC/Creature/Spell/Item
   * (issue 4c/4f/4h) - carried through onto the submitted Article so the two stay linked. */
  linkedEntity?: { type: ArticleLinkedEntityType; id: string } | null;
  onCancel: () => void;
  onSubmit: (article: Article) => void;
}

/** Parses one of the itemized newline-joined fieldValues entries into a list for
 * ItemListField; the inverse of Array.join('\n') - same convention as NpcFormDialog's
 * parseItems for traits/appearance/secrets/relationships. */
function parseItems(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function TagListField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Autocomplete<string, true, false, true>
      multiple
      freeSolo
      options={[]}
      value={value}
      onChange={(_e, next) => onChange(next as string[])}
      renderValue={(vals, getItemProps) => vals.map((tag, index) => <Chip label={tag} size="small" {...getItemProps({ index })} key={tag} />)}
      renderInput={(params) => <TextField {...params} label="Tags" placeholder="Type and press Enter" />}
    />
  );
}

const COVER_BANNER_HEIGHT = 280;

/** One generic editor, driven entirely by ARTICLE_TEMPLATES[category].sections (types/
 * article.ts) - renders every category from the same component. Laid out like a blog-post
 * editor: a page-level Write/Preview toggle gates the whole page (not just the BBCode box),
 * a full-width cover banner replaces the old avatar-style picker, and everything besides
 * name/cover/body collapses into a "More options" accordion (folder/visibility/tags, then
 * the per-category template fields - filtered through getVisibleSections so fields that
 * duplicate a linked NPC's own Combat/Roleplay card never appear here or in Preview). */
export function ArticleForm({ worldId, category, folders, initialArticle, linkedEntity, onCancel, onSubmit }: ArticleFormProps) {
  const template = ARTICLE_TEMPLATES[category];
  const isEditMode = !!initialArticle;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  const [name, setName] = useState(initialArticle?.name ?? '');
  const [coverImageSrc, setCoverImageSrc] = useState(initialArticle?.coverImageSrc ?? '');
  const [tags, setTags] = useState<string[]>(initialArticle?.tags ?? []);
  const [visibility, setVisibility] = useState<ArticleVisibility>(initialArticle?.visibility ?? 'gm');
  const [folderId, setFolderId] = useState<string | null>(initialArticle?.folderId ?? null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(initialArticle?.fieldValues ?? {});
  const [body, setBody] = useState(() =>
    initialArticle ? toEditorHtml(initialArticle.body) : getArticleBodyTemplate(category),
  );

  const linkedEntityType = initialArticle?.linkedEntityType ?? linkedEntity?.type ?? null;
  const visibleSections = getVisibleSections(template, linkedEntityType);

  const fetchArticleRandomBanks = useArticleRandomBankStore((s) => s.fetchBanks);
  useEffect(() => {
    fetchArticleRandomBanks();
  }, [fetchArticleRandomBanks]);

  useEffect(() => {
    setName(initialArticle?.name ?? '');
    setCoverImageSrc(initialArticle?.coverImageSrc ?? '');
    setTags(initialArticle?.tags ?? []);
    setVisibility(initialArticle?.visibility ?? 'gm');
    setFolderId(initialArticle?.folderId ?? null);
    setFieldValues(initialArticle?.fieldValues ?? {});
    setBody(initialArticle ? toEditorHtml(initialArticle.body) : getArticleBodyTemplate(category));
  }, [initialArticle, category]);

  const setField = (key: string, value: string) => setFieldValues((prev) => ({ ...prev, [key]: value }));

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isAllowedImageFile(file)) return;
    setCoverImageSrc(URL.createObjectURL(file));
  };

  const isValid = name.trim().length > 0;

  const buildDraft = (): Article => {
    const now = Date.now();
    return {
      id: initialArticle?.id ?? crypto.randomUUID(),
      worldId,
      folderId,
      category,
      name: name.trim(),
      coverImageSrc,
      tags,
      visibility,
      fieldValues,
      body: body.trim(),
      linkedEntityType,
      linkedEntityId: initialArticle?.linkedEntityId ?? linkedEntity?.id ?? null,
      createdAt: initialArticle?.createdAt ?? now,
      updatedAt: now,
    };
  };

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit(buildDraft());
  };

  return (
    <Box sx={{ maxWidth: 920 }}>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 2,
          bgcolor: 'background.default',
          py: 1.5,
          mb: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_e, v) => v && setMode(v)}>
          <ToggleButton value="write">Write</ToggleButton>
          <ToggleButton value="preview">Preview</ToggleButton>
        </ToggleButtonGroup>
        <Stack direction="row" spacing={1.5}>
          <Button onClick={onCancel} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={!isValid}>
            {isEditMode ? 'Save changes' : 'Create article'}
          </Button>
        </Stack>
      </Stack>

      {mode === 'preview' ? (
        <ArticleContentView article={buildDraft()} template={template} />
      ) : (
        <Stack spacing={2.5}>
          <Box
            sx={{
              height: COVER_BANNER_HEIGHT,
              borderRadius: 3,
              backgroundImage: `url(${coverImageSrc || DEFAULT_ARTICLE_COVER_IMAGE})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              position: 'relative',
              overflow: 'hidden',
              border: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              p: 2,
              '&::after': {
                content: '""',
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.45) 100%)',
              },
            }}
          >
            <Button
              size="small"
              variant="contained"
              startIcon={<AddPhotoAlternateIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ position: 'relative', bgcolor: 'rgba(0,0,0,0.6)', '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' } }}
            >
              {coverImageSrc ? 'Change cover image' : 'Upload cover image'}
            </Button>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" hidden onChange={handleFileSelected} />
          </Box>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              variant="standard"
              placeholder="Article title…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              autoFocus
              slotProps={{ input: { disableUnderline: true, sx: { fontSize: 34, fontWeight: 700 } } }}
            />
            {category === 'building' && fieldValues.buildingType === 'Tavern' && (
              <Tooltip title="Generate a tavern name">
                <IconButton onClick={() => setName(randomTavernName())}>
                  <CasinoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          <TipTapArticleEditor value={body} onChange={setBody} placeholder="Write your article…" />

          <Accordion disableGutters sx={{ '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <TuneIcon fontSize="small" color="action" />
                <Typography sx={{ fontWeight: 600 }}>More options</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={2}>
                  <TextField
                    select
                    label="Folder"
                    value={folderId ?? ''}
                    onChange={(e) => setFolderId(e.target.value || null)}
                    fullWidth
                  >
                    <MenuItem value="">(none)</MenuItem>
                    {folders.map((f) => (
                      <MenuItem key={f.id} value={f.id}>
                        {f.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label="Visibility"
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as ArticleVisibility)}
                    fullWidth
                  >
                    {ARTICLE_VISIBILITY_OPTIONS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>
                        {o.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>

                <TagListField value={tags} onChange={setTags} />

                {visibleSections.map((section) => (
                  <Paper key={section.label} variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                      {section.label}
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
                      {section.fields
                        .filter((field) => !field.showWhen || fieldValues[field.showWhen.field] === field.showWhen.equals)
                        .map((field) => {
                        const value = fieldValues[field.key] ?? '';
                        const spanFull = field.type === 'textarea' || field.type === 'itemlist';
                        if (field.type === 'itemlist') {
                          const items = parseItems(value);
                          return (
                            <Box key={field.key} sx={spanFull ? { gridColumn: '1 / -1' } : undefined}>
                              <ItemListField
                                label={field.label}
                                items={items}
                                onChange={(next) => setField(field.key, next.join('\n'))}
                                onPickRandom={() => (field.bankKey ? pickRandomFromBank(field.bankKey) : '')}
                              />
                            </Box>
                          );
                        }
                        if (field.type === 'select') {
                          return (
                            <TextField
                              key={field.key}
                              select
                              label={field.label}
                              value={value}
                              onChange={(e) => setField(field.key, e.target.value)}
                              fullWidth
                              sx={spanFull ? { gridColumn: '1 / -1' } : undefined}
                            >
                              <MenuItem value="">(unset)</MenuItem>
                              {field.options?.map((opt) => (
                                <MenuItem key={opt} value={opt}>
                                  {opt}
                                </MenuItem>
                              ))}
                            </TextField>
                          );
                        }
                        return (
                          <TextField
                            key={field.key}
                            label={field.label}
                            placeholder={field.placeholder}
                            value={value}
                            onChange={(e) => setField(field.key, e.target.value)}
                            type={field.type === 'number' ? 'number' : 'text'}
                            multiline={field.type === 'textarea'}
                            minRows={field.type === 'textarea' ? 2 : undefined}
                            fullWidth
                            sx={spanFull ? { gridColumn: '1 / -1' } : undefined}
                          />
                        );
                      })}
                    </Box>
                  </Paper>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Stack>
      )}
    </Box>
  );
}
