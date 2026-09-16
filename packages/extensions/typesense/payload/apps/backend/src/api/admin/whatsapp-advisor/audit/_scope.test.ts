import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TECHNICAL_DIMENSIONS,
  TECHNICAL_PRODUCT_TYPES,
  familyIsMapped,
  inTechnicalScope,
} from './_scope';
import {
  PAINT_ADVISOR_RULES,
  PAINT_FAMILY_RULES,
} from '../../../../lib/whatsapp/advisor/vocabulary';
import { classifyProduct } from '../../../../modules/typesense/advisor';

describe('familyIsMapped', () => {
  /**
   * El bug que motivó el cambio: el audit comparaba con `toLowerCase()` y el
   * motor con `foldText()`. Las familias reales del ERP vienen con tildes y las
   * reglas están escritas sin ellas, así que el reporte listaba como huérfanas
   * familias que el motor SÍ clasifica.
   */
  it('matchea una familia con tildes contra una regla escrita sin tildes', () => {
    for (const family of [
      'Protección personal',
      'Artística pinceles',
      'Herramientas eléctricas y explosión',
      'Llanas, espátulas, fratachos',
      'Pisos SPC y zócalos',
      'Masillas construcción en seco',
    ]) {
      assert.equal(familyIsMapped(family, PAINT_FAMILY_RULES), true, family);
    }
  });

  it('coincide con lo que el motor realmente clasifica', () => {
    // Si el audit dice "sin regla", el motor no tiene que sacar nada de la familia.
    const family = 'Protección personal';
    const attributes = classifyProduct({ title: 'Barbijo', metadata: { family } }, PAINT_ADVISOR_RULES);
    assert.deepEqual(attributes?.advisor_product_type, ['accessory']);
    assert.equal(familyIsMapped(family, PAINT_FAMILY_RULES), true);
  });

  it('sigue reportando las familias que de verdad no tienen regla', () => {
    for (const family of ['Pintura hogar y obra', 'Familias accesorios varias', 'Bandas']) {
      assert.equal(familyIsMapped(family, PAINT_FAMILY_RULES), false, family);
    }
  });
});

describe('alcance de las dimensiones técnicas', () => {
  it('sale del flujo: pintura y preparación no cortan el recorrido', () => {
    assert.deepEqual([...TECHNICAL_PRODUCT_TYPES].sort(), ['paint', 'prep']);
  });

  it('las preguntas posteriores a product_type son las acotadas', () => {
    assert.deepEqual([...TECHNICAL_DIMENSIONS].sort(), ['base', 'environment', 'special_use']);
  });

  it('una lija no entra: nunca le llega la pregunta de ambiente ni de base', () => {
    const lija = classifyProduct(
      { title: 'AA al agua hoja de lija papel N.º 100', metadata: { family: 'Lijas' } },
      PAINT_ADVISOR_RULES,
    );
    assert.deepEqual(lija?.advisor_product_type, ['accessory']);
    assert.equal(inTechnicalScope(lija!.advisor_product_type), false);
  });

  it('un látex sí entra', () => {
    const latex = classifyProduct(
      { title: 'Látex interior x20 lt', metadata: { erp_category_code: '0209' } },
      PAINT_ADVISOR_RULES,
    );
    assert.deepEqual(latex?.advisor_product_type, ['paint']);
    assert.equal(inTechnicalScope(latex!.advisor_product_type), true);
  });
});
