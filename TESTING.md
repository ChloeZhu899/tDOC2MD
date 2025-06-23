# 测试与调试指南

> 腾讯文档转Markdown扩展的完整测试和调试方法

## 🧪 快速测试

### 安装验证
1. **加载扩展**: `chrome://extensions/` → 开发者模式 → 加载扩展
2. **打开文档**: 访问任意腾讯文档页面
3. **验证激活**: 扩展图标变为彩色
4. **测试功能**: 点击图标显示侧边栏

### 基础功能测试
```javascript
// 在浏览器控制台运行以下命令

// 1. 检查扩展实例
console.log('扩展实例:', !!window.tencentDocExtractorInstance);

// 2. 测试转换功能
window.tencentDocExtractorInstance?.convertToMarkdown();

// 3. 快速诊断
window.testTableImages();  // 测试表格图片
window.testMindMaps();     // 测试思维导图
```

## 🔍 高级调试

### 智能转换测试
```javascript
// 智能转换（等待图片加载）
window.smartConvert();

// 手动等待图片加载
window.waitForImages(10000);  // 等待10秒

// 检查资源收集状态
if (window.resourceDownloader) {
  const resources = window.resourceDownloader.collectPageResources();
  console.log('收集到的资源:', resources);
}
```

### 思维导图处理配置
```javascript
// 配置思维导图处理模式
window.configureMindMap("simple");     // 简单标记（默认）
window.configureMindMap("skip");       // 完全跳过
window.configureMindMap("placeholder"); // 图片占位符

// 测试思维导图识别
window.testMindMaps();
```

### DOM元素检查
```javascript
// 检查页面结构
$$('.sc-block-wrapper').length;               // 查看块数量
$$('.sc-block-numbered_list').length;         // 有序列表数量
$$('.sc-block-bulleted_list').length;         // 无序列表数量
$$('.sc-block-code').length;                  // 代码块数量
$$('.sc-block-hina_mind_map').length;         // 思维导图数量
$$('[data-parsed]').length;                   // 已处理标记

// 检查图片状态
document.querySelectorAll('.sc-table-image-item-container').forEach((container, i) => {
  const imageId = container.getAttribute('data-imageid');
  const hasImg = !!container.querySelector('img');
  const isLoading = !!container.querySelector('.react-loading-skeleton');
  console.log(`图片容器 ${i+1}: ID=${imageId}, 有图片=${hasImg}, 加载中=${isLoading}`);
});
```

## 🐛 问题诊断

### 常见问题排查

#### 1. 扩展无法加载
```bash
检查步骤:
□ manifest.json 语法正确
□ 文件路径存在
□ 权限配置正确
□ 控制台无错误

解决方法:
- 重新加载扩展
- 检查文件完整性
- 查看错误日志
```

#### 2. 转换结果异常
```javascript
// 诊断命令
window.testTableImages();    // 诊断表格图片
window.testMindMaps();       // 诊断思维导图

// 检查解析状态
const blocks = $$('.sc-block-wrapper');
console.log(`找到 ${blocks.length} 个内容块`);

// 手动测试特定元素
const parser = window.tencentDocExtractorInstance?.parser;
if (parser) {
  const testBlock = $$('.sc-block-numbered_list')[0];
  if (testBlock) {
    console.log('测试解析结果:', parser.parseNumberedList(testBlock));
  }
}
```

#### 3. 图片下载问题
```javascript
// 检查图片加载状态
const images = $$('img');
console.log(`页面共有 ${images.length} 个图片`);

images.forEach((img, i) => {
  console.log(`图片 ${i+1}: ${img.complete ? '已加载' : '加载中'} - ${img.src}`);
});

// 强制等待加载
window.waitForImages(15000).then(() => {
  console.log('图片加载完成，可以转换了');
  window.smartConvert();
});
```

## 📋 测试清单

### 功能测试
```
□ 扩展图标正常显示
□ 侧边栏能够打开/关闭
□ 转换功能正常工作
□ 预览区域显示正确
□ 复制功能正常
□ 导出功能正常
□ 资源下载正常（如果勾选）
□ 快捷键响应正常
```

### 内容解析测试
```
□ 标题解析正确（H1-H6）
□ 文本格式保持（粗体、斜体等）
□ 有序列表序号正确
□ 无序列表缩进正确
□ 嵌套列表结构正确
□ 表格格式正确
□ 代码块不重复
□ 图片链接有效
□ 引用块格式正确
□ 折叠块展开正确
□ 思维导图处理正确
```

### 性能测试
```javascript
// 性能监控
console.time('转换性能');
await window.tencentDocExtractorInstance.convertToMarkdown();
console.timeEnd('转换性能');

// 内存使用情况
console.log('内存使用:', performance.memory);
```

## 🔧 调试工具

### 内置调试命令
```javascript
// 完整的调试工具集

// 基础诊断
window.testTableImages();           // 表格图片诊断
window.testMindMaps();             // 思维导图诊断
window.smartConvert();             // 智能转换

// 配置命令
window.configureMindMap(mode);     // 配置思维导图模式
window.waitForImages(timeout);     // 等待图片加载

// 手动测试
window.tencentDocExtractorInstance.convertToMarkdown();  // 手动转换
window.tencentDocExtractorInstance.exportToFile();       // 手动导出
```

### Chrome DevTools 使用
```bash
1. 打开开发者工具 (F12)
2. 切换到 Console 标签
3. 运行调试命令
4. 查看 Network 标签检查资源加载
5. 使用 Performance 标签分析性能
```

## 📊 测试结果记录

### 测试记录模板
```
测试时间: ___________
Chrome版本: ___________
测试文档: ___________

性能指标:
- 侧边栏响应时间: _____ms
- 转换完成时间: _____ms
- 生成Markdown长度: _____字符
- 内存占用: _____MB

功能测试:
□ 基础转换 - 通过/失败
□ 嵌套列表 - 通过/失败  
□ 表格解析 - 通过/失败
□ 代码块 - 通过/失败
□ 图片处理 - 通过/失败
□ 思维导图 - 通过/失败

问题记录:
_________________________
```

## 🚨 故障处理

### 紧急问题处理
```javascript
// 重置扩展状态
window.tencentDocExtractorInstance?.destroy();
location.reload();

// 清除处理标记
$$('[data-parsed]').forEach(el => el.removeAttribute('data-parsed'));

// 强制重新初始化
delete window.tencentDocExtractorInstance;
// 然后重新点击扩展图标
```

### 性能问题处理
```javascript
// 检查DOM查询频率
let queryCount = 0;
const originalQuerySelector = document.querySelector;
document.querySelector = function(...args) {
  queryCount++;
  return originalQuerySelector.apply(this, args);
};

// 运行转换后查看queryCount
console.log('DOM查询次数:', queryCount);
```

## 📈 性能基准

### 预期性能指标
| 指标 | 目标值 | 测试方法 |
|-----|--------|----------|
| 侧边栏响应 | <2秒 | 点击图标到显示 |
| 转换时间 | <3秒 | 复杂文档转换时间 |
| 内存占用 | <5MB | Chrome任务管理器 |
| 初始化时间 | <500ms | 首次加载时间 |

### 性能测试脚本
```javascript
// 综合性能测试
async function performanceTest() {
  console.time('完整流程');
  
  console.time('初始化');
  await window.tencentDocExtractorInstance.initializeAsync();
  console.timeEnd('初始化');
  
  console.time('转换');
  await window.tencentDocExtractorInstance.convertToMarkdown();
  console.timeEnd('转换');
  
  console.timeEnd('完整流程');
  
  console.log('内存使用:', Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB');
}

// 运行性能测试
performanceTest();
```

---

## 🎯 测试重点

本文档重点关注：
1. **功能完整性测试** - 确保所有功能正常工作
2. **性能基准测试** - 验证优化效果
3. **边界情况测试** - 处理异常和特殊情况
4. **兼容性测试** - 不同文档类型的适配性

完整的技术细节请参考 [技术文档](TECHNICAL_DOCS.md) 和 [核心技术点](CORE_POINTS_AND_CHALLENGES.md)。 