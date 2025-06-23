/**
 * 腾讯文档转Markdown插件 - 配置文件
 * 集中管理扩展的所有配置选项
 */

// 防止重复加载
if (window.TENCENT_DOC_CONFIG_LOADED) {
  console.log('TencentDocExtractor: Config already loaded, skipping...');
} else {
window.TENCENT_DOC_CONFIG_LOADED = true;

// 状态枚举 - 避免重复声明
if (typeof window.ExtractorState === 'undefined') {
  window.ExtractorState = {
    UNINITIALIZED: 'uninitialized',
    INITIALIZING: 'initializing',
    READY: 'ready',
    ERROR: 'error',
    DESTROYED: 'destroyed'
  };
}

// 扩展配置 - 避免重复声明
if (typeof window.ExtensionConfig === 'undefined') {
  window.ExtensionConfig = {
  // 重试配置
  retry: {
    maxAttempts: 3,
    initialDelay: 500,
    maxDelay: 5000,
    backoffFactor: 2
  },
  
  // 超时配置
  timeouts: {
    messageResponse: 5000,
    sidebarCreation: 3000,
    conversion: 10000,
    pageLoad: 15000
  },
  
  // 调试配置
  debug: {
    enableVerboseLogging: false,
    logStateTransitions: true,
    logMessageTraffic: true,
    logPerformance: false,
    logErrors: true
  },
  
  // 错误处理配置
  errorHandling: {
    maxErrorThreshold: 5,
    errorCategories: {
      messageListener: 'messageListener',
      sidebarCreation: 'sidebarCreation',
      conversion: 'conversion',
      initialization: 'initialization',
      pageObserver: 'pageObserver'
    }
  },
  
  // UI配置
  ui: {
    sidebar: {
      width: '400px',
      zIndex: 2147483647,
      animationDuration: '0.3s'
    },
    notifications: {
      duration: 3000,
      fadeOutDuration: 500
    }
  },
  
  // 性能配置
  performance: {
    debounceDelay: 300,
    throttleDelay: 100,
    maxContentLength: 1000000, // 1MB
    chunkSize: 50000 // 50KB chunks for large content
  }
};
}

// 导出配置（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExtractorState: window.ExtractorState, ExtensionConfig: window.ExtensionConfig };
}

// 配置已通过条件声明直接暴露到window对象
console.log('TencentDocExtractor: Configuration loaded successfully');
}