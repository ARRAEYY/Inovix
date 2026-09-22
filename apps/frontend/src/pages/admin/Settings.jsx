import React, { useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';

const Settings = () => {
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      alert('Settings saved successfully (Mock)');
    }, 1000);
  };

  const handleDiscard = () => {
    if (window.confirm('Are you sure you want to discard your changes?')) {
      alert('Changes discarded');
    }
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: '1000px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
        
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
            Settings
          </h1>
          <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem' }}>
            Manage Nosh platform-wide settings.
          </p>
        </div>

        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 24px 0', fontSize: '1.25rem', fontWeight: '800', color: '#111827' }}>Platform Settings</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={settingRowStyle}>
              <div>
                <div style={settingTitleStyle}>Maintenance Mode</div>
                <div style={settingDescStyle}>Temporarily disable all ordering across the platform. Outlets and Menus will remain visible.</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" />
                <span className="slider round"></span>
              </label>
            </div>

            <div style={settingRowStyle}>
              <div>
                <div style={settingTitleStyle}>Platform Fee (%)</div>
                <div style={settingDescStyle}>Global percentage fee applied to all orders.</div>
              </div>
              <input type="number" defaultValue="2" style={inputStyle} />
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 24px 0', fontSize: '1.25rem', fontWeight: '800', color: '#111827' }}>Authentication</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={settingRowStyle}>
              <div>
                <div style={settingTitleStyle}>Require institutional email</div>
                <div style={settingDescStyle}>Only allow user registration with @rishihood.edu.in emails.</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" defaultChecked />
                <span className="slider round"></span>
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={handleDiscard} disabled={saving} style={{ padding: '12px 24px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: saving ? 0.7 : 1 }}>
            Discard Changes
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '12px 24px', background: '#b10035', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : 'Save All Settings'}
          </button>
        </div>

      </div>
      
      {/* Inline styles for toggle switch (mock) */}
      <style dangerouslySetInnerHTML={{__html: `
        .toggle-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #e5e7eb; transition: .3s; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; }
        input:checked + .slider { background-color: #10b981; }
        input:checked + .slider:before { transform: translateX(20px); }
        .slider.round { border-radius: 24px; }
        .slider.round:before { border-radius: 50%; }
      `}} />
    </AdminLayout>
  );
};

// Extracted styles
const cardStyle = {
  background: 'white',
  borderRadius: '16px',
  border: '1px solid #e5e7eb',
  padding: '32px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
};

const settingRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingBottom: '24px',
  borderBottom: '1px solid #f3f4f6'
};

const settingTitleStyle = {
  fontWeight: '700',
  color: '#111827',
  marginBottom: '4px'
};

const settingDescStyle = {
  color: '#6b7280',
  fontSize: '0.85rem'
};

const inputStyle = {
  width: '80px',
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '0.95rem',
  textAlign: 'right'
};

export default Settings;
