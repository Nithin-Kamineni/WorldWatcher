import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

function labelFor(key: string): string {
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parsedValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) return value;
  try { return JSON.parse(trimmed); } catch { return value; }
}

function ObjectView({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== '' && (!Array.isArray(item) || item.length > 0));
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(110px, auto) 1fr' }, columnGap: 1.5, rowGap: 0.75 }}>
      {entries.map(([key, item]) => (
        <Box key={key} sx={{ display: 'contents' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, pt: 0.15 }}>{labelFor(key)}</Typography>
          <StructuredContent value={item} />
        </Box>
      ))}
    </Box>
  );
}

/** Renders JSON, key/value text, lists, and ordinary prose without exposing raw blobs. */
export function StructuredContent({ value }: { value: unknown }) {
  const parsed = parsedValue(value);
  if (parsed === null || parsed === undefined || parsed === '') return null;
  if (Array.isArray(parsed)) {
    const scalar = parsed.every((item) => ['string', 'number', 'boolean'].includes(typeof item));
    return scalar ? (
      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {parsed.map((item, index) => <Chip key={index} size="small" variant="outlined" label={String(item)} />)}
      </Stack>
    ) : <Stack spacing={0.75}>{parsed.map((item, index) => <StructuredContent key={index} value={item} />)}</Stack>;
  }
  if (typeof parsed === 'object') return <ObjectView value={parsed as Record<string, unknown>} />;
  if (typeof parsed !== 'string') return <Typography variant="body2">{String(parsed)}</Typography>;

  const lines = parsed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const pairs = lines.map((line) => line.match(/^([^:]{2,36}):\s+(.+)$/)).filter((match): match is RegExpMatchArray => !!match);
  if (lines.length > 1 && pairs.length === lines.length) {
    return <ObjectView value={Object.fromEntries(pairs.map((match) => [match[1], match[2]]))} />;
  }
  if (lines.length > 1) {
    return (
      <Stack component="ul" spacing={0.4} sx={{ my: 0, pl: 2.5 }}>
        {lines.map((line, index) => <Typography component="li" variant="body2" key={index}>{line.replace(/^[-*•]\s*/, '')}</Typography>)}
      </Stack>
    );
  }
  return <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{parsed}</Typography>;
}
