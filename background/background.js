// 后台脚本 - 扩展生命周期管理

console.log('Background script loaded');

// 注入必要的脚本和CSS
async function injectScripts(tabId) {
  try {
    // 注入CSS
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['sidebar/sidebar.css']
    });
    
    // 按顺序注入JS文件 - 简化版
    const jsFiles = [
      'content/config.js',
      'content/parser-lite.js',
      'content/content.js'
    ];
    
    for (const file of jsFiles) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [file]
      });
    }
    
    console.log('✅ 所有脚本和CSS注入完成');
    return true;
  } catch (error) {
    console.error('❌ 脚本注入失败:', error);
    return false;
  }
}

// 点击插件图标时直接打开sidebar的逻辑
async function openSidebarDirectly(tab) {
  try {
    console.log('开始尝试打开sidebar，当前标签页:', tab.url);
    
    // 首先注入必要的脚本
    const injectionSuccess = await injectScripts(tab.id);
    if (!injectionSuccess) {
      console.error('❌ 脚本注入失败，无法继续');
      return;
    }
    
    // 等待脚本初始化 - 进一步优化加载速度
    console.log('⏳ 等待脚本初始化...');
    await new Promise(resolve => setTimeout(resolve, 300));
    console.log('✅ 脚本初始化等待完成');
    
    // 验证脚本是否成功加载
    try {
      const checkResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return {
            contentLoaded: !!window.TENCENT_DOC_CONTENT_LOADED,
            extractorClass: typeof TencentDocExtractor !== 'undefined',
            extractorInstance: !!window.tencentDocExtractorInstance
          };
        }
      });
      
      const status = checkResult[0].result;
      console.log('脚本加载状态检查:', status);
      
      if (!status.contentLoaded || !status.extractorClass) {
        console.warn('⚠️ 脚本可能未完全加载，再等待500ms...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (checkError) {
      console.warn('⚠️ 无法检查脚本状态，继续执行:', checkError.message);
    }
    
    let success = false;
    const maxRetries = 3;
    
    // 尝试发送消息打开sidebar，带重试机制
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`尝试发送打开sidebar消息 (第${i + 1}次)`);
        
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'openSidebar'
        });
        
        if (response && response.success) {
          console.log('✅ 成功发送打开sidebar消息');
          success = true;
          break;
        } else {
          console.log('❌ 发送消息成功但响应无效:', response);
        }
      } catch (error) {
        console.log(`❌ 第${i + 1}次发送消息失败:`, error.message);
        
        // 每次重试前等待极短时间
        if (i < maxRetries - 1) {
          const waitTime = 150 + (i * 100);
          console.log(`等待 ${waitTime}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // 如果所有重试都失败，尝试直接执行代码
     if (!success) {
       console.error('所有消息发送尝试都失败，尝试直接执行代码');
       
       try {
         const result = await chrome.scripting.executeScript({
           target: { tabId: tab.id },
           func: () => {
             console.log('=== 直接执行代码开始 ===');
             console.log('当前页面URL:', window.location.href);
             console.log('检查全局变量:');
             console.log('- window.tencentDocExtractorInstance:', !!window.tencentDocExtractorInstance);
             console.log('- window.tencentDocExtractor:', !!window.tencentDocExtractor);
             console.log('- typeof TencentDocExtractor:', typeof TencentDocExtractor);
             console.log('- window.TENCENT_DOC_CONTENT_LOADED:', window.TENCENT_DOC_CONTENT_LOADED);
             console.log('- document.readyState:', document.readyState);
             console.log('- 侧边栏元素存在:', !!document.getElementById('tencent-doc-markdown-sidebar'));
             
             // 直接在页面中执行打开sidebar的逻辑
             if (window.tencentDocExtractorInstance) {
               console.log('✅ 找到现有实例，直接显示侧边栏');
               try {
                 window.tencentDocExtractorInstance.showSidebar();
                 console.log('✅ 侧边栏显示成功');
                 return { success: true, method: 'existing_instance' };
               } catch (error) {
                 console.error('❌ 显示侧边栏失败:', error);
                 return { success: false, error: error.message, method: 'existing_instance' };
               }
             } else if (window.tencentDocExtractor) {
               console.log('✅ 找到备用实例，直接显示侧边栏');
               try {
                 window.tencentDocExtractor.showSidebar();
                 console.log('✅ 侧边栏显示成功');
                 return { success: true, method: 'backup_instance' };
               } catch (error) {
                 console.error('❌ 显示侧边栏失败:', error);
                 return { success: false, error: error.message, method: 'backup_instance' };
               }
             } else {
               console.log('⚠️ TencentDocExtractor实例未找到，尝试创建新实例');
               // 如果实例不存在，创建一个新的
               if (typeof TencentDocExtractor !== 'undefined') {
                 console.log('✅ TencentDocExtractor类已定义，创建新实例');
                 try {
                   const extractor = new TencentDocExtractor();
                   console.log('✅ 新实例创建成功，开始初始化...');
                   
                   // 手动调用初始化
                   if (typeof extractor.init === 'function') {
                     console.log('📞 调用实例的init方法');
                     extractor.init().catch(err => {
                       console.error('❌ 初始化过程中出错:', err);
                     });
                   }
                   
                   console.log('✅ 实例初始化完成，等待侧边栏准备...');
                   
                   // 等待初始化完成后显示侧边栏
                   setTimeout(() => {
                     console.log('检查初始化状态:', extractor.isInitialized);
                     console.log('检查侧边栏元素:', !!extractor.sidebar);
                     
                     try {
                       if (extractor.isInitialized) {
                         console.log('✅ 实例已初始化，显示侧边栏');
                         extractor.showSidebar();
                         console.log('✅ 侧边栏显示调用完成');
                       } else {
                         console.log('⚠️ 实例未完全初始化，尝试强制初始化');
                         // 强制调用初始化
                         if (typeof extractor.initializeExtension === 'function') {
                           extractor.initializeExtension().then(() => {
                             console.log('✅ 强制初始化完成，显示侧边栏');
                             extractor.showSidebar();
                           }).catch(err => {
                             console.error('❌ 强制初始化失败:', err);
                             // 即使初始化失败，也尝试显示侧边栏
                             extractor.showSidebar();
                           });
                         } else {
                           console.log('⚠️ 无法找到初始化方法，直接尝试显示侧边栏');
                           extractor.showSidebar();
                         }
                       }
                     } catch (error) {
                       console.error('❌ 显示侧边栏过程中出错:', error);
                     }
                   }, 100);
                   
                   return { success: true, method: 'new_instance' };
                 } catch (error) {
                   console.error('❌ 创建新实例失败:', error);
                   return { success: false, error: error.message, method: 'new_instance' };
                 }
               } else {
                 console.error('❌ TencentDocExtractor类未定义，可能content script未加载');
                 return { success: false, error: 'TencentDocExtractor class not found', method: 'class_not_found' };
               }
             }
           }
         });
         
         if (result && result[0] && result[0].result) {
           const execResult = result[0].result;
           console.log('直接执行结果:', execResult);
           if (execResult.success) {
             console.log(`✅ 通过${execResult.method}方式成功打开了sidebar`);
           } else {
             console.error(`❌ 通过${execResult.method}方式打开sidebar失败:`, execResult.error);
           }
         } else {
           console.log('✅ 直接执行代码完成（无返回值）');
         }
         console.log('通过直接执行代码打开了sidebar');
       } catch (directError) {
         console.error('直接执行打开sidebar代码也失败:', directError);
       }
     }

  } catch (error) {
    console.error('打开sidebar过程中发生错误:', error);
  }
}

// 监听插件图标点击事件
chrome.action.onClicked.addListener((tab) => {
  console.log('插件图标被点击，准备打开sidebar');
  openSidebarDirectly(tab);
});

console.log('Action事件监听器已设置，等待插件图标点击事件');

// 扩展安装时的初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('腾讯文档转Markdown插件已安装');
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'ping':
      // 用于检测扩展上下文是否有效
      sendResponse({ success: true, timestamp: Date.now() });
      return true; // 保持消息通道开放
      
    case 'checkTencentDoc':
      // 总是返回支持状态，跳过页面检测
      sendResponse({ isTencentDoc: true });
      return true; // 保持消息通道开放
      
    case 'convertToMarkdown':
      // 处理转换请求（如果需要后台处理）
      sendResponse({ success: true });
      return true; // 保持消息通道开放
      
    case 'copyToClipboard':
      // 处理复制到剪贴板的请求
      handleCopyToClipboard(request.text)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // 保持消息通道开放
      
    default:
      console.warn('Background: Unknown action:', request.action);
      sendResponse({ error: 'Unknown action' });
      return true; // 保持消息通道开放
  }
});

// 处理复制到剪贴板
async function handleCopyToClipboard(text) {
  try {
    // 在service worker中，我们需要通过content script来处理剪贴板操作
    // 这里只是记录，实际复制在content script中完成
    console.log('复制请求已处理');
  } catch (error) {
    console.error('复制失败:', error);
    throw error;
  }
}

// 检查是否为腾讯文档页面
function isTencentDocPage(url) {
  if (!url) return false;
  
  try {
    // 简化检测逻辑：只需要判断URL包含 https://docs.qq.com/
    return url.includes('https://docs.qq.com/');
  } catch (e) {
    return false;
  }
}

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isTencentDocPage(tab.url)) {
    // 腾讯文档页面加载完成，可以进行初始化
    console.log('腾讯文档页面已加载:', tab.url);
  }
});

// 监听标签页激活
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (isTencentDocPage(tab.url)) {
      // 切换到腾讯文档标签页
      console.log('切换到腾讯文档页面');
    }
  } catch (error) {
    console.error('获取标签页信息失败:', error);
  }
});