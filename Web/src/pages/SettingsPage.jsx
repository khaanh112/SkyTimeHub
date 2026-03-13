import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '../components';
import holidayCalendarService from '../services/holidayCalendarService';
import settingsService from '../services/settingsService';
import { dayjs, vnYear } from '../utils/date';

const TABS = [
  { key: 'leave-policy', label: 'Leave Policy' },
  { key: 'ot-policy', label: 'OT Policy' },
  { key: 'holiday-calendar', label: 'Holiday Calendar' },
];

const DEFAULT_HOLIDAYS = [
  { name: 'International New Year', startDate: '', endDate: '', compensatoryDate: '' },
  { name: 'Lunar New Year (Tet Holiday)', startDate: '', endDate: '', compensatoryDate: '' },
  { name: 'Hung Kings Commemoration', startDate: '', endDate: '', compensatoryDate: '' },
  { name: 'Vietnamese Cultural Day', startDate: '', endDate: '', compensatoryDate: '' },
  { name: 'Victory Day & Labor Day', startDate: '', endDate: '', compensatoryDate: '' },
  { name: 'National Day', startDate: '', endDate: '', compensatoryDate: '' },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Settings Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'holiday-calendar';

  const handleTabChange = (tabKey) => {
    setSearchParams({ tab: tabKey });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'holiday-calendar' && <HolidayCalendarTab />}
      {activeTab === 'leave-policy' && <LeavePolicyTab />}
      {activeTab === 'ot-policy' && <OtPolicyTab />}
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Leave Policy Tab
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const LeavePolicyTab = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [minCompLeaveDurationHours, setMinCompLeaveDurationHours] = useState(4);
  const [original, setOriginal] = useState(4);

  const fetchPolicy = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsService.getLeavePolicy();
      const val = data.minCompLeaveDurationHours ?? 4;
      setMinCompLeaveDurationHours(val);
      setOriginal(val);
    } catch {
      // defaults remain
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const handleSave = async () => {
    if (minCompLeaveDurationHours < 0) {
      toast.error('Value must be 0 or greater.');
      return;
    }
    setSaving(true);
    try {
      const data = await settingsService.saveLeavePolicy({ minCompLeaveDurationHours });
      const val = data.minCompLeaveDurationHours ?? minCompLeaveDurationHours;
      setMinCompLeaveDurationHours(val);
      setOriginal(val);
      toast.success('Leave policy saved successfully!');
    } catch {
      // error toast handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setMinCompLeaveDurationHours(original);
  };

  const hasChanges = minCompLeaveDurationHours !== original;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Compensatory Leave Configuration</h2>

        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Min Duration per Request
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              step="0.5"
              value={minCompLeaveDurationHours}
              onChange={(e) => setMinCompLeaveDurationHours(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-sm text-gray-500">Hours</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end space-x-3 mt-6">
        <button
          onClick={handleCancel}
          disabled={!hasChanges}
          className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Saving...
            </span>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OT Policy Tab
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const OT_POLICY_FIELDS = [
  { key: 'maxOtHoursPerDay', label: 'Max OT Hours / Day (Regular)', unit: 'Hours' },
  { key: 'maxOtHoursPerDayHoliday', label: 'Max OT Hours / Day (Rest Days & Holidays)', unit: 'Hours' },
  { key: 'maxOtHoursPerMonth', label: 'Max OT Hours / Month', unit: 'Hours' },
  { key: 'maxOtHoursPerYear', label: 'Max OT Hours / Year', unit: 'Hours' },
];

const OT_DEFAULTS = {
  maxOtHoursPerDay: 4,
  maxOtHoursPerDayHoliday: 8,
  maxOtHoursPerMonth: 40,
  maxOtHoursPerYear: 200,
};

const OtPolicyTab = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState({ ...OT_DEFAULTS });
  const [original, setOriginal] = useState({ ...OT_DEFAULTS });

  const fetchPolicy = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsService.getOtPolicy();
      const merged = { ...OT_DEFAULTS, ...data };
      setPolicy(merged);
      setOriginal(merged);
    } catch {
      // defaults remain
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const handleChange = (key, value) => {
    setPolicy((prev) => ({ ...prev, [key]: Number(value) }));
  };

  const handleSave = async () => {
    for (const f of OT_POLICY_FIELDS) {
      if (policy[f.key] < 0) {
        toast.error(`${f.label} must be 0 or greater.`);
        return;
      }
    }
    setSaving(true);
    try {
      const data = await settingsService.saveOtPolicy(policy);
      const merged = { ...OT_DEFAULTS, ...data };
      setPolicy(merged);
      setOriginal(merged);
      toast.success('OT policy saved successfully!');
    } catch {
      // error toast handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPolicy({ ...original });
  };

  const hasChanges = OT_POLICY_FIELDS.some((f) => policy[f.key] !== original[f.key]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Overtime Limits Configuration</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
          {OT_POLICY_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {field.label}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={policy[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-sm text-gray-500">{field.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end space-x-3 mt-6">
        <button
          onClick={handleCancel}
          disabled={!hasChanges}
          className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Saving...
            </span>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Holiday Calendar Tab
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const HolidayCalendarTab = () => {
  const currentYear = vnYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [holidays, setHolidays] = useState(DEFAULT_HOLIDAYS.map((h) => ({ ...h })));
  const [originalHolidays, setOriginalHolidays] = useState([]);
  const [totalDays, setTotalDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSaved, setIsSaved] = useState(false);

  // Year options: current year +/- 5
  const yearOptions = [];
  for (let y = currentYear - 5; y <= currentYear + 5; y++) {
    yearOptions.push(y);
  }

  const mergeHolidays = (serverHolidays) => {
    const merged = DEFAULT_HOLIDAYS.map((defaultH) => {
      const found = serverHolidays.find((h) => h.name === defaultH.name);
      if (found) {
        return {
          name: found.name,
          startDate: found.startDate || '',
          endDate: found.endDate || '',
          compensatoryDate: found.compensatoryDate || '',
        };
      }
      return { ...defaultH };
    });

    const defaultNames = DEFAULT_HOLIDAYS.map((h) => h.name);
    const extras = serverHolidays
      .filter((h) => !defaultNames.includes(h.name))
      .map((h) => ({
        name: h.name,
        startDate: h.startDate || '',
        endDate: h.endDate || '',
        compensatoryDate: h.compensatoryDate || '',
      }));

    return [...merged, ...extras];
  };

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    setErrors({});
    try {
      const data = await holidayCalendarService.getHolidays(selectedYear);
      if (data.holidays && data.holidays.length > 0) {
        const allHolidays = mergeHolidays(data.holidays);
        setHolidays(allHolidays);
        setOriginalHolidays(JSON.parse(JSON.stringify(allHolidays)));
        setTotalDays(data.totalDays || 0);
        // Data exists in DB -> already saved -> read-only
        const hasData = allHolidays.some((h) => h.startDate && h.endDate);
        setIsSaved(hasData);
      } else {
        const defaults = DEFAULT_HOLIDAYS.map((h) => ({ ...h }));
        setHolidays(defaults);
        setOriginalHolidays(JSON.parse(JSON.stringify(defaults)));
        setTotalDays(0);
        setIsSaved(false);
      }
    } catch {
      const defaults = DEFAULT_HOLIDAYS.map((h) => ({ ...h }));
      setHolidays(defaults);
      setOriginalHolidays(JSON.parse(JSON.stringify(defaults)));
      setTotalDays(0);
      setIsSaved(false);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  // Calculate total days from current state
  const calculateTotalDays = useCallback((holidayList) => {
    let total = 0;
    for (const h of holidayList) {
      if (h.startDate && h.endDate) {
        const start = dayjs(h.startDate);
        const end = dayjs(h.endDate);
        if (start.isValid() && end.isValid() && !end.isBefore(start)) {
          total += end.diff(start, 'day') + 1;
        }
      }
    }
    return total;
  }, []);

  const handleDateChange = (index, field, value) => {
    if (isSaved) return; // read-only after save
    const updated = [...holidays];
    updated[index] = { ...updated[index], [field]: value };
    setHolidays(updated);
    setTotalDays(calculateTotalDays(updated));

    // Clear error for this field
    const newErrors = { ...errors };
    delete newErrors[`${index}-${field}`];
    if (field === 'startDate' || field === 'endDate') {
      delete newErrors[`${index}-dateRange`];
    }
    setErrors(newErrors);
  };

  const validate = () => {
    const newErrors = {};

    // All holidays must have start & end dates (required)
    for (let i = 0; i < holidays.length; i++) {
      const h = holidays[i];

      if (!h.startDate) {
        newErrors[`${i}-startDate`] = 'Start date is required';
      }
      if (!h.endDate) {
        newErrors[`${i}-endDate`] = 'End date is required';
      }

      if (h.startDate && h.endDate) {
        const start = dayjs(h.startDate);
        const end = dayjs(h.endDate);

        if (!start.isValid()) {
          newErrors[`${i}-startDate`] = 'Invalid date';
        }
        if (!end.isValid()) {
          newErrors[`${i}-endDate`] = 'Invalid date';
        }
        if (start.isValid() && end.isValid() && end.isBefore(start)) {
          newErrors[`${i}-dateRange`] = 'End date cannot be earlier than start date';
        }

        if (start.isValid() && start.year() !== selectedYear) {
          newErrors[`${i}-startDate`] = `Date must be in year ${selectedYear}`;
        }
        if (end.isValid() && end.year() !== selectedYear) {
          newErrors[`${i}-endDate`] = `Date must be in year ${selectedYear}`;
        }
      }

      // Compensatory date validation (optional field)
      if (h.compensatoryDate) {
        const compDate = dayjs(h.compensatoryDate);
        if (!compDate.isValid()) {
          newErrors[`${i}-compensatoryDate`] = 'Invalid date';
        } else {
          const dayOfWeek = compDate.day();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            newErrors[`${i}-compensatoryDate`] = 'Must be on a weekend (Sat/Sun)';
          }
          if (compDate.year() !== selectedYear) {
            newErrors[`${i}-compensatoryDate`] = `Date must be in year ${selectedYear}`;
          }
        }
      }
    }

    // Check for overlapping date ranges
    const filled = holidays.filter((h) => h.startDate && h.endDate);
    for (let i = 0; i < filled.length; i++) {
      for (let j = i + 1; j < filled.length; j++) {
        const a = filled[i];
        const b = filled[j];
        const aStart = dayjs(a.startDate);
        const aEnd = dayjs(a.endDate);
        const bStart = dayjs(b.startDate);
        const bEnd = dayjs(b.endDate);

        if (!aStart.isAfter(bEnd) && !bStart.isAfter(aEnd)) {
          const idxA = holidays.indexOf(a);
          const idxB = holidays.indexOf(b);
          newErrors[`${idxA}-dateRange`] = `Overlapping dates with "${b.name}"`;
          newErrors[`${idxB}-dateRange`] = `Overlapping dates with "${a.name}"`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (isSaved) return;
    if (!validate()) {
      toast.error('Please fix the validation errors before saving.');
      return;
    }

    const holidaysToSave = holidays.map((h) => ({
      name: h.name,
      startDate: h.startDate,
      endDate: h.endDate,
      ...(h.compensatoryDate ? { compensatoryDate: h.compensatoryDate } : {}),
    }));

    setSaving(true);
    try {
      const data = await holidayCalendarService.saveHolidays(selectedYear, holidaysToSave);
      toast.success('Holiday calendar saved successfully!');

      if (data.holidays) {
        const allHolidays = mergeHolidays(data.holidays);
        setHolidays(allHolidays);
        setOriginalHolidays(JSON.parse(JSON.stringify(allHolidays)));
        setTotalDays(data.totalDays || 0);
        setIsSaved(true);
      }
    } catch {
      // Error toast is handled by the API interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setHolidays(JSON.parse(JSON.stringify(originalHolidays)));
    setTotalDays(calculateTotalDays(originalHolidays));
    setErrors({});
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Year selector and total days */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <span className="text-lg font-semibold text-blue-600">Year</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="text-lg font-semibold text-gray-700">
          Total holidays: <span className="text-blue-600">{totalDays} days</span>
        </div>
      </div>

      {isSaved && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          Holiday calendar for {selectedYear} has been saved. Dates cannot be modified.
        </div>
      )}

      {/* Holiday table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600 w-1/4">
                  Holiday
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                  Start <span className="text-red-500">*</span>
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                  End <span className="text-red-500">*</span>
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                  Compensatory day
                </th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((holiday, index) => (
                <tr key={index} className="border-b border-gray-100 last:border-0">
                  <td className="px-6 py-5">
                    <span className="text-sm font-medium text-gray-800">{holiday.name}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div>
                      <input
                        type="date"
                        value={holiday.startDate}
                        onChange={(e) => handleDateChange(index, 'startDate', e.target.value)}
                        disabled={isSaved}
                        min={`${selectedYear}-01-01`}
                        max={`${selectedYear}-12-31`}
                        className={`border rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          isSaved
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : errors[`${index}-startDate`]
                              ? 'border-red-400 bg-red-50'
                              : 'border-gray-300'
                        }`}
                      />
                      {errors[`${index}-startDate`] && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors[`${index}-startDate`]}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div>
                      <input
                        type="date"
                        value={holiday.endDate}
                        onChange={(e) => handleDateChange(index, 'endDate', e.target.value)}
                        disabled={isSaved}
                        min={holiday.startDate || `${selectedYear}-01-01`}
                        max={`${selectedYear}-12-31`}
                        className={`border rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          isSaved
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : errors[`${index}-endDate`] || errors[`${index}-dateRange`]
                              ? 'border-red-400 bg-red-50'
                              : 'border-gray-300'
                        }`}
                      />
                      {errors[`${index}-endDate`] && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors[`${index}-endDate`]}
                        </p>
                      )}
                      {errors[`${index}-dateRange`] && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors[`${index}-dateRange`]}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div>
                      <input
                        type="date"
                        value={holiday.compensatoryDate}
                        onChange={(e) => handleDateChange(index, 'compensatoryDate', e.target.value)}
                        disabled={isSaved}
                        min={`${selectedYear}-01-01`}
                        max={`${selectedYear}-12-31`}
                        className={`border rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          isSaved
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : errors[`${index}-compensatoryDate`]
                              ? 'border-red-400 bg-red-50'
                              : 'border-gray-300'
                        }`}
                      />
                      {errors[`${index}-compensatoryDate`] && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors[`${index}-compensatoryDate`]}
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action buttons — hidden when already saved */}
      {!isSaved && (
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={handleCancel}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                Saving...
              </span>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
