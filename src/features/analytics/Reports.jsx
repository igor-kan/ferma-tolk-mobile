import { useUiContext } from '../ui/UiContext';
import { useAppAnalytics } from './useAppAnalytics';
import { useTransactions } from '../transactions/useTransactions';
import { useAuth } from '../auth/AuthContext';
import { t } from '../../i18n';
import { Clock } from 'lucide-react';

const Reports = () => {
  const { currentUser } = useAuth();
  const { language, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear } =
    useUiContext();
  const {
    balance: _balance,
    totalIncome: _totalIncome,
    totalExpenses,
    opexBreakdown,
    forecastTotal,
    isCurrentMonth,
    cycleAnalytics,
    projectBreakdown,
  } = useAppAnalytics();
  const { addProject } = useTransactions(currentUser?.id, { selectedMonth, selectedYear });
  const cycleRows = Array.isArray(cycleAnalytics) ? cycleAnalytics : [];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    }).format(amount);
  };

  return (
    <div className="container" style={{ paddingBottom: '100px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          style={{
            flex: 2,
            padding: '12px',
            borderRadius: '12px',
            border: 'none',
            background: 'var(--surface)',
            fontWeight: '700',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {Array.from({ length: 12 }, (_, i) => i).map((m) => (
            <option key={m} value={m}>
              {t('month_' + m, language)}
            </option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '12px',
            border: 'none',
            background: 'var(--surface)',
            fontWeight: '700',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {[2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <h2
        style={{
          fontSize: '1.25rem',
          fontWeight: '800',
          marginBottom: '1rem',
          color: 'var(--text-muted)',
        }}
      >
        {language === 'ru' ? 'Отчет за ' : 'Report for '}
        {t('month_' + selectedMonth, language)} {selectedYear}
      </h2>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ fontSize: '1.125rem', fontWeight: '800' }}>
            {t('projectPerformance', language)}
          </h3>
          <button
            onClick={() => {
              const name = prompt(t('addProject', language));
              if (name) addProject(name);
            }}
            style={{
              fontSize: '0.75rem',
              padding: '6px 14px',
              background: 'var(--primary)',
              color: 'white',
              borderRadius: '8px',
              fontWeight: '700',
            }}
          >
            + {t('addProject', language)}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {projectBreakdown.map((p, i) => (
            <div
              key={p.id}
              style={{
                padding: '12px',
                background: i % 2 === 0 ? 'var(--background)' : 'white',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontWeight: '800', color: 'var(--primary-dark)' }}>
                  {t(p.id, language) || p.label}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: '900',
                      color: p.pBalance >= 0 ? 'var(--success)' : 'var(--danger)',
                    }}
                  >
                    {formatCurrency(p.pBalance)}
                  </span>
                  <div
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: '800',
                      color: p.effectiveness >= 0 ? 'var(--success)' : 'var(--danger)',
                      background:
                        p.effectiveness >= 0
                          ? 'rgba(74, 222, 128, 0.1)'
                          : 'rgba(248, 113, 113, 0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      display: 'inline-block',
                      marginLeft: '8px',
                    }}
                  >
                    {p.effectiveness > 0 ? '+' : ''}
                    {p.effectiveness.toFixed(1)}% {language === 'ru' ? 'Эфф.' : 'Eff.'}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  fontWeight: '700',
                }}
              >
                <span>
                  {t('income', language)}: {formatCurrency(p.pIncome)}
                </span>
                <span>
                  {t('expense', language)}: {formatCurrency(p.pExpense)}
                </span>
              </div>
            </div>
          ))}
          {projectBreakdown.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {language === 'ru' ? 'Нет проектов' : 'No projects'}
            </p>
          )}
        </div>
      </div>

      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #1e293b, #334155)',
          color: 'white',
          borderLeft: '4px solid #f59e0b',
          marginBottom: '1.5rem',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem',
          }}
        >
          <h3
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '1.125rem',
              fontWeight: '800',
            }}
          >
            <Clock size={20} color="#f59e0b" />
            {language === 'ru' ? 'Прогноз до конца месяца' : 'Monthly Forecast'}
          </h3>
          {isCurrentMonth && (
            <div
              className="badge"
              style={{
                background: 'rgba(245, 158, 11, 0.2)',
                color: '#f59e0b',
                border: '1px solid #f59e0b',
              }}
            >
              {language === 'ru' ? 'В процессе' : 'In Progress'}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <p
              style={{
                fontSize: '0.7rem',
                color: 'rgba(255,255,255,0.6)',
                fontWeight: '700',
                textTransform: 'uppercase',
              }}
            >
              {language === 'ru' ? 'Текущие затраты' : 'Actual Spent'}
            </p>
            <p style={{ fontSize: '1.5rem', fontWeight: '900' }}>{formatCurrency(totalExpenses)}</p>
          </div>
          {isCurrentMonth ? (
            <div>
              <p
                style={{
                  fontSize: '0.7rem',
                  color: 'rgba(255,255,255,0.6)',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                }}
              >
                {language === 'ru' ? 'Ожидаемый итог' : 'Projected Total'}
              </p>
              <p style={{ fontSize: '1.5rem', fontWeight: '900', color: '#f59e0b' }}>
                {formatCurrency(forecastTotal)}
              </p>
            </div>
          ) : (
            <div
              style={{
                textAlign: 'right',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', italic: 'true' }}>
                {language === 'ru' ? 'Период завершен' : 'Period Closed'}
              </p>
            </div>
          )}
        </div>

        {isCurrentMonth && (
          <div
            style={{
              marginTop: '1.25rem',
              padding: '12px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              fontSize: '0.8rem',
            }}
          >
            <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.4' }}>
              {language === 'ru'
                ? `На основе текущих трат (${formatCurrency(totalExpenses / new Date().getDate())}/день), вы закончите месяц с расходом ${formatCurrency(forecastTotal)}.`
                : `Based on current pace (${formatCurrency(totalExpenses / new Date().getDate())}/day), you will likely close the month at ${formatCurrency(forecastTotal)}.`}
            </p>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '800', marginBottom: '1.25rem' }}>
          {t('cropCycleForecast', language)}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {cycleRows.map((item, i) => (
            <div
              key={i}
              style={{
                borderBottom: i < cycleRows.length - 1 ? '1px solid var(--border)' : 'none',
                paddingBottom: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px',
                }}
              >
                <span style={{ fontWeight: '700' }}>{t(item.id + 'Label', language)}</span>
                <span style={{ fontWeight: '800' }}>{formatCurrency(item.currentVal)}</span>
              </div>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {t('lastYearComparison', language)}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    color:
                      item.prevVal === 0
                        ? 'var(--text-muted)'
                        : item.currentVal > item.prevVal
                          ? 'var(--danger)'
                          : 'var(--success)',
                  }}
                >
                  {item.prevVal > 0
                    ? item.currentVal > item.prevVal
                      ? `+${((item.currentVal / item.prevVal - 1) * 100).toFixed(0)}%`
                      : `-${((1 - item.currentVal / item.prevVal) * 100).toFixed(0)}%`
                    : '—'}
                  {item.prevVal > 0 && ` (${formatCurrency(item.prevVal)})`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1.125rem', fontWeight: '800', marginBottom: '1.25rem' }}>
          {language === 'ru' ? 'Топ категорий трат' : 'Top Categories'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {(opexBreakdown || [])
            .sort((a, b) => b.value - a.value)
            .filter((item) => item.value > 0)
            .map((item, i) => (
              <div
                key={i}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontWeight: '700' }}>
                  {t(item.id + 'Label', language) || item.label}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontWeight: '800' }}>{formatCurrency(item.value)}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {((item.value / totalExpenses) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          {(opexBreakdown || []).filter((item) => item.value > 0).length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {language === 'ru' ? 'Нет данных' : 'No data'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
