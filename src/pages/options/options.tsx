import React, { useEffect, useState } from 'react';
import { Checkbox } from 'antd';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { getOptions, setOptions } from '../../chrome-storage';
import { Enabled } from '../../enums';
import './options.less';

export default function Options() {
  const [clearCacheEnabled, setClearCacheEnabled] = useState(false);
  const [corsEnabled, setCorsEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const options = await getOptions();
      if (!cancelled) {
        setClearCacheEnabled(options.clearCacheEnabled !== Enabled.NO);
        setCorsEnabled(options.corsEnabled !== Enabled.NO);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistOptions = (next: {
    clearCacheEnabled: boolean;
    corsEnabled: boolean;
  }) => {
    setOptions({
      clearCacheEnabled: next.clearCacheEnabled ? Enabled.YES : Enabled.NO,
      corsEnabled: next.corsEnabled ? Enabled.YES : Enabled.NO,
    });
  };

  const onClearCacheChange = (e: CheckboxChangeEvent) => {
    const next = {
      clearCacheEnabled: e.target.checked,
      corsEnabled,
    };
    setClearCacheEnabled(next.clearCacheEnabled);
    persistOptions(next);
  };

  const onCorsChange = (e: CheckboxChangeEvent) => {
    const next = {
      clearCacheEnabled,
      corsEnabled: e.target.checked,
    };
    setCorsEnabled(next.corsEnabled);
    persistOptions(next);
  };

  return (
    <div className="options-container">
      <ul>
        <li>
          <Checkbox checked={clearCacheEnabled} onChange={onClearCacheChange}>
            Enable Clear Cache
          </Checkbox>
        </li>
        <li>
          <Checkbox checked={corsEnabled} onChange={onCorsChange}>
            Enable CORS
          </Checkbox>
        </li>
      </ul>
    </div>
  );
}
