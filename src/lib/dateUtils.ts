export function safeFormatDate(dateValue: any, formatType: 'date' | 'time' | 'datetime' = 'date', fallback = 'N/A'): string {
  if (!dateValue) return fallback;
  
  if (typeof dateValue?.toDate === 'function') {
    const rawDate = dateValue.toDate();
    if (formatType === 'date') return rawDate.toLocaleDateString();
    if (formatType === 'time') return rawDate.toLocaleTimeString();
    return rawDate.toLocaleString();
  }
  
  const parsed = new Date(dateValue);
  if (isNaN(parsed.getTime())) return fallback;
  
  if (formatType === 'date') return parsed.toLocaleDateString();
  if (formatType === 'time') return parsed.toLocaleTimeString();
  return parsed.toLocaleString();
}

export function safeISOString(dateValue: any, fallback = ''): string {
  if (!dateValue) return fallback;
  if (typeof dateValue?.toDate === 'function') {
    return dateValue.toDate().toISOString();
  }
  const parsed = new Date(dateValue);
  if (isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}
