import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSpaceConfigurator } from '@lib/data/space-designer';
import SpaceDesigner from '@modules/space-designer/components/space-designer';

type Props = { params: Promise<{ countryCode: string; slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode, slug } = await params;
  const configurator = await getSpaceConfigurator(slug, countryCode);
  return {
    title: configurator?.title || 'Diseñá tu espacio',
    description: configurator?.config.description,
  };
}
export default async function SpaceDesignerPage({ params }: Props) {
  const { countryCode, slug } = await params;
  const configurator = await getSpaceConfigurator(slug, countryCode);
  if (!configurator) notFound();
  return <SpaceDesigner configurator={configurator} countryCode={countryCode} />;
}
