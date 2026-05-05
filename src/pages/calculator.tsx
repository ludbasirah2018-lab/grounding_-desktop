import { useState, useEffect } from "react";
import { useCalculateGrounding, useGetSoilTypes } from "@workspace/api-client-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Calculator, FileDown, RotateCcw, Zap, AlertTriangle, CheckCircle, Info,
  Table2, BookOpen, Minus, Maximize2, X, Database, History, ChevronUp,
  ChevronDown, Trash2, ArrowDownToLine, GitCompare, Languages,
} from "lucide-react";
import { generatePdfReport, type ProjectInfo } from "@/lib/pdfReport";
import { translations, type Lang } from "@/lib/i18n";

type InstallationCategory = "substation" | "lightning_protection" | "general" | "telecom";

interface FormValues {
  soilResistivity: number;
  rodLength: number;
  rodDiameter: number;
  numberOfRods: number;
  rodSpacing: number;
  installationCategory: InstallationCategory;
}

interface GroundingResult {
  singleRodResistance: number;
  mutualResistance: number;
  totalResistance: number;
  efficiencyFactor: number;
  minimumRodsRequired: number;
  idealSpacing: number;
  status: "PASS" | "FAIL" | "WARNING";
  standardLimit: number;
  standardName: string;
  rodCurve: Array<{ rods: number; resistance: number; efficiencyFactor: number }>;
  recommendations: Array<{ type: string; message: string }>;
  soilCategory: string;
  formulaDetails: {
    dwightFormula: string;
    mutualFormula: string;
    parallelFormula: string;
    variables: Record<string, string>;
  };
}

interface HistoryEntry {
  id: string;
  timestamp: Date;
  inputs: FormValues;
  result: GroundingResult;
}

interface ProjectFormValues extends ProjectInfo {}

const DEFAULT_FORM: FormValues = {
  soilResistivity: 100,
  rodLength: 3,
  rodDiameter: 0.016,
  numberOfRods: 2,
  rodSpacing: 6,
  installationCategory: "general",
};

const MAX_HISTORY = 20;

function formatTime(d: Date) {
  return new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function CalculatorPage() {
  const { data: soilTypes } = useGetSoilTypes();
  const calculateGrounding = useCalculateGrounding();

  const [lang, setLang] = useState<Lang>("id");
  const t = translations[lang];

  const [form, setForm] = useState<FormValues>(DEFAULT_FORM);
  const [activeTab, setActiveTab] = useState<"results" | "chart" | "trace">("results");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelected, setCompareSelected] = useState<string[]>([]);
  const [projectInfo, setProjectInfo] = useState<ProjectFormValues>({
    projectName: "", projectNumber: "", engineerName: "",
    clientName: "", location: "", date: new Date().toLocaleDateString("id-ID"), notes: "",
  });

  const result = calculateGrounding.data;
  const isLoading = calculateGrounding.isPending;

  const CATEGORY_LABELS: Record<InstallationCategory, string> = {
    substation: t.catSubstation,
    lightning_protection: t.catLightning,
    general: t.catGeneral,
    telecom: t.catTelecom,
  };
  const CATEGORY_SHORT: Record<InstallationCategory, string> = {
    substation: t.catSubstationShort,
    lightning_protection: t.catLightningShort,
    general: t.catGeneralShort,
    telecom: t.catTelecomShort,
  };

  useEffect(() => {
    if (!result) return;
    const entry: HistoryEntry = {
      id: `calc-${Date.now()}`,
      timestamp: new Date(),
      inputs: { ...form },
      result: result as GroundingResult,
    };
    setHistory(prev => [entry, ...prev].slice(0, MAX_HISTORY));
    setActiveHistoryId(entry.id);
  }, [result]);

  function handleCalculate() {
    calculateGrounding.mutate({ data: form as Parameters<typeof calculateGrounding.mutate>[0]["data"] });
  }
  function handleReset() {
    setForm(DEFAULT_FORM);
    calculateGrounding.reset();
    setActiveHistoryId(null);
  }
  function handleSoilPreset(name: string) {
    const soil = soilTypes?.find(s => s.name === name);
    if (soil) setForm(f => ({ ...f, soilResistivity: soil.typicalResistivity }));
  }
  function handleLoadHistory(entry: HistoryEntry) {
    setForm(entry.inputs);
    calculateGrounding.mutate({ data: entry.inputs as Parameters<typeof calculateGrounding.mutate>[0]["data"] });
    setActiveHistoryId(entry.id);
  }
  function handleClearHistory() {
    setHistory([]); setActiveHistoryId(null); setCompareIds(null);
    setCompareMode(false); setCompareSelected([]);
  }
  function toggleCompareSelect(id: string) {
    setCompareSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id]);
  }
  function startCompare() {
    if (compareSelected.length === 2) {
      setCompareIds([compareSelected[0], compareSelected[1]]);
      setCompareMode(false); setCompareSelected([]);
    }
  }
  async function handleExport() {
    if (!result) return;
    setIsExporting(true);
    try { await generatePdfReport(projectInfo, form, result as GroundingResult); setShowExportDialog(false); }
    finally { setIsExporting(false); }
  }

  const statusBg = result?.status === "PASS" ? "pass" : result?.status === "WARNING" ? "warning" : "fail";
  const compareEntryA = compareIds ? history.find(h => h.id === compareIds[0]) : null;
  const compareEntryB = compareIds ? history.find(h => h.id === compareIds[1]) : null;

  const MENUS = [t.menuFile, t.menuView, t.menuTools, t.menuHelp];

  return (
    <div className="flex flex-col h-screen overflow-hidden select-none" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ── TITLE BAR ── */}
      <div className="win-titlebar flex items-center justify-between h-8 px-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm flex items-center justify-center bg-[#ea580c]">
            <Zap className="w-2.5 h-2.5 text-white" />
          </div>
          <span className="text-white text-xs font-semibold tracking-wide">{t.appTitle}</span>
        </div>
        <div className="flex items-center gap-0">
          {/* Language toggle */}
          <button
            className="flex items-center gap-1 mr-3 px-2 h-6 rounded-sm border border-white/20 hover:border-white/50 text-white/80 hover:text-white text-[10px] font-bold"
            onClick={() => setLang(l => l === "id" ? "en" : "id")}
            title="Switch language"
          >
            <Languages className="w-3 h-3" />
            {lang === "id" ? "EN" : "ID"}
          </button>
          <button className="w-10 h-8 flex items-center justify-center hover:bg-white/10 text-gray-300 hover:text-white"><Minus className="w-3 h-3" /></button>
          <button className="w-10 h-8 flex items-center justify-center hover:bg-white/10 text-gray-300 hover:text-white"><Maximize2 className="w-3 h-3" /></button>
          <button className="w-10 h-8 flex items-center justify-center hover:bg-red-600 text-gray-300 hover:text-white"><X className="w-3 h-3" /></button>
        </div>
      </div>

      {/* ── MENU BAR ── */}
      <div className="win-menubar flex items-center h-6 px-1 shrink-0 text-xs relative z-50">
        {MENUS.map((menu, mi) => (
          <div key={menu} className="relative">
            <button
              className={`px-3 h-6 hover:bg-[#316ac5] hover:text-white rounded-sm ${activeMenu === menu ? "bg-[#316ac5] text-white" : ""}`}
              onClick={() => setActiveMenu(activeMenu === menu ? null : menu)}
            >{menu}</button>
            {activeMenu === menu && (
              <div className="absolute top-6 left-0 bg-white border border-gray-400 shadow-lg min-w-[210px] z-50 py-1">
                {mi === 0 && <>
                  <MenuDivLabel label="Project" />
                  <MenuItem label={t.menuNewCalc} icon={<Calculator className="w-3 h-3" />} onClick={handleReset} />
                  <div className="h-px bg-gray-200 my-1 mx-2" />
                  <MenuItem label={t.menuExportPdf} icon={<FileDown className="w-3 h-3" />} onClick={() => { setShowExportDialog(true); setActiveMenu(null); }} disabled={!result} />
                  <div className="h-px bg-gray-200 my-1 mx-2" />
                  <MenuItem label={t.menuExit} icon={<X className="w-3 h-3" />} onClick={() => {}} />
                </>}
                {mi === 1 && <>
                  <MenuItem label={t.menuResults} icon={<Table2 className="w-3 h-3" />} onClick={() => { setActiveTab("results"); setActiveMenu(null); }} />
                  <MenuItem label={t.menuChart} icon={<Database className="w-3 h-3" />} onClick={() => { setActiveTab("chart"); setActiveMenu(null); }} />
                  <MenuItem label={t.menuTrace} icon={<BookOpen className="w-3 h-3" />} onClick={() => { setActiveTab("trace"); setActiveMenu(null); }} />
                  <div className="h-px bg-gray-200 my-1 mx-2" />
                  <MenuItem label={historyOpen ? t.menuHideHistory : t.menuShowHistory} icon={<History className="w-3 h-3" />} onClick={() => { setHistoryOpen(v => !v); setActiveMenu(null); }} />
                </>}
                {mi === 2 && <>
                  <MenuItem label={t.menuReset} icon={<RotateCcw className="w-3 h-3" />} onClick={() => { handleReset(); setActiveMenu(null); }} />
                  <div className="h-px bg-gray-200 my-1 mx-2" />
                  <MenuItem label={t.menuClearHistory} icon={<Trash2 className="w-3 h-3" />} onClick={() => { handleClearHistory(); setActiveMenu(null); }} disabled={history.length === 0} />
                </>}
                {mi === 3 && <>
                  <MenuItem label={t.menuAbout} icon={<Info className="w-3 h-3" />} onClick={() => { setShowAbout(true); setActiveMenu(null); }} />
                </>}
              </div>
            )}
          </div>
        ))}
        {activeMenu && <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />}
      </div>

      {/* ── TOOLBAR ── */}
      <div className="win-toolbar flex items-center h-[52px] px-2 gap-1 shrink-0">
        <button className="win-toolbar-btn" onClick={handleCalculate} disabled={isLoading}>
          <Calculator className="w-5 h-5 text-[#1a2035]" />
          <span>{isLoading ? t.tbRunning : t.tbCalculate}</span>
        </button>
        <button className={`win-toolbar-btn ${!result ? "disabled" : ""}`} onClick={() => result && setShowExportDialog(true)} disabled={!result}>
          <FileDown className="w-5 h-5 text-[#1a2035]" />
          <span>{t.tbExportPdf}</span>
        </button>
        <div className="win-toolbar-sep" />
        <button className="win-toolbar-btn" onClick={handleReset}>
          <RotateCcw className="w-5 h-5 text-[#1a2035]" />
          <span>{t.tbReset}</span>
        </button>
        <div className="win-toolbar-sep" />
        <button className={`win-toolbar-btn ${activeTab === "results" ? "border-[#90a8e0] bg-gradient-to-b from-[#e8f0ff] to-[#d0dcf8]" : ""}`} onClick={() => setActiveTab("results")}>
          <Table2 className="w-5 h-5 text-[#1a2035]" /><span>{t.tbResults}</span>
        </button>
        <button className={`win-toolbar-btn ${activeTab === "chart" ? "border-[#90a8e0] bg-gradient-to-b from-[#e8f0ff] to-[#d0dcf8]" : ""}`} onClick={() => setActiveTab("chart")}>
          <Database className="w-5 h-5 text-[#1a2035]" /><span>{t.tbChart}</span>
        </button>
        <button className={`win-toolbar-btn ${activeTab === "trace" ? "border-[#90a8e0] bg-gradient-to-b from-[#e8f0ff] to-[#d0dcf8]" : ""}`} onClick={() => setActiveTab("trace")}>
          <BookOpen className="w-5 h-5 text-[#1a2035]" /><span>{t.tbTrace}</span>
        </button>
        <div className="win-toolbar-sep" />
        <button className={`win-toolbar-btn relative ${historyOpen ? "border-[#90a8e0] bg-gradient-to-b from-[#e8f0ff] to-[#d0dcf8]" : ""}`} onClick={() => setHistoryOpen(v => !v)}>
          <History className="w-5 h-5 text-[#1a2035]" /><span>{t.tbHistory}</span>
          {history.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-[#ea580c] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{history.length}</span>
          )}
        </button>
        {compareIds && (
          <button className="win-toolbar-btn border-purple-400 bg-purple-50" onClick={() => setCompareIds(null)}>
            <GitCompare className="w-5 h-5 text-purple-700" /><span className="text-purple-700">{t.tbComparing}</span>
          </button>
        )}
        <div className="win-toolbar-sep" />
        {/* Inline language toggle in toolbar too */}
        <button
          className={`win-toolbar-btn gap-1 ${lang === "en" ? "border-[#90a8e0] bg-gradient-to-b from-[#e8f0ff] to-[#d0dcf8]" : ""}`}
          onClick={() => setLang(l => l === "id" ? "en" : "id")}
          title="Switch language / Ganti bahasa"
        >
          <Languages className="w-5 h-5 text-[#1a2035]" />
          <span className="font-bold">{lang === "id" ? "🇮🇩 ID" : "🇬🇧 EN"}</span>
        </button>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* LEFT PANEL */}
        <div className="win-panel w-72 shrink-0 flex flex-col overflow-y-auto">
          <div className="px-3 py-2 border-b border-[#b0b0b0] bg-[#e4e6ed]">
            <div className="text-xs font-bold text-[#1a2035] tracking-wide">{t.inputParameters}</div>
            <div className="text-[10px] text-gray-500">{t.inputSubtitle}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">

            <fieldset className="border border-[#b8bcc8] rounded-sm">
              <legend className="px-2 text-[10px] font-bold text-[#1a2035] tracking-wider bg-[#e8eaf0] border border-[#b8bcc8] rounded-sm mx-1">{t.groupEnv}</legend>
              <div className="p-2 space-y-2">
                <FieldRow label={t.labelSoilPreset}>
                  <select className="win-select" onChange={e => handleSoilPreset(e.target.value)} defaultValue="">
                    <option value="" disabled>{t.labelSoilPresetPlaceholder}</option>
                    {soilTypes?.map(s => (
                      <option key={s.name} value={s.name}>{s.name} ({s.typicalResistivity} Ω·m)</option>
                    ))}
                  </select>
                </FieldRow>
                <FieldRow label={t.labelResistivity}>
                  <input type="number" className="win-input" step="1" min="1"
                    value={form.soilResistivity}
                    onChange={e => setForm(f => ({ ...f, soilResistivity: parseFloat(e.target.value) || 0 }))} />
                </FieldRow>
                <FieldRow label={t.labelStandard}>
                  <select className="win-select" value={form.installationCategory}
                    onChange={e => setForm(f => ({ ...f, installationCategory: e.target.value as InstallationCategory }))}>
                    {(Object.entries(CATEGORY_LABELS) as [InstallationCategory, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </FieldRow>
              </div>
            </fieldset>

            <fieldset className="border border-[#b8bcc8] rounded-sm">
              <legend className="px-2 text-[10px] font-bold text-[#1a2035] tracking-wider bg-[#e8eaf0] border border-[#b8bcc8] rounded-sm mx-1">{t.groupGeo}</legend>
              <div className="p-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <FieldRow label={t.labelLength}>
                    <input type="number" className="win-input" step="0.1" min="0.1"
                      value={form.rodLength}
                      onChange={e => setForm(f => ({ ...f, rodLength: parseFloat(e.target.value) || 0 }))} />
                  </FieldRow>
                  <FieldRow label={t.labelDiameter}>
                    <input type="number" className="win-input" step="0.001" min="0.001"
                      value={form.rodDiameter}
                      onChange={e => setForm(f => ({ ...f, rodDiameter: parseFloat(e.target.value) || 0 }))} />
                  </FieldRow>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FieldRow label={t.labelRodCount}>
                    <input type="number" className="win-input" step="1" min="1"
                      value={form.numberOfRods}
                      onChange={e => setForm(f => ({ ...f, numberOfRods: parseInt(e.target.value) || 1 }))} />
                  </FieldRow>
                  <FieldRow label={t.labelSpacing}>
                    <input type="number" className="win-input" step="0.1" min="0.1"
                      value={form.rodSpacing}
                      onChange={e => setForm(f => ({ ...f, rodSpacing: parseFloat(e.target.value) || 0 }))} />
                  </FieldRow>
                </div>
              </div>
            </fieldset>

            <div className="flex gap-2">
              <button className="win-btn-primary flex-1 py-2 text-xs" onClick={handleCalculate} disabled={isLoading}>
                {isLoading ? t.btnCalculating : t.btnCalculate}
              </button>
              <button className="win-btn px-3 text-xs" onClick={handleReset} title={t.tbReset}>{t.btnReset}</button>
            </div>
          </div>
        </div>

        {/* RIGHT AREA */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white min-w-0">

          {/* Tab bar */}
          <div className="flex items-end border-b border-[#c0c0c0] bg-[#f0f0f0] px-2 pt-1 shrink-0">
            {([
              { key: "results", label: t.tabResults },
              { key: "chart", label: t.tabChart },
              { key: "trace", label: t.tabTrace },
            ] as const).map(tab => (
              <button key={tab.key}
                className={`px-4 py-1 text-xs border-l border-r border-t rounded-t-sm mr-1 cursor-pointer
                  ${activeTab === tab.key ? "bg-white border-[#c0c0c0] -mb-px font-semibold text-[#1a2035]" : "bg-[#d8d8d8] border-[#b0b0b0] text-gray-600 hover:bg-[#e8e8e8]"}`}
                onClick={() => setActiveTab(tab.key)}
              >{tab.label}</button>
            ))}
            {compareIds && compareEntryA && compareEntryB && (
              <div className="ml-auto flex items-center gap-2 text-[10px] pb-0.5">
                <span className="bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 rounded-sm font-semibold">
                  ⚖ {t.cmpTitle}: #{history.findIndex(h => h.id === compareIds[0]) + 1} vs #{history.findIndex(h => h.id === compareIds[1]) + 1}
                </span>
                <button className="win-btn text-[10px] px-2 py-0.5" onClick={() => setCompareIds(null)}>{t.cmpClose}</button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto min-h-0">
            {compareIds && compareEntryA && compareEntryB && (
              <CompareView entryA={compareEntryA} entryB={compareEntryB}
                historyIndex={(id: string) => history.findIndex(h => h.id === id) + 1} t={t} />
            )}
            {!compareIds && (
              <>
                {!result && !isLoading && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center space-y-3 text-gray-400">
                      <Zap className="w-16 h-16 mx-auto opacity-10" />
                      <div className="text-sm font-mono">{t.emptyTitle}</div>
                      <div className="text-xs">{t.emptySubtitle}</div>
                    </div>
                  </div>
                )}
                {isLoading && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center space-y-3 text-gray-400">
                      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
                      <div className="text-sm">{t.loadingText}</div>
                    </div>
                  </div>
                )}
                {result && !isLoading && (
                  <div className="p-4">

                    {/* RESULTS TAB */}
                    {activeTab === "results" && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 p-3 border border-[#c0c0c0] bg-[#f8f8f8] rounded-sm">
                          <div className={`metric-box ${statusBg} flex-1 text-center`}>
                            <div className="text-[10px] font-bold opacity-70 mb-1">{t.metricTotalR}</div>
                            <div className="text-2xl font-bold font-mono">{result.totalResistance.toFixed(3)}<span className="text-sm ml-1">Ω</span></div>
                            <div className="text-[10px] opacity-60 mt-1">{t.metricLimit}: {result.standardLimit} Ω — {result.standardName}</div>
                          </div>
                          <div className="metric-box flex-1 text-center">
                            <div className="text-[10px] font-bold opacity-70 mb-1">{t.metricSingleR}</div>
                            <div className="text-2xl font-bold font-mono">{result.singleRodResistance.toFixed(3)}<span className="text-sm ml-1">Ω</span></div>
                            <div className="text-[10px] opacity-60 mt-1">{t.metricDwight}</div>
                          </div>
                          <div className="metric-box flex-1 text-center">
                            <div className="text-[10px] font-bold opacity-70 mb-1">{t.metricEfficiency}</div>
                            <div className="text-2xl font-bold font-mono">{result.efficiencyFactor.toFixed(1)}<span className="text-sm ml-1">%</span></div>
                            <div className="text-[10px] opacity-60 mt-1">{t.metricInteraction}</div>
                          </div>
                          <div className="metric-box flex-1 text-center">
                            <div className="text-[10px] font-bold opacity-70 mb-1">{t.metricMinRods}</div>
                            <div className="text-2xl font-bold font-mono">{result.minimumRodsRequired}</div>
                            <div className="text-[10px] opacity-60 mt-1">{t.metricForStandard}</div>
                          </div>
                        </div>

                        <div className="border border-[#c0c0c0]">
                          <table className="result-table w-full">
                            <thead><tr>
                              <th style={{ width: 200 }}>{t.tblParamHeader}</th>
                              <th>{t.tblValueHeader}</th>
                              <th>{t.tblNoteHeader}</th>
                            </tr></thead>
                            <tbody>
                              <tr><td className="font-semibold">{t.rowR1}</td><td className="font-mono">{result.singleRodResistance.toFixed(4)} Ω</td><td className="text-gray-500 italic">{t.noteR1}</td></tr>
                              <tr><td className="font-semibold">{t.rowRm}</td><td className="font-mono">{result.mutualResistance.toFixed(4)} Ω</td><td className="text-gray-500 italic">{t.noteRm}</td></tr>
                              <tr><td className="font-semibold">{t.rowRn}</td><td className="font-mono">{result.totalResistance.toFixed(4)} Ω</td><td className="text-gray-500 italic">{form.numberOfRods} {t.noteRn}</td></tr>
                              <tr><td className="font-semibold">{t.rowEta}</td><td className="font-mono">{result.efficiencyFactor.toFixed(2)} %</td><td className="text-gray-500 italic">{t.noteEta}</td></tr>
                              <tr><td className="font-semibold">{t.rowSpacing}</td><td className="font-mono">{result.idealSpacing.toFixed(1)} m</td><td className="text-gray-500 italic">{t.noteSpacing}</td></tr>
                              <tr><td className="font-semibold">{t.rowStandard}</td><td className="font-mono">{result.standardName}</td><td className="text-gray-500 italic">{t.noteLimit}: {result.standardLimit} Ω</td></tr>
                              <tr>
                                <td className="font-semibold">{t.rowStatus}</td>
                                <td><StatusBadge status={result.status} /></td>
                                <td className="text-gray-500 italic">{result.status === "PASS" ? t.noteStatus : t.noteStatusFail}</td>
                              </tr>
                              <tr><td className="font-semibold">{t.rowSoil}</td><td className="font-mono">{result.soilCategory}</td><td className="text-gray-500 italic">{t.noteSoil}</td></tr>
                            </tbody>
                          </table>
                        </div>

                        <div className="border border-[#c0c0c0]">
                          <div className="bg-[#1a2035] text-white text-xs font-bold px-3 py-2">{t.diagHeader}</div>
                          <div className="p-2 space-y-1.5">
                            {result.recommendations.map((rec, i) => (
                              <div key={i} className={`rec-item ${rec.type}`}>
                                {rec.type === "critical" || rec.type === "warning" ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> :
                                  rec.type === "success" ? <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                                <span>{rec.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button className="win-btn-primary text-xs" onClick={() => setShowExportDialog(true)}>{t.btnExportPdf}</button>
                        </div>
                      </div>
                    )}

                    {/* CHART TAB */}
                    {activeTab === "chart" && (
                      <div className="space-y-4">
                        <div className="border border-[#c0c0c0]">
                          <div className="bg-[#1a2035] text-white text-xs font-bold px-3 py-2">{t.chartTitle}</div>
                          <div className="p-4" style={{ height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={result.rodCurve} margin={{ top: 16, right: 24, left: 16, bottom: 24 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                                <XAxis dataKey="rods" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#c0c0c0" }}
                                  label={{ value: t.chartXLabel, position: "insideBottom", offset: -12, fontSize: 11, fill: "#666" }} />
                                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#c0c0c0" }} tickFormatter={v => `${v}Ω`} />
                                <RechartsTooltip contentStyle={{ background: "#fff", border: "1px solid #c0c0c0", borderRadius: 2, fontFamily: "monospace", fontSize: 11 }}
                                  formatter={(v: number) => [`${v.toFixed(3)} Ω`, t.rowRn]} labelFormatter={l => `${l} Rod`} />
                                <ReferenceLine y={result.standardLimit} stroke="#dc2626" strokeDasharray="4 4"
                                  label={{ value: `LIMIT ${result.standardLimit}Ω`, position: "insideTopRight", fontSize: 10, fill: "#dc2626" }} />
                                <Line type="monotone" dataKey="resistance" stroke="#ea580c" strokeWidth={2.5}
                                  dot={{ fill: "#ea580c", r: 4 }} activeDot={{ r: 6 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className="border border-[#c0c0c0]">
                          <div className="bg-[#1a2035] text-white text-xs font-bold px-3 py-2">{t.chartTableTitle}</div>
                          <table className="result-table w-full">
                            <thead><tr>
                              <th>{t.chartColRod}</th><th>{t.chartColR}</th><th>{t.chartColEta}</th><th>{t.chartColStatus}</th>
                            </tr></thead>
                            <tbody>
                              {result.rodCurve.map(pt => (
                                <tr key={pt.rods}>
                                  <td className="font-mono text-center">{pt.rods}</td>
                                  <td className="font-mono">{pt.resistance.toFixed(4)} Ω</td>
                                  <td className="font-mono">{pt.efficiencyFactor.toFixed(1)} %</td>
                                  <td><StatusBadge status={pt.resistance <= result.standardLimit ? "PASS" : "FAIL"} small /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* TRACE TAB */}
                    {activeTab === "trace" && (
                      <div className="space-y-4">
                        <div className="border border-[#c0c0c0]">
                          <div className="bg-[#1a2035] text-white text-xs font-bold px-3 py-2">{t.traceHeader}</div>
                          <div className="p-3 space-y-3">
                            {[
                              { no: "1", title: t.traceStep1, formula: result.formulaDetails.dwightFormula },
                              { no: "2", title: t.traceStep2, formula: result.formulaDetails.mutualFormula },
                              { no: "3", title: t.traceStep3, formula: result.formulaDetails.parallelFormula },
                            ].map(f => (
                              <div key={f.no} className="bg-[#1a2035] rounded-sm overflow-hidden">
                                <div className="px-3 py-1.5 text-[10px] font-bold text-[#ea580c] tracking-wider">{f.no}. {f.title}</div>
                                <div className="px-3 pb-2.5 font-mono text-sm text-white">{f.formula}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="border border-[#c0c0c0]">
                          <div className="bg-[#1a2035] text-white text-xs font-bold px-3 py-2">{t.traceVarHeader}</div>
                          <table className="result-table w-full">
                            <thead><tr><th style={{ width: 60 }}>{t.traceVarSym}</th><th>{t.traceVarDef}</th></tr></thead>
                            <tbody>
                              {Object.entries(result.formulaDetails.variables).map(([k, v]) => (
                                <tr key={k}><td className="font-mono font-bold text-[#ea580c]">{k}</td><td className="font-mono">{v}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="border border-[#c0c0c0]">
                          <div className="bg-[#1a2035] text-white text-xs font-bold px-3 py-2">{t.traceRefHeader}</div>
                          <table className="result-table w-full">
                            <thead><tr><th>{t.traceRefStd}</th><th>{t.traceRefApp}</th><th>{t.traceRefMax}</th></tr></thead>
                            <tbody>
                              {t.traceRef.map(([s, a, m]) => (
                                <tr key={s}><td className="font-bold text-[#ea580c]">{s}</td><td>{a}</td><td className="font-mono font-bold text-center">{m}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </>
            )}
          </div>

          {/* ── HISTORY PANEL ── */}
          {historyOpen && (
            <div className="border-t-2 border-[#1a2035] bg-[#f5f5f5] shrink-0 flex flex-col" style={{ height: 200 }}>
              <div className="flex items-center justify-between bg-[#1a2035] px-3 h-7 shrink-0">
                <div className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-[#ea580c]" />
                  <span className="text-white text-xs font-semibold">{t.histPanelTitle}</span>
                  {history.length > 0 && (
                    <span className="bg-[#ea580c] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm">{history.length}/{MAX_HISTORY}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {history.length >= 2 && !compareMode && (
                    <button className="flex items-center gap-1 text-[10px] text-purple-300 hover:text-white border border-purple-500 hover:border-purple-300 rounded-sm px-2 py-0.5"
                      onClick={() => { setCompareMode(true); setCompareSelected([]); }}>
                      <GitCompare className="w-3 h-3" /> {t.histCompare}
                    </button>
                  )}
                  {compareMode && <>
                    <span className="text-[10px] text-yellow-300">{t.histSelectHint} ({compareSelected.length}/2)</span>
                    <button className="flex items-center gap-1 text-[10px] text-green-300 hover:text-white border border-green-500 rounded-sm px-2 py-0.5 disabled:opacity-40"
                      disabled={compareSelected.length < 2} onClick={startCompare}>{t.histConfirm}</button>
                    <button className="text-[10px] text-gray-400 hover:text-white px-1" onClick={() => { setCompareMode(false); setCompareSelected([]); }}>✕</button>
                  </>}
                  {history.length > 0 && (
                    <button className="flex items-center gap-1 text-[10px] text-red-400 hover:text-white" onClick={handleClearHistory}>
                      <Trash2 className="w-3 h-3" /> {t.histClear}
                    </button>
                  )}
                  <button className="text-gray-400 hover:text-white" onClick={() => setHistoryOpen(false)}>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {history.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-400 text-xs">{t.histEmpty}</div>
                ) : (
                  <table className="w-full text-[11px]" style={{ borderCollapse: "collapse" }}>
                    <thead className="sticky top-0">
                      <tr>
                        {compareMode && <th className="bg-[#2d3748] text-white px-2 py-1 text-center w-8">✓</th>}
                        <th className="bg-[#2d3748] text-white px-2 py-1 text-center w-8">{t.histColNo}</th>
                        <th className="bg-[#2d3748] text-white px-2 py-1 text-left">{t.histColTime}</th>
                        <th className="bg-[#2d3748] text-white px-2 py-1 text-right">{t.histColRho}</th>
                        <th className="bg-[#2d3748] text-white px-2 py-1 text-right">{t.histColL}</th>
                        <th className="bg-[#2d3748] text-white px-2 py-1 text-right">{t.histColN}</th>
                        <th className="bg-[#2d3748] text-white px-2 py-1 text-right">{t.histColS}</th>
                        <th className="bg-[#2d3748] text-white px-2 py-1 text-left">{t.histColStd}</th>
                        <th className="bg-[#2d3748] text-white px-2 py-1 text-right">{t.histColRn}</th>
                        <th className="bg-[#2d3748] text-white px-2 py-1 text-right">{t.histColEta}</th>
                        <th className="bg-[#2d3748] text-white px-2 py-1 text-center">{t.histColStatus}</th>
                        <th className="bg-[#2d3748] text-white px-2 py-1 text-center w-16">{t.histColAction}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((entry, idx) => {
                        const isActive = entry.id === activeHistoryId;
                        const isSel = compareSelected.includes(entry.id);
                        const rowBg = isActive ? "bg-[#fff3e8] border-l-2 border-l-[#ea580c]"
                          : isSel ? "bg-purple-50 border-l-2 border-l-purple-500"
                          : idx % 2 === 0 ? "bg-white" : "bg-[#f8f8f8]";
                        return (
                          <tr key={entry.id} className={`${rowBg} hover:bg-[#e8f0ff] cursor-pointer`}
                            onClick={() => compareMode ? toggleCompareSelect(entry.id) : handleLoadHistory(entry)}>
                            {compareMode && (
                              <td className="px-2 py-1 text-center">
                                <input type="checkbox" checked={isSel} onChange={() => toggleCompareSelect(entry.id)} className="cursor-pointer" />
                              </td>
                            )}
                            <td className="px-2 py-1 text-center text-gray-500 font-mono">{idx + 1}</td>
                            <td className="px-2 py-1 font-mono text-gray-600 whitespace-nowrap">{formatTime(entry.timestamp)}</td>
                            <td className="px-2 py-1 font-mono text-right">{entry.inputs.soilResistivity}</td>
                            <td className="px-2 py-1 font-mono text-right">{entry.inputs.rodLength}</td>
                            <td className="px-2 py-1 font-mono text-right font-semibold">{entry.inputs.numberOfRods}</td>
                            <td className="px-2 py-1 font-mono text-right">{entry.inputs.rodSpacing}</td>
                            <td className="px-2 py-1 text-gray-600">{CATEGORY_SHORT[entry.inputs.installationCategory]}</td>
                            <td className={`px-2 py-1 font-mono text-right font-bold ${entry.result.status === "PASS" ? "text-green-700" : entry.result.status === "WARNING" ? "text-amber-600" : "text-red-600"}`}>
                              {entry.result.totalResistance.toFixed(3)}
                            </td>
                            <td className="px-2 py-1 font-mono text-right text-gray-600">{entry.result.efficiencyFactor.toFixed(1)}</td>
                            <td className="px-2 py-1 text-center"><StatusBadge status={entry.result.status} small /></td>
                            <td className="px-2 py-1 text-center" onClick={e => e.stopPropagation()}>
                              {isActive ? (
                                <span className="text-[9px] font-bold text-[#ea580c] bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-sm">{t.histActive}</span>
                              ) : (
                                <button className="flex items-center gap-1 text-[10px] text-[#316ac5] hover:underline mx-auto" onClick={() => handleLoadHistory(entry)}>
                                  <ArrowDownToLine className="w-3 h-3" /> {t.histLoad}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* History tab (collapsed) */}
          {!historyOpen && history.length > 0 && (
            <div className="border-t border-[#c0c0c0] bg-[#e8e8e8] hover:bg-[#d8d8d8] cursor-pointer flex items-center gap-2 px-3 py-1 shrink-0"
              onClick={() => setHistoryOpen(true)}>
              <ChevronUp className="w-3 h-3 text-gray-500" />
              <History className="w-3 h-3 text-[#ea580c]" />
              <span className="text-[10px] text-gray-600 font-semibold">{t.histPanelTitle}</span>
              <span className="bg-[#ea580c] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm">{history.length}</span>
              <span className="text-[10px] text-gray-400 ml-1">{t.histToggle}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── STATUS BAR ── */}
      <div className="win-statusbar flex items-center justify-between h-5 px-3 shrink-0 text-[10px] text-gray-600">
        <div className="flex items-center gap-4">
          <span>{t.sbVersion}</span>
          <span>|</span>
          <span>{t.sbMethod}</span>
          {result && <>
            <span>|</span>
            <span className={result.status === "PASS" ? "text-green-700 font-bold" : result.status === "WARNING" ? "text-amber-700 font-bold" : "text-red-700 font-bold"}>
              {t.sbStatus}: {result.status}
            </span>
            <span>|</span>
            <span>Rn = {result.totalResistance.toFixed(3)} Ω  |  {t.metricLimit} = {result.standardLimit} Ω</span>
          </>}
        </div>
        <div className="flex items-center gap-4">
          {history.length > 0 && <span>{t.sbHistory}: {history.length} {t.sbEntries}</span>}
          {result && <span>{t.sbSoil}: {result.soilCategory}</span>}
          <span>{t.sbContext}</span>
          <span className="font-bold text-[#1a2035] border border-[#c0c0c0] px-1.5 rounded-sm">{lang.toUpperCase()}</span>
        </div>
      </div>

      {/* ── EXPORT DIALOG ── */}
      {showExportDialog && (
        <WinDialog title={t.exportTitle} onClose={() => setShowExportDialog(false)} width={440}>
          <div className="p-4 space-y-3">
            <div className="text-xs text-gray-600 bg-[#fffbf0] border border-[#d97706] rounded-sm p-2">{t.exportHint}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold block mb-1">{t.exportProjectName}</label>
                <input className="win-input" placeholder={t.exportProjectNamePh}
                  value={projectInfo.projectName} onChange={e => setProjectInfo(p => ({ ...p, projectName: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">{t.exportProjectNo}</label>
                <input className="win-input" placeholder={t.exportProjectNoPh}
                  value={projectInfo.projectNumber} onChange={e => setProjectInfo(p => ({ ...p, projectNumber: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">{t.exportDate}</label>
                <input className="win-input" value={projectInfo.date} onChange={e => setProjectInfo(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">{t.exportEngineer}</label>
                <input className="win-input" placeholder={t.exportEngineerPh}
                  value={projectInfo.engineerName} onChange={e => setProjectInfo(p => ({ ...p, engineerName: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">{t.exportClient}</label>
                <input className="win-input" placeholder={t.exportClientPh}
                  value={projectInfo.clientName} onChange={e => setProjectInfo(p => ({ ...p, clientName: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold block mb-1">{t.exportLocation}</label>
                <input className="win-input" placeholder={t.exportLocationPh}
                  value={projectInfo.location} onChange={e => setProjectInfo(p => ({ ...p, location: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold block mb-1">{t.exportNotes}</label>
                <textarea className="win-input resize-none" rows={2} placeholder={t.exportNotesPh}
                  value={projectInfo.notes} onChange={e => setProjectInfo(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="border-t border-[#c0c0c0] p-3 flex justify-end gap-2 bg-[#f0f0f0]">
            <button className="win-btn text-xs" onClick={() => setShowExportDialog(false)}>{t.btnCancel}</button>
            <button className="win-btn-primary text-xs" onClick={handleExport} disabled={isExporting || !projectInfo.projectName}>
              {isExporting ? t.btnDownloading : t.btnDownload}
            </button>
          </div>
        </WinDialog>
      )}

      {/* ── ABOUT DIALOG ── */}
      {showAbout && (
        <WinDialog title={t.aboutTitle} onClose={() => setShowAbout(false)} width={360}>
          <div className="p-5 text-center space-y-3">
            <div className="w-12 h-12 rounded mx-auto flex items-center justify-center bg-[#ea580c]">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="font-bold text-base text-[#1a2035]">GROUNDCALC</div>
              <div className="text-xs text-gray-500">{t.appSubtitle}</div>
              <div className="text-xs text-gray-400 mt-0.5">{t.appVersion}</div>
            </div>
            <div className="text-xs text-gray-600 bg-[#f8f8f8] border border-[#e0e0e0] rounded-sm p-3 text-left space-y-1">
              <div><span className="font-semibold">{t.aboutMethod}:</span> {t.aboutMethodVal}</div>
              <div><span className="font-semibold">{t.aboutStandards}:</span> {t.aboutStandardsVal}</div>
              <div><span className="font-semibold">{t.aboutContext}:</span> {t.aboutContextVal}</div>
            </div>
          </div>
          <div className="border-t border-[#c0c0c0] p-3 flex justify-end bg-[#f0f0f0]">
            <button className="win-btn text-xs" onClick={() => setShowAbout(false)}>{t.btnClose}</button>
          </div>
        </WinDialog>
      )}
    </div>
  );
}

// ── Compare View ──────────────────────────────────────────────────────────────
function CompareView({ entryA, entryB, historyIndex, t }: {
  entryA: HistoryEntry; entryB: HistoryEntry;
  historyIndex: (id: string) => number;
  t: typeof translations.id;
}) {
  const idxA = historyIndex(entryA.id);
  const idxB = historyIndex(entryB.id);

  const rows: { label: string; a: string; b: string; isSep?: boolean; highlight?: boolean }[] = [
    { label: t.cmpRowTime, a: formatTime(entryA.timestamp), b: formatTime(entryB.timestamp) },
    { label: t.cmpRowRho, a: `${entryA.inputs.soilResistivity}`, b: `${entryB.inputs.soilResistivity}`, highlight: entryA.inputs.soilResistivity !== entryB.inputs.soilResistivity },
    { label: t.cmpRowL, a: `${entryA.inputs.rodLength}`, b: `${entryB.inputs.rodLength}`, highlight: entryA.inputs.rodLength !== entryB.inputs.rodLength },
    { label: t.cmpRowD, a: `${entryA.inputs.rodDiameter}`, b: `${entryB.inputs.rodDiameter}`, highlight: entryA.inputs.rodDiameter !== entryB.inputs.rodDiameter },
    { label: t.cmpRowN, a: `${entryA.inputs.numberOfRods}`, b: `${entryB.inputs.numberOfRods}`, highlight: entryA.inputs.numberOfRods !== entryB.inputs.numberOfRods },
    { label: t.cmpRowS, a: `${entryA.inputs.rodSpacing}`, b: `${entryB.inputs.rodSpacing}`, highlight: entryA.inputs.rodSpacing !== entryB.inputs.rodSpacing },
    { label: t.cmpRowStd, a: entryA.inputs.installationCategory, b: entryB.inputs.installationCategory, highlight: entryA.inputs.installationCategory !== entryB.inputs.installationCategory },
    { label: t.cmpRowSep, a: "", b: "", isSep: true },
    { label: t.cmpRowR1, a: entryA.result.singleRodResistance.toFixed(4), b: entryB.result.singleRodResistance.toFixed(4), highlight: Math.abs(entryA.result.singleRodResistance - entryB.result.singleRodResistance) > 0.001 },
    { label: t.cmpRowRm, a: entryA.result.mutualResistance.toFixed(4), b: entryB.result.mutualResistance.toFixed(4), highlight: Math.abs(entryA.result.mutualResistance - entryB.result.mutualResistance) > 0.001 },
    { label: t.cmpRowRn, a: entryA.result.totalResistance.toFixed(4), b: entryB.result.totalResistance.toFixed(4), highlight: Math.abs(entryA.result.totalResistance - entryB.result.totalResistance) > 0.001 },
    { label: t.cmpRowEta, a: entryA.result.efficiencyFactor.toFixed(2), b: entryB.result.efficiencyFactor.toFixed(2), highlight: Math.abs(entryA.result.efficiencyFactor - entryB.result.efficiencyFactor) > 0.1 },
    { label: t.cmpRowMinRods, a: `${entryA.result.minimumRodsRequired}`, b: `${entryB.result.minimumRodsRequired}`, highlight: entryA.result.minimumRodsRequired !== entryB.result.minimumRodsRequired },
    { label: t.cmpRowLimit, a: `${entryA.result.standardLimit}`, b: `${entryB.result.standardLimit}`, highlight: entryA.result.standardLimit !== entryB.result.standardLimit },
    { label: t.cmpRowStatus, a: entryA.result.status, b: entryB.result.status, highlight: entryA.result.status !== entryB.result.status },
  ];

  return (
    <div className="p-4">
      <div className="border border-[#c0c0c0]">
        <div className="bg-[#2d1b4e] text-white text-xs font-bold px-3 py-2 flex items-center gap-2">
          <GitCompare className="w-3.5 h-3.5 text-purple-300" />
          {t.cmpTitle} — #{idxA} vs #{idxB}
          <span className="ml-auto text-purple-300 font-normal text-[10px]">{t.cmpHint}</span>
        </div>
        <table className="w-full text-[11px]" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th className="bg-[#1a2035] text-white px-3 py-2 text-left" style={{ width: 200 }}>PARAMETER</th>
              <th className="bg-[#1a3a2a] text-green-200 px-3 py-2 text-center">
                #{idxA} — {formatTime(entryA.timestamp)}
              </th>
              <th className="bg-[#1a2a3a] text-blue-200 px-3 py-2 text-center">
                #{idxB} — {formatTime(entryB.timestamp)}
              </th>
              <th className="bg-[#1a2035] text-white px-3 py-2 text-center">{t.cmpDelta}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if (row.isSep) return (
                <tr key={i}><td colSpan={4} className="bg-[#1a2035] text-[#ea580c] font-bold text-[10px] px-3 py-1.5 tracking-wider">{row.label}</td></tr>
              );
              const valA = parseFloat(row.a), valB = parseFloat(row.b);
              const delta = !isNaN(valA) && !isNaN(valB) ? (valB - valA).toFixed(4) : "—";
              const dn = parseFloat(delta);
              const dc = !isNaN(dn) ? (dn < 0 ? "text-green-600 font-bold" : dn > 0 ? "text-red-600 font-bold" : "text-gray-400") : "text-gray-400";
              const isStatus = row.label === t.cmpRowStatus;
              return (
                <tr key={i} className={row.highlight ? "bg-yellow-50" : i % 2 === 0 ? "bg-white" : "bg-[#f8f8f8]"}>
                  <td className={`px-3 py-1.5 font-semibold ${row.highlight ? "text-amber-800" : "text-gray-700"}`}>{row.label}</td>
                  <td className="px-3 py-1.5 font-mono text-center">
                    {isStatus ? <StatusBadge status={row.a as "PASS"|"FAIL"|"WARNING"} small /> : row.a}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-center">
                    {isStatus ? <StatusBadge status={row.b as "PASS"|"FAIL"|"WARNING"} small /> : row.b}
                  </td>
                  <td className={`px-3 py-1.5 font-mono text-center text-[10px] ${dc}`}>
                    {delta !== "—" && dn !== 0 ? (dn > 0 ? `+${delta}` : delta) : delta}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  const color = status === "PASS" ? "bg-green-600" : status === "WARNING" ? "bg-amber-500" : "bg-red-600";
  return (
    <span className={`font-bold text-white rounded ${color} ${small ? "text-[9px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"}`}>{status}</span>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-gray-600 block mb-0.5">{label}</label>
      {children}
    </div>
  );
}

function MenuItem({ label, icon, onClick, disabled }: { label: string; icon?: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      className={`flex items-center gap-2 w-full px-3 py-1 text-left text-xs hover:bg-[#316ac5] hover:text-white ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
      onClick={disabled ? undefined : onClick} disabled={disabled}
    >
      {icon && <span className="w-4">{icon}</span>}
      {label}
    </button>
  );
}

function MenuDivLabel({ label }: { label: string }) {
  return <div className="px-3 py-0.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{label}</div>;
}

function WinDialog({ title, onClose, children, width = 400 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]">
      <div className="bg-white border border-[#999] shadow-2xl flex flex-col" style={{ width, maxHeight: "85vh" }}>
        <div className="win-titlebar flex items-center justify-between h-7 px-2.5 shrink-0">
          <span className="text-white text-xs font-semibold">{title}</span>
          <button className="w-6 h-6 flex items-center justify-center hover:bg-red-600 text-gray-300 hover:text-white rounded-sm" onClick={onClose}>
            <X className="w-3 h-3" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
