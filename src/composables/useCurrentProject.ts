import { computed, inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import { useRoute } from 'vue-router';
import { summarizeProject, type ProjectSummary } from '@/db/projects';
import { getDb } from '@/db/schema';
import type { Project } from '@/domain/types';
import { useLiveQuery } from './useLiveQuery';

export interface CurrentProject {
  projectId: ComputedRef<string>;
  /** `undefined` mientras carga, `null` si el proyecto no existe o fue eliminado. */
  project: Readonly<Ref<Project | null | undefined>>;
  summary: Readonly<Ref<ProjectSummary | null | undefined>>;
}

const KEY: InjectionKey<CurrentProject> = Symbol('proyecto-actual');

export function provideCurrentProject(): CurrentProject {
  const route = useRoute();
  const db = getDb();
  const projectId = computed(() => String(route.params.projectId ?? ''));
  const load = async () => {
    const found = await db.projects.get(projectId.value);
    return found && !found.deletedAt ? found : null;
  };
  const project = useLiveQuery(load, [projectId]);
  const summary = useLiveQuery(async () => {
    const found = await load();
    return found ? summarizeProject(db, found) : null;
  }, [projectId]);
  const current = { projectId, project, summary };
  provide(KEY, current);
  return current;
}

export function useCurrentProject(): CurrentProject {
  const current = inject(KEY);
  if (!current) throw new Error('useCurrentProject solo funciona dentro de ProjectLayout.');
  return current;
}
