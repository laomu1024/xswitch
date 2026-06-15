import { createRoot } from 'react-dom/client';
import XSwitch from './pages/xswitch/xswitch';
import DevAgentation from './DevAgentation';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <>
      <XSwitch />
      <DevAgentation />
    </>
  );
}
