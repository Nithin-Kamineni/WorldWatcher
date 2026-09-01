import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import { getVisibleSections, DEFAULT_ARTICLE_COVER_IMAGE, type Article, type ArticleTemplate } from '../../types/article';
import { getArticleCategoryIcon } from './articleIcons';
import { TipTapArticleEditor } from './richtext/TipTapArticleEditor';
import { toEditorHtml } from './richtext/bbcodeMigration';

const VISIBILITY_COLOR: Record<Article['visibility'], 'warning' | 'info' | 'success'> = {
  gm: 'warning',
  player: 'info',
  published: 'success',
};
const VISIBILITY_LABEL: Record<Article['visibility'], string> = {
  gm: 'GM only',
  player: 'Player-visible',
  published: 'Published',
};

interface ArticleContentViewProps {
  article: Article;
  template: ArticleTemplate;
  /** Extra controls rendered next to the visibility chip - e.g. ArticleDetailPage's "Edit"
   * button. Omitted entirely in ArticleForm's Preview tab, which has no such action. */
  headerActions?: React.ReactNode;
}

/** The published-post rendering of an Article - cover banner, title, tags, rendered BBCode
 * body, then whatever template fields aren't already covered by a linked entity's own card
 * (getVisibleSections). Shared by ArticleDetailPage's read view and ArticleForm's Preview
 * tab so neither re-implements "what an Article actually looks like." */
export function ArticleContentView({ article, template, headerActions }: ArticleContentViewProps) {
  const fieldBoxes = getVisibleSections(template, article.linkedEntityType).flatMap((section) =>
    section.fields
      .filter((field) => !field.showWhen || article.fieldValues[field.showWhen.field] === field.showWhen.equals)
      .filter((field) => (article.fieldValues[field.key] ?? '').trim().length > 0)
      .map((field) => ({
        section: section.label,
        label: field.label,
        value: article.fieldValues[field.key],
        isItemList: field.type === 'itemlist',
      })),
  );

  return (
    <Box>
      <Box
        sx={{
          height: 280,
          borderRadius: 3,
          mb: 3,
          backgroundImage: `url(${article.coverImageSrc || DEFAULT_ARTICLE_COVER_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'flex-end',
          p: 2,
          border: 1,
          borderColor: 'divider',
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)',
          },
        }}
      >
        <Chip
          icon={<Box sx={{ display: 'flex', color: 'inherit !important' }}>{getArticleCategoryIcon(template.icon)}</Box>}
          label={template.label}
          size="small"
          sx={{ position: 'relative', bgcolor: 'rgba(0,0,0,0.55)', color: '#fff', fontWeight: 600 }}
        />
      </Box>

      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {article.name || 'Untitled article'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip label={VISIBILITY_LABEL[article.visibility]} color={VISIBILITY_COLOR[article.visibility]} size="small" variant="outlined" />
          {headerActions}
        </Stack>
      </Stack>

      {article.tags.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
          {article.tags.map((tag) => (
            <Chip key={tag} label={tag} size="small" />
          ))}
        </Stack>
      )}

      {article.body && (
        <Box sx={{ mb: 3 }}>
          <TipTapArticleEditor value={toEditorHtml(article.body)} editable={false} />
        </Box>
      )}

      {fieldBoxes.length > 0 && (
        <>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
            {fieldBoxes.map((box) => (
              <Paper key={`${box.section}-${box.label}`} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {box.label}
                </Typography>
                {box.isItemList ? (
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {box.value
                      .split('\n')
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((item, i) => (
                        <Chip key={i} label={item} size="small" variant="outlined" />
                      ))}
                  </Stack>
                ) : (
                  <Typography variant="body1" sx={{ fontWeight: 600, whiteSpace: 'pre-wrap' }}>
                    {box.value}
                  </Typography>
                )}
              </Paper>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
