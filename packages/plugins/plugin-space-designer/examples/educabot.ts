import type {
  SpaceConfiguratorInput,
  SpaceProduct,
  SpaceTemplate,
} from '@minimalart/mercatto-plugin-space-designer';

/** Bind these slots to existing Medusa variants. This example never creates or prices products. */
export type EducabotCatalog = Record<
  'workstation' | 'teacher_desk' | 'storage' | 'computer' | 'projector' | 'robotics_kit',
  { product_id: string; variant_id: string; image_url?: string }
>;

const productLabels: Record<keyof EducabotCatalog, string> = {
  workstation: 'Estación colaborativa hexagonal',
  teacher_desk: 'Escritorio docente',
  storage: 'Mueble de guardado',
  computer: 'Computadora educativa',
  projector: 'Proyector para aula',
  robotics_kit: 'Kit de robótica',
};

export function createEducabotConfigurator(
  salesChannelId: string,
  catalog: EducabotCatalog,
  coverImageUrl?: string,
  assetsBaseUrl = '/space-designer/examples'
): SpaceConfiguratorInput {
  const product = (
    id: keyof EducabotCatalog,
    category: string,
    dimensions: NonNullable<SpaceProduct['dimensions']>,
    asset: NonNullable<SpaceProduct['asset']>,
    placement: SpaceProduct['placement'] = 'scene'
  ): SpaceProduct => ({
    id,
    product_id: catalog[id].product_id,
    variant_id: catalog[id].variant_id,
    label: productLabels[id],
    placement,
    category,
    dimensions,
    asset,
    ...(placement === 'scene' ? { allowed_rotations: [0, 90, 180, 270] } : {}),
  });
  const template = (
    id: string,
    name: string,
    width: number,
    depth: number,
    positions: [number, number][]
  ): SpaceTemplate => ({
    id,
    name,
    description: `${positions.length} estaciones de trabajo, puesto docente, guardado y equipamiento tecnológico.`,
    ...(coverImageUrl ? { image_url: coverImageUrl } : {}),
    room: {
      shape: 'rectangle',
      width,
      depth,
      height: 3,
      floor_color: '#FFFFFF',
      wall_color: '#FFFFFF',
      floor_texture_url: `${assetsBaseUrl}/floors/piso-vinilico.png`,
      wall_texture_url: `${assetsBaseUrl}/wallpapers/steam-verde.png`,
    },
    objects: [
      ...positions.map(([x, z], index) => ({
        id: `station-${index + 1}`,
        product_ref: 'workstation',
        x,
        z,
        rotation: 0,
      })),
      { id: 'teacher', product_ref: 'teacher_desk', x: width / 2, z: 0.7, rotation: 0 },
      { id: 'storage', product_ref: 'storage', x: width - 0.7, z: depth - 0.45, rotation: 0 },
    ],
    included_items: [
      { product_ref: 'computer', quantity: positions.length * 2 },
      { product_ref: 'projector', quantity: 1 },
      { product_ref: 'robotics_kit', quantity: positions.length * 2 },
    ],
  });
  return {
    title: 'Diseñá tu aula maker',
    slug: 'aula-maker',
    status: 'draft',
    sales_channel_id: salesChannelId,
    config: {
      version: 1,
      description: 'Elegí un aula equipada y adaptá su distribución a tu espacio.',
      allow_custom: true,
      products: [
        product(
          'workstation',
          'Mobiliario',
          { width: 2.3, depth: 2.3, height: 0.74 },
          {
            kind: 'primitive',
            model: 'hex-table-set',
            color: '#D9C2A3',
            accent_color: '#2E9E78',
            mount: 'floor',
          }
        ),
        product(
          'teacher_desk',
          'Mobiliario',
          { width: 1.3, depth: 0.7, height: 0.76 },
          {
            kind: 'glb',
            url: `${assetsBaseUrl}/models/teacher-desk.glb`,
            model: 'desk',
            color: '#ECE7DC',
            accent_color: '#F2A13D',
            mount: 'floor',
          }
        ),
        product(
          'storage',
          'Mobiliario',
          { width: 0.9, depth: 0.45, height: 1.1 },
          {
            kind: 'primitive',
            model: 'shelving',
            color: '#E8E3DA',
            accent_color: '#F2A13D',
            mount: 'floor',
          }
        ),
        product(
          'computer',
          'Computación',
          { width: 0.32, depth: 0.22, height: 0.28 },
          {
            kind: 'primitive',
            model: 'computer',
            color: '#36404C',
            accent_color: '#7CC3D1',
            mount: 'surface',
            anchor_product_ref: 'workstation',
          },
          'included'
        ),
        product(
          'projector',
          'Audiovisual',
          { width: 0.32, depth: 0.24, height: 0.13 },
          {
            kind: 'primitive',
            model: 'projector',
            color: '#F1F1EB',
            accent_color: '#424C53',
            mount: 'ceiling',
          },
          'included'
        ),
        product(
          'robotics_kit',
          'Robótica',
          { width: 0.24, depth: 0.18, height: 0.09 },
          {
            kind: 'primitive',
            model: 'robotics-kit',
            color: '#F4BD43',
            accent_color: '#3C77A0',
            mount: 'surface',
            anchor_product_ref: 'workstation',
          },
          'included'
        ),
      ],
      templates: [
        template('small', 'Aula pequeña', 6, 6, [
          [1.6, 3.2],
          [4.4, 3.2],
        ]),
        template('medium', 'Aula mediana', 8, 7, [
          [1.7, 3],
          [5, 3],
          [3.35, 5.6],
        ]),
        template('large', 'Aula grande', 9, 8, [
          [2.2, 3],
          [6.4, 3],
          [2.2, 6],
          [6.4, 6],
        ]),
      ],
      surface_options: {
        floors: [
          {
            label: 'Vinílico claro',
            color: '#FFFFFF',
            texture_url: `${assetsBaseUrl}/floors/piso-vinilico.png`,
          },
          { label: 'Gris', color: '#D7D7D3' },
        ],
        walls: [
          {
            label: 'STEAM verde',
            color: '#FFFFFF',
            texture_url: `${assetsBaseUrl}/wallpapers/steam-verde.png`,
          },
          {
            label: 'STEAM gris',
            color: '#FFFFFF',
            texture_url: `${assetsBaseUrl}/wallpapers/steam-gris.png`,
          },
          {
            label: 'STEAM azul',
            color: '#FFFFFF',
            texture_url: `${assetsBaseUrl}/wallpapers/steam-azul.png`,
          },
        ],
      },
    },
  };
}
