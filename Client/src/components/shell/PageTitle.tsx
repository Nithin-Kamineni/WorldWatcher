import type { ElementType, ReactNode } from 'react';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';

/** The two in-content heading scales, so a page's own title and a section inside it are the
 * same size everywhere.
 *
 * They were not: the notes, articles, chat, maps and world-home pages titled themselves with an
 * h4, while both Settings pages, the map page and Encounter Management used an h5, and the
 * dashboard's "Your worlds" used an h5 where every other in-page section used an h6. Nothing
 * chose those - they were each styled independently (checklist I-U1). This is the in-content
 * half of the same job SECTION_HEADER_HEIGHT does for header BARS (theme/headerScale.ts);
 * the two are separate on purpose, since a 40px chrome row and a page's title are different
 * things solving different problems. */

interface HeadingProps {
  children: ReactNode;
  /** Defaults to h1 for a page title, since it is the page's top-level heading. */
  component?: ElementType;
  noWrap?: boolean;
  sx?: SxProps<Theme>;
}

/** A page's (or a full-page sub-view's) own title. */
export function PageTitle({ children, component = 'h1', noWrap, sx }: HeadingProps) {
  return (
    <Typography variant="h4" component={component} noWrap={noWrap} sx={{ fontWeight: 700, ...sx }}>
      {children}
    </Typography>
  );
}

/** A section heading inside a page - one step down from PageTitle. */
export function SectionTitle({ children, component = 'h2', noWrap, sx }: HeadingProps) {
  return (
    <Typography variant="h6" component={component} noWrap={noWrap} sx={{ fontWeight: 700, ...sx }}>
      {children}
    </Typography>
  );
}
