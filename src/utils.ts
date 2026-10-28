import { stripJsonComments } from './strip-json-comments';
import { REG, EMPTY_STRING } from './constants';

export function JSONC2JSON(jsonc: string): string {
  return stripJsonComments(jsonc)
    .replace(REG.WHITESPACE, EMPTY_STRING)
    .replace(REG.TRIM_JSON, ($0, $1, $2) => $2);
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
