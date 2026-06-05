import { convertCaptureGroupSyntax } from '../src/dnr-utils';

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
