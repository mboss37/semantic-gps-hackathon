import { redirect } from 'next/navigation';

// Sprint 28 IA flip: the catalog moved to `/dashboard/policies` (primary
// surface). This URL stays as a permanent redirect so any deep-link saved
// from before the flip still lands on the right page.

const CatalogLegacyPage = () => {
  redirect('/dashboard/policies');
};

export default CatalogLegacyPage;
