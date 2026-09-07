"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const config_1 = require("../../../../modules/fiscal-documentation/config");
const _helpers_1 = require("../_helpers");
/**
 * GET /admin/fiscal-documents/config — configuración actual de la extensión.
 *
 * `arca` viaja al lado y NO adentro de `config`: son dos cosas distintas guardadas
 * en dos lugares distintos. `config` es el jsonb plano de la extensión, que este
 * endpoint también ESCRIBE; `arca` es el estado de la conexión con AFIP, que sale de
 * `site_setting` + `site_credential` y desde acá es de SÓLO LECTURA — se edita en
 * "Ajustes de extensiones" y en "Credenciales por tienda". Mezclarlos haría que el
 * POST de abajo, que mergea `{...current, ...body}`, terminara persistiendo el
 * estado de ARCA como si fuera configuración.
 *
 * Nunca incluye material del certificado: `readArcaStatus` devuelve booleanos.
 */
async function GET(req, res) {
    const [config, arca] = await Promise.all([(0, _helpers_1.readFiscalConfig)(req), (0, _helpers_1.readArcaStatus)(req)]);
    res.json({ config, arca });
}
/**
 * POST /admin/fiscal-documents/config — actualiza la configuración (merge parcial
 * con la actual). Persiste en el setting versionado del site-manager.
 */
async function POST(req, res) {
    const body = (req.body ?? {});
    const current = await (0, _helpers_1.readFiscalConfig)(req);
    const merged = (0, config_1.normalizeFiscalConfig)({ ...current, ...body });
    try {
        const config = await (0, _helpers_1.writeFiscalConfig)(req, merged);
        res.json({ config });
    }
    catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : 'No se pudo guardar.' });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Zpc2NhbC1kb2N1bWVudHMvY29uZmlnL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBaUJBLGtCQUdDO0FBTUQsb0JBVUM7QUFuQ0QsNEVBQXdGO0FBQ3hGLDBDQUFrRjtBQUVsRjs7Ozs7Ozs7Ozs7O0dBWUc7QUFDSSxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsTUFBTSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFBLDJCQUFnQixFQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUEseUJBQWMsRUFBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdkYsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQzdCLENBQUM7QUFFRDs7O0dBR0c7QUFDSSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsTUFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBNEIsQ0FBQztJQUN6RCxNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUEsMkJBQWdCLEVBQUMsR0FBRyxDQUFDLENBQUM7SUFDNUMsTUFBTSxNQUFNLEdBQUcsSUFBQSw4QkFBcUIsRUFBQyxFQUFFLEdBQUcsT0FBTyxFQUFFLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUM5RCxJQUFJLENBQUM7UUFDSCxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUEsNEJBQWlCLEVBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3BELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZCLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMscUJBQXFCLEVBQUUsQ0FBQyxDQUFDO0lBQ3BHLENBQUM7QUFDSCxDQUFDIn0=