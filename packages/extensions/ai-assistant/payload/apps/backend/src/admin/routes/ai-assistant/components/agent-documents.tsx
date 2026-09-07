import { Badge, Button, Text, usePrompt } from '@medusajs/ui';
import { useRef, useState } from 'react';
import { useAgentDocuments, useUploadAgentDocument, useDeleteDocument } from '../hooks';

const STATUS_TONE: Record<string, 'green' | 'orange' | 'red'> = {
  ready: 'green',
  processing: 'orange',
  failed: 'red',
};
const STATUS_LABEL: Record<string, string> = {
  ready: 'Listo',
  processing: 'Procesando…',
  failed: 'Falló',
};

/** Deriva el mime desde la extensión cuando el navegador no lo informa (p. ej. .md). */
function mimeFor(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'md' || ext === 'markdown') return 'text/markdown';
  return 'text/plain';
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Contexto de un agente: subir documentos (PDF/TXT/MD) que se chunkean, embeben y
 * pasan a ser memoria recuperable de ese agente. Se muestra al editar un agente.
 */
export const AgentDocuments = ({ agentId }: { agentId: string }) => {
  const { data, isLoading } = useAgentDocuments(agentId);
  const upload = useUploadAgentDocument();
  const del = useDeleteDocument();
  const prompt = usePrompt();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const documents = data?.documents ?? [];

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      const content = await readAsDataUrl(file);
      await upload.mutateAsync({
        agentId,
        filename: file.name,
        mimeType: mimeFor(file),
        content,
        title: file.name,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-ui-border-base p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Text size="small" weight="plus">
            Contexto del agente (documentos)
          </Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            PDF, TXT o MD (máx. 8MB). Se convierten en memoria que este agente recuerda.
          </Text>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button
          size="small"
          variant="secondary"
          isLoading={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          Subir archivo
        </Button>
      </div>

      {error && (
        <Text size="small" className="text-ui-fg-error">
          {error}
        </Text>
      )}

      {isLoading ? (
        <Text size="small" className="text-ui-fg-subtle">
          Cargando…
        </Text>
      ) : documents.length === 0 ? (
        <Text size="small" className="text-ui-fg-muted">
          Sin documentos cargados.
        </Text>
      ) : (
        <div className="flex flex-col gap-1.5">
          {documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <span className="truncate text-ui-fg-base">{d.title}</span>
                <span className="ml-2 text-ui-fg-muted">
                  {d.chunk_count} fragmento(s)
                  {d.status === 'failed' && d.error ? ` · ${d.error}` : ''}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge size="2xsmall" color={STATUS_TONE[d.status] ?? 'grey'}>
                  {STATUS_LABEL[d.status] ?? d.status}
                </Badge>
                <button
                  type="button"
                  className="text-ui-fg-muted hover:text-ui-fg-base"
                  onClick={async () => {
                    const confirmed = await prompt({
                      title: 'Eliminar documento',
                      description: `¿Eliminar "${d.title}" y sus fragmentos? Esta acción no se puede deshacer.`,
                      confirmText: 'Eliminar',
                      cancelText: 'Cancelar',
                    });
                    if (confirmed) del.mutate(d.id);
                  }}
                >
                  eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
