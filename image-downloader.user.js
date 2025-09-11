// ==UserScript==
// @name         网页图片批量下载器
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  自动检测并下载当前网页中的所有图片资源，支持自动下载模式
// @author       You
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 全局变量
    let autoDownloadEnabled = GM_getValue('autoDownloadEnabled', false);
    let autoDownloadTimer = null;

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
            </div>
            <div style="margin-bottom: 10px;">
                <button id="scan-btn" style="
                    background: #007cba;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-right: 8px;
                ">扫描图片</button>
                <button id="download-btn" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-right: 8px;
                " disabled>下载全部</button>
                <button id="close-btn" style="
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">关闭</button>
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

    // 下载单个图片
    async function downloadImage(url, filename) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const blob = await response.blob();
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
            
            return true;
        } catch (error) {
            console.error(`下载失败 ${url}:`, error);
            return false;
        }
    }

    // 自动下载功能
    function startAutoDownload(imageUrls) {
        if (imageUrls.length === 0) {
            console.log('没有检测到图片，跳过自动下载');
            return;
        }
        
        console.log(`自动下载模式：开始下载 ${imageUrls.length} 张图片`);
        const progressContainer = document.getElementById('progress-container');
        const progressText = document.getElementById('progress-text');
        
        if (progressContainer) {
            progressContainer.style.display = 'block';
            progressText.textContent = '🚀 自动下载模式：正在下载图片...';
        }
        
        downloadAllImages(imageUrls, true);
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
    // 批量下载图片
    async function downloadAllImages(imageUrls, isAutoMode = false) {
        const progressContainer = document.getElementById('progress-container');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const downloadBtn = document.getElementById('download-btn');
        
        progressContainer.style.display = 'block';
        downloadBtn.disabled = true;
        downloadBtn.textContent = isAutoMode ? '自动下载中...' : '下载中...';
        
        let completed = 0;
        let successful = 0;
        const total = imageUrls.length;
        
        const shouldRename = document.getElementById('rename-option').checked;
        
        for (let i = 0; i < imageUrls.length; i++) {
            const url = imageUrls[i];
            const filename = getFilenameFromUrl(url, i + 1, shouldRename);
            
            progressText.textContent = `正在下载: ${filename}`;
            
            const success = await downloadImage(url, filename);
            if (success) successful++;
            
            completed++;
            const percentage = Math.round((completed / total) * 100);
            progressBar.style.width = percentage + '%';
            progressBar.textContent = percentage + '%';
            
            // 添加延迟避免浏览器阻止下载
            if (i < imageUrls.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        progressText.textContent = `${isAutoMode ? '🚀 自动模式 - ' : ''}下载完成! 成功: ${successful}/${total}`;
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
                const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
                filename = `${domain}_image_${index}_${timestamp}.${extension}`;
            } else {
                // 清理文件名中的特殊字符
                filename = filename.replace(/[<>:"/\\|?*]/g, '_');
            }
            
            return filename;
        } catch (e) {
            return `image_${index}.jpg`;
        }
    }

    // 获取图片扩展名
    function getImageExtension(url) {
        const match = url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)($|\?)/i);
        return match ? match[1].toLowerCase() : 'jpg';
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
            
            imageCount.textContent = `检测到 ${imageUrls.length} 张图片`;
            downloadBtn.disabled = imageUrls.length === 0;
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
                label.style.color = '#28a745';
                label.style.fontWeight = 'bold';
                console.log('🚀 自动下载模式已启用');
                // 开启自动模式后，立即检查当前页面
                checkAutoDownload();
            } else {
                autoStatus.style.display = 'none';
                label.style.color = '#333';
                label.style.fontWeight = 'normal';
                console.log('⛔ 自动下载模式已关闭');
                // 关闭自动模式时，取消待处理的下载
                cancelAutoDownload();
            }
        });

        // 关闭按钮事件
        document.getElementById('close-btn').addEventListener('click', () => {
            cancelAutoDownload();
            container.remove();
        });

        // 自动扫描一次
        setTimeout(() => {
            document.getElementById('scan-btn').click();
        }, 1000);
        
        // 如果开启了自动下载模式，则检查是否需要自动下载
        if (autoDownloadEnabled) {
            checkAutoDownload();
        }
    }

    // 启动脚本
    init();

})();