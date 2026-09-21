import React from 'react';
import { useNavigate } from 'react-router-dom';

const STATUS_LABEL = {
  OPEN: 'Open',
  BUSY: 'Busy',
  CLOSED: 'Closed',
  PENDING: 'Pending',
  SUSPENDED: 'Suspended',
};

/**
 * OutletCard — adapts backend Outlet shape:
 *   { id, slug, name, description, image/logoUrl, status, rating, estimatedTime, location, tags }
 *
 * Backend uses `status: OPEN|BUSY|CLOSED|...` and `estimatedTime: "15-20 min"`,
 * while the old frontend used `active: boolean` + `time: string`. We translate.
 */
const OutletCard = ({ outlet }) => {
  const navigate = useNavigate();
  const isOpen = outlet.status === 'OPEN' || outlet.status === 'BUSY';
  const image = outlet.logoUrl || outlet.image;
  const tags = outlet.tags ? outlet.tags.split(',').filter(Boolean) : [];

  return (
    <div className="bg-white rounded-2xl border border-[#FCEAE1] overflow-hidden transition-all hover:shadow-lg">
      <div className="relative w-full h-48 bg-gray-100">
        {image ? (
          <img src={image} alt={outlet.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[#94A3B8]">
            <span>No image</span>
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-xl font-bold text-[#0F172A] leading-tight">{outlet.name}</h3>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-[#94A3B8]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-green-500' : 'bg-gray-400'}`}></span>
            {STATUS_LABEL[outlet.status] || outlet.status}
          </div>
        </div>

        <p className="text-sm text-[#475569] mb-4 line-clamp-2">{outlet.description}</p>

        <div className="flex items-center gap-4 mb-3 text-sm text-[#475569]">
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span>{outlet.rating ?? '—'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>{outlet.estimatedTime}</span>
          </div>
          {outlet.location && (
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>{outlet.location}</span>
            </div>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-2 mb-4">
            {tags.map((t) => (
              <span key={t} className="px-2 py-0.5 text-[0.7rem] bg-[#FDF4F0] text-[#475569] rounded-full">{t}</span>
            ))}
          </div>
        )}

        <button
          className={`w-full border-none rounded-xl px-5 py-3 text-base font-semibold cursor-pointer transition-colors ${isOpen ? 'bg-[#EA580C] text-white hover:bg-[#C2410C]' : 'bg-gray-100 text-[#94A3B8] cursor-not-allowed'}`}
          onClick={() => navigate(`/student/outlet/${outlet.id}`)}
          disabled={!isOpen}
        >
          {isOpen ? 'View menu' : 'Closed'}
        </button>
      </div>
    </div>
  );
};

export default OutletCard;
