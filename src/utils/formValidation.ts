/**
 * 通用表单校验工具
 *
 * 统一处理必填项与输入去空格逻辑，减少页面内重复判断。
 */

export interface RequiredField {
  value: string;
  label?: string;
}

/**
 * 去除字符串首尾空格
 */
export function trimInputValue(value: string): string {
  return value.trim();
}

/**
 * 批量去除对象字段的首尾空格
 */
export function trimInputFields<T extends Record<string, string>>(fields: T): T {
  const entries = Object.entries(fields).map(([key, value]) => [key, value.trim()]);
  return Object.fromEntries(entries) as T;
}

/**
 * 校验必填字段
 *
 * @returns 错误消息，校验通过返回 null
 */
export function validateRequiredFields(
  fields: RequiredField[],
  fallbackMessage: string = '请填写所有字段'
): string | null {
  const missingField = fields.find((field) => !field.value.trim());
  if (!missingField) {
    return null;
  }

  if (missingField.label) {
    return `请输入${missingField.label}`;
  }

  return fallbackMessage;
}
