/**
 * 轻量级HTML到Markdown解析器
 * 专注于腾讯文档的核心解析功能
 */

// 防止重复加载
if (window.HTMLToMarkdownParserLite) {
  console.log('HTMLToMarkdownParserLite already loaded, skipping...');
} else {

class HTMLToMarkdownParserLite {
  constructor() {
    this.markdown = '';
    this.listCounters = {};
  }

  // 主解析方法
  parseHTMLContent() {
    try {
      console.log('🔍 开始解析HTML内容...');
      
      this.markdown = '';
      this.listCounters = {};
      
      // 重置计数器
      this.resetCounters();
      
      // 清除之前的处理标记
      this.clearProcessingMarkers();
      
      // 提取页面标题
      const pageTitle = this.extractPageTitle();
      if (pageTitle) {
        this.markdown += `# ${pageTitle}\n\n`;
      }
      
      // 提取主要内容
      const content = this.extractMainContent();
      this.markdown += content;
      
      console.log(`✅ 解析完成，生成 ${this.markdown.length} 个字符`);
      
      return {
        success: true,
        markdown: this.markdown.trim()
      };
      
    } catch (error) {
      console.error('❌ 解析失败:', error);
      return {
        success: false,
        error: error.message,
        markdown: ''
      };
    }
  }

  // 提取页面标题
  extractPageTitle() {
    // 尝试多种标题选择器
    const titleSelectors = [
      '.sc-page-icon + .sc-page-title',
      '.sc-page-title',
      '[data-testid="page-title"]',
      'h1',
      'title'
    ];
    
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const title = this.getTextContent(element);
        if (title && title.trim()) {
          return title.trim();
        }
      }
    }
    
    return document.title || null;
  }

  // 提取主要内容
  extractMainContent() {
    const content = document.querySelector('#sc-page-content');
    if (!content) return '';
    
    let result = '';
    const blockWrappers = content.querySelectorAll(':scope > .sc-block-wrapper');
    let previousBlockType = null;
    
    for (let i = 0; i < blockWrappers.length; i++) {
      const wrapper = blockWrappers[i];
      const blockResult = this.parseBlock(wrapper);
      
      if (blockResult && blockResult.trim()) {
        const currentBlockType = this.getBlockType(wrapper);
        
        // 如果当前块和前一个块都是列表项，则不添加额外空行
        if (previousBlockType && 
            (previousBlockType === 'list' && currentBlockType === 'list')) {
          result += blockResult + '\n';
        } else {
          // 其他情况添加双换行符
          if (result.trim()) {
            result += '\n' + blockResult + '\n\n';
          } else {
            result += blockResult + '\n\n';
          }
        }
        
        previousBlockType = currentBlockType;
      }
    }
    
    // 清理多余的空行，将连续的空行减少到最多两个换行符
    result = result.replace(/\n{3,}/g, '\n\n');
    
    return result.trim();
  }

  // 获取块类型
  getBlockType(block) {
    const classList = Array.from(block.classList);
    
    if (classList.includes('sc-block-bulleted_list') || 
        classList.includes('sc-block-numbered_list')) {
      return 'list';
    } else if (classList.some(cls => cls.startsWith('sc-block-header'))) {
      return 'header';
    } else if (classList.includes('sc-block-text')) {
      return 'text';
    } else if (classList.includes('sc-block-code')) {
      return 'code';
    } else {
      return 'other';
    }
  }

  // 解析单个块
  parseBlock(block) {
    // 检查是否已经处理过这个块
    if (block.hasAttribute('data-parsed')) {
      return '';
    }
    
    // 标记为已处理
    block.setAttribute('data-parsed', 'true');
    
    const classList = Array.from(block.classList);
    
    // 标题块
    if (classList.some(cls => cls.startsWith('sc-block-header') && cls.match(/sc-block-header\d+/))) {
      return this.parseHeader(block);
    }
    
    // 文本块
    if (classList.includes('sc-block-text')) {
      return this.parseText(block);
    }
    
    // 无序列表
    if (classList.includes('sc-block-bulleted_list')) {
      return this.parseBulletedList(block);
    }
    
    // 有序列表
    if (classList.includes('sc-block-numbered_list')) {
      return this.parseNumberedList(block);
    }
    
    // 引用块
    if (classList.includes('sc-block-quote')) {
      return this.parseQuote(block);
    }
    
    // 代码块
    if (classList.includes('sc-block-code')) {
      return this.parseCode(block);
    }
    
    // 表格 - 支持简单表格和复杂表格
    if (classList.includes('sc-block-table') || classList.includes('sc-block-simple_table')) {
      return this.parseTable(block);
    }
    
    // 图片
    if (classList.includes('sc-block-image')) {
      return this.parseImage(block);
    }
    
    // 思维导图
    if (classList.includes('sc-block-hina_mind_map')) {
      return this.parseMindMap(block);
    }
    
    // 分栏
    if (classList.includes('sc-block-column_list')) {
      return this.parseColumnList(block);
    }
    
    // 提醒块
    if (classList.includes('sc-block-callout')) {
      return this.parseCallout(block);
    }
    
    // 折叠块
    if (classList.includes('sc-block-toggle')) {
      return this.parseToggle(block);
    }
    
    // 未知类型，提取纯文本
    const text = this.getTextContent(block);
    return text ? text.trim() : '';
  }

  // 解析标题
  parseHeader(block) {
    const classList = Array.from(block.classList);
    let level = 1;
    
    // 查找标题级别
    for (const cls of classList) {
      const match = cls.match(/sc-block-header(\d+)/);
      if (match) {
        level = parseInt(match[1]);
        break;
      }
    }
    
    const text = this.getTextContent(block);
    if (!text) return '';
    
    return '#'.repeat(level) + ' ' + text.trim();
  }

  // 解析文本
  parseText(block) {
    return this.getFormattedText(block);
  }

  // 解析无序列表
  parseBulletedList(block) {
    const text = this.getTextContent(block);
    if (!text) return '';
    
    // 获取缩进级别
    const indent = this.getListIndent(block);
    
    // 提取当前层级的文本内容，只从直接的sc-text-input-content获取
    const directTextElement = block.querySelector(':scope > .sc-smart-content-wrapper > .css-fb3u9x > .css-1nwtjaw > .sc-text-input-content');
    let textContent = '';
    if (directTextElement) {
      textContent = this.getFormattedText(directTextElement);
    }
    
    // 构建当前项的markdown
    let result = '  '.repeat(indent) + '- ' + textContent;
    
    // 处理嵌套内容 - 只处理直接子级
    const nestedContainer = block.querySelector(':scope > .sc-smart-content-wrapper > .css-fb3u9x > .css-1ns5f5t.e1wkj4az0');
    if (nestedContainer) {
      console.log('发现无序列表嵌套容器，处理子项');
      // 只处理直接子级的sc-block-wrapper
      const directChildWrappers = nestedContainer.querySelectorAll(':scope > .sc-block-wrapper');
      
      for (const childWrapper of directChildWrappers) {
        const nestedResult = this.parseBlock(childWrapper);
        if (nestedResult && nestedResult.trim()) {
          result += '\n' + nestedResult;
        }
      }
    }
    
    return result;
  }

  // 解析有序列表
  parseNumberedList(block) {
    const text = this.getTextContent(block);
    if (!text) return '';
    
    // 从DOM中提取实际的序号标记
    const numberElement = block.querySelector('.css-1kmb4e5, .e1ext5ct1, span[style*="color: inherit"]');
    let numberMarker = '';
    
    if (numberElement) {
      numberMarker = numberElement.textContent.trim();
      console.log(`找到序号标记: ${numberMarker}`);
    }
    
    // 如果没有找到序号标记，使用默认编号
    if (!numberMarker) {
      const indent = this.getListIndent(block);
      const counter = this.getListCounter(indent);
      numberMarker = `${counter}.`;
    }
    
    // 获取缩进级别
    const indent = this.getListIndent(block);
    
    // 提取纯文本内容（排除序号部分），只提取当前层级的文本
    const textElement = block.querySelector('.sc-text-input-content');
    let textContent = '';
    if (textElement) {
      textContent = this.getFormattedText(textElement);
    }
    
    let result = '  '.repeat(indent) + numberMarker + ' ' + textContent;
    
    // 处理嵌套内容 - 只处理直接子级，避免重复处理
    const nestedContainer = block.querySelector(':scope > .sc-smart-content-wrapper > .css-fb3u9x > .css-1ns5f5t.e1wkj4az0');
    if (nestedContainer) {
      console.log('发现嵌套容器，处理子项');
      // 只处理直接子级的sc-block-wrapper
      const directChildWrappers = nestedContainer.querySelectorAll(':scope > .sc-block-wrapper');
      
      for (const childWrapper of directChildWrappers) {
        const nestedResult = this.parseBlock(childWrapper);
        if (nestedResult && nestedResult.trim()) {
          result += '\n' + nestedResult;
        }
      }
    }
    
    return result;
  }
  
  // 转换为罗马数字（简单版本）
  toRoman(num) {
    const values = [10, 9, 5, 4, 1];
    const symbols = ['x', 'ix', 'v', 'iv', 'i'];
    let result = '';
    
    for (let i = 0; i < values.length; i++) {
      while (num >= values[i]) {
        result += symbols[i];
        num -= values[i];
      }
    }
    
    return result || 'i';
  }

  // 解析引用
  parseQuote(block) {
    const text = this.getTextContent(block);
    if (!text) return '';
    
    return '> ' + text.trim();
  }

  // 解析代码块
  parseCode(block) {
    // 查找代码内容容器
    const codeElement = block.querySelector('.sc-block-code-content-wrapper .sc-text-input-content');
    
    if (!codeElement) {
      return '';
    }
    
    // 提取所有带有data-code-span="true"的span元素
    const allCodeSpans = codeElement.querySelectorAll('span[data-code-span="true"]');
    
    if (allCodeSpans.length === 0) {
      return '';
    }
    
    // 将所有span的文本内容直接拼接，保持原有的换行和结构
    let codeContent = '';
    
    for (const span of allCodeSpans) {
      const spanText = span.textContent || '';
      codeContent += spanText;
    }
    
    // 处理嵌套在span中的换行标记
    // 腾讯文档在span中使用特殊的换行标记，我们需要将其转换为实际换行
    codeContent = codeContent.replace(/\n<span data-line-number="\d+"><\/span>/g, '\n');
    
    // 清理内容
    codeContent = codeContent.trim();
    
    if (!codeContent) {
      return '';
    }
    
    return '```\n' + codeContent + '\n```';
  }

  // 解析表格
  parseTable(block) {
    // 优先查找标准table元素
    const table = block.querySelector('table');
    if (table) {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length === 0) return '';
      
      let result = '';
      
      rows.forEach((row, index) => {
        const cells = Array.from(row.querySelectorAll('td, th'));
        const cellTexts = cells.map(cell => {
          // 首先检查单元格是否包含图片容器
          const imageContainer = cell.querySelector('.sc-table-image-item-container');
          if (imageContainer) {
            return this.extractImageFromContainer(imageContainer, cell);
          }
          
          // 如果没有图片容器，查找文本内容
          const textWrapper = cell.querySelector('.sc-text-input-content');
          if (textWrapper) {
            const text = this.getTextContent(textWrapper);
            return text ? text.trim() : ' ';
          }
          const text = this.getTextContent(cell);
          return text ? text.trim() : ' ';
        });
        
        if (cellTexts.length > 0) {
          result += '| ' + cellTexts.join(' | ') + ' |\n';
          
          // 添加表头分隔线
          if (index === 0) {
            result += '|' + '---|'.repeat(cellTexts.length) + '\n';
          }
        }
      });
      
      return result.trim();
    }
    
    // 如果没有找到标准table，尝试腾讯文档的表格结构
    const tableContainer = block.querySelector('.sc-table-container, .sc-block-table-content, .sc-exceed-scroller-content');
    if (tableContainer) {
      const rows = tableContainer.querySelectorAll('[role="row"], .sc-table-row, tr');
      if (rows.length > 0) {
        let result = '';
        
        rows.forEach((row, index) => {
          const cells = row.querySelectorAll('[role="cell"], .sc-table-cell, .sc-table-header-cell, td');
          const cellTexts = Array.from(cells).map(cell => {
            // 首先检查单元格是否包含图片容器
            const imageContainer = cell.querySelector('.sc-table-image-item-container');
            if (imageContainer) {
              return this.extractImageFromContainer(imageContainer, cell);
            }
            
            // 如果没有图片容器，查找文本内容
            const textWrapper = cell.querySelector('.sc-text-input-content');
            if (textWrapper) {
              const text = this.getTextContent(textWrapper);
              return text ? text.trim() : ' ';
            }
            const text = this.getTextContent(cell);
            return text ? text.trim() : ' ';
          });
          
          if (cellTexts.length > 0) {
            result += '| ' + cellTexts.join(' | ') + ' |\n';
            
            // 添加表头分隔线
            if (index === 0) {
              result += '|' + '---|'.repeat(cellTexts.length) + '\n';
            }
          }
        });
        
        return result.trim();
      }
    }
    
    return '';
  }

  // 从图片容器中提取图片信息（处理加载中的图片）
  extractImageFromContainer(imageContainer, cell) {
    // 方法1：查找实际的img标签
    const img = imageContainer.querySelector('img');
    if (img && img.src) {
      const src = img.src || '';
      const alt = img.alt || '图片';
      const title = img.title || '';
      
      // 处理图片链接
      const cleanSrc = src.split('?')[0];
      const imageMarkdown = title ? `![${alt}](${cleanSrc} "${title}")` : `![${alt}](${cleanSrc})`;
      
      // 检查是否还有文本内容
      const textWrapper = cell.querySelector('.sc-text-input-content');
      if (textWrapper) {
        const text = this.getTextContent(textWrapper).trim();
        return text ? `${imageMarkdown}<br>${text}` : imageMarkdown;
      }
      
      return imageMarkdown;
    }
    
    // 方法2：检查是否有data-imageid属性（用于加载中的图片）
    const imageId = imageContainer.getAttribute('data-imageid');
    if (imageId) {
      // 检查是否是加载中的骨架屏
      const loadingSkeleton = imageContainer.querySelector('.react-loading-skeleton');
      if (loadingSkeleton) {
        console.log(`📸 发现加载中的图片: ${imageId}`);
        return `![图片加载中](# "图片ID: ${imageId}")`;
      }
      
      // 尝试从容器的背景图或其他属性中获取图片URL
      const containerStyle = imageContainer.style.backgroundImage;
      if (containerStyle && containerStyle.includes('url(')) {
        const urlMatch = containerStyle.match(/url\(['"]?([^'"]*?)['"]?\)/);
        if (urlMatch && urlMatch[1]) {
          const cleanSrc = urlMatch[1].split('?')[0];
          return `![图片](${cleanSrc})`;
        }
      }
      
      // 如果都没有找到，至少提供一个占位符
      return `![图片占位符](# "图片ID: ${imageId}")`;
    }
    
    // 方法3：如果容器中有其他内容，检查是否还有文本
    const textWrapper = cell.querySelector('.sc-text-input-content');
    if (textWrapper) {
      const text = this.getTextContent(textWrapper).trim();
      if (text) {
        return text;
      }
    }
    
    return ' ';
  }

  // 解析图片
  parseImage(block) {
    const img = block.querySelector('img');
    if (!img) return '';
    
    const src = img.src || '';
    const alt = img.alt || '图片';
    const title = img.title || '';
    
    // 如果启用了资源下载，则记录图片信息
    if (window.resourceDownloader) {
      // 添加到图片收集队列
      const imageInfo = {
        url: src,
        alt: alt,
        title: title,
        element: img
      };
      
      // 将图片信息存储到全局集合中
      if (!window.collectedImages) {
        window.collectedImages = [];
      }
      window.collectedImages.push(imageInfo);
      
      // 暂时使用占位符路径，稍后会被替换
      const placeholderPath = `./images/image_${window.collectedImages.length}.jpg`;
      return title ? `![${alt}](${placeholderPath} "${title}")` : `![${alt}](${placeholderPath})`;
    }
    
    // 如果没有资源下载器，使用原始逻辑
    const cleanSrc = src.split('?')[0];
    return title ? `![${alt}](${cleanSrc} "${title}")` : `![${alt}](${cleanSrc})`;
  }

  // 解析分栏
  parseColumnList(block) {
    console.log('🔍 开始解析分栏结构');
    
    // 查找分栏容器
    const columnListContainer = block.querySelector('[data-area-column-list]');
    if (!columnListContainer) {
      console.warn('❌ 未找到分栏容器 [data-area-column-list]');
      return '';
    }
    
    // 查找所有分栏，排除分隔符
    const allDivs = columnListContainer.querySelectorAll(':scope > div');
    const columns = Array.from(allDivs).filter(div => 
      !div.hasAttribute('data-area-column-divider') && 
      div.querySelector('.sc-block-wrapper, .sc-block-column, .sc-column-container')
    );
    
    console.log(`📊 找到 ${columns.length} 个分栏`);
    
    if (columns.length === 0) {
      console.warn('❌ 没有找到有效的分栏');
      return '';
    }
    
    const columnData = columns.map((col, index) => {
      console.log(`🔍 处理第 ${index + 1} 个分栏`);
      
      let content = '';
      
      // 方法1：查找 sc-block-column 或 sc-column-container
      const columnContainer = col.querySelector('.sc-block-column, .sc-column-container');
      if (columnContainer) {
        const childWrappers = columnContainer.querySelectorAll('.sc-block-wrapper');
        
        if (childWrappers.length > 0) {
          const contentParts = [];
          
          for (const childWrapper of childWrappers) {
            const childResult = this.parseBlock(childWrapper);
            if (childResult && childResult.trim()) {
              contentParts.push(childResult.trim());
            }
          }
          
          content = contentParts.join('\n\n');
        } else {
          // 没有子块，检查是否包含图片或直接提取文本
          content = this.extractColumnContent(columnContainer);
        }
      } else {
        // 方法2：直接在当前div中查找所有子块
        const directWrappers = col.querySelectorAll('.sc-block-wrapper');
        if (directWrappers.length > 0) {
          const contentParts = [];
          
          for (const wrapper of directWrappers) {
            const result = this.parseBlock(wrapper);
            if (result && result.trim()) {
              contentParts.push(result.trim());
            }
          }
          
          content = contentParts.join('\n\n');
        } else {
          // 最后备选：检查是否包含图片或直接提取文本
          content = this.extractColumnContent(col);
        }
      }
      
      console.log(`📝 分栏 ${index + 1} 内容: ${content.substring(0, 50)}...`);
      
      return {
        title: `列 ${index + 1}`,
        content: content || ' '
      };
    });
    
    // 构建表格形式的分栏
    const headers = columnData.map(col => col.title);
    const contents = columnData.map(col => {
      // 处理换行符，在表格中使用<br>标签
      return col.content.replace(/\n+/g, '<br>');
    });
    
    let result = '| ' + headers.join(' | ') + ' |\n';
    result += '|' + '---|'.repeat(headers.length) + '\n';
    result += '| ' + contents.join(' | ') + ' |\n';
    
    console.log('✅ 分栏解析完成');
    return result;
  }

  // 从分栏容器中提取内容（包括图片）
  extractColumnContent(container) {
    const contentParts = [];
    
    // 检查是否包含图片
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      if (img.src) {
        const src = img.src || '';
        const alt = img.alt || '图片';
        const title = img.title || '';
        
        // 处理图片链接
        const cleanSrc = src.split('?')[0];
        const imageMarkdown = title ? `![${alt}](${cleanSrc} "${title}")` : `![${alt}](${cleanSrc})`;
        contentParts.push(imageMarkdown);
      }
    });
    
    // 检查是否包含表格图片容器
    const imageContainers = container.querySelectorAll('.sc-table-image-item-container');
    imageContainers.forEach(imageContainer => {
      const img = imageContainer.querySelector('img');
      if (img && img.src) {
        const src = img.src || '';
        const alt = img.alt || '图片';
        const title = img.title || '';
        
        // 处理图片链接
        const cleanSrc = src.split('?')[0];
        const imageMarkdown = title ? `![${alt}](${cleanSrc} "${title}")` : `![${alt}](${cleanSrc})`;
        contentParts.push(imageMarkdown);
      }
    });
    
    // 提取文本内容
    const textContent = this.getTextContent(container).trim();
    if (textContent) {
      contentParts.push(textContent);
    }
    
    return contentParts.join('\n\n') || ' ';
  }

  // 解析提醒块（高亮块）
  parseCallout(block) {
    const text = this.getTextContent(block);
    if (!text) return '';
    
    // 检查提醒块类型
    const classList = Array.from(block.classList);
    let icon = '💡'; // 默认图标
    
    // 尝试识别不同类型的提醒块
    if (classList.some(cls => cls.includes('warning'))) {
      icon = '⚠️';
    } else if (classList.some(cls => cls.includes('error') || cls.includes('danger'))) {
      icon = '❌';
    } else if (classList.some(cls => cls.includes('info'))) {
      icon = 'ℹ️';
    } else if (classList.some(cls => cls.includes('success'))) {
      icon = '✅';
    }
    
    // 使用不同于引用的格式：带图标的高亮块
    return `**${icon} ${text.trim()}**\n`;
  }

  // 解析折叠块
  parseToggle(block) {
    const text = this.getTextContent(block);
    if (!text) return '';
    
    // 获取缩进级别
    const indent = this.getListIndent(block);
    
    // 提取折叠标题文本
    const directTextElement = block.querySelector(':scope > .sc-smart-content-wrapper > .css-fb3u9x > .css-1nwtjaw > .sc-text-input-content');
    let textContent = '';
    if (directTextElement) {
      textContent = this.getFormattedText(directTextElement);
    }
    
    // 折叠块作为列表项的一部分，使用列表格式
    const marker = indent === 0 ? '-' : (indent === 1 ? '-' : '-');
    let result = '  '.repeat(indent) + marker + ' ' + textContent;
    
    // 处理折叠内容（如果有的话）
    const toggleContent = block.querySelector('.sc-toggle-content');
    if (toggleContent) {
      const contentWrappers = toggleContent.querySelectorAll(':scope > .sc-block-wrapper');
      for (const wrapper of contentWrappers) {
        const contentResult = this.parseBlock(wrapper);
        if (contentResult && contentResult.trim()) {
          result += '\n' + contentResult;
        }
      }
    }
    
    return result;
  }

  // 获取格式化文本
  getFormattedText(element) {
    if (!element) return '';
    
    // 首先检查是否包含链接，并提取完整的HTML结构
    const links = element.querySelectorAll('a[href]');
    if (links.length > 0) {
      let result = element.innerHTML;
      
      // 将所有a标签转换为Markdown链接
      links.forEach(link => {
        const linkText = link.textContent.trim();
        const linkUrl = link.href;
        if (linkText && linkUrl) {
          const linkMarkdown = `[${linkText}](${linkUrl})`;
          result = result.replace(link.outerHTML, linkMarkdown);
          console.log(`📄 找到链接: "${linkText}" -> ${linkUrl}`);
        }
      });
      
      // 清理HTML标签，保留文本内容
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = result;
      return tempDiv.textContent || tempDiv.innerText || '';
    }
    
    // 检查span[data-type="text-link"]（腾讯文档的链接格式）
    const linkSpans = element.querySelectorAll('span[data-type="text-link"]');
    if (linkSpans.length > 0) {
      let result = '';
      
      // 确定内容容器
      let contentContainer = element;
      if (element.classList.contains('sc-text-input-content')) {
        contentContainer = element;
      } else {
        const subContainer = element.querySelector('.sc-text-input-content');
        if (subContainer) {
          contentContainer = subContainer;
        }
      }
      
      // 遍历所有子元素
      const childElements = contentContainer.querySelectorAll('span');
      
      for (const span of childElements) {
        const text = span.textContent.trim();
        if (!text) continue;
        
        // 检查是否是链接
        if (span.getAttribute('data-type') === 'text-link') {
          // 查找链接URL - 腾讯文档特殊处理
          let linkUrl = text; // 默认值
          
          // 方法1：查找最近的a标签
          const linkElement = span.closest('a') || element.querySelector('a[href]');
          if (linkElement && linkElement.href) {
            linkUrl = linkElement.href;
          } else {
            // 方法2：查找data属性
            const hrefAttr = span.getAttribute('data-href') || span.getAttribute('href');
            if (hrefAttr) {
              linkUrl = hrefAttr;
            } else {
              // 方法3：查找父元素的属性
              const parent = span.parentElement;
              if (parent && parent.hasAttribute('data-href')) {
                linkUrl = parent.getAttribute('data-href');
              }
            }
          }
          
          // 处理相对链接
          if (linkUrl && linkUrl !== text) {
            if (linkUrl.startsWith('//')) {
              linkUrl = 'https:' + linkUrl;
            } else if (linkUrl.startsWith('/')) {
              linkUrl = 'https://docs.qq.com' + linkUrl;
            }
            
            result += `[${text}](${linkUrl})`;
            console.log(`📄 找到腾讯文档链接: "${text}" -> ${linkUrl}`);
          } else {
            result += text;
          }
        } else {
          result += text;
        }
      }
      
      if (result.trim()) {
        return result.trim();
      }
    }
    
    // 普通文本处理
    return this.getTextContent(element);
  }

  // 获取纯文本内容
  getTextContent(element) {
    if (!element) return '';
    
    // 直接返回元素的完整文本内容，不要只查找单个span
    return element.textContent || element.innerText || '';
  }

  // 获取列表缩进级别
  getListIndent(block) {
    let level = 0;
    let parent = block.parentElement;
    
    while (parent && level < 5) {
      if (parent.classList.contains('sc-block-wrapper')) {
        const classList = Array.from(parent.classList);
        if (classList.some(cls => cls.includes('list'))) {
          level++;
        }
      }
      parent = parent.parentElement;
    }
    
    return level;
  }

  // 获取列表计数器
  getListCounter(level) {
    if (!this.listCounters[level]) {
      this.listCounters[level] = 1;
    } else {
      this.listCounters[level]++;
    }
    
    // 重置更深层级的计数器
    for (let i = level + 1; i <= 10; i++) {
      this.listCounters[i] = 0;
    }
    
    return this.listCounters[level];
  }

  // 重置计数器
  resetCounters() {
    this.listCounters = {};
  }
  
  // 简单解析（fallback）
  fallbackParse(container) {
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const paragraphs = container.querySelectorAll('p');
    const lists = container.querySelectorAll('ul, ol');
    
    let content = '';
    
    // 处理标题
    headings.forEach(h => {
      const level = parseInt(h.tagName.substring(1));
      const text = this.getTextContent(h);
      if (text) {
        content += '#'.repeat(level) + ' ' + text.trim() + '\n\n';
      }
    });
    
    // 处理段落
    paragraphs.forEach(p => {
      const text = this.getTextContent(p);
      if (text) {
        content += text.trim() + '\n\n';
      }
    });
    
    // 处理列表
    lists.forEach(list => {
      const items = list.querySelectorAll('li');
      const isOrdered = list.tagName === 'OL';
      
      items.forEach((item, index) => {
        const text = this.getTextContent(item);
        if (text) {
          const prefix = isOrdered ? `${index + 1}. ` : '- ';
          content += prefix + text.trim() + '\n';
        }
      });
      content += '\n';
    });
    
    return content.trim();
  }

  // 解析思维导图（可配置模式）
  parseMindMap(block) {
    console.log('🧠 解析思维导图 - 可配置模式');
    
    // 获取思维导图的基本信息
    const blockId = block.getAttribute('data-block-id') || '';
    
    // 查找 hina-container 元素
    const hinaContainer = block.querySelector('hina-container');
    if (!hinaContainer) {
      console.warn('❌ 未找到 hina-container 元素，跳过思维导图');
      return '';  // 完全跳过无效的思维导图
    }
    
    // 从name中提取思维导图ID
    const name = hinaContainer.getAttribute('name') || '';
    let mindMapId = '';
    const nameMatch = name.match(/hina-hina_mind_map-(.+)$/);
    if (nameMatch) {
      mindMapId = nameMatch[1];
    }
    
    const finalId = mindMapId || blockId || '未知';
    console.log(`📊 思维导图ID: ${finalId}`);
    
    // 根据配置的模式来处理
    const mode = window.mindMapMode || 'simple';
    
    switch (mode) {
      case 'skip':
        // 完全跳过，不生成任何内容
        console.log('⏭️ 跳过思维导图（skip模式）');
        return '';
        
      case 'placeholder':
        // 生成简单的图片占位符
        console.log('🖼️ 生成图片占位符（placeholder模式）');
        return `![思维导图](# "ID: ${finalId}")\n\n`;
        
      case 'simple':
      default:
        // 生成简单的一行标记
        console.log('📝 生成简单标记（simple模式）');
        return `**[思维导图: ${finalId}]**\n\n`;
    }
  }

  // 清除处理标记
  clearProcessingMarkers() {
    try {
      // 清除所有处理标记
      const processedBlocks = document.querySelectorAll('[data-parsed]');
      processedBlocks.forEach(block => {
        block.removeAttribute('data-parsed');
      });
      console.log(`🧹 清除了 ${processedBlocks.length} 个处理标记`);
    } catch (e) {
      console.warn('清除处理标记时出错:', e);
    }
  }
}

// 导出到全局
window.HTMLToMarkdownParserLite = HTMLToMarkdownParserLite;

console.log('✅ HTMLToMarkdownParserLite 已加载');

} // 结束防重复加载检查 