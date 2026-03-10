/**
 * 小票模版转换配置
 */
export interface ConvertConfig {
  type: string;
  template: unknown;
  data: unknown;
  langKey?: string;
}

/**
 * 转换选项
 */
export interface ConvertOptions {
  [key: string]: unknown;
}

/**
 * 推送打印数据文件到 Android 设备
 * @param printDataPath - printData.json 文件路径
 */
export function sendToPrinter(printDataPath: string): void;

/**
 * 将模版和数据转换为打印指令
 * @param config - 转换配置
 * @param options - 可选配置
 */
export function convertTemplate(
  config: ConvertConfig,
  options?: ConvertOptions
): Promise<unknown>;

/**
 * 小票打印：转换模版并写入 output 目录、推送到设备
 * @param template - 小票模版（小票编辑器的产物）
 * @param data - 业务数据
 * @param options - 可选配置
 */
export function print(
  template: unknown,
  data: unknown,
  options?: ConvertOptions
): Promise<void>;
