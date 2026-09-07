import {
  Button,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Toaster,
  toast,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import {
  type CommentSettings,
  useCommentSettings,
  useUpdateCommentSettings,
} from '../../../hooks/api/comments';

type Draft = Partial<CommentSettings>;

const Row = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1.5 border-ui-border-base border-b py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex flex-col">
      <Label size="small" weight="plus">{label}</Label>
      {hint ? (
        <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>
      ) : null}
    </div>
    <div className="w-full sm:w-[260px]">{children}</div>
  </div>
);

export const CommentsSettings = () => {
  const { data, isLoading } = useCommentSettings();
  const update = useUpdateCommentSettings();
  const [draft, setDraft] = useState<Draft>({});

  useEffect(() => {
    if (data?.settings) setDraft(data.settings);
  }, [data?.settings]);

  if (isLoading || !data?.settings) {
    return <Text className="text-ui-fg-subtle">…</Text>;
  }

  const set = <K extends keyof CommentSettings>(key: K, value: CommentSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const num = (key: keyof CommentSettings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    set(key, (Number.isFinite(v) ? v : 0) as never);
  };

  const save = async () => {
    try {
      await update.mutateAsync(draft);
      toast.success('Configuración guardada');
    } catch (error) {
      toast.error((error as Error)?.message ?? 'No se pudo guardar');
    }
  };

  return (
    <div className="max-w-2xl">
      <Row label="Comentarios habilitados" hint="Activar o desactivar todo el sistema.">
        <Switch
          checked={!!draft.enabled}
          onCheckedChange={(v) => set('enabled', v)}
        />
      </Row>

      <Row
        label="Modo de reseña"
        hint="Qué se captura: solo comentario, solo puntaje o ambos."
      >
        <Select
          value={draft.review_mode}
          onValueChange={(v) => set('review_mode', v as CommentSettings['review_mode'])}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content className="z-[60]">
            <Select.Item value="comment">Solo comentario</Select.Item>
            <Select.Item value="rating">Solo puntaje</Select.Item>
            <Select.Item value="both">Puntaje y comentario</Select.Item>
          </Select.Content>
        </Select>
      </Row>

      <Row
        label="Escala de puntaje"
        hint="Puntaje máximo (ej. 5 = 1 a 5 estrellas)."
      >
        <Input type="number" min={2} max={10} value={draft.rating_scale ?? 5} onChange={num('rating_scale')} />
      </Row>

      <Row label="Quién puede comentar">
        <Select
          value={draft.who_can_comment}
          onValueChange={(v) => set('who_can_comment', v as CommentSettings['who_can_comment'])}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content className="z-[60]">
            <Select.Item value="registered">Usuarios registrados</Select.Item>
            <Select.Item value="verified_buyer">
              Solo quienes recibieron el producto (pedido entregado)
            </Select.Item>
          </Select.Content>
        </Select>
      </Row>

      <Row label="Moderación">
        <Select
          value={draft.moderation}
          onValueChange={(v) => set('moderation', v as CommentSettings['moderation'])}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content className="z-[60]">
            <Select.Item value="auto">Publicación automática</Select.Item>
            <Select.Item value="manual">Requiere aprobación manual</Select.Item>
          </Select.Content>
        </Select>
      </Row>

      <Row label="Ventana de edición (minutos)">
        <Input type="number" min={0} value={draft.edit_window_minutes ?? 15} onChange={num('edit_window_minutes')} />
      </Row>

      <Row label="Longitud mínima">
        <Input type="number" min={0} value={draft.min_length ?? 5} onChange={num('min_length')} />
      </Row>

      <Row label="Longitud máxima">
        <Input type="number" min={1} value={draft.max_length ?? 2000} onChange={num('max_length')} />
      </Row>

      <Row label="Límite por minuto" hint="Comentarios por usuario por minuto.">
        <Input type="number" min={1} value={draft.rate_limit_per_minute ?? 5} onChange={num('rate_limit_per_minute')} />
      </Row>

      <div className="flex justify-end pt-4">
        <Button onClick={save} isLoading={update.isPending}>Guardar</Button>
      </div>
      <Toaster />
    </div>
  );
};
