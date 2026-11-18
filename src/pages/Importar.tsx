import React, { useState, useCallback, useRef } from 'react';
import { Programacao } from '../types';
import { parseScheduleText, parseScheduleExcel } from '../lib/pdfParser';
import { Upload, FileText, Table, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  onImport: (items: Programacao[]) => void;
}

type Step = 'upload' | 'preview' | 'done';

export default function Importar({ onImport }: Props) {
  const { isDark } = useTheme();
  const [step, setStep] = useState<Step>('upload');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Programacao[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  // ─── Flag robusta contra duplo clique ──────────────────────────────────────
  const [importing, setImporting] = useState(false);
  const importingRef = useRef(false);

  const processFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      let rows: Programacao[] = [];

      if (file.name.toLowerCase().endsWith('.pdf')) {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const items = textContent.items as Array<{ str: string; transform: number[]; width: number }>;
          const lineMap = new Map<number, Array<{ x: number; str: string; width: number }>>();
          for (const item of items) {
            if (!item.str) continue;
            const y = Math.round(item.transform[5]!);
            const x = Math.round(item.transform[4]!);
            if (!lineMap.has(y)) lineMap.set(y, []);
            lineMap.get(y)!.push({ x, str: item.str, width: item.width || 0 });
          }
          const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
          for (const y of sortedYs) {
            const lineItems = lineMap.get(y)!.sort((a, b) => a.x - b.x);
            let lineStr = '';
            let prevEndX = 0;
            for (const item of lineItems) {
              if (prevEndX === 0) {
                lineStr += ' '.repeat(Math.max(0, Math.round(item.x / 5)));
              } else {
                const gap = item.x - prevEndX;
                if (gap > 8) lineStr += ' '.repeat(Math.max(1, Math.round(gap / 5)));
              }
              lineStr += item.str;
              prevEndX = item.x + (item.width || 0);
            }
            fullText += lineStr.trim() + '\n';
          }
          fullText += '\n';
        }
        rows = parseScheduleText(fullText);
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error('Arquivo Excel sem abas');
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) throw new Error('Aba não encontrada');
        const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: null,
          raw: false,
          dateNF: 'HH:MM:SS',
        }) as unknown[][];
        rows = parseScheduleExcel(rawRows);
      }

      if (rows.length === 0) {
        setError('Nenhum registro encontrado no arquivo. Verifique se é o formato correto.');
        setLoading(false);
        return;
      }

      setPreview(rows);
      setSelected(new Set(rows.map(r => r.id)));
      setStep('preview');
    } catch (err: any) {
      setError(`Erro ao processar arquivo: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ─── Importação robusta com proteção contra duplo clique ───────────────────
  const handleConfirmImport = useCallback(async () => {
    // Dupla proteção: state + ref (ref é síncrono, previne race condition)
    if (importingRef.current) return;
    importingRef.current = true;
    setImporting(true);

    try {
      const toImport = preview.filter(r => selected.has(r.id));
      if (toImport.length === 0) {
        importingRef.current = false;
        setImporting(false);
        return;
      }
      setImportedCount(toImport.length);
      await onImport(toImport);
      // Limpar preview e selected para evitar reimportação
      setPreview([]);
      setSelected(new Set());
      setStep('done');
    } catch (err) {
      console.error('Erro na importação:', err);
    } finally {
      importingRef.current = false;
      setImporting(false);
    }
  }, [preview, selected, onImport]);

  const reset = useCallback(() => {
    setStep('upload');
    setPreview([]);
    setSelected(new Set());
    setError(null);
    setFileName('');
    setImportedCount(0);
    setImporting(false);
    importingRef.current = false;
  }, []);

  const stats = {
    lavagem: preview.filter(r => r.tipoPreventiva.toLowerCase().includes('lavagem')).length,
    lubrificacao: preview.filter(r => r.tipoPreventiva.toLowerCase().includes('lub')).length,
    trocaOleo: preview.filter(r => r.tipoPreventiva.toLowerCase().includes('troca') || r.tipoPreventiva.toLowerCase().includes('óleo')).length,
  };

  const uniqueDates = [...new Set(preview.map(r => r.dataProgramada))].sort();

  // ── CSS helpers ──────────────────────────────────────────────────────────────
  const card = isDark
    ? 'glass-card rounded-xl shadow-lg'
    : 'bg-white border border-gray-200 rounded-xl shadow-sm';

  const text = isDark ? 'text-[var(--text-primary)]' : 'text-gray-900';
  const textMuted = isDark ? 'text-[var(--text-muted)]' : 'text-gray-500';
  const textSm = isDark ? 'text-[var(--text-secondary)]' : 'text-gray-700';
  const divider = isDark ? 'border-white/10' : 'border-gray-100';
  const tableHead = isDark ? 'bg-[var(--bg-tertiary)]' : 'bg-gray-50';
  const tableRow = isDark ? 'hover:bg-white/5 divide-y divide-white/5' : 'hover:bg-gray-50 divide-y divide-gray-100';

  return (
    <div className="space-y-4 fade-in max-w-4xl">
      {/* Título */}
      <div>
        <h2 className={`text-xl font-bold ${text}`}>Importar Agendamento</h2>
        <p className={`text-sm ${textMuted}`}>Importe o PDF ou Excel do agendamento semanal do lavador</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-xs">
        {(['upload', 'preview', 'done'] as Step[]).map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors ${
              step === s
                ? isDark
                  ? 'bg-[var(--brand-green)] text-[var(--text-inverse)] font-bold'
                  : 'bg-green-600 text-white'
                : step === 'done' && i < 2
                  ? isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'
                  : isDark ? 'bg-white/10 text-[var(--text-muted)]' : 'bg-gray-100 text-gray-500'
            }`}>
              <span>{i + 1}</span>
              <span className="capitalize">{s === 'upload' ? 'Upload' : s === 'preview' ? 'Revisar' : 'Concluído'}</span>
            </div>
            {i < 2 && <div className={`flex-1 h-px ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* ── Step: Upload ── */}
      {step === 'upload' && (
        <div className="space-y-4">
          {/* Info box */}
          <div className={`rounded-xl p-4 text-sm ${
            isDark
              ? 'bg-blue-950/40 border border-blue-500/30 text-blue-300'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            <p className="font-semibold mb-1">Como funciona a importação:</p>
            <ul className="space-y-1 text-xs">
              <li>Aceita o PDF <strong>"Agendamento Semanal - Lavador e Lubrificação"</strong></li>
              <li>Extrai automaticamente: <strong>Frota</strong> e <strong>Horário Agendado</strong> por dia</li>
              <li>Ignora automaticamente linhas de <strong>REFEIÇÃO</strong></li>
              <li>Detecta tipo: serviços com "Lub" = Lubrificação, demais = Lavagem</li>
              <li>Também aceita Excel (.xlsx) e CSV com o mesmo formato</li>
            </ul>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer
              ${dragging
                ? isDark ? 'border-green-400 bg-green-900/20' : 'border-green-500 bg-green-50'
                : isDark
                  ? 'border-white/20 bg-white/5 hover:border-green-400/60 hover:bg-green-900/10'
                  : 'border-gray-300 bg-gray-50 hover:border-green-400 hover:bg-green-50/50'
              }
            `}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <input id="fileInput" type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />
            {loading ? (
              <div>
                <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className={`text-sm ${textMuted}`}>Processando arquivo...</p>
              </div>
            ) : (
              <div>
                <Upload size={40} className={`mx-auto mb-3 ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-400'}`} />
                <p className={`text-base font-medium ${textSm}`}>Arraste o arquivo aqui ou clique para selecionar</p>
                <p className={`text-sm mt-1 ${textMuted}`}>PDF, Excel (.xlsx) ou CSV</p>
                <div className="flex justify-center gap-4 mt-4">
                  <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${
                    isDark ? 'text-[var(--text-muted)] bg-white/5 border-white/10' : 'text-gray-500 bg-white border-gray-200'
                  }`}>
                    <FileText size={14} className="text-red-400" /> PDF
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${
                    isDark ? 'text-[var(--text-muted)] bg-white/5 border-white/10' : 'text-gray-500 bg-white border-gray-200'
                  }`}>
                    <Table size={14} className="text-green-500" /> Excel
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${
              isDark
                ? 'bg-red-950/40 border border-red-500/30 text-red-300'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <div>{error}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Step: Preview ── */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className={card + ' p-4'}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className={`font-semibold ${text}`}>
                  Arquivo: <span className="text-green-500">{fileName}</span>
                </p>
                <p className={`text-sm ${textMuted}`}>
                  {preview.length} registros encontrados {uniqueDates.length > 0 && `\u00b7 ${uniqueDates.length} dias`}
                </p>
              </div>
              <button
                onClick={reset}
                disabled={importing}
                className={`transition-colors disabled:opacity-50 ${isDark ? 'text-[var(--text-muted)] hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className={`rounded-lg p-2 ${isDark ? 'bg-blue-900/30 border border-blue-500/20' : 'bg-blue-50'}`}>
                <div className={`text-lg font-bold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{stats.lavagem}</div>
                <div className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Lavagem</div>
              </div>
              <div className={`rounded-lg p-2 ${isDark ? 'bg-amber-900/30 border border-amber-500/20' : 'bg-amber-50'}`}>
                <div className={`text-lg font-bold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{stats.lubrificacao}</div>
                <div className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>Lubrificação</div>
              </div>
              <div className={`rounded-lg p-2 ${isDark ? 'bg-orange-900/30 border border-orange-500/20' : 'bg-orange-50'}`}>
                <div className={`text-lg font-bold ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>{stats.trocaOleo}</div>
                <div className={`text-xs ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>Troca de Óleo</div>
              </div>
            </div>
          </div>

          {/* Dias */}
          <div className="flex flex-wrap gap-2">
            {uniqueDates.map(d => (
              <span key={d} className={`text-xs px-2 py-1 rounded-full ${
                isDark ? 'bg-white/10 text-[var(--text-secondary)]' : 'bg-gray-100 text-gray-600'
              }`}>{d}</span>
            ))}
          </div>

          {/* Table preview */}
          <div className={card + ' overflow-hidden'}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${divider} ${tableHead}`}>
              <span className={`text-sm font-medium ${textSm}`}>{selected.size} de {preview.length} selecionados</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(new Set(preview.map(r => r.id)))}
                  disabled={importing}
                  className="text-xs text-green-500 hover:text-green-400 disabled:opacity-50"
                >
                  Selecionar todos
                </button>
                <span className={isDark ? 'text-white/20' : 'text-gray-300'}>|</span>
                <button
                  onClick={() => setSelected(new Set())}
                  disabled={importing}
                  className={`text-xs disabled:opacity-50 ${isDark ? 'text-[var(--text-muted)] hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Desmarcar todos
                </button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs">
                <thead className={`${tableHead} sticky top-0`}>
                  <tr>
                    <th className="px-3 py-2 text-left w-8"></th>
                    <th className={`px-3 py-2 text-left font-semibold ${isDark ? 'text-[var(--brand-green)]' : 'text-gray-600'}`}>Data</th>
                    <th className={`px-3 py-2 text-left font-semibold ${isDark ? 'text-[var(--brand-green)]' : 'text-gray-600'}`}>Horário</th>
                    <th className={`px-3 py-2 text-left font-semibold ${isDark ? 'text-[var(--brand-green)]' : 'text-gray-600'}`}>Frota</th>
                    <th className={`px-3 py-2 text-left font-semibold ${isDark ? 'text-[var(--brand-green)]' : 'text-gray-600'}`}>Tipo</th>
                    <th className={`px-3 py-2 text-left font-semibold ${isDark ? 'text-[var(--brand-green)]' : 'text-gray-600'}`}>Observação</th>
                  </tr>
                </thead>
                <tbody className={tableRow}>
                  {preview.map(r => (
                    <tr
                      key={r.id}
                      className={`transition-opacity ${!selected.has(r.id) ? 'opacity-30' : ''} ${
                        isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          disabled={importing}
                          className="rounded accent-green-500"
                        />
                      </td>
                      <td className={`px-3 py-2 ${textSm}`}>{r.dataProgramada}</td>
                      <td className={`px-3 py-2 ${textMuted}`}>{r.horarioAgendado}</td>
                      <td className={`px-3 py-2 font-semibold ${text}`}>{r.frota}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          r.tipoPreventiva.includes('Lub')
                            ? isDark ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700'
                            : isDark ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {r.tipoPreventiva}
                        </span>
                      </td>
                      <td className={`px-3 py-2 max-w-[200px] truncate ${textMuted}`}>{r.observacao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={reset}
              disabled={importing}
              className={`px-4 py-2 rounded-lg text-sm border transition-colors disabled:opacity-50 ${
                isDark
                  ? 'border-white/20 text-[var(--text-secondary)] hover:bg-white/10'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={selected.size === 0 || importing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Importando...
                </>
              ) : (
                `Importar ${selected.size} Registros`
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Done ── */}
      {step === 'done' && (
        <div className="text-center py-12">
          <CheckCircle2 size={56} className="mx-auto text-green-500 mb-4" />
          <h3 className={`text-xl font-bold mb-2 ${text}`}>Importação Concluída!</h3>
          <p className={`mb-6 ${textMuted}`}>{importedCount} programações foram adicionadas com sucesso.</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={reset}
              className={`px-6 py-2 rounded-lg text-sm border transition-colors ${
                isDark
                  ? 'border-white/20 text-[var(--text-secondary)] hover:bg-white/10'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              Importar outro arquivo
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'programacoes' }))}
              className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Ver Programações
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
