import { useEffect, useLayoutEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import { useTutorialStore } from '../../store/useTutorialStore';
import { TUTORIAL_STEPS } from './tutorialSteps';

const OVERLAY_Z_INDEX = 2000;
const SPOTLIGHT_PADDING = 8;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measure(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return {
    top: r.top - SPOTLIGHT_PADDING,
    left: r.left - SPOTLIGHT_PADDING,
    width: r.width + SPOTLIGHT_PADDING * 2,
    height: r.height + SPOTLIGHT_PADDING * 2,
  };
}

/** Top-level product tour: darkens the whole viewport except the current step's target
 * element, and asks the user to click it to advance (with a "Next" button as a fallback for
 * steps where that's awkward, e.g. the very first "welcome" step). See tutorialSteps.ts for
 * the step list and AppShell.tsx/DMPanelPage.tsx for the `data-tour` targets. */
export function TutorialOverlay() {
  const active = useTutorialStore((s) => s.active);
  const stepIndex = useTutorialStore((s) => s.stepIndex);
  const next = useTutorialStore((s) => s.next);
  const stop = useTutorialStore((s) => s.stop);

  const [rect, setRect] = useState<Rect | null>(null);
  const step = TUTORIAL_STEPS[stepIndex];

  useLayoutEffect(() => {
    if (!active || !step) return;
    const el = document.querySelector(step.targetSelector);
    if (!el) {
      // Target isn't on this page (e.g. tour started outside a campaign's DM panel) - skip it.
      if (stepIndex + 1 >= TUTORIAL_STEPS.length) stop();
      else next();
      return;
    }

    const recompute = () => setRect(measure(el));
    recompute();

    const onAdvance = () => next();
    el.addEventListener('click', onAdvance, { once: true });
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);

    return () => {
      el.removeEventListener('click', onAdvance);
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex]);

  useEffect(() => {
    if (!active) setRect(null);
  }, [active]);

  if (!active || !step || !rect) return null;

  const isLast = stepIndex === TUTORIAL_STEPS.length - 1;
  const cardBelow = rect.top + rect.height + 200 < window.innerHeight;
  const cardTop = cardBelow ? rect.top + rect.height + 16 : Math.max(16, rect.top - 16);

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: OVERLAY_Z_INDEX, pointerEvents: 'none' }}>
      {/* Four dark panels framing the spotlight hole, so the target element itself stays interactive. */}
      <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, height: rect.top, bgcolor: 'rgba(0,0,0,0.7)', pointerEvents: 'auto' }} />
      <Box
        sx={{
          position: 'fixed',
          top: rect.top + rect.height,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'rgba(0,0,0,0.7)',
          pointerEvents: 'auto',
        }}
      />
      <Box
        sx={{
          position: 'fixed',
          top: rect.top,
          left: 0,
          width: rect.left,
          height: rect.height,
          bgcolor: 'rgba(0,0,0,0.7)',
          pointerEvents: 'auto',
        }}
      />
      <Box
        sx={{
          position: 'fixed',
          top: rect.top,
          left: rect.left + rect.width,
          right: 0,
          height: rect.height,
          bgcolor: 'rgba(0,0,0,0.7)',
          pointerEvents: 'auto',
        }}
      />

      <Box
        sx={{
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          borderRadius: 2,
          border: '2px solid',
          borderColor: 'primary.main',
          boxShadow: (theme) => `0 0 0 4px ${theme.palette.primary.main}33`,
          pointerEvents: 'none',
          transition: 'top 160ms ease, left 160ms ease, width 160ms ease, height 160ms ease',
        }}
      />

      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          top: cardTop,
          left: Math.min(Math.max(16, rect.left), window.innerWidth - 336),
          width: 320,
          p: 2.5,
          borderRadius: 3,
          pointerEvents: 'auto',
        }}
      >
        <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {step.title}
          </Typography>
          <IconButton size="small" onClick={stop} sx={{ mt: -0.5, mr: -0.5 }} aria-label="Skip tour">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {step.description}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TouchAppIcon fontSize="small" color="primary" />
          <Typography variant="caption" color="primary.main" sx={{ flexGrow: 1 }}>
            Click the highlighted element to continue
          </Typography>
        </Stack>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {stepIndex + 1} / {TUTORIAL_STEPS.length}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" color="inherit" onClick={stop}>
              Skip tour
            </Button>
            <Button size="small" variant="contained" onClick={isLast ? stop : next}>
              {isLast ? 'Finish' : 'Next'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
