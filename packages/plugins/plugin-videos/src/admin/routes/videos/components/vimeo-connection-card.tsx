import { Button, Container, Heading, Text, StatusBadge, Alert } from '@medusajs/ui';
import { CheckCircleSolid, XCircleSolid, InformationCircleSolid } from '@medusajs/icons';
import { useTranslation } from 'react-i18next';
import { registerVideosTranslations } from '../../../translations/videos';
import { useVimeoStatus, useVimeoConnect } from '../../../hooks/api/videos';

export const VimeoConnectionCard = () => {
  const { t, i18n } = useTranslation('videos');
  registerVideosTranslations(i18n);
  const { data: status, isLoading, refetch, error } = useVimeoStatus();
  const connectMutation = useVimeoConnect();

  const isConnected = status?.connected;

  const handleConnect = async () => {
    try {
      connectMutation.mutate(window.location.pathname);
    } catch (err) {
      console.error('Failed to connect:', err);
    }
  };

  const handleTestConnection = () => {
    refetch();
  };

  return (
    <Container className="p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Heading level="h2">{t('VIMEO_CONNECTION')}</Heading>
              {!isLoading && (
                <StatusBadge
                  color={isConnected ? 'green' : 'red'}
                  className="flex items-center gap-1"
                >
                  {isConnected ? (
                    <>
                      <CheckCircleSolid className="w-3 h-3" />
                      {t('CONNECTED')}
                    </>
                  ) : (
                    <>
                      <XCircleSolid className="w-3 h-3" />
                      {t('NOT_CONNECTED')}
                    </>
                  )}
                </StatusBadge>
              )}
            </div>
            <Text className="text-ui-fg-subtle">
              {isConnected ? t('CONNECTED_DESCRIPTION') : t('NOT_CONNECTED_DESCRIPTION')}
            </Text>
            {isConnected && status?.user && (
              <div className="mt-3 text-sm space-y-1">
                <Text className="text-ui-fg-muted">
                  {t('CONNECTED_AS')}{' '}
                  <strong>{status.user.name || t('DEFAULT_VIMEO_USER')}</strong>
                </Text>
                {status?.folderUri && (
                  <Text className="text-ui-fg-muted">
                    {t('FOLDER')} <strong>{status.folderUri}</strong>
                  </Text>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {isConnected ? (
              <Button
                variant="secondary"
                size="small"
                onClick={handleTestConnection}
                isLoading={isLoading}
              >
                {t('TEST_CONNECTION')}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="small"
                onClick={handleConnect}
                isLoading={connectMutation.isPending}
              >
                {t('CONNECT_ACCOUNT')}
              </Button>
            )}
          </div>
        </div>

        {!isConnected && !isLoading && (
          <Alert variant="info" dismissible={false}>
            <div className="flex items-start gap-2">
              <InformationCircleSolid className="w-5 h-5 text-ui-fg-subtle flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <Text className="text-sm font-medium mb-1">{t('HOW_TO_CONNECT')}</Text>
                <ol className="text-xs text-ui-fg-subtle space-y-1 list-decimal list-inside">
                  <li>{t('HOW_TO_STEP_1')}</li>
                  <li>{t('HOW_TO_STEP_2')}</li>
                  <li>{t('HOW_TO_STEP_3')}</li>
                </ol>
                <Text className="text-xs text-ui-fg-muted mt-2">{t('ENV_TOKEN_HINT')}</Text>
              </div>
            </div>
          </Alert>
        )}

        {error && (
          <Alert variant="error" dismissible={false}>
            <Text className="text-sm">{t('CONNECTION_ERROR')}</Text>
          </Alert>
        )}
      </div>
    </Container>
  );
};
