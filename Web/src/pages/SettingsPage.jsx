import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Save, X, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '../components';
import holidayCalendarService from '../services/holidayCalendarService';

const TABS = [
  { key: 'leave-policy', label: 'Leave Policy' },
  { key: 'ot-policy', label: 'OT Policy' },
  { key: 'holiday-calendar', label: 'Holiday Calendar' },
];

const DEFAULT_HOLIDAYS = [
  { name: 'International New Year', startDate: '', endDate: '', compensatoryDate: '' },
  { name: 'Lunar New Year (Tet Holiday)', startDate: '', endDate: '', compensatoryDate: '' },
  { name: 'Hung Kings Commemoration', startDate: '', endDate: '', compensatoryDate: '' },
  { name: 'Victory Day & Labor Day', startDate: '', endDate: '', compensatoryDate: '' },
  { name: 'National Day', startDate: '', endDate: '', compensatoryDate: '' },
];

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
      {activeTab === 'leave-policy' && (
        <div className="text-gray-500 text-center py-16">
          Leave Policy configuration coming soon.
        </div>
      )}
      {activeTab === 'ot-policy' && (
        <div className="text-gray-500 text-center py-16">
          OT Policy configuration coming soon.
        </div>
      )}
    </div>
  );
};

const HolidayCalendarTab = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [holidays, setHolidays] = useState(DEFAULT_HOLIDAYS.map((h) => ({ ...h })));
  const [originalHolidays, setOriginalHolidays] = useState([]);
  const [totalDays, setTotalDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Year options: current year ± 5
  const yearOptions = [];
  for (let y = currentYear - 5; y <= currentYear + 5; y++) {
    yearOptions.push(y);
  }

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    setErrors({});
    try {
      const data = await holidayCalendarService.getHolidays(selectedYear);
      if (data.holidays && data.holidays.length > 0) {
        // Merge fetched holidays with defaults to preserve order
        const merged = DEFAULT_HOLIDAYS.map((defaultH) => {
          const found = data.holidays.find((h) => h.name === defaultH.name);
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

        // Add any extra holidays not in defaults
        const defaultNames = DEFAULT_HOLIDAYS.map((h) => h.name);
        const extras = data.holidays
          .filter((h) => !defaultNames.includes(h.name))
          .map((h) => ({
            name: h.name,
            startDate: h.startDate || '',
            endDate: h.endDate || '',
            compensatoryDate: h.compensatoryDate || '',
          }));

        const allHolidays = [...merged, ...extras];
        setHolidays(allHolidays);
        setOriginalHolidays(JSON.parse(JSON.stringify(allHolidays)));
        setTotalDays(data.totalDays || 0);
      } else {
        const defaults = DEFAULT_HOLIDAYS.map((h) => ({ ...h }));
        setHolidays(defaults);
        setOriginalHolidays(JSON.parse(JSON.stringify(defaults)));
        setTotalDays(0);
      }
    } catch {
      const defaults = DEFAULT_HOLIDAYS.map((h) => ({ ...h }));
      setHolidays(defaults);
      setOriginalHolidays(JSON.parse(JSON.stringify(defaults)));
      setTotalDays(0);
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
        const start = new Date(h.startDate);
        const end = new Date(h.endDate);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
          total += Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        }
      }
    }
    return total;
  }, []);

  const handleDateChange = (index, field, value) => {
    const updated = [...holidays];
    updated[index] = { ...updated[index], [field]: value };
    setHolidays(updated);
    setTotalDays(calculateTotalDays(updated));

    // Clear error for this field
    const newErrors = { ...errors };
    delete newErrors[`${index}-${field}`];
    // Clear cross-field errors when either start/end changes
    if (field === 'startDate' || field === 'endDate') {
      delete newErrors[`${index}-dateRange`];
    }
    setErrors(newErrors);
  };

  const validate = () => {
    const newErrors = {};
    const filledHolidays = holidays.filter((h) => h.startDate || h.endDate);

    for (let i = 0; i < holidays.length; i++) {
      const h = holidays[i];
      const hasAnyDate = h.startDate || h.endDate;

      if (!hasAnyDate) continue; // Skip completely empty rows

      // Start date required if end date is filled
      if (!h.startDate && h.endDate) {
        newErrors[`${i}-startDate`] = 'Start date is required';
      }

      // End date required if start date is filled
      if (h.startDate && !h.endDate) {
        newErrors[`${i}-endDate`] = 'End date is required';
      }

      // End date >= start date
      if (h.startDate && h.endDate) {
        const start = new Date(h.startDate);
        const end = new Date(h.endDate);

        if (isNaN(start.getTime())) {
          newErrors[`${i}-startDate`] = 'Invalid date';
        }
        if (isNaN(end.getTime())) {
          newErrors[`${i}-endDate`] = 'Invalid date';
        }
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start) {
          newErrors[`${i}-dateRange`] = 'End date cannot be earlier than start date';
        }

        // Validate year matches
        if (!isNaN(start.getTime()) && start.getFullYear() !== selectedYear) {
          newErrors[`${i}-startDate`] = `Date must be in year ${selectedYear}`;
        }
        if (!isNaN(end.getTime()) && end.getFullYear() !== selectedYear) {
          newErrors[`${i}-endDate`] = `Date must be in year ${selectedYear}`;
        }
      }

      // Validate compensatory date is on a weekend
      if (h.compensatoryDate) {
        const compDate = new Date(h.compensatoryDate);
        if (isNaN(compDate.getTime())) {
          newErrors[`${i}-compensatoryDate`] = 'Invalid date';
        } else {
          const dayOfWeek = compDate.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            newErrors[`${i}-compensatoryDate`] = 'Must be on a weekend (Sat/Sun)';
          }
          if (compDate.getFullYear() !== selectedYear) {
            newErrors[`${i}-compensatoryDate`] = `Date must be in year ${selectedYear}`;
          }
        }
      }
    }

    // Check for duplicate holidays with overlapping date ranges
    for (let i = 0; i < filledHolidays.length; i++) {
      for (let j = i + 1; j < filledHolidays.length; j++) {
        const a = filledHolidays[i];
        const b = filledHolidays[j];
        if (a.startDate && a.endDate && b.startDate && b.endDate) {
          const aStart = new Date(a.startDate);
          const aEnd = new Date(a.endDate);
          const bStart = new Date(b.startDate);
          const bEnd = new Date(b.endDate);

          // Check for overlapping date ranges
          if (aStart <= bEnd && bStart <= aEnd) {
            const idxA = holidays.indexOf(a);
            const idxB = holidays.indexOf(b);
            newErrors[`${idxA}-dateRange`] = `Overlapping dates with "${b.name}"`;
            newErrors[`${idxB}-dateRange`] = `Overlapping dates with "${a.name}"`;
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Please fix the validation errors before saving.');
      return;
    }

    // Only send holidays that have dates filled in
    const holidaysToSave = holidays
      .filter((h) => h.startDate && h.endDate)
      .map((h) => ({
        name: h.name,
        startDate: h.startDate,
        endDate: h.endDate,
        ...(h.compensatoryDate ? { compensatoryDate: h.compensatoryDate } : {}),
      }));

    setSaving(true);
    try {
      const data = await holidayCalendarService.saveHolidays(selectedYear, holidaysToSave);
      toast.success('Holiday calendar saved successfully!');

      // Update state with response
      if (data.holidays) {
        const merged = DEFAULT_HOLIDAYS.map((defaultH) => {
          const found = data.holidays.find((h) => h.name === defaultH.name);
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
        const extras = data.holidays
          .filter((h) => !defaultNames.includes(h.name))
          .map((h) => ({
            name: h.name,
            startDate: h.startDate || '',
            endDate: h.endDate || '',
            compensatoryDate: h.compensatoryDate || '',
          }));

        const allHolidays = [...merged, ...extras];
        setHolidays(allHolidays);
        setOriginalHolidays(JSON.parse(JSON.stringify(allHolidays)));
        setTotalDays(data.totalDays || 0);
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

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    // Convert YYYY-MM-DD to YYYY-MM-DD (already the correct format for input[type=date])
    return dateStr;
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
                        value={formatDateForInput(holiday.startDate)}
                        onChange={(e) => handleDateChange(index, 'startDate', e.target.value)}
                        min={`${selectedYear}-01-01`}
                        max={`${selectedYear}-12-31`}
                        className={`border rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors[`${index}-startDate`]
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
                        value={formatDateForInput(holiday.endDate)}
                        onChange={(e) => handleDateChange(index, 'endDate', e.target.value)}
                        min={holiday.startDate || `${selectedYear}-01-01`}
                        max={`${selectedYear}-12-31`}
                        className={`border rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors[`${index}-endDate`] || errors[`${index}-dateRange`]
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
                        value={formatDateForInput(holiday.compensatoryDate)}
                        onChange={(e) =>
                          handleDateChange(index, 'compensatoryDate', e.target.value)
                        }
                        min={`${selectedYear}-01-01`}
                        max={`${selectedYear}-12-31`}
                        className={`border rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors[`${index}-compensatoryDate`]
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

      {/* Action buttons */}
      <div className="flex justify-end space-x-3 mt-6">
        <button
          onClick={handleCancel}
          className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <LoadingSpinner size="sm" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
