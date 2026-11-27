import React, { useContext, useId, useRef, useState } from 'react';
import { FaArrowRight, FaChartColumn, FaDownload, FaWandMagicSparkles } from 'react-icons/fa6';
import { generateAiReportApi } from '../../api';
import { localDateKey, workspaceDateKey } from '../../utils/workFocus';
import { encodeCsv } from '../../utils/csv';
import { WorkspaceSettingsContext } from '../../context/WorkspaceSettingsContext';
import './AIReports.css';

const numberFormat = new Intl.NumberFormat();
const unavailableAnalysis = 'AI analysis is currently unavailable. The workspace figures below are still available.';

function defaultRange(timeZone) {
  const to = workspaceDateKey(timeZone);
  const from = new Date(`${to}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: from.toISOString().slice(0, 10), to };
}

function downloadReport(report, csv = false) {
  const text = [
    'EmployeeMS AI',
    report.title,
    report.period,
    '',
    'EmployeeMS AI analysis',
    report.analysis || unavailableAnalysis,
    '',
    'Verified workspace figures',
    ...report.metrics.map(({ label, value }) => `${label}: ${numberFormat.format(value)}`),
    ...report.sections.flatMap(({ title, rows }) => [
      '',
      title,
      ...(rows.length ? rows.map(({ label, count }) => `${label}: ${numberFormat.format(count)}`) : ['No records for this report.'])
    ])
  ].join('\r\n');
  const figures = () => encodeCsv([
    [report.title, report.period], ['Section', 'Label', 'Count'],
    ...report.metrics.map(({ label, value }) => ['Verified workspace figures', label, value]),
    ...report.sections.flatMap(({ title, rows }) => rows.map(({ label, count }) => [title, label, count]))
  ]);
  const url = URL.createObjectURL(new Blob([csv ? `\uFEFF${figures()}` : text], { type: csv ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `employeems-${report.kind}-report-${localDateKey(new Date())}.${csv ? 'csv' : 'txt'}`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ReportResult({ report, inChat = false }) {
  const titleId = useId();
  const analysisId = useId();
  const Title = inChat ? 'h3' : 'h4';
  const Heading = inChat ? 'h4' : 'h5';
  const breakdowns = (
    <div className="ai-report-sections">
      {report.sections.map(({ title, rows }) => (
        <section className="ai-report-breakdown" key={title}>
          <Heading className="ai-report-breakdown-heading">{title}</Heading>
          {rows.length ? (
            <dl>
              {rows.map(({ label, count }) => (
                <div key={label}><dt>{label}</dt><dd>{numberFormat.format(count)}</dd></div>
              ))}
            </dl>
          ) : <p>No records for this report.</p>}
        </section>
      ))}
    </div>
  );

  return (
    <section className={inChat ? 'ai-report-result ai-report-result--chat' : 'ai-report-result'} aria-labelledby={titleId}>
      {!inChat && <p className="sr-only" role="status">Report ready.</p>}
      <div className="ai-report-result-header">
        <div>
          <Title id={titleId} className="ai-report-title">{report.title}</Title>
          <p>{report.period}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ai-quiet" onClick={() => downloadReport(report)}>
            <FaDownload aria-hidden="true" /> Download report
          </button>
          <button type="button" className="ai-quiet" onClick={() => downloadReport(report, true)}>Download CSV</button>
        </div>
      </div>
      <section className="ai-report-insight" aria-labelledby={analysisId}>
        <Heading id={analysisId} className="ai-report-insight-heading"><FaWandMagicSparkles aria-hidden="true" /> EmployeeMS AI analysis</Heading>
        <p className={report.analysis ? 'ai-report-analysis-text' : 'ai-report-analysis-unavailable'}>
          {report.analysis || unavailableAnalysis}
        </p>
      </section>
      <Heading className="ai-report-data-title">Verified workspace figures</Heading>
      <dl className="ai-report-metrics">
        {report.metrics.map(({ label, value }) => (
          <div key={label}><dt>{label}</dt><dd>{numberFormat.format(value)}</dd></div>
        ))}
      </dl>
      {inChat ? (
        <details className="ai-report-details">
          <summary>Report breakdowns</summary>
          {breakdowns}
        </details>
      ) : breakdowns}
    </section>
  );
}

export default function AIReports({ isAdmin, hidden }) {
  const { settings } = useContext(WorkspaceSettingsContext);
  const [selectedKind, setSelectedKind] = useState('tasks');
  const [range, setRange] = useState(null);
  const selectedRange = range ?? defaultRange(settings.timeZone);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generating = useRef(false);
  const kind = isAdmin ? selectedKind : 'tasks';
  const validRange = Boolean(selectedRange.from && selectedRange.to && selectedRange.from <= selectedRange.to);
  const canGenerate = !loading && (kind === 'workforce' || validRange);

  function updateRange(event) {
    const { name, value } = event.target;
    setRange({ ...selectedRange, [name]: value });
    setReport(null);
    setError('');
  }

  function updateKind(event) {
    setSelectedKind(event.target.value);
    setReport(null);
    setError('');
  }

  async function generate(event) {
    event.preventDefault();
    if (!canGenerate || generating.current) return;
    generating.current = true;
    setLoading(true);
    setError('');
    setReport(null);
    try {
      const payload = kind === 'tasks' ? { kind, ...selectedRange } : { kind };
      setReport(await generateAiReportApi(payload));
    } catch (requestError) {
      setError(requestError.message || 'Could not generate the report.');
    } finally {
      generating.current = false;
      setLoading(false);
    }
  }

  return (
    <section id="ai-reports-panel" className="ai-reports" aria-labelledby="ai-reports-heading" hidden={hidden} tabIndex={0}>
      <div className="ai-report-hero">
        <span className="ai-report-emblem"><FaChartColumn aria-hidden="true" /></span>
        <div>
          <h3 id="ai-reports-heading">AI reports</h3>
          <p>Turn workspace figures into a report you can share.</p>
        </div>
      </div>

      <form className="ai-report-form" onSubmit={generate}>
        <div className="ai-report-controls" data-kind={kind}>
          {isAdmin && (
            <label>
              <span>Report type</span>
              <select value={kind} disabled={loading} onChange={updateKind}>
                <option value="tasks">Task report</option>
                <option value="workforce">Workforce report</option>
              </select>
            </label>
          )}
          {kind === 'tasks' && (
            <>
              <label>
                <span>From</span>
                <input type="date" name="from" required value={selectedRange.from} max={selectedRange.to || undefined} disabled={loading} onChange={updateRange} />
              </label>
              <label>
                <span>To</span>
                <input type="date" name="to" required value={selectedRange.to} min={selectedRange.from || undefined} disabled={loading} onChange={updateRange} />
              </label>
            </>
          )}
        </div>
        <button type="submit" className="workspace-action ai-report-generate" disabled={!canGenerate}>
          {loading ? 'Generating report…' : 'Generate report'} <FaArrowRight aria-hidden="true" />
        </button>
      </form>
      <p className="ai-report-scope">
        {kind === 'tasks'
          ? `Includes ${isAdmin ? 'workspace tasks' : 'your assigned tasks'} created in the selected dates.`
          : 'Includes current headcount, onboarding and offboarding figures, and leave requests from the past 12 months.'}
      </p>
      {loading && <p className="ai-report-notice" role="status">Loading workspace figures and AI analysis…</p>}
      {error && <p className="ai-error" role="alert">{error}</p>}

      {report && <ReportResult report={report} />}
    </section>
  );
}
