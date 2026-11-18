import { useState, useEffect, useCallback, useMemo } from "react";
import { Programacao } from "../types";
import { parseISO, isValid, differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type AlertSeverity = "critical" | "warning" | "info";

export interface AppAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  frota?: string;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = "bp-notifications-read";

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function useNotifications(schedules: Programacao[]) {
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);
  const [browserPermission, setBrowserPermission] =
    useState<NotificationPermission>("default");
  const [lastNotifiedIds, setLastNotifiedIds] = useState<Set<string>>(
    new Set(),
  );

  // Verificar permissão do browser
  useEffect(() => {
    if ("Notification" in window) {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setBrowserPermission(perm);
  }, []);

  // Gerar alertas baseados nos dados
  const alerts = useMemo((): AppAlert[] => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const result: AppAlert[] = [];

    // ═══════════════════════════════════════════════════════════════════════
    // ALERTAS DE LAVAGEM E LUBRIFICAÇÃO
    // ═══════════════════════════════════════════════════════════════════════

    // Agrupar atrasados por grupo de data
    const atrasados = schedules.filter((s) => s.situacao === "ATRASADO");
    const programadosHoje = schedules.filter((s) => {
      if (s.situacao !== "PROGRAMADO" && s.situacao !== "PENDENTE")
        return false;
      if (!s.dataProgramada) return false;
      try {
        const d = parseISO(s.dataProgramada);
        return isValid(d) && differenceInDays(d, now) === 0;
      } catch {
        return false;
      }
    });
    const vencendo24h = schedules.filter((s) => {
      if (s.situacao !== "PROGRAMADO" && s.situacao !== "PENDENTE")
        return false;
      if (!s.dataProgramada) return false;
      try {
        const d = parseISO(s.dataProgramada);
        const diff = differenceInDays(d, now);
        return isValid(d) && diff === 1;
      } catch {
        return false;
      }
    });

    // Alerta crítico: frotas atrasadas
    if (atrasados.length > 0) {
      const frotas = atrasados
        .slice(0, 5)
        .map((s) => `Frota ${s.frota}`)
        .join(", ");
      const extra =
        atrasados.length > 5 ? ` e mais ${atrasados.length - 5}` : "";
      result.push({
        id: `atrasados-${atrasados.length}-${atrasados.map((s) => s.id).join("")}`,
        severity: "critical",
        title: `⚠️ ${atrasados.length} frota${atrasados.length > 1 ? "s" : ""} em atraso`,
        message: `${frotas}${extra} precisam de atenção imediata.`,
        timestamp: Date.now(),
        read: false,
      });
    }

    // Alerta para cada frota atrasada individualmente (máx 5)
    atrasados.slice(0, 5).forEach((s) => {
      const diasAtraso = s.dataProgramada
        ? (() => {
            try {
              const d = parseISO(s.dataProgramada);
              return isValid(d) ? Math.abs(differenceInDays(now, d)) : 0;
            } catch {
              return 0;
            }
          })()
        : 0;

      result.push({
        id: `atraso-${s.id}`,
        severity: "critical",
        title: `Frota ${s.frota} — ATRASADA`,
        message: `${s.tipoPreventiva} em ${s.descricaoPonto}${diasAtraso > 0 ? ` · ${diasAtraso} dia${diasAtraso > 1 ? "s" : ""} em atraso` : ""}${s.observacao ? ` · ${s.observacao}` : ""}`,
        frota: s.frota,
        timestamp: Date.now() - 1000,
        read: false,
      });
    });

    // Alerta: programados para hoje
    if (programadosHoje.length > 0) {
      result.push({
        id: `hoje-${programadosHoje.map((s) => s.id).join("")}`,
        severity: "warning",
        title: `📅 ${programadosHoje.length} serviço${programadosHoje.length > 1 ? "s" : ""} programado${programadosHoje.length > 1 ? "s" : ""} para hoje`,
        message:
          programadosHoje
            .slice(0, 4)
            .map((s) => `Frota ${s.frota} às ${s.horarioAgendado || "—"}`)
            .join(" · ") +
          (programadosHoje.length > 4
            ? ` e mais ${programadosHoje.length - 4}`
            : ""),
        timestamp: Date.now() - 2000,
        read: false,
      });
    }

    // Alerta: vencendo amanhã
    if (vencendo24h.length > 0) {
      result.push({
        id: `amanha-${vencendo24h.map((s) => s.id).join("")}`,
        severity: "info",
        title: `🔔 ${vencendo24h.length} serviço${vencendo24h.length > 1 ? "s" : ""} programado${vencendo24h.length > 1 ? "s" : ""} para amanhã`,
        message:
          vencendo24h
            .slice(0, 4)
            .map((s) => `Frota ${s.frota} às ${s.horarioAgendado || "—"}`)
            .join(" · ") +
          (vencendo24h.length > 4 ? ` e mais ${vencendo24h.length - 4}` : ""),
        timestamp: Date.now() - 3000,
        read: false,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ALERTAS DE PREVENTIVA MECÂNICA DE CARRETAS
    // ═══════════════════════════════════════════════════════════════════════

    // Marcar como lidas as que já foram lidas
    return result.map((a) => ({ ...a, read: readIds.has(a.id) }));
  }, [schedules, readIds]);

  const unreadCount = useMemo(
    () => alerts.filter((a) => !a.read).length,
    [alerts],
  );

  // Disparar notificações do browser para alertas críticos novos
  useEffect(() => {
    if (browserPermission !== "granted") return;
    const criticals = alerts.filter(
      (a) => a.severity === "critical" && !a.read && !lastNotifiedIds.has(a.id),
    );
    if (criticals.length === 0) return;

    criticals.forEach((alert) => {
      try {
        new Notification(alert.title, {
          body: alert.message,
          icon: "/logo.png",
          tag: alert.id,
          requireInteraction: false,
        });
      } catch {}
    });

    setLastNotifiedIds((prev) => {
      const next = new Set(prev);
      criticals.forEach((a) => next.add(a.id));
      return next;
    });
  }, [alerts, browserPermission, lastNotifiedIds]);

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      alerts.forEach((a) => next.add(a.id));
      saveReadIds(next);
      return next;
    });
  }, [alerts]);

  const clearAll = useCallback(() => {
    const allIds = new Set(alerts.map((a) => a.id));
    saveReadIds(allIds);
    setReadIds(allIds);
  }, [alerts]);

  return {
    alerts,
    unreadCount,
    browserPermission,
    requestPermission,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
