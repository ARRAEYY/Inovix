import React, { useState } from 'react';

const REJECTION_REASONS = [
  { id: 'ITEM_UNAVAILABLE', label: 'Item unavailable' },
  { id: 'KITCHEN_BUSY', label: 'Kitchen too busy' },
  { id: 'CLOSING_SOON', label: 'Outlet closing soon' },
  { id: 'UNABLE_TO_PREPARE', label: 'Unable to prepare' },
  { id: 'OPERATIONAL_ISSUE', label: 'Temporary operational issue' },
  { id: 'OTHER', label: 'Other' }
];

const DeclineOrderModal = ({ orderId, onClose, onSubmit }) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      setError('Please select a reason for declining the order.');
      return;
    }

    if (selectedReason === 'OTHER' && !note.trim()) {
      setError('Please provide a custom reason when "Other" is selected.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit(orderId, selectedReason, note);
    } catch (err) {
      setError(err.message || 'Failed to decline order');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content decline-modal-content">
        <h3 className="modal-title">Decline Order</h3>
        <p className="modal-subtitle">Why are you declining #{orderId?.slice(-4)}?</p>
        
        {error && <div className="modal-error">{error}</div>}

        <div className="rejection-options">
          {REJECTION_REASONS.map(reason => (
            <label key={reason.id} className="rejection-option">
              <input 
                type="radio" 
                name="rejectionReason" 
                value={reason.id} 
                checked={selectedReason === reason.id}
                onChange={() => setSelectedReason(reason.id)}
              />
              <span className="radio-label">{reason.label}</span>
            </label>
          ))}
        </div>

        <div className="rejection-note-group">
          <label className="rejection-note-label">
            {selectedReason === 'OTHER' ? 'Custom reason (Required)' : 'Additional note (Optional)'}
          </label>
          <textarea 
            className="rejection-note-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Enter reason..."
            rows={3}
          />
        </div>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button className="btn-decline-confirm" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Declining...' : 'Decline Order'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeclineOrderModal;
