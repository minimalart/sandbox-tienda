import { CogSixTooth, MagnifyingGlass } from '@medusajs/icons';
import { Button, Drawer, Input, Text } from '@medusajs/ui';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Container } from '../../../../components/container';
import { Header } from '../../../../components/header';
import { useSearchContext } from '../../contexts/SearchContext';
import ResultsPanel from './ResultsPanel';
import SearchPanel from './SearchPanel';

const debounce = (func: (...args: any[]) => void, wait: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const Search = () => {
  const { t } = useTranslation('typesense');
  const { error, searchState, updateSearchParam } = useSearchContext();

  const [configOpen, setConfigOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState(searchState.q === '*' ? '' : searchState.q);

  useEffect(() => {
    setLocalQuery(searchState.q === '*' ? '' : searchState.q);
  }, [searchState.q]);

  const debouncedUpdateQuery = useCallback(
    debounce((value: string) => {
      updateSearchParam('q', value);
    }, 600),
    [updateSearchParam]
  );

  useEffect(() => {
    const visibleQuery = searchState.q === '*' ? '' : searchState.q;
    if (localQuery !== visibleQuery) {
      debouncedUpdateQuery(localQuery);
    }
  }, [localQuery, searchState.q, debouncedUpdateQuery]);

  return (
    <div className="space-y-6">
      <Container className="p-3">
        <Header
          title={t('SEARCH_TITLE')}
          actions={[
            {
              type: 'button',
              props: {
                variant: 'secondary',
                size: 'small',
                onClick: () => setConfigOpen(true),
                children: (
                  <>
                    <CogSixTooth />
                    {t('SEARCH_CONFIG_BUTTON')}
                  </>
                ),
              },
            },
          ]}
        />

        <div className="mt-4 px-2 pb-2">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-ui-fg-muted" />
            <Input
              className="w-full pl-10"
              size="base"
              placeholder={t('SEARCH_QUERY_PLACEHOLDER')}
              value={localQuery}
              onChange={(event) => setLocalQuery(event.target.value)}
              autoFocus
            />
          </div>
        </div>
      </Container>

      {error ? (
        <div className="mb-4 rounded-md border border-ui-border-error bg-ui-bg-field p-4">
          <Text className="text-ui-fg-error">{error}</Text>
        </div>
      ) : null}

      <Container className="p-3">
        <Header title={t('SEARCH_RESULTS_TITLE')} />
        <ResultsPanel />
      </Container>

      <Drawer open={configOpen} onOpenChange={setConfigOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{t('SEARCH_CONFIGURATION_TITLE')}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="overflow-y-auto">
            <SearchPanel />
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </div>
  );
};

export default Search;
