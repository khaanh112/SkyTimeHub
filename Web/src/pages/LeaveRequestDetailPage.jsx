import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { leaveRequestService } from '../services';
import { LoadingSpinner, StatusBadge, Modal } from '../components';
import { useAuth } from '../context';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  FileText,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Users,
  Edit,
  Info,
  CheckCircle,
  Mail,
  Download,
  Eye,
} from 'lucide-react';

const SectionNumber = ({ number }) => (
  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
    {number}
  </div>
);

/** Fetches a presigned URL and offers inline view + download for a PDF attachment */
const AttachmentViewer = ({ attachmentId, originalFilename, sizeBytes }) => {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const fetchUrl = async () => {
    if (url) return url;
    setLoading(true);
    try {
      const res = await leaveRequestService.getAttachmentUrl(attachmentId);
      const fetchedUrl = res?.data?.url ?? res?.url;
      setUrl(fetchedUrl);
      return fetchedUrl;
    } catch {
      toast.error('Failed to load attachment URL');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleView = async () => {
    const fetchedUrl = await fetchUrl();
    if (fetchedUrl) setShowPreview(true);
  };

  const handleDownload = async () => {
    const fetchedUrl = await fetchUrl();
    if (!fetchedUrl) return;
    const a = document.createElement('a');
    a.href = fetchedUrl;
    a.download = originalFilename || 'attachment.pdf';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-sm text-gray-700 truncate">{originalFilename || 'document.pdf'}</span>
          {sizeBytes && <span className="text-xs text-gray-400 shrink-0">{formatSize(sizeBytes)}</span>}
        </div>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          <button
            type="button"
            onClick={handleView}
            disabled={loading}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50"
          >
            {loading ? <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            View
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={loading}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
        </div>
      </div>

      {/* Inline PDF preview */}
      {showPreview && url && (
        <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b border-gray-200">
            <span className="text-xs text-gray-600 font-medium">Preview</span>
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
          <iframe
            src={url}
            className="w-full"
            style={{ height: '600px' }}
            title={originalFilename || 'PDF Preview'}
          />
        </div>
      )}
    </div>
  );
};

const LeaveRequestDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view') || 'my-requests';
  const { user: currentUser } = useAuth();
  const [leaveRequest, setLeaveRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectedReason, setRejectedReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [balanceSummary, setBalanceSummary] = useState(null);
  const [showBalanceTooltip, setShowBalanceTooltip] = useState(false);

  useEffect(() => {
    fetchLeaveRequestDetail();
  }, [id]);

  const fetchLeaveRequestDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await leaveRequestService.getLeaveRequest(id);
      const data = response.data || response;
      setLeaveRequest(data);

      // Fetch balance summary for the requester
      try {
        if (data.userId && data.userId !== currentUser?.id) {
          const balance = await leaveRequestService.getUserBalanceSummary(data.userId);
          setBalanceSummary(balance.data || balance);
        } else {
          const balance = await leaveRequestService.getBalanceSummary();
          setBalanceSummary(balance.data || balance);
        }
      } catch (balanceError) {
        console.warn('Could not fetch balance summary:', balanceError);
      }
    } catch (error) {
      console.error('Error fetching leave request detail:', error);
      setError(error.response?.data?.message || 'Failed to load leave request details');
      toast.error('Failed to load leave request details');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this leave request?')) {
      return;
    }

    try {
      await leaveRequestService.cancelLeaveRequest(leaveRequest.id);
      toast.success('Leave request cancelled successfully');
      navigate('/leave-requests');
    } catch (error) {
      const data = error.response?.data;
      if (data?.details && Array.isArray(data.details) && data.details.length > 0) {
        data.details.forEach((msg) => toast.error(msg));
      } else {
        toast.error(data?.message || 'Failed to cancel leave request');
      }
    }
  };

  const handleApprove = async () => {
    if (processingId) return;
    if (!window.confirm('Are you sure you want to APPROVE this leave request?')) {
      return;
    }

    try {
      setProcessingId(leaveRequest.id);
      await leaveRequestService.approveLeaveRequest(leaveRequest.id, leaveRequest.version);
      toast.success('Leave request approved successfully!');
      navigate('/leave-requests');
    } catch (error) {
      console.error('Error approving leave request:', error);
      if (error.response?.status === 409) {
        toast.error('This request has been modified. Refreshing data...');
        fetchLeaveRequestDetail();
      } else {
        const data = error.response?.data;
        if (data?.details && Array.isArray(data.details) && data.details.length > 0) {
          data.details.forEach((msg) => toast.error(msg));
        } else {
          toast.error(data?.message || 'Failed to approve leave request');
        }
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = () => {
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectedReason || rejectedReason.trim().length < 10) {
      toast.error('Please provide a reason (at least 10 characters)');
      return;
    }

    const requestId = leaveRequest.id;
    try {
      setSubmitting(true);
      setProcessingId(requestId);
      await leaveRequestService.rejectLeaveRequest(
        requestId,
        rejectedReason,
        leaveRequest?.version,
      );
      toast.success('Leave request rejected');
      setShowRejectModal(false);
      setRejectedReason('');
      navigate('/leave-requests');
    } catch (error) {
      console.error('Error rejecting leave request:', error);
      if (error.response?.status === 409) {
        toast.error('This request has been modified. Refreshing data...');
        setShowRejectModal(false);
        setRejectedReason('');
        fetchLeaveRequestDetail();
      } else {
        const data = error.response?.data;
        if (data?.details && Array.isArray(data.details) && data.details.length > 0) {
          data.details.forEach((msg) => toast.error(msg));
        } else {
          toast.error(data?.message || 'Failed to reject leave request');
        }
      }
    } finally {
      setSubmitting(false);
      setProcessingId(null);
    }
  };

  const calculateDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatDateWithTime = (date, session) => {
    if (!date) return '';
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const time = session === 'AM' ? '8:30' : '13:30';
    return `${dd}/${mm}/${yyyy} ${time}`;
  };

  const formatEndDateWithTime = (date, session) => {
    if (!date) return '';
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const time = session === 'PM' ? '17:30' : '12:00';
    return `${dd}/${mm}/${yyyy} ${time}`;
  };

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString('en-US', { 
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get leave type items breakdown (paid vs unpaid)
  const getItemsBreakdown = () => {
    if (!leaveRequest?.items || leaveRequest.items.length === 0) return [];
    return leaveRequest.items.map((item) => ({
      leaveTypeName: item.leaveTypeName || 'Unknown',
      leaveTypeCode: item.leaveTypeCode || '',
      amountDays: parseFloat(item.amountDays),
    }));
  };

  // Check if there are multiple leave types (limit exceeded)
  const hasLimitExceeded = () => {
    const items = getItemsBreakdown();
    return items.length > 1;
  };

  // Get balance info for tooltip (only types with actual balance pools)
  const getBalanceInfo = () => {
    if (!balanceSummary || !Array.isArray(balanceSummary)) return [];
    return balanceSummary.map((b) => ({
      name: b.leaveTypeName,
      code: b.leaveTypeCode,
      unit: b.unit || (b.leaveTypeCode === 'COMP' ? 'hours' : 'days'),
      balance: b.balance,
      accruedToDate: b.accruedToDate ?? b.totalCredit,
      totalDebit: b.totalDebit,
      annualLimit: b.annualLimit,
      monthlyAccrual: b.monthlyAccrual,
      isHardLimit: b.isHardLimit,
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-sm text-gray-600">Loading leave request details...</p>
        </div>
      </div>
    );
  }

  if (error || !leaveRequest) {
    return (
      <div className="w-full">
        <button
          onClick={() => navigate('/leave-requests')}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">
            {view === 'management' ? 'Back to Management View' : 'Back to My Requests'}
          </span>
        </button>
        
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-50 rounded-full mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Leave Request Not Found</h2>
          <p className="text-sm text-gray-600 mb-6">{error || 'The leave request you are looking for does not exist or you do not have permission to view it.'}</p>
          <button
            onClick={() => navigate('/leave-requests')}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Requests
          </button>
        </div>
      </div>
    );
  }

  const itemsBreakdown = getItemsBreakdown();
  const balanceInfo = getBalanceInfo();
  const totalDuration = parseFloat(leaveRequest.durationDays) || leaveRequest.duration || 0;

  return (
    <>
      <div className="w-full max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <button
              onClick={() => navigate('/leave-requests')}
              className="hover:text-blue-600 transition-colors"
            >
              Leave Management
            </button>
            <span>&gt;</span>
            <span className="text-gray-900 font-medium">View Request</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">View Leave Request</h1>
            <StatusBadge status={leaveRequest.status} size="lg" />
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* ── Section 1: Basic Info ────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <SectionNumber number={1} />
              <h2 className="text-lg font-bold text-gray-900">Basic Info</h2>
            </div>

            {/* Employee Info */}
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 bg-linear-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-xl font-semibold shrink-0">
                {leaveRequest.requester?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-gray-900">
                    {leaveRequest.requester?.username || 'Unknown'}
                  </h3>
                  {/* Balance tooltip trigger */}
                  {balanceInfo.length > 0 && (
                    <div className="relative">
                      <button
                        onMouseEnter={() => setShowBalanceTooltip(true)}
                        onMouseLeave={() => setShowBalanceTooltip(false)}
                        className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold hover:bg-blue-200 transition-colors"
                      >
                        i
                      </button>
                      {showBalanceTooltip && (
                        <div className="absolute left-6 top-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-70">
                          {balanceInfo.map((b, idx) => (
                            <div key={idx} className="text-xs text-gray-700 py-0.5">
                              <span className="font-medium">{b.name}:</span>{' '}
                              <span className="text-blue-600 font-semibold">
                                {b.balance} {b.unit === 'hours' ? 'hrs' : 'days'}
                              </span>
                              {b.monthlyAccrual && (
                                <span className="text-gray-400 ml-1">
                                  (accrued {b.accruedToDate}/{b.annualLimit ?? b.accruedToDate})
                                </span>
                              )}
                              {b.isHardLimit === false && b.code === 'UNPAID' && (
                                <span className="text-amber-500 ml-1">(soft limit)</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {leaveRequest.requester?.employeeId && (
                  <p className="text-sm text-gray-500">ID: {leaveRequest.requester.employeeId}</p>
                )}
                {leaveRequest.requester?.department && (
                  <p className="text-sm text-gray-500">
                    {leaveRequest.requester.department}
                  </p>
                )}
              </div>
            </div>

            {/* Leave Type & Approver */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Leave Type</label>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100">
                    {leaveRequest.requestedLeaveType?.name || 'N/A'}
                    {leaveRequest.requestedLeaveType?.category && (
                      <span
                        className="w-4 h-4 bg-blue-200 text-blue-700 rounded-full flex items-center justify-center text-[10px] font-bold cursor-help"
                        title={`Category: ${leaveRequest.requestedLeaveType.category.name}`}
                      >
                        i
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Approver</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-900">
                    {leaveRequest.approver?.username || 'Not assigned'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: Time Selection ────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <SectionNumber number={2} />
              <h2 className="text-lg font-bold text-gray-900">Time Selection</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Start</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">
                    {formatDateWithTime(leaveRequest.startDate, leaveRequest.startSession)}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">End</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">
                    {formatEndDateWithTime(leaveRequest.endDate, leaveRequest.endSession)}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Total Duration</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-sm font-semibold text-gray-900">
                    {totalDuration} {totalDuration === 1 ? 'Day' : 'Days'}
                  </span>
                </div>
              </div>
            </div>

            {/* Limit Exceeded Warning - shows breakdown when multiple leave types */}
            {hasLimitExceeded() && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm font-bold text-yellow-800">Limit Exceeded</span>
                </div>
                <div className="space-y-1">
                  {itemsBreakdown.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className={`text-sm ${item.leaveTypeCode === 'UNPAID' ? 'text-red-600' : 'text-yellow-700'}`}>
                        {item.leaveTypeName}:
                      </span>
                      <span className={`text-sm font-semibold ${item.leaveTypeCode === 'UNPAID' ? 'text-red-700' : 'text-blue-700'}`}>
                        {item.amountDays} {item.amountDays === 1 ? 'Day' : 'Days'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Single item breakdown (no limit exceeded) */}
            {!hasLimitExceeded() && itemsBreakdown.length === 1 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">{itemsBreakdown[0].leaveTypeName}:</span>
                  <span className="text-sm font-semibold text-blue-700">
                    {itemsBreakdown[0].amountDays} {itemsBreakdown[0].amountDays === 1 ? 'Day' : 'Days'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 3: Justification ─────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <SectionNumber number={3} />
              <h2 className="text-lg font-bold text-gray-900">Justification</h2>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Reason</label>
                <div className="px-4 py-3 bg-yellow-50 rounded-lg border border-yellow-200 min-h-15">
                  <p className="text-sm text-gray-900">
                    {leaveRequest.reason || <span className="text-gray-400 italic">No reason provided</span>}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Work Solution / Handover</label>
                <div className="px-4 py-3 bg-yellow-50 rounded-lg border border-yellow-200 min-h-15">
                  <p className="text-sm text-gray-900">
                    {leaveRequest.workSolution || <span className="text-gray-400 italic">No work solution provided</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Rejection Reason */}
          {leaveRequest.status === 'rejected' && leaveRequest.rejectedReason && (
            <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <XCircle className="w-6 h-6 text-red-500" />
                <h2 className="text-lg font-bold text-red-800">Rejection Reason</h2>
              </div>
              <p className="text-sm text-red-900 font-medium">{leaveRequest.rejectedReason}</p>
            </div>
          )}

          {/* ── Section 4: Additional ────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <SectionNumber number={4} />
              <h2 className="text-lg font-bold text-gray-900">Additional</h2>
            </div>

            {/* Supporting Document (Social leave) */}
            {leaveRequest.attachment && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-500 mb-2">Supporting Document</label>
                <AttachmentViewer
                  attachmentId={leaveRequest.attachment.id}
                  originalFilename={leaveRequest.attachment.originalFilename}
                  sizeBytes={leaveRequest.attachment.sizeBytes}
                />
              </div>
            )}

            {/* CC Recipients */}
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">CC</label>
              {leaveRequest.ccRecipients && leaveRequest.ccRecipients.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {leaveRequest.ccRecipients.map((recipient, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm border border-gray-200"
                    >
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      {recipient.email || recipient.username}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No CC recipients</p>
              )}
            </div>

            {/* Request metadata */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-500">
                <div>
                  <span className="font-medium">Submitted:</span>{' '}
                  {formatDateTime(leaveRequest.createdAt)}
                </div>
                {leaveRequest.updatedAt && leaveRequest.updatedAt !== leaveRequest.createdAt && (
                  <div>
                    <span className="font-medium">Last Updated:</span>{' '}
                    {formatDateTime(leaveRequest.updatedAt)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Action Buttons (bottom bar) ────────────────────────── */}
        {leaveRequest.status === 'pending' && (
          <div className="mt-8 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
            {/* Owner actions */}
            {leaveRequest.userId === currentUser?.id && (
              <>
                <button
                  onClick={() => navigate('/leave-requests')}
                  className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => navigate(`/leave-requests/${leaveRequest.id}/edit`)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit Request
                </button>
                <button
                  onClick={handleCancel}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel Request
                </button>
              </>
            )}

            {/* Approver actions */}
            {leaveRequest.userId !== currentUser?.id && (
              <>
                <button
                  onClick={() => navigate('/leave-requests')}
                  className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!!processingId}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  disabled={!!processingId}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {processingId === leaveRequest.id && <LoadingSpinner size="sm" />}
                  {processingId === leaveRequest.id ? 'Approving...' : 'Approve'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <Modal
          isOpen={showRejectModal}
          onClose={() => {
            setShowRejectModal(false);
            setRejectedReason('');
          }}
          title="Reject Leave Request"
        >
          <div className="space-y-4">
            {/* Request Info */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Employee:</strong> {leaveRequest?.requester?.username || 'Unknown'}
              </p>
              <p className="text-sm text-yellow-800">
                <strong>Period:</strong> {formatDate(leaveRequest?.startDate)} - {formatDate(leaveRequest?.endDate)}
              </p>
            </div>

            {/* Rejection Reason Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Rejection *
              </label>
              <textarea
                value={rejectedReason}
                onChange={(e) => setRejectedReason(e.target.value)}
                placeholder="Please provide a detailed reason for rejecting this leave request..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-gray-500">Minimum 10 characters required</p>
                <p className={`text-xs ${rejectedReason.length > 450 ? 'text-amber-500' : rejectedReason.length < 10 ? 'text-red-400' : 'text-gray-400'}`}>
                  {rejectedReason.length}/500
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectedReason('');
                }}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={submitting || rejectedReason.trim().length < 10}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && <LoadingSpinner size="sm" />}
                {submitting ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default LeaveRequestDetailPage;
