import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import SubscriptIcon from '@mui/icons-material/Subscript';
import SuperscriptIcon from '@mui/icons-material/Superscript';
import FormatColorTextIcon from '@mui/icons-material/FormatColorText';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import CodeIcon from '@mui/icons-material/Code';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import LinkIcon from '@mui/icons-material/Link';
import ImageIcon from '@mui/icons-material/Image';
import TableChartIcon from '@mui/icons-material/TableChart';
import FormatClearIcon from '@mui/icons-material/FormatClear';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SmartButtonIcon from '@mui/icons-material/SmartButton';
import { isAllowedImageFile } from '../../../utils/fileValidation';

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
];

const FONT_SIZES = ['8', '10', '12', '14', '16', '18', '24', '30', '36', '48'];

const TEXT_COLORS = ['#1a1720', '#c8873a', '#b23b3b', '#2f7d4f', '#2f6fb2', '#7a4fb2', '#ffffff'];
const HIGHLIGHT_COLORS = ['#fff2a8', '#c8f5c8', '#c8e4f5', '#f5c8e0', '#e0c8f5'];

function ToolbarIconButton({
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton size="small" color={active ? 'primary' : 'default'} disabled={disabled} onClick={onClick}>
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function ColorSwatchPopover({
  title,
  icon,
  colors,
  onPick,
  onClear,
}: {
  title: string;
  icon: React.ReactNode;
  colors: string[];
  onPick: (color: string) => void;
  onClear: () => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip title={title}>
        <IconButton size="small" ref={anchorRef} onClick={() => setOpen(true)}>
          {icon}
        </IconButton>
      </Tooltip>
      <Popover open={open} anchorEl={anchorRef.current} onClose={() => setOpen(false)}>
        <Stack direction="row" spacing={0.75} sx={{ p: 1.25, flexWrap: 'wrap', maxWidth: 180 }}>
          {colors.map((c) => (
            <Box
              key={c}
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              sx={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                bgcolor: c,
                border: '1px solid rgba(0,0,0,0.2)',
                cursor: 'pointer',
              }}
            />
          ))}
          <Button
            size="small"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
          >
            Clear
          </Button>
        </Stack>
      </Popover>
    </>
  );
}

function LinkPopover({ editor }: { editor: Editor }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');

  return (
    <>
      <Tooltip title="Insert link">
        <IconButton
          size="small"
          ref={anchorRef}
          color={editor.isActive('link') ? 'primary' : 'default'}
          onClick={() => {
            setUrl(editor.getAttributes('link').href ?? '');
            setOpen(true);
          }}
        >
          <LinkIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Popover open={open} anchorEl={anchorRef.current} onClose={() => setOpen(false)}>
        <Stack direction="row" spacing={1} sx={{ p: 1.25, alignItems: 'center' }}>
          <TextField
            size="small"
            autoFocus
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && url.trim()) {
                editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
                setOpen(false);
              }
            }}
          />
          <Button
            size="small"
            variant="contained"
            disabled={!url.trim()}
            onClick={() => {
              editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
              setOpen(false);
            }}
          >
            Apply
          </Button>
          {editor.isActive('link') && (
            <Button
              size="small"
              onClick={() => {
                editor.chain().focus().unsetLink().run();
                setOpen(false);
              }}
            >
              Remove
            </Button>
          )}
        </Stack>
      </Popover>
    </>
  );
}

/** Docs/Word-style formatting ribbon driven entirely by the given editor instance's commands -
 * this is what replaces BBCodeEditor's small bracket-wrapping toolbar (utils/bbcode.ts's
 * BBCODE_TOOLBAR_TAGS) with real WYSIWYG controls. Only rendered while editing -
 * TipTapArticleEditor omits it in read-only mode. */
export function ArticleEditorToolbar({ editor }: { editor: Editor }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      subscript: e.isActive('subscript'),
      superscript: e.isActive('superscript'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      inTable: e.isActive('table'),
      align: (['left', 'center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left',
      heading: (e.getAttributes('heading').level as number | undefined) ?? 0,
      fontFamily: (e.getAttributes('textStyle').fontFamily as string | undefined) ?? '',
      fontSize: ((e.getAttributes('textStyle').fontSize as string | undefined) ?? '').replace('px', ''),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isAllowedImageFile(file)) return;
    editor.chain().focus().setImage({ src: URL.createObjectURL(file) }).run();
  };

  return (
    <Stack
      direction="row"
      spacing={0.25}
      sx={{
        flexWrap: 'wrap',
        alignItems: 'center',
        rowGap: 0.5,
        px: 1,
        py: 0.75,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        position: 'sticky',
        top: 0,
        zIndex: 3,
      }}
    >
      <ToolbarIconButton title="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        <UndoIcon fontSize="small" />
      </ToolbarIconButton>
      <ToolbarIconButton title="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
        <RedoIcon fontSize="small" />
      </ToolbarIconButton>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <Select
        size="small"
        value={state.heading}
        onChange={(e) => {
          const level = Number(e.target.value);
          if (level === 0) editor.chain().focus().setParagraph().run();
          else editor.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run();
        }}
        sx={{ minWidth: 130, '& .MuiSelect-select': { py: 0.5 } }}
      >
        <MenuItem value={0}>Normal text</MenuItem>
        <MenuItem value={1}>Heading 1</MenuItem>
        <MenuItem value={2}>Heading 2</MenuItem>
        <MenuItem value={3}>Heading 3</MenuItem>
      </Select>

      <Select
        size="small"
        value={state.fontFamily}
        displayEmpty
        onChange={(e) => {
          const v = e.target.value;
          if (v) editor.chain().focus().setFontFamily(v).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
        sx={{ minWidth: 130, '& .MuiSelect-select': { py: 0.5 } }}
      >
        {FONT_FAMILIES.map((f) => (
          <MenuItem key={f.label} value={f.value} sx={{ fontFamily: f.value || undefined }}>
            {f.label}
          </MenuItem>
        ))}
      </Select>

      <Select
        size="small"
        value={state.fontSize}
        displayEmpty
        onChange={(e) => {
          const v = e.target.value;
          if (v) editor.chain().focus().setFontSize(`${v}px`).run();
          else editor.chain().focus().unsetFontSize().run();
        }}
        sx={{ minWidth: 70, '& .MuiSelect-select': { py: 0.5 } }}
      >
        <MenuItem value="">--</MenuItem>
        {FONT_SIZES.map((s) => (
          <MenuItem key={s} value={s}>
            {s}
          </MenuItem>
        ))}
      </Select>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <ToggleButton size="small" value="bold" selected={state.bold} onChange={() => editor.chain().focus().toggleBold().run()}>
        <FormatBoldIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton size="small" value="italic" selected={state.italic} onChange={() => editor.chain().focus().toggleItalic().run()}>
        <FormatItalicIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton
        size="small"
        value="underline"
        selected={state.underline}
        onChange={() => editor.chain().focus().toggleUnderline().run()}
      >
        <FormatUnderlinedIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton size="small" value="strike" selected={state.strike} onChange={() => editor.chain().focus().toggleStrike().run()}>
        <StrikethroughSIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton
        size="small"
        value="subscript"
        selected={state.subscript}
        onChange={() => editor.chain().focus().toggleSubscript().run()}
      >
        <SubscriptIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton
        size="small"
        value="superscript"
        selected={state.superscript}
        onChange={() => editor.chain().focus().toggleSuperscript().run()}
      >
        <SuperscriptIcon fontSize="small" />
      </ToggleButton>

      <ColorSwatchPopover
        title="Text color"
        icon={<FormatColorTextIcon fontSize="small" />}
        colors={TEXT_COLORS}
        onPick={(c) => editor.chain().focus().setColor(c).run()}
        onClear={() => editor.chain().focus().unsetColor().run()}
      />
      <ColorSwatchPopover
        title="Highlight color"
        icon={<FormatColorFillIcon fontSize="small" />}
        colors={HIGHLIGHT_COLORS}
        onPick={(c) => editor.chain().focus().toggleHighlight({ color: c }).run()}
        onClear={() => editor.chain().focus().unsetHighlight().run()}
      />

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <ToggleButton
        size="small"
        value="left"
        selected={state.align === 'left'}
        onChange={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <FormatAlignLeftIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton
        size="small"
        value="center"
        selected={state.align === 'center'}
        onChange={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <FormatAlignCenterIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton
        size="small"
        value="right"
        selected={state.align === 'right'}
        onChange={() => editor.chain().focus().setTextAlign('right').run()}
      >
        <FormatAlignRightIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton
        size="small"
        value="justify"
        selected={state.align === 'justify'}
        onChange={() => editor.chain().focus().setTextAlign('justify').run()}
      >
        <FormatAlignJustifyIcon fontSize="small" />
      </ToggleButton>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <ToggleButton
        size="small"
        value="bulletList"
        selected={state.bulletList}
        onChange={() => editor.chain().focus().toggleBulletList().run()}
      >
        <FormatListBulletedIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton
        size="small"
        value="orderedList"
        selected={state.orderedList}
        onChange={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <FormatListNumberedIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton
        size="small"
        value="blockquote"
        selected={state.blockquote}
        onChange={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <FormatQuoteIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton
        size="small"
        value="codeBlock"
        selected={state.codeBlock}
        onChange={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <CodeIcon fontSize="small" />
      </ToggleButton>
      <ToolbarIconButton title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <HorizontalRuleIcon fontSize="small" />
      </ToolbarIconButton>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <LinkPopover editor={editor} />
      <ToolbarIconButton title="Insert image" onClick={() => fileInputRef.current?.click()}>
        <ImageIcon fontSize="small" />
      </ToolbarIconButton>
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" hidden onChange={handleImagePick} />

      {!state.inTable ? (
        <ToolbarIconButton
          title="Insert table"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableChartIcon fontSize="small" />
        </ToolbarIconButton>
      ) : (
        <>
          <ToolbarIconButton title="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            <TableChartIcon fontSize="small" />
          </ToolbarIconButton>
          <ToolbarIconButton title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
            <FormatClearIcon fontSize="small" />
          </ToolbarIconButton>
          <ToolbarIconButton title="Add row" onClick={() => editor.chain().focus().addRowAfter().run()}>
            <TableChartIcon fontSize="small" />
          </ToolbarIconButton>
          <ToolbarIconButton title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
            <FormatClearIcon fontSize="small" />
          </ToolbarIconButton>
        </>
      )}

      <ToolbarIconButton
        title="Clear formatting"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        <FormatClearIcon fontSize="small" />
      </ToolbarIconButton>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <ToolbarIconButton
        title="Insert collapsible section"
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertContent({ type: 'collapsibleBlock', content: [{ type: 'paragraph' }] })
            .run()
        }
      >
        <ViewAgendaIcon fontSize="small" />
      </ToolbarIconButton>
      <ToolbarIconButton
        title="Insert secret (GM only)"
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertContent({ type: 'secretBlock', content: [{ type: 'paragraph' }] })
            .run()
        }
      >
        <LockOutlinedIcon fontSize="small" />
      </ToolbarIconButton>
      <ToolbarIconButton
        title="Insert button"
        onClick={() => editor.chain().focus().insertContent({ type: 'buttonBlock' }).run()}
      >
        <SmartButtonIcon fontSize="small" />
      </ToolbarIconButton>
    </Stack>
  );
}
