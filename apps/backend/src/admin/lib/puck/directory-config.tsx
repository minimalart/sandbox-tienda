import type { Config } from '@measured/puck';
import {
  directoryBlocks,
  directoryFieldLabels,
} from '../../../modules/demo-store/directory-document';
import { s3ImageField } from './fields/s3-image-field';

export function directoryPuckConfig(language: string): Config {
  const en = language.startsWith('en');
  const label = (key: string) => directoryFieldLabels[key]?.[en ? 1 : 0] ?? key;
  const field = (key: string): any => {
    if (key === 'items')
      return {
        type: 'array',
        label: label(key),
        max: 8,
        arrayFields: {
          title: { type: 'text', label: label('title') },
          description: { type: 'textarea', label: label('description') },
        },
        defaultItemProps: { title: '', description: '' },
        getItemSummary: (item: any) => item.title,
      };
    if (key.endsWith('logo') || key.endsWith('_image')) return s3ImageField(label(key));
    return { type: key.includes('description') ? 'textarea' : 'text', label: label(key) };
  };
  return {
    root: {
      fields: Object.fromEntries(
        ['background', 'foreground', 'accent'].map((key) => [key, field(key)])
      ),
      render: ({ children }: any) => <>{children}</>,
    },
    components: Object.fromEntries(
      Object.entries(directoryBlocks).map(([type, block]) => [
        type,
        {
          label: block.label[en ? 1 : 0],
          fields: Object.fromEntries(Object.keys(block.defaults).map((key) => [key, field(key)])),
          defaultProps: structuredClone(block.defaults),
          render: (props: any) => (
            <section className="m-4 rounded-lg border border-ui-border-base bg-ui-bg-base p-6 text-ui-fg-base">
              <p className="mb-3 text-xs text-ui-fg-subtle">{block.label[en ? 1 : 0]}</p>
              {(props.hero_image || props.cta_image || props.logo || props.footer_logo) && (
                <img
                  src={props.hero_image || props.cta_image || props.logo || props.footer_logo}
                  alt=""
                  style={{ maxHeight: 220, maxWidth: '100%', objectFit: 'contain' }}
                />
              )}
              <h2 className="text-xl font-semibold">
                {props.title ||
                  props.list_title ||
                  props.cta_title ||
                  props.benefits_title ||
                  props.name}
              </h2>
              <p className="mt-2">
                {props.description ||
                  props.cta_description ||
                  props.footer_description ||
                  props.benefits_description}
              </p>
              {type === 'DirectoryListing' && (
                <p className="mt-3 text-ui-fg-subtle">
                  {en
                    ? 'All published stores. Automatic loading in batches of 20.'
                    : 'Todas las tiendas publicadas. Carga automática de a 20.'}
                </p>
              )}
              {props.items?.map((item: any, index: number) => (
                <p key={index} className="mt-3">
                  <strong>{item.title}</strong> — {item.description}
                </p>
              ))}
            </section>
          ),
        },
      ])
    ),
  } as Config;
}
