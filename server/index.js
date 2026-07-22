import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// 数据文件路径 - 支持 Render 持久化磁盘
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STORES_FILE = path.join(DATA_DIR, 'stores.json');
const STUDENTS_FILE = path.join(DATA_DIR, 'students.json');
const ALLOCATIONS_FILE = path.join(DATA_DIR, 'allocations.json');

// 内存缓存
let storesData = { service: [], nonService: [] };
let studentsData = {};
let allocationsData = { allocations: [], timestamp: null };
let allocationLock = new Map();

// 初始化数据
function initData() {
  // 确保数据目录存在
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  try {
    // 如果数据文件不存在，从默认数据复制
    if (!fs.existsSync(STORES_FILE)) {
      const defaultStores = path.join(__dirname, '..', 'server', 'data', 'stores.json');
      if (fs.existsSync(defaultStores)) {
        fs.copyFileSync(defaultStores, STORES_FILE);
      }
    }
    if (!fs.existsSync(STUDENTS_FILE)) {
      const defaultStudents = path.join(__dirname, '..', 'server', 'data', 'students.json');
      if (fs.existsSync(defaultStudents)) {
        fs.copyFileSync(defaultStudents, STUDENTS_FILE);
      }
    }
    if (!fs.existsSync(ALLOCATIONS_FILE)) {
      fs.writeFileSync(ALLOCATIONS_FILE, JSON.stringify({ allocations: [], timestamp: null }, null, 2));
    }
    
    storesData = JSON.parse(fs.readFileSync(STORES_FILE, 'utf-8'));
    studentsData = JSON.parse(fs.readFileSync(STUDENTS_FILE, 'utf-8'));
    allocationsData = JSON.parse(fs.readFileSync(ALLOCATIONS_FILE, 'utf-8'));
    
    console.log('数据初始化完成:', {
      serviceStores: storesData.service.length,
      nonServiceStores: storesData.nonService.length,
      students: Object.keys(studentsData).length,
      allocations: allocationsData.allocations.length
    });
  } catch (error) {
    console.error('数据初始化失败:', error.message);
  }
}

// 保存分配结果
function saveAllocations() {
  try {
    allocationsData.timestamp = new Date().toISOString();
    fs.writeFileSync(ALLOCATIONS_FILE, JSON.stringify(allocationsData, null, 2));
  } catch (error) {
    console.error('保存分配结果失败:', error.message);
  }
}

// 计算门店已分配人数
function getStoreEnrollments() {
  const enrollments = {};
  allocationsData.allocations.forEach(alloc => {
    if (!enrollments[alloc.store]) {
      enrollments[alloc.store] = 0;
    }
    enrollments[alloc.store]++;
  });
  return enrollments;
}

// API: 获取门店列表（带实时余量）
app.get('/api/stores', (req, res) => {
  const { type } = req.query;
  const enrollments = getStoreEnrollments();
  
  let stores = [];
  if (type === '服务') {
    stores = storesData.service;
  } else if (type === '非服务') {
    stores = storesData.nonService;
  } else {
    stores = [...storesData.service, ...storesData.nonService];
  }
  
  const result = stores.map(store => ({
    ...store,
    enrolled: enrollments[store.name] || 0,
    remaining: store.capacity - (enrollments[store.name] || 0),
    available: (enrollments[store.name] || 0) < store.capacity
  }));
  
  res.json({ success: true, data: result });
});

// API: 验证学员身份
app.post('/api/verify', (req, res) => {
  const { studentId, name } = req.body;
  
  const student = studentsData[studentId];
  if (!student) {
    return res.json({ success: false, message: '工号不存在' });
  }
  
  if (student.name !== name) {
    return res.json({ success: false, message: '姓名与工号不匹配' });
  }
  
  // 检查是否已分配
  const existing = allocationsData.allocations.find(a => a.studentId === studentId);
  if (existing) {
    return res.json({ 
      success: false, 
      message: `你已被分配到：${existing.store}`,
      alreadyAllocated: true,
      store: existing.store,
      choice: existing.choice,
      type: student.type
    });
  }
  
  res.json({
    success: true,
    data: {
      id: student.id,
      name: student.name,
      type: student.type
    }
  });
});

// API: 提交志愿（带并发控制）
app.post('/api/allocate', (req, res) => {
  const { studentId, name, choices } = req.body;
  
  // 验证学员
  const student = studentsData[studentId];
  if (!student || student.name !== name) {
    return res.json({ success: false, message: '身份验证失败' });
  }
  
  // 并发锁 - 防止同一学员同时提交
  if (allocationLock.has(studentId)) {
    return res.json({ success: false, message: '请勿重复提交' });
  }
  
  allocationLock.set(studentId, true);
  
  try {
    // 检查是否已分配
    const existing = allocationsData.allocations.find(a => a.studentId === studentId);
    if (existing) {
      return res.json({ 
        success: false, 
        message: `你已被分配到：${existing.store}` 
      });
    }
    
    // 计算当前已分配人数
    const enrollments = getStoreEnrollments();
    
    // 按志愿顺序尝试分配
    let allocatedStore = null;
    let allocatedChoice = 0;
    
    for (let i = 0; i < choices.length; i++) {
      const storeName = choices[i];
      
      // 查找门店
      const allStores = [...storesData.service, ...storesData.nonService];
      const store = allStores.find(s => s.name === storeName);
      
      if (!store) continue;
      
      // 检查门店类型是否匹配
      if (store.type !== student.type) continue;
      
      // 检查是否有名额
      const enrolled = enrollments[storeName] || 0;
      if (enrolled < store.capacity) {
        allocatedStore = store;
        allocatedChoice = i + 1;
        break;
      }
    }
    
    if (!allocatedStore) {
      return res.json({
        success: false,
        message: '所选门店均已满员，请重新选择'
      });
    }
    
    // 记录分配结果
    const allocation = {
      studentId: student.id,
      studentName: student.name,
      studentType: student.type,
      store: allocatedStore.name,
      choice: allocatedChoice,
      timestamp: new Date().toISOString()
    };
    
    allocationsData.allocations.push(allocation);
    saveAllocations();
    
    res.json({
      success: true,
      message: `恭喜！成功分配到第${allocatedChoice}志愿：${allocatedStore.name}`,
      data: {
        store: allocatedStore.name,
        choice: allocatedChoice
      }
    });
    
  } catch (error) {
    console.error('分配失败:', error.message);
    res.json({ success: false, message: '系统错误，请稍后重试' });
  } finally {
    allocationLock.delete(studentId);
  }
});

// API: 管理员查看分配结果
app.get('/api/admin/results', (req, res) => {
  try {
    const enrollments = getStoreEnrollments();
    const results = {};
    
    allocationsData.allocations.forEach(alloc => {
      if (!results[alloc.store]) {
        results[alloc.store] = [];
      }
      results[alloc.store].push({
        studentId: alloc.studentId,
        studentName: alloc.studentName,
        studentType: alloc.studentType,
        choice: alloc.choice,
        timestamp: alloc.timestamp
      });
    });
    
    res.json({ 
      success: true, 
      data: {
        allocations: results,
        enrollments,
        totalAllocated: allocationsData.allocations.length,
        timestamp: allocationsData.timestamp
      }
    });
  } catch (error) {
    res.json({ success: false, message: '获取数据失败' });
  }
});

// API: 导出Excel
app.get('/api/admin/export', (req, res) => {
  try {
    const enrollments = getStoreEnrollments();
    const allStores = [...storesData.service, ...storesData.nonService];
    
    // 创建工作簿
    const wb = xlsx.utils.book_new();
    
    // 1. 分配结果表
    const allocData = allocationsData.allocations.map(alloc => ({
      '工号': alloc.studentId,
      '姓名': alloc.studentName,
      '类型': alloc.studentType,
      '分配门店': alloc.store,
      '志愿顺序': `第${alloc.choice}志愿`,
      '分配时间': alloc.timestamp
    }));
    const ws1 = xlsx.utils.json_to_sheet(allocData);
    xlsx.utils.book_append_sheet(wb, ws1, '分配结果');
    
    // 2. 门店汇总表
    const storeSummary = allStores.map(store => ({
      '门店名称': store.name,
      '门店类型': store.type,
      '容量': store.capacity,
      '已分配': enrollments[store.name] || 0,
      '剩余': store.capacity - (enrollments[store.name] || 0),
      '状态': (enrollments[store.name] || 0) >= store.capacity ? '已满' : '可选'
    }));
    const ws2 = xlsx.utils.json_to_sheet(storeSummary);
    xlsx.utils.book_append_sheet(wb, ws2, '门店汇总');
    
    // 3. 学员名单表
    const studentList = Object.values(studentsData).map(student => {
      const alloc = allocationsData.allocations.find(a => a.studentId === student.id);
      return {
        '工号': student.id,
        '姓名': student.name,
        '类型': student.type,
        '分配门店': alloc ? alloc.store : '未分配',
        '志愿顺序': alloc ? `第${alloc.choice}志愿` : '-'
      };
    });
    const ws3 = xlsx.utils.json_to_sheet(studentList);
    xlsx.utils.book_append_sheet(wb, ws3, '学员名单');
    
    // 生成Excel文件
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=store-allocation-result.xlsx');
    res.send(buffer);
    
  } catch (error) {
    console.error('导出失败:', error.message);
    res.json({ success: false, message: '导出失败' });
  }
});

// API: 管理员手动分配
app.post('/api/admin/allocate', (req, res) => {
  const { studentId, storeName } = req.body;
  
  const student = studentsData[studentId];
  if (!student) {
    return res.json({ success: false, message: '学员不存在' });
  }
  
  // 检查是否已分配
  const existing = allocationsData.allocations.find(a => a.studentId === studentId);
  if (existing) {
    return res.json({ success: false, message: `该学员已分配到：${existing.store}` });
  }
  
  // 查找门店
  const allStores = [...storesData.service, ...storesData.nonService];
  const store = allStores.find(s => s.name === storeName);
  if (!store) {
    return res.json({ success: false, message: '门店不存在' });
  }
  
  // 检查容量
  const enrollments = getStoreEnrollments();
  if ((enrollments[storeName] || 0) >= store.capacity) {
    return res.json({ success: false, message: '门店已满' });
  }
  
  // 记录分配
  const allocation = {
    studentId: student.id,
    studentName: student.name,
    studentType: student.type,
    store: storeName,
    choice: 0, // 0表示管理员手动分配
    timestamp: new Date().toISOString()
  };
  
  allocationsData.allocations.push(allocation);
  saveAllocations();
  
  res.json({
    success: true,
    message: `成功将 ${student.name} 分配到 ${storeName}`
  });
});

// API: 删除分配（重置）
app.delete('/api/admin/allocate/:studentId', (req, res) => {
  const { studentId } = req.params;
  
  const index = allocationsData.allocations.findIndex(a => a.studentId === studentId);
  if (index === -1) {
    return res.json({ success: false, message: '未找到分配记录' });
  }
  
  allocationsData.allocations.splice(index, 1);
  saveAllocations();
  
  res.json({ success: true, message: '已删除分配记录' });
});

// API: 更新门店容量
app.put('/api/admin/store-capacity', (req, res) => {
  const { storeName, capacity, type } = req.body;
  
  if (!storeName || capacity === undefined || !type) {
    return res.json({ success: false, message: '参数不完整' });
  }
  
  // 查找并更新门店
  const stores = type === '服务' ? storesData.service : storesData.nonService;
  const store = stores.find(s => s.name === storeName);
  
  if (!store) {
    return res.json({ success: false, message: '门店不存在' });
  }
  
  // 检查新容量是否小于已分配人数
  const enrollments = getStoreEnrollments();
  const enrolled = enrollments[storeName] || 0;
  if (capacity < enrolled) {
    return res.json({ 
      success: false, 
      message: `容量不能小于已分配人数（${enrolled}人）` 
    });
  }
  
  // 更新容量
  store.capacity = capacity;
  
  // 保存到文件
  try {
    fs.writeFileSync(STORES_FILE, JSON.stringify(storesData, null, 2));
    res.json({ 
      success: true, 
      message: `${storeName} 容量已更新为 ${capacity} 人`
    });
  } catch (error) {
    console.error('保存门店数据失败:', error.message);
    res.json({ success: false, message: '保存失败' });
  }
});

// 生产环境：托管前端静态文件
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// 启动服务器
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  initData();
});
