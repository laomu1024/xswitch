import {
  convertCaptureGroupSyntax,
  generateHeaderRules,
  DNR_RESOURCE_TYPES,
} from '../src/dnr-utils';

describe('convertCaptureGroupSyntax', () => {
  describe('$N → \\N 基本转换', () => {
    test('should convert $1 to \\1', () => {
      expect(convertCaptureGroupSyntax('http://localhost/$1')).toBe(
        'http://localhost/\\1'
      );
    });

    test('should convert $2 to \\2', () => {
      expect(convertCaptureGroupSyntax('http://localhost:3200/$2')).toBe(
        'http://localhost:3200/\\2'
      );
    });

    test('should convert multiple capture groups', () => {
      expect(convertCaptureGroupSyntax('$1example.com/path/$2')).toBe(
        '\\1example.com/path/\\2'
      );
    });

    test('should convert $0 (full match)', () => {
      expect(convertCaptureGroupSyntax('http://localhost/$0')).toBe(
        'http://localhost/\\0'
      );
    });

    test('should convert high-numbered groups like $10, $12', () => {
      expect(convertCaptureGroupSyntax('http://localhost/$10/$12')).toBe(
        'http://localhost/\\10/\\12'
      );
    });
  });

  describe('实际场景：CDN 代理到本地', () => {
    test('alicdn proxy rule with $2', () => {
      // 用户配置：
      // from: "https://dev.g.alicdn.com/fe-maas/maas-hap-fe/([0-9].?)+/(.*)"
      // to:   "http://localhost:3200/$2"
      const to = 'http://localhost:3200/$2';
      const result = convertCaptureGroupSyntax(to);
      expect(result).toBe('http://localhost:3200/\\2');
    });

    test('alicdn proxy rule with $1 and $2', () => {
      const to = 'http://localhost:3200/$1/$2';
      const result = convertCaptureGroupSyntax(to);
      expect(result).toBe('http://localhost:3200/\\1/\\2');
    });

    test('js/css redirect with version capture', () => {
      const to = 'http://localhost:8080/$1/$2.js';
      const result = convertCaptureGroupSyntax(to);
      expect(result).toBe('http://localhost:8080/\\1/\\2.js');
    });
  });

  describe('无需转换的情况', () => {
    test('should return string unchanged when no $N present', () => {
      expect(convertCaptureGroupSyntax('http://localhost:3000/api')).toBe(
        'http://localhost:3000/api'
      );
    });

    test('should not convert $ followed by non-digit', () => {
      expect(convertCaptureGroupSyntax('http://localhost/$abc')).toBe(
        'http://localhost/$abc'
      );
    });

    test('should handle empty string', () => {
      expect(convertCaptureGroupSyntax('')).toBe('');
    });
  });

  describe('边界情况', () => {
    test('should handle $$1 (literal $ before digit)', () => {
      // $$1 → $\1 (第一个$没有数字紧跟，第二个$1被转换)
      const result = convertCaptureGroupSyntax('$$1');
      expect(result).toBe('$\\1');
    });

    test('should handle $ at end of string', () => {
      expect(convertCaptureGroupSyntax('http://localhost/$')).toBe(
        'http://localhost/$'
      );
    });

    test('should handle consecutive $1$2$3', () => {
      expect(convertCaptureGroupSyntax('$1$2$3')).toBe('\\1\\2\\3');
    });
  });
});

describe('generateHeaderRules', () => {
  test('生成只修改请求头的规则，不重定向地址', () => {
    const rules = generateHeaderRules([
      ['https://api.example.com', { 'X-Debug': '1', 'X-Env': 'local' }],
    ]);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toEqual({
      id: 20000,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'X-Debug', operation: 'set', value: '1' },
          { header: 'X-Env', operation: 'set', value: 'local' },
        ],
      },
      condition: {
        regexFilter: 'https://api.example.com',
        resourceTypes: DNR_RESOURCE_TYPES,
      },
    });
    expect(rules[0].action).not.toHaveProperty('redirect');
  });

  test('规则 ID 从指定起始值递增', () => {
    const rules = generateHeaderRules(
      [
        ['a.com', { 'X-A': '1' }],
        ['b.com', { 'X-B': '2' }],
      ],
      30000
    );
    expect(rules.map((rule) => rule.id)).toEqual([30000, 30001]);
  });

  test('非字符串取值转换为字符串，跳过 null/undefined', () => {
    const rules = generateHeaderRules([
      [
        'a.com',
        // @ts-ignore 用户手写配置可能出现 null/undefined
        { 'X-Num': 1, 'X-Bool': true, 'X-Null': null, 'X-Undefined': undefined },
      ],
    ]);
    expect(rules[0].action.requestHeaders).toEqual([
      { header: 'X-Num', operation: 'set', value: '1' },
      { header: 'X-Bool', operation: 'set', value: 'true' },
    ]);
  });

  test('跳过空 header 或非法规则', () => {
    expect(
      generateHeaderRules([
        // @ts-ignore
        ['a.com', {}],
        // @ts-ignore
        ['a.com'],
        // @ts-ignore
        [null, { 'X-A': '1' }],
        // @ts-ignore
        'not-a-rule',
      ])
    ).toEqual([]);
  });

  test('空配置返回空数组', () => {
    // @ts-ignore
    expect(generateHeaderRules(undefined)).toEqual([]);
    expect(generateHeaderRules([])).toEqual([]);
  });
});
