import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { saveRecord, softDeleteRecords } from '@/db/records';
import { createSampleProject } from '@/db/sampleProject';
import { createDb, type PontiaDb } from '@/db/schema';
import type { CloudSession } from '@/domain/types';
import type { CloudClient, CloudRow } from '@/sync/client';
import { synchronize, type SyncState } from '@/sync/engine';

const SESSION: CloudSession = { accessToken: 't', refreshToken: 'r', expiresAt: Date.now() + 3_600_000, userId: 'usuario-1', email: 'auditor@ejemplo.co' };

/** Nube de prueba en memoria con las reglas del SQL: gana la versión más reciente y cada cambio aceptado recibe una secuencia nueva. */
function fakeCloud() {
  const rows = new Map<string, CloudRow & { server_seq: number }>();
  const files = new Map<string, { bytes: Uint8Array<ArrayBuffer>; type: string }>();
  let seq = 0;
  const client: CloudClient = {
    ping: async () => undefined,
    signIn: async () => SESSION,
    signUp: async () => SESSION,
    refresh: async (session) => session,
    signOut: async () => undefined,
    upsert: async (_session, list) => {
      for (const row of list) {
        const key = `${row.owner}|${row.table_name}|${row.id}`;
        const old = rows.get(key);
        if (old && row.updated_at <= old.updated_at) continue;
        rows.set(key, { ...structuredClone(row), server_seq: ++seq });
      }
    },
    pull: async (_session, after, limit) =>
      [...rows.values()]
        .filter((r) => r.server_seq > after)
        .sort((a, b) => a.server_seq - b.server_seq)
        .slice(0, limit)
        .map((r) => structuredClone(r)),
    uploadPhoto: async (_session, path, blob) => {
      files.set(path, { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type });
    },
    downloadPhoto: async (_session, path) => {
      const file = files.get(path);
      if (!file) throw new Error(`No existe ${path}`);
      return new Blob([file.bytes], { type: file.type });
    },
  };
  return { client, rows, files };
}

const fresh = (): SyncState => ({ lastSeq: 0, lastPushedAt: 0 });
const count = (db: PontiaDb, table: string, projectId: string) => db.table(table).where('projectId').equals(projectId).count();

describe('sincronización con la nube', () => {
  it('pasa un proyecto con fotos de un equipo a otro y trae de vuelta los cambios', async () => {
    const cloud = fakeCloud();
    const pc = createDb('pontia-nube-pc');
    const celular = createDb('pontia-nube-celular');
    const project = await createSampleProject(pc);
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 7, 7, 7]);
    const equipo = (await pc.equipment.where('projectId').equals(project.id).first())!;
    await saveRecord(pc, 'photos', {
      id: 'foto-1',
      projectId: project.id,
      entityType: 'equipo',
      entityId: equipo.id,
      kind: 'placa',
      takenAt: '2026-09-10T10:00',
      blob: new Blob([bytes], { type: 'image/jpeg' }),
      thumb: new Blob([bytes], { type: 'image/jpeg' }),
    });

    const pcState = fresh();
    const first = await synchronize(pc, cloud.client, SESSION, pcState);
    expect(first.photosUp).toBe(1);
    expect(first.pushed).toBe(cloud.rows.size);
    expect(cloud.files.size).toBe(2);

    const phoneState = fresh();
    const second = await synchronize(celular, cloud.client, SESSION, phoneState);
    expect(second.pulled).toBe(cloud.rows.size);
    expect(second.photosDown).toBe(1);
    expect((await celular.projects.get(project.id))?.name).toBe(project.name);
    for (const table of ['areas', 'equipment', 'electrical', 'bills', 'findings', 'measures', 'pgee', 'tasks', 'intervalSeries', 'intervalDays']) {
      expect(await count(celular, table, project.id)).toBe(await count(pc, table, project.id));
    }
    const photo = (await celular.photos.get('foto-1'))!;
    expect(new Uint8Array(await photo.blob.arrayBuffer())).toEqual(bytes);
    expect(photo.thumb).toBeDefined();

    // En el celular se cambia un espacio y se elimina una tarea; el PC recibe los dos cambios
    const area = (await celular.areas.where('projectId').equals(project.id).first())!;
    await saveRecord(celular, 'areas', { ...area, name: 'Aula 601 · renovada' });
    const task = (await celular.tasks.where('projectId').equals(project.id).first())!;
    await softDeleteRecords(celular, 'tasks', [task.id]);
    const third = await synchronize(celular, cloud.client, SESSION, phoneState);
    expect(third.pushed).toBeGreaterThanOrEqual(2);
    const back = await synchronize(pc, cloud.client, SESSION, pcState);
    expect(back.pulled).toBeGreaterThanOrEqual(2);
    expect((await pc.areas.get(area.id))?.name).toBe('Aula 601 · renovada');
    expect((await pc.tasks.get(task.id))?.deletedAt).toBeDefined();
    // Una segunda sincronización sin cambios no sube ni baja nada nuevo
    const idle = await synchronize(pc, cloud.client, SESSION, pcState);
    expect(idle.pulled).toBe(0);
    pc.close();
    celular.close();
  });

  it('gana el cambio más reciente aunque el más viejo se suba después', async () => {
    const cloud = fakeCloud();
    const pc = createDb('pontia-nube-lww-pc');
    const celular = createDb('pontia-nube-lww-celular');
    const project = await createSampleProject(pc);
    const pcState = fresh();
    const phoneState = fresh();
    await synchronize(pc, cloud.client, SESSION, pcState);
    await synchronize(celular, cloud.client, SESSION, phoneState);

    const area = (await pc.areas.where('projectId').equals(project.id).first())!;
    const later = Date.now() + 60_000;
    await saveRecord(celular, 'areas', { ...area, name: 'Versión del celular' }, later);
    await saveRecord(pc, 'areas', { ...area, name: 'Versión del PC' }, later - 30_000);
    await synchronize(celular, cloud.client, SESSION, phoneState);
    // El PC sube una versión más vieja: la nube la rechaza y el PC recibe la del celular
    await synchronize(pc, cloud.client, SESSION, pcState);
    await synchronize(celular, cloud.client, SESSION, phoneState);
    expect((await pc.areas.get(area.id))?.name).toBe('Versión del celular');
    expect((await celular.areas.get(area.id))?.name).toBe('Versión del celular');
    pc.close();
    celular.close();
  });
});
