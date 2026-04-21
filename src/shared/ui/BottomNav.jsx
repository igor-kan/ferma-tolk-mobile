import { LayoutDashboard, History, PlusCircle, BarChart3, Bot } from 'lucide-react';
import { t } from '../../i18n';
import { useUiContext } from '../../features/ui/UiContext';

const BottomNav = ({ activeTab, setActiveTab }) => {
  const { language } = useUiContext();

  const tabs = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard', language) },
    { id: 'transactions', icon: History, label: t('history', language) },
    { id: 'add', icon: PlusCircle, label: t('add', language) },
    { id: 'reports', icon: BarChart3, label: t('reports', language) },
    { id: 'assistant', icon: Bot, label: language === 'ru' ? 'Чат' : 'Chat' },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxWidth: '480px',
        margin: '0 auto',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '0.75rem 0.625rem',
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
        zIndex: 100,
        backdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        overflow: 'visible',
      }}
    >
      {tabs.map((tab) => {
        const isAdd = tab.id === 'add';
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: isAdd ? 'var(--primary)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              color: isAdd
                ? 'white'
                : activeTab === tab.id
                  ? 'var(--primary)'
                  : 'var(--text-muted)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: isAdd
                ? activeTab === tab.id
                  ? 'translateY(-18px) scale(1.2)'
                  : 'translateY(-14px) scale(1.1)'
                : activeTab === tab.id
                  ? 'scale(1.1)'
                  : 'scale(1)',
              width: isAdd ? '56px' : '20%',
              height: isAdd ? '56px' : 'auto',
              borderRadius: isAdd ? '50%' : '0',
              boxShadow: isAdd ? '0 10px 15px -3px rgba(5, 150, 105, 0.4)' : 'none',
              border: isAdd ? '4px solid white' : 'none',
              position: 'relative',
              zIndex: isAdd ? 110 : 100,
            }}
          >
            <tab.icon size={isAdd ? 28 : 24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
            {!isAdd && (
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: activeTab === tab.id ? '800' : '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.025em',
                }}
              >
                {tab.label}
              </span>
            )}
            {activeTab === tab.id && !isAdd && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '-4px',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
