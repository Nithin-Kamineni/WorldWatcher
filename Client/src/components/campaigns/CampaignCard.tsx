import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardMedia from '@mui/material/CardMedia';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { Campaign } from '../../types/campaign';

interface CampaignCardProps {
  campaign: Campaign;
  onClick: () => void;
}

export function CampaignCard({ campaign, onClick }: CampaignCardProps) {
  return (
    <Card elevation={3} sx={{ borderRadius: 4, overflow: 'hidden' }}>
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
  );
}
