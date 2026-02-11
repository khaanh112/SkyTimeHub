const DetailSection = ({ title, icon: Icon, children, variant = 'default' }) => {
  const variants = {
    default: 'bg-white border-gray-200',
    highlight: 'bg-blue-50 border-blue-200',
    warning: 'bg-red-50 border-red-200',
  };

  return (
    <div className="space-y-3">
      {title && (
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-gray-500" />}
          {title}
        </h3>
      )}
      <div className={`${variants[variant]} border rounded-lg p-4`}>
        {children}
      </div>
    </div>
  );
};

export default DetailSection;
