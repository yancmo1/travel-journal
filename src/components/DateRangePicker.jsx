import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)
    ? { year, month: month - 1, day }
    : null;
}

function formatDate(date) {
  return date ? `${date.year}-${String(date.month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}` : '';
}

function prettyDate(date, fallback = 'Choose a date') {
  return date ? `${MONTHS[date.month].slice(0, 3)} ${date.day}, ${date.year}` : fallback;
}

function dateValue(date) {
  return new Date(date.year, date.month, date.day).getTime();
}

function sameDate(a, b) {
  return Boolean(a && b) && a.year === b.year && a.month === b.month && a.day === b.day;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function todayDate() {
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth(), day: today.getDate() };
}

export default function DateRangePicker({ startDate, endDate, onChange, label = 'Dates' }) {
  const rootRef = useRef(null);
  const start = useMemo(() => parseDate(startDate), [startDate]);
  const end = useMemo(() => parseDate(endDate), [endDate]);
  const today = useMemo(todayDate, []);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('month');
  const [activeField, setActiveField] = useState(start ? 'end' : 'start');
  const [view, setView] = useState(() => start || today);
  const [yearPage, setYearPage] = useState(() => (start || today).year - 5);
  const [hoverDate, setHoverDate] = useState(null);
  const [locked, setLocked] = useState(Boolean(start && end && !sameDate(start, end)));

  useEffect(() => {
    function handleOutside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  function openPicker() {
    const initial = activeField === 'end' ? (end || start || today) : (start || today);
    setView(initial);
    setYearPage(initial.year - 5);
    setMode('month');
    setHoverDate(null);
    setOpen(true);
  }

  function emit(nextStart, nextEnd) {
    onChange({ startDate: formatDate(nextStart), endDate: formatDate(nextEnd) });
  }

  function selectDay(date) {
    if (activeField === 'end' && locked) {
      emit(date, date);
      setActiveField('end');
      setLocked(false);
      setHoverDate(null);
      setView(date);
      return;
    }

    if (activeField === 'start') {
      const shouldMirror = !start || !end || sameDate(start, end);
      emit(date, shouldMirror ? date : end);
      setActiveField('end');
      setLocked(false);
      setHoverDate(null);
      setView(date);
      return;
    }

    if (start && dateValue(date) < dateValue(start)) return;
    emit(start, date);
    setLocked(true);
    setHoverDate(null);
    setView(date);
  }

  function chooseField(field) {
    const chosen = field === 'start' ? start : end;
    setActiveField(field);
    setLocked(false);
    setHoverDate(null);
    if (chosen) setView(chosen);
    setMode('month');
    setOpen(true);
  }

  function shift(direction) {
    if (mode === 'year') {
      setYearPage(value => value + direction * 12);
      return;
    }
    const next = new Date(view.year, view.month + direction, 1);
    setView({ year: next.getFullYear(), month: next.getMonth(), day: 1 });
    setHoverDate(null);
  }

  function chooseYear(year) {
    setView(current => ({ ...current, year }));
    setMode('month');
    setHoverDate(null);
  }

  function chooseMonth(month) {
    setView(current => ({ ...current, month }));
    setMode('month');
    setHoverDate(null);
  }

  function calendarDays() {
    const first = new Date(view.year, view.month, 1).getDay();
    const total = daysInMonth(view.year, view.month);
    const previousTotal = daysInMonth(view.year, view.month - 1);
    const dates = [];
    for (let index = first - 1; index >= 0; index -= 1) {
      dates.push(view.month === 0
        ? { year: view.year - 1, month: 11, day: previousTotal - index }
        : { year: view.year, month: view.month - 1, day: previousTotal - index });
    }
    for (let day = 1; day <= total; day += 1) dates.push({ year: view.year, month: view.month, day });
    let nextDay = 1;
    while (dates.length < 42) {
      dates.push(view.month === 11
        ? { year: view.year + 1, month: 0, day: nextDay }
        : { year: view.year, month: view.month + 1, day: nextDay });
      nextDay += 1;
    }
    return dates;
  }

  const previewEnd = activeField === 'end' && hoverDate && start && dateValue(hoverDate) >= dateValue(start) ? hoverDate : end;
  const rangeHint = locked
    ? 'Range ready. Click a date to start over.'
    : activeField === 'end' && hoverDate && start && dateValue(hoverDate) >= dateValue(start)
      ? 'Click to set the end date.'
      : activeField === 'end' ? 'Hover over a date to preview the end.' : 'Choose a start date.';

  return (
    <div className="date-range-picker" ref={rootRef}>
      {label && <span className="date-range-label">{label}</span>}
      <button type="button" className="date-range-trigger" onClick={openPicker} aria-expanded={open}>
        <CalendarDays size={18} aria-hidden="true" />
        <span>
          <strong>{prettyDate(start, 'Start date')}</strong>
          <small>{end && !sameDate(start, end) ? `through ${prettyDate(end)}` : 'Select a date range'}</small>
        </span>
        <ChevronRight size={17} aria-hidden="true" />
      </button>

      {open && (
        <div className="date-range-popover" role="dialog" aria-label={`${label} picker`}>
          <div className="date-range-header">
            <button type="button" onClick={() => shift(-1)} aria-label={mode === 'year' ? 'Previous years' : 'Previous month'}><ChevronLeft size={18} /></button>
            <div>
              <button type="button" className="date-range-month-button" onClick={() => setMode('months')}>{MONTHS[view.month]}</button>
              <button type="button" className="date-range-year-button" onClick={() => { setYearPage(view.year - 5); setMode('year'); }}>{view.year}</button>
              <small>{activeField === 'start' ? 'Start date' : 'End date'} · tap month or year to browse</small>
            </div>
            <button type="button" onClick={() => shift(1)} aria-label={mode === 'year' ? 'Next years' : 'Next month'}><ChevronRight size={18} /></button>
          </div>

          {mode === 'year' && (
            <>
              <div className="date-range-mode-row"><strong>{yearPage}–{yearPage + 11}</strong><button type="button" onClick={() => setMode('month')}>Back to calendar</button></div>
              <div className="date-range-years">{Array.from({ length: 12 }, (_, index) => yearPage + index).map(year => <button type="button" key={year} className={year === view.year ? 'is-selected' : ''} onClick={() => chooseYear(year)}>{year}</button>)}</div>
            </>
          )}

          {mode === 'months' && (
            <>
              <div className="date-range-mode-row"><strong>{view.year}</strong><button type="button" onClick={() => setMode('month')}>Back to calendar</button></div>
              <div className="date-range-months">{MONTHS.map((month, index) => <button type="button" key={month} className={index === view.month ? 'is-selected' : ''} onClick={() => chooseMonth(index)}>{month.slice(0, 3)}</button>)}</div>
            </>
          )}

          {mode === 'month' && (
            <>
              <div className="date-range-weekdays">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>
              <div className="date-range-days">
                {calendarDays().map(date => {
                  const isMuted = date.month !== view.month;
                  const isStart = Boolean(start && sameDate(start, date));
                  const isEnd = Boolean(end && sameDate(end, date) && !hoverDate);
                  const isPreviewEnd = Boolean(previewEnd && hoverDate && sameDate(previewEnd, date));
                  const inRange = Boolean(start && previewEnd && dateValue(date) > dateValue(start) && dateValue(date) < dateValue(previewEnd));
                  const invalid = activeField === 'end' && start && dateValue(date) < dateValue(start);
                  return <button type="button" key={`${date.year}-${date.month}-${date.day}`} className={`date-range-day ${isMuted ? 'is-muted' : ''} ${isStart ? 'is-start' : ''} ${isEnd ? 'is-end' : ''} ${isPreviewEnd ? 'is-preview-end' : ''} ${inRange ? 'is-in-range' : ''} ${invalid ? 'is-invalid' : ''} ${sameDate(today, date) ? 'is-today' : ''}`} onClick={() => selectDay(date)} onMouseEnter={() => { if (!locked && activeField === 'end') setHoverDate(date); }}>{date.day}</button>;
                })}
              </div>
            </>
          )}

          <div className="date-range-summary"><div><span>Start</span><button type="button" onClick={() => chooseField('start')}>{prettyDate(start, 'Choose')}</button></div><b>→</b><div><span>End</span><button type="button" onClick={() => chooseField('end')}>{prettyDate(previewEnd, 'Choose')}</button></div><small>{rangeHint}</small></div>
        </div>
      )}
    </div>
  );
}
