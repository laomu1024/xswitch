import { createRoot } from 'react-dom/client';
import XSwitch from './xswitch';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<XSwitch />);
}
