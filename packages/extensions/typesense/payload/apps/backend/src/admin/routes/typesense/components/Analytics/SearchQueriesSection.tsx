import {
  ArrowPath,
  FaceDisappointed,
  InformationCircleSolid,
  MagnifyingGlass,
} from '@medusajs/icons';
import { Badge, Button, Heading, Text } from '@medusajs/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Skeleton } from '../../../../components/common/skeleton/skeleton';
import type { AnalyticsTerm } from '../../hooks/useSearchAnalytics';

const SKELETON_ROW_COUNT = 8;
// Pseudo-randomized but stable widths so the skeleton rows don't all look identical.
const SKELETON_WIDTHS = [60, 95, 75, 110, 50, 130, 80, 100];

interface SearchQueriesSectionProps {
  popularQueries: AnalyticsTerm[];
  queriesWithoutResults: AnalyticsTerm[];
  loading: boolean;
  reinitializing: boolean;
  onReinitialize: () => void;
}

const SearchQueriesSection = ({
  popularQueries,
  queriesWithoutResults,
  loading,
  reinitializing,
  onReinitialize,
}: SearchQueriesSectionProps) => {
  const { t } = useTranslation('typesense');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          size="small"
          variant="secondary"
          onClick={onReinitialize}
          isLoading={reinitializing}
          disabled={reinitializing}
        >
          <ArrowPath className="mr-1.5" />
          {t('ANALYTICS_REINIT_BUTTON')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <QueriesList
          icon={<MagnifyingGlass className="text-ui-fg-muted" />}
          title={t('MOST_SEARCHED_TITLE')}
          subtitle={t('MOST_SEARCHED_SUBTITLE')}
          rows={popularQueries}
          loading={loading}
          emptyTitle={t('ANALYTICS_EMPTY_TITLE')}
        />
        <QueriesList
          icon={<FaceDisappointed className="text-ui-fg-muted" />}
          title={t('NO_RESULT_QUERIES_TITLE')}
          subtitle={t('NO_RESULT_QUERIES_SUBTITLE')}
          rows={queriesWithoutResults}
          loading={loading}
          emptyTitle={t('ANALYTICS_EMPTY_TITLE')}
          highlightCount
        />
      </div>
    </div>
  );
};

interface QueriesListProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  rows: AnalyticsTerm[];
  loading: boolean;
  emptyTitle: string;
  highlightCount?: boolean;
}

const QueriesList = ({
  icon,
  title,
  subtitle,
  rows,
  loading,
  emptyTitle,
  highlightCount,
}: QueriesListProps) => {
  return (
    <div className="rounded-lg border border-ui-border-base p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ui-bg-subtle">
          {icon}
        </div>
        <div>
          <Heading level="h3" className="text-sm font-medium">
            {title}
          </Heading>
          <Text size="xsmall" className="text-ui-fg-subtle">
            {subtitle}
          </Text>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <ul className="mt-3 flex flex-col" aria-hidden>
          {Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
            <li
              key={`skeleton-${index}`}
              className="flex items-center justify-between border-b border-ui-border-base py-2 last:border-b-0"
            >
              <Skeleton
                className="h-4"
                style={{ width: `${SKELETON_WIDTHS[index % SKELETON_WIDTHS.length]}px` }}
              />
              <Skeleton className="h-5 w-10 rounded-md" />
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-y-2 py-6">
          <InformationCircleSolid className="text-ui-fg-muted" />
          <Text size="small" className="text-ui-fg-subtle">
            {emptyTitle}
          </Text>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col">
          {rows.map((row, index) => (
            <li
              key={`${row.term}-${index}`}
              className="flex items-center justify-between border-b border-ui-border-base py-2 last:border-b-0"
            >
              <Text size="small" className="truncate pr-2">
                {row.term}
              </Text>
              <Badge size="small" color={highlightCount ? 'orange' : 'grey'}>
                {row.count.toLocaleString()}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchQueriesSection;
