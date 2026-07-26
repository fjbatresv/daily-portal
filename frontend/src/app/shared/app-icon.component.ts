import { Component, computed, input } from '@angular/core';

/**
 * Names in the local SVG icon registry.
 */
type IconName =
  | 'bell'
  | 'calendar'
  | 'chevron-down'
  | 'chevron-right'
  | 'github'
  | 'loader'
  | 'message'
  | 'moon'
  | 'plus'
  | 'refresh'
  | 'sun'
  | 'ticket'
  | 'trending-up'
  | 'video';

/**
 * SVG path data keyed by the icon names used in dashboard controls.
 */
const iconPaths: Record<IconName, string> = {
  bell: 'M10 5a2 2 0 0 1 4 0 7 7 0 0 1 4 6v3l2 2H4l2-2v-3a7 7 0 0 1 4-6Zm0 14a2 2 0 0 0 4 0',
  calendar:
    'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-right': 'm9 18 6-6-6-6',
  github:
    'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5a4.5 4.5 0 0 0-1.2-3.1 4.2 4.2 0 0 0-.1-3.1s-1-.3-3.3 1.2a11.5 11.5 0 0 0-6 0C7.1 2.5 6.1 2.8 6.1 2.8A4.2 4.2 0 0 0 6 5.9 4.5 4.5 0 0 0 4.8 9c0 3.5 3 5.5 6 5.5-.5.5-.8 1.2-.9 2.1-.8.4-2.8 1-4-1.1 0 0-.8-1.5-2.2-1.6 0 0-1.4 0-.1.9 0 0 .9.4 1.5 2 0 0 .8 2.5 4.8 1.7V22',
  loader: 'M21 12a9 9 0 1 1-6.2-8.6',
  message: 'M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z',
  moon: 'M20.9 13.5A8 8 0 0 1 10.5 3.1 7 7 0 1 0 20.9 13.5Z',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M21 12a9 9 0 0 1-15.4 6.4L3 16M3 21v-5h5M3 12A9 9 0 0 1 18.4 5.6L21 8M21 3v5h-5',
  sun: 'M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0Z',
  ticket:
    'M2 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 0 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2ZM13 5v2M13 17v2M13 11v2',
  'trending-up': 'M3 17 9 11l4 4 8-8M14 7h7v7',
  video:
    'M16 13 22 17V7l-6 4ZM2 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z',
};

/**
 * Renders the small SVG icon set used by the dashboard without a webfont dependency.
 */
@Component({
  selector: 'app-icon',
  template: `
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      viewBox="0 0 24 24"
      [class]="iconClass()"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
})
export class AppIconComponent {
  /**
   * Icon name to render from the local path registry.
   */
  readonly name = input.required<IconName>();

  /**
   * CSS classes applied to the SVG element.
   */
  readonly className = input('h-4 w-4');

  /**
   * Whether the icon should use the shared spin animation.
   */
  readonly spin = input(false);

  /**
   * Final SVG class string including optional animation.
   */
  readonly iconClass = computed(() =>
    `${this.className()} ${this.spin() ? 'animate-spin' : ''}`.trim(),
  );

  /**
   * Path data resolved for the selected icon.
   */
  readonly path = computed(() => iconPaths[this.name()]);
}
