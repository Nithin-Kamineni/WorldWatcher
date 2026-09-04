import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CasinoIcon from '@mui/icons-material/Casino';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined';
import type { RollResult, RollResultItem } from '../../../types/randomTable';
import { StructuredContent } from '../StructuredContent';
import { rollResultItemToText, rollResultToText } from '../../../utils/rollResultText';

interface RollResultViewProps {
  result: RollResult;
  depth?: number;
  /** Optional hook for making a hydrated ref (creature/encounter/npc/item/table) clickable -
   * e.g. to open its own detail view. Omit to just show the name as a static chip. */
  onOpenRef?: (kind: string, refId: string) => void;
  /** Optional one-click "log this roll" - adds an add-to-chat button to the whole result and
   * to each rolled column, so the DM can note what the dice said without retyping it. Omit
   * outside the Play page, where there is no session chat to send to. */
  onSendToChat?: (text: string) => void;
}

/** Small add-to-chat affordance, shared by the result banner and each rolled column. */
function SendToChatButton({ text, onSendToChat, title }: { text: string; onSendToChat: (text: string) => void; title: string }) {
  return (
    <Tooltip title={title}>
      <IconButton
        size="small"
        onClick={(event) => {
          event.stopPropagation();
          onSendToChat(text);
        }}
        sx={{ p: 0.4, color: 'inherit' }}
      >
        <AddCommentOutlinedIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  );
}

function RollItemRow({ item, onOpenRef, onSendToChat }: { item: RollResultItem; onOpenRef?: (kind: string, refId: string) => void; onSendToChat?: (text: string) => void }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
      <Stack spacing={0.75}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
          {item.columnName && (
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              {item.columnName}
            </Typography>
          )}
          {item.dice.map((d, i) => (
            <Chip key={i} size="small" variant="outlined" icon={<CasinoIcon fontSize="small" />} label={`d${d.sides}: ${d.result}`} />
          ))}
          {item.dice.length > 1 && (
            <Typography variant="caption" color="text.secondary">
              total {item.total}
            </Typography>
          )}
          <Box sx={{ flexGrow: 1 }} />
          {onSendToChat && <SendToChatButton text={rollResultItemToText(item)} onSendToChat={onSendToChat} title="Add this result to the chat" />}
        </Stack>

        <StructuredContent value={item.resolvedText ?? item.text ?? '(no result)'} />

        {typeof item.extra.doom === 'number' && (
          <Chip size="small" color={item.extra.doom_complete ? 'error' : 'warning'} label={`Doom ${item.extra.doom}/${item.extra.doom_max}`} sx={{ alignSelf: 'flex-start' }} />
        )}
        {item.extra.bundle != null && (
          <Paper variant="outlined" sx={{ p: 1, bgcolor: 'action.hover' }}><StructuredContent value={item.extra.bundle} /></Paper>
        )}

        {item.kind !== 'text' && item.refHydrated && (
          <Chip
            size="small"
            color="primary"
            variant="filled"
            label={item.refHydrated.name}
            clickable={!!onOpenRef}
            onClick={onOpenRef && item.refId ? () => onOpenRef(item.kind, item.refId as string) : undefined}
            sx={{ alignSelf: 'flex-start' }}
          />
        )}

        {item.nested && (
          <Box sx={{ pl: 2, borderLeft: '2px solid', borderColor: 'divider', mt: 0.5 }}>
            <RollResultView result={item.nested} depth={depth_(item)} onOpenRef={onOpenRef} onSendToChat={onSendToChat} />
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

// nested results always render at depth > 0 (suppresses the combined-text banner repeating for
// every link in a cascade chain); the exact number doesn't matter beyond "not 0".
function depth_(_item: RollResultItem): number {
  return 1;
}

/** Renders a RollResult: combined text banner up top, one card per column's rolled item
 * (dice shown, resolved text, hydrated ref as a chip), recursing into item.nested for
 * cascading/branching chains until it bottoms out. */
export function RollResultView({ result, depth = 0, onOpenRef, onSendToChat }: RollResultViewProps) {
  return (
    <Stack spacing={1.5}>
      {depth === 0 && result.combinedText && (
        <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, flexGrow: 1 }}>
              {result.combinedText}
            </Typography>
            {onSendToChat && (
              <SendToChatButton text={rollResultToText(result)} onSendToChat={onSendToChat} title="Add the whole roll to the chat" />
            )}
          </Stack>
        </Paper>
      )}
      {depth === 0 && !result.combinedText && onSendToChat && (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
          <Typography variant="caption" color="text.secondary">
            Log the whole roll
          </Typography>
          <SendToChatButton text={rollResultToText(result)} onSendToChat={onSendToChat} title="Add the whole roll to the chat" />
        </Stack>
      )}

      {result.gatePassed !== null && (
        <Chip
          size="small"
          icon={result.gatePassed ? <CheckCircleIcon /> : <CancelIcon />}
          color={result.gatePassed ? 'success' : 'default'}
          label={result.gatePassed ? 'Gate passed' : 'Gate failed'}
          sx={{ alignSelf: 'flex-start' }}
        />
      )}

      {result.items.map((item, i) => (
        <RollItemRow key={i} item={item} onOpenRef={onOpenRef} onSendToChat={onSendToChat} />
      ))}
    </Stack>
  );
}
