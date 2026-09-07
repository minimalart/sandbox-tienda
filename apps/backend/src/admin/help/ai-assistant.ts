import { defineHelp } from './types';

/**
 * El Asistente IA es el namespace DUEÑO de la key de OpenRouter y de los
 * embeddings, que usan además el Catalogador, SEO & GEO y el generador de
 * landings. Esa relación —y el pendiente de que dos de esos tres todavía leen la
 * variable de entorno— hoy está escrita en el encabezado del descriptor y
 * repetida a medias en el `help` de la key, que es donde entra la mitad.
 *
 * El gotcha caro es el del presupuesto de tokens: los modelos de razonamiento
 * gastan contra el mismo techo, y cuando se quedan sin aire devuelven una
 * respuesta VACÍA que en el chat se lee como "no pude generar una respuesta" y
 * no como un error de configuración. Es la falla que más tiempo hace perder
 * porque no se parece a un problema de ajustes.
 */
export default defineHelp({
  title: 'Asistente IA',
  summary: 'Configura el proveedor de IA, el chat, la memoria, las propuestas proactivas y el MCP.',
  sections: [
    {
      heading: 'La key de OpenRouter la comparte media instalación',
      body: `
        Todos los modelos del proyecto salen por OpenRouter y esta pantalla es la
        DUEÑA de esa credencial: la usan el chat del asistente, los embeddings de
        la memoria, el Catalogador, el Simulador de SEO y el generador de landings.

        Pero de esos tres últimos, hoy sólo el generador de landings lee el valor
        guardado acá. El Catalogador y el Simulador de SEO siguen leyendo la
        variable de entorno. Si los usás, cambiá la key en los DOS lugares hasta que
        terminen de migrar: si no, van a seguir autenticando con la key vieja y el
        síntoma va a ser que "la IA anda en un lado y en el otro no".

        Sin key, el asistente no responde y devuelve un error de servicio no
        disponible, y el job de propuestas se saltea con un aviso en el log.
      `,
    },
    {
      heading: 'Esta pantalla es la capa de instancia',
      body: `
        Lo que se guarda acá vale para toda la instalación. Lo que varía por tienda
        —qué modelo usa el chat de esa tienda, si su memoria está prendida— vive en
        Preferencias, en la sección de IA, y se mergea SOBRE estos valores.

        Estos valores no son sólo el default. Son los que usan directamente todos
        los puntos del código que no resuelven la configuración de la tienda: la
        validación de grounding, los subagentes y el análisis sin request. Esos
        caminos existen y hasta esta pantalla no tenían dueño.
      `,
    },
    {
      heading: 'Cuando el chat dice que no pudo generar una respuesta',
      body: `
        Es casi siempre el presupuesto de tokens de salida por turno, y no un
        problema del modelo ni de la pregunta.

        Los modelos de razonamiento gastan sus tokens de razonamiento contra ESE
        MISMO presupuesto. Con el valor muy bajo, el modelo se queda sin aire
        pensando y devuelve una respuesta vacía marcada como cortada por longitud,
        que en el chat se ve como "no pude generar una respuesta".

        Si aparece ese mensaje, subí el presupuesto antes que ninguna otra cosa.

        El esfuerzo de razonamiento juega en el mismo presupuesto: más esfuerzo son
        mejores respuestas en preguntas de análisis, más latencia y más tokens
        comidos. En los modelos que no razonan OpenRouter lo ignora, así que es
        seguro dejarlo puesto.
      `,
    },
    {
      heading: 'Embeddings: el modelo se cambia, la dimensión no',
      body: `
        La columna donde vive la memoria tiene un ancho de vector FIJO de 1536,
        definido en una migración. Por eso la dimensión no es un ajuste y no
        aparece en esta pantalla: cambiarla es migrar la columna y reindexar todo,
        no guardar un formulario.

        Cambiar el MODELO sí es seguro, siempre que devuelva vectores de esa misma
        dimensión. Uno de otra dimensión lo corta el guard del cliente con un error
        explícito, no lo escribe roto. Y el job que embebe las memorias pendientes
        re-embebe sólo las filas que quedaron con el modelo viejo, así que la
        memoria converge sola en unas corridas.

        Ojo con los homónimos: los campos de "modelo de embeddings" que aparecen en
        Preferencias y en SEO & GEO NO gobiernan esta llamada. El que se usa de
        verdad es el de esta pantalla.

        La key y la URL base de embeddings se mueven JUNTAS. Dejar una en la base y
        otra en el entorno permite el estado imposible de endpoint nuevo con key
        vieja, que falla con un error de autenticación sin ninguna pista.
      `,
    },
    {
      heading: 'Propuestas proactivas',
      body: `
        El motor de especialistas hace primero un triage y después manda un agente
        por cada frente detectado. El motor simple manda todos los agentes siempre.
        Especialistas gasta menos y apunta mejor, pero si el triage no encuentra
        ningún lead se cae solo al modo simple.

        Una propuesta puede ser ASESORA o traer acciones. La asesora no ejecuta
        nada: aceptarla es tomar nota, y lo que propone hay que implementarlo a
        mano. La que trae acciones sí las ejecuta al aprobarla, y el resultado queda
        registrado incluso si alguna falla.

        El límite por corrida es el tope de lo que un humano va a tener que revisar
        cada mañana. El job NO acumula: si quedan propuestas pendientes de revisar,
        la corrida siguiente se saltea entera. Si las propuestas "dejaron de salir",
        mirá primero si hay pendientes sin atender.

        Correr un solo agente es una perilla de DIAGNÓSTICO: saltea el triage y
        reproduce a mano lo que hace el cron. Dejarla puesta apaga el motor de
        especialistas sin decirlo. Vaciala cuando termines.

        La frecuencia del job se hornea al arrancar y se cambia por entorno. Lo que
        sí se configura acá es cuánto analiza cada corrida y con qué motor.
      `,
    },
    {
      heading: 'Servidor MCP',
      body: `
        El camino normal para conectar un cliente externo son las API keys
        gestionadas de la pestaña de configuración, que se revocan una por una.

        El token de acceso de compatibilidad es un único token compartido que
        existe para instalaciones viejas: si no hace falta, dejalo vacío. Un token
        compartido no se puede revocar sin cortarle el acceso a todos.

        La base pública del callback de OAuth sólo hace falta cuando el proxy no
        propaga bien los encabezados de reenvío. Sin ella se deducen del entorno y,
        en última instancia, de esos encabezados.
      `,
    },
    {
      heading: 'Puesta en marcha',
      body: `
        Sólo el primer paso es obligatorio. El resto tiene valores por defecto que
        funcionan.
      `,
      steps: [
        'Crear una key en OpenRouter y pegarla acá. Si usás el Catalogador o el Simulador de SEO, ponerla también en la variable de entorno.',
        'Abrir el chat del asistente y hacer una pregunta cualquiera para confirmar que responde.',
        'Si la respuesta vuelve vacía, subir los tokens de salida por turno.',
        'Ajustar la URL de atribución para poder distinguir en OpenRouter qué instalación gastó qué.',
        'Si la memoria está en uso, confirmar que el modelo de embeddings devuelve vectores de 1536.',
        'Revisar el límite de propuestas por corrida antes de dejar el job corriendo sin supervisión.',
      ],
    },
  ],
});
