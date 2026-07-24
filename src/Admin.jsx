import { useState, useEffect } from 'react';
import axios from 'axios';

function Admin() {
  const [results, setResults] = useState({});
  const [stores, setStores] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [exporting, setExporting] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [newCapacity, setNewCapacity] = useState('');
  const [importing, setImporting] = useState(false);
  const [showAllocationDetail, setShowAllocationDetail] = useState(null);
  const [newStudent, setNewStudent] = useState({ id: '', name: '', type: '非服务' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [storesRes, resultsRes, studentsRes] = await Promise.all([
        axios.get('/api/stores'),
        axios.get('/api/admin/results'),
        axios.get('/api/admin/students')
      ]);
      if (storesRes.data.success) setStores(storesRes.data.data);
      if (resultsRes.data.success) setResults(resultsRes.data.data);
      if (studentsRes.data.success) setStudents(studentsRes.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await axios.get('/api/admin/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', 'store-allocation-result.xlsx');
      document.body.appendChild(link); link.click(); link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) { alert('导出失败'); }
    finally { setExporting(false); }
  };

  const handleImport = async (e, type) => {
    const file = e.target.files[0]; if (!file) return;
    setImporting(true);
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await axios.post(`/api/admin/import-${type}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      alert(res.data.message); if (res.data.success) fetchData();
    } catch (e) { alert('导入失败'); }
    finally { setImporting(false); e.target.value = ''; }
  };

  const handleSaveCapacity = async () => {
    if (!editingStore || !newCapacity) return;
    const capacity = parseInt(newCapacity);
    if (isNaN(capacity) || capacity < 1) { alert('请输入有效数字'); return; }
    try {
      const res = await axios.put('/api/admin/store-capacity', { storeName: editingStore.name, capacity, type: editingStore.type });
      alert(res.data.message); if (res.data.success) { setEditingStore(null); fetchData(); }
    } catch (e) { alert('保存失败'); }
  };

  const handleClearAllocations = async () => {
    if (!window.confirm('确定清空所有志愿分配？此操作不可恢复！')) return;
    try {
      const res = await axios.post('/api/admin/clear-allocations');
      alert(res.data.message); fetchData();
    } catch (e) { alert('操作失败'); }
  };

  const handleAddStudent = async () => {
    if (!newStudent.id || !newStudent.name) { alert('工号和姓名必填'); return; }
    try {
      const res = await axios.post('/api/admin/student', newStudent);
      if (res.data.success) { setNewStudent({ id: '', name: '', type: '非服务' }); fetchData(); }
      else alert(res.data.message);
    } catch (e) { alert('添加失败'); }
  };

  const handleDeleteStudent = async (id, name) => {
    if (!window.confirm(`确定删除学员 ${name}？`)) return;
    try {
      const res = await axios.delete(`/api/admin/student/${id}`);
      alert(res.data.message); fetchData();
    } catch (e) { alert('删除失败'); }
  };

  const handleClearStudents = async () => {
    if (!window.confirm('确定清空所有学员？此操作不可恢复！')) return;
    try {
      const res = await axios.post('/api/admin/clear-students');
      alert(res.data.message); fetchData();
    } catch (e) { alert('操作失败'); }
  };

  const handleSync = async (type) => {
    if (!window.confirm(`确定从飞书同步${type === 'stores' ? '门店' : '学员'}信息？${type === 'students' ? '新学员会自动添加，已有学员信息会更新' : '门店数据会全量更新'}`)) return;
    setImporting(true);
    try {
      const res = await axios.post(`/api/admin/sync-${type}`);
      alert(res.data.message); if (res.data.success) fetchData();
    } catch (e) { alert('同步失败'); }
    finally { setImporting(false); }
  };

  const handleSyncToFeishu = async () => {
    if (!window.confirm('确定把分配结果同步到飞书参训学员信息表？')) return;
    setImporting(true);
    try {
      const res = await axios.post('/api/admin/sync-to-feishu');
      alert(res.data.message);
    } catch (e) { alert('同步失败'); }
    finally { setImporting(false); }
  };

  const serviceStores = stores.filter(s => s.type === '服务');
  const nonServiceStores = stores.filter(s => s.type === '非服务');
  const stats = {
    totalStores: stores.length, serviceStores: serviceStores.length, nonServiceStores: nonServiceStores.length,
    serviceCapacity: serviceStores.reduce((a, s) => a + s.capacity, 0),
    nonServiceCapacity: nonServiceStores.reduce((a, s) => a + s.capacity, 0),
    totalAllocated: results.totalAllocated || 0
  };

  const getStoresByTab = () => activeTab === 'service' ? serviceStores : activeTab === 'non-service' ? nonServiceStores : stores;
  const getAllocationDetails = (n) => results.allocations?.[n] || [];

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)' }}><div style={{ color: 'var(--ink-light)' }}>加载中...</div></div>;

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 100, height: 56, background: 'var(--cream)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.1rem', fontWeight: 700 }}>📊 管理员后台</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => handleSync('stores')} disabled={importing} style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>{importing ? '...' : '🔄 同步门店'}</button>
          <button onClick={() => handleSync('students')} disabled={importing} style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>{importing ? '...' : '🔄 同步学员'}</button>
          <button onClick={handleSyncToFeishu} disabled={importing || stats.totalAllocated === 0} style={{ background: '#059669', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>{importing ? '...' : '📤 同步到飞书'}</button>
          <label style={{ background: 'var(--blue)', color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
            {importing ? '...' : '📥 导入门店'}<input type="file" accept=".xlsx,.xls" onChange={e => handleImport(e, 'stores')} style={{ display: 'none' }} />
          </label>
          <label style={{ background: '#2d6a4f', color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
            {importing ? '...' : '📥 导入学员'}<input type="file" accept=".xlsx,.xls" onChange={e => handleImport(e, 'students')} style={{ display: 'none' }} />
          </label>
          <button onClick={handleClearAllocations} style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>🗑️ 清空志愿</button>
          <button onClick={fetchData} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>🔄 刷新</button>
          <button onClick={handleExport} disabled={exporting} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>{exporting ? '...' : '📥 导出Excel'}</button>
        </div>
      </header>

      <div className="tab-bar">
        {[['overview','总览'],['service','服务类门店'],['non-service','非服务类门店'],['details','分配详情'],['students','学员清单']].map(([k, v]) =>
          <button key={k} onClick={() => setActiveTab(k)} className={`tab ${activeTab === k ? 'active' : ''}`}>{v}</button>
        )}
      </div>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* 统计卡片 */}
        {activeTab !== 'students' && (
          <div style={{ display: 'grid', gridTemplateColumns: (activeTab === 'overview' || activeTab === 'details') ? 'repeat(4,1fr)' : 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
            {(activeTab === 'overview' || activeTab === 'details') ? (
              <>
                <div className="card" style={{ textAlign: 'center' }}><div className="stat-number" style={{ color: 'var(--blue)' }}>{stats.totalStores}</div><div className="stat-label">总门店数（服务{stats.serviceStores}+非服务{stats.nonServiceStores}）</div></div>
                <div className="card" style={{ textAlign: 'center' }}><div className="stat-number" style={{ color: '#2d6a4f' }}>{stats.serviceCapacity + stats.nonServiceCapacity}</div><div className="stat-label">总容量（服务{stats.serviceCapacity}+非服务{stats.nonServiceCapacity}）</div></div>
                <div className="card" style={{ textAlign: 'center' }}><div className="stat-number" style={{ color: 'var(--yellow)' }}>{stats.totalAllocated}</div><div className="stat-label">已分配</div></div>
                <div className="card" style={{ textAlign: 'center' }}><div className="stat-number" style={{ color: 'var(--red)' }}>{stats.serviceCapacity + stats.nonServiceCapacity - stats.totalAllocated}</div><div className="stat-label">剩余名额</div></div>
              </>
            ) : activeTab === 'service' ? (
              <>
                <div className="card" style={{ textAlign: 'center' }}><div className="stat-number" style={{ color: 'var(--blue)' }}>{stats.serviceStores}</div><div className="stat-label">服务类门店</div></div>
                <div className="card" style={{ textAlign: 'center' }}><div className="stat-number" style={{ color: '#2d6a4f' }}>{stats.serviceCapacity}</div><div className="stat-label">总容量</div></div>
                <div className="card" style={{ textAlign: 'center' }}><div className="stat-number" style={{ color: 'var(--red)' }}>{stats.serviceCapacity - serviceStores.reduce((a,s)=>a+s.enrolled,0)}</div><div className="stat-label">剩余名额</div></div>
              </>
            ) : (
              <>
                <div className="card" style={{ textAlign: 'center' }}><div className="stat-number" style={{ color: 'var(--blue)' }}>{stats.nonServiceStores}</div><div className="stat-label">非服务类门店</div></div>
                <div className="card" style={{ textAlign: 'center' }}><div className="stat-number" style={{ color: '#2d6a4f' }}>{stats.nonServiceCapacity}</div><div className="stat-label">总容量</div></div>
                <div className="card" style={{ textAlign: 'center' }}><div className="stat-number" style={{ color: 'var(--red)' }}>{stats.nonServiceCapacity - nonServiceStores.reduce((a,s)=>a+s.enrolled,0)}</div><div className="stat-label">剩余名额</div></div>
              </>
            )}
          </div>
        )}

        {/* 门店列表 */}
        {activeTab !== 'details' && activeTab !== 'students' && (
          <div className="card fade-in">
            <h2 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.1rem', fontWeight: 700, marginBottom: 20 }}>
              {activeTab === 'overview' ? '所有门店' : activeTab === 'service' ? '服务类门店' : '非服务类门店'}
              <span style={{ fontSize: '0.85rem', color: 'var(--ink-faint)', fontWeight: 400, marginLeft: 8 }}>共{getStoresByTab().length}家</span>
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="app-table">
                <thead><tr><th>门店名称</th>{activeTab === 'overview' && <th style={{ textAlign: 'center' }}>类型</th>}<th style={{ textAlign: 'center' }}>容量</th><th style={{ textAlign: 'center' }}>已分配</th><th style={{ textAlign: 'center' }}>剩余</th><th style={{ textAlign: 'center' }}>状态</th><th style={{ textAlign: 'center' }}>操作</th></tr></thead>
                <tbody>{getStoresByTab().map(s => (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    {activeTab === 'overview' && <td style={{ textAlign: 'center' }}><span className={`badge ${s.type === '服务' ? 'badge-service' : 'badge-non-service'}`}>{s.type}</span></td>}
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{editingStore?.name === s.name ? <input type="number" value={newCapacity} onChange={e => setNewCapacity(e.target.value)} className="app-input" style={{ width: 60, textAlign: 'center', padding: '4px 8px' }} min="1" /> : s.capacity}</td>
                    <td style={{ textAlign: 'center' }}><button onClick={() => s.enrolled > 0 && setShowAllocationDetail(s.name)} style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: s.enrolled > 0 ? 'pointer' : 'default', fontWeight: 600, textDecoration: s.enrolled > 0 ? 'underline' : 'none' }}>{s.enrolled}</button></td>
                    <td style={{ textAlign: 'center' }}><span style={{ fontWeight: 700, color: s.remaining > 0 ? '#2d6a4f' : 'var(--red)' }}>{s.remaining}</span></td>
                    <td style={{ textAlign: 'center' }}><span className={`badge ${s.available ? 'badge-available' : 'badge-full'}`}>{s.available ? '可选' : '已满'}</span></td>
                    <td style={{ textAlign: 'center' }}>{editingStore?.name === s.name ? (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button onClick={handleSaveCapacity} style={{ background: 'var(--blue)', color: 'white', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}>保存</button>
                        <button onClick={() => setEditingStore(null)} style={{ background: 'var(--border)', color: 'var(--ink-light)', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}>取消</button>
                      </div>
                    ) : <button onClick={() => { setEditingStore(s); setNewCapacity(s.capacity.toString()); }} style={{ background: 'none', color: 'var(--blue)', border: '1px solid var(--blue)', borderRadius: 4, padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}>编辑</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* 分配详情 */}
        {activeTab === 'details' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.1rem', fontWeight: 700 }}>分配详情 <span style={{ fontSize: '0.85rem', color: 'var(--ink-faint)', fontWeight: 400, marginLeft: 8 }}>共{stats.totalAllocated}人已分配</span></h2>
              {stats.totalAllocated > 0 && <button onClick={handleClearAllocations} style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>🗑️ 清空所有</button>}
            </div>
            {/* 服务类门店 */}
            <div className="card fade-in" style={{ marginBottom: 16 }}>
              <h3 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1rem', fontWeight: 700, marginBottom: 16, color: 'var(--blue)' }}>
                服务类门店（{serviceStores.length}家）
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="app-table">
                  <thead><tr><th>门店</th><th style={{ textAlign: 'center' }}>容量</th><th style={{ textAlign: 'center' }}>已分配</th><th style={{ textAlign: 'center' }}>剩余</th><th>学员</th></tr></thead>
                  <tbody>{serviceStores.map(s => {
                    const allocs = results.allocations?.[s.name] || [];
                    return <tr key={s.name}><td>{s.name}</td><td style={{ textAlign: 'center' }}>{s.capacity}</td><td style={{ textAlign: 'center', fontWeight: 600 }}>{allocs.length}</td><td style={{ textAlign: 'center' }}><span style={{ fontWeight: 700, color: s.remaining > 0 ? '#2d6a4f' : 'var(--red)' }}>{s.remaining}</span></td><td>{allocs.length > 0 ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{allocs.map((a, i) => <span key={i} style={{ padding: '2px 8px', background: 'var(--cream)', borderRadius: 4, fontSize: '0.8rem', border: '1px solid var(--border)' }}>{a.studentName}</span>)}</div> : <span style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>-</span>}</td></tr>;
                  })}</tbody>
                </table>
              </div>
            </div>
            {/* 非服务类门店 */}
            <div className="card fade-in">
              <h3 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1rem', fontWeight: 700, marginBottom: 16, color: 'var(--red)' }}>
                非服务类门店（{nonServiceStores.length}家）
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="app-table">
                  <thead><tr><th>门店</th><th style={{ textAlign: 'center' }}>容量</th><th style={{ textAlign: 'center' }}>已分配</th><th style={{ textAlign: 'center' }}>剩余</th><th>学员</th></tr></thead>
                  <tbody>{nonServiceStores.map(s => {
                    const allocs = results.allocations?.[s.name] || [];
                    return <tr key={s.name}><td>{s.name}</td><td style={{ textAlign: 'center' }}>{s.capacity}</td><td style={{ textAlign: 'center', fontWeight: 600 }}>{allocs.length}</td><td style={{ textAlign: 'center' }}><span style={{ fontWeight: 700, color: s.remaining > 0 ? '#2d6a4f' : 'var(--red)' }}>{s.remaining}</span></td><td>{allocs.length > 0 ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{allocs.map((a, i) => <span key={i} style={{ padding: '2px 8px', background: 'var(--cream)', borderRadius: 4, fontSize: '0.8rem', border: '1px solid var(--border)' }}>{a.studentName}</span>)}</div> : <span style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>-</span>}</td></tr>;
                  })}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 学员清单 */}
        {activeTab === 'students' && (
          <div className="card fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.1rem', fontWeight: 700 }}>
                学员清单 <span style={{ fontSize: '0.85rem', color: 'var(--ink-faint)', fontWeight: 400, marginLeft: 8 }}>共{students.length}人</span>
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleSync('students')} disabled={importing} style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>{importing ? '...' : '🔄 从飞书同步'}</button>
                <button onClick={handleClearStudents} style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>🗑️ 清空学员</button>
              </div>
            </div>
            {/* 添加学员 */}
            <div style={{ background: 'rgba(43,127,216,0.04)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12 }}>添加学员</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>工号 *</label><input value={newStudent.id} onChange={e => setNewStudent({ ...newStudent, id: e.target.value })} className="app-input" placeholder="如 S001" /></div>
                <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>姓名 *</label><input value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} className="app-input" placeholder="姓名" /></div>
                <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>类型</label>
                  <select value={newStudent.type} onChange={e => setNewStudent({ ...newStudent, type: e.target.value })} className="app-input">
                    <option value="服务">服务</option><option value="非服务">非服务</option>
                  </select>
                </div>
                <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>职位名称</label><input value={newStudent.jobTitle} onChange={e => setNewStudent({ ...newStudent, jobTitle: e.target.value })} className="app-input" placeholder="职位" /></div>
                <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>一级部门</label><input value={newStudent.dept1} onChange={e => setNewStudent({ ...newStudent, dept1: e.target.value })} className="app-input" placeholder="一级部门" /></div>
                <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>二级部门</label><input value={newStudent.dept2} onChange={e => setNewStudent({ ...newStudent, dept2: e.target.value })} className="app-input" placeholder="二级部门" /></div>
                <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>三级部门</label><input value={newStudent.dept3} onChange={e => setNewStudent({ ...newStudent, dept3: e.target.value })} className="app-input" placeholder="三级部门" /></div>
                <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>四级部门</label><input value={newStudent.dept4} onChange={e => setNewStudent({ ...newStudent, dept4: e.target.value })} className="app-input" placeholder="四级部门" /></div>
                <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>五级部门</label><input value={newStudent.dept5} onChange={e => setNewStudent({ ...newStudent, dept5: e.target.value })} className="app-input" placeholder="五级部门" /></div>
              </div>
              <button onClick={handleAddStudent} className="btn-primary" style={{ marginTop: 12, padding: '8px 20px', fontSize: '0.85rem' }}>+ 添加学员</button>
            </div>
            {/* 学员列表 */}
            <div style={{ overflowX: 'auto' }}>
              <table className="app-table">
                <thead><tr>
                  <th>工号</th><th>姓名</th><th style={{ textAlign: 'center' }}>类型</th>
                  <th>职位</th><th>部门路径</th>
                  <th style={{ textAlign: 'center' }}>分配状态</th><th style={{ textAlign: 'center' }}>操作</th>
                </tr></thead>
                <tbody>{students.map(s => (
                  <tr key={s.id}>
                    <td>{s.id}</td><td>{s.name}</td>
                    <td style={{ textAlign: 'center' }}><span className={`badge ${s.type === '服务' ? 'badge-service' : 'badge-non-service'}`}>{s.type}</span></td>
                    <td style={{ fontSize: '0.85rem' }}>{s.jobTitle || '-'}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--ink-light)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[s.dept1, s.dept2, s.dept3, s.dept4, s.dept5].filter(Boolean).join(' > ') || '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>{s.allocated ? <span style={{ color: 'var(--blue)', fontWeight: 600 }}>{s.allocated}</span> : <span style={{ color: 'var(--ink-faint)' }}>未分配</span>}</td>
                    <td style={{ textAlign: 'center' }}><button onClick={() => handleDeleteStudent(s.id, s.name)} style={{ background: 'none', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 4, padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}>删除</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* 编辑容量弹窗 */}
      {editingStore && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--cream)', borderRadius: 16, padding: '2rem', maxWidth: 400, width: '90%' }}>
            <h3 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>编辑门店容量</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--ink-light)', marginBottom: 16 }}>{editingStore.name}</p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>容量（人数）</label>
              <input type="number" value={newCapacity} onChange={e => setNewCapacity(e.target.value)} className="app-input" min="1" style={{ width: '100%' }} />
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-faint)', marginTop: 8 }}>当前已分配：{editingStore.enrolled}人</p>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingStore(null)} className="btn-secondary">取消</button>
              <button onClick={handleSaveCapacity} className="btn-primary">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 分配详情弹窗 */}
      {showAllocationDetail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--cream)', borderRadius: 16, padding: '2rem', maxWidth: 500, width: '90%' }}>
            <h3 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>📋 分配详情</h3>
            <p style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16 }}>{showAllocationDetail}</p>
            {getAllocationDetails(showAllocationDetail).length === 0 ? (
              <p style={{ color: 'var(--ink-faint)', textAlign: 'center', padding: 20 }}>暂无分配数据</p>
            ) : (
              <div style={{ background: 'rgba(43,127,216,0.06)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                {getAllocationDetails(showAllocationDetail).map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < getAllocationDetails(showAllocationDetail).length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontWeight: 600 }}>{s.studentName}</span>
                    <span style={{ color: 'var(--ink-light)', fontSize: '0.85rem' }}>第{s.choice}志愿</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowAllocationDetail(null)} className="btn-secondary" style={{ width: '100%' }}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
