/**
 * Configuración efectiva de carritos abandonados en el plugin.
 *
 * La precedencia es **snapshot > env > default**, IGUAL que la extensión
 * original. La diferencia es que el snapshot vive en el host (`app-settings`)
 * y el plugin no lo puede importar directamente. La coordinación pasa por
 * `@minimalart/mercatto-plugin-runtime`: el host registra su `resolveSettingSync`
 * envuelto una sola vez al arrancar, y este archivo lo lee vía `getAppSettingsSyncReader`.
 *
 * Cuando el host no registró un reader —proyecto sin `app-settings`, tests,
 * boot antes del bridge— se cae a `process.env`. Es la MISMA semántica que la
 * extensión original tenía "antes de que el loader llene el snapshot".
 */
/**
 * TUPLA de tres y no `number[]`: `config.ts` desestructura los tres pasos sin
 * `?? default` por posición, evitando que `noUncheckedIndexedAccess` obligue a
 * repetir defaults como tercera copia.
 */
export type StepHours = readonly [number, number, number];
export type AbandonedCartSettings = {
    enabled: boolean;
    /** Horas de inactividad de cada paso, YA ordenadas. Ver `orderedStepHours`. */
    stepHours: StepHours;
    maxAgeHours: number;
    batchSize: number;
    maxPages: number;
};
export declare function orderedStepHours(raw: number[]): number[];
export declare function getAbandonedCartSettings(): AbandonedCartSettings;
