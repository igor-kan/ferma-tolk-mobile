import { useUiContext } from '../ui/UiContext';
import { useAppAnalytics } from './useAppAnalytics';
import { t } from '../../i18n';
import { TrendingUp, TrendingDown, Wallet, Zap, Fuel } from 'lucide-react';

const Dashboard = () => {
  const { language, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear } =
    useUiContext();

  const {
    balance,
    totalIncome,
    totalExpenses,
    fuelLiters,
    fuelCost,
    opex,
    opexBreakdown,
    fuelBreakdown,
  } = useAppAnalytics();

  const years = [2024, 2025, 2026];
  const months = Array.from({ length: 12 }, (_, i) => i);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    }).format(amount);
  };

  const _avgPrice = fuelLiters > 0 ? (fuelCost / fuelLiters).toFixed(2) : 0;

  const mainStats = [
    { label: t('totalIncome', language), value: totalIncome, icon: TrendingUp, color: '#10b981' },
    {
      label: t('totalExpenses', language),
      value: totalExpenses,
      icon: TrendingDown,
      color: '#ef4444',
    },
  ];

  const _fuelStats = [
    {
      label: t('totalFuelLiters', language),
      value: (fuelLiters || 0).toFixed(1) + ' л',
      icon: Zap,
      color: '#f59e0b',
    },
    {
      label: t('totalFuelCost', language),
      value: formatCurrency(fuelCost || 0),
      icon: Fuel,
      color: '#ef4444',
    },
  ];

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
          {months.map((m) => (
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
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, var(--primary-dark), var(--primary))',
          color: 'white',
          marginBottom: '1.5rem',
          boxShadow: '0 10px 20px rgba(5, 150, 105, 0.2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: 0.9,
            marginBottom: '4px',
          }}
        >
          <Wallet size={16} />
          <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
            {t('totalBalance', language)}
          </span>
        </div>
        <h2 style={{ fontSize: '2.5rem', fontWeight: '900' }}>{formatCurrency(balance)}</h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {mainStats.map((stat, i) => (
          <div key={i} className="card" style={{ padding: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--text-muted)',
                marginBottom: '8px',
              }}
            >
              <stat.icon size={16} style={{ color: stat.color }} />
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {stat.label}
              </span>
            </div>
            <p style={{ fontSize: '1.125rem', fontWeight: '800' }}>{formatCurrency(stat.value)}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ borderLeft: '4px solid #f59e0b', padding: '1.25rem' }}>
        <h3
          style={{
            fontSize: '1.125rem',
            fontWeight: '800',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Fuel size={20} color="#f59e0b" />
          {t('fuelAnalytics', language)}
        </h3>
        <div
          style={{
            background: '#f8fafc',
            padding: '12px',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            border: '1px solid var(--border)',
          }}
        >
          {['diesel', 'petrol', 'propan'].map((type) => {
            const data = fuelBreakdown[type];
            if (!data || data.cost === 0) return null;
            const priceForType = data.liters > 0 ? data.cost / data.liters : 0;
            return (
              <div
                key={type}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <p
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t(type + 'Label', language)}
                  </p>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                    {data.liters.toFixed(1)} л
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: '800' }}>
                    {formatCurrency(data.cost)}
                  </p>
                  <p style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: '700' }}>
                    {formatCurrency(priceForType)} / л
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '800', marginBottom: '1.25rem' }}>
          {t('opexBreakdown', language)}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {(opexBreakdown || [])
            .filter((item) => item.value > 0)
            .map((item, i) => (
              <div key={i}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '4px',
                    fontSize: '0.875rem',
                  }}
                >
                  <span style={{ fontWeight: '600' }}>
                    {t(item.id + 'Label', language) || item.label}
                  </span>
                  <span style={{ fontWeight: '700' }}>{formatCurrency(item.value)}</span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    background: '#f1f5f9',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${opex > 0 ? (item.value / opex) * 100 : 0}%`,
                      height: '100%',
                      background: 'var(--primary)',
                      transition: 'width 1s ease-out',
                    }}
                  ></div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
