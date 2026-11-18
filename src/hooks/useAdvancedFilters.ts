import { useMemo } from 'react';
import { Programacao } from '../types';
import { parseISO, isValid, isAfter, isBefore, isSameDay } from 'date-fns';
import type { FilterState } from '../components/FilterPanel';

export function useAdvancedFilters(schedules: Programacao[], filters: FilterState) {
  return useMemo(() => {
    return schedules.filter((s) => {
      if (filters.statuses.length > 0 && !filters.statuses.includes(s.situacao as any)) {
        return false;
      }

      if (filters.mode === 'periodo') {
        if (filters.dataInicio || filters.dataFim) {
          if (!s.dataProgramada) return false;

          try {
            const dataSchedule = parseISO(s.dataProgramada);
            if (!isValid(dataSchedule)) return false;

            if (filters.dataInicio) {
              const dataInicio = parseISO(filters.dataInicio);
              if (isValid(dataInicio) && isBefore(dataSchedule, dataInicio) && !isSameDay(dataSchedule, dataInicio)) {
                return false;
              }
            }

            if (filters.dataFim) {
              const dataFim = parseISO(filters.dataFim);
              if (isValid(dataFim) && isAfter(dataSchedule, dataFim) && !isSameDay(dataSchedule, dataFim)) {
                return false;
              }
            }
          } catch {
            return false;
          }
        }
      } else if (filters.mode === 'mes-a-mes') {
        if (!s.dataProgramada) return false;

        try {
          const dataSchedule = parseISO(s.dataProgramada);
          if (!isValid(dataSchedule)) return false;

          const mesSchedule = String(dataSchedule.getMonth() + 1).padStart(2, '0');
          const mesInicio = filters.mesInicio;
          const mesFim = filters.mesFim;

          if (mesInicio <= mesFim) {
            if (mesSchedule < mesInicio || mesSchedule > mesFim) {
              return false;
            }
          } else {
            if (mesSchedule < mesInicio && mesSchedule > mesFim) {
              return false;
            }
          }
        } catch {
          return false;
        }
      }

      return true;
    });
  }, [schedules, filters]);
}
