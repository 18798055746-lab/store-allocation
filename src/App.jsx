import { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [step, setStep] = useState(1); // 1: 登录, 2: 选择, 3: 结果, 4: 已分配查看
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [student, setStudent] = useState(null);
  const [stores, setStores] = useState([]);
  const [choices, setChoices] = useState([null, null, null]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 获取门店列表
  useEffect(() => {
    if (step === 2 && student) {
      fetchStores();
      // 每10秒刷新一次门店数据
      const interval = setInterval(fetchStores, 10000);
      return () => clearInterval(interval);
    }
  }, [step, student]);

  const fetchStores = async () => {
    try {
      const response = await axios.get('/api/stores', {
        params: { type: student.type }
      });
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
        setStudent(response.data.data);
        setStep(2);
      } else if (response.data.alreadyAllocated) {
        // 已分配的学员，进入查看页面
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
        // 获取门店数据
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
    // 检查是否已选择
    if (choices.includes(storeName)) {
      setError('该门店已在志愿列表中');
      return;
    }

    // 找到第一个空位
    const emptyIndex = choices.findIndex(c => c === null);
    if (emptyIndex === -1) {
      setError('已选择3个志愿');
      return;
    }

    const newChoices = [...choices];
    newChoices[emptyIndex] = storeName;
    setChoices(newChoices);
    setError('');
  };

  // 移除志愿
  const handleRemoveChoice = (index) => {
    const newChoices = [...choices];
    newChoices[index] = null;
    setChoices(newChoices);
  };

  // 提交志愿
  const handleSubmit = async () => {
    const validChoices = choices.filter(c => c !== null);
    if (validChoices.length === 0) {
      setError('请至少选择1个志愿');
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

  // 过滤门店
  const filteredStores = stores.filter(store =>
    store.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 渲染登录页面
  const renderLogin = () => (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--cream)' }}>
      <div className="card max-w-md w-full fade-in">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🏪</div>
          <h1 style={{ 
            fontFamily: "'Noto Serif SC', serif", 
            fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
            fontWeight: 700,
            color: 'var(--ink)',
            marginBottom: '8px'
          }}>
            门店实训志愿分配
          </h1>
          <p style={{ color: 'var(--ink-light)', fontSize: '0.9rem' }}>
            2026年中国区校招生培训
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
            {loading ? '验证中...' : '开始选择'}
          </button>
        </div>
      </div>
    </div>
  );

  // 渲染选择页面
  const renderSelection = () => (
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
          🏪 门店志愿分配
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

      {/* 内容区 */}
      <main style={{ 
        maxWidth: '1000px', 
        margin: '0 auto', 
        padding: '2rem 1.5rem' 
      }}>
        {/* 已选志愿 */}
        <div className="card fade-in" style={{ marginBottom: '24px' }}>
          <h2 style={{ 
            fontFamily: "'Noto Serif SC', serif",
            fontSize: '1.1rem',
            fontWeight: 700,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📋 我的志愿
            <span style={{ 
              fontSize: '0.8rem', 
              color: 'var(--ink-faint)',
              fontWeight: 400 
            }}>
              （点击门店卡片选择，最多3个）
            </span>
          </h2>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px'
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
                        fontSize: '0.9rem', 
                        fontWeight: 600,
                        color: choice ? 'var(--ink)' : 'var(--ink-faint)'
                      }}>
                        {choice || '未选择'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ink-faint)' }}>
                        第{index + 1}志愿
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
              🏪 可选门店
            </h2>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="app-input"
              placeholder="🔍 搜索门店..."
              style={{ maxWidth: '240px' }}
            />
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '12px'
          }}>
            {filteredStores.map((store) => {
              const remaining = store.remaining;
              const progressPercent = (store.enrolled / store.capacity) * 100;
              const progressClass = remaining === 0 ? 'high' : remaining <= 1 ? 'medium' : 'low';
              
              return (
                <div
                  key={store.name}
                  onClick={() => store.available && handleSelectStore(store.name)}
                  className={`store-card ${choices.includes(store.name) ? 'selected' : ''} ${!store.available ? 'full' : ''}`}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    justifyContent: 'space-between',
                    marginBottom: '12px'
                  }}>
                    <h3 style={{ 
                      fontSize: '0.9rem', 
                      fontWeight: 600,
                      color: 'var(--ink)',
                      lineHeight: 1.4,
                      flex: 1
                    }}>
                      {store.name}
                    </h3>
                    <span className={`badge ${store.available ? 'badge-available' : 'badge-full'}`}>
                      {store.available ? '可选' : '已满'}
                    </span>
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '0.85rem',
                    color: 'var(--ink-light)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>👥 容纳</span>
                      <span style={{ fontWeight: 600 }}>{store.capacity}人</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>📊 已选</span>
                      <span style={{ fontWeight: 600 }}>{store.enrolled}人</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>✨ 剩余</span>
                      <span style={{ 
                        fontWeight: 700,
                        color: remaining > 0 ? '#2d6a4f' : 'var(--red)'
                      }}>
                        {remaining}人
                      </span>
                    </div>
                    <div className="progress-bar" style={{ marginTop: '4px' }}>
                      <div 
                        className={`progress-fill ${progressClass}`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {choices.includes(store.name) && (
                    <div style={{ 
                      marginTop: '12px',
                      textAlign: 'center'
                    }}>
                      <span className="badge badge-service">
                        已选为第{choices.indexOf(store.name) + 1}志愿
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 提交按钮 */}
        <div style={{ 
          marginTop: '24px', 
          textAlign: 'center',
          paddingBottom: '40px'
        }}>
          {error && (
            <div style={{ 
              color: 'var(--red)', 
              fontSize: '0.85rem', 
              marginBottom: '16px',
              background: 'rgba(232,74,95,0.08)',
              padding: '12px 20px',
              borderRadius: '8px',
              display: 'inline-block'
            }}>
              {error}
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading || choices.every(c => c === null)}
            className="btn-primary"
            style={{ 
              padding: '14px 48px',
              fontSize: '1rem'
            }}
          >
            {loading ? '提交中...' : '提交志愿'}
          </button>
        </div>
      </main>
    </div>
  );

  // 返回登录
  const handleBackToLogin = () => {
    setStep(1);
    setStudent(null);
    setStudentId('');
    setName('');
    setChoices([null, null, null]);
    setError('');
    setResult(null);
  };

  // 渲染结果页面
  const renderResult = () => (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--cream)' }}>
      <div className="card max-w-md w-full text-center fade-in">
        <div style={{ fontSize: '4rem', marginBottom: '24px' }}>🎉</div>
        <h1 style={{ 
          fontFamily: "'Noto Serif SC', serif",
          fontSize: '1.8rem',
          fontWeight: 700,
          marginBottom: '16px'
        }}>
          分配成功！
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
            fontSize: '1.4rem',
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
  );

  // 渲染已分配学员查看页面
  const renderAllocatedView = () => {
    // 过滤出学员类型的门店
    const relevantStores = stores.filter(s => s.type === student.type);
    
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

        {/* 内容区 */}
        <main style={{ 
          maxWidth: '1000px', 
          margin: '0 auto', 
          padding: '2rem 1.5rem' 
        }}>
          {/* 分配结果卡片 */}
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

          {/* 门店录取情况 */}
          <div className="card fade-in">
            <h2 style={{ 
              fontFamily: "'Noto Serif SC', serif",
              fontSize: '1.1rem',
              fontWeight: 700,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              🏪 {student.type}类门店录取情况
              <span style={{ 
                fontSize: '0.8rem', 
                color: 'var(--ink-faint)',
                fontWeight: 400 
              }}>
                （共{relevantStores.length}家）
              </span>
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
      {step === 1 && renderLogin()}
      {step === 2 && renderSelection()}
      {step === 3 && renderResult()}
      {step === 4 && renderAllocatedView()}
    </div>
  );
}

export default App;
