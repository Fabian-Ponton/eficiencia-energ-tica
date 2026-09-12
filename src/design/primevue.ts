import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import type { PrimeVueConfiguration } from 'primevue/config';

/** Tema de PrimeVue con la paleta PONTIA: verde para acciones, grises azulados para superficies. */
const PontiaPreset = definePreset(Aura, {
  primitive: {
    borderRadius: { none: '0', xs: '2px', sm: '6px', md: '8px', lg: '10px', xl: '12px' },
  },
  semantic: {
    primary: {
      50: '#eaf6ee',
      100: '#d9eee1',
      200: '#b3dcc3',
      300: '#7fc39c',
      400: '#4aa872',
      500: '#187f44',
      600: '#146c3a',
      700: '#115a30',
      800: '#0e4826',
      900: '#0b3a1f',
      950: '#062413',
    },
    colorScheme: {
      light: {
        primary: { color: '{primary.500}', contrastColor: '#ffffff', hoverColor: '{primary.600}', activeColor: '{primary.700}' },
        surface: {
          0: '#ffffff',
          50: '#f5f7fa',
          100: '#eef1f5',
          200: '#dbe1ea',
          300: '#c9d3df',
          400: '#9aa7b8',
          500: '#7a879b',
          600: '#5c6a80',
          700: '#4c5a70',
          800: '#2c3a52',
          900: '#17233d',
          950: '#0f1b33',
        },
      },
      dark: {
        primary: { color: '{primary.400}', contrastColor: '#06140b', hoverColor: '{primary.300}', activeColor: '{primary.200}' },
        surface: {
          0: '#ffffff',
          50: '#eef2f8',
          100: '#dbe3ee',
          200: '#b9c5d9',
          300: '#8e9db5',
          400: '#6f7f99',
          500: '#56657f',
          600: '#3d4b64',
          700: '#2c3a52',
          800: '#1f2c44',
          900: '#131d31',
          950: '#0c1424',
        },
      },
    },
  },
});

const ES = {
  accept: 'Sí',
  reject: 'No',
  cancel: 'Cancelar',
  choose: 'Elegir',
  upload: 'Subir',
  clear: 'Limpiar',
  apply: 'Aplicar',
  today: 'Hoy',
  weekHeader: 'Sem',
  firstDayOfWeek: 1,
  dateFormat: 'dd/mm/yy',
  dayNames: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
  monthNames: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  monthNamesShort: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  emptyMessage: 'Sin resultados',
  emptyFilterMessage: 'Sin resultados',
  emptySearchMessage: 'Sin resultados',
  searchMessage: '{0} resultados disponibles',
  selectionMessage: '{0} elementos seleccionados',
  fileSizeTypes: ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
};

export const primeVueOptions: PrimeVueConfiguration = {
  theme: { preset: PontiaPreset, options: { darkModeSelector: '.app-dark', cssLayer: false } },
  ripple: false,
  locale: ES,
};
