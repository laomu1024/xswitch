/**
 * 将用户配置中的 $N 捕获组引用转换为 DNR regexSubstitution 所需的 \N 语法。
 * 例如: "http://localhost:3200/$2" → "http://localhost:3200/\2"
 */
export function convertCaptureGroupSyntax(to: string): string {
  return to.replace(/\$(\d+)/g, '\\$1');
}
