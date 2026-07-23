import { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [step, setStep] = useState(0); // 0: 首页, 1: 登录, 2: 选择, 3: 结果, 4: 已分配查看
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [student, setStudent] = useState(null);
  const [stores, setStores] = useState([]);
  const [choices, setChoices] = useState([null, null, null]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [config, setConfig] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [storeTypeFilter, setStoreTypeFilter] = useState('all');
  const [draftSaved, setDraftSaved] = useState(false);

  // 获取配置
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await axios.get('/api/config');
      if (response.data.success) {
        setConfig(response.data.data);
      }
    } catch (err) {
      console.error('获取配置失败:', err);
    }
  };

  // 获取门店列表
  useEffect(() => {
    if (step === 2 && student) {
      fetchStores();
      const interval = setInterval(fetchStores, 10000);
      return () => clearInterval(interval);
    }
  }, [step, student]);

  const fetchStores = async () => {
    try {
      const response = await axios.get('/api/stores');
      if (response.data.success) {
        setStores(response.data.data);
      }
    } catch (err) {
      console.error('获取门店失败:', err);
    }
  };

  // 验证学员身份
  const handleVerify = async () => {
    if (!studentId || !name) {
      setError('请输入工号和姓名');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/verify', { studentId, name });
      if (response.data.success) {
        const { data } = response.data;
        setStudent(data);
        // 如果有草稿，恢复志愿
        if (data.draft && data.draft.choices) {
          const draftChoices = [...data.draft.choices];
          while (draftChoices.length < 3) draftChoices.push(null);
          setChoices(draftChoices);
        }
        setStep(2);
      } else if (response.data.alreadyAllocated) {
        setStudent({ id: studentId, name: name, type: response.data.type || '非服务' });
        setResult({
          success: true,
          data: {
            store: response.data.store,
            choice: response.data.choice || 0
          },
          message: response.data.message
        });
        setStep(4);
        fetchStoresForView();
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      setError('验证失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取门店数据（用于查看页面）
  const fetchStoresForView = async () => {
    try {
      const response = await axios.get('/api/stores');
      if (response.data.success) {
        setStores(response.data.data);
      }
    } catch (err) {
      console.error('获取门店失败:', err);
    }
  };

  // 选择门店
  const handleSelectStore = (storeName) => {
    if (choices.includes(storeName)) {
      const newChoices = choices.map(c => c === storeName ? null : c);
      setChoices(newChoices);
      return;
    }

    const emptyIndex = choices.findIndex(c => c === null);
    if (emptyIndex === -1) {
      setError('已选择3个志愿，如需更换请先取消已选志愿');
      return;
    }

    const newChoices = [...choices];
    newChoices[emptyIndex] = storeName;
    setChoices(newChoices);
    setError('');
    setDraftSaved(false);
  };

  // 移除志愿
  const handleRemoveChoice = (index) => {
    const newChoices = [...choices];
    newChoices[index] = null;
    setChoices(newChoices);
    setDraftSaved(false);
  };

  // 暂存志愿
  const handleSaveDraft = async () => {
    const validChoices = choices.filter(c => c !== null);
    if (validChoices.length === 0) {
      setError('请至少选择1个志愿');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/draft', {
        studentId: student.id,
        name: student.name,
        choices: validChoices
      });

      if (response.data.success) {
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 3000);
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      setError('保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 提交志愿
  const handleSubmit = async () => {
    const validChoices = choices.filter(c => c !== null);
    if (validChoices.length === 0) {
      setError('请至少选择1个志愿');
      return;
    }

    if (!window.confirm('确定要提交志愿吗？提交后将无法修改！')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/allocate', {
        studentId: student.id,
        name: student.name,
        choices: validChoices
      });

      if (response.data.success) {
        setResult(response.data);
        setStep(3);
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      setError('提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 返回登录
  const handleBackToLogin = () => {
    setStep(1);
    setStudent(null);
    setStudentId('');
    setName('');
    setChoices([null, null, null]);
    setError('');
    setResult(null);
    setDraftSaved(false);
  };

  // 过滤门店
  const filteredStores = stores.filter(store => {
    const matchesSearch = store.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = storeTypeFilter === 'all' || storeTypeFilter === store.type;
    return matchesSearch && matchesType;
  });

  // 格式化时间
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', { 
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // 渲染首页
  const renderHome = () => (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <header style={{
        height: '56px',
        background: 'var(--cream)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 1.5rem'
      }}>
        <h1 style={{ 
          fontFamily: "'Noto Serif SC', serif", 
          fontSize: '1.1rem',
          fontWeight: 700
        }}>
          🏪 门店实训志愿分配系统
        </h1>
      </header>

      <main style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        padding: '2rem 1.5rem' 
      }}>
        <div className="card fade-in" style={{ marginBottom: '24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📋</div>
            <h2 style={{ 
              fontFamily: "'Noto Serif SC', serif",
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '8px'
            }}>
              2026年中国区校招生门店实训志愿填报
            </h2>
            <p style={{ color: 'var(--ink-light)', fontSize: '0.9rem' }}>
              请仔细阅读以下说明，选择你的门店志愿
            </p>
          </div>

          <div style={{ 
            background: 'rgba(43,127,216,0.06)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>
              ⏰ 填报时间
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--ink-light)', marginBottom: '8px' }}>
              开始时间：2026年7月27日 09:00
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--ink-light)' }}>
              截止时间：2026年7月29日 19:00
            </p>
            {config && !config.isWithinTime && (
              <p style={{ 
                fontSize: '0.85rem', 
                color: 'var(--red)',
                marginTop: '12px',
                fontWeight: 600
              }}>
                ⚠️ 当前不在填报时间内，门店暂不可选
              </p>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>
              📝 填报规则
            </h3>
            <ul style={{ 
              fontSize: '0.9rem', 
              color: 'var(--ink-light)',
              paddingLeft: '20px',
              lineHeight: 1.8
            }}>
              <li>每人可选择 <strong>3个志愿</strong>，按优先级排序</li>
              <li>系统按志愿顺序分配，第一个有名额的志愿生效</li>
              <li>服务类学员只能选择服务类门店</li>
              <li>非服务类学员只能选择非服务类门店</li>
              <li>提交后 <strong>不可修改</strong>，请谨慎选择</li>
              <li>可先暂存志愿，确认后再提交</li>
            </ul>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>
              🏪 门店概况
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ 
                background: 'rgba(43,127,216,0.06)',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--blue)' }}>9</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--ink-light)' }}>服务类门店</div>
              </div>
              <div style={{ 
                background: 'rgba(232,74,95,0.06)',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--red)' }}>42</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--ink-light)' }}>非服务类门店</div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep(1)}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
          >
            开始填报
          </button>
        </div>
      </main>
    </div>
  );

  // 渲染登录页面
  const renderLogin = () => (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <header style={{
        height: '56px',
        background: 'var(--cream)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem'
      }}>
        <button
          onClick={() => setStep(0)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--blue)',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          ← 返回首页
        </button>
        <h1 style={{ 
          fontFamily: "'Noto Serif SC', serif", 
          fontSize: '1.1rem',
          fontWeight: 700
        }}>
          身份验证
        </h1>
        <div style={{ width: '60px' }}></div>
      </header>

      <div style={{ 
        maxWidth: '400px', 
        margin: '0 auto', 
        padding: '2rem 1.5rem' 
      }}>
        <div className="card fade-in">
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👤</div>
            <h2 style={{ 
              fontFamily: "'Noto Serif SC', serif",
              fontSize: '1.3rem',
              fontWeight: 700,
              marginBottom: '8px'
            }}>
              请输入你的信息
            </h2>
            <p style={{ color: 'var(--ink-light)', fontSize: '0.85rem' }}>
              工号和姓名用于验证身份
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '0.85rem', 
                fontWeight: 600, 
                color: 'var(--ink)',
                marginBottom: '8px' 
              }}>
                工号
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="app-input"
                placeholder="请输入工号"
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '0.85rem', 
                fontWeight: 600, 
                color: 'var(--ink)',
                marginBottom: '8px' 
              }}>
                姓名
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="app-input"
                placeholder="请输入姓名"
              />
            </div>

            {error && (
              <div style={{ 
                color: 'var(--red)', 
                fontSize: '0.85rem', 
                textAlign: 'center',
                background: 'rgba(232,74,95,0.08)',
                padding: '12px',
                borderRadius: '8px'
              }}>
                {error}
              </div>
            )}

            <button
              onClick={handleVerify}
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', marginTop: '8px' }}
            >
              {loading ? '验证中...' : '验证身份'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // 渲染选择页面
  const renderSelection = () => {
    const isWithinTime = config && config.isWithinTime;
    const relevantStores = filteredStores.filter(s => s.type === student.type);
    
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
            🏪 选择门店志愿
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className={`badge ${student.type === '服务' ? 'badge-service' : 'badge-non-service'}`}>
              {student.type}类
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--ink-light)' }}>
              {student.name}
            </span>
            <button
              onClick={handleBackToLogin}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                color: 'var(--ink-light)',
                cursor: 'pointer'
              }}
            >
              切换账号
            </button>
          </div>
        </header>

        {/* 时间提示 */}
        {config && !isWithinTime && (
          <div style={{ 
            background: 'var(--yellow)', 
            padding: '12px 1.5rem',
            textAlign: 'center',
            fontSize: '0.9rem',
            fontWeight: 600
          }}>
            ⏰ 当前不在填报时间内（{formatTime(config.startTime)} - {formatTime(config.endTime)}），可暂存志愿，正式提交需在规定时间内
          </div>
        )}

        {/* 内容区 */}
        <main style={{ 
          maxWidth: '1000px', 
          margin: '0 auto', 
          padding: '2rem 1.5rem' 
        }}>
          {/* 已选志愿 */}
          <div className="card fade-in" style={{ marginBottom: '24px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <h2 style={{ 
                fontFamily: "'Noto Serif SC', serif",
                fontSize: '1.1rem',
                fontWeight: 700
              }}>
                📋 我的志愿
              </h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                {draftSaved && (
                  <span style={{ 
                    fontSize: '0.8rem', 
                    color: '#2d6a4f',
                    background: 'rgba(45,106,79,0.1)',
                    padding: '4px 12px',
                    borderRadius: '6px'
                  }}>
                    ✓ 已暂存
                  </span>
                )}
              </div>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              marginBottom: '16px'
            }}>
              {choices.map((choice, index) => (
                <div
                  key={index}
                  className={`choice-card ${choice ? 'selected' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className={`choice-number choice-${index + 1}`}>
                        {index + 1}
                      </div>
                      <div>
                        <div style={{ 
                          fontSize: '0.85rem', 
                          fontWeight: 600,
                          color: choice ? 'var(--ink)' : 'var(--ink-faint)',
                          maxWidth: '180px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {choice || '未选择'}
                        </div>
                      </div>
                    </div>
                    {choice && (
                      <button
                        onClick={() => handleRemoveChoice(index)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--ink-faint)',
                          cursor: 'pointer',
                          fontSize: '1.2rem',
                          padding: '4px'
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleSaveDraft}
                disabled={loading || choices.every(c => c === null)}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                {loading ? '保存中...' : '暂存志愿'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || choices.every(c => c === null) || !isWithinTime}
                className="btn-primary"
                style={{ flex: 1 }}
              >
                {loading ? '提交中...' : '确认提交'}
              </button>
            </div>
          </div>

          {/* 门店列表 */}
          <div className="card fade-in">
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <h2 style={{ 
                fontFamily: "'Noto Serif SC', serif",
                fontSize: '1.1rem',
                fontWeight: 700
              }}>
                🏪 可选门店（共{relevantStores.length}家）
              </h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="app-input"
                  placeholder="🔍 搜索门店..."
                  style={{ width: '200px' }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="app-table">
                <thead>
                  <tr>
                    <th>门店名称</th>
                    <th style={{ textAlign: 'center' }}>容量</th>
                    <th style={{ textAlign: 'center' }}>已选</th>
                    <th style={{ textAlign: 'center' }}>剩余</th>
                    <th style={{ textAlign: 'center' }}>状态</th>
                    <th style={{ textAlign: 'center' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {relevantStores.map((store) => {
                    const isFull = !store.available;
                    const isSelected = choices.includes(store.name);
                    
                    return (
                      <tr 
                        key={store.name}
                        style={{ 
                          opacity: isFull ? 0.5 : 1,
                          background: isSelected ? 'rgba(43,127,216,0.06)' : undefined
                        }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ 
                              fontSize: '0.9rem',
                              color: isDisabled ? 'var(--ink-faint)' : 'var(--ink)'
                            }}>
                              {store.name}
                            </span>
                            <button
                              onClick={() => setSelectedStore(store)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--blue)',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                padding: '2px 6px'
                              }}
                            >
                              📍
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>{store.capacity}</td>
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
                          <span className={`badge ${isFull ? 'badge-full' : 'badge-available'}`}>
                            {isFull ? '已满' : '可选'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => !isFull && handleSelectStore(store.name)}
                            disabled={isFull}
                            style={{
                              background: isSelected ? 'var(--blue)' : isFull ? 'var(--border)' : 'transparent',
                              color: isSelected ? 'white' : isFull ? 'var(--ink-faint)' : 'var(--blue)',
                              border: isSelected ? 'none' : `1px solid ${isFull ? 'var(--border)' : 'var(--blue)'}`,
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '0.8rem',
                              cursor: isFull ? 'not-allowed' : 'pointer',
                              fontWeight: 600
                            }}
                          >
                            {isSelected ? '已选' : isFull ? '已满' : '选择'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* 门店详情弹窗 */}
        {selectedStore && (
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
                📍 门店详情
              </h3>
              <p style={{ 
                fontSize: '1rem', 
                fontWeight: 600,
                marginBottom: '16px'
              }}>
                {selectedStore.name}
              </p>
              
              <div style={{ 
                background: 'rgba(43,127,216,0.06)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--ink-light)' }}>📍 地址：</span>
                  <span style={{ fontSize: '0.9rem' }}>{selectedStore.address || '暂无'}</span>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--ink-light)' }}>🚗 距小米科技园：</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{selectedStore.distance || '暂无'} 公里</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--ink-light)' }}>👥 容纳人数：</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{selectedStore.capacity} 人</span>
                </div>
              </div>

              {selectedStore.address && (
                <a
                  href={`https://uri.amap.com/marker?position=&name=${encodeURIComponent(selectedStore.name)}&address=${encodeURIComponent(selectedStore.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  style={{ 
                    display: 'block',
                    textAlign: 'center',
                    textDecoration: 'none',
                    marginBottom: '12px'
                  }}
                >
                  🗺️ 打开高德地图导航
                </a>
              )}

              <button
                onClick={() => setSelectedStore(null)}
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
  };

  // 渲染结果页面
  const renderResult = () => (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div style={{ 
        maxWidth: '500px', 
        margin: '0 auto', 
        padding: '2rem 1.5rem',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center'
      }}>
        <div className="card fade-in" style={{ width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '24px' }}>🎉</div>
          <h1 style={{ 
            fontFamily: "'Noto Serif SC', serif",
            fontSize: '1.8rem',
            fontWeight: 700,
            marginBottom: '16px'
          }}>
            提交成功！
          </h1>
          <div style={{ 
            background: 'var(--blue)',
            color: 'white',
            padding: '24px',
            borderRadius: '12px',
            marginBottom: '24px'
          }}>
            <p style={{ fontSize: '1rem', marginBottom: '8px', opacity: 0.9 }}>你被分配到</p>
            <p style={{ 
              fontFamily: "'Noto Serif SC', serif",
              fontSize: '1.3rem',
              fontWeight: 700
            }}>
              {result.data.store}
            </p>
            <p style={{ fontSize: '0.9rem', marginTop: '8px', opacity: 0.8 }}>
              （第{result.data.choice}志愿）
            </p>
          </div>
          <p style={{ color: 'var(--ink-light)', marginBottom: '24px', fontSize: '0.9rem' }}>
            {result.message}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={handleBackToLogin}
              className="btn-secondary"
            >
              返回登录
            </button>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // 渲染已分配学员查看页面
  const renderAllocatedView = () => {
    const relevantStores = stores.filter(s => s.type === student.type);
    
    return (
      <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
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
            📋 我的分配结果
          </h1>
          <button
            onClick={handleBackToLogin}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.8rem',
              color: 'var(--ink-light)',
              cursor: 'pointer'
            }}
          >
            切换账号
          </button>
        </header>

        <main style={{ 
          maxWidth: '1000px', 
          margin: '0 auto', 
          padding: '2rem 1.5rem' 
        }}>
          <div className="card fade-in" style={{ marginBottom: '24px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ 
                width: '56px', 
                height: '56px', 
                borderRadius: '50%', 
                background: 'var(--blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem'
              }}>
                🎯
              </div>
              <div>
                <h2 style={{ 
                  fontFamily: "'Noto Serif SC', serif",
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  marginBottom: '4px'
                }}>
                  {student.name}，你好！
                </h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--ink-light)' }}>
                  你的门店实训分配结果如下
                </p>
              </div>
            </div>

            <div style={{ 
              background: 'rgba(43,127,216,0.06)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--ink-light)' }}>分配门店</span>
                <span style={{ 
                  fontFamily: "'Noto Serif SC', serif",
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: 'var(--blue)'
                }}>
                  {result.data.store}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--ink-light)' }}>志愿顺序</span>
                <span className="badge badge-service">
                  {result.data.choice === 0 ? '管理员分配' : `第${result.data.choice}志愿`}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--ink-light)' }}>学员类型</span>
                <span className={`badge ${student.type === '服务' ? 'badge-service' : 'badge-non-service'}`}>
                  {student.type}类
                </span>
              </div>
            </div>
          </div>

          <div className="card fade-in">
            <h2 style={{ 
              fontFamily: "'Noto Serif SC', serif",
              fontSize: '1.1rem',
              fontWeight: 700,
              marginBottom: '20px'
            }}>
              🏪 {student.type}类门店录取情况（共{relevantStores.length}家）
            </h2>

            <div style={{ overflowX: 'auto' }}>
              <table className="app-table">
                <thead>
                  <tr>
                    <th>门店名称</th>
                    <th style={{ textAlign: 'center' }}>容量</th>
                    <th style={{ textAlign: 'center' }}>已录取</th>
                    <th style={{ textAlign: 'center' }}>剩余</th>
                    <th style={{ textAlign: 'center' }}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {relevantStores.map((store) => {
                    const isMyStore = store.name === result.data.store;
                    
                    return (
                      <tr 
                        key={store.name}
                        style={{ 
                          background: isMyStore ? 'rgba(43,127,216,0.06)' : undefined
                        }}
                      >
                        <td>
                          {store.name}
                          {isMyStore && (
                            <span style={{ 
                              display: 'inline-block',
                              marginLeft: '8px',
                              fontSize: '0.7rem',
                              background: 'var(--blue)',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              verticalAlign: 'middle'
                            }}>
                              我的门店
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{store.capacity}</td>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    );
  };

  return (
    <div>
      {step === 0 && renderHome()}
      {step === 1 && renderLogin()}
      {step === 2 && renderSelection()}
      {step === 3 && renderResult()}
      {step === 4 && renderAllocatedView()}
    </div>
  );
}

export default App;
