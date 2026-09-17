export const directoryBlocks = {
  DirectoryHeader: {
    label: ['Header', 'Header'],
    defaults: { name: 'Tiendas', logo: '', cta_label: '', cta_url: '' },
  },
  DirectoryHero: {
    label: ['Hero y buscador', 'Hero and search'],
    defaults: {
      title: 'Encontrá la tienda de tu comunidad',
      description: 'Cada comunidad tiene su espacio, con productos seleccionados para vos.',
      search_placeholder: 'Buscá por nombre',
      hero_image: '',
    },
  },
  DirectoryListing: {
    label: ['Todas las tiendas', 'All stores'],
    defaults: { list_title: 'Todas las tiendas' },
  },
  DirectoryInvitation: {
    label: ['Invitación', 'Invitation'],
    defaults: {
      cta_title: '¿Tu comunidad todavía no tiene una tienda?',
      cta_description:
        'Creá un espacio personalizado con productos seleccionados para tu comunidad.',
      cta_image: '',
      invitation_label: '',
      invitation_url: '',
    },
  },
  DirectoryBenefits: {
    label: ['Beneficios', 'Benefits'],
    defaults: {
      benefits_title: 'Un espacio para cada comunidad',
      benefits_description: '',
      items: [
        { title: 'Productos seleccionados', description: 'Una selección para cada necesidad.' },
        { title: 'Para tu comunidad', description: 'Todo en un mismo lugar.' },
        { title: 'Acceso simple', description: 'Encontrá tu institución y accedé a su tienda.' },
      ],
    },
  },
  DirectoryFooter: {
    label: ['Footer', 'Footer'],
    defaults: {
      footer_logo: '',
      footer_description: '',
      contact_email: '',
      address: '',
      privacy_url: '',
      terms_url: '',
    },
  },
} as const;

export const directoryFieldLabels: Record<string, [string, string]> = {
  name: ['Nombre', 'Name'],
  logo: ['Logo', 'Logo'],
  cta_label: ['Texto del botón', 'Button label'],
  cta_url: ['Destino del botón', 'Button URL'],
  title: ['Título', 'Title'],
  description: ['Descripción', 'Description'],
  search_placeholder: ['Texto del buscador', 'Search placeholder'],
  hero_image: ['Imagen principal', 'Hero image'],
  list_title: ['Título del listado', 'Listing title'],
  cta_title: ['Título de invitación', 'Invitation title'],
  cta_description: ['Descripción de invitación', 'Invitation description'],
  cta_image: ['Imagen de invitación', 'Invitation image'],
  invitation_label: ['Texto del botón', 'Button label'],
  invitation_url: ['Destino del botón', 'Button URL'],
  benefits_title: ['Título de beneficios', 'Benefits title'],
  benefits_description: ['Descripción', 'Description'],
  items: ['Beneficios', 'Benefits'],
  footer_logo: ['Logo del footer', 'Footer logo'],
  footer_description: ['Descripción del footer', 'Footer description'],
  contact_email: ['Email', 'Email'],
  address: ['Dirección', 'Address'],
  privacy_url: ['Política de privacidad', 'Privacy policy URL'],
  terms_url: ['Términos y condiciones', 'Terms URL'],
  background: ['Fondo destacado', 'Feature background'],
  foreground: ['Color de texto', 'Text color'],
  accent: ['Color de acento', 'Accent color'],
};
export type DirectoryDocument = {
  content: { type: string; props: Record<string, unknown> }[];
  root: { props: { background: string; foreground: string; accent: string } };
};
export const defaultDirectoryDocument: DirectoryDocument = {
  root: { props: { background: '#f5f2ff', foreground: '#100b35', accent: '#5928ed' } },
  content: Object.entries(directoryBlocks).map(([type, block]) => ({
    type,
    props: { id: type, ...block.defaults },
  })),
};

export function validateDirectoryDocument(value: unknown): string | null {
  const doc = value as DirectoryDocument;
  if (!doc || !Array.isArray(doc.content) || !doc.root?.props || doc.content.length > 6)
    return 'Documento Puck inválido / Invalid Puck document';
  const seen = new Set<string>();
  for (const block of doc.content) {
    if (
      !block ||
      typeof block.type !== 'string' ||
      !Object.hasOwn(directoryBlocks, block.type) ||
      seen.has(block.type) ||
      !block.props ||
      typeof block.props !== 'object'
    )
      return 'Bloque inválido o repetido / Invalid or duplicate block';
    seen.add(block.type);
    const allowed = Object.keys(
      directoryBlocks[block.type as keyof typeof directoryBlocks].defaults
    );
    for (const [key, val] of Object.entries(block.props)) {
      if (key === 'id') {
        if (typeof val !== 'string') return 'ID inválido';
        continue;
      }
      if (!allowed.includes(key)) return 'Campo desconocido / Unknown field';
      if (key === 'items') {
        if (
          !Array.isArray(val) ||
          val.length > 8 ||
          val.some(
            (item) =>
              !item ||
              typeof item.title !== 'string' ||
              typeof item.description !== 'string' ||
              item.title.length > 2000 ||
              item.description.length > 2000
          )
        )
          return 'Beneficios inválidos / Invalid benefits';
        continue;
      }
      if (typeof val !== 'string' || val.length > 2000) return 'Texto inválido / Invalid text';
      if (val && (key.endsWith('_url') || key.endsWith('logo') || key.endsWith('_image'))) {
        // Allow local assets as well as uploaded HTTP(S) media; reject protocol-relative URLs.
        if (/^\/(?!\/)/.test(val) || /^#[a-z][\w-]*$/i.test(val)) continue;
        try {
          if (!['http:', 'https:'].includes(new URL(val).protocol))
            return 'URL inválida / Invalid URL';
        } catch {
          return 'URL inválida / Invalid URL';
        }
      }
      if (key === 'contact_email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))
        return 'Email inválido / Invalid email';
    }
  }
  if (!seen.has('DirectoryListing'))
    return 'El listado de tiendas es obligatorio / Store listing is required';
  for (const key of ['background', 'foreground', 'accent'] as const) {
    if (!/^#[0-9a-f]{6}$/i.test(doc.root.props[key])) return 'Color inválido / Invalid color';
  }
  return null;
}

export function resolveDirectoryDocument(value: unknown) {
  const doc = validateDirectoryDocument(value)
    ? defaultDirectoryDocument
    : (value as DirectoryDocument);
  // Project only declared public fields. Empty text intentionally hides optional content.
  const config: Record<string, unknown> = {
    background: doc.root.props.background,
    foreground: doc.root.props.foreground,
    accent: doc.root.props.accent,
    sections: doc.content.map((block) => block.type),
  };
  for (const block of doc.content) {
    const defaults = directoryBlocks[block.type as keyof typeof directoryBlocks].defaults;
    for (const [key, fallback] of Object.entries(defaults))
      config[key] = block.props[key] ?? fallback;
  }
  return config;
}
