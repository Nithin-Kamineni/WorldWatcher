import { useEffect, useState } from 'react';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CasinoIcon from '@mui/icons-material/Casino';
import { useGeneratorStore } from '../../../store/useGeneratorStore';
import type { Generator, GeneratorRollResult } from '../../../types/generator';

interface GeneratorRunnerProps {
  generator: Generator;
}

/** Renders a generator's parameters as a small input form (a tag dropdown restricted to
 * allowedTags for type 'tag', a plain text field otherwise), rolls it, and displays the
 * combined result plus each slot (skipped slots shown as such). */
export function GeneratorRunner({ generator }: GeneratorRunnerProps) {
  const roll = useGeneratorStore((s) => s.roll);
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<GeneratorRollResult | null>(null);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    setParams(Object.fromEntries(generator.parameters.map((p) => [p.key, p.default ?? ''])));
    setResult(null);
  }, [generator.id, generator.parameters]);

  const setParam = (key: string, value: string) => setParams((prev) => ({ ...prev, [key]: value }));

  const handleRoll = async () => {
    setRolling(true);
    const r = await roll(generator.id, params);
    setRolling(false);
    if (r) setResult(r);
  };

  return (
    <Stack spacing={2}>
      {generator.description && (
        <Typography variant="body2" color="text.secondary">
          {generator.description}
        </Typography>
      )}

      {generator.parameters.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }} useFlexGap>
          {generator.parameters.map((p) =>
            p.type === 'tag' ? (
              <FormControl key={p.key} size="small" sx={{ minWidth: 180 }}>
                <InputLabel id={`param-${p.key}`}>{p.label}</InputLabel>
                <Select
                  labelId={`param-${p.key}`}
                  label={p.label}
                  value={params[p.key] ?? ''}
                  onChange={(e: SelectChangeEvent) => setParam(p.key, e.target.value)}
                >
                  {!p.required && <MenuItem value="">(none)</MenuItem>}
                  {p.allowedTags.map((tag) => (
                    <MenuItem key={tag} value={tag}>
                      {tag}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <TextField
                key={p.key}
                size="small"
                label={p.label}
                value={params[p.key] ?? ''}
                onChange={(e) => setParam(p.key, e.target.value)}
                sx={{ minWidth: 180 }}
              />
            ),
          )}
        </Stack>
      )}

      <Button variant="contained" startIcon={<CasinoIcon />} onClick={handleRoll} disabled={rolling} sx={{ alignSelf: 'flex-start' }}>
        Roll
      </Button>

      {result && (
        <Stack spacing={1.5}>
          {result.combinedText && (
            <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {result.combinedText}
              </Typography>
            </Paper>
          )}
          {result.slots.map((slot) => (
            <Paper key={slot.slot} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                {slot.slot} ({slot.tableName})
              </Typography>
              {slot.skipped ? (
                <Typography variant="body2" color="text.secondary">
                  <em>Skipped - no matching entries</em>
                </Typography>
              ) : slot.result ? (
                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
                    {slot.result.dice.map((d, i) => (
                      <Chip key={i} size="small" variant="outlined" icon={<CasinoIcon fontSize="small" />} label={`d${d.sides}: ${d.result}`} />
                    ))}
                  </Stack>
                  <Typography variant="body1">{slot.result.resolvedText ?? slot.result.text}</Typography>
                  {slot.result.kind !== 'text' && slot.result.refHydrated && (
                    <Chip size="small" color="primary" label={slot.result.refHydrated.name} sx={{ alignSelf: 'flex-start' }} />
                  )}
                </Stack>
              ) : (
                <Box />
              )}
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
