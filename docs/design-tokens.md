# Design Tokens — Aurora

Paleta base del Daily Portal. Soporta dark mode (default) y light mode.
La identidad de color es violeta + sky blue en ambos modos; solo varía el stop tonal.

---

## Estrategia de modos

| Aspecto | Dark (default) | Light |
|---|---|---|
| Activación | `[data-theme="dark"]` o sin atributo | `[data-theme="light"]` |
| Detección inicial | `prefers-color-scheme: dark` | `prefers-color-scheme: light` |
| Override manual | Toggle en el portal → guarda en `localStorage` | ídem |
| Primary violeta | Stop claro `#A78BFA` (legible sobre fondo oscuro) | Stop oscuro `#7C3AED` (legible sobre fondo claro) |
| Semánticos | Saturación alta para contraste sobre oscuro | Saturación reducida, más sobrios |

Angular lee la preferencia del sistema al iniciar y escucha cambios:
```typescript
// app.component.ts
const stored = localStorage.getItem('theme');
const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.setAttribute(
  'data-theme',
  stored ?? (systemDark ? 'dark' : 'light')
);
```

---

## CSS Custom Properties

### globals.scss (o styles.scss)

```scss
// ─────────────────────────────────────────────────────────────
// AURORA — Dark mode (default)
// ─────────────────────────────────────────────────────────────
:root,
[data-theme="dark"] {
  // Fondos
  --color-bg-base:     #120F1E;   // Página
  --color-bg-surface:  #1E1830;   // Tarjetas, paneles
  --color-bg-elevated: #252040;   // Dropdowns, tooltips, modales
  --color-bg-subtle:   #1A1530;   // Filas hover, inputs

  // Bordes
  --color-border:        #2D2545;  // Bordes estándar
  --color-border-subtle: #231D3B;  // Separadores sutiles
  --color-border-strong: #3D3560;  // Énfasis, selección

  // Primario (violeta)
  --color-primary:         #A78BFA;  // violet-400
  --color-primary-hover:   #C4B5FD;  // violet-300
  --color-primary-active:  #8B6FE8;  // violet-500
  --color-primary-muted:   #A78BFA1A;
  --color-primary-subtle:  #A78BFA0D;

  // Acento (sky blue — para Slack, Calendar)
  --color-accent:        #38BDF8;  // sky-400
  --color-accent-hover:  #7DD3FC;  // sky-300
  --color-accent-muted:  #38BDF81A;

  // Texto
  --color-text-primary:   #F0EEF8;  // Cuerpo, títulos
  --color-text-secondary: #9A8FB8;  // Labels, metadatos
  --color-text-tertiary:  #5D5480;  // Placeholders, hints
  --color-text-disabled:  #3D3560;

  // Semánticos
  --color-success:        #34D399;  // emerald-400
  --color-success-text:   #6EE7B7;  // emerald-300
  --color-success-muted:  #34D3991A;
  --color-success-subtle: #34D3990D;

  --color-warning:        #FBBF24;  // amber-400
  --color-warning-text:   #FCD34D;  // amber-300
  --color-warning-muted:  #FBBF241A;
  --color-warning-subtle: #FBBF240D;

  --color-error:          #F87171;  // red-400
  --color-error-text:     #FCA5A5;  // red-300
  --color-error-muted:    #F871711A;
  --color-error-subtle:   #F871710D;

  --color-info:           #38BDF8;  // = accent en dark
  --color-info-text:      #7DD3FC;
  --color-info-muted:     #38BDF81A;
  --color-info-subtle:    #38BDF80D;

  // Fuentes específicas por integración
  --color-jira:           #A78BFA;  // = primary (violeta)
  --color-github:         #9A8FB8;  // = text-secondary (neutro)
  --color-calendar:       #38BDF8;  // = accent (sky)
  --color-slack:          #C084FC;  // violet más claro / pink-ish
  --color-telegram:       #38BDF8;  // = accent

  // Sombras
  --shadow-sm:  0 1px 3px rgba(0,0,0,.4);
  --shadow-md:  0 4px 12px rgba(0,0,0,.5);
  --shadow-lg:  0 8px 24px rgba(0,0,0,.6);
}

// ─────────────────────────────────────────────────────────────
// AURORA — Light mode
// ─────────────────────────────────────────────────────────────
[data-theme="light"] {
  // Fondos
  --color-bg-base:     #FAF9FE;   // Muy sutilmente violeta, casi blanco
  --color-bg-surface:  #FFFFFF;
  --color-bg-elevated: #F3F0FD;   // Violeta muy suave
  --color-bg-subtle:   #F8F6FD;

  // Bordes
  --color-border:        #E2DBF5;
  --color-border-subtle: #EDE8F9;
  --color-border-strong: #C4BAE8;

  // Primario (violeta oscuro — contraste sobre blanco)
  --color-primary:         #7C3AED;  // violet-600
  --color-primary-hover:   #6D28D9;  // violet-700
  --color-primary-active:  #5B21B6;  // violet-800
  --color-primary-muted:   #7C3AED14;
  --color-primary-subtle:  #7C3AED0A;

  // Acento (sky oscuro)
  --color-accent:        #0284C7;  // sky-600
  --color-accent-hover:  #0369A1;  // sky-700
  --color-accent-muted:  #0284C714;

  // Texto
  --color-text-primary:   #1A1333;
  --color-text-secondary: #5B4F7A;
  --color-text-tertiary:  #9B8EB8;
  --color-text-disabled:  #C4BAE8;

  // Semánticos (más saturados para legibilidad sobre blanco)
  --color-success:        #059669;  // emerald-600
  --color-success-text:   #047857;  // emerald-700
  --color-success-muted:  #05966914;
  --color-success-subtle: #05966908;

  --color-warning:        #D97706;  // amber-600
  --color-warning-text:   #B45309;  // amber-700
  --color-warning-muted:  #D9770614;
  --color-warning-subtle: #D9770608;

  --color-error:          #DC2626;  // red-600
  --color-error-text:     #B91C1C;  // red-700
  --color-error-muted:    #DC262614;
  --color-error-subtle:   #DC262608;

  --color-info:           #0284C7;
  --color-info-text:      #0369A1;
  --color-info-muted:     #0284C714;
  --color-info-subtle:    #0284C708;

  // Fuentes por integración
  --color-jira:           #7C3AED;
  --color-github:         #5B4F7A;
  --color-calendar:       #0284C7;
  --color-slack:          #9333EA;  // violet-600 ajustado
  --color-telegram:       #0284C7;

  // Sombras
  --shadow-sm:  0 1px 3px rgba(74,48,128,.08);
  --shadow-md:  0 4px 12px rgba(74,48,128,.12);
  --shadow-lg:  0 8px 24px rgba(74,48,128,.16);
}
```

---

## Tailwind Config

```typescript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  // NO usar class strategy — usamos data-theme attribute en :root
  // Tailwind CSS vars se inyectan via globals.scss
  theme: {
    extend: {
      colors: {
        // Todos los colores del portal como tokens Tailwind
        // Apuntan a las CSS vars para respetar el modo activo
        'aurora': {
          bg:        'var(--color-bg-base)',
          surface:   'var(--color-bg-surface)',
          elevated:  'var(--color-bg-elevated)',
          border:    'var(--color-border)',
          primary:   'var(--color-primary)',
          accent:    'var(--color-accent)',
          text:      'var(--color-text-primary)',
          muted:     'var(--color-text-secondary)',
          subtle:    'var(--color-text-tertiary)',
        },
        'status': {
          success:  'var(--color-success)',
          warning:  'var(--color-warning)',
          error:    'var(--color-error)',
          info:     'var(--color-info)',
        },
        'integration': {
          jira:     'var(--color-jira)',
          github:   'var(--color-github)',
          calendar: 'var(--color-calendar)',
          slack:    'var(--color-slack)',
          telegram: 'var(--color-telegram)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'sm':  '4px',
        'md':  '6px',
        'lg':  '10px',
        'xl':  '14px',
      },
      boxShadow: {
        'sm':  'var(--shadow-sm)',
        'md':  'var(--shadow-md)',
        'lg':  'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
};
```

---

## Toggle de modo en Angular

```typescript
// src/app/core/services/theme.service.ts
import { Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'aurora-theme';

  // Signal reactivo — los componentes pueden leer el tema actual
  current = signal<Theme>(this.resolveInitialTheme());

  toggle(): void {
    const next: Theme = this.current() === 'dark' ? 'light' : 'dark';
    this.apply(next);
  }

  private apply(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
    this.current.set(theme);
  }

  private resolveInitialTheme(): Theme {
    const stored = localStorage.getItem(this.STORAGE_KEY) as Theme | null;
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // Llamar en AppComponent.ngOnInit()
  init(): void {
    this.apply(this.current());

    // Escuchar cambios del sistema (si el usuario no ha hecho override)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(this.STORAGE_KEY)) {
        this.apply(e.matches ? 'dark' : 'light');
      }
    });
  }
}
```

```typescript
// src/app/app.component.ts
@Component({
  selector: 'app-root',
  template: `
    <router-outlet />
    <button (click)="theme.toggle()" class="theme-toggle" aria-label="Toggle theme">
      {{ theme.current() === 'dark' ? '☀' : '☾' }}
    </button>
  `,
})
export class AppComponent implements OnInit {
  constructor(readonly theme: ThemeService) {}
  ngOnInit(): void { this.theme.init(); }
}
```

---

## Uso de tokens en componentes

### Regla principal
**Nunca usar colores hardcodeados** en templates o estilos de componentes.
Siempre usar los CSS custom properties o las clases Tailwind mapeadas.

```html
<!-- ✅ Correcto -->
<div class="bg-aurora-surface border border-aurora-border rounded-lg p-4">
  <p class="text-aurora-text">Tarea activa</p>
  <p class="text-aurora-muted">TEMP-123</p>
</div>

<!-- ❌ Incorrecto -->
<div style="background: #1E1830; border: 1px solid #2D2545">...</div>
```

### Badges de prioridad

```html
<!-- En un pipe o componente PriorityBadgeComponent -->
<span
  class="badge"
  [style.background]="'var(--color-' + priority + '-subtle)'"
  [style.color]="'var(--color-' + priority + '-text)'"
  [style.border-color]="'var(--color-' + priority + '-muted)'">
  {{ label }}
</span>
```

Donde `priority` es `'error'` (alta), `'warning'` (media) o `'text-tertiary'` como fallback (baja).

### Colores de integración

Cada sección del dashboard usa su color de integración para el borde izquierdo o el ícono:

```html
<div class="section-header" [style.color]="'var(--color-jira)'">
  <i class="ti ti-brand-jira"></i> Tareas Jira
</div>
```

---

## Escala tipográfica

```scss
// Usar solo estas clases — no definir tamaños ad-hoc
.text-xs    { font-size: 11px; }   // Labels, metadata, timestamps
.text-sm    { font-size: 12px; }   // Badges, subtítulos de tarjeta
.text-base  { font-size: 14px; }   // Cuerpo principal
.text-md    { font-size: 15px; }   // Títulos de sección
.text-lg    { font-size: 18px; }   // Títulos de página
.text-xl    { font-size: 22px; }   // Hero, contador grande

// Pesos
font-weight: 400;  // Cuerpo
font-weight: 500;  // Labels, botones, badges
font-weight: 600;  // Títulos de sección (solo h2/h3)
```

---

## Referencia rápida — tokens semánticos

| Token | Dark | Light | Uso |
|---|---|---|---|
| `--color-bg-base` | #120F1E | #FAF9FE | Fondo de página |
| `--color-bg-surface` | #1E1830 | #FFFFFF | Tarjetas |
| `--color-bg-elevated` | #252040 | #F3F0FD | Modales, dropdowns |
| `--color-border` | #2D2545 | #E2DBF5 | Bordes generales |
| `--color-primary` | #A78BFA | #7C3AED | Acciones, links, focus |
| `--color-accent` | #38BDF8 | #0284C7 | Calendario, Slack, info |
| `--color-text-primary` | #F0EEF8 | #1A1333 | Texto principal |
| `--color-text-secondary` | #9A8FB8 | #5B4F7A | Labels, metadata |
| `--color-success` | #34D399 | #059669 | Checks passing, OK |
| `--color-warning` | #FBBF24 | #D97706 | Prioridad media, atención |
| `--color-error` | #F87171 | #DC2626 | Checks fallando, alta prioridad |
| `--color-jira` | #A78BFA | #7C3AED | = primary |
| `--color-github` | #9A8FB8 | #5B4F7A | Neutro |
| `--color-calendar` | #38BDF8 | #0284C7 | = accent |
| `--color-slack` | #C084FC | #9333EA | Violeta más cálido |
