import { Clock } from 'lucide-react';

const OTManagementPage = () => {
  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center">
        <Clock className="w-8 h-8 text-purple-400" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">OT & Compensatory Management</h1>
      <p className="text-gray-500 text-sm">This module is coming soon.</p>
    </div>
  );
};

export default OTManagementPage;
