import { Button, Container, Heading, Input, Label, Select, Switch, Text, toast } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { SettingLabel } from '../../../components/common/setting-label';
import {
  useAiConfig,
  useUpdateAiConfig,
  type AiConfig,
} from '../../../hooks/api/store-config';

const EFFORTS: AiConfig['chat_reasoning_effort'][] = ['minimal', 'low', 'medium', 'high'];

/**
 * AI config card — centraliza los parámetros de IA (modelos, reintentos,
 * reasoning, tokens y opciones de generación de imágenes) que antes vivían en
 * variables de entorno. La API key (OPENROUTER_API_KEY) NO se gestiona acá:
 * sigue siendo un secreto de entorno.
 *
 * Consume: GET/POST /admin/store-config/ai-config
 */
export function AiConfigCard() {
  const { data, isPending } = useAiConfig();
  const { mutateAsync: update, isPending: saving } = useUpdateAiConfig();

  const [textModel, setTextModel] = useState('');
  const [textMaxRetries, setTextMaxRetries] = useState(2);
  const [chatModel, setChatModel] = useState('');
  const [reasoning, setReasoning] = useState<AiConfig['chat_reasoning_effort']>('low');
  const [chatMaxTokens, setChatMaxTokens] = useState(6000);
  const [validationEnabled, setValidationEnabled] = useState(false);
  const [imageModel, setImageModel] = useState('');
  const [imageQuality, setImageQuality] = useState(72);
  const [imageMaxKb, setImageMaxKb] = useState(200);
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [autocaptureEnabled, setAutocaptureEnabled] = useState(false);
  const [autocaptureApproval, setAutocaptureApproval] = useState(true);
  const [memoryTopk, setMemoryTopk] = useState(5);
  const [memoryMinSim, setMemoryMinSim] = useState(0.35);
  const [embeddingsModel, setEmbeddingsModel] = useState('');

  useEffect(() => {
    const c = data?.ai_config;
    if (!c) return;
    setTextModel(c.text_model);
    setTextMaxRetries(c.text_max_retries);
    setChatModel(c.chat_model);
    setReasoning(c.chat_reasoning_effort);
    setChatMaxTokens(c.chat_max_tokens);
    setValidationEnabled(c.chat_validation_enabled);
    setImageModel(c.image_model);
    setImageQuality(c.image_quality);
    setImageMaxKb(c.image_max_kb);
    setMemoryEnabled(c.memory_enabled);
    setAutocaptureEnabled(c.memory_autocapture_enabled);
    setAutocaptureApproval(c.memory_autocapture_requires_approval);
    setMemoryTopk(c.memory_retrieval_topk);
    setMemoryMinSim(c.memory_min_similarity);
    setEmbeddingsModel(c.embeddings_model);
  }, [data]);

  const handleSave = async () => {
    try {
      await update({
        text_model: textModel.trim(),
        text_max_retries: textMaxRetries,
        chat_model: chatModel.trim(),
        chat_reasoning_effort: reasoning,
        chat_max_tokens: chatMaxTokens,
        chat_validation_enabled: validationEnabled,
        image_model: imageModel.trim(),
        image_quality: imageQuality,
        image_max_kb: imageMaxKb,
        memory_enabled: memoryEnabled,
        memory_autocapture_enabled: autocaptureEnabled,
        memory_autocapture_requires_approval: autocaptureApproval,
        memory_retrieval_topk: memoryTopk,
        memory_min_similarity: memoryMinSim,
        embeddings_model: embeddingsModel.trim(),
      });
      toast.success('Configuración de IA guardada');
    } catch (e: any) {
      toast.error(`No se pudo guardar: ${e?.message ?? ''}`);
    }
  };

  const num = (setter: (n: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number.parseInt(e.target.value, 10);
    setter(Number.isFinite(n) ? n : 0);
  };

  return (
    // Sin `mb-4`: el wrapper de la pestaña ya separa con `gap-4`.
    // `p-0` + header propio: la forma única de las cards de esta pantalla, ver
    // `branch-settings-card` para por qué no bajan a sección.
    <Container className="p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Configuración IA</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Modelos y parámetros de IA (OpenRouter). La API key se configura por entorno
          (OPENROUTER_API_KEY) y no se gestiona desde acá.
        </Text>
      </div>

      <div className="flex flex-col gap-6 px-6 pb-6">
        {/* Generación de texto (landings) */}
        <div className="flex flex-col gap-3">
          <Text size="small" weight="plus">
            Generación de texto (landings)
          </Text>
          <div className="grid gap-4 md:grid-cols-2">
            {/* La aclaración del formato va al tooltip del label y no debajo del
                input: es cierta siempre, no depende de lo tipeado, y en línea
                empujaba el campo de al lado en el grid de dos columnas. */}
            <div className="flex flex-col gap-1">
              <SettingLabel
                label="Modelo de texto"
                hint="Slug provider/model de OpenRouter (ej. moonshotai/kimi-k2, anthropic/claude-3.5-sonnet)."
                size="xsmall"
              />
              <Input
                value={textModel}
                onChange={(e) => setTextModel(e.target.value)}
                placeholder="openai/gpt-4.1-mini"
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">Reintentos ante JSON inválido (0-5)</Label>
              <Input type="number" min={0} max={5} value={textMaxRetries} onChange={num(setTextMaxRetries)} />
            </div>
          </div>
        </div>

        {/* Asistente IA */}
        <div className="flex flex-col gap-3">
          <Text size="small" weight="plus">
            Asistente IA
          </Text>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label size="xsmall">Modelo del asistente</Label>
              <Input
                value={chatModel}
                onChange={(e) => setChatModel(e.target.value)}
                placeholder="openai/gpt-5-mini"
                className="font-mono"
              />
            </div>
            {/* El párrafo que estaba debajo del grid explicaba DOS campos a la vez
                —el esfuerzo y el techo de tokens— y por eso no se podía leer parado
                en ninguno. Se parte en el tooltip de cada uno. */}
            <div className="flex flex-col gap-1">
              <SettingLabel
                label="Esfuerzo de razonamiento"
                hint="Sólo para gpt-5*/o*; otros modelos lo ignoran. En medium/high el razonamiento come del mismo presupuesto de tokens de abajo."
                size="xsmall"
              />
              <Select value={reasoning} onValueChange={(v) => setReasoning(v as AiConfig['chat_reasoning_effort'])}>
                <Select.Trigger>
                  <Select.Value placeholder="low" />
                </Select.Trigger>
                <Select.Content>
                  {EFFORTS.map((e) => (
                    <Select.Item key={e} value={e}>
                      {e}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <SettingLabel
                label="Máx. tokens por turno"
                hint="El razonamiento gasta contra este mismo presupuesto: con esfuerzo medium/high y pocos tokens, la respuesta puede volver vacía."
                size="xsmall"
              />
              <Input type="number" min={500} max={32000} value={chatMaxTokens} onChange={num(setChatMaxTokens)} />
            </div>
          </div>
          {/* En las filas con `Switch` la explicación en línea es la que más molesta:
              en un flex el que cede el ancho es el hijo sin `shrink-0`, así que tres
              renglones de prosa le comen el control. Va al tooltip del label. */}
          <div className="flex items-start gap-3 rounded-lg border border-ui-border-base p-3">
            <Switch checked={validationEnabled} onCheckedChange={setValidationEnabled} />
            <SettingLabel
              label="Validar grounding (anti-alucinación)"
              hint="Tras cada respuesta, un juez verifica que las cifras estén respaldadas por los datos y, si no, pide una corrección. Suma una llamada al modelo por turno (más costo/latencia). El veredicto queda en Trazas."
              size="xsmall"
            />
          </div>
        </div>

        {/* Generación de imágenes */}
        <div className="flex flex-col gap-3">
          <Text size="small" weight="plus">
            Generación de imágenes
          </Text>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <SettingLabel
                label="Modelo de imágenes"
                hint="Por defecto nano banana (Gemini 2.5 Flash Image)."
                size="xsmall"
              />
              <Input
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
                placeholder="google/gemini-2.5-flash-image"
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">Calidad WebP (40-90)</Label>
              <Input type="number" min={40} max={90} value={imageQuality} onChange={num(setImageQuality)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">Peso máximo por imagen (KB)</Label>
              <Input type="number" min={50} max={1000} value={imageMaxKb} onChange={num(setImageMaxKb)} />
            </div>
          </div>
        </div>

        {/* Memoria (pgvector) */}
        <div className="flex flex-col gap-3">
          <Text size="small" weight="plus">
            Memoria (contexto vectorizado)
          </Text>
          <div className="flex items-start gap-3 rounded-lg border border-ui-border-base p-3">
            <Switch checked={memoryEnabled} onCheckedChange={setMemoryEnabled} />
            <SettingLabel
              label="Habilitar memoria"
              hint="Antes de responder, los agentes recuperan aprendizajes, reglas, decisiones y documentos cargados, y los inyectan al contexto. Requiere pgvector y la API key de embeddings."
              size="xsmall"
            />
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-ui-border-base p-3">
            <Switch
              checked={autocaptureEnabled}
              onCheckedChange={setAutocaptureEnabled}
              disabled={!memoryEnabled}
            />
            <SettingLabel
              label="Captura automática desde conversaciones"
              hint="Permite que el agente proponga guardar aprendizajes detectados en el chat."
              size="xsmall"
            />
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-ui-border-base p-3">
            <Switch
              checked={autocaptureApproval}
              onCheckedChange={setAutocaptureApproval}
              disabled={!memoryEnabled || !autocaptureEnabled}
            />
            <SettingLabel
              label="Requerir aprobación de lo auto-capturado"
              hint="Lo detectado entra como “pendiente” y se aprueba en la pestaña Memoria antes de usarse."
              size="xsmall"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label size="xsmall">Memorias por turno (1-20)</Label>
              <Input type="number" min={1} max={20} value={memoryTopk} onChange={num(setMemoryTopk)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">Similitud mínima (0-1)</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={memoryMinSim}
                onChange={(e) => {
                  const n = Number.parseFloat(e.target.value);
                  setMemoryMinSim(Number.isFinite(n) ? n : 0);
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">Modelo de embeddings</Label>
              <Input
                value={embeddingsModel}
                onChange={(e) => setEmbeddingsModel(e.target.value)}
                placeholder="openai/text-embedding-3-small"
                className="font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="small" onClick={handleSave} isLoading={saving} disabled={isPending}>
            Guardar configuración
          </Button>
        </div>
      </div>
    </Container>
  );
}
