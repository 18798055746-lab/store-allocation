import { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [step, setStep] = useState(0);
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
  const [draftSaved, setDraftSaved] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await axios.get('/api/config');
      if (res.data.success) setConfig(res.data.data);
    } catch (e) { console.error(e); }
  };

  const fetchStores = async () => {
    try {
      const res = await axios.get('/api/stores');
      if (res.data.success) setStores(res.data.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchConfig(); }, []);

  useEffect(() => {
    if (step === 2 || step === 4) {
      fetchStores();
      const t = setInterval(fetchStores, 10000);
      return () => clearInterval(t);
    }
  }, [step]);

  const isWithinTime = config ? config.isWithinTime : true;

  const handleVerify = async () => {
    if (!studentId || !name) { setError('请输入工号和姓名'); return; }
    setLoading(true); setError('');
    try {
      const res = await axios.post('/api/verify', { studentId, name });
      if (res.data.success) {
        setStudent(res.data.data);
        if (res.data.data.draft && res.data.data.draft.choices) {
          const dc = [...res.data.data.draft.choices];
          while (dc.length < 3) dc.push(null);
          setChoices(dc);
        }
        setStep(2);
      } else if (res.data.alreadyAllocated) {
        setStudent({ id: studentId, name, type: res.data.type });
        setResult({ data: { store: res.data.store, choice: res.data.choice || 0 }, message: res.data.message });
        setStep(4);
      } else { setError(res.data.message); }
    } catch (e) { setError('验证失败'); }
    finally { setLoading(false); }
  };

  const handleSelectStore = (sn) => {
    if (choices.includes(sn)) { setChoices(choices.map(c => c === sn ? null : c)); return; }
    const i = choices.findIndex(c => c === null);
    if (i === -1) { setError('已选3个志愿'); return; }
    const nc = [...choices]; nc[i] = sn; setChoices(nc); setError(''); setDraftSaved(false);
  };

  const handleRemoveChoice = (i) => { const nc = [...choices]; nc[i] = null; setChoices(nc); setDraftSaved(false); };

  const handleSaveDraft = async () => {
    const vc = choices.filter(c => c !== null);
    if (!vc.length) { setError('请至少选1个'); return; }
    setLoading(true); setError('');
    try {
      const res = await axios.post('/api/draft', { studentId: student.id, name: student.name, choices: vc });
      if (res.data.success) { setDraftSaved(true); setTimeout(() => setDraftSaved(false), 3000); }
      else setError(res.data.message);
    } catch (e) { setError('保存失败'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    const vc = choices.filter(c => c !== null);
    if (!vc.length) { setError('请至少选1个'); return; }
    if (!window.confirm('确定提交？提交后不可修改！')) return;
    setLoading(true); setError('');
    try {
      const res = await axios.post('/api/allocate', { studentId: student.id, name: student.name, choices: vc });
      if (res.data.success) { setResult(res.data); setStep(3); }
      else setError(res.data.message);
    } catch (e) { setError('提交失败'); }
    finally { setLoading(false); }
  };

  const handleQueryResult = async () => {
    setLoading(true); setError('');
    try {
      const res = await axios.post('/api/verify', { studentId: student.id, name: student.name });
      if (res.data.alreadyAllocated) {
        setResult({ data: { store: res.data.store, choice: res.data.choice || 0 }, message: res.data.message });
        setStep(4);
      } else { setError('暂无分配结果'); }
    } catch (e) { setError('查询失败'); }
    finally { setLoading(false); }
  };

  const handleBack = () => {
    setStep(0); setStudent(null); setStudentId(''); setName('');
    setChoices([null, null, null]); setError(''); setResult(null); setDraftSaved(false);
  };

  const fmt = (d) => d ? new Date(d).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

  const getRelevantStores = () => {
    if (!student) return [];
    return stores.filter(s => s.type === student.type && s.name.includes(searchTerm));
  };

  // ===== 首页 =====
  if (step === 0) return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header style={{ height: 48, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 1rem' }}>
        <h1 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1rem', fontWeight: 700 }}>🏪 门店实训志愿分配</h1>
      </header>
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '1rem' }}>
        <div className="card fade-in">
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
            <h2 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.3rem', fontWeight: 700, marginBottom: 6 }}>门店实训志愿填报</h2>
            <p style={{ color: 'var(--ink-light)', fontSize: '0.85rem' }}>2026年中国区校招生</p>
          </div>
          <div style={{ background: 'rgba(43,127,216,0.06)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 10 }}>⏰ 填报时间</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-light)', marginBottom: 4 }}>7月27日 09:00 ~ 7月29日 19:00</p>
            {config && !config.isWithinTime && <p style={{ fontSize: '0.8rem', color: 'var(--red)', marginTop: 8, fontWeight: 600 }}>⚠️ 不在填报时间内，可暂存</p>}
          </div>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 10 }}>📝 规则</h3>
            <ul style={{ fontSize: '0.85rem', color: 'var(--ink-light)', paddingLeft: 18, lineHeight: 1.8 }}>
              <li>每人选 <strong>3个志愿</strong>，按优先级分配</li>
              <li>服务类选服务门店，非服务类选非服务门店</li>
              <li>提交后 <strong>不可修改</strong></li>
              <li>可先暂存再提交</li>
            </ul>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ background: 'rgba(43,127,216,0.06)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--blue)' }}>9</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--ink-light)' }}>服务类门店</div>
            </div>
            <div style={{ background: 'rgba(232,74,95,0.06)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--red)' }}>42</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--ink-light)' }}>非服务类门店</div>
            </div>
          </div>
          <div style={{ background: 'rgba(43,127,216,0.04)', borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 14, textAlign: 'center' }}>👤 工号和姓名登录</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>工号</label>
              <input type="text" value={studentId} onChange={e => setStudentId(e.target.value)} className="app-input" placeholder="请输入工号" style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>姓名</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="app-input" placeholder="请输入姓名" style={{ width: '100%' }} />
            </div>
            {error && <div style={{ color: 'var(--red)', fontSize: '0.8rem', textAlign: 'center', background: 'rgba(232,74,95,0.08)', padding: 10, borderRadius: 8, marginBottom: 10 }}>{error}</div>}
            <button onClick={handleVerify} disabled={loading} className="btn-primary" style={{ width: '100%', padding: 12, fontSize: '0.95rem' }}>{loading ? '验证中...' : '开始填报'}</button>
          </div>
        </div>
      </main>
    </div>
  );

  // ===== 选择页面 =====
  if (step === 2) {
    const rs = getRelevantStores();
    return (
      <div style={{ background: 'var(--cream)', minHeight: '100vh', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Sticky Header */}
        <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--cream)', borderBottom: '1px solid var(--border)', padding: '10px 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h1 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1rem', fontWeight: 700 }}>🏪 选择门店志愿</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`badge ${student.type === '服务' ? 'badge-service' : 'badge-non-service'}`} style={{ fontSize: '0.7rem' }}>{student.type}类</span>
              <button onClick={handleBack} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', fontSize: '0.75rem', color: 'var(--ink-light)', cursor: 'pointer' }}>退出</button>
            </div>
          </div>
          {/* 志愿状态条 */}
          <div style={{ display: 'flex', gap: 6 }}>
            {choices.map((c, i) => (
              <div key={i} style={{ flex: 1, background: c ? 'var(--blue)' : 'var(--border)', borderRadius: 6, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: c ? 'white' : 'var(--ink-faint)' }}>{i + 1}</span>
                <span style={{ fontSize: '0.7rem', color: c ? 'white' : 'var(--ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c || '未选'}</span>
                {c && <button onClick={() => handleRemoveChoice(i)} style={{ background: 'none', border: 'none', color: c ? 'rgba(255,255,255,0.7)' : 'var(--ink-faint)', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>×</button>}
              </div>
            ))}
          </div>
        </header>

        {/* 时间提示 */}
        {config && !isWithinTime && <div style={{ background: 'var(--yellow)', padding: '8px 1rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600 }}>⏰ 不在填报时间内，可暂存</div>}

        {/* 操作按钮 */}
        <div style={{ padding: '10px 1rem', display: 'flex', gap: 8 }}>
          {choices.some(c => c !== null) && (
            <button onClick={() => { setChoices([null, null, null]); setDraftSaved(false); }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '10px', fontSize: '0.8rem', color: 'var(--ink-light)', cursor: 'pointer', flexShrink: 0 }}>清空</button>
          )}
          <button onClick={handleSaveDraft} disabled={loading || choices.every(c => c === null)} className="btn-secondary" style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}>{loading ? '...' : '暂存'}</button>
          <button onClick={handleSubmit} disabled={loading || choices.every(c => c === null) || !isWithinTime} className="btn-primary" style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}>{loading ? '...' : '确认提交'}</button>
        </div>
        {draftSaved && <div style={{ padding: '0 1rem 6px', fontSize: '0.8rem', color: '#2d6a4f', textAlign: 'center' }}>✓ 已暂存</div>}
        {error && <div style={{ padding: '0 1rem 6px', fontSize: '0.8rem', color: 'var(--red)', textAlign: 'center' }}>{error}</div>}

        {/* 搜索 */}
        <div style={{ padding: '0 1rem 10px' }}>
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="app-input" placeholder="🔍 搜索门店..." style={{ width: '100%', fontSize: '0.85rem' }} />
        </div>

        {/* 门店卡片列表 */}
        <main style={{ padding: '0 1rem 2rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--ink-faint)', marginBottom: 8 }}>共 {rs.length} 家可选门店</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rs.map(s => {
              const sel = choices.includes(s.name);
              return (
                <div key={s.name} onClick={() => s.available && handleSelectStore(s.name)}
                  style={{
                    background: sel ? 'rgba(43,127,216,0.08)' : 'var(--card-bg)',
                    border: `2px solid ${sel ? 'var(--blue)' : 'var(--border)'}`,
                    borderRadius: 12, padding: 14,
                    opacity: s.available ? 1 : 0.5,
                    cursor: s.available ? 'pointer' : 'not-allowed'
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{s.name}</span>
                    <button onClick={e => { e.stopPropagation(); setSelectedStore(s); }} style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 4px', flexShrink: 0 }}>📍</button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 12, fontSize: '0.8rem', color: 'var(--ink-light)' }}>
                      <span>容量 {s.capacity}</span>
                      <span>已选 {s.enrolled}</span>
                      <span style={{ fontWeight: 700, color: s.remaining > 0 ? '#2d6a4f' : 'var(--red)' }}>剩余 {s.remaining}</span>
                    </div>
                    <span className={`badge ${sel ? 'badge-service' : s.available ? 'badge-available' : 'badge-full'}`} style={{ fontSize: '0.7rem' }}>
                      {sel ? '已选' : s.available ? '可选' : '已满'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* 门店详情弹窗 */}
        {selectedStore && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ background: 'var(--cream)', borderRadius: '16px 16px 0 0', padding: '1.5rem', width: '100%', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }}></div>
              <h3 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>📍 门店详情</h3>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 14 }}>{selectedStore.name}</p>
              <div style={{ background: 'rgba(43,127,216,0.06)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: '0.85rem' }}><span style={{ color: 'var(--ink-light)' }}>👥 容纳</span><span style={{ fontWeight: 600 }}>{selectedStore.capacity} 人</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: '0.85rem' }}><span style={{ color: 'var(--ink-light)' }}>📊 已选</span><span style={{ fontWeight: 600 }}>{selectedStore.enrolled} 人</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}><span style={{ color: 'var(--ink-light)' }}>✨ 剩余</span><span style={{ fontWeight: 600, color: selectedStore.remaining > 0 ? '#2d6a4f' : 'var(--red)' }}>{selectedStore.remaining} 人</span></div>
              </div>
              <a href={`https://uri.amap.com/search?keyword=${encodeURIComponent(selectedStore.name)}`} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 10, padding: 12 }}>🗺️ 高德地图导航</a>
              <button onClick={() => setSelectedStore(null)} className="btn-secondary" style={{ width: '100%', padding: 12 }}>关闭</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== 提交成功 =====
  if (step === 3) return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
      <div className="card fade-in" style={{ width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
        <h1 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.5rem', fontWeight: 700, marginBottom: 12 }}>提交成功！</h1>
        <p style={{ color: 'var(--ink-light)', marginBottom: 20, fontSize: '0.9rem' }}>志愿已提交，请等待分配结果。</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={handleQueryResult} disabled={loading} className="btn-primary" style={{ width: '100%', padding: 12 }}>{loading ? '查询中...' : '📋 查看分配结果'}</button>
          <button onClick={handleBack} className="btn-secondary" style={{ width: '100%', padding: 12 }}>返回首页</button>
        </div>
      </div>
    </div>
  );

  // ===== 已分配查看 =====
  if (step === 4) {
    const rs = stores.filter(s => s.type === student.type);
    return (
      <div style={{ background: 'var(--cream)', minHeight: '100vh', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 100, height: 48, background: 'var(--cream)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem' }}>
          <h1 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1rem', fontWeight: 700 }}>📋 分配结果</h1>
          <button onClick={handleBack} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', fontSize: '0.75rem', color: 'var(--ink-light)', cursor: 'pointer' }}>退出</button>
        </header>
        <main style={{ maxWidth: 600, margin: '0 auto', padding: '1rem' }}>
          <div className="card fade-in" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🎯</div>
              <div><h2 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.1rem', fontWeight: 700 }}>{student.name}</h2><p style={{ fontSize: '0.8rem', color: 'var(--ink-light)' }}>分配结果</p></div>
            </div>
            <div style={{ background: 'rgba(43,127,216,0.06)', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: '0.85rem' }}><span style={{ color: 'var(--ink-light)' }}>分配门店</span><span style={{ fontWeight: 700, color: 'var(--blue)' }}>{result.data.store}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}><span style={{ color: 'var(--ink-light)' }}>志愿</span><span className="badge badge-service" style={{ fontSize: '0.75rem' }}>{result.data.choice === 0 ? '管理员分配' : `第${result.data.choice}志愿`}</span></div>
            </div>
          </div>
          <div className="card fade-in">
            <h2 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>🏪 {student.type}类门店（{rs.length}家）</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rs.map(s => (
                <div key={s.name} style={{ padding: 12, borderRadius: 10, background: s.name === result.data.store ? 'rgba(43,127,216,0.08)' : 'var(--cream)', border: `1px solid ${s.name === result.data.store ? 'var(--blue)' : 'var(--border)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: s.name === result.data.store ? 600 : 400, flex: 1 }}>
                      {s.name}
                      {s.name === result.data.store && <span style={{ marginLeft: 6, fontSize: '0.65rem', background: 'var(--blue)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>我的</span>}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--ink-light)' }}>{s.enrolled}/{s.capacity}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return null;
}

export default App;
