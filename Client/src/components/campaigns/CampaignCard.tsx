import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardMedia from '@mui/material/CardMedia';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { Campaign } from '../../types/campaign';

interface CampaignCardProps {
  campaign: Campaign;
  onClick: () => void;
}

export function CampaignCard({ campaign, onClick }: CampaignCardProps) {
  return (
    <Tooltip
      title={
        <Stack spacing={0.5} sx={{ py: 0.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {campaign.name}
          </Typography>
          {campaign.ruleset && (
            <Typography variant="caption" color="text.secondary">
              {campaign.ruleset}
            </Typography>
          )}
          {campaign.description && (
            <Typography variant="body2" sx={{ maxWidth: 280 }}>
              {campaign.description}
            </Typography>
          )}
        </Stack>
      }
      enterDelay={400}
      placement="top"
    >
      <Card elevation={3} sx={{ borderRadius: '10px', overflow: 'hidden' }}>
        <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
          <CardMedia
            component="img"
            image={campaign.imageSrc}
            alt={campaign.name}
            sx={{ aspectRatio: '4 / 3', objectFit: 'cover' }}
          />
          <Box
            sx={{
              p: 2,
              background: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'linear-gradient(180deg, rgba(23,21,29,0) 0%, rgba(23,21,29,0.9) 100%)'
                  : 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 100%)',
              mt: -8,
              position: 'relative',
            }}
          >
            <Typography variant="h6" component="h3" noWrap>
              {campaign.name}
            </Typography>
          </Box>
        </CardActionArea>
      </Card>
    </Tooltip>
  );
}
