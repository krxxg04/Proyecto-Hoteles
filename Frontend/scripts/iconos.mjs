/**
 * Genera los PNG del manifiesto a partir de `public/icono.svg`.
 *
 * Chrome solo ofrece "Instalar" si el manifiesto trae un icono de 192 y otro de 512.
 * El `maskable` va con el dibujo al 80% porque Android recorta los bordes.
 *
 * Se corre a mano cuando cambie el icono:
 *   node scripts/iconos.mjs
 *
 * `sharp` viene con Next, no es una dependencia nueva.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const PUBLICO = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const svg = readFileSync(join(PUBLICO, 'icono.svg'));

const FONDO = { r: 0x7c, g: 0x4d, b: 0xff, alpha: 1 };

for (const lado of [192, 512]) {
  const png = await sharp(svg, { density: 384 }).resize(lado, lado).png().toBuffer();
  writeFileSync(join(PUBLICO, `icono-${lado}.png`), png);
  console.log(`  icono-${lado}.png`);
}

// Maskable: el dibujo al 80%, el resto es margen que Android puede recortar sin comerse nada.
const interior = Math.round(512 * 0.8);
const dibujo = await sharp(svg, { density: 384 }).resize(interior, interior).png().toBuffer();

const maskable = await sharp({
  create: { width: 512, height: 512, channels: 4, background: FONDO },
})
  .composite([{ input: dibujo, gravity: 'centre' }])
  .png()
  .toBuffer();

writeFileSync(join(PUBLICO, 'icono-maskable-512.png'), maskable);
console.log('  icono-maskable-512.png');
