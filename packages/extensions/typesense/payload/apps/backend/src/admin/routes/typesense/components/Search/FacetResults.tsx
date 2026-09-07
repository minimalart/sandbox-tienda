import { Badge, Text } from '@medusajs/ui';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

interface FacetCount {
  value: string;
  count: number;
}

interface FacetEntry {
  field_name: string;
  counts: FacetCount[];
}

interface FacetResultsProps {
  facets: FacetEntry[];
  onFacetClick: (field: string, value: string) => void;
}

const FacetResults: FC<FacetResultsProps> = ({ facets, onFacetClick }) => {
  const { t } = useTranslation('typesense');

  if (!facets || facets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Text className="font-medium">{t('FACETS_TITLE')}:</Text>
      {facets.map((facet) => (
        <div key={facet.field_name} className="space-y-2">
          <Text size="small" className="font-medium text-ui-fg-subtle">
            {facet.field_name}:
          </Text>
          <div className="flex flex-wrap gap-2">
            {facet.counts?.map((count) => (
              <button
                key={`${facet.field_name}-${count.value}`}
                onClick={() => onFacetClick(facet.field_name, count.value)}
                className="inline-flex cursor-pointer items-center gap-1 rounded border border-ui-border-base bg-ui-bg-field px-2 py-1 text-sm transition-colors hover:bg-ui-bg-field-hover"
                title={`Add filter: ${facet.field_name}:${count.value}`}
              >
                <Text size="small">{count.value}</Text>
                <Badge size="small">({count.count})</Badge>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default FacetResults;
