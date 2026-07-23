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
    setLoading(true);
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

  const handleBack = () => {
    setStep(1); setStudent(null); setStudentId(''); setName('');
    setChoices([null, null, null]); setError(''); setResult(null); setDraftSaved(false);
  };

  const fmt = (d) => d ? new Date(d).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

  const getRelevantStores = () => {
    if (!student) return [];
    return stores.filter(s => s.type === student.type && s.name.includes(searchTerm));
  };

  // ===== 首页 =====
  if (step === 0) return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <header style={{ height: 56, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h1 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.1rem', fontWeight: 700 }}>🏪 门店实训志愿分配系统</h1>
      </header>
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div className="card fade-in" style={{ marginBottom: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>📋</div>
            <h2 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>2026年中国区校招生门店实训志愿填报</h2>
            <p style={{ color: 'var(--ink-light)', fontSize: '0.9rem' }}>请仔细阅读以下说明，选择你的门店志愿</p>
          </div>
          <div style={{ background: 'rgba(43,127,216,0.06)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>⏰ 填报时间</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--ink-light)', marginBottom: 8 }}>开始：2026年7月27日 09:00</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--ink-light)' }}>截止：2026年7月29日 19:00</p>
            {config && !config.isWithinTime && <p style={{ fontSize: '0.85rem', color: 'var(--red)', marginTop: 12, fontWeight: 600 }}>⚠️ 当前不在填报时间内，可暂存志愿，正式提交需在规定时间内</p>}
          </div>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>📝 填报规则</h3>
            <ul style={{ fontSize: '0.9rem', color: 'var(--ink-light)', paddingLeft: 20, lineHeight: 1.8 }}>
              <li>每人可选 <strong>3个志愿</strong>，按优先级排序</li>
              <li>系统按志愿顺序分配，第一个有名额的生效</li>
              <li>服务类学员选服务类门店，非服务类选非服务类门店</li>
              <li>提交后 <strong>不可修改</strong>，请谨慎选择</li>
              <li>可先暂存，确认后再提交</li>
            </ul>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ background: 'rgba(43,127,216,0.06)', borderRadius: 8, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--blue)' }}>9</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--ink-light)' }}>服务类门店</div>
            </div>
            <div style={{ background: 'rgba(232,74,95,0.06)', borderRadius: 8, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--red)' }}>42</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--ink-light)' }}>非服务类门店</div>
            </div>
          </div>
          <button onClick={() => setStep(1)} className="btn-primary" style={{ width: '100%', padding: 14, fontSize: '1rem' }}>开始填报</button>
        </div>
      </main>
    </div>
  );

  // ===== 登录 =====
  if (step === 1) return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <header style={{ height: 56, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem' }}>
        <button onClick={() => setStep(0)} style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: '0.9rem' }}>← 返回</button>
        <h1 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.1rem', fontWeight: 700 }}>身份验证</h1>
        <div style={{ width: 60 }}></div>
      </header>
      <div style={{ maxWidth: 400, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div className="card fade-in">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>👤</div>
            <h2 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.3rem', fontWeight: 700 }}>请输入你的信息</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div><label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>工号</label><input type="text" value={studentId} onChange={e => setStudentId(e.target.value)} className="app-input" placeholder="请输入工号" /></div>
            <div><label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>姓名</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="app-input" placeholder="请输入姓名" /></div>
            {error && <div style={{ color: 'var(--red)', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(232,74,95,0.08)', padding: 12, borderRadius: 8 }}>{error}</div>}
            <button onClick={handleVerify} disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: 8 }}>{loading ? '验证中...' : '验证身份'}</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ===== 选择页面 =====
  if (step === 2) {
    const rs = getRelevantStores();
    return (
      <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 100, height: 56, background: 'var(--cream)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem' }}>
          <h1 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.1rem', fontWeight: 700 }}>🏪 选择门店志愿</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={`badge ${student.type === '服务' ? 'badge-service' : 'badge-non-service'}`}>{student.type}类</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--ink-light)' }}>{student.name}</span>
            <button onClick={handleBack} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', color: 'var(--ink-light)', cursor: 'pointer' }}>切换</button>
          </div>
        </header>
        {config && !isWithinTime && <div style={{ background: 'var(--yellow)', padding: '12px 1.5rem', textAlign: 'center', fontSize: '0.9rem', fontWeight: 600 }}>⏰ 不在填报时间内（{fmt(config.startTime)} ~ {fmt(config.endTime)}），可暂存，正式提交需在规定时间内</div>}
        <main style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1.5rem' }}>
          <div className="card fade-in" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.1rem', fontWeight: 700 }}>📋 我的志愿</h2>
              {draftSaved && <span style={{ fontSize: '0.8rem', color: '#2d6a4f', background: 'rgba(45,106,79,0.1)', padding: '4px 12px', borderRadius: 6 }}>✓ 已暂存</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              {choices.map((c, i) => (
                <div key={i} className={`choice-card ${c ? 'selected' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className={`choice-number choice-${i + 1}`}>{i + 1}</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: c ? 'var(--ink)' : 'var(--ink-faint)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c || '未选择'}</div>
                    </div>
                    {c && <button onClick={() => handleRemoveChoice(i)} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', fontSize: '1.2rem', padding: 4 }}>×</button>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={handleSaveDraft} disabled={loading || choices.every(c => c === null)} className="btn-secondary" style={{ flex: 1 }}>{loading ? '...' : '暂存志愿'}</button>
              <button onClick={handleSubmit} disabled={loading || choices.every(c => c === null) || !isWithinTime} className="btn-primary" style={{ flex: 1 }}>{loading ? '...' : '确认提交'}</button>
            </div>
          </div>
          <div className="card fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <h2 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.1rem', fontWeight: 700 }}>🏪 可选门店（{rs.length}家）</h2>
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="app-input" placeholder="🔍 搜索门店..." style={{ width: 200 }} />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="app-table">
                <thead><tr><th>门店名称</th><th style={{ textAlign: 'center' }}>容量</th><th style={{ textAlign: 'center' }}>已选</th><th style={{ textAlign: 'center' }}>剩余</th><th style={{ textAlign: 'center' }}>状态</th><th style={{ textAlign: 'center' }}>操作</th></tr></thead>
                <tbody>
                  {rs.map(s => {
                    const sel = choices.includes(s.name);
                    return (
                      <tr key={s.name} style={{ opacity: s.available ? 1 : 0.5, background: sel ? 'rgba(43,127,216,0.06)' : undefined }}>
                        <td><span style={{ fontSize: '0.9rem' }}>{s.name}</span> <button onClick={() => setSelectedStore(s)} style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: '0.75rem' }}>📍</button></td>
                        <td style={{ textAlign: 'center' }}>{s.capacity}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{s.enrolled}</td>
                        <td style={{ textAlign: 'center' }}><span style={{ fontWeight: 700, color: s.remaining > 0 ? '#2d6a4f' : 'var(--red)' }}>{s.remaining}</span></td>
                        <td style={{ textAlign: 'center' }}><span className={`badge ${s.available ? 'badge-available' : 'badge-full'}`}>{s.available ? '可选' : '已满'}</span></td>
                        <td style={{ textAlign: 'center' }}><button onClick={() => s.available && handleSelectStore(s.name)} disabled={!s.available} style={{ background: sel ? 'var(--blue)' : s.available ? 'transparent' : 'var(--border)', color: sel ? 'white' : s.available ? 'var(--blue)' : 'var(--ink-faint)', border: sel ? 'none' : `1px solid ${s.available ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', cursor: s.available ? 'pointer' : 'not-allowed', fontWeight: 600 }}>{sel ? '已选' : s.available ? '选择' : '已满'}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
        {selectedStore && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--cream)', borderRadius: 16, padding: '2rem', maxWidth: 500, width: '90%' }}>
              <h3 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>📍 门店详情</h3>
              <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>{selectedStore.name}</p>
              <div style={{ background: 'rgba(43,127,216,0.06)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ marginBottom: 12 }}><span style={{ fontSize: '0.85rem', color: 'var(--ink-light)' }}>📍 地址：</span><span style={{ fontSize: '0.9rem' }}>{selectedStore.address || '暂无'}</span></div>
                <div style={{ marginBottom: 12 }}><span style={{ fontSize: '0.85rem', color: 'var(--ink-light)' }}>🚗 距科技园：</span><span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{selectedStore.distance || '暂无'} 公里</span></div>
                <div><span style={{ fontSize: '0.85rem', color: 'var(--ink-light)' }}>👥 容纳：</span><span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{selectedStore.capacity} 人</span></div>
              </div>
              {selectedStore.address && <a href={`https://uri.amap.com/marker?name=${encodeURIComponent(selectedStore.name)}&address=${encodeURIComponent(selectedStore.address)}`} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 12 }}>🗺️ 高德地图导航</a>}
              <button onClick={() => setSelectedStore(null)} className="btn-secondary" style={{ width: '100%' }}>关闭</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== 提交成功 =====
  if (step === 3) return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="card fade-in" style={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: 24 }}>🎉</div>
        <h1 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.8rem', fontWeight: 700, marginBottom: 16 }}>提交成功！</h1>
        <div style={{ background: 'var(--blue)', color: 'white', padding: 24, borderRadius: 12, marginBottom: 24 }}>
          <p style={{ fontSize: '1rem', marginBottom: 8, opacity: 0.9 }}>你被分配到</p>
          <p style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.3rem', fontWeight: 700 }}>{result.data.store}</p>
          <p style={{ fontSize: '0.9rem', marginTop: 8, opacity: 0.8 }}>（第{result.data.choice}志愿）</p>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={handleBack} className="btn-secondary">返回</button>
          <button onClick={() => window.location.reload()} className="btn-primary">完成</button>
        </div>
      </div>
    </div>
  );

  // ===== 已分配查看 =====
  if (step === 4) {
    const rs = stores.filter(s => s.type === student.type);
    return (
      <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 100, height: 56, background: 'var(--cream)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem' }}>
          <h1 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.1rem', fontWeight: 700 }}>📋 我的分配结果</h1>
          <button onClick={handleBack} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', color: 'var(--ink-light)', cursor: 'pointer' }}>切换</button>
        </header>
        <main style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1.5rem' }}>
          <div className="card fade-in" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🎯</div>
              <div><h2 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>{student.name}</h2><p style={{ fontSize: '0.9rem', color: 'var(--ink-light)' }}>分配结果</p></div>
            </div>
            <div style={{ background: 'rgba(43,127,216,0.06)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--ink-light)' }}>分配门店</span><span style={{ fontWeight: 700, color: 'var(--blue)' }}>{result.data.store}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--ink-light)' }}>志愿</span><span className="badge badge-service">{result.data.choice === 0 ? '管理员分配' : `第${result.data.choice}志愿`}</span></div>
            </div>
          </div>
          <div className="card fade-in">
            <h2 style={{ fontFamily: "'Noto Serif SC',serif", fontSize: '1.1rem', fontWeight: 700, marginBottom: 20 }}>🏪 {student.type}类门店（{rs.length}家）</h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="app-table">
                <thead><tr><th>门店</th><th style={{ textAlign: 'center' }}>容量</th><th style={{ textAlign: 'center' }}>已录取</th><th style={{ textAlign: 'center' }}>剩余</th><th style={{ textAlign: 'center' }}>状态</th></tr></thead>
                <tbody>{rs.map(s => <tr key={s.name} style={{ background: s.name === result.data.store ? 'rgba(43,127,216,0.06)' : undefined }}><td>{s.name}{s.name === result.data.store && <span style={{ marginLeft: 8, fontSize: '0.7rem', background: 'var(--blue)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>我的</span>}</td><td style={{ textAlign: 'center', fontWeight: 600 }}>{s.capacity}</td><td style={{ textAlign: 'center', fontWeight: 600 }}>{s.enrolled}</td><td style={{ textAlign: 'center' }}><span style={{ fontWeight: 700, color: s.remaining > 0 ? '#2d6a4f' : 'var(--red)' }}>{s.remaining}</span></td><td style={{ textAlign: 'center' }}><span className={`badge ${s.available ? 'badge-available' : 'badge-full'}`}>{s.available ? '可选' : '已满'}</span></td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return null;
}

export default App;
