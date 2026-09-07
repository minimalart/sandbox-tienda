import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `erp_tinting_base.sellable_untinted`: la base que TAMBIÉN es un producto
 * terminado.
 *
 * Hasta acá "es base entonable" implicaba "no se vende sin color": el PDP
 * bloquea el botón hasta que se elige uno, porque una base pelada no es un
 * producto vendible. Eso es cierto para una `BASE P`, que en la góndola no
 * existe sola, y es FALSO para el blanco de las líneas que no tienen base P
 * —Albalux Balance, Satinol Balance, los Texturados—: ahí el mismo artículo se
 * vende como blanco y además es la base de los colores claros. Medido contra
 * Zeus (DESDEELSUR-22): el artículo 232 cotiza `00GY 80/069` y rechaza
 * `00NN 20/000`, exactamente complementario a las letras MF y T de su línea.
 *
 * Va como columna y no en `metadata` porque decide si el botón de comprar queda
 * bloqueado: es la misma clase de dato que `confirmed` y `active`.
 *
 * Default `false`: las 118 bases que ya existen se quedan como están, que es lo
 * correcto para todas.
 *
 * El nombre lleva el módulo (`...Erp`) porque `mikro_orm_migrations` es UNA
 * tabla global y umzug registra por NOMBRE de archivo sin módulo: dos
 * migraciones homónimas en módulos distintos se saltean EN SILENCIO. Lo hace
 * cumplir `src/modules/migration-names.test.ts`.
 *
 * Idempotente (`IF NOT EXISTS`): se puede correr sobre una base que ya la tenga.
 */
export class Migration20260827120000Erp extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "erp_tinting_base"
         ADD COLUMN IF NOT EXISTS "sellable_untinted" BOOLEAN NOT NULL DEFAULT FALSE;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "erp_tinting_base" DROP COLUMN IF EXISTS "sellable_untinted";`);
  }
}
