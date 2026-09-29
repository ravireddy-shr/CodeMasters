import React from 'react';
import { ParticipantStatus } from '../../types';
import { CheckCircle2, Clock, Ban, AlertCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: ParticipantStatus | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'Submitted':
      return (
        <span className="badge badge-success">
          <CheckCircle2 size={12} />
          ROUND 2 COMPLETED
        </span>
      );
    case 'In Progress':
      return (
        <span className="badge badge-info">
          <Clock size={12} />
          IN PROGRESS
        </span>
      );
    case 'Disqualified':
      return (
        <span className="badge badge-danger">
          <Ban size={12} />
          DISQUALIFIED
        </span>
      );
    case 'Ready':
    default:
      return (
        <span className="badge badge-warning">
          <AlertCircle size={12} />
          READY
        </span>
      );
  }
};
