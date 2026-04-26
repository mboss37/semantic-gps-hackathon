import type { MetadataRoute } from 'next';

const SITE_URL = 'https://semantic-gps-hackathon.vercel.app';

const sitemap = (): MetadataRoute.Sitemap => {
  const lastModified = new Date();
  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/signup`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
};

export default sitemap;
