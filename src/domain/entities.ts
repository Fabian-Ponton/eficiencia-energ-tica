import type { EntityKind, EntityOrder, Project } from './types';

/** Texto comparable: sin tildes, en minúsculas y con los espacios normalizados. «Universidad de La Guajira» = «universidad de la  guajira». */
export const normalizeName = (text: string | undefined): string =>
  (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export interface KnownSite {
  name: string;
  upmeCode?: string;
  address?: string;
}

export interface KnownEntity {
  name: string;
  nit?: string;
  kind?: EntityKind;
  order?: EntityOrder;
  city?: string;
  sector?: string;
  sites: KnownSite[];
}

const text = (value: string | undefined) => value?.trim() || undefined;

/**
 * Entidades y sedes de los proyectos que ya están en el equipo, para no volver a escribirlas al crear otro proyecto.
 * Los datos de la entidad salen del proyecto más reciente que los tenga.
 */
export function knownEntities(projects: readonly Project[]): KnownEntity[] {
  const byKey = new Map<string, KnownEntity>();
  for (const p of [...projects].filter((x) => !x.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt)) {
    const name = text(p.client);
    if (!name) continue;
    const key = normalizeName(name);
    const entity = byKey.get(key) ?? { name, sites: [] };
    entity.nit ??= text(p.nit);
    entity.kind ??= p.entity?.kind;
    entity.order ??= p.entity?.order;
    entity.city ??= text(p.city);
    entity.sector ??= text(p.sector);
    const siteName = text(p.site?.name);
    if (siteName) {
      const known = entity.sites.find((s) => normalizeName(s.name) === normalizeName(siteName));
      if (known) {
        known.upmeCode ??= text(p.site?.upmeCode);
        known.address ??= text(p.address);
      } else entity.sites.push({ name: siteName, upmeCode: text(p.site?.upmeCode), address: text(p.address) });
    }
    byKey.set(key, entity);
  }
  return [...byKey.values()];
}

export const findEntity = (entities: readonly KnownEntity[], name: string | undefined): KnownEntity | undefined =>
  entities.find((e) => normalizeName(e.name) === normalizeName(name));

export const findSite = (entity: KnownEntity | undefined, name: string | undefined): KnownSite | undefined =>
  entity?.sites.find((s) => normalizeName(s.name) === normalizeName(name));

export interface ProjectGroup<T> {
  key: string;
  /** Entidad, o vacío si el proyecto no la tiene. */
  entity: string;
  /** Sede, o vacío si el proyecto no la tiene. */
  site: string;
  items: T[];
}

/**
 * Agrupa por entidad y sede conservando el orden de llegada (los proyectos ya vienen del más reciente al más antiguo).
 * Los proyectos sin entidad ni sede quedan al final.
 */
export function groupBySite<T>(items: readonly T[], projectOf: (item: T) => Project): ProjectGroup<T>[] {
  const groups = new Map<string, ProjectGroup<T>>();
  for (const item of items) {
    const p = projectOf(item);
    const entity = text(p.client) ?? '';
    const site = text(p.site?.name) ?? '';
    const key = `${normalizeName(entity)}|${normalizeName(site)}`;
    const group = groups.get(key) ?? { key, entity, site, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => Number(a.key === '|') - Number(b.key === '|'));
}
