import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | number) {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function getComplianceColor(rate: number) {
  if (rate >= 90) return 'text-emerald-600';
  if (rate >= 80) return 'text-amber-600';
  return 'text-rose-600';
}

export function mapLegacyUnit(unitName: string | undefined): string {
  if (!unitName) return '';
  const u = unitName.toUpperCase().trim();
  if (u === 'ICU 1' || u === 'ICU 2') return 'ICU';
  if (u === 'DR' || u === 'DELIVERY ROOM') return 'Delivery Room';
  return unitName;
}

export function mapLegacyData(data: any): any {
  if (!data) return data;
  if (data.unit) data.unit = mapLegacyUnit(data.unit);
  if (data.wardUnitBed) data.wardUnitBed = mapLegacyUnit(data.wardUnitBed);
  if (data.roomWard) data.roomWard = mapLegacyUnit(data.roomWard);
  return data;
}
