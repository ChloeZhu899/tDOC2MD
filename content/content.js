/**
 * 腾讯文档转Markdown插件 - 内容脚本
 * 负责在腾讯文档页面中注入功能
 */

// 防止重复加载
if (window.TENCENT_DOC_CONTENT_LOADED) {
  console.log('TencentDocExtractor: Content script already loaded, skipping...');
} else {

// 等待所有依赖加载完成
const waitForDependencies = () => {
  return new Promise((resolve) => {
    const checkDependencies = () => {
      if (window.ExtractorState && window.ExtensionConfig && window.HTMLToMarkdownParserLite) {
        resolve();
      } else {
        setTimeout(checkDependencies, 100);
      }
    };
    checkDependencies();
  });
};

class TencentDocExtractor {
  constructor() {
    // 如果已存在实例，先销毁
    if (window.tencentDocExtractorInstance) {
      console.log('TencentDocExtractor: Destroying existing instance');
      window.tencentDocExtractorInstance.destroy();
    }
    
    // 初始化状态
    this.state = window.ExtractorState?.UNINITIALIZED || 'uninitialized';
    this.stateHistory = [];
    this.isInitialized = false;
    this.sidebar = null;
    this.observer = null;
    this.messageListener = null;
    this.errorCounts = {};
    this.maxErrorThreshold = window.ExtensionConfig?.errorHandling?.maxErrorThreshold || 5;
    this.parser = null;
    this.currentMarkdown = '';
    
    console.log('TencentDocExtractor: Instance created');
  }

  // 异步初始化
  async initializeAsync() {
    try {
      console.log('TencentDocExtractor: Starting async initialization...');
      
      // 等待依赖加载
      await waitForDependencies();
      console.log('TencentDocExtractor: Dependencies loaded');
      
      // 设置消息监听器
      this.setupMessageListener();
      
      // 根据DOM状态决定初始化时机
      if (document.readyState === 'loading') {
        console.log('TencentDocExtractor: DOM is loading, adding DOMContentLoaded listener');
        document.addEventListener('DOMContentLoaded', async () => await this.init());
      } else {
        console.log('TencentDocExtractor: DOM already loaded, calling init directly');
        await this.init();
      }
    } catch (error) {
      this.logError('initialization', error, { method: 'initializeAsync' });
    }
  }

  // 状态管理方法
  setState(newState, reason = '') {
    const oldState = this.state;
    this.state = newState;
    this.stateHistory.push({ 
      from: oldState, 
      to: newState, 
      reason, 
      timestamp: Date.now() 
    });
    
    if (window.ExtensionConfig?.debug?.logStateTransitions) {
      console.log(`TencentDocExtractor State: ${oldState} -> ${newState}`, reason);
    }
  }

  // 错误记录方法
  logError(category, error, context = {}) {
    const errorCategory = window.ExtensionConfig?.errorHandling?.errorCategories?.[category] || category;
    this.errorCounts[errorCategory] = (this.errorCounts[errorCategory] || 0) + 1;
    
    if (window.ExtensionConfig?.debug?.logErrors) {
      console.error(`TencentDocExtractor[${errorCategory}]: ${error.message || error}`, {
        context,
        errorCount: this.errorCounts[errorCategory],
        timestamp: new Date().toISOString(),
        stack: error.stack
      });
    }
    
    // 检查错误阈值
    if (this.errorCounts[errorCategory] >= this.maxErrorThreshold) {
      console.error(`TencentDocExtractor: Too many ${errorCategory} errors (${this.errorCounts[errorCategory]}), setting state to ERROR`);
      this.setState(window.ExtractorState.ERROR, `Too many ${errorCategory} errors`);
    }
  }

  // 初始化HTML解析器
  initializeParser() {
    if (!window.HTMLToMarkdownParserLite) {
      throw new Error('HTMLToMarkdownParserLite class not found');
    }
    this.parser = new window.HTMLToMarkdownParserLite();
    console.log('✅ HTML解析器初始化成功');
  }

  // 清理方法
  destroy() {
    console.log('TencentDocExtractor: Starting cleanup...');
    
    // 清理事件监听器
    if (this.messageListener) {
      try {
        chrome.runtime.onMessage.removeListener(this.messageListener);
        console.log('TencentDocExtractor: Message listener removed');
      } catch (e) {
        console.warn('TencentDocExtractor: Error removing message listener:', e);
      }
    }
    
    // 清理DOM观察器
    if (this.observer) {
      this.observer.disconnect();
      console.log('TencentDocExtractor: Observer disconnected');
    }
    
    // 清理侧边栏
    if (this.sidebar && this.sidebar.parentNode) {
      this.sidebar.parentNode.removeChild(this.sidebar);
      console.log('TencentDocExtractor: Sidebar removed');
    }
    
    // 清理性能监控数据（如果存在）
    if (window.PerformanceMonitor?.clearMetrics) {
      window.PerformanceMonitor.clearMetrics();
    }
    
    // 重置状态
    this.setState(window.ExtractorState?.DESTROYED || 'destroyed', 'Instance destroyed');
    this.isInitialized = false;
    
    console.log('TencentDocExtractor: Cleanup completed');
  }

  // 简单的页面准备检查
  async waitForPageReady() {
    return new Promise((resolve) => {
      // 检查页面是否已加载
      if (document.readyState === 'complete') {
        resolve();
        return;
      }
      
      // 如果页面还在加载，等待加载完成
      const checkReady = () => {
        if (document.readyState === 'complete') {
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      
      checkReady();
    });
  }

  // 初始化
  async init() {
    try {
      console.log('🚀 TencentDocExtractor 初始化开始...');
      
      // 初始化解析器
      this.parser = new HTMLToMarkdownParserLite();
      
      // 添加调试方法
      this.setupDebugMethods();
      
      // 检查页面状态
      await this.waitForPageReady();
      
      // 创建侧边栏
      this.createSidebar();
      
      // 添加快捷键支持
      this.setupKeyboardShortcuts();
      
      console.log('✅ TencentDocExtractor 初始化完成');
      
    } catch (error) {
      this.logError('init', error);
      console.error('❌ TencentDocExtractor 初始化失败:', error);
    }
  }

  // 初始化扩展功能
  async initializeExtension() {
    if (this.isInitialized) {
      console.log('TencentDocExtractor: 扩展功能已初始化，跳过');
      this.setState(window.ExtractorState?.READY || 'ready', 'Already initialized');
      return;
    }
    
    console.log('🚀 开始初始化扩展功能...');
    
    try {
      // 创建侧边栏
      console.log('📋 创建侧边栏...');
      this.createSidebar();
      
      // 设置页面监听器
      console.log('👀 设置页面监听器...');
      this.setupPageObserver();
      
      // 初始化解析器
      console.log('🔧 初始化HTML解析器...');
      this.initializeParser();
      
      // 设置键盘快捷键
      console.log('⌨️ 设置键盘快捷键...');
      this.setupKeyboardShortcuts();
      
      console.log('✅ 腾讯文档转Markdown插件初始化完成！');
      console.log('💡 使用方法:');
      console.log('  - 点击扩展图标打开侧边栏');
      console.log('  - 快捷键 Ctrl/Cmd+Shift+M 切换侧边栏');
      console.log('  - 快捷键 Ctrl/Cmd+Shift+C 转换为Markdown');
      
      this.isInitialized = true;
      this.setState(window.ExtractorState?.READY || 'ready', 'Initialization completed successfully');
    } catch (error) {
      this.logError('initialization', error, { method: 'initializeExtension' });
      this.setState(window.ExtractorState?.ERROR || 'error', 'Initialization failed');
    }
  }

  // 创建侧边栏
  createSidebar() {
    // 检查是否已存在侧边栏
    if (document.querySelector('.tdm-sidebar')) {
      console.log('TencentDocExtractor: 侧边栏已存在，跳过创建');
      this.sidebar = document.querySelector('.tdm-sidebar');
      return;
    }

    // 创建侧边栏容器
    this.sidebar = document.createElement('div');
    this.sidebar.className = 'tdm-sidebar';
    this.sidebar.innerHTML = `
      <div class="tdm-sidebar-header">
        <div class="tdm-title">
          <span class="tdm-icon">📝</span>
          腾讯文档转Markdown
        </div>
        <button class="tdm-close-btn" title="关闭">&times;</button>
      </div>
      <div class="tdm-sidebar-content">
        <div class="tdm-action-section">
          <button class="tdm-convert-btn" title="转换为Markdown">
            <span class="tdm-btn-icon">🔄</span>
            转换为Markdown
          </button>
        </div>
        <div class="tdm-preview-section">
          <div class="tdm-preview-header">
            <div class="tdm-preview-title">预览</div>
            <div class="tdm-preview-actions">
              <button class="tdm-copy-btn" title="复制到剪贴板" disabled>
                <span class="tdm-copy-icon">📋</span>
                复制
              </button>
              <button class="tdm-export-btn" title="导出MD文件" disabled>
                <span class="tdm-export-icon">💾</span>
                导出MD
              </button>
            </div>
          </div>
          <div class="tdm-preview-content">
            <div class="tdm-placeholder">
              <div class="tdm-placeholder-icon">📄</div>
              <div class="tdm-placeholder-text">点击转换按钮开始</div>
            </div>
            <div class="tdm-loading" style="display: none;">
              <div class="tdm-loading-spinner"></div>
              <div class="tdm-loading-text">正在转换...</div>
            </div>
            <textarea class="tdm-markdown-content" style="display: none;" placeholder="转换结果将显示在这里..." readonly></textarea>
          </div>
        </div>
        <div class="tdm-status-section">
          <div class="tdm-status tdm-status-info">准备就绪</div>
        </div>
      </div>
    `;

    // 添加到页面
    document.body.appendChild(this.sidebar);

    // 绑定事件
    this.bindSidebarEvents();
    
    // 强制确保关闭按钮存在和可见
    this.ensureCloseButton();
    
    console.log('✅ 侧边栏创建完成');
  }

  // 绑定侧边栏事件
  bindSidebarEvents() {
    const closeBtn = this.sidebar.querySelector('.tdm-close-btn');
    const convertBtn = this.sidebar.querySelector('.tdm-convert-btn');
    const copyBtn = this.sidebar.querySelector('.tdm-copy-btn');
    const exportBtn = this.sidebar.querySelector('.tdm-export-btn');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideSidebar());
    }
    convertBtn.addEventListener('click', () => this.convertToMarkdown(false));
    copyBtn.addEventListener('click', () => this.copyToClipboard());
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportToFile());
    }
  }

  // 强制确保关闭按钮存在
  ensureCloseButton() {
    let closeBtn = this.sidebar.querySelector('.tdm-close-btn');
    
    if (!closeBtn) {
      console.log('⚠️ 关闭按钮未找到，创建备用关闭按钮');
      closeBtn = document.createElement('button');
      closeBtn.className = 'tdm-close-btn';
      closeBtn.title = '关闭侧边栏';
      closeBtn.innerHTML = '✕';
      
      const header = this.sidebar.querySelector('.tdm-sidebar-header');
      if (header) {
        header.appendChild(closeBtn);
      }
    }
    
    // 确保关闭按钮可见
    if (closeBtn) {
      closeBtn.style.cssText = `
        width: 28px !important;
        height: 28px !important;
        border: 1px solid #dc3545 !important;
        background: #f8f9fa !important;
        border-radius: 50% !important;
        font-size: 16px !important;
        font-weight: bold !important;
        color: #dc3545 !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        position: absolute !important;
        top: 12px !important;
        right: 12px !important;
        z-index: 10000 !important;
        opacity: 1 !important;
        visibility: visible !important;
      `;
      
      // 确保事件绑定
      closeBtn.onclick = () => {
        console.log('🔄 关闭按钮被点击');
        this.hideSidebar();
      };
      
      // 添加悬停效果
      closeBtn.addEventListener('mouseover', () => {
        closeBtn.style.background = '#dc3545';
        closeBtn.style.color = 'white';
      });
      
      closeBtn.addEventListener('mouseout', () => {
        closeBtn.style.background = '#f8f9fa';
        closeBtn.style.color = '#dc3545';
      });
      
      console.log('✅ 关闭按钮已确保存在和可见');
    }
    
    // 添加ESC键支持
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.sidebar && this.sidebar.classList.contains('tdm-sidebar-visible')) {
        event.preventDefault();
        this.hideSidebar();
      }
    });
  }

  // 设置页面观察器
  setupPageObserver() {
    // 观察页面变化
    this.observer = new MutationObserver((mutations) => {
      // 处理页面变化
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // 页面内容发生变化时的处理逻辑
        }
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('✅ 页面观察器设置完成');
  }

  // 设置消息监听器
  setupMessageListener() {
    this.messageListener = (request, sender, sendResponse) => {
      console.log('TencentDocExtractor: 收到消息:', request);
      
      switch (request.action) {
        case 'openSidebar':
          this.showSidebar();
          sendResponse({ success: true });
          break;
        case 'closeSidebar':
          this.hideSidebar();
          sendResponse({ success: true });
          break;
        case 'toggleSidebar':
          this.toggleSidebar();
          sendResponse({ success: true });
          break;
        case 'convertToMarkdown':
          this.convertToMarkdown(request.isQuick || false)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true; // 保持消息通道开放
        default:
          console.warn('TencentDocExtractor: 未知消息类型:', request.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
    };

    chrome.runtime.onMessage.addListener(this.messageListener);
    console.log('✅ 消息监听器设置完成');
  }

  // 设置键盘快捷键
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      // Ctrl/Cmd + Shift + M: 切换侧边栏
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'M') {
        event.preventDefault();
        this.toggleSidebar();
      }
      
      // Ctrl/Cmd + Shift + C: 转换为Markdown
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'C') {
        event.preventDefault();
        this.convertToMarkdown(false);
      }
    });
    
    console.log('✅ 键盘快捷键设置完成');
  }

  // 显示侧边栏
  showSidebar() {
    if (this.sidebar) {
      this.sidebar.classList.add('tdm-sidebar-visible');
      console.log('TencentDocExtractor: 侧边栏已显示');
    }
  }

  // 隐藏侧边栏
  hideSidebar() {
    if (this.sidebar) {
      this.sidebar.classList.remove('tdm-sidebar-visible');
      console.log('TencentDocExtractor: 侧边栏已隐藏');
    }
  }

  // 切换侧边栏
  toggleSidebar() {
    if (!this.sidebar.classList.contains('tdm-sidebar-visible')) {
      this.showSidebar();
    } else {
      this.hideSidebar();
    }
  }

  // 转换为Markdown
  async convertToMarkdown(isQuickConvert = false) {
    try {
      // 检查解析器是否已初始化
      if (!this.parser) {
        console.warn('HTML解析器未初始化，尝试强制初始化...');
        try {
          if (window.HTMLToMarkdownParserLite) {
            this.parser = new window.HTMLToMarkdownParserLite();
            console.log('✅ HTML解析器强制初始化成功');
          } else {
            throw new Error('HTMLToMarkdownParserLite类不可用，请检查parser-lite.js是否正确加载');
          }
        } catch (initError) {
          this.logError('initialization', initError, { method: 'convertToMarkdown', step: 'forceInitParser' });
          throw new Error(`HTML解析器初始化失败: ${initError.message}`);
        }
      }
      
      // 显示加载状态
      this.showLoading();
      
      // 重置解析器状态
      this.parser.resetCounters();
      
      // 等待DOM稳定
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 执行转换
      const result = this.parser.parseHTMLContent();
      
      if (result.success) {
        if (!isQuickConvert) {
          this.showResult(result.markdown);
          // 存储markdown用于导出
          this.currentMarkdown = result.markdown;
        }
        
        // 如果是快速转换，直接复制到剪贴板
        if (isQuickConvert) {
          await this.copyToClipboard(result.markdown);
          this.showStatus('✅ 已复制到剪贴板', 'success');
        } else {
          this.showStatus('✅ 转换完成', 'success');
        }
        
        console.log('✅ Markdown转换成功');
      } else {
        throw new Error(result.error || '转换失败');
      }
    } catch (error) {
      this.logError('conversion', error, { method: 'convertToMarkdown', isQuickConvert });
      this.showStatus(`❌ 转换失败: ${error.message}`, 'error');
      console.error('❌ Markdown转换失败:', error);
    } finally {
      this.hideLoading();
    }
  }

  // 显示加载状态
  showLoading() {
    const placeholder = this.sidebar.querySelector('.tdm-placeholder');
    const loading = this.sidebar.querySelector('.tdm-loading');
    const content = this.sidebar.querySelector('.tdm-markdown-content');
    const statusElement = this.sidebar.querySelector('.tdm-status');
    
    if (placeholder) placeholder.style.display = 'none';
    if (loading) loading.style.display = 'flex';
    if (content) content.style.display = 'none';
    
    if (statusElement) {
      statusElement.textContent = '正在转换...';
      statusElement.className = 'tdm-status tdm-status-info';
    }
    
    // 禁用按钮
    const buttons = this.sidebar.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = true);
  }

  // 隐藏加载状态
  hideLoading() {
    const loading = this.sidebar.querySelector('.tdm-loading');
    if (loading) loading.style.display = 'none';
    
    // 启用按钮
    const buttons = this.sidebar.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = false);
    
    // 检查是否有结果来决定复制和导出按钮状态
    const resultTextarea = this.sidebar.querySelector('.tdm-markdown-content');
    const copyBtn = this.sidebar.querySelector('.tdm-copy-btn');
    const exportBtn = this.sidebar.querySelector('.tdm-export-btn');
    
    if (resultTextarea && resultTextarea.value.trim()) {
      copyBtn.disabled = false;
      if (exportBtn) exportBtn.disabled = false;
    } else {
      copyBtn.disabled = true;
      if (exportBtn) exportBtn.disabled = true;
    }
  }

  // 显示结果
  showResult(markdown) {
    const placeholder = this.sidebar.querySelector('.tdm-placeholder');
    const loading = this.sidebar.querySelector('.tdm-loading');
    const content = this.sidebar.querySelector('.tdm-markdown-content');
    
    if (placeholder) placeholder.style.display = 'none';
    if (loading) loading.style.display = 'none';
    if (content) {
      content.style.display = 'block';
      content.value = markdown;
    }
  }

  // 显示状态
  showStatus(message, type = 'info') {
    const statusElement = this.sidebar.querySelector('.tdm-status');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `tdm-status tdm-status-${type}`;
      
      // 3秒后恢复默认状态
      setTimeout(() => {
        statusElement.textContent = '准备就绪';
        statusElement.className = 'tdm-status tdm-status-info';
      }, 3000);
    }
  }

  // 复制到剪贴板
  async copyToClipboard(text = null) {
    try {
      const textToCopy = text || this.sidebar.querySelector('.tdm-markdown-content').value;
      
      if (!textToCopy.trim()) {
        this.showStatus('没有内容可复制', 'error');
        return;
      }
      
      await navigator.clipboard.writeText(textToCopy);
      
      // 更新复制按钮状态
      const copyBtn = this.sidebar.querySelector('.tdm-copy-btn');
      if (copyBtn) {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<span class="tdm-copy-icon">✓</span>已复制';
        copyBtn.classList.add('tdm-copied');
        
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
          copyBtn.classList.remove('tdm-copied');
        }, 2000);
      }
      
      this.showStatus('已复制到剪贴板', 'success');
      console.log('✅ 内容已复制到剪贴板');
    } catch (error) {
      this.logError('clipboard', error, { method: 'copyToClipboard' });
      this.showStatus('复制失败', 'error');
      console.error('❌ 复制到剪贴板失败:', error);
    }
  }

  // 获取页面标题
  getPageTitle() {
    // 尝试多种方式获取页面标题
    const titleSelectors = [
      '.sc-page-title',
      '[data-testid="page-title"]',
      'h1',
      'title'
    ];
    
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    
    // 最后使用document.title
    return document.title || '腾讯文档导出';
  }

  // 导出到文件（简化版，仅导出MD）
  async exportToFile() {
    if (!this.currentMarkdown) {
      this.showStatus('没有可导出的内容', 'error');
      return;
    }

    try {
      // 获取页面标题
      const title = this.getPageTitle();
      const cleanTitle = title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').trim() || '腾讯文档导出';

      // 直接导出MD文件
      await this.exportMarkdownOnly(cleanTitle, this.currentMarkdown);

    } catch (error) {
      this.logError('export', error, { method: 'exportToFile' });
      this.showStatus('导出失败', 'error');
      console.error('❌ 导出失败:', error);
    }
  }

  // 仅导出Markdown文件
  async exportMarkdownOnly(cleanTitle, markdown) {
    // 创建Blob
    const blob = new Blob([markdown], {
      type: 'text/markdown;charset=utf-8'
    });
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cleanTitle}.md`;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 清理对象URL
    URL.revokeObjectURL(url);
    
    this.updateExportButtonSuccess();
    this.showStatus(`✅ 已导出: ${cleanTitle}.md`, 'success');
    console.log('✅ Markdown文件已导出:', `${cleanTitle}.md`);
  }

  // 更新导出按钮成功状态
  updateExportButtonSuccess() {
    const exportBtn = this.sidebar.querySelector('.tdm-export-btn');
    if (exportBtn) {
      const originalHTML = exportBtn.innerHTML;
      exportBtn.innerHTML = '<span class="tdm-export-icon">✓</span>已导出';
      exportBtn.classList.add('tdm-exported');
      
      setTimeout(() => {
        exportBtn.innerHTML = originalHTML;
        exportBtn.classList.remove('tdm-exported');
      }, 3000);
    }
  }

  // 下载Markdown文件（保留旧方法兼容性）
  downloadMarkdown() {
    this.exportToFile();
  }

  // 测试表格图片解析（调试用）
  testTableImageParsing() {
    console.log('🧪 开始测试表格图片解析...');
    
    // 查找页面中的表格
    const tables = document.querySelectorAll('.sc-block-simple_table, .sc-block-table');
    console.log(`📊 找到 ${tables.length} 个表格`);
    
    tables.forEach((table, index) => {
      console.log(`\n🔍 测试表格 ${index + 1}:`);
      
      // 检查表格中的图片容器
      const imageContainers = table.querySelectorAll('.sc-table-image-item-container');
      console.log(`  📸 找到 ${imageContainers.length} 个图片容器`);
      
      imageContainers.forEach((container, imgIndex) => {
        const imageId = container.getAttribute('data-imageid');
        console.log(`    图片容器 ${imgIndex + 1}: data-imageid="${imageId || '无'}"`);
        
        // 检查是否有实际的img标签
        const img = container.querySelector('img');
        if (img && img.src) {
          console.log(`      ✅ 有img标签: ${img.src.substring(0, 60)}...`);
          console.log(`      Alt: ${img.alt || '无'}`);
        } else {
          console.log(`      ❌ 没有img标签`);
          
          // 检查是否是加载中的骨架屏
          const loadingSkeleton = container.querySelector('.react-loading-skeleton');
          if (loadingSkeleton) {
            console.log(`      🔄 发现加载中的骨架屏`);
          }
          
          // 检查是否有背景图
          const containerStyle = container.style.backgroundImage;
          if (containerStyle && containerStyle.includes('url(')) {
            console.log(`      🖼️ 发现背景图: ${containerStyle.substring(0, 60)}...`);
          }
          
          // 列出容器内的所有子元素
          const children = container.children;
          console.log(`      📦 容器内有 ${children.length} 个子元素:`);
          for (let i = 0; i < children.length && i < 3; i++) {
            console.log(`        - ${children[i].tagName}.${children[i].className.substring(0, 30)}...`);
          }
        }
      });
      
      // 测试解析结果
      try {
        const result = this.parser.parseTable(table);
        console.log(`  ✅ 解析结果 (前150字符): ${result.substring(0, 150)}...`);
        
        // 检查是否包含图片Markdown语法
        const imageCount = (result.match(/!\[.*?\]\(.*?\)/g) || []).length;
        const placeholderCount = (result.match(/图片加载中|图片占位符/g) || []).length;
        console.log(`  📸 Markdown中找到 ${imageCount} 个图片, ${placeholderCount} 个占位符`);
        
        // 如果有占位符，显示详细信息
        if (placeholderCount > 0) {
          const placeholders = result.match(/!\[[^\]]*?\]\([^)]*?"图片ID: [^"]*?"\)/g) || [];
          placeholders.forEach((placeholder, i) => {
            console.log(`    占位符 ${i + 1}: ${placeholder}`);
          });
        }
      } catch (error) {
        console.error(`  ❌ 解析失败:`, error);
      }
    });
    
    console.log('\n🎯 表格图片解析测试完成');
    
    // 额外建议
    console.log('\n💡 建议:');
    console.log('  - 如果看到"图片加载中"，请等待页面完全加载后再次转换');
    console.log('  - 如果看到"图片占位符"，可能需要手动刷新页面');
    console.log('  - 尝试滚动到图片位置确保它们被加载');
  }

  // 等待图片加载完成
  async waitForImagesLoad(timeout = 10000) {
    console.log('⏳ 等待页面图片加载完成...');
    
    const startTime = Date.now();
    let lastLoadingCount = -1;
    
    while (Date.now() - startTime < timeout) {
      // 检查加载中的图片数量
      const loadingSkeletons = document.querySelectorAll('.sc-table-image-item-container .react-loading-skeleton');
      const currentLoadingCount = loadingSkeletons.length;
      
      console.log(`📊 当前加载中的图片: ${currentLoadingCount}`);
      
      // 如果没有加载中的图片，或者数量不再变化（可能加载失败）
      if (currentLoadingCount === 0) {
        console.log('✅ 所有图片加载完成');
        return true;
      }
      
      // 如果加载数量连续几次没有变化，可能是加载卡住了
      if (currentLoadingCount === lastLoadingCount) {
        console.log('⚠️ 图片加载可能已停滞');
        break;
      }
      
      lastLoadingCount = currentLoadingCount;
      
      // 等待500ms后再检查
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('⏰ 等待超时或加载停滞，继续转换...');
    return false;
  }

  // 智能转换 - 等待图片加载后再转换
  async smartConvertToMarkdown() {
    try {
      // 显示加载状态
      this.showStatus('正在等待图片加载...', 'info');
      
      // 等待图片加载
      await this.waitForImagesLoad(8000);
      
      // 执行正常的转换
      await this.convertToMarkdown(false);
      
    } catch (error) {
      console.error('智能转换失败:', error);
      this.showStatus('转换失败', 'error');
    }
  }

  // 配置思维导图处理方式
  configureMindMapHandling(mode = 'simple') {
    // 设置全局配置
    window.mindMapMode = mode;
    
    console.log('🧠 思维导图处理模式配置:');
    switch (mode) {
      case 'skip':
        console.log('  模式: 完全跳过（不生成任何内容）');
        break;
      case 'simple':
        console.log('  模式: 简单标记（生成一行文字标记）');
        break;
      case 'placeholder':
        console.log('  模式: 图片占位符（生成Markdown图片语法）');
        break;
      default:
        console.log('  ⚠️ 未知模式，使用默认模式（简单标记）');
        window.mindMapMode = 'simple';
    }
    
    console.log('\n💡 使用方法:');
    console.log('  - window.configureMindMap("skip") : 完全跳过');
    console.log('  - window.configureMindMap("simple") : 简单标记（默认）');
    console.log('  - window.configureMindMap("placeholder") : 图片占位符');
  }

  // 在控制台中暴露测试方法
  setupDebugMethods() {
    window.testTableImages = () => this.testTableImageParsing();
    window.testMindMaps = () => this.testMindMapParsing();
    window.configureMindMap = (mode) => this.configureMindMapHandling(mode);
    window.smartConvert = () => this.smartConvertToMarkdown();
    window.waitForImages = (timeout) => this.waitForImagesLoad(timeout);
    
    console.log('🔧 调试方法已添加:');
    console.log('  - window.testTableImages() : 测试表格图片识别');
    console.log('  - window.testMindMaps() : 测试思维导图识别');
    console.log('  - window.configureMindMap(mode) : 配置思维导图处理方式');
    console.log('  - window.smartConvert() : 智能转换（等待图片加载）');
    console.log('  - window.waitForImages(timeout) : 等待图片加载');
    
    // 设置默认的思维导图处理模式
    this.configureMindMapHandling('simple');
  }

  // 测试思维导图解析（调试用）- 简化版
  testMindMapParsing() {
    console.log('🧠 测试思维导图解析（简化版）...');
    
    // 查找页面中的思维导图
    const mindMaps = document.querySelectorAll('.sc-block-hina_mind_map');
    console.log(`🧠 找到 ${mindMaps.length} 个思维导图`);
    
    if (mindMaps.length === 0) {
      console.log('ℹ️ 当前页面没有思维导图');
      return;
    }
    
    mindMaps.forEach((mindMap, index) => {
      console.log(`\n🔍 思维导图 ${index + 1}:`);
      
      // 获取基本信息
      const blockId = mindMap.getAttribute('data-block-id');
      
      // 检查 hina-container
      const hinaContainer = mindMap.querySelector('hina-container');
      if (hinaContainer) {
        const name = hinaContainer.getAttribute('name');
        
        // 提取思维导图ID
        let mindMapId = '';
        if (name) {
          const idMatch = name.match(/hina-hina_mind_map-(.+)$/);
          if (idMatch) {
            mindMapId = idMatch[1];
          }
        }
        
        console.log(`  🆔 ID: ${mindMapId || blockId || '未知'}`);
      } else {
        console.log(`  ❌ 无效的思维导图结构`);
      }
      
      // 测试解析结果
      try {
        const result = this.parser.parseMindMap(mindMap);
        if (result.trim()) {
          console.log(`  ✅ 解析结果: ${result.trim()}`);
        } else {
          console.log(`  ⏭️ 跳过处理（无输出）`);
        }
      } catch (error) {
        console.error(`  ❌ 解析失败:`, error);
      }
    });
    
    console.log('\n🎯 思维导图解析测试完成（简化模式）');
  }
}

// 立即暴露类到全局作用域
window.TencentDocExtractor = TencentDocExtractor;
console.log('✅ TencentDocExtractor类已暴露到全局作用域');

// 防止重复加载检查
if (window.TENCENT_DOC_CONTENT_LOADED) {
  console.log('TencentDocExtractor: 内容脚本已加载，跳过初始化');
} else {
  window.TENCENT_DOC_CONTENT_LOADED = true;
  
  // 创建并初始化实例
  const extractorInstance = new TencentDocExtractor();
  window.tencentDocExtractorInstance = extractorInstance;
  window.tencentDocExtractor = extractorInstance;
  
  // 开始异步初始化
  extractorInstance.initializeAsync().catch(error => {
    console.error('TencentDocExtractor: 初始化失败:', error);
  });
  
  console.log('✅ TencentDocExtractor实例已创建并开始初始化');
}

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (window.tencentDocExtractorInstance) {
    window.tencentDocExtractorInstance.destroy();
  }
});

}
