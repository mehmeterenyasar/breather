import { render } from 'preact';
import '@/styles/tokens.css';
import '@/styles/fonts.css';
import '@/styles/base.css';
import '../popup/popup.css';
import './sidepanel.css';
import { initI18n } from '@/i18n/init';
import { App } from '../popup/App';

/**
 * The side panel is the popup: same component, same state, same styles. All that
 * differs is the width and height, in sidepanel.css. Two timer interfaces to
 * keep in step would be one too many.
 */
const root = document.getElementById('app');

void initI18n().then(() => {
  if (root) render(<App />, root);
});
