import {
  DEFAULT_DATA,
  LANGUAGE_JSON,
  DEFAULT_FONT_FAMILY,
  SHOW_FOLDING_CONTROLS,
} from './constants';

export function getEditorConfig(value: string): object {
  return {
    value: value || DEFAULT_DATA,
    language: LANGUAGE_JSON,

    minimap: {
      enabled: false,
    },
    automaticLayout: true,
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: 13,

    contextmenu: true,
    scrollBeyondLastLine: false,
    folding: true,
    showFoldingControls: SHOW_FOLDING_CONTROLS,
    wordWrap: 'on',
    wrappingStrategy: 'simple',
    wordWrapBreakAfterCharacters:
      ' \t})]?|/&.,;¦`~!@#$%^*-=+:<>"\'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    wordWrapBreakBeforeCharacters: '([{',

    useTabStops: true,
    wordBasedSuggestions: true,
    quickSuggestions: true,
    suggestOnTriggerCharacters: true,
  };
}
