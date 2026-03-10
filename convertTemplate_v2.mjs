// ==================== 主导出函数 ====================
/**
  * - 主导出函数 convertTemplate()
  *     ↓
  * - 上下文构建器 ConversionContext
  *     ↓
  * - 主转换器 TemplateConverter
  *     ↓
  * - 组件转换器 ComponentConverter + 列处理器 ColumnProcessor
  *     ↓
  * - 工具类 TemplateUtils + 条件检查器 PrintConditionChecker + 样式处理器 StyleProcessor
 */
export function convertTemplate(config, options = {}) {
    /**
     * 模板转换器 - 将模板和数据转换为打印指令
     * @version 2.2.0
     */
    // ==================== 常量配置 ====================
    const VERSION = "2.2.0";

    // ========== 字体大小配置（唯一维护点） ==========
    const DEFAULT_FONT_CONFIG = {
        small: 20,
        middle: 24,
        large: 28,
        extraLarge: 32,
        xxl: 36,
        xxxl: 64,
    };

    // 从 DEFAULT_FONT_CONFIG 自动生成缩写映射
    const FONT_SIZE_MAP = {
        s: "small",
        m: "middle",
        l: "large",
        xl: "extraLarge",
        xxl: "xxl",
        xxxl: "xxxl",
    };

    const DIVIDER_STYLE_MAP = new Map([
        [0, ""], // 空白
        [1, "stroke"], // 实线
        [2, "dot"], // 虚线
    ]);

    class TemplateUtils {
        /**
         * 获取字体大小配置
         */
        static getFontSize(fontCfg, sizeKey) {
            const resolvedKey = FONT_SIZE_MAP[sizeKey] || "middle";
            return fontCfg[resolvedKey] || DEFAULT_FONT_CONFIG[resolvedKey];
        }

        /**
         * 解析模板变量和国际化
         */
        static parseTemplateData(text, lang, obj) {
            if (!text || typeof text !== "string") return "";
            if (!/\{\{/.test(text)) return text;

            let result = text;

            // 处理数据变量 {{variable}} 或 {{obj.key}}
            const dataKeys = result.match(/{{[a-zA-Z0-9\.]+}}/g);
            if (dataKeys) {
                dataKeys.forEach((key) => {
                    const cleanKey = key.replace(/^\{\{|\}\}$/g, "");
                    const value = this.getNestedValue(obj, cleanKey);
                    const displayValue = (value != null && ["string", "number"].includes(typeof value)) ? value : "";
                    result = result.replaceAll(key, displayValue);
                });
            }

            // 处理国际化变量 {{key|l}}
            const langKeys = result.match(/{{[a-zA-Z0-9\-]+\|l}}/g);
            if (langKeys) {
                langKeys.forEach((key) => {
                    const cleanKey = key.replace(/^\{\{|\|l\}\}$/g, "");
                    const value = lang?.[cleanKey];
                    const displayValue = (value != null && ["string", "number"].includes(typeof value)) ? value : "";
                    result = result.replaceAll(key, displayValue);
                });
            }

            return result;
        }

        /**
         * 获取嵌套对象值 (支持 obj.key.subkey)
         */
        static getNestedValue(obj, keyPath) {
            if (typeof obj === "string") return obj;
            return keyPath.split(".").reduce((current, key) => current?.[key], obj);
        }

        /**
         * 检查文本是否以 "- " 开头 (用于判断是否加粗)
         */
        static shouldBold(bold, obj, key, langObj) {
            return !!bold;
        }

        /**
         * 生成缩进字符
         */
        static generateIndent(count, index, columnIndent) {
            if (index !== 0) return "";
            const chars = "----------------".substring(0, count);
            return columnIndent !== 2 ? chars.replace(/\-/g, "  ") : chars;
        }
    }

    // ==================== 打印条件检查器 ====================
    class PrintConditionChecker {
        /**
         * 检查组件是否应该打印
         */
        static shouldPrint(item, data) {
            // 检查显示状态
            if (item.show === false) return false;

            // 检查隐藏字段条件
            if (!this.checkHideFields(item, data)) return false;

            // 检查排除字段条件
            if (!this.checkExcludeFields(item, data)) return false;

            return true;
        }

        /**
         * 检查隐藏字段条件
         * hideFields: 当这些字段有值时隐藏组件
         */
        static checkHideFields(item, data) {
            if (!item.hideFields) return true;

            const hasVisibleData = item.hideFields.some(key => {
                const value = data[key];
                return value && (!Array.isArray(value) || value.length > 0);
            });

            return hasVisibleData; // 有数据时才显示
        }

        /**
         * 检查排除字段条件
         * excludeFields: 当这些字段有值时排除组件
         */
        static checkExcludeFields(item, data) {
            if (!item.excludeFields) return true;

            const shouldExclude = item.excludeFields.some(key => {
                const value = data[key];
                return value && (!Array.isArray(value) || value.length > 0);
            });

            return !shouldExclude; // 不需要排除
        }
    }

    // ==================== 样式处理器 ====================
    class StyleProcessor {
        constructor(fontConfig) {
            // 使用传入的配置或默认配置，避免重复定义字体大小
            this.fontConfig = fontConfig;
        }

        /**
         * 处理字体大小
         */
        processSize(config, sizeKey) {
            const key = sizeKey === "size" ? config[sizeKey] : sizeKey;
            let size = key;
            
            if (typeof key === "string") {
                // 先从传入的fontConfig查找，再从DEFAULT_FONT_CONFIG查找
                const resolvedKey = FONT_SIZE_MAP[key] || key;
                size = this.fontConfig[resolvedKey] || DEFAULT_FONT_CONFIG[resolvedKey];
            }
            
            return {
                ...config,
                size: size || 24,
            };
        }

        /**
         * 处理对齐方式
         */
        processAlign(align) {
            return align !== undefined ? align : 0;
        }

        /**
         * 处理边距
         */
        processMargins(item) {
            const margins = {};

            if (item.type === "divider") {
                margins.marginTop = item.upline ?? 3;
                margins.marginBottom = item.bottomBlank ?? 3;
            } else {
                if (item.upline !== undefined) margins.marginTop = item.upline;
                if (item.bottomBlank !== undefined) margins.marginBottom = item.bottomBlank;
            }

            return margins;
        }
    }

    // ==================== 组件转换器 ====================
    class ComponentConverter {
        constructor(context) {
            this.context = context;
            this.styleProcessor = new StyleProcessor(context.fontConfig);
        }

        /**
         * 转换文本组件
         */
        convertText(param, obj, lang, options = {}) {
            const { isColumnChild = false, bold, size, templatePath } = options;
            const { text, ...other } = param;

            const finalBold = bold ?? other.bold;
            const parsedText = TemplateUtils.parseTemplateData(text, lang, obj || {});

            let params = {
                value: parsedText,
                ...other,
                ...this.styleProcessor.processSize(other, size ?? "size"),
                align: this.styleProcessor.processAlign(other.align),
                bold: TemplateUtils.shouldBold(finalBold, obj, "name", lang),
            };

            // 添加UUID映射（如果启用）
            let templateUUID = null;
            if (templatePath) {
                const uuid = this.context.createUUIDMapping(templatePath, param, obj);
                if (uuid) {
                    params.templateUUID = uuid;
                    templateUUID = uuid;
                }
            }

            // 对于 printPic 模式或列子组件，使用扁平格式
            if (!isColumnChild && this.context.type !== "printPic") {
                params = { params };
            }

            const result = [{
                type: "text",
                ...params,
            }];

            // 如果有UUID且params被包装了，将templateUUID提升到顶层
            if (templateUUID && result[0].params) {
                result[0].templateUUID = templateUUID;
            }

            return result;
        }

        /**
         * 转换图片组件
         */
        convertImage(param, obj, lang, isColumnChild = false, options = {}) {
            const { data: imageData, ...other } = param;
            const { templatePath } = options;

            // 当未开启UUID且数据为空时，返回空数组
            if (!imageData && !this.context.enableUUID) {
                return [];
            }

            const processedImage = TemplateUtils.parseTemplateData(imageData, lang, obj);

            let params = {
                value: processedImage?.replace(/^data:image\/[a-zA-Z0-9]+;base64,/, "") || "",
                align: other.align,
                ...(other.maxWidth && { maxWidth: other.maxWidth }),
            };

            // 添加UUID映射（如果启用）
            let templateUUID = null;
            if (templatePath) {
                const uuid = this.context.createUUIDMapping(templatePath, param, obj);
                if (uuid) {
                    params.templateUUID = uuid;
                    templateUUID = uuid;
                }
            }

            // 对于 printPic 模式或列子组件，使用扁平格式
            if (!isColumnChild && this.context.type !== "printPic") {
                params = { params };
            }

            const result = [{
                type: "image",
                ...params,
            }];

            // 如果有UUID且params被包装了，将templateUUID提升到顶层
            if (templateUUID && result[0].params) {
                result[0].templateUUID = templateUUID;
            }

            return result;
        }

        /**
         * 转换静态图片组件
         */
        convertStaticImage(param, obj, lang, options = {}) {
            const { url, ...other } = param;
            const staticImageUrl = TemplateUtils.parseTemplateData(url, lang, obj);

            return this.convertImage({
                data: staticImageUrl,
                align: other.align,
            }, obj, lang, false, options);
        }

        /**
         * 转换分割线组件
         */
        convertDivider(param, obj = null, options = {}) {
            const { templatePath } = options;
            const isColumnChild = options.isColumnChild || false;

            let params = {
                value: DIVIDER_STYLE_MAP.get(param.style) || "",
                marginTop: param?.marginTop ?? 3,
                marginBottom: param?.marginBottom ?? 3,
            };

            // 添加UUID映射（如果启用）
            let templateUUID = null;
            if (templatePath) {
                const uuid = this.context.createUUIDMapping(templatePath, param, obj);
                if (uuid) {
                    params.templateUUID = uuid;
                    templateUUID = uuid;
                }
            }

            // 对于 printPic 模式或列子组件，使用扁平格式
            if (!isColumnChild && this.context.type !== "printPic") {
                params = { params };
            }

            const result = [{
                type: "dividing",
                ...params,
            }];

            // 如果有UUID且params被包装了，将templateUUID提升到顶层
            if (templateUUID && result[0].params) {
                result[0].templateUUID = templateUUID;
            }

            return result;
        }

        /**
         * 转换二维码组件
         */
        convertQrCode(param, obj, lang, options = {}) {
            const { code, ...other } = param;
            const processedCode = TemplateUtils.parseTemplateData(code, lang, obj);

            // 直接是base64图片
            if (processedCode.match(/^data:image\/png;base64,/)) {
                return this.convertImage({
                    data: processedCode,
                    align: other.align,
                }, obj, lang, false, options);
            }

            // 处理带图标的二维码
            // if (other.iconCfg?.icon) {
            //     const { icon, ...iconConfig } = other.iconCfg;
            //     // 使用外部的二维码生成器
            //     const qrCodeWithIcon = await this.context.qrCodeGenerator?.(processedCode, {
            //         icon: TemplateUtils.parseTemplateData(icon, lang, obj),
            //         imageScale: 20,
            //         backgroundColor: "white",
            //         codeColor: "black",
            //         ...iconConfig,
            //     });

            //     return this.convertImage({
            //         data: qrCodeWithIcon,
            //         align: other.align,
            //     }, obj, lang, false, options);
            // }

            // 图片模式
            if (this.context.type === "printPic") {
                return [{
                    type: "qr",
                    value: processedCode,
                    align: other.align,
                }];
            }

            return [{
                type: "qrcode",
                params: {
                    ...other,
                    value: processedCode,
                },
            }];
        }

        /**
         * 转换条形码组件
         */
        convertBarCode(param, obj, lang, options = {}) {
            const { code, ...other } = param;
            const processedCode = TemplateUtils.parseTemplateData(code, lang, obj);

            // 图片模式
            if (this.context.type === "printPic") {
                return [{
                    type: "barcode",
                    value: processedCode,
                    height: 10, // 写死10mm，与transferPicTemplate保持一致
                    format: param.symbology,
                    ...other,
                }];
            }

            return [{
                type: "barcode",
                params: {
                    ...other,
                    value: processedCode,
                    format: param.symbology,
                },
            }];
        }
    }

    // ==================== 列处理器 ====================
    class ColumnProcessor {
        constructor(context, componentConverter) {
            this.context = context;
            this.converter = componentConverter;
        }

        /**
         * 转换普通列组件
         */
        convertColumns(param, obj, lang, options = {}) {
            const {
                columns,
                level,
                dataKey,
                titleBold,
                bodyBold,
                headerSize,
                bodySize,
                fields,
            } = param;

            const result = [];

            // 处理表头
            if (this.hasColumnTitles(columns)) {
                result.push(this.createColumnHeader(columns, obj, lang, titleBold, headerSize, options, dataKey));
            }

            // 处理数据行
            if (dataKey && this.context.data[dataKey] && Array.isArray(this.context.data[dataKey])) {
                this.context.data[dataKey].forEach((itemData, index) => {
                    const childOptions = {
                        ...options,
                        templatePath: options.templatePath ? `${options.templatePath}.data[${index}]` : `data[${index}]`
                    };
                    result.push(...this.createColumnRows(columns, itemData, lang, level, 0, bodyBold, bodySize, fields, childOptions, dataKey));
                });
            } else {
                result.push(...this.createColumnRows(columns, obj, lang, level, 0, bodyBold, bodySize, fields, options, dataKey));
            }

            return result;
        }

        /**
         * 转换嵌套列组件
         */
        convertColumnInColumn(param, obj, lang, options = {}) {
            if (!param?.columns || !Array.isArray(param.columns)) {
                return [];
            }

            const processedItems = this.processNestedColumnItems(param.columns, obj, lang, options);

            return [{
                type: "columns",
                params: {
                    items: processedItems,
                },
                // 为整个嵌套列组件生成UUID
                ...(this.context.enableUUID && options.templatePath ? {
                    templateUUID: this.context.createUUIDMapping(options.templatePath, param, obj)
                } : {})
            }];
        }

        /**
         * 检查是否有列标题
         */
        hasColumnTitles(columns) {
            return columns.some(item => item.title != null);
        }

        /**
         * 创建列标题
         */
        createColumnHeader(columns, obj, lang, titleBold, headerSize, options = {}, dataKey = null) {
            const titles = columns
                .filter(item => item.show !== false)
                .map(item => {
                    const { title, ...other } = item;
                    return {
                        ...this.converter.styleProcessor.processSize(other, headerSize),
                        text: title,
                    };
                });

            return {
                type: "columns",
                params: {
                    items: titles.reduce((items, title, index) => {
                        const childOptions = {
                            isColumnChild: true,
                            bold: titleBold,
                            templatePath: options.templatePath ? `${options.templatePath}.header[${index}]` : `header[${index}]`
                        };
                        items.push(...this.converter.convertText(title, obj, lang, childOptions));
                        return items;
                    }, []),
                },
                // 为标题行生成UUID，传递dataKey作为namespace
                ...(this.context.enableUUID && options.templatePath ? {
                    templateUUID: this.context.createUUIDMapping(`${options.templatePath}.header`, { titles }, obj, dataKey)
                } : {})
            };
        }

        /**
         * 创建列数据行
         */
        createColumnRows(columns, obj, lang, level, indentLevel, bold, sizeKey, fields = null, options = {}, dataKey = null) {
            // 检查当前行数据是否有匹配的field配置
            const field = fields?.find(f => f?.dataId === obj?.dataId);
            const currentBold = field?.param?.bold ?? bold;
            const currentSizeKey = field?.param?.size ?? sizeKey;

            // 过滤显示的列
            const visibleColumns = columns.filter(item => item.show !== false);

            // 检查每列的值并统计有值的列数
            const columnsWithValues = visibleColumns.map(item => {
                const parsedText = TemplateUtils.parseTemplateData(item.text, lang, obj);
                const hasValue = parsedText && parsedText.trim() !== '';
                return {
                    ...item,
                    parsedText,
                    hasValue
                };
            });

            const columnsWithValuesCount = columnsWithValues.filter(col => col.hasValue).length;

            // 如果只有1个字段有值，动态调整权重
            let adjustedColumns = columnsWithValues;
            if (columnsWithValuesCount === 1) {
                // 计算全部字段的权重总和
                const totalWeight = columnsWithValues.reduce((sum, col) => sum + (col.weight || 1), 0);

                adjustedColumns = columnsWithValues.map(col => ({
                    ...col,
                    weight: col.hasValue ? totalWeight : 0
                }));
            }

            const result = [{
                type: "columns",
                params: {
                    items: adjustedColumns.reduce((items, item, index) => {
                        const indent = TemplateUtils.generateIndent(indentLevel, index, this.context.columnIndent);
                        const childOptions = {
                            isColumnChild: true,
                            bold: currentBold,
                            size: currentSizeKey,
                            templatePath: options.templatePath ? `${options.templatePath}.row[${index}]` : `row[${index}]`
                        };
                        items.push(...this.converter.convertText(
                            {
                                ...item,
                                text: indent + item.parsedText,
                                weight: item.weight // 使用调整后的权重
                            },
                            obj,
                            lang,
                            childOptions
                        ));
                        return items;
                    }, []),
                },
                // 为数据行生成UUID，传递dataKey作为namespace
                ...(this.context.enableUUID && options.templatePath ? {
                    templateUUID: this.context.createUUIDMapping(`${options.templatePath}.row`, adjustedColumns, obj, dataKey)
                } : {})
            }];

            // 处理嵌套层级
            if (level && Array.isArray(obj[level])) {
                obj[level].forEach((childObj, childIndex) => {
                    const childOptions = {
                        ...options,
                        templatePath: options.templatePath ? `${options.templatePath}.children[${childIndex}]` : `children[${childIndex}]`
                    };
                    result.push(...this.createColumnRows(columns, childObj, lang, level, indentLevel + 1, bold, sizeKey, fields, childOptions, dataKey));
                });
            }

            return result;
        }

        /**
         * 处理嵌套列项目
         */
        processNestedColumnItems(items, obj, lang, options = {}) {
            const result = [];

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (!PrintConditionChecker.shouldPrint(item, obj)) continue;

                const processedItem = this.applyMargins(item);
                const childOptions = {
                    ...options,
                    templatePath: options.templatePath ? `${options.templatePath}.items[${i}]` : `items[${i}]`
                };

                switch (processedItem.type) {
                    case "text":
                        result.push(...this.converter.convertText(processedItem.param, obj, lang, {
                            isColumnChild: true,
                            templatePath: childOptions.templatePath
                        }));
                        break;
                    case "image":
                        result.push(...this.converter.convertImage(processedItem.param, obj, lang, true, childOptions));
                        break;
                    case "staticImage":
                        result.push(...this.converter.convertStaticImage(processedItem.param, obj, lang, childOptions));
                        break;
                    case "divider":
                        result.push(...this.converter.convertDivider(processedItem.param, obj, {
                            isColumnChild: true,
                            templatePath: childOptions.templatePath
                        }));
                        break;
                    case "row":
                        result.push(this.processRowType(processedItem, obj, lang, childOptions));
                        break;
                    case "column":
                        result.push(...this.convertColumns(processedItem.param, obj, lang, childOptions));
                        break;
                    default:
                        console.warn(`Unknown item type in columnInColumn: ${processedItem.type}`);
                }
            }

            return result;
        }

        /**
         * 处理行类型
         */
        processRowType(item, obj, lang, options = {}) {
            if (!item.param?.rows || !Array.isArray(item.param.rows)) {
                return null;
            }

            const rowItems = item.param.rows.map((rowItem, rowIndex) => {
                const childOptions = {
                    ...options,
                    templatePath: options.templatePath ? `${options.templatePath}.rows[${rowIndex}]` : `rows[${rowIndex}]`
                };
                const processedItem = this.processNestedColumnItems([rowItem], obj, lang, childOptions);

                if (processedItem.length === 1 && processedItem[0].type === "columns") {
                    return processedItem[0];
                }

                return {
                    type: "columns",
                    params: { items: processedItem },
                };
            });

            return {
                type: "rows",
                weight: item.param.weight || 1,
                items: rowItems,
                // 为行组件生成UUID
                ...(this.context.enableUUID && options.templatePath ? {
                    templateUUID: this.context.createUUIDMapping(options.templatePath, item.param, obj)
                } : {})
            };
        }

        /**
         * 应用边距配置
         */
        applyMargins(item) {
            const margins = this.converter.styleProcessor.processMargins(item);
            return {
                ...item,
                param: {
                    ...item.param,
                    ...margins,
                },
            };
        }
    }

    // ==================== 主模板转换器 ====================
    class TemplateConverter {
        constructor(context) {
            this.context = context;
            this.componentConverter = new ComponentConverter(context);
            this.columnProcessor = new ColumnProcessor(context, this.componentConverter);
        }

        /**
         * 处理单个组件
         */
        processComponent(item, templatePath = '') {
            if (!PrintConditionChecker.shouldPrint(item, this.context.data)) {
                return [];
            }

            const processedItem = this.applyMargins(item);
            const { param, loopKey } = processedItem;

            // 处理循环组件
            if (loopKey) {
                return this.processLoopComponent(processedItem, templatePath);
            }

            // 处理普通组件
            return this.processSingleComponent(processedItem, null, templatePath);
        }

        /**
         * 处理循环组件
         */
        processLoopComponent(item, templatePath = '') {
            const loopData = this.context.data[item.loopKey] || [];
            const result = [];

            for (let i = 0; i < loopData.length; i++) {
                const loopItem = loopData[i];
                const loopTemplatePath = `${templatePath}.loop[${i}]`;
                const componentResult = this.processSingleComponent({
                    ...item,
                    loopKey: undefined, // 移除loopKey避免无限循环
                }, loopItem, loopTemplatePath);
                result.push(...componentResult);
            }

            return result;
        }

        /**
         * 处理单个组件
         */
        processSingleComponent(item, dataOverride = null, templatePath = '') {
            const data = dataOverride || this.context.data;
            const { param, type } = item;

            const options = { templatePath };

            switch (type) {
                case "text":
                    return this.componentConverter.convertText(param, data, this.context.lang, options);
                case "column":
                    return this.columnProcessor.convertColumns(param, data, this.context.lang, options);
                case "columnInColumn":
                    return this.columnProcessor.convertColumnInColumn(param, data, this.context.lang, options);
                case "image":
                    return this.componentConverter.convertImage(param, data, this.context.lang, false, options);
                case "staticImage":
                    return this.componentConverter.convertStaticImage(param, data, this.context.lang, options);
                case "divider":
                    return this.componentConverter.convertDivider(param, data, options);
                case "qr":
                    return this.componentConverter.convertQrCode(param, data, this.context.lang, options);
                case "brcode":
                    return this.componentConverter.convertBarCode(param, data, this.context.lang, options);
                case "config":
                    return [];
                default:
                    console.warn(`Unknown component type: ${type}`);
                    return [];
            }
        }

        /**
         * 为指令添加行号包装
         */
        wrapWithLineNumber(instruction) {
            if (!this.context.enableLineNumbers) {
                return instruction;
            }

            // 对于某些特殊类型不添加行号
            if (instruction.type === 'cutPaper' || instruction.type === 'beep' || instruction.type === 'dividing') {
                return instruction;
            }

            const lineNumber = this.context.lineNumberCounter++;
            const lineNumberItem = {
                type: "text",
                value: `${lineNumber.toString()}`,
                // TODO: 使用固定宽度
                weight: 1, // 行号列权重始终为1
                align: 0,
                size: 20
            };

            // 保存原始指令的 UUID（如果存在）
            const originalUUID = instruction.templateUUID;

            // 如果指令已经是 columns 类型，使用嵌套 rows 的方式
            if (instruction.type === 'columns' && instruction.params && instruction.params.items) {
                const wrappedInstruction = {
                    type: "columns",
                    params: {
                        // 保留原 columns 的其他属性（如 marginTop）
                        ...(instruction.params.marginTop && { marginTop: instruction.params.marginTop }),
                        items: [
                            lineNumberItem, // 行号列，权重为1
                            {
                                type: "rows",
                                weight: 9, // 使用原始权重总计
                                items: [
                                    {
                                        type: "columns",
                                        params: {
                                            items: instruction.params.items // 保持原有的 items 不变
                                        },
                                        // 将原始指令的 UUID 传递到内层的 columns
                                        ...(originalUUID && { templateUUID: originalUUID })
                                    }
                                ]
                            }
                        ]
                    },
                    // 在包装指令上标记这是一个被行号包装的指令
                    _isLineNumberWrapped: true,
                    // 保存原始指令的 UUID 到顶层，便于外部识别
                    ...(originalUUID && { templateUUID: originalUUID })
                };

                return wrappedInstruction;
            }

            // 获取原指令的值，确保不为空
            const originalValue = instruction.params ? instruction.params.value : instruction.value;
            const safeValue = originalValue != null ? String(originalValue) : "";

            // 对于非 columns 指令，包装为列格式
            const wrappedInstruction = {
                type: "columns",
                params: {
                    items: [
                        lineNumberItem, // 行号列，权重为1
                        {
                            type: instruction.type,
                            weight: 9, // 内容列使用较大的权重，确保内容有足够空间
                            // 平铺原指令的 params 内容
                            ...(instruction.params || {}),
                            // 确保 value 不为空
                            value: safeValue,
                            // 设置默认值以防原指令缺少这些属性
                            align: instruction.params ? instruction.params.align || 0 : instruction.align || 0,
                            size: instruction.params ? instruction.params.size || 24 : instruction.size || 24,
                            bold: instruction.params ? instruction.params.bold || false : instruction.bold || false,
                            // 将原始指令的 UUID 传递到内容项
                            ...(originalUUID && { templateUUID: originalUUID })
                        }
                    ]
                },
                // 在包装指令上标记这是一个被行号包装的指令
                _isLineNumberWrapped: true,
                // 保存原始指令的 UUID 到顶层，便于外部识别
                ...(originalUUID && { templateUUID: originalUUID })
            };

            return wrappedInstruction;
        }

        /**
         * 处理指令数组，为每个指令添加行号
         */
        wrapInstructionsWithLineNumbers(instructions) {
            if (!this.context.enableLineNumbers) {
                return instructions;
            }

            return instructions.map(instruction => this.wrapWithLineNumber(instruction));
        }

        /**
         * 应用边距配置
         */
        applyMargins(item) {
            const margins = this.componentConverter.styleProcessor.processMargins(item);
            return {
                ...item,
                param: {
                    ...item.param,
                    ...margins,
                },
            };
        }

        /**
         * 添加默认的打印结束指令
         */
        addPrintEndCommands(result) {
            // 切纸指令
            result.push({
                type: "cutPaper",
                params: { mode: 1 },
            });

            // 蜂鸣器指令
            if (this.context.enableBuzz) {
                result.push({
                    type: "beep",
                    params: {
                        beepN: 1,
                        beepT: 2,
                    },
                });
            }
        }

        /**
         * 转换完整模板
         */
        convert() {
            console.log(`convertTemplate version: ${VERSION}`);

            if (!this.context.data || !this.context.template?.list) {
                return [];
            }

            const result = [];

            for (let i = 0; i < this.context.template.list.length; i++) {
                const item = this.context.template.list[i];
                const templatePath = `list.${i}`;
                const componentResult = this.processComponent(item, templatePath);

                // 如果启用了行号，为每个指令添加行号
                if (this.context.enableLineNumbers) {
                    result.push(...this.wrapInstructionsWithLineNumbers(componentResult));
                } else {
                    result.push(...componentResult);
                }
            }

            // 如果启用了UUID映射，添加映射信息到结果中
            if (this.context.enableUUID) {
                const mappings = this.context.getUUIDMappings();
                // 将映射信息作为元数据添加（不影响打印指令）
                result._uuidMappings = mappings;
            }

            this.addPrintEndCommands(result);
            return result;
        }
    }

    // ==================== 上下文构建器 ====================
    class ConversionContext {
        constructor({ type, template, data, langKey, options = {} }) {
            this.type = type;
            this.data = data;
            this.template = this.parseTemplate(template);
            this.lang = this.parseLang(langKey);
            this.fontConfig = options.fontSize || DEFAULT_FONT_CONFIG;
            this.enableBuzz = options.enableBuzz || false;
            this.columnIndent = options.columnIndent || "";
            this.marginLeft = options.marginLeft || 0;
            const config = this.template.list?.find(cmd => cmd.type === 'config');
            this.enableLineNumbers = config?.param?.enableLineNumbers || options.enableLineNumbers || false; // 新增行号开关
            this.lineNumberCounter = 1; // 行号计数器
            this.qrCodeGenerator = options.qrCodeGenerator || (typeof max !== 'undefined' ? max.converter?.qrCode : null);

            // UUID映射功能
            this.enableUUID = options.enableUUID || false;
            this.uuidMapping = new Map(); // UUID -> 模板字段路径映射
            this.templateMapping = new Map(); // 模板字段路径 -> UUID映射
        }

        /**
         * 生成UUID
         */
        generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0;
                const v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

        /**
         * 为模板字段创建UUID映射
         * @param {string} templatePath - 模板字段路径，如 'list.0.text' 或 'header.title'
         * @param {object} component - 模板组件对象
         * @param {object} currentData - 当前指令使用的具体数据（可选）
         * @param {string} dataKey - column节点的dataKey，用作namespace（可选）
         * @returns {string} UUID
         */
        createUUIDMapping(templatePath, component, currentData = null, dataKey = null) {
            if (!this.enableUUID) return null;

            // 检查是否已经有映射
            if (this.templateMapping.has(templatePath)) {
                return this.templateMapping.get(templatePath);
            }

            // 为column节点构建增强的renderData
            let enhancedRenderData = currentData;

            // 如果是column节点的row或header，并且提供了dataKey，则增强renderData
            if (dataKey && (templatePath.includes('.row') || templatePath.includes('.header'))) {
                enhancedRenderData = {
                    ...currentData,
                    namespace: dataKey,
                    // 如果currentData没有dataId，则提供默认的dataId
                    dataId: currentData?.dataId || `${dataKey}.row`
                };
            }

            const uuid = this.generateUUID();
            this.uuidMapping.set(uuid, {
                templatePath,
                component,
                renderData: enhancedRenderData, // 存储增强后的渲染数据
                timestamp: Date.now()
            });
            this.templateMapping.set(templatePath, uuid);

            return uuid;
        }

        /**
         * 获取UUID映射表（用于调试或外部使用）
         * @returns {object} 包含两个映射表：
         *   - uuidToTemplate: UUID -> {templatePath, component, renderData, timestamp}
         *   - templateToUuid: templatePath -> UUID
         */
        getUUIDMappings() {
            if (!this.enableUUID) return null;

            return {
                uuidToTemplate: Object.fromEntries(this.uuidMapping),
                templateToUuid: Object.fromEntries(this.templateMapping)
            };
        }

        /**
         * 解析模板数据
         */
        parseTemplate(template) {
            return {
                ...template,
                list: typeof template?.list === "string" ? JSON.parse(template?.list) : template?.list,
                lang: typeof template?.lang === "string" ? JSON.parse(template?.lang) : template?.lang,
            };
        }

        /**
         * 解析语言配置
         */
        parseLang(langKey) {
            const resolvedLangKey = langKey || this.template.defaultLang;

            // 直接匹配
            if (this.template.lang?.[resolvedLangKey]) {
                return this.template.lang[resolvedLangKey];
            }

            // 如果直接匹配失败，尝试前缀匹配
            // 例如 "en" 可以匹配到 "en-US", "en-GB" 等
            if (this.template.lang && resolvedLangKey) {
                const availableKeys = Object.keys(this.template.lang);
                const matchedKey = availableKeys?.find(key =>
                    key.toLowerCase().startsWith(resolvedLangKey.toLowerCase() + '-')
                );

                if (matchedKey) {
                    return this.template.lang[matchedKey];
                }
            }

            // 如果都没找到，返回整个语言对象作为兜底
            return this.template.lang;
        }
    }

    try {
        const context = new ConversionContext({ ...config, options });
        const converter = new TemplateConverter(context);
        return converter.convert();
    } catch (error) {
        console.error("Template conversion failed:", error);
        return [];
    } finally {
        console.warn("Template conversion end");
        // return [];
    }
}
