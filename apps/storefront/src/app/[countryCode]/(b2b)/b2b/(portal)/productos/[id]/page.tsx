import { b2bPrices, getMyCompany } from '@lib/data/company';
import { listProducts } from '@lib/data/products';
import CatalogProduct from '@modules/b2b/components/catalog-product';
import { notFound } from 'next/navigation';

export default async function CatalogProductPage({
  params,
}: {
  params: Promise<{ countryCode: string; id: string }>;
}) {
  const { countryCode, id } = await params;
  const { company } = await getMyCompany();
  const { response } = await listProducts({
    countryCode,
    queryParams: {
      id: [id],
      ...(company?.sales_channel_id ? { sales_channel_id: [company.sales_channel_id] } : {}),
    },
  });
  const product = response.products[0];
  if (!product) notFound();
  return (
    <CatalogProduct product={product} prices={await b2bPrices([id])} countryCode={countryCode} />
  );
}
