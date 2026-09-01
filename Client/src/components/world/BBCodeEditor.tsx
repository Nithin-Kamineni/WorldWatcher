import { useRef } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import TitleIcon from '@mui/icons-material/Title';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import LinkIcon from '@mui/icons-material/Link';
import ImageIcon from '@mui/icons-material/Image';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import { BBCODE_TOOLBAR_TAGS } from '../../utils/bbcode';
import { useMentionInput } from '../../hooks/useMentionInput';

const TOOLBAR_ICONS: Record<string, React.ReactNode> = {
  Bold: <FormatBoldIcon fontSize="small" />,
  Italic: <FormatItalicIcon fontSize="small" />,
  Underline: <FormatUnderlinedIcon fontSize="small" />,
  Strikethrough: <StrikethroughSIcon fontSize="small" />,
  Heading: <TitleIcon fontSize="small" />,
  Quote: <FormatQuoteIcon fontSize="small" />,
  List: <FormatListBulletedIcon fontSize="small" />,
  Link: <LinkIcon fontSize="small" />,
  Image: <ImageIcon fontSize="small" />,
  Center: <FormatAlignCenterIcon fontSize="small" />,
};

interface BBCodeEditorProps {
  label?: string;
  /** Suppresses the "{label} (BBCode)" caption above the toolbar - used where the surrounding
   * page already makes clear what's being edited (e.g. the Notes editor). */
  hideLabel?: boolean;
  value: string;
  onChange: (value: string) => void;
  /** When both are set, typing "@" opens the entity-mention picker (NPCs/Creatures/Spells/
   * Encounters/Places/Factions) scoped to this world/campaign. Omit to leave mentions off. */
  worldId?: string;
  campaignId?: string;
}

/** Article body editor: a plain textarea of raw BBCode plus a small toolbar that wraps the
 * current selection in the picked tag pair. No rich-text library in this codebase, so this
 * is a hand-rolled textarea editor rather than a WYSIWYG one. Sized to read as a real editor
 * page (tall, no max-height) rather than a form input - ArticleForm's page-level Write/
 * Preview toggle owns switching to the rendered view (ArticleContentView), this component
 * only ever renders the Write side. When worldId/campaignId are supplied, also supports
 * "@"-triggered entity mentions (see MentionPicker/useMentionableEntities). */
export function BBCodeEditor({ label = 'Overview', hideLabel = false, value, onChange, worldId, campaignId }: BBCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { mentionsEnabled, handleChange, handleKeyDown, MentionPickerElement } = useMentionInput({
    value,
    onChange,
    worldId,
    campaignId,
    textareaRef,
  });

  const wrapSelection = (open: string, close: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);
    const next = `${before}${open}${selected}${close}${after}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + open.length + selected.length + close.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <Box>
      {!hideLabel && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          {label} (BBCode)
        </Typography>
      )}
      <Stack direction="row" spacing={0.25} sx={{ mb: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {BBCODE_TOOLBAR_TAGS.map((t) => (
          <Tooltip key={t.label} title={t.label}>
            <Button
              size="small"
              onClick={() => wrapSelection(t.open, t.close)}
              sx={{ minWidth: 32, px: 0.75, color: 'text.secondary' }}
            >
              {TOOLBAR_ICONS[t.label]}
            </Button>
          </Tooltip>
        ))}
        {mentionsEnabled && (
          <Tooltip title='Mention an NPC, Creature, Spell, Encounter, Place, or Faction (type "@")'>
            <AlternateEmailIcon fontSize="small" sx={{ ml: 0.75, color: 'text.disabled' }} />
          </Tooltip>
        )}
      </Stack>
      <TextField
        inputRef={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="The free-text narrative for this article, in BBCode ([b]bold[/b], [i]italic[/i], [url]...[/url]…)"
        multiline
        minRows={20}
        fullWidth
        sx={{ '& .MuiInputBase-root': { alignItems: 'flex-start', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 14 } }}
      />
      {MentionPickerElement}
    </Box>
  );
}
