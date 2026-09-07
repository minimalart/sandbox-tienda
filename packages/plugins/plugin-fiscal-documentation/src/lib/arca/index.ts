// ARCA no es un módulo Medusa: es un cliente WSAA + padrón A5 de AFIP
// usado por el módulo `fiscal-documentation` (para generar facturas A) y
// por la ruta store `/store/arca/taxpayer-lookup` (autocomplete de CUIT).
//
// El plugin loader de Medusa 2.18 auto-descubre `src/modules/*/index.ts`
// esperando un `Module()` registration. Este archivo existe para que ese
// scan no tire ENOENT sobre `modules/arca/index.js` — no registra un
// módulo, solo re-exporta el resto del namespace como una librería.
export * from './config';
export * from './constancia';
export * from './fixtures';
export * from './lookup';
export * from './mapper';
export * from './settings';
export * from './site-credentials';
export * from './types';
export * from './wsaa';
