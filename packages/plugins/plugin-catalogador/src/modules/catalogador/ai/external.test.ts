import assert from 'node:assert/strict';
import test from 'node:test';
import { extractImageUrls } from './external.ts';

test('extractImageUrls saca URLs bajo claves de imagen aunque no tengan extensión', () => {
  const json = {
    product: {
      title: 'Raid Max 360cc',
      images: ['https://cdn.example.com/ids/800871?v=1', 'https://cdn.example.com/ids/800872?v=1'],
      image_url: 'https://cdn.example.com/front',
    },
  };
  assert.deepEqual(extractImageUrls(json), [
    'https://cdn.example.com/ids/800871?v=1',
    'https://cdn.example.com/ids/800872?v=1',
    'https://cdn.example.com/front',
  ]);
});

test('extractImageUrls acepta URLs con extensión de imagen bajo cualquier clave', () => {
  const json = {
    front_photo: 'https://cdn.example.com/a.jpg',
    misc: { link: 'https://example.com/p/7790520025746.png?size=big' },
    page: 'https://example.com/producto/raid-max', // sin extensión ni clave de imagen → NO
  };
  assert.deepEqual(extractImageUrls(json), [
    'https://cdn.example.com/a.jpg',
    'https://example.com/p/7790520025746.png?size=big',
  ]);
});

test('extractImageUrls ignora no-URLs, deduplica y respeta el límite', () => {
  const json = {
    thumbnail: 'data:image/png;base64,xxxx',
    images: [
      'https://cdn.example.com/1.jpg',
      'https://cdn.example.com/1.jpg',
      'ftp://cdn.example.com/2.jpg',
      'https://cdn.example.com/2.jpg',
      'https://cdn.example.com/3.jpg',
    ],
  };
  assert.deepEqual(extractImageUrls(json, 2), [
    'https://cdn.example.com/1.jpg',
    'https://cdn.example.com/2.jpg',
  ]);
});

test('extractImageUrls no explota con estructuras raras ni ciclos superficiales', () => {
  assert.deepEqual(extractImageUrls(null), []);
  assert.deepEqual(extractImageUrls('https://cdn.example.com/x.webp'), ['https://cdn.example.com/x.webp']);
  assert.deepEqual(extractImageUrls(42), []);
  // Profundidad mayor al tope: no debe tirar ni colgarse.
  let deep: Record<string, unknown> = { image: 'https://cdn.example.com/deep.jpg' };
  for (let i = 0; i < 20; i++) deep = { nested: deep };
  assert.deepEqual(extractImageUrls(deep), []);
});
