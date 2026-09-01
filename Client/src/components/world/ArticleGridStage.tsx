import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import ButtonBase from '@mui/material/ButtonBase';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import { ARTICLE_TEMPLATES, type Article } from '../../types/article';
import { getArticleCategoryIcon } from './articleIcons';

interface Layout {
  key: string;
  count: number;
  template: { gridTemplateColumns: string; gridTemplateRows?: string; gridTemplateAreas?: string };
  areas?: string[];
}

/** A handful of "fun" grid orientations to rotate through so the Hybrid view doesn't look
 * like a static list - each consumes a different number of articles from the current slice. */
const LAYOUTS: Layout[] = [
  {
    key: 'hero-list',
    count: 5,
    template: {
      gridTemplateColumns: '2fr 1fr',
      gridTemplateRows: 'repeat(4, minmax(0, 1fr))',
      gridTemplateAreas: '"hero side1" "hero side2" "hero side3" "hero side4"',
    },
    areas: ['hero', 'side1', 'side2', 'side3', 'side4'],
  },
  {
    key: 'quad',
    count: 4,
    template: { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' },
  },
  {
    key: 'top-bottom',
    count: 3,
    template: {
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1.2fr 1fr',
      gridTemplateAreas: '"top top" "bl br"',
    },
    areas: ['top', 'bl', 'br'],
  },
  { key: 'trio', count: 3, template: { gridTemplateColumns: '1fr 1fr 1fr' } },
  { key: 'duo', count: 2, template: { gridTemplateColumns: '1fr 1fr' } },
];

const ROTATE_INTERVAL_MS = 7000;

function ArticlePreviewCard({ article, area, onOpen }: { article: Article; area?: string; onOpen: () => void }) {
  const template = ARTICLE_TEMPLATES[article.category];
  const snippet = article.body.length > 140 ? `${article.body.slice(0, 140)}…` : article.body;

  return (
    <ButtonBase
      onClick={onOpen}
      sx={{ display: 'block', width: '100%', height: '100%', textAlign: 'left', borderRadius: 3, ...(area && { gridArea: area }) }}
    >
      <Paper
        variant="outlined"
        sx={{
          height: '100%',
          borderRadius: 3,
          p: 2.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          backgroundImage: article.coverImageSrc ? `url(${article.coverImageSrc})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          overflow: 'hidden',
          '&::before': article.coverImageSrc
            ? {
                content: '""',
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.75) 100%)',
              }
            : undefined,
        }}
      >
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1, color: article.coverImageSrc ? '#fff' : 'text.secondary' }}>
          {getArticleCategoryIcon(template.icon)}
          <Chip label={template.label} size="small" sx={{ height: 20, fontSize: 11 }} />
        </Box>
        <Typography
          variant="h6"
          sx={{ position: 'relative', fontWeight: 700, color: article.coverImageSrc ? '#fff' : 'text.primary' }}
        >
          {article.name}
        </Typography>
        {snippet && (
          <Typography
            variant="body2"
            sx={{
              position: 'relative',
              color: article.coverImageSrc ? 'rgba(255,255,255,0.85)' : 'text.secondary',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {snippet}
          </Typography>
        )}
      </Paper>
    </ButtonBase>
  );
}

interface ArticleGridStageProps {
  articles: Article[];
  onOpen: (articleId: string) => void;
  onCreate: () => void;
}

export interface ArticleGridStageHandle {
  advance: (direction: 1 | -1) => void;
}

export const ArticleGridStage = forwardRef<ArticleGridStageHandle, ArticleGridStageProps>(function ArticleGridStage(
  { articles, onOpen, onCreate },
  ref,
) {
  const [layoutIndex, setLayoutIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const layout = LAYOUTS[layoutIndex];

  const advance = (direction: 1 | -1) => {
    const nextLayoutIndex = (layoutIndex + direction + LAYOUTS.length) % LAYOUTS.length;
    setLayoutIndex(nextLayoutIndex);
    if (articles.length > 0) {
      setOffset((prev) => (prev + direction * layout.count + articles.length) % articles.length);
    }
  };

  useImperativeHandle(ref, () => ({ advance }));

  useEffect(() => {
    if (articles.length === 0) return;
    const timer = setInterval(() => advance(1), ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutIndex, offset, articles.length]);

  useEffect(() => {
    setOffset(0);
    setLayoutIndex(0);
  }, [articles.length]);

  const visible = useMemo(() => {
    if (articles.length === 0) return [];
    const slice: Article[] = [];
    for (let i = 0; i < Math.min(layout.count, articles.length); i++) {
      slice.push(articles[(offset + i) % articles.length]);
    }
    return slice;
  }, [articles, offset, layout.count]);

  if (articles.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No articles here yet.
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>
          Create article
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box
        sx={{
          flexGrow: 1,
          display: 'grid',
          gap: 2,
          minHeight: 420,
          gridTemplateColumns: layout.template.gridTemplateColumns,
          gridTemplateRows: layout.template.gridTemplateRows,
          gridTemplateAreas: layout.template.gridTemplateAreas,
        }}
      >
        {visible.map((article, i) => (
          <ArticlePreviewCard key={article.id} article={article} area={layout.areas?.[i]} onOpen={() => onOpen(article.id)} />
        ))}
      </Box>
    </Box>
  );
});
