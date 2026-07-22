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
        fetchData(); // 刷新数据
      } else {
        alert(response.data.message);
      }
    } catch (err) {
      alert('保存失败，请重试');
    }
  };

  // 计算统计数据
  const stats = {
    totalStores: stores.length,
    totalCapacity: stores.reduce((sum, s) => sum + s.capacity, 0),
    totalEnrolled: stores.reduce((sum, s) => sum + s.enrolled, 0),
    serviceStores: stores.filter(s => s.type === '服务').length,
    nonServiceStores: stores.filter(s => s.type === '非服务').length,
  };

  const serviceStores = stores.filter(s => s.type === '服务');
  const nonServiceStores = stores.filter(s => s.type === '非服务');

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
          门店概览
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="stat-number" style={{ color: 'var(--blue)' }}>{stats.totalStores}</div>
            <div className="stat-label">总门店数</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="stat-number" style={{ color: '#2d6a4f' }}>{stats.totalCapacity}</div>
            <div className="stat-label">总容量</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="stat-number" style={{ color: 'var(--yellow)' }}>{stats.totalEnrolled}</div>
            <div className="stat-label">已报名</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="stat-number" style={{ color: 'var(--red)' }}>
              {stats.totalCapacity - stats.totalEnrolled}
            </div>
            <div className="stat-label">剩余名额</div>
          </div>
        </div>

        {/* 门店概览 */}
        {activeTab === 'overview' && (
          <div className="card fade-in">
            <h2 style={{ 
              fontFamily: "'Noto Serif SC', serif",
              fontSize: '1.1rem',
              fontWeight: 700,
              marginBottom: '20px'
            }}>
              门店报名情况
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="app-table">
                <thead>
                  <tr>
                    <th>门店名称</th>
                    <th style={{ textAlign: 'center' }}>类型</th>
                    <th style={{ textAlign: 'center' }}>容量</th>
                    <th style={{ textAlign: 'center' }}>已报名</th>
                    <th style={{ textAlign: 'center' }}>剩余</th>
                    <th style={{ textAlign: 'center' }}>状态</th>
                    <th style={{ textAlign: 'center' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((store) => (
                    <tr key={store.name}>
                      <td>{store.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${store.type === '服务' ? 'badge-service' : 'badge-non-service'}`}>
                          {store.type}
                        </span>
                      </td>
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
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{store.enrolled}</td>
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

        {/* 服务类门店 */}
        {activeTab === 'service' && (
          <div className="card fade-in">
            <h2 style={{ 
              fontFamily: "'Noto Serif SC', serif",
              fontSize: '1.1rem',
              fontWeight: 700,
              marginBottom: '20px'
            }}>
              服务类门店（共{serviceStores.length}家）
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="app-table">
                <thead>
                  <tr>
                    <th>门店名称</th>
                    <th style={{ textAlign: 'center' }}>容量</th>
                    <th style={{ textAlign: 'center' }}>已报名</th>
                    <th style={{ textAlign: 'center' }}>剩余</th>
                    <th style={{ textAlign: 'center' }}>状态</th>
                    <th style={{ textAlign: 'center' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceStores.map((store) => (
                    <tr key={store.name}>
                      <td>{store.name}</td>
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
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{store.enrolled}</td>
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

        {/* 非服务类门店 */}
        {activeTab === 'non-service' && (
          <div className="card fade-in">
            <h2 style={{ 
              fontFamily: "'Noto Serif SC', serif",
              fontSize: '1.1rem',
              fontWeight: 700,
              marginBottom: '20px'
            }}>
              非服务类门店（共{nonServiceStores.length}家）
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="app-table">
                <thead>
                  <tr>
                    <th>门店名称</th>
                    <th style={{ textAlign: 'center' }}>容量</th>
                    <th style={{ textAlign: 'center' }}>已报名</th>
                    <th style={{ textAlign: 'center' }}>剩余</th>
                    <th style={{ textAlign: 'center' }}>状态</th>
                    <th style={{ textAlign: 'center' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {nonServiceStores.map((store) => (
                    <tr key={store.name}>
                      <td>{store.name}</td>
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
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{store.enrolled}</td>
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
    </div>
  );
}

export default Admin;
