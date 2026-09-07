import UserModule from '@medusajs/medusa/user';
import { defineLink } from '@medusajs/framework/utils';
import DeliveryModule from '../modules/delivery';

/**
 * Driver ↔ User (admin User de Medusa).
 *
 * Relación 1:1: cada Driver de flota propia se autentica en la PWA con un admin
 * User de Medusa. El link habilita resolver el Driver desde el user autenticado
 * (query.graph: `user.driver`) y viceversa (`driver.user`), sin acoplar las
 * tablas con una FK física cross-module.
 *
 * El Driver también denormaliza `user_id` como columna (modelo driver.ts) para
 * un lookup directo sin graph cuando alcanza; el link es la fuente de verdad de
 * la relación y la que habilita el traversal.
 */
export default defineLink(
  {
    linkable: DeliveryModule.linkable.driver,
    isList: false,
  },
  {
    linkable: UserModule.linkable.user,
    isList: false,
  },
  {
    database: {
      table: 'driver_user',
      idPrefix: 'drvusr',
    },
  },
);
