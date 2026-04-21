import { useState, useEffect } from 'react';
import { useUiContext } from '../ui/UiContext';
import { useTransactions, usePaginatedTransactions } from './useTransactions';
import { useAuth } from '../auth/AuthContext';
import { t } from '../../i18n';
import { Trash2, TrendingUp, TrendingDown, Fuel, Tag, Edit2, X, Check } from 'lucide-react';

const Transactions = () => {
  const { currentUser } = useAuth();
  const {
    language,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    viewMode,
    setViewMode,
    selectedQuarter,
    setSelectedQuarter,
  } = useUiContext();
  const { projects, deleteTransaction, updateTransaction } = useTransactions(currentUser?.id, {
    selectedMonth,
    selectedYear,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = usePaginatedTransactions(
    currentUser?.id,
    {
      ...(viewMode === 'month' && { month: selectedMonth }),
      year: selectedYear,
      searchQuery: debouncedSearchQuery,
      type: filterType,
      category: filterCategory,
    }
  );

  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState(null);

  const allLoaded = data?.pages.flat() || [];

  const filtered =
    viewMode === 'quarter'
      ? allLoaded.filter((tx) => {
          const d = new Date(tx.date);
          if (d.getFullYear() !== selectedYear) return false;
          const m = d.getMonth();
          if (selectedQuarter === 'h1') return m >= 0 && m <= 5;
          if (selectedQuarter === 'h2') return m >= 6 && m <= 11;
          if (selectedQuarter === '9m') return m >= 0 && m <= 8;
          if (selectedQuarter === 'year') return true;
          const q = `q${Math.floor(m / 3) + 1}`;
          return q === selectedQuarter;
        })
      : allLoaded;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    }).format(amount);
  };

  const startEditing = (tx) => {
    setEditingId(tx.id);
    setEditFormData({ ...tx });
  };

  const saveEdit = () => {
    updateTransaction(editingId, editFormData);
    setEditingId(null);
    setEditFormData(null);
  };

  const handleExport = () => {
    if (filtered.length === 0) return;
    const headers = ['Date', 'Description', 'Type', 'Category', 'SubCategory', 'Amount', 'Liters'];
    const rows = filtered.map((tx) => [
      new Date(tx.date).toLocaleDateString(),
      tx.description,
      tx.type,
      tx.category,
      tx.subCategory || '',
      tx.amount,
      tx.liters || 0,
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ferma_tolk_report_${selectedYear}_${selectedMonth + 1}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container" style={{ paddingBottom: '100px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.5rem' }}>
        {/* Month / Quarter toggle */}
        <div
          style={{
            display: 'flex',
            background: 'var(--surface)',
            padding: '4px',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <button
            onClick={() => setViewMode('month')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '10px',
              background: viewMode === 'month' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'month' ? 'white' : 'var(--text-muted)',
              fontWeight: '700',
              border: 'none',
              transition: 'all 0.2s',
            }}
          >
            {t('monthView', language)}
          </button>
          <button
            onClick={() => setViewMode('quarter')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '10px',
              background: viewMode === 'quarter' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'quarter' ? 'white' : 'var(--text-muted)',
              fontWeight: '700',
              border: 'none',
              transition: 'all 0.2s',
            }}
          >
            {t('quarterView', language)}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {viewMode === 'month' ? (
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
                fontSize: '0.95rem',
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i).map((m) => (
                <option key={m} value={m}>
                  {t('month_' + m, language)}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value)}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--surface)',
                fontWeight: '700',
                boxShadow: 'var(--shadow-sm)',
                fontSize: '0.95rem',
              }}
            >
              {['q1', 'q2', 'q3', 'q4', 'h1', 'h2', '9m', 'year'].map((p) => (
                <option key={p} value={p}>
                  {t(p === 'year' ? 'fullYear' : p, language)}
                </option>
              ))}
            </select>
          )}
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
              fontSize: '0.95rem',
            }}
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            onClick={handleExport}
            title="Download CSV"
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'var(--primary)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)',
              border: 'none',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>
      </div>

      {/* FT-026: Search and Filter Controls */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={language === 'ru' ? 'Поиск...' : 'Search...'}
          style={{
            flex: 1,
            minWidth: '150px',
            padding: '10px',
            borderRadius: '10px',
            border: 'none',
            background: 'var(--surface)',
            boxShadow: 'var(--shadow-sm)',
          }}
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: '10px',
            borderRadius: '10px',
            border: 'none',
            background: 'var(--surface)',
            boxShadow: 'var(--shadow-sm)',
            fontWeight: '700',
          }}
        >
          <option value="all">{language === 'ru' ? 'Все типы' : 'All types'}</option>
          <option value="income">{t('income', language)}</option>
          <option value="expense">{t('expense', language)}</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{
            padding: '10px',
            borderRadius: '10px',
            border: 'none',
            background: 'var(--surface)',
            boxShadow: 'var(--shadow-sm)',
            fontWeight: '700',
          }}
        >
          <option value="all">{language === 'ru' ? 'Все категории' : 'All categories'}</option>
          <option value="opex">{t('opexLabel', language) || 'OPEX'}</option>
          <option value="capex">{t('capexLabel', language) || 'CAPEX'}</option>
          <option value="operationalRevenue">
            {t('operationalRevenueLabel', language) || 'Operational Revenue'}
          </option>
          <option value="otherIncome">{t('otherIncomeLabel', language) || 'Other Income'}</option>
        </select>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          background: 'var(--surface)',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontSize: '0.65rem',
              fontWeight: '800',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
            }}
          >
            {t('income', language)}
          </p>
          <p style={{ fontSize: '1.125rem', fontWeight: '900', color: 'var(--success)' }}>
            +
            {formatCurrency(
              filtered.reduce((acc, tx) => (tx.type === 'income' ? acc + tx.amount : acc), 0)
            )}
          </p>
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <p
            style={{
              fontSize: '0.65rem',
              fontWeight: '800',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
            }}
          >
            {t('expense', language)}
          </p>
          <p style={{ fontSize: '1.125rem', fontWeight: '900', color: 'var(--danger)' }}>
            -
            {formatCurrency(
              filtered.reduce((acc, tx) => (tx.type === 'expense' ? acc + tx.amount : acc), 0)
            )}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filtered.map((tx) => (
          <div
            key={tx.id}
            className="card"
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1rem' }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: tx.type === 'income' ? '#dcfce7' : '#fee2e2',
                color: tx.type === 'income' ? 'var(--success)' : 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {tx.type === 'income' ? (
                <TrendingUp size={24} />
              ) : tx.isFuel ? (
                <Fuel size={24} />
              ) : (
                <TrendingDown size={24} />
              )}
            </div>

            {editingId === tx.id ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="text"
                  value={editFormData.description}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, description: e.target.value })
                  }
                  style={{ width: '100%', padding: '8px', fontSize: '0.875rem' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    value={editFormData.amount}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, amount: parseFloat(e.target.value) })
                    }
                    style={{ flex: 1, padding: '8px', fontSize: '0.875rem' }}
                  />
                  {tx.isFuel && (
                    <input
                      type="number"
                      value={editFormData.liters}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, liters: parseFloat(e.target.value) })
                      }
                      style={{ flex: 1, padding: '8px', fontSize: '0.875rem' }}
                      placeholder="л"
                    />
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={editFormData.projectId}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, projectId: e.target.value })
                    }
                    style={{ flex: 1, padding: '6px', fontSize: '0.75rem' }}
                  >
                    {projects
                      .filter((p) => tx.type === 'expense' || p.id !== 'all_projects')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {t(p.id, language) || p.label}
                        </option>
                      ))}
                  </select>
                  <select
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    style={{ flex: 1, padding: '6px', fontSize: '0.75rem' }}
                  >
                    <option value={tx.type === 'income' ? 'operationalRevenue' : 'opex'}>
                      {t(tx.type === 'income' ? 'operationalRevenue' : 'opexLabel', language)}
                    </option>
                    <option value={tx.type === 'income' ? 'otherIncome' : 'capex'}>
                      {t(tx.type === 'income' ? 'otherIncome' : 'capexLabel', language)}
                    </option>
                  </select>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    marginTop: '4px',
                  }}
                >
                  <button
                    onClick={() => setEditingId(null)}
                    style={{ background: 'none', color: 'var(--text-muted)' }}
                  >
                    <X size={20} />
                  </button>
                  <button
                    onClick={saveEdit}
                    style={{
                      background: 'var(--primary)',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '4px',
                    }}
                  >
                    <Check size={20} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <h4 style={{ fontWeight: '800', fontSize: '1.05rem', marginBottom: '2px' }}>
                      {tx.description}
                    </h4>
                    <p
                      style={{
                        fontWeight: '900',
                        color: tx.type === 'income' ? 'var(--success)' : 'var(--danger)',
                      }}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatCurrency(tx.amount)}
                    </p>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                    }}
                  >
                    <span>{new Date(tx.date).toLocaleDateString()}</span>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Tag size={12} />
                      {t(tx.category + 'Label', language) || tx.category}
                      {tx.subCategory &&
                        ` / ${t(tx.subCategory + 'Label', language) || tx.subCategory}`}
                      {tx.fuelType && ` [${t(tx.fuelType + 'Label', language)}]`}
                    </span>
                    {tx.liters > 0 && (
                      <>
                        <span>•</span>
                        <span>{tx.liters} л</span>
                      </>
                    )}
                    {tx.projectId && (
                      <>
                        <span>•</span>
                        <span style={{ color: 'var(--primary)', fontWeight: '700' }}>
                          {t(tx.projectId, language) ||
                            projects.find((p) => p.id === tx.projectId)?.label}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                  <button
                    onClick={() => startEditing(tx)}
                    style={{ padding: '8px', color: '#cbd5e1', background: 'none' }}
                  >
                    <div style={{ color: 'var(--primary)', opacity: 0.6 }}>
                      <Edit2 size={18} />
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(language === 'ru' ? 'Удалить?' : 'Delete?')) {
                        deleteTransaction(tx.id);
                      }
                    }}
                    style={{ padding: '8px', color: '#cbd5e1', background: 'none' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <p>
              {language === 'ru'
                ? 'Транзакций не найдено за этот период'
                : 'No transactions found for this period'}
            </p>
          </div>
        )}
        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            style={{
              padding: '12px',
              borderRadius: '12px',
              background: 'var(--surface)',
              color: 'var(--primary)',
              border: '1px solid var(--border)',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginTop: '1rem',
              width: '100%',
            }}
          >
            {isFetchingNextPage
              ? language === 'ru'
                ? 'Загрузка...'
                : 'Loading...'
              : language === 'ru'
                ? 'Загрузить еще'
                : 'Load More'}
          </button>
        )}
      </div>
    </div>
  );
};

export default Transactions;
