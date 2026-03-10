export function toStringText(list, lineCount) {
    function dividing(item) {
        //1:虚线；2:实线
        // 处理不同的数据结构格式
        const value = item.params?.value || item.value;
        
        if (value === 'dot') {
            return ['——————————————————————————————————————————————————————————'.substring(0, lineCount)]
        } else {
            return ['----------------------------------------------------------'.substring(0, lineCount)]
        }
    }

    // 计算字符串的显示宽度（中文字符占2个宽度）
    function getDisplayWidth(str) {
        let width = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charAt(i);
            // 检查是否为中文字符
            if (/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(char)) {
                width += 2;
            } else {
                width += 1;
            }
        }
        return width;
    }

    // 截取指定显示宽度的字符串
    function substringByWidth(str, maxWidth) {
        let width = 0;
        let result = '';
        for (let i = 0; i < str.length; i++) {
            const char = str.charAt(i);
            const charWidth = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(char) ? 2 : 1;
            if (width + charWidth > maxWidth) {
                break;
            }
            result += char;
            width += charWidth;
        }
        return result;
    }

    function splitText(text, count) {
        const r = []
        // 处理 text 为 undefined 或 null 的情况
        const safeText = text != null ? String(text) : "";
        safeText.split(/\n/g).forEach(text => {
            while (text.length > 0) {
                const substring = substringByWidth(text, count);
                r.push(substring);
                // 移除已处理的字符
                let processedChars = 0;
                let currentWidth = 0;
                for (let i = 0; i < text.length; i++) {
                    const char = text.charAt(i);
                    const charWidth = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(char) ? 2 : 1;
                    if (currentWidth + charWidth > count) {
                        break;
                    }
                    currentWidth += charWidth;
                    processedChars++;
                }
                text = text.substring(processedChars);
            }
        })
        return r
    }

    const blankText = '                                                                                  '
    /**
     * 字符，总字符长度,位置
     */
    function addBlank(text, count, place) {
        const displayWidth = getDisplayWidth(text);
        if (count <= displayWidth) return text;
        const c = count - displayWidth;

        switch (place) {
            case 'right'://文本向右,空格在前
                text = blankText.substring(0, c) + text
                break
            case 'left'://文本向左，空格在后
                text = text + blankText.substring(0, c)
                break
            case 'center'://居中，两边空格
                text = blankText.substring(0, Math.floor(c / 2)) + text + blankText.substring(0, Math.ceil(c / 2))
                break
        }
        return text
    }

    function textUtil(str, count, align) {
        const l = splitText(str, count)
        return l.map(r => addBlank(r, count, (align == null || align == 0) ? 'left' : (align == 2 ? 'right' : 'center')))
    }

    function text(item, lineCount) {
        return textUtil(item.params.value, lineCount, item.params.align)
    }

    function texts(item) {
        // 检查每列的值并统计有值的列数
        const itemsWithValues = item.params.items.map(column => {
            let hasValue = false;
            let textContent = '';
            
            if (column.value) {
                hasValue = column.value.trim() !== '';
                textContent = column.value;
            } else if (column.type === 'rows') {
                // 对于 rows 类型，需要递归处理获取文本内容
                const rowsText = processRows(column);
                textContent = rowsText.join('\n');
                hasValue = textContent.trim() !== '';
            }
            
            return {
                ...column,
                hasValue,
                textContent
            };
        });
        
        const itemsWithValuesCount = itemsWithValues.filter(col => col.hasValue).length;
        
        // 如果只有1个字段有值，动态调整权重
        let adjustedItems = itemsWithValues;
        if (itemsWithValuesCount === 1) {
            // 计算全部字段的权重总和
            const totalWeight = itemsWithValues.reduce((sum, col) => sum + (col.weight || 1), 0);
            
            adjustedItems = itemsWithValues.map(col => ({
                ...col,
                weight: col.hasValue ? totalWeight : 0
            }));
        }
        
        const total = adjustedItems.reduce((pre, item) => {
            return pre + (item.weight || 1)
        }, 0)
        const column = adjustedItems.map(item => {
            return Math.floor(lineCount * (item.weight || 1) / total)
        })
        column[column.length - 1] += lineCount - column.reduce((pre, i) => (pre + i), 0)
        let maxLines = 0
        //[['123','abc'],[]]
        const list = adjustedItems.map((item, idx) => {
            let l;
            if (item.type === 'rows') {
                // 对于 rows 类型，递归处理获取文本行
                const rowsText = processRows(item);
                l = rowsText.length > 0 ? rowsText : [''];
            } else {
                l = textUtil(item.textContent || item.value || '', column[idx], item.align);
            }
            maxLines = Math.max(maxLines, l.length)
            return l
        })
        const r = []
        for (let i = 0; i < maxLines; i++) {
            r.push(list.reduce((pre, item, idx) => {
                return pre + (item[i] ? item[i] : addBlank('', column[idx], 'left'))
            }, ''))
        }
        return r

    }
    
    // 处理 rows 类型的函数
    function processRows(item) {
        const result = [];
        if (item.items && Array.isArray(item.items)) {
            item.items.forEach(rowItem => {
                result.push(...processItem(rowItem));
            });
        }
        return result;
    }
    
    // 通用的项目处理函数，支持递归处理嵌套结构
    function processItem(item) {
        switch (item.type) {
            case 'dividing':
            case 'divider':  // 添加对 divider 类型的支持
                return dividing(item);
            case 'text':
                return text(item, lineCount);
            case 'columns':
                return texts(item);
            case 'rows':
                return processRows(item);
            case 'cutPaper':
                // 切纸指令在文本输出中可以用分隔线表示，或者忽略
                return ['========== 切纸 =========='];
            case 'beep':
                // 蜂鸣器指令在文本输出中可以用提示表示，或者忽略
                return ['*** 蜂鸣 ***'];
            case 'qrcode':
                // 二维码在文本输出中显示为占位符
                return [`[QR码: ${item.params?.value || 'N/A'}]`];
            case 'barcode':
                // 条形码在文本输出中显示为占位符
                return [`[条形码: ${item.params?.value || 'N/A'}]`];
            case 'image':
                // 图片在文本输出中显示为占位符
                return ['[图片]'];
            default:
                console.warn(`Unknown item type in toStringText: ${item.type}`);
                return [];
        }
    }
    
    return list.reduce((pre, item) => {
        pre.push(...processItem(item));
        return pre;
    }, []);
}