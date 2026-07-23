import { useState, useEffect } from 'react';
import axios from 'axios';

function Admin() {
  const [results, setResults] = useState({});
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [exporting, setExporting] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [newCapacity, setNewCapacity] = useState('');
  const [importing, setImporting] = useState(false);
  const [showAllocationDetail, setShowAllocationDetail] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [storesRes, resultsRes] = await Promise.all([
        axios.get('/api/stores'),
        axios.get('/api/admin/results')
      ]);

      if (storesRes.data.success) {
        setStores(storesRes.data.data);
      }
      if (resultsRes.data.success) {
        setResults(resultsRes.data.data);
      }
    } catch (err) {
      console.error('获取数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 导出Excel
  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await axios.get('/api/admin/export', {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'store-allocation-result.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('导出失败:', err);
      alert('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  // 导入门店信息
  const handleImportStores = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/admin/import-stores', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        alert(response.data.message);
        fetchData();
      } else {
        alert(response.data.message);
      }
    } catch (err) {
      alert('导入失败，请重试');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  // 导入学员信息
  const handleImportStudents = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/admin/import-students', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        alert(response.data.message);
        fetchData();
      } else {
        alert(response.data.message);
      }
    } catch (err) {
      alert('导入失败，请重试');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  // 开始编辑容量
  const handleEditCapacity = (store) => {
    setEditingStore(store);
    setNewCapacity(store.capacity.toString());
  };

  // 保存容量
  const handleSaveCapacity = async () => {
    if (!editingStore || !newCapacity) return;
    
    const capacity = parseInt(newCapacity);
    if (isNaN(capacity) || capacity < 1) {
      alert('请输入有效的容量数字');
      return;
    }

    try {
      const response = await axios.put('/api/admin/store-capacity', {
        storeName: editingStore.name,
        capacity: capacity,
        type: editingStore.type
      });

      if (response.data.success) {
        alert(response.data.message);
        setEditingStore(null);
        setNewCapacity('');
        fetchData();
      } else {
        alert(response.data.message);
      }
    } catch (err) {
      alert('保存失败，请重试');
    }
  };

  // 计算统计数据
  const serviceStores = stores.filter(s => s.type === '服务');
  const nonServiceStores = stores.filter(s => s.type === '非服务');
  
  const stats = {
    totalStores: stores.length,
    serviceStores: serviceStores.length,
    nonServiceStores: nonServiceStores.length,
    serviceCapacity: serviceStores.reduce((sum, s) => sum + s.capacity, 0),
    nonServiceCapacity: nonServiceStores.reduce((sum, s) => sum + s.capacity, 0),
    serviceEnrolled: serviceStores.reduce((sum, s) => sum + s.enrolled, 0),
    nonServiceEnrolled: nonServiceStores.reduce((sum, s) => sum + s.enrolled, 0),
    totalAllocated: results.totalAllocated || 0
  };

  // 获取当前tab对应的门店
  const getStoresByTab = () => {
    switch(activeTab) {
      case 'service': return serviceStores;
      case 'non-service': return nonServiceStores;
      default: return stores;
    }
  };

  // 获取分配详情数据
  const getAllocationDetails = (storeName) => {
    if (!results.allocations || !results.allocations[storeName]) return [];
    return results.allocations[storeName];
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'var(--cream)'
      }}>
        <div style={{ color: 'var(--ink-light)', fontSize: '1rem' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: '56px',
        background: 'var(--cream)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem'
      }}>
        <h1 style={{ 
          fontFamily: "'Noto Serif SC', serif", 
          fontSize: '1.1rem',
          fontWeight: 700
        }}>
          📊 管理员后台
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{
            background: 'var(--blue)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '0.85rem',
            cursor: 'pointer',
            fontWeight: 600
          }}>
            {importing ? '导入中...' : '📥 导入门店'}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportStores}
              style={{ display: 'none' }}
            />
          </label>
          <label style={{
            background: '#2d6a4f',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '0.85rem',
            cursor: 'pointer',
            fontWeight: 600
          }}>
            {importing ? '导入中...' : '📥 导入学员'}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportStudents}
              style={{ display: 'none' }}
            />
          </label>
          <button
            onClick={fetchData}
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            🔄 刷新
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            {exporting ? '导出中...' : '📥 导出Excel'}
          </button>
        </div>
      </header>

      {/* Tab栏 */}
      <div className="tab-bar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
        >
          总览
        </button>
        <button
          onClick={() => setActiveTab('service')}
          className={`tab ${activeTab === 'service' ? 'active' : ''}`}
        >
          服务类门店
        </button>
        <button
          onClick={() => setActiveTab('non-service')}
          className={`tab ${activeTab === 'non-service' ? 'active' : ''}`}
        >
          非服务类门店
        </button>
        <button
          onClick={() => setActiveTab('details')}
          className={`tab ${activeTab === 'details' ? 'active' : ''}`}
        >
          分配详情
        </button>
      </div>

      {/* 内容区 */}
      <main style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '2rem 1.5rem' 
      }}>
        {/* 统计卡片 */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: activeTab === 'overview' ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {activeTab === 'overview' ? (
            <>
              <div className="card" style={{ textAlign: 'center' }}>
                <div className="stat-number" style={{ color: 'var(--blue)' }}>{stats.totalStores}</div>
                <div className="stat-label">总门店数</div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div className="stat-number" style={{ color: '#2d6a4f' }}>{stats.serviceCapacity + stats.nonServiceCapacity}</div>
                <div className="stat-label">总容量</div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div className="stat-number" style={{ color: 'var(--yellow)' }}>{stats.totalAllocated}</div>
                <div className="stat-label">已分配</div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div className="stat-number" style={{ color: 'var(--red)' }}>
                  {stats.serviceCapacity + stats.nonServiceCapacity - stats.totalAllocated}
                </div>
                <div className="stat-label">剩余名额</div>
              </div>
            </>
          ) : activeTab === 'service' ? (
            <>
              <div className="card" style={{ textAlign: 'center' }}>
                <div className="stat-number" style={{ color: 'var(--blue)' }}>{stats.serviceStores}</div>
                <div className="stat-label">服务类门店</div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div className="stat-number" style={{ color: '#2d6a4f' }}>{stats.serviceCapacity}</div>
                <div className="stat-label">总容量</div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div className="stat-number" style={{ color: 'var(--red)' }}>{stats.serviceCapacity - stats.serviceEnrolled}</div>
                <div className="stat-label">剩余名额</div>
              </div>
            </>
          ) : (
            <>
              <div className="card" style={{ textAlign: 'center' }}>
                <div className="stat-number" style={{ color: 'var(--blue)' }}>{stats.nonServiceStores}</div>
                <div className="stat-label">非服务类门店</div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div className="stat-number" style={{ color: '#2d6a4f' }}>{stats.nonServiceCapacity}</div>
                <div className="stat-label">总容量</div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div className="stat-number" style={{ color: 'var(--red)' }}>{stats.nonServiceCapacity - stats.nonServiceEnrolled}</div>
                <div className="stat-label">剩余名额</div>
              </div>
            </>
          )}
        </div>

        {/* 门店列表 */}
        {activeTab !== 'details' && (
          <div className="card fade-in">
            <h2 style={{ 
              fontFamily: "'Noto Serif SC', serif",
              fontSize: '1.1rem',
              fontWeight: 700,
              marginBottom: '20px'
            }}>
              {activeTab === 'overview' ? '所有门店' : activeTab === 'service' ? '服务类门店' : '非服务类门店'}
              <span style={{ 
                fontSize: '0.85rem', 
                color: 'var(--ink-faint)',
                fontWeight: 400,
                marginLeft: '8px'
              }}>
                共{getStoresByTab().length}家
              </span>
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="app-table">
                <thead>
                  <tr>
                    <th>门店名称</th>
                    {activeTab === 'overview' && <th style={{ textAlign: 'center' }}>类型</th>}
                    <th style={{ textAlign: 'center' }}>容量</th>
                    <th style={{ textAlign: 'center' }}>已分配</th>
                    <th style={{ textAlign: 'center' }}>剩余</th>
                    <th style={{ textAlign: 'center' }}>状态</th>
                    <th style={{ textAlign: 'center' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {getStoresByTab().map((store) => (
                    <tr key={store.name}>
                      <td>{store.name}</td>
                      {activeTab === 'overview' && (
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${store.type === '服务' ? 'badge-service' : 'badge-non-service'}`}>
                            {store.type}
                          </span>
                        </td>
                      )}
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>
                        {editingStore?.name === store.name ? (
                          <input
                            type="number"
                            value={newCapacity}
                            onChange={(e) => setNewCapacity(e.target.value)}
                            className="app-input"
                            style={{ width: '60px', textAlign: 'center', padding: '4px 8px' }}
                            min="1"
                          />
                        ) : (
                          store.capacity
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => setShowAllocationDetail(store.name)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--blue)',
                            cursor: store.enrolled > 0 ? 'pointer' : 'default',
                            fontWeight: 600,
                            textDecoration: store.enrolled > 0 ? 'underline' : 'none'
                          }}
                        >
                          {store.enrolled}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ 
                          fontWeight: 700,
                          color: store.remaining > 0 ? '#2d6a4f' : 'var(--red)'
                        }}>
                          {store.remaining}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${store.available ? 'badge-available' : 'badge-full'}`}>
                          {store.available ? '可选' : '已满'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {editingStore?.name === store.name ? (
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              onClick={handleSaveCapacity}
                              style={{
                                background: 'var(--blue)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingStore(null)}
                              style={{
                                background: 'var(--border)',
                                color: 'var(--ink-light)',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditCapacity(store)}
                            style={{
                              background: 'none',
                              color: 'var(--blue)',
                              border: '1px solid var(--blue)',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            编辑
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 分配详情 */}
        {activeTab === 'details' && (
          <div className="card fade-in">
            <h2 style={{ 
              fontFamily: "'Noto Serif SC', serif",
              fontSize: '1.1rem',
              fontWeight: 700,
              marginBottom: '20px'
            }}>
              分配详情
              <span style={{ 
                fontSize: '0.85rem', 
                color: 'var(--ink-faint)',
                fontWeight: 400,
                marginLeft: '8px'
              }}>
                共{stats.totalAllocated}人已分配
              </span>
            </h2>
            {!results.allocations || Object.keys(results.allocations).length === 0 ? (
              <p style={{ 
                color: 'var(--ink-faint)', 
                textAlign: 'center', 
                padding: '40px 0',
                fontSize: '0.9rem'
              }}>
                暂无分配数据
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>门店名称</th>
                      <th style={{ textAlign: 'center' }}>已分配人数</th>
                      <th>学员名单</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(results.allocations).map(([storeName, students]) => (
                      <tr key={storeName}>
                        <td>{storeName}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{students.length}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {students.map((student, index) => (
                              <span
                                key={index}
                                style={{
                                  padding: '4px 10px',
                                  background: 'var(--cream)',
                                  borderRadius: '6px',
                                  fontSize: '0.85rem',
                                  border: '1px solid var(--border)'
                                }}
                              >
                                {student.studentName}
                                <span style={{ 
                                  color: 'var(--ink-faint)',
                                  marginLeft: '4px',
                                  fontSize: '0.75rem'
                                }}>
                                  第{student.choice}志愿
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 编辑容量弹窗 */}
      {editingStore && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(0,0,0,.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--cream)',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ 
              fontFamily: "'Noto Serif SC', serif",
              fontSize: '1.1rem',
              fontWeight: 700,
              marginBottom: '16px'
            }}>
              编辑门店容量
            </h3>
            <p style={{ 
              fontSize: '0.9rem', 
              color: 'var(--ink-light)',
              marginBottom: '16px'
            }}>
              {editingStore.name}
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '0.85rem', 
                fontWeight: 600, 
                marginBottom: '8px' 
              }}>
                容量（人数）
              </label>
              <input
                type="number"
                value={newCapacity}
                onChange={(e) => setNewCapacity(e.target.value)}
                className="app-input"
                min="1"
                style={{ width: '100%' }}
              />
              <p style={{ 
                fontSize: '0.8rem', 
                color: 'var(--ink-faint)',
                marginTop: '8px'
              }}>
                当前已分配：{editingStore.enrolled}人
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingStore(null)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleSaveCapacity}
                className="btn-primary"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 分配详情弹窗 */}
      {showAllocationDetail && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(0,0,0,.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--cream)',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{ 
              fontFamily: "'Noto Serif SC', serif",
              fontSize: '1.1rem',
              fontWeight: 700,
              marginBottom: '16px'
            }}>
              📋 分配详情
            </h3>
            <p style={{ 
              fontSize: '0.95rem', 
              fontWeight: 600,
              marginBottom: '16px'
            }}>
              {showAllocationDetail}
            </p>
            
            {getAllocationDetails(showAllocationDetail).length === 0 ? (
              <p style={{ color: 'var(--ink-faint)', textAlign: 'center', padding: '20px 0' }}>
                暂无分配数据
              </p>
            ) : (
              <div style={{ 
                background: 'rgba(43,127,216,0.06)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                {getAllocationDetails(showAllocationDetail).map((student, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: index < getAllocationDetails(showAllocationDetail).length - 1 ? '1px solid var(--border)' : 'none'
                  }}>
                    <span style={{ fontWeight: 600 }}>{student.studentName}</span>
                    <span style={{ color: 'var(--ink-light)', fontSize: '0.85rem' }}>
                      第{student.choice}志愿
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowAllocationDetail(null)}
              className="btn-secondary"
              style={{ width: '100%' }}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
