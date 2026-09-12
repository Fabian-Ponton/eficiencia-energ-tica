import { createRouter, createWebHashHistory } from 'vue-router';
import { ALL_STEPS } from './navigation';

// Rutas con # para que GitHub Pages no responda 404 al recargar una pantalla
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'proyectos', component: () => import('@/views/ProjectsView.vue') },
    {
      path: '/proyecto/:projectId',
      component: () => import('@/layouts/ProjectLayout.vue'),
      children: [
        { path: '', name: 'inicio', component: () => import('@/views/project/ProjectHome.vue') },
        { path: 'etapa/:stage', name: 'etapa', component: () => import('@/views/project/StageHub.vue') },
        ...ALL_STEPS.map((step) => ({
          path: step.id,
          name: step.id,
          component: () => import('@/views/project/ComingSoon.vue'),
          meta: { step: step.id },
        })),
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
