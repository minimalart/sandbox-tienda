import { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import TypeSenseService from '../../../../../modules/typesense/service';
import { Synonym, SynonymData, SynonymResponse } from '../../../../../modules/typesense/types';

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
 * que la ruta esté cubierta. Mismo caso que `../../curations/[id]`, pero PEOR: ahí se
 * pudo cerrar el DELETE, acá no se puede cerrar ninguno de los dos.
 *
 * Los sinónimos no son filas de Postgres: viven dentro de una colección de Typesense, y
 * los dos guards del repo resuelven un subselect contra la base. El eje real de este
 * módulo es la COLECCIÓN, que `collectionForSite` deriva de la tienda activa. Poner un
 * guard de SQL para que la auditoría deje de contar la ruta sería exactamente el error
 * que la auditoría existe para encontrar.
 *
 * Estado real, verbo por verbo: los TRES leen y escriben en `collectionOf(req, …)`.
 *
 * El PUT y el DELETE estuvieron abiertos, y no por olvido de esta ruta: `upsertSynonym`
 * y `deleteSynonym` ni siquiera ACEPTABAN una colección —clavaban `this.collectionName`,
 * la del clúster— así que desde acá no había nada que pasarles. Con la lectura ya
 * parametrizada y la escritura no, el operador veía los sinónimos de su tienda y editaba
 * los de otra. Se igualaron las firmas a las de `getSynonym`, que ya la tomaba.
 */

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const typeSenseService = new TypeSenseService();
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un ID para el sinónimo',
      });
    }

    const result = await typeSenseService.getSynonym(
      id as string,
      await collectionOf(req, typeSenseService.collectionName),
    );

    return res.status(200).json({
      data: {
        id: result.id,
        root: result.root,
        synonyms: result.synonyms,
        locale: result.locale,
      },
      message: 'Sinónimo obtenido correctamente',
      success: true,
    } as SynonymResponse);
  } catch (error) {
    console.error('Error al obtener sinónimo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener sinónimo en Typesense',
    });
  }
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  try {
    const typeSenseService = new TypeSenseService();
    const { id } = req.params;
    const synonymData = req.body as SynonymData;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un ID para el sinónimo',
      } as SynonymResponse);
    }

    if (!synonymData.synonyms || synonymData.synonyms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Synonyms are required and mandatory for creating/updating synonyms',
      } as SynonymResponse);
    }

    // La colección de la tienda activa, igual que el GET. Sin esto se leían los
    // sinónimos de la tienda y se escribían en la colección por defecto.
    const result = await typeSenseService.upsertSynonym(
      id,
      synonymData,
      await collectionOf(req, typeSenseService.collectionName),
    );

    return res.status(200).json({
      data: {
        id: result.id,
        root: result.root,
        synonyms: result.synonyms,
        locale: result.locale,
      } as Synonym,
      message: 'Synonym created/updated successfully',
      success: true,
    } as SynonymResponse);
  } catch (error) {
    console.error('Error al crear/actualizar sinónimo:', JSON.stringify(error));
    return res.status(500).json({
      success: false,
      message: 'Synonym creation/update failed',
    } as SynonymResponse);
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const typeSenseService = new TypeSenseService();
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un ID para eliminar el sinónimo',
      });
    }

    // Misma colección que el GET y el PUT. Antes borraba en la de por defecto.
    await typeSenseService.deleteSynonym(id, await collectionOf(req, typeSenseService.collectionName));

    return res.status(200).json({
      success: true,
      message: 'Sinónimo eliminado correctamente',
    });
  } catch (error) {
    console.error('Error al eliminar sinónimo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar sinónimo en Typesense',
    });
  }
}
