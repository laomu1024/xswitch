import { createRoot } from 'react-dom/client';
import Options from './options';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<Options />);
}
