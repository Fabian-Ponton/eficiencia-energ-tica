import { Packer } from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { MANUAL_FAQ, MANUAL_MINIMUM, MANUAL_SECTIONS } from '@/content/manual';
import { ALL_STEPS } from '@/navigation';
import { buildManualDocument } from '@/reports/docx/manual';

describe('manual de uso', () => {
  it('documenta todas las pantallas, en el orden del menú, con sus datos de entrada', () => {
    const documented = MANUAL_SECTIONS.flatMap((section) => section.steps.map((step) => step.id));
    expect(documented).toEqual(ALL_STEPS.map((step) => step.id));

    for (const step of MANUAL_SECTIONS.flatMap((section) => section.steps)) {
      // Cada pantalla dice al menos un dato sin el cual no funciona, de dónde sale y qué entrega
      expect(step.inputs.some((input) => input.need === 'obligatorio'), `«${step.id}» no indica ningún dato obligatorio`).toBe(true);
      expect(step.inputs.every((input) => input.source.length > 20), `«${step.id}» tiene datos sin explicar de dónde salen`).toBe(true);
      expect(step.result.length, `«${step.id}» no dice qué se obtiene`).toBeGreaterThan(20);
    }
  });

  it('arma el manual en Word con sus secciones, su tabla por pantalla y las preguntas', async () => {
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildManualDocument(new Date(2026, 8, 14))));
    const text = ((await zip.file('word/document.xml')?.async('string')) ?? '').replace(/<[^>]+>/g, '');

    expect(text).toContain('MANUAL DE USO');
    expect(text).toContain('14 sep 2026');
    for (const section of ['1. Qué es PONTIA', '2. Primeros pasos', '3. Levantamiento en campo', '4. Análisis del consumo', '5. Plan de mejora', '6. Informes y exportación', '7. Datos mínimos', '8. Dónde se guardan tus datos', '9. Preguntas frecuentes']) {
      expect(text).toContain(section);
    }
    // Una tabla de datos de entrada por pantalla, más la de datos mínimos
    expect(text.match(/Tabla \d+\./g)).toHaveLength(ALL_STEPS.length + 1);
    expect(text).toContain('Datos de entrada de «Inventario»');
    expect(text).toContain(MANUAL_MINIMUM[0].needs);
    expect(text).toContain(MANUAL_FAQ[0].q);
  });
});
