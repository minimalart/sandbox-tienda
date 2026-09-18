import { Button, Drawer, Input, Label, Text } from '@medusajs/ui';
import { useEffect, useState, type ReactElement } from 'react';

/**
 * EL NOMBRE DEL RECORRIDO, al crearlo y al cambiarlo.
 *
 * Un `Drawer` y no un `FocusModal`: es un campo. La pantalla completa que usa el
 * repo para crear un bundle está bien cuando hay cuatro pestañas de formulario, y acá
 * sería tapar todo para escribir seis palabras.
 *
 * El mismo componente sirve para las dos cosas porque son la misma: poner un nombre.
 * Cambia el título y el texto del botón, nada más.
 *
 * **Por qué importa el nombre.** Con un solo recorrido daba igual —era "el
 * recorrido"—. Con varios, la tabla es una lista de nombres: tres filas que digan
 * "Recorrido base" no se distinguen, y elegir cuál publicar pasa a ser abrir una por
 * una hasta reconocerla.
 */
export function NameDrawer({
  open,
  title,
  action,
  initial = '',
  busy = false,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  /** Lo que dice el botón: "Crear" o "Guardar". */
  action: string;
  initial?: string;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
}): ReactElement {
  const [name, setName] = useState(initial);

  // Al abrirse arranca con el valor que corresponde: el nombre actual si se está
  // renombrando, o el sugerido de la plantilla si se está creando. Sin esto, abrir
  // dos veces seguidas mostraba lo que se tipeó la vez anterior.
  useEffect(() => {
    if (open) setName(initial);
  }, [open, initial]);

  const limpio = name.trim();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{title}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-2">
          <Label size="xsmall" htmlFor="nombre-recorrido">
            Nombre
          </Label>
          <Input
            id="nombre-recorrido"
            autoFocus
            size="small"
            placeholder="Compra guiada"
            value={name}
            onChange={(e) => setName(e.target.value)}
            // Enter confirma: es un solo campo y bajar al botón con el mouse para
            // escribir seis palabras es todo el trabajo de más que tiene esta pantalla.
            onKeyDown={(e) => {
              if (e.key === 'Enter' && limpio) onSubmit(limpio);
            }}
          />
          <Text size="xsmall" className="text-ui-fg-subtle">
            Es para vos: el cliente nunca lo ve. Sirve para reconocerlo en la lista
            cuando haya varios.
          </Text>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary">
              Cancelar
            </Button>
          </Drawer.Close>
          <Button size="small" disabled={!limpio || busy} onClick={() => onSubmit(limpio)}>
            {action}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}
