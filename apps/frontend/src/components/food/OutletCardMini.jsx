import React from 'react';
import { useNavigate } from 'react-router-dom';

const OutletCardMini = ({ outlet }) => {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground tracking-tight">{outlet.name}</h3>
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${outlet.status === 'OPEN' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${outlet.status === 'OPEN' ? 'bg-success' : 'bg-muted-foreground'}`}></span>
          {outlet.status}
        </div>
      </div>
    </div>
  );
};

export default OutletCardMini;
