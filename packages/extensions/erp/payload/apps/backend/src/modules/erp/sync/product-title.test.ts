import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProductTitle,
  normalizePresentationLabel,
  supersededPresentationLabels,
  resolveTitleRules,
  titleRulesFingerprint,
  TITLE_RULES_VERSION,
  applyReadingCase,
  presentationFromNormalizedTitle,
} from './product-title.ts';

const rules = resolveTitleRules();
const run = (raw: string | null, brand?: string | null) =>
  normalizeProductTitle(raw, { brand, rules });
const title = (raw: string | null, brand?: string | null) => run(raw, brand).title;

/**
 * Los casos de la hoja "Casos reales" de la especificación son el criterio de
 * aceptación acordado con el cliente: van uno a uno, con la marca que la hoja
 * declara como dato auxiliar.
 */
describe('normalizeProductTitle — casos reales de la especificación', () => {
  it('caso 1: marca al inicio, guion y presentación en litros (R01/R02/R03/R04/R16)', () => {
    assert.equal(title('VENIER - BARNIZ MARINO X 0,25 LTS', 'VENIER'), 'Barniz marino x0,25 lt');
  });

  it('caso 2: la línea comercial Dr. Ox. conserva su formato (R10)', () => {
    assert.equal(
      title('VENIER - DR. OX. ESMALTE METALICO NEGRO X 1 LT', 'VENIER'),
      'Dr. Ox. esmalte metálico negro x1 lt'
    );
  });

  it('caso 3: la fracción conocida se convierte y permanece en el título (R07)', () => {
    assert.equal(
      title('VITECSO - VITELAST REMOVEDOR GEL X 1/2 LT', 'VITECSO'),
      'Vitelast removedor gel x0,5 lt'
    );
  });

  it('caso 4: la leyenda comercial se elimina del nombre permanente (R09)', () => {
    assert.equal(
      title('VENIER - IGNIFUGO TEXTIL X 5 LTS (SUPER OFERTA)', 'VENIER'),
      'Ignífugo textil x5 lt'
    );
  });

  // El envase sale `x1 lt` y no `x0,9 lt` porque es una BASE: los 0,1 l que le
  // faltan al litro los llena el entonado (R25). Y la letra técnica no se nombra
  // en el título: la elige el tintométrico, no el comprador (R26).
  it('caso 5: la letra técnica de base se va del título (R11/R25/R26)', () => {
    assert.equal(
      title('SATINOL BALANCE ESMALTE SATINADO BASE T X0.9 LITROS'),
      'Satinol balance esmalte satinado x1 lt'
    );
  });

  it('caso 6: sin marca informada se normaliza igual y no se quita nada (R13)', () => {
    assert.equal(title('BARNIZ 1 KG', ''), 'Barniz x1 kg');
  });

  it('caso 7: el mismo título recibido de nuevo da el mismo resultado (R14)', () => {
    const once = title('VENIER - BARNIZ MARINO X 0,25 LTS', 'VENIER');
    assert.equal(title(once, 'VENIER'), once);
  });

  it('caso 8: la capacidad comercial 8,7 lt no se convierte (R04/R06)', () => {
    assert.equal(run('LATEX INTERIOR X 8,7 LTS').presentation, '8,7 lt');
    assert.equal(title('LATEX INTERIOR X 8,7 LTS'), 'Látex interior x8,7 lt');
  });

  it('caso 9: se eliminan guion y barra vertical, se conserva la presentación (R08/R16)', () => {
    assert.equal(title('MARBLE COLOR BASE T - MEDIANO | X25 KGS'), 'Marble color mediano x25 kg');
  });

  it('caso 10: litros se expresa únicamente como lt (R04/R25)', () => {
    assert.equal(
      title('SATINOL BALANCE ESMALTE SATINADO BASE T X0.9 LITROS'),
      'Satinol balance esmalte satinado x1 lt'
    );
  });
});

/**
 * Segunda tanda de reglas (R17–R24), acordada sobre el resultado del primer
 * barrido. La lista es literal: entrada tal como está en el catálogo hoy →
 * salida pedida.
 *
 * Dos casos de la lista salen distinto a propósito y están abajo, en
 * "desvíos deliberados", con el motivo.
 */
describe('normalizeProductTitle — casos acordados de la segunda tanda', () => {
  const cases: Array<[string, string]> = [
    [
      'Albavial al solvente (tradicional) amarillo 4 L',
      'Albavial al solvente tradicional amarillo x4 lt',
    ],
    ['Óxido real (solo activador) 100 cc', 'Óxido real solo activador x100 cc'],
    ['Óxido real (solo base) 200 cc', 'Óxido real solo base x200 cc'],
    ['Desengrasante/limpiador x5 L', 'Desengrasante limpiador x5 lt'],
    ['Natural stone burdeos x 5 kgs (sin base)', 'Natural stone burdeos sin base x5 kg'],
    [
      'Classic stone paris x 25 kgs (sin base y a pedido)',
      'Classic stone Paris sin base y a pedido x25 kg',
    ],
    ['AA disco pulir 115 mm. (chicos) nº 50', 'AA disco pulir chicos 115 mm N.º 50'],
    ['2X ultra cover azul brillante (252156)', '2X Ultra Cover azul brillante 252156'],
    ['Enduido plástico p/interior x20 L', 'Enduido plástico p/interior x20 lt'],
    ['Masilla exterior multiusos x1,5 Kg', 'Masilla exterior multiusos x1,5 kg'],
    [
      'Cinta metrica serie 500 con freno 5m x 19mm',
      'Cinta métrica serie 500 con freno 5 m x 19 mm',
    ],
    ['Raspavidrio rojo c/ 5 repuestos (adentro)', 'Raspavidrio rojo c/ 5 repuestos adentro'],
    ['Destornillador plano 5 mm (DPC5) x 100 mm', 'Destornillador plano DPC5 5x100 mm'],
    ['Cutter plástico 18MM (C118)', 'Cúter plástico C118 18 mm'],
    ['Aerografo tipo lapiz (pak)', 'Aerógrafo tipo lápiz PAK'],
    [
      'Escalera madera pintor (escalon vertical) x 5 esc',
      'Escalera madera pintor escalón vertical x5 esc',
    ],
    ['MOLDURA M33 19X32MM. (2ML)', 'Moldura M33 19x32 mm (2 m lineales)'],
    ['RODILLO N16', 'Rodillo N.º 16'],
    ['RODILLO Nº7', 'Rodillo N.º 7'],
    ['RODILLO 9 PULGADAS', 'Rodillo 9"'],
    ['SET ESPATULAS PLASTICAS (1,5 3 y 6)', 'Set espátulas plásticas 1,5", 3" y 6"'],
    ['PINCEL C/IMAN', 'Pincel c/imán'],
    ['SET 3 ESPATULAS', 'Set de 3 espátulas'],
  ];

  for (const [raw, expected] of cases) {
    it(raw, () => {
      assert.equal(title(raw), expected);
      // Cada caso acordado vale también como caso de idempotencia (R14).
      assert.equal(title(expected), expected, 'no es idempotente');
    });
  }
});

describe('normalizeProductTitle — desvíos deliberados de la lista de casos', () => {
  it('el paréntesis con cantidad conserva los paréntesis en lugar de abrirse con comas (R19)', () => {
    // La lista pedía "… 127 mm, 8 per, N.º 120", pero R19 dice que un paréntesis
    // con cantidad es un dato técnico y los conserva, igual que "(2 m lineales)".
    assert.equal(
      title('AA disco autofijante roto orbital 127 mm. (8 per) n° 120'),
      'AA disco autofijante roto orbital 127 mm (8 per) N.º 120'
    );
  });

  it('entre dos medidas de unidad distinta la x va separada (R18)', () => {
    // La lista pedía "… 7 cm x2,5 m de largo"; R18 pide la x separada cuando las
    // unidades difieren, como en "5 m x 19 mm".
    assert.equal(
      title('Zocalo blanco PVC altura 7 cm. x 2,5 mts de largo'),
      'Zócalo blanco PVC altura 7 cm x 2,5 m de largo'
    );
  });
});

describe('normalizeProductTitle — idempotencia (R14)', () => {
  const cases: Array<[string, string | null]> = [
    ['VENIER - BARNIZ MARINO X 0,25 LTS', 'VENIER'],
    ['VENIER - DR. OX. ESMALTE METALICO NEGRO X 1 LT', 'VENIER'],
    ['VITECSO - VITELAST REMOVEDOR GEL X 1/2 LT', 'VITECSO'],
    ['VENIER - IGNIFUGO TEXTIL X 5 LTS (SUPER OFERTA)', 'VENIER'],
    ['SATINOL BALANCE ESMALTE SATINADO BASE T X0.9 LITROS', null],
    ['ALBACRYL LATEX INTERIOR ACRILICO MATE BASE X P 17,4 LTS', null],
    ['SATINOL BALANCE ESMALTE SATINADO BASE MF X 0,9 LTS', null],
    ['BEBIDA A BASE DE ALMENDRAS X 1 LT', null],
    ['BARNIZ 1 KG', ''],
    ['MARBLE COLOR BASE T - MEDIANO | X25 KGS', null],
    ['ALBATROS BARNIZ MARINO DOBLE VIDA TRANSPARENTE X 1 LT.', 'ALBATROS'],
    ['CINTA PAPEL 18MM X 50MTS', null],
    ['MOLDURA M33 19X32MM. (2ML)', null],
    ['DISCO CORTE 4 1/2 PULGADAS', null],
    ['SET ESPATULAS PLASTICAS (1,5 3 y 6)', null],
    ['AA DISCO PULIR 115 MM. (CHICOS) Nº 50', null],
  ];

  it('normalizar dos veces da el mismo resultado que normalizar una', () => {
    for (const [raw, brand] of cases) {
      const once = title(raw, brand);
      assert.equal(title(once, brand), once, `no es idempotente: ${raw}`);
    }
  });

  it('un título ya normalizado no reporta ninguna regla aplicada', () => {
    for (const [raw, brand] of cases) {
      const once = title(raw, brand);
      assert.deepEqual(run(once, brand).applied, [], `${once} volvió a cambiar`);
    }
  });
});

describe('normalizeProductTitle — marca (R01/R13)', () => {
  it('quita la marca solo cuando coincide con el atributo estructurado', () => {
    assert.equal(title('VENIER BARNIZ MARINO', 'VENIER'), 'Barniz marino');
  });

  it('no quita nada cuando la marca no coincide con el inicio del título', () => {
    assert.equal(title('BARNIZ MARINO VENIER', 'VENIER'), 'Barniz marino venier');
  });

  it('quita el prefijo más largo cuando el atributo trae la línea pegada', () => {
    // Casos REALES de la cuenta: el atributo Marca incluye la línea comercial pero
    // el título la separa con guion, así que exigir todos los tokens dejaba la
    // marca adentro ("Venier Dr. Ox. esmalte…", "Rust oleum acabado…").
    assert.equal(
      title('VENIER - DR. OX. ESMALTE SATINADO NEGRO X 1 LT', 'VENIER DrOx'),
      'Dr. Ox. esmalte satinado negro x1 lt'
    );
    assert.equal(
      title('RUST OLEUM - ACABADO METALICO INTERIOR PLATA (272073)', 'RUST OLEUM SP'),
      'Acabado metálico interior plata 272073'
    );
  });

  it('el match por tokens es lo que evita comerse parte del nombre', () => {
    // Con match por substring, la marca "ALBA" habría convertido "ALBALATEX" en
    // "LATEX". Por tokens no matchea y el nombre sobrevive entero.
    assert.equal(
      title('ALBALATEX MATE INTERIOR BLANCO X 4 LTS', 'ALBA'),
      'Albalatex mate interior blanco x4 lt'
    );
  });

  it('no infiere la marca cuando el atributo viene vacío', () => {
    assert.equal(title('VENIER BARNIZ MARINO', null), 'Venier barniz marino');
    assert.equal(title('VENIER BARNIZ MARINO', '  '), 'Venier barniz marino');
  });

  it('compara la marca sin tildes ni caso', () => {
    assert.equal(title('SINTEPLAST LATEX INTERIOR', 'Sinteplast'), 'Látex interior');
  });

  it('soporta marcas de varias palabras', () => {
    assert.equal(title('EQ ARTE - ACRILICO NEGRO X 50 CC', 'EQ ARTE'), 'Acrílico negro x50 cc');
  });

  it('no deja el título vacío cuando el nombre del artículo ES la marca', () => {
    assert.equal(title('VENIER', 'VENIER'), 'Venier');
    assert.equal(title('VENIER -', 'VENIER'), 'Venier');
  });

  it('respeta strip_brand en false', () => {
    const kept = resolveTitleRules({ strip_brand: false });
    assert.equal(
      normalizeProductTitle('VENIER - BARNIZ MARINO X 0,25 LTS', { brand: 'VENIER', rules: kept })
        .title,
      'Venier barniz marino x0,25 lt'
    );
  });
});

describe('normalizeProductTitle — presentación (R03–R07)', () => {
  it('normaliza todas las abreviaturas de litros a lt', () => {
    for (const unit of ['LT', 'LTS', 'LITRO', 'LITROS', 'lts.', 'Lt']) {
      assert.equal(title(`BARNIZ X 4 ${unit}`), 'Barniz x4 lt', unit);
    }
  });

  it('kilogramos siempre kg y gramos siempre gr', () => {
    assert.equal(title('MASILLA X 25 KGS'), 'Masilla x25 kg');
    assert.equal(title('MASILLA X 25 KG'), 'Masilla x25 kg');
    assert.equal(title('PIGMENTO X 500 GRS'), 'Pigmento x500 gr');
    assert.equal(title('PIGMENTO X 500 GR'), 'Pigmento x500 gr');
  });

  it('mililitros a ml, y cc se conserva como cc (también escrito CM3 o C.C.)', () => {
    assert.equal(title('TINTA X 80 MLS'), 'Tinta x80 ml');
    assert.equal(title('TINTA X 125CC'), 'Tinta x125 cc');
    assert.equal(title('TINTA X 125 CM3'), 'Tinta x125 cc');
    assert.equal(title('TINTA X 125 C.C.'), 'Tinta x125 cc');
  });

  it('la x va pegada a la cantidad y se agrega aunque el origen no la traiga (R03)', () => {
    assert.equal(title('BARNIZ X 1 LT'), 'Barniz x1 lt');
    assert.equal(title('BARNIZ 1 LT'), 'Barniz x1 lt');
    assert.equal(title('BARNIZ X1 LT'), 'Barniz x1 lt');
  });

  it('la etiqueta de la variante va sin la x', () => {
    assert.equal(run('BARNIZ X 20 LTS').presentation, '20 lt');
    assert.equal(run('BARNIZ 1 KG').presentation, '1 kg');
  });

  it('no lee como presentación un número final sin unidad conocida (excepción R03)', () => {
    assert.equal(title('ACRILICO G2 010'), 'Acrílico G2 010');
    assert.equal(run('ACRILICO G2 010').presentation, null);
  });

  it('una medida de longitud al final NO es presentación y no lleva x', () => {
    assert.equal(title('AA DISCO PULIR 115 MM'), 'AA disco pulir 115 mm');
    assert.equal(run('AA DISCO PULIR 115 MM').presentation, null);
    assert.equal(title('ROLLO ALAMBRE X 10 MTS'), 'Rollo alambre x10 m');
    assert.equal(run('ROLLO ALAMBRE X 10 MTS').presentation, null);
  });

  it('avisa cuando hay x explícita con unidad desconocida (R15)', () => {
    const result = run('ESCALERA MADERA PINTOR X 5 ESC');
    assert.equal(result.presentation, null);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0]!, /Unidad desconocida/);
    // Aun así el título se normaliza: la x queda pegada a la cantidad.
    assert.equal(result.title, 'Escalera madera pintor x5 esc');
  });

  it('convierte solo las fracciones con regla y avisa por el resto (R07)', () => {
    assert.equal(title('REMOVEDOR X 1/2 LT'), 'Removedor x0,5 lt');
    const other = run('REMOVEDOR X 3/4 LT');
    assert.equal(other.title, 'Removedor x3/4 lt');
    assert.match(other.warnings[0]!, /Fracción "3\/4"/);
  });
});

describe('normalizeProductTitle — unidades y medidas (R17/R18)', () => {
  it('separa el número de la unidad', () => {
    assert.equal(title('AMOLADORA 550W'), 'Amoladora 550 W');
    assert.equal(title('PINCEL 15CM'), 'Pincel 15 cm');
    assert.equal(title('CINTA 18MM'), 'Cinta 18 mm');
  });

  it('elimina el punto residual de la unidad', () => {
    assert.equal(title('DISCO 115 MM.'), 'Disco 115 mm');
    assert.equal(title('BARNIZ X 1 LT.'), 'Barniz x1 lt');
  });

  it('las de longitud se unifican en mm, cm y m', () => {
    assert.equal(title('VARILLA 2 MTS'), 'Varilla 2 m');
    assert.equal(title('VARILLA 2 METROS'), 'Varilla 2 m');
    assert.equal(title('ZOCALO 7 CMS'), 'Zócalo 7 cm');
  });

  it('medida compuesta con la misma unidad: x pegada y unidad una sola vez', () => {
    assert.equal(title('MARCO 20 X 30 CM'), 'Marco 20x30 cm');
    assert.equal(title('MOLDURA 19X32MM.'), 'Moldura 19x32 mm');
    assert.equal(title('VARILLA 5MM X 100MM'), 'Varilla 5x100 mm');
  });

  it('medida compuesta con unidades distintas: cada valor conserva la suya', () => {
    assert.equal(title('CINTA 5M X 19MM'), 'Cinta 5 m x 19 mm');
    assert.equal(title('CINTA PAPEL 18MM X 50MTS'), 'Cinta papel 18 mm x 50 m');
  });

  it('no lee como medida compuesta una expresión comercial con la presentación', () => {
    assert.equal(title('PEGAMENTO 3EN1 X 200 CC'), 'Pegamento 3 en 1 x200 cc');
  });

  it('no lee como medida una marca que se escribe igual', () => {
    // 3M es marca de lijas y cintas; sin la excepción saldría "Lija 3 m".
    assert.equal(title('LIJA AL AGUA 3M N 400'), 'Lija al agua 3M N.º 400');
    // La longitud de verdad sí se separa.
    assert.equal(title('VARILLA 2M'), 'Varilla 2 m');
  });
});

describe('normalizeProductTitle — decimales (R06)', () => {
  it('usa coma decimal', () => {
    assert.equal(title('ESMALTE X0.9 LITROS'), 'Esmalte x0,9 lt');
    assert.equal(title('LATEX X 17.4 LTS'), 'Látex x17,4 lt');
    assert.equal(title('ESMALTE X 0,25 LTS'), 'Esmalte x0,25 lt');
  });

  it('quita los ceros decimales que no aportan', () => {
    assert.equal(title('LATEX X 1,00 LT'), 'Látex x1 lt');
    assert.equal(title('LATEX X 0,90 LTS'), 'Látex x0,9 lt');
  });

  it('el punto de miles no es un decimal', () => {
    assert.equal(title('TINTA X 1.000 CC'), 'Tinta x1000 cc');
  });
});

describe('normalizeProductTitle — paréntesis (R19)', () => {
  it('la característica descriptiva se integra al título', () => {
    assert.equal(title('OXIDO REAL (SOLO BASE) 200 CC'), 'Óxido real solo base x200 cc');
    assert.equal(title('ESCALERA (ESCALON VERTICAL)'), 'Escalera escalón vertical');
  });

  it('el paréntesis que sigue a una medida se abre ANTES de la medida', () => {
    // La medida es especificación y el contenido pertenece al nombre.
    assert.equal(title('AA DISCO PULIR 115 MM. (CHICOS)'), 'AA disco pulir chicos 115 mm');
    assert.equal(title('CUTTER PLASTICO 18MM (C118)'), 'Cúter plástico C118 18 mm');
  });

  it('el código técnico se conserva sin paréntesis y en mayúsculas', () => {
    assert.equal(title('HORQUILLA CON CABO CORTO 4D (602.hcp4)'), 'Horquilla con cabo corto 4D 602.HCP4');
    assert.equal(title('2X ULTRA COVER AZUL (252156)'), '2X Ultra Cover azul 252156');
  });

  it('el paréntesis con una cantidad se conserva', () => {
    assert.equal(title('DISCO ORBITAL 127 MM. (8 PER)'), 'Disco orbital 127 mm (8 per)');
  });
});

describe('normalizeProductTitle — barras y abreviaturas (R20)', () => {
  it('conserva la barra de abreviatura y de código', () => {
    assert.equal(title('ENDUIDO P/INTERIOR X20 LTS'), 'Enduido p/interior x20 lt');
    assert.equal(title('RASPAVIDRIO C/ 5 REPUESTOS'), 'Raspavidrio c/ 5 repuestos');
    assert.equal(title('LIJA 920/2'), 'Lija 920/2');
    assert.equal(title('CINTA 16/1'), 'Cinta 16/1');
  });

  it('elimina la barra que separa dos palabras', () => {
    assert.equal(title('DESENGRASANTE/LIMPIADOR X5 LTS'), 'Desengrasante limpiador x5 lt');
  });

  it('corrige la palabra que sigue a la abreviatura', () => {
    assert.equal(title('CEPILLO C/IMAN'), 'Cepillo c/imán');
  });
});

describe('normalizeProductTitle — numeraciones y expresiones (R21/R22)', () => {
  it('unifica la numeración en N.º y le quita los ceros a la izquierda', () => {
    assert.equal(title('RODILLO N16'), 'Rodillo N.º 16');
    assert.equal(title('RODILLO Nº7'), 'Rodillo N.º 7');
    assert.equal(title('DISCO nº 11'), 'Disco N.º 11');
    assert.equal(title('DISCO N° 120'), 'Disco N.º 120');
    assert.equal(title('DISCO NRO 3'), 'Disco N.º 3');
    assert.equal(title('DISCO N.º 07'), 'Disco N.º 7');
    assert.equal(title('PINCEL N 10'), 'Pincel N.º 10');
  });

  it('no confunde la n de otra palabra con una numeración', () => {
    assert.equal(title('PEGAMENTO 2 EN 1 X 200 CC'), 'Pegamento 2 en 1 x200 cc');
    assert.equal(title('PINTURA A LA TIZA 100 NEGRO X 200 CC'), 'Pintura a la tiza 100 negro x200 cc');
  });

  it('normaliza las expresiones comerciales', () => {
    assert.equal(title('PEGAMENTO 3EN1'), 'Pegamento 3 en 1');
    assert.equal(title('PEGAMENTO 3 EN1'), 'Pegamento 3 en 1');
    assert.equal(title('PEGAMENTO 3EN 1'), 'Pegamento 3 en 1');
    assert.equal(title('SET 3 ESPATULAS'), 'Set de 3 espátulas');
  });
});

describe('normalizeProductTitle — pulgadas (R24)', () => {
  it('usa el símbolo pegado al número', () => {
    assert.equal(title('RODILLO 9 PULGADAS'), 'Rodillo 9"');
    assert.equal(title('PINCEL 2 PULG.'), 'Pincel 2"');
    assert.equal(title('DISCO 4 1/2 PULGADAS'), 'Disco 4,5"');
  });

  it('una lista de medidas entre paréntesis lo lleva en cada valor', () => {
    assert.equal(title('SET ESPATULAS (1,5 3 y 6)'), 'Set espátulas 1,5", 3" y 6"');
    assert.equal(title('SET ESPATULAS (2 y 6)'), 'Set espátulas 2" y 6"');
  });
});

describe('normalizeProductTitle — metros lineales (R23)', () => {
  it('ML es metros lineales en un perfil que se vende por metro', () => {
    assert.equal(title('MOLDURA M33 19X32MM. (2ML)'), 'Moldura M33 19x32 mm (2 m lineales)');
    assert.equal(title('VARILLA PINO (3 ML)'), 'Varilla pino (3 m lineales)');
  });

  it('en cualquier otro artículo ML son mililitros', () => {
    assert.equal(title('TINTA X 250 ML'), 'Tinta x250 ml');
  });
});

describe('normalizeProductTitle — letras de base (R11/R26)', () => {
  it('cualquier letra, en cualquier caso, se va del título junto con el "base"', () => {
    assert.equal(title('ESMALTE BASE F X 4 LTS'), 'Esmalte x4 lt');
    assert.equal(title('ESMALTE base f X 4 LTS'), 'Esmalte x4 lt');
    assert.equal(title('ESMALTE Base f X 4 LTS'), 'Esmalte x4 lt');
    assert.equal(title('ESMALTE BASE T X 4 LTS'), 'Esmalte x4 lt');
    assert.equal(title('MARBLE COLOR BASE N'), 'Marble color');
  });

  it('se va en cualquier posición del título', () => {
    assert.equal(title('BASE T MARBLE COLOR X 25 KGS'), 'Marble color x25 kg');
    assert.equal(title('MARBLE COLOR BASE T'), 'Marble color');
  });

  it('las clases de base de DOS letras también se van', () => {
    // Caso real: son 4 artículos MF, que antes de R11 v5 ni siquiera se
    // reconocían como letra de base.
    assert.equal(
      title('SATINOL BALANCE ESMALTE SATINADO BASE MF X 0,9 LTS'),
      'Satinol balance esmalte satinado x1 lt'
    );
    assert.equal(title('ESMALTE BASE X MF 4 LTS'), 'Esmalte x4 lt');
  });

  it('un artículo que es SÓLO la base conserva el dato: mejor eso que un título vacío', () => {
    assert.equal(title('BASE P X 4 LTS'), 'Base P x4 lt');
    assert.equal(title('BASE X P 4 LTS'), 'Base P x4 lt');
  });

  it('reporta R26 sólo cuando quitó algo', () => {
    assert.ok(run('ESMALTE BASE F X 4 LTS').applied.includes('R26'));
    assert.ok(!run('Esmalte x4 lt').applied.includes('R26'));
    assert.ok(!run('ESMALTE BASE AL AGUA X 4 LTS').applied.includes('R26'));
  });

  it('una palabra de dos letras detrás de "base" NO es una clase', () => {
    // La lista es la misma que usa el detector del tintométrico, medida contra el
    // catálogo real (que además de pinturería tiene almacén).
    assert.equal(
      title('BEBIDA A BASE DE ALMENDRAS X 1 LT'),
      'Bebida a base de almendras x1 lt'
    );
    assert.equal(title('ESMALTE BASE AL AGUA X 4 LTS'), 'Esmalte base al agua x4 lt');
    assert.equal(title('PINTURA BASE EN POLVO X 25 KGS'), 'Pintura base en polvo x25 kg');
  });

  it('tres letras ya son una palabra, no una clase', () => {
    assert.equal(title('ESMALTE BASE FIJA X 4 LTS'), 'Esmalte base fija x4 lt');
  });

  it('la X que va ANTES de la letra es el "por" del tamaño, no la letra', () => {
    // Forma real de Zeus en ~58 artículos con letra P: se van los tres tokens
    // ("BASE", la "X" y la letra) y la presentación reescribe su propia x.
    assert.equal(
      title('ALBACRYL LATEX INTERIOR ACRILICO MATE BASE X P 17,4 LTS'),
      'Albacryl látex interior acrílico mate x20 lt'
    );
    assert.equal(title('ESMALTE BASE X F 4 LTS'), 'Esmalte x4 lt');
    // Sin letra detrás la X sigue siendo el multiplicador, pero el `base` es el de
    // una base ÚNICA y se va igual (R26).
    assert.equal(
      title('ALBA EFECTOS ESPECIALES DESIGN MARMOL BASE X 3,24 LTS'),
      'Alba efectos especiales design marmol x4 lt'
    );
    assert.equal(title('PINTURA BASE X 2 LTS'), 'Pintura x2 lt');
  });

  it('el `base` suelto de una base única se va sólo si viene pegado a la presentación', () => {
    // Mismo criterio que el detector del tintométrico: sin tamaño no hay base.
    assert.equal(title('ALBA EFECTOS ESPECIALES DESIGN MARMOL BASE 3,24 LTS'), 'Alba efectos especiales design marmol x4 lt');
    assert.equal(title('MASILLA BASE'), 'Masilla base');
    assert.equal(title('MASILLA BASE N.º 3'), 'Masilla base N.º 3');
    // Con algo en el medio ya no es la base única: es parte del nombre.
    assert.equal(title('ESMALTE BASE AGUA X 4 LTS'), 'Esmalte base agua x4 lt');
    assert.equal(title('OXIDO REAL (SOLO BASE) 200 CC'), 'Óxido real solo base x200 cc');
    assert.equal(title('NATURAL STONE BURDEOS X 5 KGS (SIN BASE)'), 'Natural stone burdeos sin base x5 kg');
  });

  it('"sin base" y "solo base" no son una letra de base', () => {
    assert.equal(
      title('CLASSIC STONE PARIS X 25 KGS (SIN BASE Y A PEDIDO)'),
      'Classic stone Paris sin base y a pedido x25 kg'
    );
    assert.equal(title('OXIDO REAL (SOLO BASE) 200 CC'), 'Óxido real solo base x200 cc');
  });
});

describe('normalizeProductTitle — diccionario y caso (R02/R10)', () => {
  it('ningún título queda íntegramente en mayúsculas', () => {
    const out = title('MEMBRANA LIQUIDA BLANCA X 20 LTS')!;
    assert.notEqual(out, out.toUpperCase());
    assert.equal(out, 'Membrana líquida blanca x20 lt');
  });

  it('no capitaliza cada palabra', () => {
    assert.equal(title('LACAS Y BARNICES ESPECIALES'), 'Lacas y barnices especiales');
  });

  it('conserva las siglas del rubro', () => {
    assert.equal(title('ADHESIVO PVC X 100 CC'), 'Adhesivo PVC x100 cc');
    assert.equal(title('AEROGRAFO TIPO LAPIZ (PAK)'), 'Aerógrafo tipo lápiz PAK');
  });

  it('el diccionario matchea igual si el término ya viene acentuado', () => {
    assert.equal(title('esmalte metálico negro'), 'Esmalte metálico negro');
  });

  it('trae las tildes de la segunda tanda', () => {
    assert.equal(title('ZOCALO PVC'), 'Zócalo PVC');
    assert.equal(title('CINTA METRICA'), 'Cinta métrica');
    assert.equal(title('CUTTER PLASTICO'), 'Cúter plástico');
    assert.equal(title('ESPATULAS PLASTICAS'), 'Espátulas plásticas');
    assert.equal(title('ESMALTE MARRON'), 'Esmalte marrón');
    assert.equal(title('MEMBRANA VINILICA'), 'Membrana vinílica');
  });

  it('acepta términos nuevos desde la configuración', () => {
    const custom = resolveTitleRules({ dictionary: { electricas: 'eléctricas' } });
    assert.equal(
      normalizeProductTitle('HERRAMIENTAS ELECTRICAS', { rules: custom }).title,
      'Herramientas eléctricas'
    );
  });

  it('un valor vacío en la configuración borra la entrada default', () => {
    const custom = resolveTitleRules({ dictionary: { latex: '' } });
    assert.equal(normalizeProductTitle('LATEX INTERIOR', { rules: custom }).title, 'Latex interior');
  });
});

describe('normalizeProductTitle — separadores y espacios (R08/R16)', () => {
  it('ningún título visible contiene - ni |', () => {
    const out = title('MULTIMETALES - ESMALTE | X 0,45 LTS.')!;
    assert.equal(out, 'Multimetales esmalte x0,45 lt');
    assert.doesNotMatch(out, /[-|]/);
  });

  it('colapsa espacios dobles y quita el punto final', () => {
    assert.equal(title('BARNIZ   MARINO  .'), 'Barniz marino');
  });

  it('conserva el punto de una abreviatura del diccionario al final del nombre', () => {
    assert.equal(title('ESMALTE DR. OX.'), 'Esmalte Dr. Ox.');
  });

  it('devuelve null cuando el ERP no manda descripción', () => {
    assert.equal(title(null), null);
    assert.equal(title('   '), null);
  });
});

describe('normalizeProductTitle — leyendas promocionales (R09)', () => {
  it('quita solo las leyendas de la lista aprobada', () => {
    assert.equal(title('IGNIFUGO TEXTIL X 5 LTS (SUPER OFERTA)'), 'Ignífugo textil x5 lt');
    assert.equal(title('IGNIFUGO TEXTIL X 5 LTS (OFERTA)'), 'Ignífugo textil x5 lt');
  });

  it('acepta leyendas nuevas desde la configuración', () => {
    const custom = resolveTitleRules({ promo_legends: ['ultimas unidades'] });
    assert.equal(
      normalizeProductTitle('BARNIZ X 1 LT (ULTIMAS UNIDADES)', { rules: custom }).title,
      'Barniz x1 lt'
    );
  });
});

describe('normalizePresentationLabel', () => {
  it('lleva la etiqueta de la variante al mismo canon que el título', () => {
    assert.equal(normalizePresentationLabel('3,6 LTS'), '3,6 lt');
    assert.equal(normalizePresentationLabel('20 L'), '20 lt');
    assert.equal(normalizePresentationLabel('25 KGS'), '25 kg');
    assert.equal(normalizePresentationLabel('1,00 KG'), '1 kg');
    assert.equal(normalizePresentationLabel('500 GRS'), '500 gr');
    assert.equal(normalizePresentationLabel('18MM'), '18 mm');
  });

  it('es idempotente sobre su propia salida', () => {
    for (const label of ['3,6 LTS', '20 L', '125 CC', '18MM']) {
      const once = normalizePresentationLabel(label)!;
      assert.equal(normalizePresentationLabel(once), once, label);
    }
  });

  it('no toca lo que no es una medida', () => {
    assert.equal(normalizePresentationLabel('Único'), null);
    assert.equal(normalizePresentationLabel('Pack x6'), null);
    assert.equal(normalizePresentationLabel('Obra'), null);
    assert.equal(normalizePresentationLabel(''), null);
    assert.equal(normalizePresentationLabel(null), null);
  });

  it('con tintBase redondea el envase y sin él no (R25)', () => {
    assert.equal(normalizePresentationLabel('3,6 LTS', { tintBase: true }), '4 lt');
    assert.equal(normalizePresentationLabel('0,9 LTS', { tintBase: true }), '1 lt');
    assert.equal(normalizePresentationLabel('3,6 LTS'), '3,6 lt');
    // La masa y los envases chicos no se redondean ni siendo base: sin densidad no
    // se despeja el hueco del entonado, y 200 cc no llegan a un litro.
    assert.equal(normalizePresentationLabel('5 KGS', { tintBase: true }), '5 kg');
    assert.equal(normalizePresentationLabel('200 CC', { tintBase: true }), '200 cc');
  });
});

describe('supersededPresentationLabels', () => {
  it('reconoce el 18 lt que escribió la versión anterior de R25', () => {
    // 17,4 se redondeaba con `Math.ceil` a 18 antes de que DESDEELSUR-23 lo
    // declarara el balde de 20. Las etiquetas ya guardadas quedaron en 18.
    assert.deepEqual(supersededPresentationLabels('20 lt'), ['18 lt']);
  });

  it('no repite la etiqueta cuando dos contenidos declaran el mismo envase', () => {
    // `17,4` y `18` son los dos el balde de 20 y los dos escribieron `18 lt`.
    assert.deepEqual(supersededPresentationLabels('20 lt'), ['18 lt']);
    // El balde de 10 lo declaran DOS contenidos —el 9 de AIKE (v8) y el 8,7 de
    // Alba (v10)— y los dos escribieron `9 lt`, así que sin deduplicar saldría
    // `['9 lt', '9 lt']`.
    assert.deepEqual(supersededPresentationLabels('10 lt'), ['9 lt']);
  });

  it('no inventa formas superadas donde el redondeo por defecto ya acierta', () => {
    // `3,6 → 4` sale del `Math.ceil`, no de una excepción: nunca hubo otra
    // etiqueta que corregir.
    assert.deepEqual(supersededPresentationLabels('4 lt'), []);
    assert.deepEqual(supersededPresentationLabels('1 lt'), []);
    // El 9 ya no es envase de ninguna base, así que tampoco hay nada que declare
    // una forma superada PARA él: la función mira `can`, no `content`.
    assert.deepEqual(supersededPresentationLabels('9 lt'), []);
  });

  it('sólo aplica a los litros de un envase, y a nada más', () => {
    assert.deepEqual(supersededPresentationLabels('20 kg'), []);
    assert.deepEqual(supersededPresentationLabels('Pack x6'), []);
    assert.deepEqual(supersededPresentationLabels(''), []);
    assert.deepEqual(supersededPresentationLabels(null), []);
  });
});

/**
 * El envase de una base no es el contenido que carga el ERP: lo que falta para el
 * litro lo llena el entonado, así que la góndola vende 1, 4, 10 y 20 litros donde
 * Zeus dice 0,9, 3,6, 8,7 y 17,4.
 *
 * Los dos escalones de arriba son excepciones DECLARADAS por el cliente: 17,4 es
 * el balde de 20 y no el 18 del `ceil` (DESDEELSUR-23), y 8,7 es el de 10 y no el
 * 9 (DESDEELSUR-27). Los dos de abajo los acierta el `ceil` solo.
 *
 * AIKE tiene la misma escalera de envases con otro contenido: carga
 * 0,9 / 3,6 / 9 / 18 y vende 1 / 4 / 10 / 20, así que `9 → 10` y `18 → 20` entran
 * en la misma tabla (v8). Que los dos fabricantes vendan los mismos cuatro baldes
 * es lo que confirmó que el 9 de Alba estaba mal.
 *
 * Las excepciones sólo alcanzan a BASES: los envases de 9 y de 18 de verdad
 * —adhesivo de contacto, asfáltica, aceite de lino— siguen diciendo lo que dicen.
 */
describe('normalizeProductTitle — envase de las bases entonables (R25)', () => {
  it('redondea para arriba los litros de una base', () => {
    assert.equal(
      title('ALBACRYL LATEX INTERIOR ACRILICO MATE BASE F X 3,6 LTS'),
      'Albacryl látex interior acrílico mate x4 lt'
    );
    // La forma con la X antes de la letra ("BASE X P"), que R11 también resuelve.
    assert.equal(
      title('ALBACRYL LATEX INTERIOR ACRILICO MATE BASE X P 17,4 LTS'),
      'Albacryl látex interior acrílico mate x20 lt'
    );
    assert.equal(
      title('ALBALATEX DESIGN SATINADO INTERIOR BASE P X 0,9 LTS'),
      'Albalatex design satinado interior x1 lt'
    );
    // Base única, sin letra.
    assert.equal(
      title('ALBA EFECTOS ESPECIALES DESIGN MARMOL BASE X 3,24 LTS'),
      'Alba efectos especiales design marmol x4 lt'
    );
  });

  it('las bases de AIKE: 9 es el balde de 10 y 18 el de 20 (v8)', () => {
    // AIKE carga contenido de base igual que Alba y su escalera es
    // 0,9 / 3,6 / 9 / 18 contra los baldes de 1 / 4 / 10 / 20 que vende el
    // mercado: el `ceil` acierta los dos primeros y falla los dos últimos.
    assert.equal(title('AIKE - LATEX I+E COLOR F (B) X 9 LTS'), 'Aike látex i+e color f b x10 lt');
    assert.equal(title('AIKE - LATEX I+E COLOR F (B) X 18 LTS'), 'Aike látex i+e color f b x20 lt');
    assert.equal(title('AIKE - ESMALTE 2 EN 1 COLOR P (A) 18 LTS.'), 'Aike esmalte 2 en 1 color p a x20 lt');
    // Los dos primeros escalones ya los acertaba el `ceil` y no cambian.
    assert.equal(title('AIKE - LATEX I+E COLOR F (B) X 3,6 LTS'), 'Aike látex i+e color f b x4 lt');
    assert.equal(title('AIKE - LATEX I+E COLOR F (B) X 0,9 LTS'), 'Aike látex i+e color f b x1 lt');
  });

  it('un balde de 18 litros que NO es base sigue diciendo 18 (v8)', () => {
    // R25 sólo alcanza a bases entonables, así que la tabla `18 → 20` no puede
    // tocar un envase de 18 de verdad. Los cuatro son reales y están verificados
    // contra el mercado: FORTEX C-81/C-101, Megaflex/Clipperflex y Vitecso.
    assert.equal(title('FORTEX - ADHESIVO DE CONTACTO X 18 LTS.'), 'Fortex adhesivo de contacto x18 lt');
    assert.equal(title('MEGAFLEX - PINTURA ASFALTICA NEGRA X 18 LTS'), 'Megaflex pintura asfaltica negra x18 lt');
    assert.equal(
      title('VITECSO - ACEITE LINO DOBLE COCIDO EXTRA X 18 LTS.'),
      'Vitecso aceite lino doble cocido extra x18 lt'
    );
  });

  it('reporta R25 sólo cuando el envase cambió', () => {
    assert.ok(run('ALBACRYL LATEX INTERIOR MATE BASE F X 3,6 LTS').applied.includes('R25'));
    assert.ok(!run('ALBACRYL LATEX INTERIOR MATE BASE F X 4 LTS').applied.includes('R25'));
  });

  it('los 17,4 son el balde de 20, no el entero de arriba (DESDEELSUR-23)', () => {
    // Excepción declarada: es una definición comercial del cliente, no algo que
    // se derive del número. Se prueba en las dos formas con las que llega de Zeus.
    assert.equal(
      title('ALBALATEX MATE INTERIOR BASE F X 17,4 LTS'),
      'Albalatex mate interior x20 lt'
    );
    assert.equal(
      title('ALBACRYL LATEX INTERIOR ACRILICO MATE BASE X P 17,4 LTS'),
      'Albacryl látex interior acrílico mate x20 lt'
    );
    assert.equal(normalizePresentationLabel('17,4 LTS', { tintBase: true }), '20 lt');
    // Con un decimal de más sigue siendo la misma capacidad: la excepción se
    // busca con tolerancia y no por igualdad de float.
    assert.equal(normalizePresentationLabel('17,40 LTS', { tintBase: true }), '20 lt');
    // Y 17,4 que NO es una base sigue siendo 17,4: la excepción es de envases.
    assert.equal(title('LATEX INTERIOR X 17,4 LTS'), 'Látex interior x17,4 lt');
  });

  it('los 8,7 son el balde de 10, no el entero de arriba (DESDEELSUR-27)', () => {
    // Excepción declarada, igual que los 17,4: el entero de arriba sería 9 y el
    // cliente vende esa base como el balde de 10 —el mismo que el producto BLANCO
    // no entonable de estas líneas, que ya se vendía en 1, 4, 10 y 20.
    assert.equal(
      title('ALBALATEX MATE INTERIOR BASE F X 8,7 LTS'),
      'Albalatex mate interior x10 lt'
    );
    assert.equal(
      title('ALBALATEX ULTRALAVABLE INTERIOR BASE P X 8,7 LTS'),
      'Albalatex ultralavable interior x10 lt'
    );
    assert.equal(normalizePresentationLabel('8,7 LTS', { tintBase: true }), '10 lt');
    // Con un decimal de más sigue siendo la misma capacidad: la excepción se
    // busca con tolerancia y no por igualdad de float.
    assert.equal(normalizePresentationLabel('8,70 LTS', { tintBase: true }), '10 lt');
    // Y 8,7 que NO es una base sigue siendo 8,7: la excepción es de envases.
    assert.equal(title('LATEX INTERIOR X 8,7 LTS'), 'Látex interior x8,7 lt');
  });

  it('un envase de 9 litros que NO es base sigue diciendo 9 (DESDEELSUR-27)', () => {
    // El ticket lo pide explícito: la equivalencia `9 → 10` es de bases. Un
    // producto terminado de 9 litros no la ve, porque el guard de R25 es
    // `isTintableBaseTitle` y no la capacidad.
    assert.equal(title('LATEX INTERIOR X 9 LTS'), 'Látex interior x9 lt');
    assert.equal(normalizePresentationLabel('9 LTS'), '9 lt');
  });

  it('no redondea lo que no es una base entonable', () => {
    // El cuarto litro de barniz es un cuarto litro de verdad.
    assert.equal(title('VENIER - BARNIZ MARINO X 0,25 LTS', 'VENIER'), 'Barniz marino x0,25 lt');
    assert.equal(title('LATEX INTERIOR X 8,7 LTS'), 'Látex interior x8,7 lt');
    // "a base de" no es una base (casos reales del catálogo de almacén).
    assert.equal(
      title('BEBIDA A BASE DE ALMENDRAS X 0,9 LTS'),
      'Bebida a base de almendras x0,9 lt'
    );
  });

  it('la masa de una base no se toca: sin densidad no hay hueco que despejar', () => {
    assert.equal(title('REVEAR CLASSIC STONE BASE F FINO X 5 KGS'), 'Revear classic stone fino x5 kg');
    assert.equal(title('MARBLE COLOR BASE T - MEDIANO | X25 KGS'), 'Marble color mediano x25 kg');
  });
});

describe('normalizeProductTitle — trazabilidad (R15)', () => {
  it('reporta las reglas que efectivamente cambiaron el título', () => {
    const result = run('VENIER - BARNIZ MARINO X 0,25 LTS', 'VENIER');
    assert.deepEqual(result.applied, ['R01', 'R02', 'R03', 'R16', 'R17']);
  });

  it('reporta R09 cuando quitó una leyenda', () => {
    assert.ok(run('BARNIZ X 1 LT (SUPER OFERTA)').applied.includes('R09'));
  });

  it('reporta las reglas nuevas por familia', () => {
    assert.ok(run('CINTA 5M X 19MM').applied.includes('R18'));
    assert.ok(run('CUTTER PLASTICO 18MM (C118)').applied.includes('R19'));
    assert.ok(run('DESENGRASANTE/LIMPIADOR').applied.includes('R20'));
    assert.ok(run('RODILLO N16').applied.includes('R21'));
    assert.ok(run('PEGAMENTO 3EN1').applied.includes('R22'));
    assert.ok(run('MOLDURA M33 (2ML)').applied.includes('R23'));
    assert.ok(run('RODILLO 9 PULGADAS').applied.includes('R24'));
  });
});

describe('titleRulesFingerprint', () => {
  it('es estable para las mismas reglas', () => {
    assert.equal(titleRulesFingerprint(resolveTitleRules()), titleRulesFingerprint(resolveTitleRules()));
  });

  it('arranca con la versión de las reglas de código', () => {
    assert.match(titleRulesFingerprint(resolveTitleRules()), new RegExp(`^${TITLE_RULES_VERSION}:[0-9a-f]{8}$`));
  });

  it('la versión sube cuando cambia la salida de títulos ya normalizados', () => {
    // v3 = segunda tanda de reglas + unidades en minúscula. Sin este bump el
    // barrido siguiente no reescribiría nada (la huella no cambiaría).
    assert.ok(TITLE_RULES_VERSION >= 3);
  });

  it('cambia al agregar un término al diccionario', () => {
    assert.notEqual(
      titleRulesFingerprint(resolveTitleRules()),
      titleRulesFingerprint(resolveTitleRules({ dictionary: { electricas: 'eléctricas' } }))
    );
  });

  it('cambia al agregar una leyenda o al apagar el strip de marca', () => {
    const base = titleRulesFingerprint(resolveTitleRules());
    assert.notEqual(base, titleRulesFingerprint(resolveTitleRules({ promo_legends: ['2 x 1'] })));
    assert.notEqual(base, titleRulesFingerprint(resolveTitleRules({ strip_brand: false })));
  });

  it('no depende del orden en que se cargaron los overrides', () => {
    const a = resolveTitleRules({ dictionary: { uno: 'Uno', dos: 'Dos' }, promo_legends: ['a', 'b'] });
    const b = resolveTitleRules({ dictionary: { dos: 'Dos', uno: 'Uno' }, promo_legends: ['b', 'a'] });
    assert.equal(titleRulesFingerprint(a), titleRulesFingerprint(b));
  });
});

describe('presentationFromNormalizedTitle', () => {
  it('lee el envase que declara un título ya normalizado', () => {
    assert.equal(presentationFromNormalizedTitle('Albalatex mate interior x20 lt'), '20 lt');
    assert.equal(presentationFromNormalizedTitle('Barniz marino x0,25 lt'), '0,25 lt');
    assert.equal(presentationFromNormalizedTitle('Marble color mediano x25 kg'), '25 kg');
  });

  it('no confunde una dimensión con un envase', () => {
    // `3x3 m` es la medida del cobertor, no lo que trae adentro. Sin el espacio
    // antes de la `x` no hay presentación.
    assert.equal(presentationFromNormalizedTitle('Cobertor multiuso 3x3 m'), null);
    assert.equal(presentationFromNormalizedTitle('AA lija de banda 100X610 N.º 100'), null);
  });

  it('devuelve null cuando después de la medida sigue habiendo texto', () => {
    assert.equal(
      presentationFromNormalizedTitle('Cinta embalar 48 mm x 50 m H180 tpte. cod 42385'),
      null
    );
  });

  it('devuelve null sobre un título crudo del ERP: la `x` va en mayúscula', () => {
    assert.equal(presentationFromNormalizedTitle('ALBALATEX MATE INTERIOR X 20 LTS'), null);
  });

  it('tolera lo vacío', () => {
    assert.equal(presentationFromNormalizedTitle(null), null);
    assert.equal(presentationFromNormalizedTitle('Pincel de cerda'), null);
  });
});

describe('applyReadingCase', () => {
  it('aplica el mismo caso y diccionario que R02/R10 del título', () => {
    assert.equal(applyReadingCase('LATEX ACRILICO', rules), 'látex acrílico');
    assert.equal(applyReadingCase('CUTTER PLASTICO', rules), 'cúter plástico');
  });

  it('conserva los códigos técnicos que mezclan letras y dígitos', () => {
    assert.equal(applyReadingCase('ACRILICO G2 X50', rules), 'acrílico G2 X50');
  });

  it('separa la puntuación pegada para que el diccionario matchee', () => {
    // Es la diferencia con llamar a `applyDictionary` sobre el texto entero: en
    // prosa el token viene con la coma o el punto pegados.
    assert.equal(applyReadingCase('LATEX, METALICO.', rules), 'látex, metálico.');
  });

  it('sigue matcheando las entradas de varias palabras', () => {
    assert.equal(applyReadingCase('2X ULTRA COVER NEGRO', rules), '2X Ultra Cover negro');
  });
});

describe('R27 — el código interno del artículo (DESDEELSUR-34)', () => {
  const run = (raw: string, factoryCode: string | null, brand = 'RUST OLEUM') =>
    normalizeProductTitle(raw, { brand, factoryCode, rules }).title;

  it('descarta el paréntesis que repite el código de fábrica', () => {
    assert.equal(
      run('RUST OLEUM - 2X ULTRA COVER AZUL OASIS SATINADO (337475)', '337475'),
      '2X Ultra Cover azul oasis satinado'
    );
    assert.equal(
      run('VARATHANE - ACEITE DE TECA CON UV X 1 LTS (358208)', '358208', 'VARATHANE'),
      'Aceite de teca con UV x1 lt'
    );
  });

  it('lo reconoce dentro de un código de fábrica compuesto', () => {
    assert.equal(
      run('3M - CINTA DUCT TAPE 48 MM. 18,2 MTS BLANCA (63885)', '63885 3M', '3M'),
      'Cinta duct tape 48 mm 18,2 m blanca'
    );
  });

  it('NO toca un código de modelo: lleva letra', () => {
    // La regla documentada de R19: `(C118)` sale `Cúter plástico C118 18 mm`.
    assert.equal(
      normalizeProductTitle('MOTA - CUTTER PLASTICO 18MM (C118)', {
        brand: 'MOTA',
        factoryCode: 'MOTA-C118',
        rules,
      }).title,
      'Cúter plástico C118 18 mm'
    );
  });

  it('NO toca un código de cuatro dígitos: son los modelos de Skil', () => {
    assert.equal(
      normalizeProductTitle('SKIL - LIJADORA DE BANDA (7640)', {
        brand: 'SKIL',
        factoryCode: '7640',
        rules,
      }).title,
      'Lijadora de banda 7640'
    );
  });

  it('NO toca un número que el código de fábrica no respalda', () => {
    // El ERP tiene los dígitos transpuestos (`252156` contra `262156`): adivinar
    // cuál vale no es trabajo de una regla de formato.
    assert.equal(
      run('RUST OLEUM - 2X ULTRA COVER AZUL BRILLANTE (252156)', '262156'),
      '2X Ultra Cover azul brillante 252156'
    );
  });

  it('quita el código que la gestión rotula ella misma', () => {
    assert.equal(
      normalizeProductTitle('WEMBLEY - CANDADO TITANIUM 25 MM.(3 LLAVES)COD.6070', {
        brand: 'WEMBLEY',
        factoryCode: '31864',
        rules,
      }).title,
      'Candado titanium 25 mm (3 llaves)'
    );
  });

  it('separa el paréntesis pegado, que era lo que dejaba la palabra en mayúsculas', () => {
    // Sin separarlo, `lowercaseWords` ve `MM.(3` y `LLAVES)COD.6070` como tokens
    // que mezclan letras y dígitos, o sea códigos, y no los baja.
    const title = normalizeProductTitle('WEMBLEY - CANDADO TITANIUM 63 MM.(3 LLAVES)COD.6074', {
      brand: 'WEMBLEY',
      factoryCode: '40649',
      rules,
    }).title!;
    assert.ok(!/LLAVES/.test(title), title);
  });

  it('corta el paréntesis que la gestión mandó sin cerrar', () => {
    assert.equal(
      normalizeProductTitle('SUPRABOND - SELLADOR MADERAS NOGAL X 280 GRS.(GMX', {
        brand: 'SUPRABOND',
        factoryCode: '2671',
        rules,
      }).title,
      'Sellador maderas nogal x280 gr'
    );
  });

  it('sin código de fábrica se comporta como antes', () => {
    assert.equal(
      run('RUST OLEUM - 2X ULTRA COVER ALMENDRA BRILLANTE (262195)', null),
      '2X Ultra Cover almendra brillante 262195'
    );
  });
});

describe('R28 — dimensión sin unidad declarada', () => {
  const run = (raw: string, brand?: string) =>
    normalizeProductTitle(raw, { brand, rules }).title;

  it('pasa la `x` a minúscula entre dos números', () => {
    assert.equal(run('AA - LIJA DE BANDA 100X610 Nº100'), 'AA lija de banda 100x610 N.º 100');
    assert.equal(run('FISCHER - TARUGO DUOPOWER 8X40', 'FISCHER'), 'Tarugo duopower 8x40');
    assert.equal(run('CEPILLO DE ACERO CON MANGO 4X19'), 'Cepillo de acero con mango 4x19');
  });

  it('no toca una `X` que no separa dos números', () => {
    assert.equal(
      normalizeProductTitle('RUST OLEUM - 2X ULTRA COVER NEGRO MATE', {
        brand: 'RUST OLEUM',
        rules,
      }).title,
      '2X Ultra Cover negro mate'
    );
  });

  it('R18 sigue mandando cuando la unidad está', () => {
    assert.equal(run('3M - CINTA EMBALAR 48mmX50Mts. H180', '3M'), 'Cinta embalar 48 mm x 50 m H180');
  });
});

describe('R21 con palabras acentuadas', () => {
  it('la `n` final de una palabra con tilde no es una numeración', () => {
    // `\b` de JavaScript usa `[A-Za-z0-9_]` aun con el flag `u`, así que `\bn`
    // matcheaba la `n` de "marró|n" y el título salía `marrón.º 50 mm`.
    assert.equal(
      normalizeProductTitle('MATEZZ - FIELTRO MARRON 50 MM X 5 MT', { brand: 'MATEZZ', rules })
        .title,
      'Fieltro marrón 50 mm x 5 m'
    );
    assert.equal(
      normalizeProductTitle('Fieltro marrón 50 mm x 5 m', { brand: 'MATEZZ', rules }).title,
      'Fieltro marrón 50 mm x 5 m'
    );
  });
});

describe('R04 — `ctms`, la forma en que la gestión escribe centímetros', () => {
  it('la reconoce como unidad y la lleva a `cm`', () => {
    assert.equal(
      normalizeProductTitle('LUMAR - RODILLO LANA CUBRETODO X 22 CTMS', { brand: 'LUMAR', rules })
        .title,
      'Rodillo lana cubretodo x22 cm'
    );
    assert.equal(
      normalizeProductTitle('BAMBIN - MINI RODILLO ROLLER (EPOXI) T40 X 11 CMTS', {
        brand: 'BAMBIN',
        rules,
      }).title,
      'Mini rodillo roller epoxi T40 x11 cm'
    );
  });

  it('el modelo pegado a un número NO es el primer término de una medida compuesta', () => {
    // `T40 X 11 CMTS` es un rodillo T40 de 11 cm. Sin el lookbehind de R18 sale
    // `T40x11 cm`, que se lee como una dimensión de 40 × 11.
    assert.equal(
      normalizeProductTitle('BAMBIN - MINI RODILLO ROLLER (EPOXI) T40 X 11 CMTS', {
        brand: 'BAMBIN',
        rules,
      }).title,
      'Mini rodillo roller epoxi T40 x11 cm'
    );
  });

  it('sigue siendo idempotente', () => {
    const once = normalizeProductTitle('LUMAR - RODILLO LANA NARANJA SATINADO X 22 CTMS', {
      brand: 'LUMAR',
      rules,
    }).title!;
    assert.equal(normalizeProductTitle(once, { brand: 'LUMAR', rules }).title, once);
  });
});
