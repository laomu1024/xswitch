/**
 * Chrome Extension API mock for local dev (non-extension browser).
 * Must load before application bundle.
 */
(function () {
  if (typeof window.chrome !== 'undefined' && window.chrome.storage) {
    return;
  }

  var STORAGE_PREFIX = 'xswitch-dev:';
  var changeListeners = [];

  function storageKey(area, key) {
    return STORAGE_PREFIX + area + ':' + key;
  }

  function createStorageArea(areaName) {
    return {
      get: function (keys, callback) {
        var result = {};

        if (keys === null || keys === undefined) {
          Object.keys(localStorage).forEach(function (fullKey) {
            var prefix = STORAGE_PREFIX + areaName + ':';
            if (fullKey.indexOf(prefix) === 0) {
              var key = fullKey.slice(prefix.length);
              try {
                result[key] = JSON.parse(localStorage.getItem(fullKey));
              } catch (e) {
                result[key] = localStorage.getItem(fullKey);
              }
            }
          });
          callback(result);
          return;
        }

        if (typeof keys === 'string') {
          keys = [keys];
        }

        if (Array.isArray(keys)) {
          keys.forEach(function (key) {
            var stored = localStorage.getItem(storageKey(areaName, key));
            if (stored != null) {
              try {
                result[key] = JSON.parse(stored);
              } catch (e) {
                result[key] = stored;
              }
            }
          });
          callback(result);
          return;
        }

        Object.keys(keys).forEach(function (key) {
          var stored = localStorage.getItem(storageKey(areaName, key));
          if (stored != null) {
            try {
              result[key] = JSON.parse(stored);
            } catch (e) {
              result[key] = stored;
            }
          } else {
            result[key] = keys[key];
          }
        });
        callback(result);
      },
      set: function (items, callback) {
        var area = areaName;
        Object.keys(items).forEach(function (key) {
          localStorage.setItem(storageKey(area, key), JSON.stringify(items[key]));
        });
        if (typeof callback === 'function') {
          callback();
        }
        changeListeners.forEach(function (listener) {
          try {
            listener(items, area);
          } catch (e) {
            console.warn('[chrome-mock] onChanged listener error', e);
          }
        });
      },
    };
  }

  window.chrome = {
    storage: {
      local: createStorageArea('local'),
      sync: createStorageArea('sync'),
      onChanged: {
        addListener: function (listener) {
          changeListeners.push(listener);
        },
        removeListener: function (listener) {
          changeListeners = changeListeners.filter(function (fn) {
            return fn !== listener;
          });
        },
      },
    },
    tabs: {
      create: function (options, callback) {
        window.open(options.url, '_blank');
        if (typeof callback === 'function') {
          callback({});
        }
      },
    },
    extension: {
      getURL: function (path) {
        return '/' + path;
      },
      getBackgroundPage: function () {
        return {
          _forward: {
            urls: [],
          },
        };
      },
    },
  };
})();
