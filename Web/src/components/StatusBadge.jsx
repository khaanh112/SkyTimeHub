import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

const StatusBadge = ({ status, size = 'md', showIcon = true }) => {
  const statusConfig = {
    pending: {
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      border: 'border-yellow-200',
      icon: Clock,
      label: 'Pending',
    },
    approved: {
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200',
      icon: CheckCircle,
      label: 'Approved',
    },
    rejected: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      icon: XCircle,
      label: 'Rejected',
    },
    cancelled: {
      bg: 'bg-gray-50',
      text: 'text-gray-700',
      border: 'border-gray-200',
      icon: XCircle,
      label: 'Cancelled',
    },
    done: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      icon: CheckCircle,
      label: 'Done',
    },
  };

  const sizeConfig = {
    sm: {
      padding: 'px-2 py-0.5',
      text: 'text-xs',
      icon: 'w-3 h-3',
    },
    md: {
      padding: 'px-3 py-1',
      text: 'text-sm',
      icon: 'w-4 h-4',
    },
    lg: {
      padding: 'px-4 py-2',
      text: 'text-base',
      icon: 'w-5 h-5',
    },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${sizes.padding} ${config.bg} ${config.text} ${config.border} border rounded-full font-medium ${sizes.text}`}
    >
      {showIcon && <Icon className={sizes.icon} />}
      {config.label}
    </span>
  );
};

export default StatusBadge;
