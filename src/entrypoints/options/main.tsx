import { render } from 'preact';
import '@/styles/tokens.css';
import '@/styles/fonts.css';
import '@/styles/base.css';
import './options.css';
import './forms.css';
import { initI18n } from '@/i18n/init';
import { App } from './App';

const root = document.getElementById('app');

// Metinler cizimden once hazir olmali: `i18n.t()` es zamanli calisir.
void initI18n().then(() => {
  if (root) render(<App />, root);
});
