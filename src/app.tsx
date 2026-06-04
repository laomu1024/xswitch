import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import XSwitch from './pages/xswitch/xswitch';
import Options from './pages/options/options';
import DevAgentation from './DevAgentation';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<XSwitch />} />
          <Route path="/options.html" element={<Options />} />
        </Routes>
      </BrowserRouter>
      <DevAgentation />
    </>
  );
}
