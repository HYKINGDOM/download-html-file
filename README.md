# 网页图片批量下载器 - 油猴脚本

这是一个功能强大的油猴脚本，可以自动检测并批量下载当前网页中的所有图片资源。
customer_adjustment_sync_advertiser_account
## 功能特性

✅ **全面图片检测**
- 自动遍历页面DOM结构，识别所有`<img>`标签
- 检测CSS背景图片（包括内联样式和样式表）
- 支持懒加载图片（data-src属性）

✅ **多格式支持**
- 支持JPG、JPEG、PNG、GIF、WebP、BMP、SVG等常见图片格式
- 自动识别图片格式并保持原始质量

✅ **批量下载功能**
- 一键下载所有检测到的图片
- 智能文件命名，避免重复和特殊字符
- 支持大批量图片下载

✅ **用户友好界面**
- 实时显示检测到的图片数量
- 下载进度条显示
- 完成状态提示
- 简洁美观的悬浮界面

✅ **浏览器兼容性**
- 兼容Chrome、Firefox、Edge等主流浏览器
- 使用现代Web API确保稳定性

## 安装方法

### 1. 安装油猴插件

首先需要在浏览器中安装Tampermonkey（油猴）插件：

- **Chrome**: 访问 [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- **Firefox**: 访问 [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- **Edge**: 访问 [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### 2. 安装脚本

1. 点击Tampermonkey图标，选择"管理面板"
2. 点击"新建脚本"标签页
3. 删除默认内容，复制粘贴 `image-downloader.user.js` 文件中的所有代码
4. 按 `Ctrl+S` 保存脚本

### 3. 启用脚本

脚本会自动在所有网页上运行（`@match *://*/*`）。

## 使用方法

1. **访问任意网页**：脚本会自动加载

2. **查看检测结果**：页面右上角会出现"📷 图片下载器"悬浮窗

3. **扫描图片**：
   - 脚本会自动扫描一次
   - 也可以手动点击"扫描图片"按钮重新扫描

4. **批量下载**：
   - 点击"下载全部"按钮开始下载
   - 观察下载进度条
   - 等待下载完成提示

5. **关闭界面**：点击"关闭"按钮隐藏悬浮窗

## 技术实现

### 图片检测机制

```javascript
// 1. IMG标签检测
const imgElements = document.querySelectorAll('img');

// 2. CSS背景图片检测
const style = window.getComputedStyle(element);
const backgroundImage = style.backgroundImage;

// 3. 样式表背景图片检测
for (let stylesheet of document.styleSheets) {
    for (let rule of stylesheet.cssRules) {
        // 检测CSS规则中的背景图片
    }
}
```

### 下载实现

```javascript
// 使用Fetch API获取图片
const response = await fetch(url);
const blob = await response.blob();

// 创建下载链接
const downloadUrl = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = downloadUrl;
a.download = filename;
a.click();
```

## 注意事项

⚠️ **跨域限制**
- 某些图片可能因为CORS策略无法下载
- 建议在图片所在的原始网站使用

⚠️ **浏览器限制**
- 浏览器可能会阻止大量文件同时下载
- 脚本已添加延迟机制减少被阻止的可能性

⚠️ **文件大小**
- 大量高清图片下载可能需要较长时间
- 请确保有足够的磁盘空间

## 自定义配置

可以修改脚本中的以下参数：

```javascript
// 支持的图片格式
const supportedFormats = /\.(jpg|jpeg|png|gif|webp|bmp|svg)($|\?)/i;

// 下载延迟（毫秒）
await new Promise(resolve => setTimeout(resolve, 200));

// 界面位置
container.style.cssText = `
    position: fixed;
    top: 20px;        // 距离顶部
    right: 20px;      // 距离右侧
    // ...
`;
```

## 故障排除

**Q: 脚本没有显示悬浮窗？**
A: 检查Tampermonkey是否已启用，脚本是否正确安装

**Q: 检测不到图片？**
A: 某些动态加载的图片可能需要等待页面完全加载后再扫描

**Q: 下载失败？**
A: 可能是跨域问题或图片链接失效，检查浏览器控制台错误信息

**Q: 下载的文件名乱码？**
A: 脚本会自动清理特殊字符，如仍有问题可手动修改文件名生成逻辑

## 版本历史

- **v1.0** - 初始版本
  - 基础图片检测和下载功能
  - 支持IMG标签和CSS背景图片
  - 批量下载和进度显示
  - 跨浏览器兼容性

## 许可证

本项目采用MIT许可证，可自由使用和修改。

---

**享受批量下载图片的便利！** 🚀