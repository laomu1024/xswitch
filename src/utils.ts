import { stripJsonComments } from './strip-json-comments';

/**
 * 去掉注释与多余逗号，压缩为合法 JSON 文本。
 * 逐字符处理并跳过字符串内容，避免误删 URL、请求头值里的逗号和空格。
 */
export function JSONC2JSON(jsonc: string): string {
  const source = stripJsonComments(jsonc || '');
  let result = '';
  let insideString = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (insideString) {
      result += char;
      if (char === '\\') {
        result += source[i + 1] || '';
        i++;
      } else if (char === '"') {
        insideString = false;
      }
      continue;
    }

    if (char === '"') {
      insideString = true;
      result += char;
      continue;
    }

    if (/\s/.test(char)) {
      continue;
    }

    if (char === ',') {
      if (result.endsWith(',')) {
        continue;
      }
      // 只删除 ] 或 } 前的尾逗号，保留 [, {] 之间的正常逗号
      if (/^[,\s]*[\]}]/.test(source.slice(i + 1))) {
        continue;
      }
      result += char;
      continue;
    }

    result += char;
  }

  return result;
}

export function JSON_Parse(json: string, cb: (error: object | boolean, json?: object) => void): void {
  try {
    cb(false, JSON.parse(json));
  } catch (e) {
    cb(e);
  }
}

/**
 * 校验一段 JSONC 规则文本，返回空字符串表示合法，否则返回给用户看的错误信息。
 * 解析流程与保存时一致，保证标记结果与实际生效状态对得上。
 */
export function getConfigError(jsonc: string): string {
  let error: any = null;
  let parsed: any;
  JSON_Parse(JSONC2JSON(jsonc || ''), (err, json) => {
    error = err;
    parsed = json;
  });
  if (error) {
    return `JSON 格式错误：${(error as Error).message || error}`;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return '配置必须是 JSON 对象';
  }
  return '';
}
