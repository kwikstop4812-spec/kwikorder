import { WEEKDAYS } from './schemaMap';
import type { DeliverySchedule, SupplierConfig, SupplierConfigMap } from './types';

export function defaultSchedule(): DeliverySchedule {
  return {
    cutOffDay: 'Friday',
    cutOffTime: '10:00',
    deliveryDay: 'Monday',
  };
}

export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].padStart(2, '0');
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}

export function formatSchedule(s: DeliverySchedule): string {
  if (!s) return 'Default Schedule';
  return `Cut-off: ${s.cutOffDay} ${formatTime(s.cutOffTime)} → Delivery: ${s.deliveryDay}`;
}

export function getCoverageDays(cutOffDay: string, deliveryDay: string): string[] {
  const daysList = [...WEEKDAYS];
  const startIdx = daysList.indexOf(cutOffDay as any);
  const endIdx = daysList.indexOf(deliveryDay as any);

  if (startIdx === -1 || endIdx === -1) {
    return daysList;
  }

  const result: string[] = [];
  let curr = startIdx;

  while (true) {
    result.push(daysList[curr]);
    if (curr === endIdx) break;
    curr = (curr + 1) % daysList.length;
    if (result.length > 7) break; // prevent infinite loop
  }

  return result;
}

export function normalizeSupplierConfig(raw: any): SupplierConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      schedules: [defaultSchedule()],
      safetyMultiplier: 1.2,
    };
  }

  let schedules: DeliverySchedule[] = [];
  if (Array.isArray(raw.schedules) && raw.schedules.length > 0) {
    schedules = raw.schedules.map((s: any) => ({
      cutOffDay: s.cutOffDay || 'Friday',
      cutOffTime: s.cutOffTime || '10:00',
      deliveryDay: s.deliveryDay || 'Monday',
    }));
  } else if (raw.cutOffDay && raw.deliveryDay) {
    schedules = [
      {
        cutOffDay: raw.cutOffDay,
        cutOffTime: raw.cutOffTime || '10:00',
        deliveryDay: raw.deliveryDay,
      },
    ];
  } else {
    schedules = [defaultSchedule()];
  }

  const safetyMultiplier =
    typeof raw.safetyMultiplier === 'number' && raw.safetyMultiplier >= 1
      ? raw.safetyMultiplier
      : typeof raw.safetyBufferPct === 'number'
      ? 1 + raw.safetyBufferPct / 100
      : 1.2;

  return {
    schedules,
    safetyMultiplier,
  };
}

export function normalizeSupplierConfigMap(raw: any): SupplierConfigMap {
  if (!raw || typeof raw !== 'object') return {};
  const result: SupplierConfigMap = {};
  for (const key of Object.keys(raw)) {
    result[key] = normalizeSupplierConfig(raw[key]);
  }
  return result;
}

export function pickNextScheduleIndex(schedules: DeliverySchedule[]): number {
  if (!schedules || schedules.length === 0) return 0;
  if (schedules.length === 1) return 0;

  const today = new Date();
  const dayNames = [...WEEKDAYS];
  const currentDayName = dayNames[today.getDay() === 0 ? 6 : today.getDay() - 1];

  for (let i = 0; i < schedules.length; i++) {
    if (schedules[i].cutOffDay === currentDayName) {
      return i;
    }
  }

  return 0;
}
