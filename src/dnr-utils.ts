/**
 * 将用户配置中的 $N 捕获组引用转换为 DNR regexSubstitution 所需的 \N 语法。
 * 例如: "http://localhost:3200/$2" → "http://localhost:3200/\2"
 */
export function convertCaptureGroupSyntax(to: string): string {
  return to.replace(/\$(\d+)/g, '\\$1');
}

export const DNR_RESOURCE_TYPES = [
  'main_frame',
  'sub_frame',
  'xmlhttprequest',
  'script',
  'stylesheet',
  'image',
  'font',
  'other',
];

export type RequestHeaderMap = Record<string, string | number | boolean>;

/**
 * 生成 DNR 请求头规则：只修改请求头，不改变请求地址。
 * 配置格式: ["<regexFilter>", { "<header-name>": "<value>" }]
 */
export function generateHeaderRules(
  headerRules: Array<[string, RequestHeaderMap]>,
  ruleIdStart = 20000
) {
  const rules: any[] = [];
  let id = ruleIdStart;
  for (const rule of headerRules || []) {
    if (!Array.isArray(rule)) {
      continue;
    }
    const [pattern, headers] = rule;
    if (
      !pattern ||
      !headers ||
      typeof headers !== 'object' ||
      Array.isArray(headers)
    ) {
      continue;
    }
    const requestHeaders = Object.keys(headers)
      .filter((name) => headers[name] !== null && headers[name] !== undefined)
      .map((name) => ({
        header: name,
        operation: 'set',
        value: String(headers[name]),
      }));
    if (!requestHeaders.length) {
      continue;
    }
    rules.push({
      id: id++,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders,
      },
      condition: {
        regexFilter: pattern,
        resourceTypes: DNR_RESOURCE_TYPES,
      },
    });
  }
  return rules;
}
