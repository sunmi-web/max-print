export async function convertTemplate(
  { type, template, data, langKey },
  options = {}
) {
  const version = "2.1.3";
  console.log("converteTemplate version:", version);
  if (data == null || template?.list == null) return;

  template.list =
    typeof template.list == "string"
      ? JSON.parse(template.list)
      : template.list;
  template.lang =
    typeof template.lang == "string"
      ? JSON.parse(template.lang)
      : template.lang;

  const _langKey = langKey || template.defaultLang;
  const lang = template.lang[_langKey];

  const { enableBuzz = false, columnIndent = "", marginLeft = 0 } = options;

  const list = template.list;

  //no chinese and english,use picture

  const fontCfg = options.fontSize || {
    small: 20,
    middle: 24,
    large: 28,
    extraLarge: 32,
  };
  const fontSize = {
    s: fontCfg["small"] || 20,
    m: fontCfg["middle"] || 24,
    l: fontCfg["large"] || 28,
    xl: fontCfg["extraLarge"] || 32,
  };

  function fetchSize(cfg, key) {
    const sizeKey = key === "size" ? cfg[key] : key;
    return {
      ...cfg,
      size: (typeof sizeKey == "string" ? fontSize[sizeKey] : sizeKey) || 24,
    };
  }
  function returnIsBold(bold, obj, key, langObj) {
    const value = parseData(obj[key], langObj, obj || {});
    const flag = /^-\s/.test(value);
    return !flag && bold ? true : false;
  }

  function fetchText(obj, key) {
    return key.split(".").reduce((pre, item) => {
      return pre[item];
    }, obj);
  }

  function parseData(text, lang, obj) {
    if (!text || typeof text != "string") return "";
    // console.log('----------', text)
    if (!/\{\{/.test(text)) {
      return text;
    }
    //变量替换
    let keys = text.match(/{{[a-zA-Z0-9\.]+}}/g);

    // console.log('----------', keys, text)
    if (keys) {
      keys.forEach((k) => {
        let d =
          typeof obj == "string"
            ? obj
            : fetchText(obj, k.replace(/^\{\{|\}\}$/g, "")); //[k.replace(/^\{\{|\}\}$/g, '')]
        if (d == null || !["string", "number"].includes(typeof d)) d = "";
        text = text.replaceAll(k, d);
      });
    }
    //语言替换
    keys = text.match(/{{[a-zA-Z0-9\-]+\|l}}/g);
    if (keys) {
      keys.forEach((k) => {
        let d = lang[k.replace(/^\{\{|\|l\}\}$/g, "")];
        if (d == null || !["string", "number"].includes(typeof d)) d = "";
        text = text.replaceAll(k, d);
      });
    }
    return text;
  }

  let commonXY = marginLeft
    ? { x: parseInt(marginLeft), y: -1 }
    : { x: -1, y: -1 };

  //空行
  const blankLineObj = {
    type: "text",
    params: {
      value: "",
      size: 16,
    },
  };

  function blankLine(count, size = 16) {
    if (count == undefined || count == 0) return [];
    const result = [];
    let blankCfg;
    switch (type) {
      case "printPic":
        blankCfg = {
          type: "text",
          params: {
            value: "",
            size: size || 16,
          },
        };
        break;
      default:
        blankCfg = blankLineObj;
        break;
    }
    for (let i = 0; i < count; i++) {
      result.push(blankCfg);
    }
    return result;
  }

  //✅文本节点转换函数
  function convText(isColumnsReferenced, param, obj, langObj, bold, size) {
    const { text, ...other } = param;
    const _bold = bold ?? other.bold;
    const text1 = parseData(text, langObj, obj || {});
    let params = {
      value: text1,
      ...other,
      ...fetchSize(other, size ?? "size"),
      ...(other.align ? { align: other.align } : { align: 0 }),
      bold: returnIsBold(_bold, obj, "name", langObj),
    };
    if (!isColumnsReferenced) {
      params = { params };
    }
    return [
      {
        type: "text",
        ...params,
      },
    ];
  }

  const blankChats = "----------------";
  function getBlankChar(count, index) {
    if (index != 0) return "";
    const r = blankChats.substring(0, count);
    return columnIndent != 2 ? r.replace(/\-/g, "  ") : r;
  }

  //多列
  function _convColumn(columns, obj, langObj, level, idx, bold, sizeKey) {
    // console.log('---------', 'columns', 1, columns, 'obj', obj, 'langObj', langObj)
    const result = [
      {
        type: "columns",
        params: {
          items: columns
            .filter((item) => item.show != false)
            .reduce((pre, item, index) => {
              pre.push(
                ...convText(
                  true,
                  { ...item, text: getBlankChar(idx, index) + item.text },
                  obj,
                  langObj,
                  bold,
                  sizeKey
                )
              );
              return pre;
            }, []),
        },
      },
    ];
    if (level && Array.isArray(obj[level])) {
      obj[level].forEach((i) =>
        result.push(
          ..._convColumn(columns, i, langObj, level, idx + 1, bold, sizeKey)
        )
      );
    }
    return result;
  }
  // ✅ 多列转换
  function convColumns(param, obj, langObj) {
    const {
      columns,
      level,
      dataKey,
      titleBold,
      bodyBold,
      headerSize,
      bodySize,
    } = param;
    const result = [];

    if (columns.some((item) => item.title != null)) {
      //先处理标题
      const titles = columns
        .filter((item) => item.show != false)
        .map((item) => {
          const { title, ...other } = item;
          return {
            ...fetchSize(other, headerSize),
            text: title,
          };
        });

      result.push({
        type: "columns",
        params: {
          items: titles.reduce((pre, item) => {
            pre.push(...convText(true, item, obj, langObj, titleBold));
            return pre;
          }, []),
        },
      });
    }

    if (dataKey && data[dataKey] && Array.isArray(data[dataKey])) {
      //数据拼装
      data[dataKey].forEach((itemData) => {
        result.push(
          ..._convColumn(
            columns,
            itemData,
            langObj,
            level,
            0,
            bodyBold,
            bodySize
          )
        );
      });
    } else {
      result.push(
        ..._convColumn(columns, obj, langObj, level, 0, bodyBold, bodySize)
      );
    }

    return result;
  }

  function processColumnInColumnItems(items, obj, langObj, isTopLevel = false) {
    const result = [];

    for (let item of items) {
      // 检查是否需要隐藏该字段
      if (item.show == false || !isPrint(item, obj)) continue;
      // 空行处理，空行配置在item.param之外，在此处提前处理后注入item.param中
      item = convertBlankToMargin(item);

      switch (item.type) {
        case "text":
          result.push(...convText(true, item.param, obj, langObj));
          break;
        case "image":
          result.push(...convImage(item.param, obj, langObj, true));
          break;
        case "staticImage":
          result.push(...convStaticImage(item.param, obj, langObj));
          break;
        case "divider":
          result.push(...convDivider(item.param, true));
          break;
        case "row":
          // MEMO:  打印指令里rows目前只能直接嵌套columns。模板schema里不做此限制。此处统一包装一层columns作为rows子节点。
          if (item.param?.rows && Array.isArray(item.param.rows)) {
            const rowItems = item.param.rows.map((rowItem) => {
              // 递归处理row中的每一项
              const processedItem = processColumnInColumnItems(
                [rowItem],
                obj,
                langObj
              );

              // 已经是column类型
              if (
                processedItem.length === 1 &&
                processedItem[0].type === "columns"
              ) {
                return processedItem[0];
              } else {
                return {
                  type: "columns",
                  params: {
                    items: processedItem,
                  },
                };
              }
            });
            result.push({
              type: "rows",
              weight: item.param.weight || 1,
              items: rowItems,
            });
          }
          break;
        case "column":
          // 处理嵌套的column类型
          result.push(...convColumns(item.param, obj, langObj));
          break;
        default:
          console.warn(`Unknown item type in columnInColumn: ${item.type}`);
      }
    }

    return result;
  }

  // ✅列嵌套列转换
  function convColumnInColumn(param, obj, langObj) {
    if (!param?.columns || !Array.isArray(param.columns)) {
      return [];
    }
    // 处理列嵌套列
    const processedItems = processColumnInColumnItems(
      param.columns,
      obj,
      langObj,
      true
    );

    return [
      {
        type: "columns",
        params: {
          items: processedItems,
        },
      },
    ];
  }

  /**
   * ✅图片转换
   * @param {any} data 模板
   * @param {any} obj 业务数据
   * @param {any} langObj 国际化词条
   * @param {Boolean} isColumnsReferenced 是否为column子节点
   * @explain 作为独立节点时，打印指令需要使用params包裹；作为column子节点时，需要去掉params这一层，铺平给到IOT
   */
  function convImage(data, obj, langObj, isColumnsReferenced = false) {
    const { data: _img, ...other } = data;
    if (_img == null || _img == "") return [];
    const tmp = parseData(_img, langObj, obj);

    let params = {
      value: tmp?.replace(/^data:image\/[a-zA-Z0-9]+;base64,/, "") || "",
      align: other.align,
      ...(other.maxWidth && {
        maxWidth: other.maxWidth,
      }),
    };

    // 非column子节点，使用params包裹一层
    if (!isColumnsReferenced) {
      // @ts-ignore
      params = {
        params,
      };
    }
    // column子节点，需要打平param层级
    return [
      {
        type: "image",
        ...params,
      },
    ];
  }

  // 静态图片转换
  function convStaticImage(data, obj, langObj) {
    const { url, ...other } = data;
    const staticImageUrl = parseData(url, langObj, obj);
    return convImage(
      {
        data: staticImageUrl,
        align: other.align,
      },
      obj,
      langObj
    );
  }

  /**
   * ✅分隔线
   * @param {any} data
   * @param {Boolean} isColumnsReferenced 是否为column子节点
   * @explain 作为独立节点时，打印指令需要使用params包裹；作为column子节点时，需要去掉params这一层，铺平给到IOT
   */
  function convDivider(data, isColumnsReferenced = false) {
    const styleMap = new Map();
    styleMap.set(0, ""); // 线的类型还有空白
    styleMap.set(1, "stroke");
    styleMap.set(2, "dot");

    let params = {
      value: styleMap.get(data.style), // stroke / dot
      marginTop: data?.marginTop ?? 3,
      marginBottom: data?.marginBottom ?? 3,
    };

    // 非column子节点，使用params包裹一层
    if (!isColumnsReferenced) {
      // @ts-ignore
      params = {
        params,
      };
    }

    return [
      {
        type: "dividing",
        ...params,
      },
    ];
  }

  //✅ 二维码节点
  async function convQrCode(data, obj, langObj) {
    const { code, ...other } = data;
    const _code = parseData(code, langObj, obj);
    if (other.iconCfg && other.iconCfg.icon) {
      const { icon, ...iconOther } = other.iconCfg;
      const payQrCode = await max.converter.qrCode(
        parseData(code, langObj, obj),
        {
          // codeSize: 200, // 二维码 宽高，默认 200
          // errorLevel: 'Q', // 二维码容错等级，"L" | "M" | "Q" | "H" 默认 Q
          icon: parseData(icon, langObj, obj), // 图片地址
          imageScale: 20, // icon缩放比例 0 - 50 不能超过二维码宽的15% 默认20%
          backgroundColor: "white", // 背景颜色 withe | black 默认 white
          codeColor: "black", // 二维码颜色 withe | black 默认 white
          ...iconOther,
        }
      );
      return convImage(
        {
          data: _code.match(/^data:image\/png;base64,/) ? _code : payQrCode,
          align: other.align,
        },
        obj,
        langObj
      );
    }

    if (type == "printPic") {
      return [
        {
          type: "image",
          params: {
            value: parseData(code, langObj, obj),
            align: other.align,
          },
        },
      ];
    }

    //场景是自定义商家收款码，启用图片打印
    // TODO: 转图片的方法里也要同步
    if (_code.match(/^data:image\/png;base64,/)) {
      return convImage(
        {
          data: _code,
          align: other.align,
        },
        obj,
        langObj
      );
    }

    return [
      {
        type: "qrcode",
        params: {
          ...other,
          value: parseData(code, langObj, obj),
        },
      },
    ];
  }

  // ✅条形码节点
  function convBarCode(data, obj, langObj) {
    const { code, ...other } = data;

    if (type == "printPic") {
      return [
        {
          type: "barcode",
          params: {
            ...other,
            value: parseData(code, langObj, obj),
            format: data.symbology,
          },
        },
      ];
    }

    return [
      {
        type: "barcode",
        params: {
          ...other,
          value: parseData(code, langObj, obj),
          format: data.symbology,
        },
      },
    ];
  }

  function convertBlankToMargin(item) {
    if (item.type === "divider") {
      // 分割线默认有3mm间距，有配置空时以配置为准
      return {
        ...item,
        param: {
          ...item.param,
          marginTop: item.upline ?? 3,
          marginBottom: item.bottomBlank ?? 3,
        },
      };
    } else {
      return {
        ...item,
        param: {
          ...item.param,
          ...(data.upline !== undefined && { marginTop: item.upline }),
          ...(data.bottomBlank !== undefined && {
            marginBottom: item.bottomBlank,
          }),
        },
      };
    }
  }

  // 是否需要打印
  function isPrint(item, data) {
    let flag = item.hideFields
      ? item.hideFields.some(
          (key) =>
            data[key] && (!Array.isArray(data[key]) || data[key].length > 0)
        )
      : true;
    if (!flag) return false;
    return item.excludeFields
      ? !item.excludeFields.some(
          (key) =>
            data[key] && (!Array.isArray(data[key]) || data[key].length > 0)
        )
      : true;
  }

  const result = [];

  for (let i = 0; i < list.length; i++) {
    let item = list[i];
    if (item.show == false || !isPrint(item, data)) continue;
    // 空行配置转换
    item = convertBlankToMargin(item);

    switch (item.type) {
      case "text":
        if (item.loopKey) {
          //循环处理
          const l = data[item.loopKey] || [];
          l.forEach((v) => {
            result.push(...convText(false, item.param, v, lang));
          });
        } else {
          result.push(...convText(false, item.param, data, lang));
        }
        break;
      case "column":
        if (item.loopKey) {
          //循环处理
          const l = data[item.loopKey] || [];
          l.forEach((v) => {
            result.push(...convColumns(item.param, v, lang));
          });
        } else {
          result.push(...convColumns(item.param, data, lang));
        }
        break;
      case "columnInColumn":
        result.push(...convColumnInColumn(item.param, data, lang));
        break;
      case "image":
        result.push(...convImage(item.param, data, lang));
        break;
      case "staticImage":
        result.push(...convStaticImage(item.param, data, lang));
        break;
      case "divider":
        result.push(...convDivider(item.param));
        break;
      case "qr":
        result.push(...(await convQrCode(item.param, data, lang)));
        break;
      case "brcode":
        result.push(...convBarCode(item.param, data, lang));
        break;
    }
  }

  result.push({
    type: "cutPaper",
    params: {
      mode: 1,
    },
  });
  if (enableBuzz) {
    result.push({
      type: "beep",
      params: {
        beepN: 1,
        beepT: 2,
      },
    });
  }

  return result;
}
