import type { ImportTemplate, Settings } from '@/domain/types';
import type { PontiaDb } from './schema';

const DEFAULTS: Settings = { id: 'app', csvFormat: 'es-CO', theme: 'sistema' };

export async function getSettings(db: PontiaDb): Promise<Settings> {
  return (await db.settings.get('app')) ?? DEFAULTS;
}

/** Guarda una plantilla de importación; si ya hay una con el mismo nombre, la reemplaza. */
export async function saveImportTemplate(db: PontiaDb, template: Omit<ImportTemplate, 'id' | 'createdAt'>, now = Date.now()): Promise<ImportTemplate> {
  const settings = await getSettings(db);
  const record: ImportTemplate = { ...template, name: template.name.trim(), id: crypto.randomUUID(), createdAt: now };
  const others = (settings.importTemplates ?? []).filter((t) => t.name.toLowerCase() !== record.name.toLowerCase());
  await db.settings.put({ ...settings, importTemplates: [...others, record] });
  return record;
}

export async function deleteImportTemplate(db: PontiaDb, id: string): Promise<void> {
  const settings = await getSettings(db);
  await db.settings.put({ ...settings, importTemplates: (settings.importTemplates ?? []).filter((t) => t.id !== id) });
}
