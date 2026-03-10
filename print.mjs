import { convertTemplate } from "./convertTemplate_v2.mjs";
import { toStringText } from "./toStringText.mjs";
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export function sendToPrinter(printDataPath) {
    // 推送 printData.json 到 Android 设备
    try {
        // 检查 adb 设备连接
        const devices = execSync('adb devices', { encoding: 'utf8' });
        console.log('ADB devices:', devices);

        if (devices.includes('\tdevice')) {
            // 确保目标目录存在
            execSync('adb shell mkdir -p /sdcard/MaxFile/test/', { encoding: 'utf8' });
            console.log('Created directory: /sdcard/MaxFile/test/');

            // 推送文件到设备
            execSync(`adb push "${printDataPath}" /sdcard/MaxFile/test/max.json`, { encoding: 'utf8' });
            console.log('Successfully pushed printData.json to /sdcard/MaxFile/test/max.json on Android device');
        } else {
            console.log('No Android device connected. Skipping file push.');
        }
    } catch (error) {
        console.error('Error pushing file to Android device:', error.message);
    }
}

export { convertTemplate };

export async function print(template, data, options = {}) {
    const printData = await convertTemplate({
        type: "print",
        template: template, // 小票模版。小票编辑器的产物
        data: data, // 业务数据。后端遵循模版约定结构，用于填充小票数据
        langKey: 'zh-CN',
    }, { ...template.options, ...options, });

    // 将 printData 存储为 JSON 文件
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const printDataPath = path.join(outputDir, 'printData.json');
    fs.writeFileSync(printDataPath, JSON.stringify(printData, null, 2), 'utf8');
    console.log(`PrintData saved to: ${printDataPath}`);

    // 将 template 存储为 JSON 文件
    const templatePath = path.join(outputDir, 'template.json');
    template.data = data; // 添加 data 字段
    fs.writeFileSync(templatePath, JSON.stringify(template, null, 2), 'utf8');
    console.log(`Template saved to: ${templatePath}`);

    // 复制 convertTemplate.js 文件到 output 目录
    const convertTemplatePath = path.join(path.dirname(import.meta.url.replace('file://', '')), 'convertTemplate_v2.mjs');
    const convertTemplateDestPath = path.join(outputDir, 'convertTemplate.js');
    if (fs.existsSync(convertTemplatePath)) {
        fs.copyFileSync(convertTemplatePath, convertTemplateDestPath);
        console.log(`ConvertTemplate saved to: ${convertTemplateDestPath}`);
    }

    sendToPrinter(printDataPath);

    const text = toStringText(printData, 60).join('\n');

    // 将 text 存储到文件
    const textPath = path.join(outputDir, 'receipt.txt');
    fs.writeFileSync(textPath, text, 'utf8');
    console.log(`Receipt text saved to: ${textPath}`);
    console.log('\n--- Receipt Preview ---');
    console.log(text);
}
