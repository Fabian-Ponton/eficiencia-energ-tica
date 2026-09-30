import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_KINDS,
  emptyRetie,
  hasEvidence,
  INTERVENTIONS,
  missingDocuments,
  registryText,
  RETIE_2026_START,
  retieGate,
  retieProblems,
  retieRegime,
  retieReminders,
  retieSaveProblem,
  retieState,
  retieSummary,
  suggestedWorks,
  tidyRetieFields,
} from '@/domain/retie';
import type { RetieVerification, Task } from '@/domain/types';

const verificada = (extra: Partial<RetieVerification> = {}): RetieVerification => ({
  applies: 'si',
  status: 'cumple',
  documents: [{ kind: 'dictamen-inspeccion', reference: 'D-1', issuer: 'Organismo de inspección', date: '2027-06-01', result: 'cumple' }],
  verifiedBy: 'Organismo de inspección acreditado',
  verifiedAt: '2027-06-01',
  ...extra,
});

const tarea = (extra: Partial<Task> = {}): Task => ({
  id: 't',
  projectId: 'p',
  createdAt: 0,
  updatedAt: 0,
  name: 'Instalación',
  phase: 'corto',
  status: 'pendiente',
  progress: 0,
  works: { interventionType: 'remodelacion', startDate: '2027-03-31' },
  retie: emptyRetie(),
  ...extra,
});

describe('régimen del RETIE según el inicio de la obra (Res. 40284 de 2026, transición)', () => {
  it('las obras iniciadas desde el 1 de enero de 2026 se rigen por el RETIE de 2026; las anteriores pueden seguir con la Res. 90708 de 2013', () => {
    expect(RETIE_2026_START).toBe('2026-01-01');
    expect(retieRegime('2026-01-01')).toBe('vigente');
    expect(retieRegime('2027-03-31')).toBe('vigente');
    expect(retieRegime('2025-12-31')).toBe('anterior');
  });

  it('sin fecha, o mal escrita, queda por confirmar', () => {
    expect(retieRegime(undefined)).toBe('por-confirmar');
    expect(retieRegime('')).toBe('por-confirmar');
    expect(retieRegime('31/03/2027')).toBe('por-confirmar');
  });
});

describe('datos de obra que propone PONTIA para cada tarea de ejecución', () => {
  it('las buenas prácticas no tocan la instalación: sin obra ni verificación', () => {
    expect(suggestedWorks({ kind: 'operativa' })).toEqual({});
  });

  it('un cambio de equipos es una remodelación y la generación con FNCER, una instalación nueva; el RETIE queda por definir', () => {
    expect(suggestedWorks({ kind: 'baja-inversion' })).toEqual({ works: { interventionType: 'remodelacion' }, retie: { applies: 'por-definir', documents: [], status: 'pendiente' } });
    expect(suggestedWorks({ kind: 'alta-inversion', savingsType: 'fncer' }).works).toEqual({ interventionType: 'nueva' });
    // Una medida operativa clasificada por el auditor como otra clase sigue sin obra
    expect(suggestedWorks({ kind: 'operativa', savingsType: 'fncer' })).toEqual({});
  });
});

describe('recordatorios del reglamento', () => {
  const textoDe = (r: ReturnType<typeof retieReminders>) => r.map((x) => x.ref).join(' | ');

  it('una remodelación recuerda la demostración de la conformidad, el 80 % y los umbrales de las entidades oficiales', () => {
    const r = retieReminders({ works: { interventionType: 'remodelacion', startDate: '2027-03-31' } });
    expect(textoDe(r)).toContain('art. 4.3.1 (g)');
    expect(textoDe(r)).toContain('arts. 4.3.2.2 (b) y 4.3.2.3');
    expect(r.find((x) => x.ref === 'art. 4.3.1 (g)')?.text).toContain('supera el 80 %');
    expect(r.find((x) => x.ref.startsWith('arts. 4.3.2.2 (b)'))?.text).toContain('100 kVA');
    expect(textoDe(r)).toContain('art. 3.3.1 (l, m)');
    expect(textoDe(r)).toContain('art. 4.3.5');
    // Sin generación con FNCER no aparece esa regla
    expect(textoDe(r)).not.toContain('4.3.2.1 (h, i)');
  });

  it('la generación con FNCER recuerda la certificación plena desde 10 kVA y el diseño previo', () => {
    const r = retieReminders({ works: { interventionType: 'nueva', startDate: '2027-05-31' }, measure: { kind: 'alta-inversion', savingsType: 'fncer' } });
    const fncer = r.find((x) => x.ref.includes('4.3.2.1 (h, i)'));
    expect(fncer?.text).toContain('10 kVA');
    expect(fncer?.text).toContain('diseño previo');
  });

  it('el mantenimiento no recuerda la regla de ampliaciones y remodelaciones', () => {
    const r = retieReminders({ works: { interventionType: 'mantenimiento', startDate: '2027-03-31' } });
    expect(textoDe(r)).not.toContain('art. 4.3.1 (g)');
    expect(textoDe(r)).toContain('art. 4.3.5');
  });

  it('con una obra iniciada antes de 2026 solo avisa que rige la Res. 90708 de 2013, sin detallarla', () => {
    const r = retieReminders({ works: { interventionType: 'remodelacion', startDate: '2025-11-03' } });
    expect(r).toHaveLength(1);
    expect(r[0].text).toContain('Res. 90708 de 2013');
    expect(r[0].text).toContain('no los detalla');
  });
});

describe('estado de la tarea frente al RETIE', () => {
  it('sin obra no se verifica; con obra y sin decidir, está por definir', () => {
    expect(retieState({})).toBe('sin-obra');
    expect(retieState({ works: { interventionType: 'remodelacion' } })).toBe('por-definir');
    expect(retieState(tarea())).toBe('por-definir');
  });

  it('«No aplica» cuando el auditor dijo que no; y pendiente, en revisión o no cumple según la verificación', () => {
    expect(retieState(tarea({ retie: { applies: 'no', status: 'no-aplica', documents: [] } }))).toBe('no-aplica');
    expect(retieState(tarea({ retie: { applies: 'si', status: 'pendiente', documents: [] } }))).toBe('pendiente');
    expect(retieState(tarea({ retie: { applies: 'si', status: 'en-revision', documents: [] } }))).toBe('en-revision');
    expect(retieState(tarea({ retie: { applies: 'si', status: 'no-cumple', documents: [] } }))).toBe('no-cumple');
    // «No aplica» en el estado con el RETIE aplicable es una incoherencia: se ve pendiente
    expect(retieState(tarea({ retie: { applies: 'si', status: 'no-aplica', documents: [] } }))).toBe('pendiente');
  });

  it('«Cumple» solo vale con evidencia: un documento que cumple, quién verificó y cuándo', () => {
    expect(retieState(tarea({ retie: verificada() }))).toBe('cumple');
    expect(hasEvidence(verificada())).toBe(true);
    expect(retieState(tarea({ retie: verificada({ documents: [] }) }))).toBe('en-revision');
    expect(retieState(tarea({ retie: verificada({ verifiedBy: '  ' }) }))).toBe('en-revision');
    expect(retieState(tarea({ retie: verificada({ verifiedAt: undefined }) }))).toBe('en-revision');
    expect(retieState(tarea({ retie: verificada({ documents: [{ kind: 'dictamen-inspeccion', result: 'no-cumple' }] }) }))).toBe('en-revision');
  });

  it('dice qué falta para dejarla en «Cumple»', () => {
    expect(retieProblems(verificada())).toEqual([]);
    expect(retieProblems(verificada({ documents: [], verifiedBy: undefined, verifiedAt: undefined }))).toEqual(['un documento con resultado «Cumple»', 'quién verificó', 'la fecha de la verificación']);
    // En otros estados no se exige evidencia
    expect(retieProblems({ applies: 'si', status: 'pendiente', documents: [] })).toEqual([]);
  });
});

describe('regla para marcar una tarea como implementada', () => {
  it('una tarea sin obra eléctrica no tiene restricción', () => {
    expect(retieGate({})).toEqual({ ok: true });
  });

  it('con la obra y el RETIE por definir no pasa: hay que decidir si aplica', () => {
    const gate = retieGate(tarea());
    expect(gate.ok).toBe(false);
    expect(gate.reason).toContain('Define si el RETIE aplica');
  });

  it('si el RETIE no aplica, pasa solo con la explicación de por qué', () => {
    const sinExplicar = tarea({ retie: { applies: 'no', status: 'no-aplica', documents: [] } });
    expect(retieGate(sinExplicar)).toEqual({ ok: false, reason: 'Explica por qué el RETIE no aplica a esta intervención.' });
    const explicada = tarea({ retie: { applies: 'no', status: 'no-aplica', documents: [], justification: 'Solo se cambian lámparas dentro de las luminarias existentes' } });
    expect(retieGate(explicada)).toEqual({ ok: true });
  });

  it('si aplica, pasa con la verificación «Cumple» y su evidencia', () => {
    expect(retieGate(tarea({ retie: verificada() }))).toEqual({ ok: true });
  });

  it('si aplica y no está verificada, no pasa; con una justificación pasa, pero queda marcada', () => {
    const pendiente = tarea({ retie: { applies: 'si', status: 'pendiente', documents: [] } });
    const gate = retieGate(pendiente);
    expect(gate.ok).toBe(false);
    expect(gate.reason).toContain('escribe la justificación');
    const conJustificacion = tarea({ retie: { applies: 'si', status: 'en-revision', documents: [], justification: 'El dictamen se pidió y el organismo lo entrega el 15 de julio' } });
    expect(retieGate(conJustificacion)).toEqual({ ok: true, waived: true });
    // Un «Cumple» sin evidencia tampoco pasa solo
    expect(retieGate(tarea({ retie: verificada({ documents: [] }) })).ok).toBe(false);
  });

  it('el problema al guardar: «Cumple» sin evidencia, o implementada (o al 100 %) sin el RETIE resuelto', () => {
    expect(retieSaveProblem(tarea({ status: 'pendiente', progress: 0 }))).toBeUndefined();
    expect(retieSaveProblem(tarea({ status: 'implementada', progress: 100 }))).toContain('Define si el RETIE aplica');
    expect(retieSaveProblem(tarea({ status: 'en-ejecucion', progress: 100 }))).toContain('Define si el RETIE aplica');
    expect(retieSaveProblem(tarea({ status: 'implementada', progress: 100, retie: verificada() }))).toBeUndefined();
    const sinEvidencia = tarea({ status: 'pendiente', retie: verificada({ documents: [], verifiedBy: undefined }) });
    expect(retieSaveProblem(sinEvidencia)).toBe('Para dejar el RETIE en «Cumple» falta: un documento con resultado «Cumple», quién verificó.');
    expect(retieSaveProblem({ status: 'implementada', progress: 100 })).toBeUndefined();
  });
});

describe('resumen del RETIE del plan', () => {
  it('cuenta las tareas con obra por estado y separa las implementadas con justificación de las que incumplen la regla', () => {
    const tareas = [
      { status: 'pendiente' as const },
      tarea({ status: 'pendiente' }),
      tarea({ status: 'pendiente', retie: { applies: 'si', status: 'en-revision', documents: [] } }),
      tarea({ status: 'implementada', retie: verificada() }),
      tarea({ status: 'implementada', retie: { applies: 'si', status: 'pendiente', documents: [], justification: 'Se energiza con permiso provisional' } }),
      tarea({ status: 'implementada' }),
      tarea({ status: 'pendiente', retie: { applies: 'no', status: 'no-aplica', documents: [], justification: 'Sin cambios en circuitos' } }),
    ].map((t) => ({ status: t.status, works: (t as Task).works, retie: (t as Task).retie }));
    const resumen = retieSummary(tareas);
    expect(resumen.works).toBe(6);
    expect(resumen.byState).toEqual({ 'por-definir': 2, pendiente: 1, 'en-revision': 1, cumple: 1, 'no-cumple': 0, 'no-aplica': 1 });
    expect(resumen.waived).toBe(1);
    expect(resumen.breaking).toBe(1);
  });
});

describe('documentos que suelen acompañar la certificación plena (art. 4.3.8)', () => {
  it('faltan diseño, construcción, dictamen y productos hasta que se registren', () => {
    expect(missingDocuments([])).toEqual(['declaracion-diseno', 'declaracion-construccion', 'dictamen-inspeccion', 'certificado-producto']);
    expect(missingDocuments([{ kind: 'declaracion-diseno' }, { kind: 'otro' }])).toEqual(['declaracion-construccion', 'dictamen-inspeccion', 'certificado-producto']);
  });

  it('con un esquema constructivo solo quedan los certificados de los productos', () => {
    expect(missingDocuments([{ kind: 'esquema-constructivo' }])).toEqual(['certificado-producto']);
  });

  it('el catálogo trae un nombre, su artículo y la definición de cada documento', () => {
    expect(DOCUMENT_KINDS.map((d) => d.id)).toEqual(['declaracion-diseno', 'declaracion-construccion', 'dictamen-inspeccion', 'certificado-producto', 'esquema-constructivo', 'declaracion-operacion', 'otro']);
    expect(DOCUMENT_KINDS.find((d) => d.id === 'dictamen-inspeccion')?.hint).toContain('ONAC');
    expect(INTERVENTIONS.map((i) => i.id)).toEqual(['nueva', 'ampliacion', 'remodelacion', 'reposicion', 'mantenimiento']);
  });
});

describe('datos limpios al guardar', () => {
  it('recorta los textos, quita las filas de documentos vacías y el ejecutor sin nombre', () => {
    const limpio = tidyRetieFields({
      executor: { kind: 'empresa', name: '   ' },
      works: { interventionType: 'remodelacion', startDate: '', startProof: undefined },
      retie: {
        applies: 'si',
        status: 'pendiente',
        documents: [{ kind: 'dictamen-inspeccion' }, { kind: 'declaracion-diseno', reference: '  DD-1  ', result: 'cumple' }],
        commissioningNotes: '   ',
        verifiedBy: '  Ana  ',
        justification: '',
      },
    });
    expect(limpio.executor).toBeUndefined();
    expect(limpio.works).toEqual({ interventionType: 'remodelacion', startDate: undefined, startProof: undefined });
    expect(limpio.retie?.documents).toEqual([{ kind: 'declaracion-diseno', reference: 'DD-1', issuer: undefined, date: undefined, result: 'cumple' }]);
    expect(limpio.retie).toMatchObject({ commissioningNotes: undefined, verifiedBy: 'Ana', justification: undefined });
  });

  it('un ejecutor con nombre o con registro se conserva, recortado', () => {
    const limpio = tidyRetieFields({ executor: { kind: 'persona', name: ' Ingeniero de ejemplo ', role: ' Interventor ', registry: { body: 'COPNIA', category: ' Ingeniero electricista ', number: '' } } });
    expect(limpio.executor).toEqual({ kind: 'persona', name: 'Ingeniero de ejemplo', role: 'Interventor', registry: { body: 'COPNIA', category: 'Ingeniero electricista', number: undefined } });
    // Solo el registro, sin nombre: también se conserva
    expect(tidyRetieFields({ executor: { kind: 'empresa', name: '', registry: { body: 'CONTE' } } }).executor).toMatchObject({ registry: { body: 'CONTE' } });
    // Sin registro elegido no queda un registro vacío
    expect(tidyRetieFields({ executor: { kind: 'empresa', name: 'Contratista', registry: undefined } }).executor?.registry).toBeUndefined();
  });

  it('si el RETIE no aplica la verificación queda en «No aplica»; si vuelve a aplicar, pendiente', () => {
    expect(tidyRetieFields({ works: { interventionType: 'reposicion' }, retie: { applies: 'no', status: 'pendiente', documents: [] } }).retie?.status).toBe('no-aplica');
    expect(tidyRetieFields({ works: { interventionType: 'reposicion' }, retie: { applies: 'si', status: 'no-aplica', documents: [] } }).retie?.status).toBe('pendiente');
  });

  it('una tarea con obra sin verificación recibe una en blanco; sin obra, la verificación guardada no se toca', () => {
    expect(tidyRetieFields({ works: { interventionType: 'nueva' } }).retie).toMatchObject({ applies: 'por-definir', status: 'pendiente', documents: [] });
    const guardada: RetieVerification = { applies: 'si', status: 'pendiente', documents: [{ kind: 'dictamen-inspeccion', reference: 'D-9' }] };
    const sinObra = tidyRetieFields({ retie: guardada });
    expect(sinObra.works).toBeUndefined();
    expect(sinObra.retie?.documents).toHaveLength(1);
    expect(tidyRetieFields({}).retie).toBeUndefined();
  });
});

describe('registro profesional en una línea', () => {
  it('junta la entidad, la categoría y el número; sin registro queda vacío', () => {
    expect(registryText({ kind: 'persona', name: 'X', registry: { body: 'CONTE', category: 'TE-1', number: '123' } })).toBe('CONTE · TE-1 · N.º 123');
    expect(registryText({ kind: 'persona', name: 'X', registry: { body: 'otra', category: 'Profesional' } })).toBe('Otro registro · Profesional');
    expect(registryText({ kind: 'empresa', name: 'X' })).toBe('');
    expect(registryText(undefined)).toBe('');
  });
});
