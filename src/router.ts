import { createRouter, createWebHashHistory } from 'vue-router';
import { ALL_STEPS } from './navigation';

/** Pasos ya construidos; los demás muestran en qué fase del plan llegan. */
const STEP_VIEWS = {
  datos: () => import('@/views/project/steps/GeneralDataView.vue'),
  areas: () => import('@/views/project/steps/AreasView.vue'),
  inventario: () => import('@/views/project/steps/InventoryView.vue'),
  electrico: () => import('@/views/project/steps/ElectricalView.vue'),
  mediciones: () => import('@/views/project/steps/MeasurementsView.vue'),
  facturacion: () => import('@/views/project/steps/BillingView.vue'),
  comportamiento: () => import('@/views/project/steps/BehaviorView.vue'),
  balance: () => import('@/views/project/steps/BalanceView.vue'),
  dimensionamiento: () => import('@/views/project/steps/SizingView.vue'),
  informes: () => import('@/views/project/steps/ReportsView.vue'),
  diagnostico: () => import('@/views/project/steps/DiagnosisView.vue'),
  oportunidades: () => import('@/views/project/steps/OpportunitiesView.vue'),
  pgee: () => import('@/views/project/steps/PgeeView.vue'),
};
const comingSoon = () => import('@/views/project/ComingSoon.vue');

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
          component: step.id in STEP_VIEWS ? STEP_VIEWS[step.id as keyof typeof STEP_VIEWS] : comingSoon,
          meta: { step: step.id },
        })),
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
