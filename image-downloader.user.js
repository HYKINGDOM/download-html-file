// ==UserScript==
// @name         网页图片批量下载器
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  自动检测并下载当前网页中的所有图片资源，支持自动下载模式、滚动监听懒加载图片、文件大小过滤和基于文件hash的智能去重
// @author       You
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 布隆过滤器实现
    class BloomFilter {
        constructor(expectedElements = 10000, falsePositiveRate = 0.01) {
            this.expectedElements = expectedElements;
            this.falsePositiveRate = falsePositiveRate;
            
            // 计算最优的位数组大小和哈希函数数量
            this.bitArraySize = Math.ceil(-(expectedElements * Math.log(falsePositiveRate)) / (Math.log(2) ** 2));
            this.hashFunctions = Math.ceil((this.bitArraySize / expectedElements) * Math.log(2));
            
            // 使用Uint8Array来存储位数组，每个字节存储8位
            this.bitArray = new Uint8Array(Math.ceil(this.bitArraySize / 8));
            
            console.log(`布隆过滤器初始化: 位数组大小=${this.bitArraySize}, 哈希函数数量=${this.hashFunctions}`);
        }
        
        // 简单的哈希函数实现
        hash1(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // 转换为32位整数
            }
            return Math.abs(hash) % this.bitArraySize;
        }
        
        hash2(str) {
            let hash = 5381;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) + hash) + str.charCodeAt(i);
            }
            return Math.abs(hash) % this.bitArraySize;
        }
        
        hash3(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 6) + (hash << 16) - hash);
            }
            return Math.abs(hash) % this.bitArraySize;
        }
        
        // 获取多个哈希值
        getHashes(item) {
            const hashes = [];
            const hash1 = this.hash1(item);
            const hash2 = this.hash2(item);
            const hash3 = this.hash3(item);
            
            hashes.push(hash1);
            hashes.push(hash2);
            
            // 使用双重哈希生成更多哈希函数
            for (let i = 2; i < this.hashFunctions; i++) {
                const combinedHash = (hash1 + i * hash2 + i * i * hash3) % this.bitArraySize;
                hashes.push(Math.abs(combinedHash));
            }
            
            return hashes;
        }
        
        // 设置位
        setBit(index) {
            const byteIndex = Math.floor(index / 8);
            const bitIndex = index % 8;
            this.bitArray[byteIndex] |= (1 << bitIndex);
        }
        
        // 获取位
        getBit(index) {
            const byteIndex = Math.floor(index / 8);
            const bitIndex = index % 8;
            return (this.bitArray[byteIndex] & (1 << bitIndex)) !== 0;
        }
        
        // 添加元素到布隆过滤器
        add(item) {
            const hashes = this.getHashes(item);
            hashes.forEach(hash => this.setBit(hash));
        }
        
        // 检查元素是否可能存在
        mightContain(item) {
            const hashes = this.getHashes(item);
            return hashes.every(hash => this.getBit(hash));
        }
        
        // 获取当前填充率（用于调试）
        getFillRatio() {
            let setBits = 0;
            for (let i = 0; i < this.bitArray.length; i++) {
                for (let j = 0; j < 8; j++) {
                    if (this.bitArray[i] & (1 << j)) {
                        setBits++;
                    }
                }
            }
            return setBits / this.bitArraySize;
        }
        
        // 序列化为字符串（用于持久化存储）
        serialize() {
            return {
                bitArray: Array.from(this.bitArray),
                bitArraySize: this.bitArraySize,
                hashFunctions: this.hashFunctions,
                expectedElements: this.expectedElements,
                falsePositiveRate: this.falsePositiveRate
            };
        }
        
        // 从序列化数据恢复
        static deserialize(data) {
            const filter = new BloomFilter(data.expectedElements, data.falsePositiveRate);
            filter.bitArray = new Uint8Array(data.bitArray);
            filter.bitArraySize = data.bitArraySize;
            filter.hashFunctions = data.hashFunctions;
            return filter;
        }
        
        // 清空过滤器
        clear() {
            this.bitArray = new Uint8Array(Math.ceil(this.bitArraySize / 8));
        }
    }

    // 全局变量
    let autoDownloadEnabled = GM_getValue('autoDownloadEnabled', false);
    let autoDownloadTimer = null;
    let downloadedImagesBloom = null; // 布隆过滤器实例（存储文件hash）
    let downloadedHashesSet = new Set(); // 精确检查集合（存储文件hash）
    let downloadedUrlsSet = new Set(); // URL去重集合（用于快速URL检查）
    let scrollMonitorEnabled = false; // 滚动监听状态
    let scrollTimer = null; // 滚动节流定时器
    let observer = null; // Intersection Observer 实例
    let downloadedFilenames = new Set(); // 已下载的文件名集合（保留以防文件名冲突）

    // 创建下载按钮和进度显示界面
    function createUI() {
        const container = document.createElement('div');
        container.id = 'image-downloader-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: #fff;
            border: 2px solid #007cba;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: Arial, sans-serif;
            width: 320px;
            max-width: 320px;
        `;

        container.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold; color: #333;">
                📷 图片下载器
            </div>
            <div style="margin-bottom: 10px;">
                <span id="image-count">检测到 0 张图片</span>
                <span id="downloaded-count" style="font-size: 12px; color: #666; margin-left: 10px;">(已下载: 0)</span>
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: flex; align-items: center; margin-bottom: 8px; font-size: 14px;">
                    <input type="checkbox" id="auto-download-option" style="margin-right: 8px;" ${autoDownloadEnabled ? 'checked' : ''}>
                    <span style="color: ${autoDownloadEnabled ? '#28a745' : '#333'}; font-weight: ${autoDownloadEnabled ? 'bold' : 'normal'};">🚀 自动下载模式</span>
                </label>
                <label style="display: flex; align-items: center; margin-bottom: 8px; font-size: 14px;">
                    <input type="checkbox" id="rename-option" style="margin-right: 8px;" checked>
                    <span>自动重命名文件</span>
                </label>
                <label style="display: flex; align-items: center; margin-bottom: 8px; font-size: 14px;">
                    <input type="checkbox" id="size-filter-option" style="margin-right: 8px;" checked>
                    <span>📏 文件大小过滤</span>
                    <input type="number" id="min-size-input" value="100" min="1" max="1000" style="
                        width: 50px;
                        margin-left: 8px;
                        padding: 2px 4px;
                        border: 1px solid #ccc;
                        border-radius: 3px;
                        font-size: 12px;
                    ">KB
                </label>
            </div>
            <div style="margin-bottom: 10px; display: flex; flex-wrap: nowrap; gap: 4px;">
                <button id="scan-btn" style="
                    background: #007cba;
                    color: white;
                    border: none;
                    padding: 6px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    flex: 1;
                    min-width: 60px;
                    white-space: nowrap;
                ">扫描图片</button>
                <button id="download-btn" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 6px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    flex: 1;
                    min-width: 60px;
                    white-space: nowrap;
                " disabled>下载全部</button>
                <button id="close-btn" style="
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 6px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    flex: 1;
                    min-width: 40px;
                    white-space: nowrap;
                ">关闭</button>
                <button id="clear-history-btn" style="
                    background: #ffc107;
                    color: #333;
                    border: none;
                    padding: 6px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    flex: 1;
                    min-width: 60px;
                    white-space: nowrap;
                ">清空记录</button>
            </div>
            <div id="auto-status" style="
                font-size: 12px;
                color: #666;
                margin-bottom: 8px;
                display: ${autoDownloadEnabled ? 'block' : 'none'};
                background: #e8f5e8;
                padding: 4px 8px;
                border-radius: 4px;
                border-left: 3px solid #28a745;
            ">🟢 自动下载已启用 - 新页面将自动下载图片</div>
            <div id="progress-container" style="display: none;">
                <div style="margin-bottom: 5px;">下载进度:</div>
                <div style="background: #f0f0f0; border-radius: 4px; overflow: hidden;">
                    <div id="progress-bar" style="
                        background: #007cba;
                        height: 20px;
                        width: 0%;
                        transition: width 0.3s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 12px;
                    ">0%</div>
                </div>
                <div id="progress-text" style="margin-top: 5px; font-size: 12px; color: #666; word-wrap: break-word; overflow-wrap: break-word;"></div>
            </div>
        `;

        document.body.appendChild(container);
        return container;
    }

    // 获取原图URL（尝试移除尺寸参数）
    function getOriginalImageUrl(url) {
        try {
            const urlObj = new URL(url);
            
            // 移除常见的尺寸参数
            const sizeParams = ['w', 'h', 'width', 'height', 'size', 's', 'resize', 'crop', 'fit'];
            sizeParams.forEach(param => {
                urlObj.searchParams.delete(param);
            });
            
            // 处理特定网站的缩略图URL模式
            let pathname = urlObj.pathname;
            
            // 移除常见的缩略图标识
            pathname = pathname.replace(/_(thumb|small|medium|large|\d+x\d+|\d+w|\d+h)\./i, '.');
            pathname = pathname.replace(/\/thumb\//g, '/original/');
            pathname = pathname.replace(/\/thumbnails\//g, '/images/');
            
            urlObj.pathname = pathname;
            return urlObj.href;
        } catch (e) {
            return url;
        }
    }

    // 获取所有图片URL
    function getAllImageUrls() {
        const imageUrls = new Set();
        const supportedFormats = /\.(jpg|jpeg|png|gif|webp|bmp|svg)($|\?)/i;

        // 1. 获取所有img标签的图片
        const imgElements = document.querySelectorAll('img');
        imgElements.forEach(img => {
            if (img.src && supportedFormats.test(img.src)) {
                const originalUrl = getOriginalImageUrl(img.src);
                imageUrls.add(originalUrl);
            }
            // 检查data-src属性（懒加载图片）
            if (img.dataset.src && supportedFormats.test(img.dataset.src)) {
                const originalUrl = getOriginalImageUrl(img.dataset.src);
                imageUrls.add(originalUrl);
            }
            // 检查srcset属性，选择最高分辨率的图片
            if (img.srcset) {
                const srcsetUrls = img.srcset.split(',').map(src => {
                    const parts = src.trim().split(' ');
                    return { url: parts[0], descriptor: parts[1] || '1x' };
                });
                // 选择最高分辨率的图片
                const highestRes = srcsetUrls.reduce((max, current) => {
                    const currentRes = parseFloat(current.descriptor) || 1;
                    const maxRes = parseFloat(max.descriptor) || 1;
                    return currentRes > maxRes ? current : max;
                });
                if (supportedFormats.test(highestRes.url)) {
                    const originalUrl = getOriginalImageUrl(highestRes.url);
                    imageUrls.add(originalUrl);
                }
            }
        });

        // 2. 获取CSS背景图片
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
            const style = window.getComputedStyle(element);
            const backgroundImage = style.backgroundImage;
            
            if (backgroundImage && backgroundImage !== 'none') {
                const matches = backgroundImage.match(/url\(["']?([^"'\)]+)["']?\)/g);
                if (matches) {
                    matches.forEach(match => {
                        const url = match.replace(/url\(["']?([^"'\)]+)["']?\)/, '$1');
                        if (supportedFormats.test(url)) {
                            // 处理相对URL
                            const absoluteUrl = new URL(url, window.location.href).href;
                            const originalUrl = getOriginalImageUrl(absoluteUrl);
                            imageUrls.add(originalUrl);
                        }
                    });
                }
            }
        });

        // 3. 检查CSS样式表中的背景图片
        try {
            for (let stylesheet of document.styleSheets) {
                try {
                    for (let rule of stylesheet.cssRules || stylesheet.rules || []) {
                        if (rule.style && rule.style.backgroundImage) {
                            const backgroundImage = rule.style.backgroundImage;
                            const matches = backgroundImage.match(/url\(["']?([^"'\)]+)["']?\)/g);
                            if (matches) {
                                matches.forEach(match => {
                                    const url = match.replace(/url\(["']?([^"'\)]+)["']?\)/, '$1');
                                    if (supportedFormats.test(url)) {
                                        const absoluteUrl = new URL(url, window.location.href).href;
                                        const originalUrl = getOriginalImageUrl(absoluteUrl);
                                        imageUrls.add(originalUrl);
                                    }
                                });
                            }
                        }
                    }
                } catch (e) {
                    // 跨域样式表可能无法访问
                    console.log('无法访问样式表:', e);
                }
            }
        } catch (e) {
            console.log('扫描CSS样式表时出错:', e);
        }

        return Array.from(imageUrls);
    }

    // URL标准化函数，用于去重
    function normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            
            // 移除常见的时间戳和随机参数，扩大参数列表
            const paramsToRemove = [
                't', 'timestamp', '_', 'v', 'version', 'cache', 'cb', 'rand', 'random',
                'nocache', 'bust', 'ts', 'time', 'r', 'rnd', 'seed', 'x', 'y',
                'token', 'auth', 'session', 'sid', 'uid', 'id', 'ref', 'from'
            ];
            
            paramsToRemove.forEach(param => {
                urlObj.searchParams.delete(param);
            });
            
            // 移除以数字开头的参数（通常是时间戳）
            const allParams = Array.from(urlObj.searchParams.keys());
            allParams.forEach(key => {
                if (/^\d+$/.test(key) && key.length > 8) {
                    urlObj.searchParams.delete(key);
                }
            });
            
            // 按字母顺序排列参数
            const sortedParams = new URLSearchParams();
            const sortedKeys = Array.from(urlObj.searchParams.keys()).sort();
            sortedKeys.forEach(key => {
                sortedParams.set(key, urlObj.searchParams.get(key));
            });
            
            urlObj.search = sortedParams.toString();
            
            // 统一使用https协议（如果原本是http的话）
            if (urlObj.protocol === 'http:') {
                urlObj.protocol = 'https:';
            }
            
            // 移除端口号（如果是默认端口）
            if ((urlObj.protocol === 'https:' && urlObj.port === '443') || 
                (urlObj.protocol === 'http:' && urlObj.port === '80')) {
                urlObj.port = '';
            }
            
            // 移除URL末尾的斜杠
            if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
                urlObj.pathname = urlObj.pathname.slice(0, -1);
            }
            
            return urlObj.href;
        } catch (e) {
            console.warn('URL标准化失败:', url, e);
            return url;
        }
    }
    async function downloadImage(url, filename, skipSizeCheck = false) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const blob = await response.blob();
            
            // 计算文件hash进行内容去重检查
            const fileHash = await calculateFileHash(blob);
            if (isFileHashExists(fileHash)) {
                console.log(`跳过重复文件 (hash相同): ${filename}, hash: ${fileHash.substring(0, 16)}...`);
                return { skipped: true, reason: 'duplicate_hash', hash: fileHash };
            }
            
            // 检查文件大小过滤
            if (!skipSizeCheck) {
                const sizeFilterEnabled = document.getElementById('size-filter-option')?.checked ?? true;
                const minSizeKB = parseInt(document.getElementById('min-size-input')?.value || '100');
                const fileSizeKB = blob.size / 1024;
                
                if (sizeFilterEnabled && fileSizeKB < minSizeKB) {
                    console.log(`跳过小文件: ${filename} (${fileSizeKB.toFixed(1)}KB < ${minSizeKB}KB)`);
                    return { skipped: true, reason: 'size', size: fileSizeKB };
                }
            }
            
            const downloadUrl = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // 清理URL对象
            setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
            
            // 下载成功后记录hash
            markFileHashAsDownloaded(fileHash, url);
            
            return { success: true, size: blob.size / 1024, hash: fileHash };
        } catch (error) {
            console.error(`下载失败 ${url}:`, error);
            return { success: false, error: error.message };
        }
    }

    // 自动下载功能
    function startAutoDownload(imageUrls) {
        if (imageUrls.length === 0) {
            console.log('没有检测到图片，跳过自动下载');
            return;
        }
        
        // 自动模式下也进行去重检查
        const filteredUrls = imageUrls.filter(url => {
            return !isAlreadyDownloaded(url);
        });
        
        const duplicateCount = imageUrls.length - filteredUrls.length;
        
        console.log(`自动下载模式：检测到 ${imageUrls.length} 张图片，去重后 ${filteredUrls.length} 张`);
        if (duplicateCount > 0) {
            console.log(`自动模式去重：跳过 ${duplicateCount} 个已下载的图片`);
        }
        
        if (filteredUrls.length === 0) {
            console.log('所有图片都已下载过，跳过自动下载');
            // 仍然启用滚动监听以检测新图片
            enableScrollMonitor();
            return;
        }
        
        const progressContainer = document.getElementById('progress-container');
        const progressText = document.getElementById('progress-text');
        
        if (progressContainer) {
            progressContainer.style.display = 'block';
            let statusText = `🚀 自动下载模式：正在下载 ${filteredUrls.length} 张图片`;
            if (duplicateCount > 0) {
                statusText += `（已去重 ${duplicateCount} 张）`;
            }
            progressText.textContent = statusText;
        }
        
        downloadAllImages(filteredUrls, true);
        
        // 启用滚动监听
        enableScrollMonitor();
    }

    // 检查是否应该触发自动下载
    function checkAutoDownload() {
        if (!autoDownloadEnabled) return;
        
        // 延迟扫描，确保页面完全加载
        autoDownloadTimer = setTimeout(() => {
            const imageUrls = getAllImageUrls();
            if (imageUrls.length > 0) {
                startAutoDownload(imageUrls);
            }
        }, 2000); // 2秒延迟，让动态内容加载完成
    }

    // 取消自动下载定时器
    function cancelAutoDownload() {
        if (autoDownloadTimer) {
            clearTimeout(autoDownloadTimer);
            autoDownloadTimer = null;
        }
    }

    // 滚动监听功能 - 检测新图片并自动下载
    function handleScroll() {
        if (!autoDownloadEnabled || !scrollMonitorEnabled) return;
        
        // 节流处理，避免频繁检测
        if (scrollTimer) {
            clearTimeout(scrollTimer);
        }
        
        scrollTimer = setTimeout(() => {
            checkNewImagesAndDownload();
        }, 500); // 500ms延迟检测
    }

    // 初始化布隆过滤器
    function initializeBloomFilter() {
        try {
            // 尝试从存储中恢复布隆过滤器（存储文件hash）
            const savedFilter = GM_getValue('downloadedHashesBloom', null);
            if (savedFilter) {
                downloadedImagesBloom = BloomFilter.deserialize(savedFilter);
                console.log('文件hash布隆过滤器已从存储中恢复，填充率:', (downloadedImagesBloom.getFillRatio() * 100).toFixed(2) + '%');
            } else {
                downloadedImagesBloom = new BloomFilter(10000, 0.01);
                console.log('创建新的文件hash布隆过滤器');
            }
            
            // 恢复精确检查集合（存储文件hash）
            const savedHashesSet = GM_getValue('downloadedHashesSet', []);
            downloadedHashesSet = new Set(savedHashesSet);
            
            // 恢复 URL 集合（用于快速初步检查）
            const savedUrlsSet = GM_getValue('downloadedUrlsSet', []);
            downloadedUrlsSet = new Set(savedUrlsSet);
            
            console.log(`已加载已下载记录: ${downloadedHashesSet.size} 个hash, ${downloadedUrlsSet.size} 个URL`);
            
        } catch (e) {
            console.error('初始化布隆过滤器失败:', e);
            downloadedImagesBloom = new BloomFilter(10000, 0.01);
            downloadedHashesSet = new Set();
            downloadedUrlsSet = new Set();
        }
    }
    
    // 保存布隆过滤器到存储
    function saveBloomFilter() {
        try {
            GM_setValue('downloadedHashesBloom', downloadedImagesBloom.serialize());
            // 保存最近的1000个hash到精确集合中
            const hashesArray = Array.from(downloadedHashesSet);
            const recentHashes = hashesArray.slice(-1000);
            GM_setValue('downloadedHashesSet', recentHashes);
            
            // 保存最近的1000个URL到URL集合中
            const urlsArray = Array.from(downloadedUrlsSet);
            const recentUrls = urlsArray.slice(-1000);
            GM_setValue('downloadedUrlsSet', recentUrls);
        } catch (e) {
            console.error('保存布隆过滤器失败:', e);
        }
    }
    
    // 计算文件内容的SHA-256哈希值
    async function calculateFileHash(blob) {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
        } catch (e) {
            console.error('计算文件hash失败:', e);
            // 如果hash计算失败，返回一个基于文件大小和时间戳的简单标识
            return `size_${blob.size}_${Date.now()}`;
        }
    }
    
    // 检查文件hash是否已存在（使用布隆过滤器优化）
    function isFileHashExists(fileHash) {
        // 首先使用布隆过滤器进行快速检查
        if (!downloadedImagesBloom.mightContain(fileHash)) {
            // 布隆过滤器说不存在，那就肯定不存在
            return false;
        }
        
        // 布隆过滤器说可能存在，进行精确检查
        // 优先使用内存中的Set进行检查（最快）
        if (downloadedHashesSet.has(fileHash)) {
            return true;
        }
        
        // 如果布隆过滤器说存在但Set中没有，可能是误报
        // 这里我们认为不存在，避免漏下载
        return false;
    }
    
    // 添加文件hash到已下载列表
    function markFileHashAsDownloaded(fileHash, url) {
        // 添加到布隆过滤器
        downloadedImagesBloom.add(fileHash);
        
        // 添加到精确检查集合
        downloadedHashesSet.add(fileHash);
        
        // 同时记录URL（用于快速初步检查）
        const normalizedUrl = normalizeUrl(url);
        downloadedUrlsSet.add(normalizedUrl);
        
        // 定期保存到存储
        if (downloadedHashesSet.size % 50 === 0) {
            saveBloomFilter();
        }
    }
    
    // 检查图片是否已下载（优先使用URL快速检查，然后使用hash精确检查）
    function isAlreadyDownloaded(url) {
        const normalizedUrl = normalizeUrl(url);
        
        // 首先进行URL快速检查（避免重复下载相同URL）
        if (downloadedUrlsSet.has(normalizedUrl)) {
            console.log('URL去重检查: 图片URL已存在:', normalizedUrl);
            return true;
        }
        
        return false; // URL未下载过，继续进行文件内容检查
    }
    
    // 添加图片到已下载列表
    function markAsDownloaded(url) {
        const normalizedUrl = normalizeUrl(url);
        
        console.log('标记为已下载:', normalizedUrl);
        
        // 添加到布隆过滤器
        downloadedImagesBloom.add(normalizedUrl);
        
        // 添加到精确检查集合
        downloadedImagesSet.add(normalizedUrl);
        
        // 定期保存到存储
        if (downloadedImagesSet.size % 20 === 0) {
            saveBloomFilter();
            console.log(`已保存去重数据，当前已下载 ${downloadedImagesSet.size} 张图片`);
        }
    }

    // 检测新图片并下载
    function checkNewImagesAndDownload() {
        const currentImageUrls = getAllImageUrls();
        const newImages = currentImageUrls.filter(url => {
            return !isAlreadyDownloaded(url);
        });
        
        if (newImages.length > 0) {
            console.log(`滚动检测到 ${newImages.length} 张新图片，开始下载...`);
            
            // 更新界面显示
            const imageCount = document.getElementById('image-count');
            const downloadBtn = document.getElementById('download-btn');
            if (imageCount) {
                imageCount.textContent = `检测到 ${currentImageUrls.length} 张图片（+${newImages.length} 新）`;
            }
            if (downloadBtn) {
                downloadBtn.disabled = currentImageUrls.length === 0;
            }
            
            // 下载新图片
            downloadNewImages(newImages);
        }
    }

    // 下载新检测到的图片
    async function downloadNewImages(newImageUrls) {
        const shouldRename = document.getElementById('rename-option')?.checked ?? true;
        let successful = 0;
        let skipped = 0;
        let duplicate = 0;
        
        for (let i = 0; i < newImageUrls.length; i++) {
            const url = newImageUrls[i];
            const baseFilename = getFilenameFromUrl(url, downloadedHashesSet.size + i + 1, shouldRename);
            const filename = ensureUniqueFilename(baseFilename);
            
            // 显示下载状态
            const progressText = document.getElementById('progress-text');
            if (progressText) {
                progressText.textContent = `🔄 滚动检测 - 正在下载: ${filename}`;
                const progressContainer = document.getElementById('progress-container');
                if (progressContainer) {
                    progressContainer.style.display = 'block';
                }
            }
            
            const result = await downloadImage(url, filename);
            if (result.success) {
                successful++;
                // hash已在downloadImage内部记录
            } else if (result.skipped) {
                skipped++;
                if (result.reason === 'duplicate_hash') {
                    duplicate++;
                }
            }
            
            // 添加延迟避免浏览器阻止下载
            if (i < newImageUrls.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        
        // 显示完成状态
        const progressText = document.getElementById('progress-text');
        if (progressText && newImageUrls.length > 0) {
            let statusText = `🔄 滚动检测 - 新下载完成: ${successful}/${newImageUrls.length} 张图片`;
            if (skipped > 0) {
                statusText += ` (跳过${skipped}个小文件`;
                if (duplicate > 0) {
                    statusText += `, 去重${duplicate}个)`;
                } else {
                    statusText += ')';
                }
            } else if (duplicate > 0) {
                statusText += ` (去重${duplicate}个)`;
            }
            progressText.textContent = statusText;
            // 3秒后隐藏提示
            setTimeout(() => {
                const progressContainer = document.getElementById('progress-container');
                if (progressContainer) {
                    progressContainer.style.display = 'none';
                }
            }, 3000);
        }
    }

    // 启用滚动监听
    function enableScrollMonitor() {
        if (scrollMonitorEnabled) return;
        
        scrollMonitorEnabled = true;
        
        // 添加滚动事件监听
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        // 使用 Intersection Observer 监测新元素出现
        if ('IntersectionObserver' in window) {
            observer = new IntersectionObserver((entries) => {
                if (!autoDownloadEnabled || !scrollMonitorEnabled) return;
                
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // 延迟检测，等待懒加载完成
                        setTimeout(() => {
                            checkNewImagesAndDownload();
                        }, 1000);
                    }
                });
            }, {
                rootMargin: '50px' // 提前50px开始检测
            });
            
            // 监测所有图片元素
            document.querySelectorAll('img').forEach(img => {
                observer.observe(img);
            });
            
            // 监测新添加的图片元素
            const mutationObserver = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element node
                            // 监测新添加的img元素
                            if (node.tagName === 'IMG') {
                                observer.observe(node);
                            }
                            // 监测子元素中的img
                            node.querySelectorAll?.('img').forEach(img => {
                                observer.observe(img);
                            });
                        }
                    });
                });
            });
            
            mutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
        
        console.log('🔄 滚动监听已启用 - 支持懒加载和瀑布流图片自动下载');
    }

    // 禁用滚动监听
    function disableScrollMonitor() {
        if (!scrollMonitorEnabled) return;
        
        scrollMonitorEnabled = false;
        
        // 移除滚动事件监听
        window.removeEventListener('scroll', handleScroll);
        
        // 清理定时器
        if (scrollTimer) {
            clearTimeout(scrollTimer);
            scrollTimer = null;
        }
        
        // 清理 Intersection Observer
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        
        console.log('⛔ 滚动监听已禁用');
    }
    // 批量下载图片
    async function downloadAllImages(imageUrls, isAutoMode = false) {
        const progressContainer = document.getElementById('progress-container');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const downloadBtn = document.getElementById('download-btn');
        
        // 无论手动还是自动模式，都进行去重检查
        let filteredUrls = [];
        let duplicateCount = 0;
        
        for (const url of imageUrls) {
            if (!isAlreadyDownloaded(url)) {
                filteredUrls.push(url);
            } else {
                duplicateCount++;
            }
        }
        
        if (duplicateCount > 0) {
            const modeText = isAutoMode ? '自动模式' : '手动模式';
            console.log(`${modeText}去重检查: 跳过 ${duplicateCount} 个已下载的图片`);
        }
        
        progressContainer.style.display = 'block';
        downloadBtn.disabled = true;
        downloadBtn.textContent = isAutoMode ? '自动下载中...' : '下载中...';
        
        let completed = 0;
        let successful = 0;
        let skipped = 0;
        const total = filteredUrls.length;
        
        if (total === 0) {
            let statusText = duplicateCount > 0 ? `所有图片已下载过，跳过 ${duplicateCount} 个重复文件` : '没有可下载的图片';
            progressText.textContent = statusText;
            downloadBtn.disabled = false;
            downloadBtn.textContent = '下载全部';
            setTimeout(() => {
                progressContainer.style.display = 'none';
            }, 3000);
            return;
        }
        
        const shouldRename = document.getElementById('rename-option').checked;
        
        for (let i = 0; i < filteredUrls.length; i++) {
            const url = filteredUrls[i];
            const baseFilename = getFilenameFromUrl(url, i + 1, shouldRename);
            const filename = ensureUniqueFilename(baseFilename);
            
            progressText.textContent = `正在下载: ${filename}`;
            
            const result = await downloadImage(url, filename);
            let duplicate = 0;
            if (result.success) {
                successful++;
                // hash已在downloadImage内部记录
            } else if (result.skipped) {
                skipped++;
                if (result.reason === 'duplicate_hash') {
                    duplicate++;
                }
            }
            
            completed++;
            const percentage = Math.round((completed / total) * 100);
            progressBar.style.width = percentage + '%';
            progressBar.textContent = percentage + '%';
            
            // 添加延迟避免浏览器阻止下载
            if (i < filteredUrls.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        let statusText = `${isAutoMode ? '🚀 自动模式 - ' : ''}下载完成! 成功: ${successful}/${total}`;
        if (skipped > 0) {
            statusText += ` (跳过${skipped}个小文件)`;
        }
        if (duplicateCount > 0) {
            statusText += ` (去重${duplicateCount}个)`;
        }
        progressText.textContent = statusText;
        downloadBtn.disabled = false;
        downloadBtn.textContent = '下载全部';
        
        // 3秒后隐藏进度条（自动模式下5秒）
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, isAutoMode ? 5000 : 3000);
    }

    // 从URL获取文件名
    function getFilenameFromUrl(url, index, shouldRename) {
        try {
            const urlObj = new URL(url);
            let pathname = urlObj.pathname;
            let filename = pathname.split('/').pop();
            
            // 如果启用重命名或没有文件名或文件名不包含扩展名
            if (shouldRename || !filename || !filename.includes('.')) {
                const extension = getImageExtension(url);
                const domain = urlObj.hostname.replace(/^www\./, '');
                // 使用更精确的时间戳 + 索引 + 随机数确保唯一性
                const now = new Date();
                const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '');
                const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
                const random = Math.random().toString(36).substr(2, 4);
                filename = `${domain}_img_${index}_${timestamp}_${milliseconds}_${random}.${extension}`;
            } else {
                // 清理文件名中的特殊字符
                filename = filename.replace(/[<>:"/\\|?*]/g, '_');
                // 为原始文件名也添加唯一标识避免重复
                if (shouldRename) {
                    const extension = getImageExtension(filename);
                    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
                    const random = Math.random().toString(36).substr(2, 4);
                    filename = `${nameWithoutExt}_${random}.${extension}`;
                }
            }
            
            return filename;
        } catch (e) {
            // 备用文件名也要确保唯一性
            const random = Math.random().toString(36).substr(2, 6);
            return `image_${index}_${random}.jpg`;
        }
    }

    // 获取图片扩展名
    function getImageExtension(url) {
        const match = url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)($|\?)/i);
        return match ? match[1].toLowerCase() : 'jpg';
    }
    
    // 确保文件名唯一性
    function ensureUniqueFilename(filename) {
        let uniqueFilename = filename;
        let counter = 1;
        
        // 如果文件名已存在，添加编号
        while (downloadedFilenames.has(uniqueFilename.toLowerCase())) {
            const extension = uniqueFilename.split('.').pop();
            const nameWithoutExt = uniqueFilename.replace(/\.[^/.]+$/, '');
            // 移除之前的编号（如果有）
            const cleanName = nameWithoutExt.replace(/_\d+$/, '');
            uniqueFilename = `${cleanName}_${counter}.${extension}`;
            counter++;
            
            // 避免无限循环
            if (counter > 1000) {
                const random = Math.random().toString(36).substr(2, 8);
                uniqueFilename = `${cleanName}_${random}.${extension}`;
                break;
            }
        }
        
        // 记录该文件名
        downloadedFilenames.add(uniqueFilename.toLowerCase());
        console.log('生成唯一文件名:', uniqueFilename);
        
        return uniqueFilename;
    }

    // 初始化脚本
    function init() {
        // 等待页面完全加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        const container = createUI();
        let imageUrls = [];

        // 扫描按钮事件
        document.getElementById('scan-btn').addEventListener('click', () => {
            imageUrls = getAllImageUrls();
            const imageCount = document.getElementById('image-count');
            const downloadBtn = document.getElementById('download-btn');
            const downloadedCount = document.getElementById('downloaded-count');
            
            imageCount.textContent = `检测到 ${imageUrls.length} 张图片`;
            downloadBtn.disabled = imageUrls.length === 0;
            
            // 更新已下载计数
            if (downloadedCount) {
                downloadedCount.textContent = `(已下载: ${downloadedHashesSet.size})`;
            }
        });

        // 下载按钮事件
        document.getElementById('download-btn').addEventListener('click', () => {
            if (imageUrls.length > 0) {
                downloadAllImages(imageUrls);
            }
        });

        // 自动下载模式切换事件
        document.getElementById('auto-download-option').addEventListener('change', (e) => {
            autoDownloadEnabled = e.target.checked;
            GM_setValue('autoDownloadEnabled', autoDownloadEnabled);
            
            const autoStatus = document.getElementById('auto-status');
            const label = e.target.nextElementSibling;
            
            if (autoDownloadEnabled) {
                autoStatus.style.display = 'block';
                autoStatus.textContent = '🔑 自动下载已启用 - 支持滚动检测懒加载图片';
                label.style.color = '#28a745';
                label.style.fontWeight = 'bold';
                console.log('🚀 自动下载模式已启用（含滚动监听）');
                // 开启自动模式后，立即检查当前页面
                checkAutoDownload();
            } else {
                autoStatus.style.display = 'none';
                label.style.color = '#333';
                label.style.fontWeight = 'normal';
                console.log('⛔ 自动下载模式已关闭');
                // 关闭自动模式时，取消待处理的下载和滚动监听
                cancelAutoDownload();
                disableScrollMonitor();
                // 清空已下载记录
                downloadedImagesBloom.clear();
                downloadedHashesSet.clear();
                downloadedUrlsSet.clear();
            }
        });

        // 关闭按钮事件
        document.getElementById('close-btn').addEventListener('click', () => {
            cancelAutoDownload();
            disableScrollMonitor();
            container.remove();
        });
        
        // 清空历史记录按钮事件
        document.getElementById('clear-history-btn').addEventListener('click', () => {
            if (confirm('确定要清空所有已下载记录吗？这将允许重新下载之前下载过的图片。')) {
                // 清空布隆过滤器和集合
                downloadedImagesBloom.clear();
                downloadedHashesSet.clear();
                downloadedUrlsSet.clear();
                
                // 清空存储
                GM_setValue('downloadedHashesBloom', null);
                GM_setValue('downloadedHashesSet', []);
                GM_setValue('downloadedUrlsSet', []);
                
                // 更新界面显示
                const downloadedCount = document.getElementById('downloaded-count');
                if (downloadedCount) {
                    downloadedCount.textContent = '(已下载: 0)';
                }
                
                console.log('✨ 已清空所有下载记录');
                alert('已清空下载记录！');
            }
        });

        // 自动扫描一次
        setTimeout(() => {
            document.getElementById('scan-btn').click();
        }, 1000);
        
        // 初始化布隆过滤器
        initializeBloomFilter();
        
        // 如果开启了自动下载模式，则检查是否需要自动下载
        if (autoDownloadEnabled) {
            checkAutoDownload();
        }
    }

    // 启动脚本
    init();

})();