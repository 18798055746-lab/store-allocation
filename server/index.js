import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// 文件上传配置
const upload = multer({ dest: '/tmp/uploads/' });

// 数据文件路径 - 支持 Render 持久化磁盘
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STORES_FILE = path.join(DATA_DIR, 'stores.json');
const STUDENTS_FILE = path.join(DATA_DIR, 'students.json');
const ALLOCATIONS_FILE = path.join(DATA_DIR, 'allocations.json');
const DRAFTS_FILE = path.join(DATA_DIR, 'drafts.json');

// 志愿填报时间配置
const ALLOCATION_START = new Date('2026-07-27T09:00:00+08:00');
const ALLOCATION_END = new Date('2026-07-29T19:00:00+08:00');

// 内存缓存
let storesData = { service: [], nonService: [] };
let studentsData = {};
let allocationsData = { allocations: [], timestamp: null };
let draftsData = {};
let allocationLock = new Map();

// 检查是否在填报时间内
function isWithinAllocationTime() {
  const now = new Date();
  return now >= ALLOCATION_START && now <= ALLOCATION_END;
}

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
    if (!fs.existsSync(DRAFTS_FILE)) {
      fs.writeFileSync(DRAFTS_FILE, JSON.stringify({}, null, 2));
    }
    
    storesData = JSON.parse(fs.readFileSync(STORES_FILE, 'utf-8'));
    studentsData = JSON.parse(fs.readFileSync(STUDENTS_FILE, 'utf-8'));
    allocationsData = JSON.parse(fs.readFileSync(ALLOCATIONS_FILE, 'utf-8'));
    draftsData = JSON.parse(fs.readFileSync(DRAFTS_FILE, 'utf-8'));
    
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

// 保存数据
function saveAllocations() {
  try {
    allocationsData.timestamp = new Date().toISOString();
    fs.writeFileSync(ALLOCATIONS_FILE, JSON.stringify(allocationsData, null, 2));
  } catch (error) {
    console.error('保存分配结果失败:', error.message);
  }
}

function saveDrafts() {
  try {
    fs.writeFileSync(DRAFTS_FILE, JSON.stringify(draftsData, null, 2));
  } catch (error) {
    console.error('保存草稿失败:', error.message);
  }
}

function saveStores() {
  try {
    fs.writeFileSync(STORES_FILE, JSON.stringify(storesData, null, 2));
  } catch (error) {
    console.error('保存门店数据失败:', error.message);
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

// API: 获取填报时间配置
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    data: {
      startTime: ALLOCATION_START.toISOString(),
      endTime: ALLOCATION_END.toISOString(),
      isWithinTime: isWithinAllocationTime(),
      currentTime: new Date().toISOString()
    }
  });
});

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
  
  // 检查是否已提交（已分配）
  const existing = allocationsData.allocations.find(a => a.studentId === studentId);
  if (existing) {
    return res.json({ 
      success: false, 
      message: `你已提交志愿并分配到：${existing.store}`,
      alreadyAllocated: true,
      store: existing.store,
      choice: existing.choice,
      type: student.type
    });
  }
  
  // 检查是否有暂存的草稿
  const draft = draftsData[studentId] || null;
  
  res.json({
    success: true,
    data: {
      id: student.id,
      name: student.name,
      type: student.type,
      draft: draft
    }
  });
});

// API: 保存草稿（暂存志愿）
app.post('/api/draft', (req, res) => {
  const { studentId, name, choices } = req.body;
  
  // 验证学员
  const student = studentsData[studentId];
  if (!student || student.name !== name) {
    return res.json({ success: false, message: '身份验证失败' });
  }
  
  // 检查是否已提交
  const existing = allocationsData.allocations.find(a => a.studentId === studentId);
  if (existing) {
    return res.json({ success: false, message: '你已提交志愿，无法修改' });
  }
  
  // 保存草稿
  draftsData[studentId] = {
    choices: choices.filter(c => c !== null),
    savedAt: new Date().toISOString()
  };
  saveDrafts();
  
  res.json({
    success: true,
    message: '志愿已暂存',
    data: draftsData[studentId]
  });
});

// API: 获取草稿
app.get('/api/draft/:studentId', (req, res) => {
  const { studentId } = req.params;
  const draft = draftsData[studentId] || null;
  
  res.json({
    success: true,
    data: draft
  });
});

// API: 提交志愿（带并发控制）
app.post('/api/allocate', (req, res) => {
  const { studentId, name, choices } = req.body;
  
  // 检查是否在填报时间内
  if (!isWithinAllocationTime()) {
    return res.json({ 
      success: false, 
      message: '当前不在志愿填报时间内',
      startTime: ALLOCATION_START.toISOString(),
      endTime: ALLOCATION_END.toISOString()
    });
  }
  
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
        message: `你已提交志愿并分配到：${existing.store}` 
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
      choices: choices,
      timestamp: new Date().toISOString()
    };
    
    allocationsData.allocations.push(allocation);
    saveAllocations();
    
    // 删除草稿
    delete draftsData[studentId];
    saveDrafts();
    
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
  saveStores();
  
  res.json({ 
    success: true, 
    message: `${storeName} 容量已更新为 ${capacity} 人`
  });
});

// API: 管理员导入门店信息（Excel）
app.post('/api/admin/import-stores', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, message: '请上传文件' });
    }
    
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    const service = [];
    const nonService = [];
    
    data.forEach(row => {
      const name = row['门店名称'] || row['门店列表'] || row['name'];
      const capacity = parseInt(row['可容纳人数'] || row['门店可容纳人数'] || row['capacity']) || 2;
      const type = row['适配范围'] || row['类型'] || row['type'] || '非服务';
      const address = row['地址'] || row['地理位置'] || row['address'] || '';
      const distance = row['距离科技园'] || row['小米科技园距离门店（公里）'] || row['distance'] || '';
      
      if (name) {
        const store = { name, capacity, type: type.includes('服务') && !type.includes('非服务') ? '服务' : '非服务', address, distance };
        if (store.type === '服务') {
          service.push(store);
        } else {
          nonService.push(store);
        }
      }
    });
    
    if (service.length === 0 && nonService.length === 0) {
      return res.json({ success: false, message: '未找到有效数据，请检查Excel格式' });
    }
    
    storesData = { service, nonService };
    saveStores();
    
    // 删除临时文件
    fs.unlinkSync(req.file.path);
    
    res.json({
      success: true,
      message: `成功导入 ${service.length} 家服务类门店，${nonService.length} 家非服务类门店`,
      data: { service: service.length, nonService: nonService.length }
    });
    
  } catch (error) {
    console.error('导入失败:', error.message);
    res.json({ success: false, message: '导入失败: ' + error.message });
  }
});

// API: 管理员导入学员信息（Excel）
app.post('/api/admin/import-students', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, message: '请上传文件' });
    }
    
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    const students = {};
    let count = 0;
    
    data.forEach(row => {
      const id = row['工号'] || row['id'];
      const name = row['姓名'] || row['name'];
      const type = row['类型'] || row['站店类型'] || row['type'] || '非服务';
      const dept1 = row['一级部门'] || '';
      const dept2 = row['二级部门'] || '';
      const dept3 = row['三级部门'] || '';
      const dept4 = row['四级部门'] || '';
      const dept5 = row['五级部门'] || '';
      const jobTitle = row['职位名称'] || row['职位'] || '';

      if (id && name) {
        students[id] = {
          id, name,
          type: type.includes('服务') && !type.includes('非服务') ? '服务' : '非服务',
          dept1, dept2, dept3, dept4, dept5, jobTitle
        };
        count++;
      }
    });
    
    if (count === 0) {
      return res.json({ success: false, message: '未找到有效数据，请检查Excel格式' });
    }
    
    studentsData = students;
    fs.writeFileSync(STUDENTS_FILE, JSON.stringify(studentsData, null, 2));
    
    // 删除临时文件
    fs.unlinkSync(req.file.path);
    
    res.json({
      success: true,
      message: `成功导入 ${count} 名学员`,
      data: { count }
    });
    
  } catch (error) {
    console.error('导入失败:', error.message);
    res.json({ success: false, message: '导入失败: ' + error.message });
  }
});

// API: 清空所有分配
app.post('/api/admin/clear-allocations', (req, res) => {
  allocationsData = { allocations: [], timestamp: null };
  saveAllocations();
  // 同时清空草稿
  draftsData = {};
  saveDrafts();
  res.json({ success: true, message: '已清空所有志愿分配和暂存数据' });
});

// API: 获取学员列表
app.get('/api/admin/students', (req, res) => {
  const list = Object.values(studentsData).map(s => {
    const alloc = allocationsData.allocations.find(a => a.studentId === s.id);
    return { ...s, allocated: alloc ? alloc.store : null };
  });
  res.json({ success: true, data: list });
});

// API: 添加单个学员
app.post('/api/admin/student', (req, res) => {
  const { id, name, type, dept1, dept2, dept3, dept4, dept5, jobTitle } = req.body;
  if (!id || !name) return res.json({ success: false, message: '工号和姓名必填' });
  if (studentsData[id]) return res.json({ success: false, message: '工号已存在' });
  studentsData[id] = { id, name, type: type || '非服务', dept1: dept1||'', dept2: dept2||'', dept3: dept3||'', dept4: dept4||'', dept5: dept5||'', jobTitle: jobTitle||'' };
  fs.writeFileSync(STUDENTS_FILE, JSON.stringify(studentsData, null, 2));
  res.json({ success: true, message: `已添加学员 ${name}` });
});

// API: 删除单个学员
app.delete('/api/admin/student/:studentId', (req, res) => {
  const { studentId } = req.params;
  if (!studentsData[studentId]) return res.json({ success: false, message: '学员不存在' });
  const name = studentsData[studentId].name;
  delete studentsData[studentId];
  fs.writeFileSync(STUDENTS_FILE, JSON.stringify(studentsData, null, 2));
  res.json({ success: true, message: `已删除学员 ${name}` });
});

// API: 清空所有学员
app.post('/api/admin/clear-students', (req, res) => {
  const count = Object.keys(studentsData).length;
  studentsData = {};
  fs.writeFileSync(STUDENTS_FILE, JSON.stringify(studentsData, null, 2));
  res.json({ success: true, message: `已清空 ${count} 名学员` });
});

// 飞书配置
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || 'cli_a95721e82bfa9ccb';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || 'j39E8A1vuLnhmsj7PHwiEgOL4izaxEEE';
const FEISHU_APP_TOKEN = 'NKf3bzWUHaDFOusVstnc6PG4nPd';
const FEISHU_STORES_TABLE = 'tblgph76wLZmAB2L';
const FEISHU_STUDENTS_TABLE = 'tbl3M1FF07M6XcZm';

// 获取飞书 tenant_access_token
async function getFeishuToken() {
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET })
  });
  const data = await res.json();
  return data.tenant_access_token;
}

// 从飞书读取多维表记录（自动翻页）
async function feishuListRecords(token, tableId) {
  let allRecords = [];
  let pageToken = '';
  let hasMore = true;
  while (hasMore) {
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${tableId}/records?page_size=100${pageToken ? '&page_token=' + pageToken : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.data?.items) allRecords.push(...data.data.items);
    pageToken = data.data?.page_token || '';
    hasMore = data.data?.has_more || false;
  }
  return allRecords;
}

// API: 从飞书同步门店信息
app.post('/api/admin/sync-stores', async (req, res) => {
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    return res.json({ success: false, message: '未配置飞书应用凭证（FEISHU_APP_ID / FEISHU_APP_SECRET）' });
  }
  try {
    const token = await getFeishuToken();
    const records = await feishuListRecords(token, FEISHU_STORES_TABLE);
    const service = [];
    const nonService = [];
    records.forEach(r => {
      const name = r.fields['门店列表'];
      const capacity = parseInt(r.fields['门店可容纳人数']) || 0;
      const type = r.fields['适配范围'] || '非服务';
      if (name && capacity > 0) {
        const store = { name, capacity, type: type === '服务' ? '服务' : '非服务' };
        store.type === '服务' ? service.push(store) : nonService.push(store);
      }
    });
    storesData = { service, nonService };
    saveStores();
    res.json({ success: true, message: `同步完成：服务类${service.length}家，非服务类${nonService.length}家` });
  } catch (e) {
    console.error('同步门店失败:', e.message);
    res.json({ success: false, message: '同步失败: ' + e.message });
  }
});

// API: 从飞书同步学员信息（增量同步，只添加新学员，更新已有学员信息）
app.post('/api/admin/sync-students', async (req, res) => {
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    return res.json({ success: false, message: '未配置飞书应用凭证（FEISHU_APP_ID / FEISHU_APP_SECRET）' });
  }
  try {
    const token = await getFeishuToken();
    const records = await feishuListRecords(token, FEISHU_STUDENTS_TABLE);
    let added = 0, updated = 0;
    records.forEach(r => {
      const id = r.fields['工号'];
      let name = '';
      const nameField = r.fields['姓名'];
      if (Array.isArray(nameField)) {
        name = nameField[0]?.name || '';
      } else if (typeof nameField === 'string') {
        name = nameField;
      }
      const dept = r.fields['二级部门'] || '';
      const type = dept === '服务部' ? '服务' : '非服务';
      const dept3 = r.fields['三级部门'] || '';
      const dept4 = r.fields['四级部门'] || '';
      const dept5 = r.fields['五级部门'] || '';
      if (id && name) {
        if (studentsData[id]) {
          // 已有学员，更新信息
          Object.assign(studentsData[id], { name, type, dept1: '中国区', dept2: dept, dept3, dept4, dept5 });
          updated++;
        } else {
          // 新学员，添加
          studentsData[id] = { id, name, type, dept1: '中国区', dept2: dept, dept3, dept4, dept5, jobTitle: '' };
          added++;
        }
      }
    });
    fs.writeFileSync(STUDENTS_FILE, JSON.stringify(studentsData, null, 2));
    res.json({ success: true, message: `同步完成：新增 ${added} 人，更新 ${updated} 人，共 ${Object.keys(studentsData).length} 人` });
  } catch (e) {
    console.error('同步学员失败:', e.message);
    res.json({ success: false, message: '同步失败: ' + e.message });
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
