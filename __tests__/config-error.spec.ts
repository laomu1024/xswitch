import { getConfigError } from '../src/utils';

describe('getConfigError', () => {
  test('accepts JSONC with comments and trailing commas', () => {
    const config = `{
      // 转发规则
      "proxy": [
        ["a.com", "b.com"],
      ],
    }`;
    expect(getConfigError(config)).toBe('');
  });

  test('reports JSON syntax errors', () => {
    expect(getConfigError('{ "proxy": [ }')).toContain('JSON 格式错误');
  });

  test('rejects non-object top level', () => {
    expect(getConfigError('[]')).toBe('配置必须是 JSON 对象');
    expect(getConfigError('"proxy"')).toBe('配置必须是 JSON 对象');
  });

  test('rejects empty content', () => {
    expect(getConfigError('')).toContain('JSON 格式错误');
  });
});
