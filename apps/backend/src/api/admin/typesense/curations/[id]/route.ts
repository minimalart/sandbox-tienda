import { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import TypeSenseService from '../../../../../modules/typesense/service';
import { CurationResponse } from '../../../../../modules/typesense/types';
import { OverrideCreateSchema } from 'typesense/lib/Typesense/Overrides';

import { siteFromRequest } from '../../../../../lib/multistore/request';
import { collectionForSite } from '../../../../../modules/typesense/site-collection';


/** La colección de la tienda activa; sin mapa configurado, la global. */
const collectionOf = async (req: MedusaRequest, fallback: string): Promise<string> => {
  const resolution = await siteFromRequest(req);
  return collectionForSite(
    fallback,
    resolution.status === 'site' ? resolution.site.id : null,
    typeof req.query.collection === 'string' ? req.query.collection : undefined,
  );
};

/**
 * Por qué acá NO hay `assertIdInSite` ni `assertRowInSite`, y por qué eso no significa
 * que la ruta esté cubierta.
 *
 * Las curaciones NO son filas de Postgres: viven dentro de una colección de Typesense.
 * Los dos guards del repo resuelven un subselect de ids contra la base, así que no
 * tienen nada que preguntar acá. El eje de tienda de este módulo es OTRO: la COLECCIÓN,
 * que `collectionForSite` resuelve a partir de la tienda activa. Meter un guard de SQL
 * para que la auditoría deje de contar la ruta sería el peor resultado posible — un
 * guard que no mira el eje real es peor que ninguno, porque parece que protege.
 *
 * Estado real, verbo por verbo: los TRES leen y escriben en `collectionOf(req, …)`.
 *
 * El DELETE borraba en la colección POR DEFECTO —el método ya aceptaba la colección,
 * simplemente nadie se la pasaba— y el PUT ni siquiera podía: `upsertOverride` clavaba
 * `this.collectionName`, así que era el único de los tres verbos que no la tomaba,
 * contra lo que el comentario de `getOverrides` ya afirmaba ("las curaciones son POR
 * COLECCIÓN"). Con colecciones por tienda eso significaba guardar desde la tienda B y
 * escribirle la curación a la A.
 */

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const typeSenseService = new TypeSenseService();
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un ID para la curación',
      });
    }

    const result = await typeSenseService.getOverride(
      id as string,
      await collectionOf(req, typeSenseService.collectionName),
    );

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Curación obtenida correctamente',
    } as CurationResponse);
  } catch (error) {
    console.error('Error al obtener curación:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener curación en Typesense',
    });
  }
}

// Type guard functions for runtime validation
function isValidOverrideRule(rule: any): boolean {
  if (!rule || typeof rule !== 'object') {
    return false;
  }

  // Check if it's a filter rule (has filter_by property)
  const hasFilterBy = 'filter_by' in rule && typeof rule.filter_by === 'string';

  // Check if it's a query rule (has query property)
  const hasQuery = 'query' in rule && typeof rule.query === 'string';

  // Check if it has other valid properties
  const hasMatch = !('match' in rule) || typeof rule.match === 'string';
  const hasTags = !('tags' in rule) || Array.isArray(rule.tags);

  // Rule must have either filter_by OR query, and valid optional properties
  return (hasFilterBy || hasQuery) && hasMatch && hasTags;
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  try {
    const typeSenseService = new TypeSenseService();
    const { id } = req.params;
    const overrideData = req.body as OverrideCreateSchema;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un ID para la curación',
      });
    }

    if (!overrideData || typeof overrideData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Se requieren datos válidos para la curación',
      });
    }

    if (!isValidOverrideRule(overrideData.rule)) {
      return res.status(400).json({
        success: false,
        message: "La regla de curación debe contener 'query' o 'filter_by' y ser válida",
      });
    }

    // La colección de la tienda activa, igual que el GET y el DELETE. Era el único
    // verbo de curación que escribía en la de por defecto.
    const result = await typeSenseService.upsertOverride(
      id,
      overrideData,
      await collectionOf(req, typeSenseService.collectionName),
    );

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Curación actualizada correctamente',
    } as CurationResponse);
  } catch (error) {
    console.error('Error al actualizar curación:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar curación en Typesense',
    });
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const typeSenseService = new TypeSenseService();
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un ID para la curación',
      });
    }

    // La colección de la tienda activa, igual que el GET. Sin esto se borraba en la
    // colección por defecto, o sea en la de otra.
    await typeSenseService.deleteOverride(
      id as string,
      await collectionOf(req, typeSenseService.collectionName),
    );

    return res.status(200).json({
      success: true,
      message: 'Curación eliminada correctamente',
    });
  } catch (error) {
    console.error('Error al eliminar curación:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar curación en Typesense',
    });
  }
}
