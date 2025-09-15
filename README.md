# 网页图片批量下载器 - 油猴脚本

这是一个功能强大的油猴脚本，可以自动检测并批量下载当前网页中的所有图片资源。新增自动下载模式，支持在打开新页面时自动下载图片。
## 功能特性

✅ **自动下载模式** 🆕
- 开启后自动检测并下载打开页面的图片
- 支持新标签页和当前标签页
- 智能延迟确保动态内容加载完成
- 可随时切换手动/自动模式
- 🔄 **滚动监听支持懒加载和瀑布流** 🆕
  - 自动检测滚动时出现的新图片
  - 支持懒加载（lazy loading）图片
  - 支持瀑布流和无限滚动页面
  - 使用 Intersection Observer 高效监测
  - 智能去重，避免重复下载
- 📏 **文件大小过滤** 🆕
  - 默认过滤20KB以下的小文件（图标、缩略图等）
  - 可自定义最小文件大小限制（1-1000KB）
  - 可关闭过滤功能下载所有图片
  - 智能统计跳过的小文件数量
- 🆔 **智能去重机制** 🆕
  - URL标准化处理，识别相同图片的不同URL格式
  - 自动去除时间戳和随机参数
  - 手动下载时检查已下载历史
  - 滚动监听时精确识别新图片
  - 实时显示去重统计信息

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
- 🚀 自动下载模式状态显示

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

### 手动模式（默认）

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

### 🚀 自动下载模式 🆕

1. **启用自动模式**：
   - 在悬浮窗中勾选"🚀 自动下载模式"
   - 勾选后标签变为绿色加粗，显示启用状态
   - 出现绿色状态提示条

2. **自动下载行为**：
   - 开启后，每当打开新网页时会自动扫描图片
   - 2秒延迟后自动开始下载检测到的图片
   - 支持当前标签页和新打开的标签页
   - 下载进度显示"🚀 自动模式"标识
   - 🔄 **滚动监听功能** 🆕：
     - 自动启用滚动监听，检测用户滚动时出现的新图片
     - 支持懒加载网站（如微博、Instagram、Pinterest等）
     - 支持瀑布流和无限滚动页面
     - 智能去重，不会重复下载相同图片
     - 实时显示新检测到的图片数量（如：检测到 25 张图片（+5 新））

3. **关闭自动模式**：
   - 取消勾选"🚀 自动下载模式"
   - 标签变为普通样式，状态提示条消失
   - 回到手动模式，需要手动点击下载

4. **特殊说明**：
   - 自动模式设置会被永久保存
   - 重新打开浏览器后仍然保持之前的设置
   - 可以在任何时候切换模式

### 📏 文件大小过滤功能 🆕

1. **默认过滤设置**：
   - 默认开启文件大小过滤
   - 默认过滤20KB以下的小文件
   - 避免下载图标、小缩略图等无用文件

2. **自定义过滤设置**：
   - 在悬浮窗中可看到“📏 文件大小过滤”选项
   - 可修改最小文件大小限制（1-1000KB）
   - 可关闭过滤功能下载所有图片

3. **过滤统计显示**：
   - 下载完成后显示“成功: 15/20 (跳过5个小文件)”
   - 控制台输出跳过的文件信息
   - 帮助了解过滤效果

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

### 智能去重机制 🆕

```javascript
// URL标准化处理，用于精准去重
function normalizeUrl(url) {
    const urlObj = new URL(url);
    // 移除时间戳和随机参数
    const paramsToRemove = ['t', 'timestamp', '_', 'v', 'cache', 'rand'];
    paramsToRemove.forEach(param => {
        urlObj.searchParams.delete(param);
    });
    
    // 按字母顺序排列参数
    const sortedParams = new URLSearchParams();
    Array.from(urlObj.searchParams.keys()).sort().forEach(key => {
        sortedParams.set(key, urlObj.searchParams.get(key));
    });
    urlObj.search = sortedParams.toString();
    
    return urlObj.href;
}

// 去重检查机制
const filteredUrls = imageUrls.filter(url => {
    const normalizedUrl = normalizeUrl(url);
    return !downloadedImagesSet.has(normalizedUrl);
});
```

### 滚动监听和懒加载支持 🆕

```javascript
// 滚动事件监听和节流处理
function handleScroll() {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
        checkNewImagesAndDownload();
    }, 500); // 500ms延迟检测
}

// 使用 Intersection Observer 高效监测新元素
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // 检测到新图片元素可见
            checkNewImagesAndDownload();
        }
    });
}, { rootMargin: '50px' });

// 监测新添加的DOM元素
const mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.tagName === 'IMG') {
                observer.observe(node); // 监测新图片
            }
        });
    });
});
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

**Q: 自动下载模式不工作？**
A: 确认是否勾选了“🚀 自动下载模式”，并等待2秒让页面完全加载

**Q: 自动模式下载太频繁？**
A: 可以随时关闭自动模式，或者在不需要的网站上使用手动模式

**Q: 懒加载图片没有自动下载？** 🆕
A: 确认已开启自动下载模式，然后慢慢滚动页面让图片加载出来

**Q: 滚动时重复下载相同图片？**
A: 脚本已内置去重机制，如仍有问题请检查浏览器控制台错误信息

**Q: 瀑布流网站图片下载不全？**
A: 请缓慢滚动让所有图片完全加载，或手动点击“扫描图片”重新检测

**Q: 图片都被过滤了，下载不了？** 🆕
A: 检查是否开启了文件大小过滤，可以关闭过滤或降低最小文件大小限制

**Q: 如何调整文件大小过滤？**
A: 在悬浮窗中找到“📏 文件大小过滤”，修改后面的数值（1-1000KB）或取消勾选

**Q: 为什么显示跳过了很多文件？**
A: 这些是小于设定大小的文件（通常是图标、小缩略图），如需要下载可关闭过滤

**Q: 同一图片重复下载多次？** 🆕
A: v1.4版本已修复此问题，现在支持智能去重，不会重复下载相同图片

**Q: 去重机制如何工作？**
A: 脚本会标准化URL（去除时间戳、排列参数），然后记录已下载的图片

**Q: 如何清空去重记录？**
A: 关闭并重新开启自动下载模式，或者关闭脚本悬浮窗后重新打开

**Q: 为什么下载的文件还是有重复？** 🆕
A: v1.8版本已彻底修复此问题。之前的重复是由于文件名生成时间戳精度不够导致，现已增加毫秒级别和随机数保证唯一性

**Q: 浏览器下载文件名有 (1), (2) 等后缀？**
A: 这说明之前确实存在文件名重复问题。v1.8版本已增加文件名唯一性检查，不会再出现此情况

**Q: 为什么还是出现重复下载？** 🆕
A: v1.7版本已修复此问题。旧版本在自动模式下会跳过去重检查，现已修复。如仍有问题，请点击"清空记录"按钮重置

**Q: 如何手动清空下载记录？** 🆕
A: 点击悬浮窗中的"清空记录"按钮，确认后即可清空所有已下载记录

**Q: 如何查看已下载了多少图片？**
A: 在悬浮窗中可以看到"检测到 X 张图片(已下载: Y)"的显示

**Q: 滚动监听没有自动下载新图片？** 🆕
A: 确保已开启自动下载模式，检查浏览器控制台是否有错误信息，尝试重新启用自动下载模式

**Q: 代码出现变量引用错误？**
A: v1.5版本已修复此问题，如仍有问题请更新到最新版本脚本

## 版本历史

- **v1.8** - 彻底解决文件名重复问题 🆕
  - 📝 **修复核心问题**：解决文件名生成时间戳精度不够导致的重复问题
  - ✨ **文件名唯一性**：新增 ensureUniqueFilename 函数，确保每个下载文件名都唯一
  - 🕰️ **时间戳优化**：添加毫秒级别 + 随机数，保证同一秒下载多张图片不重复
  - 📊 **智能重命名**：自动检测文件名冲突并添加编号后缀
  - 🔍 **调试增强**：新增文件名生成日志，方便问题追踪
  - 🧹 **内存清理**：清空记录时同时清理文件名缓存

- **v1.7** - 修复重复下载问题，增强去重机制 🆕
  - 🔧 修复自动下载模式跳过去重检查的关键问题
  - 🎯 增强URL标准化算法，移除更多时间戳和随机参数
  - 📊 界面显示已下载图片计数，方便监控去重效果
  - 🧹 新增"清空记录"按钮，可手动重置下载历史
  - 🔍 优化去重检查逻辑，提高准确性和性能
  - 📝 增加详细的调试日志，便于问题诊断

- **v1.6** - 完善测试页面和文档更新 🆕
  - 增强测试页面功能，新增文件大小测试区域
  - 新增滚动加载测试区域，支持动态图片测试
  - 完善测试步骤说明，增加详细的测试指南
  - 修复README文档中的代码示例错误
  - 优化项目文档结构和错误处理说明

- **v1.5** - 修复变量引用错误，优化自动下载功能 🆕
  - 修复滚动监听中的变量引用错误（downloadedImages → downloadedImagesSet）
  - 确保自动下载和滚动监听功能正常工作
  - 优化代码稳定性和错误处理
  - 完善测试页面和文档说明

- **v1.4** - 修复重复下载问题，新增智能去重机制
  - 修复同一图片重复下载的问题
  - 新增🆔URL标准化机制，精确识别相同图片
  - 去除时间戳和随机参数，避免同一图片的不同URL被认为不同文件
  - 手动下载支持去重检查，显示去重统计
  - 优化滚动监听的去重逻辑
  - 增强的错误处理和状态显示

- **v1.3** - 新增文件大小过滤功能 🆕
  - 新增📏文件大小过滤功能，默认过滤20KB以下小文件
  - 可自定义最小文件大小限制（1-1000KB）
  - 智能统计和显示跳过的小文件数量
  - 避免下载图标、小缩略图等无用文件
  - 控制台输出跳过文件的详细信息
  - 优化用户界面，新增文件大小设置选项

- **v1.2** - 新增滚动监听功能 🆕
  - 新增🔄滚动监听功能，支持懒加载和瀑布流图片自动下载
  - 使用 Intersection Observer 高效监测新出现的图片元素
  - 智能去重机制，避免重复下载相同图片
  - 支持滚动加载网站（微博、Instagram、Pinterest等）
  - 优化节流处理，清理内存泄漏
  - 实时显示新检测到的图片数量

- **v1.1** - 新增自动下载模式 🆕
  - 新增🚀自动下载模式，支持打开新页面自动下载
  - 永久保存用户设置，重启浏览器后保持状态
  - 智能延迟机制确保动态内容加载完成
  - 优化界面显示，增加自动模式状态提示
  - 增强的错误处理和取消机制

- **v1.0** - 初始版本
  - 基础图片检测和下载功能
  - 支持IMG标签和CSS背景图片
  - 批量下载和进度显示
  - 跨浏览器兼容性

## 许可证

本项目采用MIT许可证，可自由使用和修改。

---

**享受批量下载图片的便利！** 🚀