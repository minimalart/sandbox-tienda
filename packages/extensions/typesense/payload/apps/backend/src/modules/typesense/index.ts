import { Module } from '@medusajs/framework/utils';
import TypeSenseService from './service';

export const TYPESENSE = 'typeSenseService';

export default Module(TYPESENSE, {
  service: TypeSenseService,
});
