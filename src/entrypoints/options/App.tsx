import { i18n } from '@/i18n';
import { useEffect, useState } from 'preact/hooks';
import { useLanguage } from '@/hooks/useLanguage';
import { useSettings, useTheme } from '@/hooks/useSettings';
import { useSettingsWriter } from '@/hooks/useSettingsWriter';
import { DataPanel } from './DataPanel';
import { StatsPanel } from './StatsPanel';
import { Welcome } from './Welcome';
import { BreakSettings } from './panels/BreakSettings';
import { DndSettings } from './panels/DndSettings';
import {
  AboutPanel,
  AppearanceSettings,
  GoalSettings,
  SoundSettings,
} from './panels/GeneralSettings';
import { TimerSettings } from './panels/TimerSettings';

/**
 * The settings page.
 *
 * A menu down the left and one column of content. Common settings at the top of
 * each section, the rest behind "Advanced". No save button: changes are written
 * as they are made, with a brief "Saved" in the header.
 *
 * The current section lives in the URL hash, which is also how the welcome flow
 * is reached on first install (`#/welcome`).
 */

const SECTIONS = [
  'stats',
  'timer',
  'breaks',
  'dnd',
  'goals',
  'appearance',
  'sound',
  'data',
  'about',
] as const;

type Section = (typeof SECTIONS)[number];

const NAV_KEY = {
  stats: 'options.nav.stats',
  timer: 'settings.timer.title',
  breaks: 'settings.breaks.title',
  dnd: 'settings.dnd.title',
  goals: 'settings.goals.title',
  appearance: 'settings.appearance.title',
  sound: 'settings.sound.title',
  data: 'options.nav.data',
  about: 'settings.about.title',
} as const satisfies Record<Section, string>;

function routeFromHash(): Section | 'welcome' {
  const value = window.location.hash.replace('#/', '');
  if (value === 'welcome') return 'welcome';
  return SECTIONS.includes(value as Section) ? (value as Section) : 'stats';
}

export function App() {
  const settings = useSettings();
  const { write, saved } = useSettingsWriter();
  const [route, setRoute] = useState<Section | 'welcome'>(routeFromHash);

  useTheme(settings);
  useLanguage();

  useEffect(() => {
    document.title = i18n.t('extName');
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (!settings) return <div class="options" aria-busy="true" />;

  if (route === 'welcome') {
    return (
      <Welcome
        settings={settings}
        write={write}
        onFinish={() => {
          write({ onboardingDone: true });
          window.location.hash = '#/timer';
        }}
      />
    );
  }

  return (
    <div class="options">
      <nav class="nav" aria-label={i18n.t('options.title')}>
        <span class="nav__brand">{i18n.t('extName')}</span>
        <ul class="nav__list">
          {SECTIONS.map((item) => (
            <li key={item}>
              <a
                class={item === route ? 'nav__item nav__item--on' : 'nav__item'}
                href={`#/${item}`}
                aria-current={item === route ? 'page' : undefined}
              >
                {i18n.t(NAV_KEY[item])}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main class="panel">
        {route === 'stats' ? (
          <StatsPanel settings={settings} />
        ) : route === 'data' ? (
          <DataPanel settings={settings} />
        ) : (
          <section class="panel__body">
            <header class="panel__head">
              <h1 class="panel__title">{i18n.t(NAV_KEY[route])}</h1>
              <span class={saved ? 'savedpill savedpill--on' : 'savedpill'} role="status">
                {saved ? i18n.t('settings.savedPill') : ''}
              </span>
            </header>

            {route === 'timer' && <TimerSettings settings={settings} write={write} />}
            {route === 'breaks' && <BreakSettings settings={settings} write={write} />}
            {route === 'dnd' && <DndSettings settings={settings} write={write} />}
            {route === 'goals' && <GoalSettings settings={settings} write={write} />}
            {route === 'appearance' && <AppearanceSettings settings={settings} write={write} />}
            {route === 'sound' && <SoundSettings settings={settings} write={write} />}
            {route === 'about' && <AboutPanel />}
          </section>
        )}
      </main>
    </div>
  );
}
