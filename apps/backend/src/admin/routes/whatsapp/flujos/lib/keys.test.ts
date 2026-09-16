import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isDeleteKey, isEditableTarget, shortcutFor, SHORTCUT_HELP } from './keys';

describe('cuándo una tecla NO tiene que borrar el paso', () => {
  /**
   * El bug que esto previene: con un nodo seleccionado y el cursor en el texto del
   * mensaje, borrar una letra con Backspace borraba EL PASO ENTERO. React Flow trae
   * su propio `deleteKeyCode` y no sabe nada del inspector que está al lado.
   */
  it('un input es un lugar donde se está escribiendo', () => {
    assert.equal(isEditableTarget({ tagName: 'INPUT' }), true);
  });

  it('un textarea también', () => {
    assert.equal(isEditableTarget({ tagName: 'TEXTAREA' }), true);
  });

  it('un select también: las flechas y el borrado son suyos', () => {
    assert.equal(isEditableTarget({ tagName: 'SELECT' }), true);
  });

  it('un contenteditable también', () => {
    assert.equal(isEditableTarget({ tagName: 'DIV', isContentEditable: true }), true);
  });

  it('el canvas no lo es', () => {
    assert.equal(isEditableTarget({ tagName: 'DIV' }), false);
  });

  it('sin foco tampoco', () => {
    assert.equal(isEditableTarget(null), false);
    assert.equal(isEditableTarget(undefined), false);
  });

  it('el nombre de la etiqueta se compara sin importar mayúsculas', () => {
    assert.equal(isEditableTarget({ tagName: 'input' }), true);
  });
});

describe('qué teclas borran', () => {
  it('Delete y Backspace', () => {
    assert.equal(isDeleteKey('Delete'), true);
    assert.equal(isDeleteKey('Backspace'), true);
  });

  it('Escape NO borra: sólo limpia la selección', () => {
    // Confundirlos es perder un paso por querer cerrar el inspector.
    assert.equal(isDeleteKey('Escape'), false);
  });

  it('una letra cualquiera no borra', () => {
    assert.equal(isDeleteKey('a'), false);
    assert.equal(isDeleteKey('Enter'), false);
  });
});

describe('los atajos', () => {
  const canvas = { editing: false };
  const escribiendo = { editing: true };

  it('Ctrl+S guarda, incluso mientras se escribe', () => {
    // Es lo que la mano hace sola cuando el guardado es manual: bloquearlo adentro de
    // un campo es perder el reflejo justo cuando más se usa.
    assert.equal(shortcutFor({ key: 's', ctrlKey: true }, canvas), 'save');
    assert.equal(shortcutFor({ key: 's', metaKey: true }, escribiendo), 'save');
  });

  it('Ctrl+Z deshace en el canvas pero NO adentro de un campo', () => {
    // Adentro de un campo, deshacer es el del navegador sobre el texto: robárselo
    // sería quitarle al operador el undo que espera.
    assert.equal(shortcutFor({ key: 'z', ctrlKey: true }, canvas), 'undo');
    assert.equal(shortcutFor({ key: 'z', ctrlKey: true }, escribiendo), null);
  });

  it('Ctrl+Shift+Z y Ctrl+Y rehacen', () => {
    assert.equal(shortcutFor({ key: 'z', ctrlKey: true, shiftKey: true }, canvas), 'redo');
    assert.equal(shortcutFor({ key: 'y', ctrlKey: true }, canvas), 'redo');
  });

  it('copiar, pegar, duplicar y elegir todo', () => {
    assert.equal(shortcutFor({ key: 'c', metaKey: true }, canvas), 'copy');
    assert.equal(shortcutFor({ key: 'v', metaKey: true }, canvas), 'paste');
    assert.equal(shortcutFor({ key: 'd', ctrlKey: true }, canvas), 'duplicate');
    assert.equal(shortcutFor({ key: 'a', ctrlKey: true }, canvas), 'select-all');
  });

  it('ninguno de esos se roba la tecla mientras se escribe', () => {
    for (const key of ['c', 'v', 'd', 'a', 'z', 'y']) {
      assert.equal(shortcutFor({ key, ctrlKey: true }, escribiendo), null, key);
    }
  });

  it('Supr borra en el canvas y no mientras se escribe', () => {
    assert.equal(shortcutFor({ key: 'Delete' }, canvas), 'delete');
    assert.equal(shortcutFor({ key: 'Backspace' }, canvas), 'delete');
    assert.equal(shortcutFor({ key: 'Backspace' }, escribiendo), null);
  });

  it('Escape sale, se esté escribiendo o no', () => {
    assert.equal(shortcutFor({ key: 'Escape' }, canvas), 'escape');
    assert.equal(shortcutFor({ key: 'Escape' }, escribiendo), 'escape');
  });

  it('las teclas sueltas del canvas no molestan al escribir', () => {
    assert.equal(shortcutFor({ key: 'f' }, canvas), 'fit');
    assert.equal(shortcutFor({ key: 'f' }, escribiendo), null);
    assert.equal(shortcutFor({ key: '+' }, canvas), 'zoom-in');
    assert.equal(shortcutFor({ key: '-' }, canvas), 'zoom-out');
    assert.equal(shortcutFor({ key: '?' }, canvas), 'help');
  });

  it('las mayúsculas no cambian nada', () => {
    assert.equal(shortcutFor({ key: 'S', ctrlKey: true }, canvas), 'save');
    assert.equal(shortcutFor({ key: 'Z', ctrlKey: true }, canvas), 'undo');
  });

  it('una tecla cualquiera no dispara nada', () => {
    assert.equal(shortcutFor({ key: 'q' }, canvas), null);
    assert.equal(shortcutFor({ key: 'Enter' }, canvas), null);
  });

  it('la ayuda lista los atajos que existen', () => {
    assert.ok(SHORTCUT_HELP.length > 0);
    for (const item of SHORTCUT_HELP) {
      assert.ok(item.keys.length > 0 && item.what.length > 0);
    }
  });
});
