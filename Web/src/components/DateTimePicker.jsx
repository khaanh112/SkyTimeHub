import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Clock, ChevronDown } from 'lucide-react';
import { vnTodayStr } from '../utils/date';

/**
 * Custom DateTimePicker
 * - Displays format: DD/MM/YYYY HH:mm
 * - Placeholder:     dd/mm/yyyy hh:mm
 * - Minutes:         restricted to 00 / 15 / 30 / 45
 * - value / onChange: YYYY-MM-DDTHH:mm  (datetime-local format)
 * - minDate:         YYYY-MM-DD  — dates before this are disabled
 */
const DateTimePicker = ({ value = '', onChange, minDate, className = '' }) => {
  const dateInputRef  = useRef(null);
  const timeButtonRef = useRef(null);
  const [timeOpen, setTimeOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, scrollH: 210 });

  // Internal state — each part tracked independently so partial selections are kept
  const parseValue = (v) => {
    if (!v) return { d: '', h: '', m: '' };
    const [d, t = ''] = v.split('T');
    return { d, h: t.slice(0, 2), m: t.slice(3, 5) };
  };

  const init = parseValue(value);
  const [datePart, setDatePart] = useState(init.d);
  const [hourVal,  setHourVal]  = useState(init.h);
  const [minVal,   setMinVal]   = useState(init.m);

  // Sync internal state when parent drives a new value (e.g. edit-page pre-fill)
  useEffect(() => {
    const { d, h, m } = parseValue(value);
    setDatePart(d);
    setHourVal(h);
    setMinVal(m);
  }, [value]);

  const today = vnTodayStr();
  const effectiveMinDate = minDate || today;

  // Fire onChange only when all three parts are present
  const emit = (d, h, m) => {
    if (d && h !== '' && m !== '') {
      onChange(`${d}T${h}:${m}`);
    } else {
      onChange('');
    }
  };

  const handleDateChange = (newDate) => {
    setDatePart(newDate);
    emit(newDate, hourVal, minVal);
  };

  const handleHourChange = (h) => {
    setHourVal(h);
    emit(datePart, h, minVal);
  };

  const handleMinChange = (m) => {
    setMinVal(m);
    emit(datePart, hourVal, m);
    setTimeOpen(false);
  };

  const displayDate = datePart ? datePart.split('-').reverse().join('/') : '';
  const displayTime = hourVal !== '' && minVal !== '' ? `${hourVal}:${minVal}` : '';

  // Open the native date picker calendar
  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      el.showPicker();
    } else {
      el.focus();
      el.click();
    }
  };

  // Calculate popover position: flip above if not enough space below
  const calcPos = (rect) => {
    const left  = Math.min(rect.left, window.innerWidth - 160);
    const headerH = 30; // HH label + padding
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const maxScrollH = 210;
    const minScrollH = 80;

    if (spaceBelow >= 120) {
      const scrollH = Math.max(minScrollH, Math.min(maxScrollH, spaceBelow - headerH - 8));
      return { top: rect.bottom + 4, left, scrollH };
    }
    // Not enough space below → show above
    const scrollH = Math.max(minScrollH, Math.min(maxScrollH, spaceAbove - headerH - 8));
    const totalH  = headerH + scrollH + 8;
    return { top: rect.top - totalH - 4, left, scrollH };
  };

  // Open time popover: calculate fixed position from button rect
  const openTimePicker = () => {
    if (!timeOpen && timeButtonRef.current) {
      setPopoverPos(calcPos(timeButtonRef.current.getBoundingClientRect()));
    }
    setTimeOpen((o) => !o);
  };

  // Close time popover on outside click
  useEffect(() => {
    if (!timeOpen) return;
    const handle = (e) => {
      if (
        timeButtonRef.current && !timeButtonRef.current.contains(e.target) &&
        !e.target.closest('[data-dtp-popover="true"]')
      ) {
        setTimeOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [timeOpen]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!timeOpen) return;
    const reposition = () => {
      if (timeButtonRef.current) {
        setPopoverPos(calcPos(timeButtonRef.current.getBoundingClientRect()));
      }
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [timeOpen]);

  const hours   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  return (
    <div
      className={`flex items-center border border-gray-300 rounded-lg bg-white text-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-shadow ${className}`}
    >
      {/* ── Date section ───────────────────────────────── */}
      <div
        className="relative flex items-center gap-1.5 px-2 py-2 flex-1 min-w-0 cursor-pointer select-none"
        onClick={openDatePicker}
      >
        <CalendarDays className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className={datePart ? 'text-gray-900' : 'text-gray-400'}>
          {displayDate || 'dd/mm/yyyy'}
        </span>
        {/* Invisible native date input — provides the calendar picker UI */}
        <input
          ref={dateInputRef}
          type="date"
          value={datePart}
          min={effectiveMinDate}
          onChange={(e) => handleDateChange(e.target.value)}
          tabIndex={-1}
          className="absolute inset-0 opacity-0 w-full cursor-pointer"
        />
      </div>

      <div className="w-px h-6 bg-gray-200 flex-shrink-0" />

      {/* ── Time trigger button ────────────────────────── */}
      <button
        ref={timeButtonRef}
        type="button"
        onClick={openTimePicker}
        className="flex items-center gap-1 px-2 py-2 text-sm cursor-pointer select-none focus:outline-none rounded-r-lg"
      >
        <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className={displayTime ? 'text-gray-900 font-medium' : 'text-gray-400'}>
          {displayTime || 'hh:mm'}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-gray-400 transition-transform ${timeOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Time popover — rendered via portal to escape overflow clipping ── */}
      {timeOpen && createPortal(
        <div
          data-dtp-popover="true"
          style={{
            position: 'fixed',
            top: popoverPos.top,
            left: popoverPos.left,
            zIndex: 9999,
            display: 'flex',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          }}
        >
          {/* ── Hours column — scrollable ── */}
          <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #f3f4f6', borderRadius: '12px 0 0 12px', overflow: 'hidden' }}>
            <div style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600, color: '#9ca3af', background: '#f9fafb', textAlign: 'center', letterSpacing: '0.05em' }}>
              HH
            </div>
            <div style={{ height: popoverPos.scrollH, overflowY: 'scroll', display: 'flex', flexDirection: 'column' }}>
              {hours.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => handleHourChange(h)}
                  style={{
                    padding: '6px 20px',
                    fontSize: '14px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: 'none',
                    outline: 'none',
                    flexShrink: 0,
                    background: h === hourVal ? '#3b82f6' : 'transparent',
                    color: h === hourVal ? '#fff' : '#374151',
                    fontWeight: h === hourVal ? 600 : 400,
                  }}
                  onMouseEnter={(e) => { if (h !== hourVal) e.currentTarget.style.background = '#eff6ff'; }}
                  onMouseLeave={(e) => { if (h !== hourVal) e.currentTarget.style.background = 'transparent'; }}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* ── Minutes column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', borderRadius: '0 12px 12px 0', overflow: 'hidden' }}>
            <div style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600, color: '#9ca3af', background: '#f9fafb', textAlign: 'center', letterSpacing: '0.05em' }}>
              MM
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {minutes.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleMinChange(m)}
                  style={{
                    padding: '6px 20px',
                    fontSize: '14px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: 'none',
                    outline: 'none',
                    flexShrink: 0,
                    background: m === minVal ? '#3b82f6' : 'transparent',
                    color: m === minVal ? '#fff' : '#374151',
                    fontWeight: m === minVal ? 600 : 400,
                  }}
                  onMouseEnter={(e) => { if (m !== minVal) e.currentTarget.style.background = '#eff6ff'; }}
                  onMouseLeave={(e) => { if (m !== minVal) e.currentTarget.style.background = 'transparent'; }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DateTimePicker;
