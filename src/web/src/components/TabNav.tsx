import './TabNav.css';

interface Tab {
  id: string;
  label: string;
}

interface TabNavProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  ariaLabel?: string;
}

export function TabNav({ tabs, activeTab, onTabChange, ariaLabel = 'Navigation tabs' }: TabNavProps) {
  return (
    <nav className="tab-nav" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
          id={`tab-${tab.id}`}
          className={`tab-nav-button ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

interface TabPanelProps {
  id: string;
  tabId: string;
  activeTab: string;
  children: React.ReactNode;
}

export function TabPanel({ id, tabId, activeTab, children }: TabPanelProps) {
  if (activeTab !== tabId) return null;

  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      className="tab-panel"
    >
      {children}
    </div>
  );
}