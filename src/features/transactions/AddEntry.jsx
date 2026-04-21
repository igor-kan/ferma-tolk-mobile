import { useState, useRef, useEffect } from 'react';
import { useUiContext } from '../ui/UiContext';
import { useTransactions } from './useTransactions';
import { useAuth } from '../auth/AuthContext';
import { useTaxonomy } from '../taxonomy/useTaxonomy';
import { t } from '../../i18n';
import { Mic, Check, X, ArrowUpRight, ArrowDownLeft, Zap, TrendingDown } from 'lucide-react';
import { validateTransaction, formatValidationErrors } from '../../lib/validators';
import { parseHeuristics } from './categorization';
import { buildApiUrl } from '../../shared/api/apiUrl';

const AddEntry = () => {
  const { currentUser } = useAuth();
  const { language, selectedMonth, selectedYear } = useUiContext();
  const { addTransaction, descriptionMappings, projects } = useTransactions(currentUser?.id, {
    selectedMonth,
    selectedYear,
  });
  const { taxonomy } = useTaxonomy(currentUser?.id);
  const { session } = useAuth();
  const [mode, setMode] = useState('voice');
  const [_isRecording, setIsRecording] = useState(false);
  const [recordingStep, setRecordingStep] = useState(0);
  const [transcribingText, setTranscribingText] = useState('');
  const [formError, setFormError] = useState('');
  const [parsedData, setParsedData] = useState(null);

  const [voiceSelection, setVoiceSelection] = useState({
    type: 'expense',
    category: 'opex',
  });

  const [formData, setFormData] = useState({
    type: 'expense',
    category: 'opex',
    amount: '',
    liters: '',
    description: '',
    projectId: projects[0]?.id || 'all_projects',
    date: new Date().toISOString().split('T')[0],
  });

  const firstProjectForIncome =
    projects.find((project) => project.id !== 'all_projects')?.id || 'all_projects';

  const normalizeProjectIdForType = (type, projectId) => {
    if (type !== 'income') {
      return projectId || 'all_projects';
    }
    if (projectId && projectId !== 'all_projects') {
      return projectId;
    }
    return firstProjectForIncome;
  };

  const normalizedFormProjectId = normalizeProjectIdForType(formData.type, formData.projectId);
  const normalizedParsedProjectId = parsedData
    ? normalizeProjectIdForType(parsedData.type, parsedData.projectId)
    : 'all_projects';

  const transcriptRef = useRef('');
  const litersInputRef = useRef(null);
  const recognitionRef = useRef(null);

  const finishRecording = () => {
    if (recognitionRef.current && recognitionRef.current.state === 'recording') {
      recognitionRef.current.stop();
    }
  };

  const processAudio = async (audioBlob) => {
    setIsRecording(false);
    setRecordingStep(4);

    try {
      const base64Audio = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
      });

      const accessToken = session?.access_token;
      const res = await fetch(buildApiUrl('/api/speech'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          audioBase64: base64Audio,
          language,
          mimeType: audioBlob.type,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'API Error');
      }

      const data = await res.json();
      if (data.text) {
        transcriptRef.current = data.text;
      } else {
        alert(
          language === 'ru'
            ? 'Речь не распознана. Пожалуйста, говорите четче.'
            : 'Speech not recognized. Please speak more clearly.'
        );
        setRecordingStep(2);
        return;
      }

      const finalData = parseHeuristics(transcriptRef.current, {
        language,
        descriptionMappings,
        projects,
        voiceSelection,
        taxonomy,
      });
      setParsedData(finalData);
      setRecordingStep(5);

      if (finalData.isFuel && finalData.liters === 0) {
        setTimeout(() => {
          litersInputRef.current?.focus();
        }, 100);
      }
    } catch (error) {
      console.error(error);
      alert(language === 'ru' ? `Ошибка: ${error.message}` : `Error: ${error.message}`);
      setRecordingStep(2);
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current && recognitionRef.current.state === 'recording') {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleStartRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      alert(
        language === 'ru'
          ? 'Голосовой ввод не поддерживается на этом устройстве'
          : 'Voice input is not supported on this device'
      );
      setRecordingStep(2);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recognitionRef.current = mediaRecorder;
      const audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
        processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingStep(3);
      setTranscribingText(language === 'ru' ? 'Запись идет...' : 'Recording...');
      transcriptRef.current = '';
    } catch (e) {
      console.error(e);
      alert(language === 'ru' ? 'Нет доступа к микрофону' : 'Microphone access denied');
      setIsRecording(false);
      setRecordingStep(2);
    }
  };

  const handleStopRecording = () => {
    finishRecording();
  };

  const resetVoiceFlow = () => {
    setRecordingStep(0);
    setTranscribingText('');
    setParsedData(null);
    transcriptRef.current = '';
  };

  const handleApprove = () => {
    if (!parsedData) return;

    addTransaction({
      ...parsedData,
      projectId: normalizedParsedProjectId,
    });
    setRecordingStep(6);
    setTimeout(() => resetVoiceFlow(), 2000);
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const validation = validateTransaction({
      ...formData,
      projectId: normalizedFormProjectId,
      amount: formData.amount,
      liters: formData.liters || null,
      date: formData.date ? new Date(formData.date).toISOString() : undefined,
    });

    if (!validation.ok) {
      setFormError(formatValidationErrors(validation.errors));
      return;
    }

    const result = await addTransaction(validation.value);

    if (result && !result.ok) {
      setFormError(formatValidationErrors(result.errors));
      return;
    }

    setRecordingStep(6);
    setTimeout(() => {
      resetVoiceFlow();
      setFormError('');
      setMode('voice');
      setFormData({
        type: 'expense',
        category: 'opex',
        amount: '',
        liters: '',
        description: '',
        projectId: projects[0]?.id || 'all_projects',
        date: new Date().toISOString().split('T')[0],
      });
    }, 2000);
  };

  return (
    <div className="container" style={{ paddingBottom: '100px' }}>
      {recordingStep < 6 && (
        <div
          style={{
            display: 'flex',
            background: '#e2e8f0',
            borderRadius: '12px',
            padding: '4px',
            marginBottom: '1.5rem',
          }}
        >
          <button
            onClick={() => {
              setMode('voice');
              resetVoiceFlow();
            }}
            style={{
              flex: 1,
              padding: '8px',
              background: mode === 'voice' ? 'white' : 'transparent',
              borderRadius: '10px',
            }}
          >
            {t('voiceRecording', language)}
          </button>
          <button
            onClick={() => setMode('keyboard')}
            style={{
              flex: 1,
              padding: '8px',
              background: mode === 'keyboard' ? 'white' : 'transparent',
              borderRadius: '10px',
            }}
          >
            {t('fallbackKeyboard', language)}
          </button>
        </div>
      )}

      {recordingStep === 6 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            textAlign: 'center',
          }}
        >
          <div
            className="pulse"
            style={{
              width: '100px',
              height: '100px',
              background: 'var(--success)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              marginBottom: '1.5rem',
            }}
          >
            <Check size={60} />
          </div>
          <h2 style={{ fontWeight: '900', fontSize: '1.75rem', color: 'var(--success)' }}>
            {language === 'ru' ? 'Запись сохранена!' : 'Transaction Saved!'}
          </h2>
        </div>
      ) : mode === 'voice' ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
          }}
        >
          {recordingStep === 0 && (
            <div style={{ width: '100%' }}>
              <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', fontWeight: '800' }}>
                {t('selectType', language)}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <button
                  onClick={() => {
                    setVoiceSelection({ ...voiceSelection, type: 'expense' });
                    setRecordingStep(1);
                  }}
                  className="card"
                  style={{ background: '#fee2e2', color: 'var(--danger)', padding: '2rem 1rem' }}
                >
                  <ArrowDownLeft size={32} />
                  <div>{t('expense', language)}</div>
                </button>
                <button
                  onClick={() => {
                    setVoiceSelection({ type: 'income', category: 'operationalRevenue' });
                    setRecordingStep(2);
                  }}
                  className="card"
                  style={{ background: '#dcfce7', color: 'var(--success)', padding: '2rem 1rem' }}
                >
                  <ArrowUpRight size={32} />
                  <div>{t('income', language)}</div>
                </button>
              </div>
            </div>
          )}
          {recordingStep === 1 && (
            <div style={{ width: '100%' }}>
              <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', fontWeight: '800' }}>
                {t('selectCategory', language)}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <button
                  onClick={() => {
                    setVoiceSelection({ ...voiceSelection, category: 'opex' });
                    setRecordingStep(2);
                  }}
                  className="card"
                  style={{ background: '#fef3c7', color: '#b45309', padding: '2rem 1rem' }}
                >
                  <Zap size={32} />
                  <div>{t('opexLabel', language)}</div>
                </button>
                <button
                  onClick={() => {
                    setVoiceSelection({ ...voiceSelection, category: 'capex' });
                    setRecordingStep(2);
                  }}
                  className="card"
                  style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2rem 1rem' }}
                >
                  <TrendingDown size={32} />
                  <div>{t('capexLabel', language)}</div>
                </button>
              </div>
              <button
                onClick={() => setRecordingStep(0)}
                style={{ width: '100%', marginTop: '1rem', color: 'var(--text-muted)' }}
              >
                {t('backToType', language)}
              </button>
            </div>
          )}
          {recordingStep === 2 && (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <div style={{ marginBottom: '2rem' }}>
                <span
                  className="badge"
                  style={{
                    background:
                      voiceSelection.type === 'income' ? 'var(--success)' : 'var(--danger)',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    marginRight: '8px',
                  }}
                >
                  {t(voiceSelection.type, language)}
                </span>
                <span
                  className="badge"
                  style={{
                    background: 'var(--primary)',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '12px',
                  }}
                >
                  {t(voiceSelection.category + 'Label', language) ||
                    t(voiceSelection.category, language)}
                </span>
                <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
                  {t('readyToListen', language)}
                </p>
              </div>
              <button
                onClick={handleStartRecording}
                className="pulse"
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                }}
              >
                <Mic size={48} />
              </button>
              <button
                onClick={() => setRecordingStep(voiceSelection.type === 'income' ? 0 : 1)}
                style={{ marginTop: '2rem', color: 'var(--text-muted)' }}
              >
                {t('modifySelection', language)}
              </button>
            </div>
          )}
          {recordingStep === 3 && (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <div
                className="pulse"
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'var(--success)',
                  margin: '0 auto 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: 'white',
                  }}
                ></div>
              </div>
              <p style={{ fontWeight: '800' }}>{t('voicePulse', language)}</p>
              {transcribingText && (
                <div
                  className="card"
                  style={{
                    border: '2px dashed var(--success)',
                    marginTop: '1rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  &quot;{transcribingText}&quot;
                </div>
              )}
              <button
                onClick={handleStopRecording}
                style={{
                  padding: '12px 24px',
                  background: 'var(--success)',
                  color: 'white',
                  borderRadius: '12px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '0 auto',
                }}
              >
                <X size={20} />
                {language === 'ru' ? 'ОСТАНОВИТЬ' : 'STOP'}
              </button>
            </div>
          )}
          {recordingStep === 4 && (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid var(--primary)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1.5rem',
                }}
              ></div>
              <p>{t('analyzingData', language)}</p>
            </div>
          )}
          {recordingStep === 5 && parsedData && (
            <div className="card" style={{ width: '100%', border: '2px solid var(--primary)' }}>
              <h3 style={{ marginBottom: '1rem', fontWeight: '800' }}>
                {t('confirmTransaction', language)}
              </h3>
              <input
                type="text"
                value={parsedData.description}
                onChange={(e) => setParsedData({ ...parsedData, description: e.target.value })}
                style={{
                  width: '100%',
                  marginBottom: '1rem',
                  fontStyle: 'italic',
                  background: '#f8fafc',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                }}
              />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {t('amount', language)}{' '}
                    {parsedData.isM ? '(млн. руб)' : parsedData.isK ? '(тыс. руб)' : ''}
                  </label>
                  <input
                    type="number"
                    value={
                      parsedData.isM
                        ? parsedData.amount / 1000000
                        : parsedData.isK
                          ? parsedData.amount / 1000
                          : parsedData.amount
                    }
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setParsedData({
                        ...parsedData,
                        amount: parsedData.isM ? val * 1000000 : parsedData.isK ? val * 1000 : val,
                      });
                    }}
                    style={{
                      width: '100%',
                      fontWeight: '900',
                      fontSize: '1.25rem',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '8px',
                    }}
                  />
                </div>
                {parsedData.category === 'opex' &&
                  (parsedData.isFuel || parsedData.subCategory === 'fuel') && (
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {t('liters', language) || 'Литры'}
                      </label>
                      <input
                        ref={litersInputRef}
                        type="number"
                        step="0.1"
                        value={parsedData.liters}
                        onChange={(e) => setParsedData({ ...parsedData, liters: e.target.value })}
                        style={{
                          width: '100%',
                          fontWeight: '900',
                          fontSize: '1.25rem',
                          border: '2px solid var(--primary)',
                          borderRadius: '8px',
                          padding: '8px',
                        }}
                        placeholder="0.0"
                      />
                    </div>
                  )}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {t('category', language)}
                  </label>
                  <p style={{ fontWeight: '800', marginBottom: '8px' }}>
                    {t(parsedData.category + 'Label', language) || t(parsedData.category, language)}
                    {parsedData.subCategory &&
                      ` (${t(parsedData.subCategory + 'Label', language) || t(parsedData.subCategory, language)})`}
                  </p>
                  {(parsedData.isFuel || parsedData.subCategory === 'fuel') && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {['petrol', 'diesel', 'propan'].map((ft) => (
                        <button
                          key={ft}
                          onClick={() => setParsedData({ ...parsedData, fuelType: ft })}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            background:
                              parsedData.fuelType === ft ? 'var(--primary)' : 'var(--background)',
                            color: parsedData.fuelType === ft ? 'white' : 'var(--text-muted)',
                            border: `1px solid ${parsedData.fuelType === ft ? 'var(--primary)' : 'var(--border)'}`,
                            fontWeight: '700',
                          }}
                        >
                          {t(ft + 'Label', language)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ gridColumn: 'span 2', marginTop: '8px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {t('projects', language)}
                  </label>
                  <select
                    value={normalizedParsedProjectId}
                    onChange={(e) => setParsedData({ ...parsedData, projectId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      background: 'white',
                      fontWeight: '700',
                    }}
                  >
                    {projects
                      .filter((p) => parsedData.type === 'expense' || p.id !== 'all_projects')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {t(p.id, language) || p.label}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={resetVoiceFlow}
                  style={{ flex: 1, padding: '12px', background: '#f1f5f9' }}
                >
                  <X size={20} />
                </button>
                <button
                  onClick={handleApprove}
                  style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'white' }}
                >
                  <Check size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleManualSubmit} className="card">
          {formError && (
            <div
              style={{
                background: '#fee2e2',
                color: '#dc2626',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '600',
                marginBottom: '1rem',
                whiteSpace: 'pre-line',
              }}
            >
              {formError}
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label>{t('amount', language)}</label>
            <input
              type="number"
              required
              min="0.01"
              step="any"
              value={formData.amount}
              onChange={(e) => {
                setFormError('');
                setFormData({ ...formData, amount: e.target.value });
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: `1px solid ${formError && !formData.amount ? 'var(--danger)' : 'var(--border)'}`,
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label>{t('date', language)}</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>{t('liters', language) || 'Литры'}</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.liters || ''}
                onChange={(e) => setFormData({ ...formData, liters: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label>Type</label>
            <select
              value={formData.type}
              onChange={(e) => {
                const nextType = e.target.value;
                setFormData({
                  ...formData,
                  type: nextType,
                  category:
                    nextType === 'income'
                      ? formData.category === 'opex' || formData.category === 'capex'
                        ? 'operationalRevenue'
                        : formData.category
                      : formData.category === 'operationalRevenue' ||
                          formData.category === 'otherIncome'
                        ? 'opex'
                        : formData.category,
                  projectId: normalizeProjectIdForType(nextType, formData.projectId),
                });
              }}
              style={{ width: '100%', padding: '12px' }}
            >
              <option value="expense">{t('expense', language)}</option>
              <option value="income">{t('income', language)}</option>
            </select>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>{t('category', language)}</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              style={{ width: '100%', padding: '12px' }}
            >
              {formData.type === 'expense' ? (
                <>
                  <option value="opex">{t('opexLabel', language)}</option>
                  <option value="capex">{t('capexLabel', language)}</option>
                </>
              ) : (
                <>
                  <option value="operationalRevenue">{t('operationalRevenue', language)}</option>
                  <option value="otherIncome">{t('otherIncome', language)}</option>
                </>
              )}
            </select>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>{t('projects', language)}</label>
            <select
              value={normalizedFormProjectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
              }}
            >
              {projects
                .filter((p) => formData.type === 'expense' || p.id !== 'all_projects')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {t(p.id, language) || p.label}
                  </option>
                ))}
            </select>
          </div>
          <div style={{ marginBottom: '2rem' }}>
            <label>{t('description', language)}</label>
            <input
              type="text"
              value={formData.description}
              maxLength={1000}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              style={{ width: '100%', padding: '12px' }}
            />
          </div>
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '16px',
              background: 'var(--primary)',
              color: 'white',
              fontWeight: '800',
            }}
          >
            {t('approve', language).toUpperCase()}
          </button>
        </form>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AddEntry;
