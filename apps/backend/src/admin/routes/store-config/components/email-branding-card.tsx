import { Button, Container, Heading, Input, Label, Text, toast } from '@medusajs/ui';
import { useEffect, useRef, useState } from 'react';
import { sdk } from '../../../lib/client';
import {
  useEmailBranding,
  useUpdateEmailBranding,
} from '../../../hooks/api/email-branding';
import { MediaLibraryPickerModal } from '@minimalart/mercatto-plugin-media-library/admin/components/media-library-picker';

/**
 * Email branding card — lets the admin configure the visual identity used in
 * transactional emails: brand colors, logo, display name and the notification
 * recipient for admin emails.
 *
 * Consumes: GET/POST /admin/store-config/email-branding
 *
 * `embedded` drops the outer Container chrome so the card can be rendered inside
 * a Drawer (e.g. opened from the Email templates screen).
 */
export function EmailBrandingCard({ embedded = false }: { embedded?: boolean }) {
  const { data, isPending } = useEmailBranding();
  const { mutateAsync: update, isPending: saving } = useUpdateEmailBranding();

  const [primaryColor, setPrimaryColor] = useState('#111827');
  const [textColor, setTextColor] = useState('#374151');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const b = data?.email_branding;
    if (!b) return;
    setPrimaryColor(b.primary_color ?? '#111827');
    setTextColor(b.text_color ?? '#374151');
    setLogoUrl(b.logo_url ?? null);
    setDisplayName(b.cde_display_name ?? '');
    setAdminEmail(b.admin_notification_email ?? '');
  }, [data]);

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const url = res.files?.[0]?.url;
      if (url) setLogoUrl(url);
    } catch (e: any) {
      toast.error(`Error al subir el logo: ${e?.message ?? ''}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      await update({
        primary_color: primaryColor,
        text_color: textColor,
        logo_url: logoUrl,
        cde_display_name: displayName || null,
        admin_notification_email: adminEmail || null,
      });
      toast.success('Branding de email guardado');
    } catch (e: any) {
      toast.error(`No se pudo guardar: ${e?.message ?? ''}`);
    }
  };

  // El encabezado salió de `body` y vive sólo en la rama con `Container`: era lo
  // único que miraba `embedded` acá adentro, y con `Container p-0` el header tiene
  // que ser un hermano del cuerpo (bandas `px-6 py-4` / `px-6 pb-6`), no su primer
  // hijo. Embebida sigue sin encabezado, igual que antes.
  const body = (
    <>
      {/* Logo */}
      <div className="flex flex-col gap-2">
        <Label size="xsmall">Logo</Label>
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle">
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="size-full object-contain" />
            ) : (
              <Text size="xsmall" className="text-ui-fg-muted text-center leading-tight px-1">
                Sin logo
              </Text>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex">
                <Button variant="secondary" size="small" asChild>
                  <span>{uploading ? 'Subiendo…' : logoUrl ? 'Cambiar logo' : 'Subir logo'}</span>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading || isPending}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadLogo(f);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setLibraryOpen(true)}
                disabled={uploading || isPending}
              >
                Elegir de la biblioteca
              </Button>
              {logoUrl && (
                <Button
                  variant="transparent"
                  size="small"
                  onClick={() => setLogoUrl(null)}
                >
                  Quitar
                </Button>
              )}
            </div>
            {logoUrl && (
              <Text size="xsmall" className="text-ui-fg-muted truncate max-w-xs">
                {logoUrl}
              </Text>
            )}
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label size="xsmall">Color principal</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="size-8 cursor-pointer rounded border border-ui-border-base bg-transparent p-0.5"
            />
            <Input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#111827"
              className="font-mono"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label size="xsmall">Color de texto</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              className="size-8 cursor-pointer rounded border border-ui-border-base bg-transparent p-0.5"
            />
            <Input
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              placeholder="#374151"
              className="font-mono"
            />
          </div>
        </div>
      </div>

      {/* Display name */}
      <div className="flex flex-col gap-1">
        <Label size="xsmall">Nombre del sitio (CDE)</Label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Mi Tienda"
        />
        <Text size="xsmall" className="text-ui-fg-subtle">
          Aparece en el footer de los emails como {'{{cde_display_name}}'}.
        </Text>
      </div>

      {/* Admin notification email */}
      <div className="flex flex-col gap-1">
        <Label size="xsmall">Email de notificaciones admin</Label>
        <Input
          type="email"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          placeholder="admin@mitienda.com"
        />
        <Text size="xsmall" className="text-ui-fg-subtle">
          Destinatario por defecto para los emails de notificación al admin.
        </Text>
      </div>

      <div className="flex justify-end">
        <Button
          size="small"
          onClick={handleSave}
          isLoading={saving}
          disabled={isPending}
        >
          Guardar branding
        </Button>
      </div>

      <MediaLibraryPickerModal
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onPick={setLogoUrl}
        title="Elegir logo de la biblioteca"
      />
    </>
  );

  if (embedded) {
    return <div className="flex flex-col gap-6">{body}</div>;
  }

  // Sin `mb-4`: el espaciado vertical lo pone el `SingleColumnLayout` de la
  // página. `p-0` + header propio: la forma única de las cards de ajustes, ver
  // `branch-settings-card` para por qué no bajan a sección.
  return (
    <Container className="p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Branding de emails</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Colores, logo y datos de identidad usados en las plantillas de email.
        </Text>
      </div>
      <div className="flex flex-col gap-6 px-6 pb-6">{body}</div>
    </Container>
  );
}
