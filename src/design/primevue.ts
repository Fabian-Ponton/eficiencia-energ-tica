import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import type { PrimeVueConfiguration } from 'primevue/config';

/** Tema de PrimeVue con la paleta PONTIA «documento blanco»: azul marino para acciones, papel para superficies. */
const PontiaPreset = definePreset(Aura, {
  primitive: {
    borderRadius: { none: '0', xs: '2px', sm: '3px', md: '3px', lg: '4px', xl: '6px' },
  },
  semantic: {
    primary: {
      50: '#eef1f6',
      100: '#dde3ee',
      200: '#bcc7dc',
      300: '#8da0c1',
      400: '#4f6d9c',
      500: '#15305c',
      600: '#122851',
      700: '#0f2446',
      800: '#0c1d38',
      900: '#09172c',
      950: '#060f1d',
    },
    colorScheme: {
      light: {
        primary: { color: '{primary.500}', contrastColor: '#ffffff', hoverColor: '{primary.600}', activeColor: '{primary.700}' },
        surface: {
          0: '#ffffff',
          50: '#f6f7f9',
          100: '#eceef1',
          200: '#e4e6ea',
          300: '#d4d8df',
          400: '#aeb4bf',
          500: '#98a0ae',
          600: '#767d8c',
          700: '#3f4654',
          800: '#252b36',
          900: '#171c25',
          950: '#10151f',
        },
      },
      dark: {
        primary: { color: '{primary.300}', contrastColor: '#0b1422', hoverColor: '{primary.200}', activeColor: '{primary.100}' },
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
  components: {
    // Los botones sin relleno llevaban el gris claro de las superficies y quedaban por debajo del contraste AA
    button: {
      colorScheme: {
        light: {
          outlined: {
            secondary: { color: '{surface.700}', borderColor: '{surface.300}', hoverBackground: '{surface.50}', activeBackground: '{surface.100}' },
          },
          text: {
            secondary: { color: '{surface.700}', hoverBackground: '{surface.50}', activeBackground: '{surface.100}' },
          },
        },
        dark: {
          outlined: {
            secondary: { color: '{surface.200}', borderColor: '{surface.600}', hoverBackground: '{surface.800}', activeBackground: '{surface.700}' },
          },
          text: {
            secondary: { color: '{surface.200}', hoverBackground: '{surface.800}', activeBackground: '{surface.700}' },
          },
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
