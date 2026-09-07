import { useState } from 'react';
import { Button, Drawer, Input, Label, Textarea, Heading, Text, Badge, StatusBadge, Tabs } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { registerVideosTranslations } from '../../../translations/videos';
import { useCreateVideo, useVimeoVideos, useVimeoUpload } from '../../../hooks/api/videos';
import { SalesChannelMultiSelect } from '../../../components/sales-channel-multiselect';

interface CreateVideoDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const CreateVideoDrawer = ({ open, onClose }: CreateVideoDrawerProps) => {
  const { t, i18n } = useTranslation('videos');
  registerVideosTranslations(i18n);
  const [activeTab, setActiveTab] = useState('upload');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVimeoId, setSelectedVimeoId] = useState<string>('');
  const [selectedVimeoVideo, setSelectedVimeoVideo] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [salesChannelIds, setSalesChannelIds] = useState<string[]>([]);

  const { data: vimeoVideos, isLoading: isLoadingVimeo } = useVimeoVideos(searchQuery);
  const createMutation = useCreateVideo();
  const uploadMutation = useVimeoUpload();

  const handleUpload = async () => {
    if (!selectedFile || !title) {
      alert(t('ERR_SELECT_FILE_TITLE'));
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);

    try {
      const uploadData = await uploadMutation.mutateAsync({
        title,
        description,
        file_size: selectedFile.size,
      });

      setUploadProgress(10);

      const uploadLink = uploadData.upload?.upload_link;
      const vimeoUri = uploadData.uri;

      if (!uploadLink) {
        throw new Error(t('ERR_NO_UPLOAD_LINK'));
      }

      // Dynamically import tus-js-client to avoid build errors if not installed
      let tusModule: any;
      try {
        tusModule = await import('tus-js-client');
      } catch {
        throw new Error(t('ERR_TUS_NOT_INSTALLED'));
      }

      const upload = new tusModule.Upload(selectedFile, {
        uploadUrl: uploadLink,
        endpoint: uploadLink,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: selectedFile.name,
          filetype: selectedFile.type,
        },
        onError: (error: Error) => {
          console.error('TUS upload failed:', error);
          setIsUploading(false);
          setUploadProgress(0);
          alert(t('ERR_UPLOAD_FAILED', { message: error.message }));
        },
        onProgress: (bytesUploaded: number, bytesTotal: number) => {
          const percentage = Math.floor((bytesUploaded / bytesTotal) * 90) + 10;
          setUploadProgress(percentage);
        },
        onSuccess: async () => {
          setUploadProgress(100);
          try {
            const vimeoId = vimeoUri.replace('/videos/', '');
            await createMutation.mutateAsync({
              vimeo_id: vimeoId,
              vimeo_uri: vimeoUri,
              title,
              description,
              is_active: true,
              sales_channel_ids: salesChannelIds.length ? salesChannelIds : null,
            });

            setSelectedFile(null);
            setTitle('');
            setDescription('');
            setIsUploading(false);
            setUploadProgress(0);
            onClose();
          } catch (error) {
            console.error('Failed to add video to catalog:', error);
            alert(t('ERR_UPLOADED_BUT_NOT_ADDED', { uri: vimeoUri }));
            setIsUploading(false);
            setUploadProgress(0);
          }
        },
      });

      upload.start();
    } catch (error) {
      console.error('Upload initiation failed:', error);
      alert(
        t('ERR_UPLOAD_FAILED', {
          message: error instanceof Error ? error.message : t('ERR_UPLOAD_UNKNOWN'),
        })
      );
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedVimeoId || !title) {
      return;
    }

    try {
      await createMutation.mutateAsync({
        vimeo_id: selectedVimeoId,
        vimeo_uri: `/videos/${selectedVimeoId}`,
        title,
        description,
        duration: selectedVimeoVideo?.duration || null,
        thumbnail_url: selectedVimeoVideo?.pictures?.sizes?.[0]?.link || null,
        vimeo_url: selectedVimeoVideo?.link || null,
        is_active: true,
        sales_channel_ids: salesChannelIds.length ? salesChannelIds : null,
      });

      onClose();
      setSelectedVimeoId('');
      setTitle('');
      setDescription('');
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to create video:', error);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <Drawer.Content className="flex h-full flex-col">
        <Drawer.Header>
          <Heading>{t('ADD_VIDEO')}</Heading>
        </Drawer.Header>

        <Drawer.Body className="flex flex-1 flex-col gap-6 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Trigger value="upload">{t('TAB_UPLOAD')}</Tabs.Trigger>
              <Tabs.Trigger value="link">{t('TAB_LINK')}</Tabs.Trigger>
            </Tabs.List>

            {/* Tab 1: Upload to Vimeo */}
            <Tabs.Content value="upload" className="flex flex-col gap-3 mt-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-ui-border-base rounded-lg bg-ui-bg-subtle">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedFile(file);
                        if (!title) {
                          setTitle(file.name.replace(/\.[^/.]+$/, ''));
                        }
                      }
                    }}
                    className="hidden"
                    id="video-file"
                  />
                  <label htmlFor="video-file" className="cursor-pointer text-center w-full">
                    <Text className="text-ui-fg-subtle mb-2">
                      {selectedFile ? selectedFile.name : t('FILE_DROP_PLACEHOLDER')}
                    </Text>
                    <Text className="text-xs text-ui-fg-muted">
                      {selectedFile
                        ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                        : t('FILE_FORMATS_HINT')}
                    </Text>
                  </label>
                </div>

                {selectedFile && (
                  <StatusBadge color="green">{t('FILE_READY', { name: selectedFile.name })}</StatusBadge>
                )}

                <div>
                  <Label htmlFor="upload-title">{t('LABEL_TITLE')}</Label>
                  <Input
                    id="upload-title"
                    type="text"
                    placeholder={t('PLACEHOLDER_TITLE')}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {isUploading && (
                  <div className="flex flex-col gap-2">
                    <Text className="text-sm">
                      {t('UPLOADING_PROGRESS', { progress: uploadProgress })}
                    </Text>
                    <div className="w-full bg-ui-bg-subtle rounded-full h-2">
                      <div
                        className="bg-ui-fg-interactive h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <Button
                  variant="primary"
                  onClick={handleUpload}
                  disabled={!selectedFile || !title || isUploading}
                  isLoading={isUploading}
                >
                  {isUploading ? t('UPLOADING') : t('TAB_UPLOAD')}
                </Button>
              </div>
            </Tabs.Content>

            {/* Tab 2: Link Existing Video */}
            <Tabs.Content value="link" className="flex flex-col gap-3 mt-4">
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder={t('SEARCH_VIMEO_PLACEHOLDER')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => window.open('https://vimeo.com/upload', '_blank')}
                  >
                    {t('GO_TO_VIMEO')}
                  </Button>
                </div>

                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto border border-ui-border-base rounded-lg p-2">
                  {isLoadingVimeo && (
                    <Text className="text-ui-fg-subtle p-4">{t('LOADING_VIMEO_VIDEOS')}</Text>
                  )}

                  {vimeoVideos && vimeoVideos.data && vimeoVideos.data.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <Label>{t('SELECT_A_VIDEO')}</Label>
                      <div className="flex flex-col gap-2">
                        {vimeoVideos.data.map((video: any) => (
                          <button
                            key={video.uri}
                            type="button"
                            onClick={() => {
                              const vimeoId = video.uri.split('/').pop() || '';
                              setSelectedVimeoId(vimeoId);
                              setSelectedVimeoVideo(video);
                              setTitle(video.name || '');
                              setDescription(video.description || '');
                            }}
                            className={`w-full p-3 text-left hover:bg-ui-bg-subtle transition-colors border-b border-ui-border-base last:border-b-0 ${
                              selectedVimeoId === video.uri.split('/').pop()
                                ? 'bg-ui-bg-subtle'
                                : ''
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {video.pictures?.sizes?.[0]?.link && (
                                <img
                                  src={video.pictures.sizes[0].link}
                                  alt={video.name}
                                  className="w-20 h-12 object-cover rounded"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <Text className="font-medium truncate">{video.name}</Text>
                                <Text className="text-xs text-ui-fg-subtle truncate">
                                  {video.description || t('NO_DESCRIPTION')}
                                </Text>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge size="small">{video.duration}s</Badge>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {vimeoVideos && vimeoVideos.data && vimeoVideos.data.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-8">
                      <Text className="text-ui-fg-subtle mb-4 text-center">
                        {t('NO_VIMEO_VIDEOS')}
                      </Text>
                    </div>
                  )}
                </div>

                {selectedVimeoId && (
                  <div className="border-t pt-3 mt-3">
                    <Heading level="h3" className="mb-4">
                      {t('VIDEO_DETAILS')}
                    </Heading>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                      <div>
                        <Label htmlFor="title">{t('LABEL_TITLE')}</Label>
                        <Input
                          id="title"
                          type="text"
                          placeholder={t('PLACEHOLDER_TITLE')}
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="description">{t('LABEL_DESCRIPTION')}</Label>
                        <Textarea
                          id="description"
                          placeholder={t('PLACEHOLDER_DESCRIPTION')}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={3}
                        />
                      </div>

                      <StatusBadge color="green">
                        {t('SELECTED_VIMEO_ID', { id: selectedVimeoId })}
                      </StatusBadge>
                    </form>
                  </div>
                )}
              </div>
            </Tabs.Content>
          </Tabs>

          <div className="border-t pt-4">
            <SalesChannelMultiSelect
              value={salesChannelIds}
              onChange={setSalesChannelIds}
              label={t('LABEL_SALES_CHANNELS', { defaultValue: 'Canales de venta' })}
              help={t('SALES_CHANNELS_HELP', {
                defaultValue:
                  'Vacío = visible en todos los canales. Elegí canales para mostrar el video solo en esas demos.',
              })}
            />
          </div>
        </Drawer.Body>

        <Drawer.Footer>
          <div className="flex items-center gap-2 justify-end w-full">
            <Button variant="secondary" onClick={onClose}>
              {t('CANCEL')}
            </Button>
            {activeTab === 'link' && (
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!selectedVimeoId || !title || createMutation.isPending}
                isLoading={createMutation.isPending}
              >
                {t('ADD_TO_CATALOG')}
              </Button>
            )}
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
