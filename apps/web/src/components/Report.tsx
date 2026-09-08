import type { ReactNode } from "react";
import type { Assumption, CalculationRow, Citation, StructuredBuildReport } from "../types";
import { EntityLink } from "./EntityLink";

function Badge({ tone, children }: { tone: "good" | "warn" | "bad" | "neutral"; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

function safeHttpsUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function CitationLink({ citation, children }: { citation: Citation; children?: ReactNode }) {
  return <EntityLink href={citation.url} iconUrl={citation.iconUrl}>{children ?? citation.label}</EntityLink>;
}

export function BuildCard({ report }: { report: StructuredBuildReport }) {
  const b = report.build;
  const abilities = Object.entries(b.abilityScores);
  const metrics = report.metrics ? [
    ["Armor", report.metrics.armorClass], ["HP", report.metrics.hitPoints], ["Initiative", report.metrics.initiative],
    ["Spell DC", report.metrics.spellSaveDc], ["Attack", report.metrics.attackBonus], ...Object.entries(report.metrics.custom),
  ].filter((entry): entry is [string, number] => entry[1] !== undefined) : [];
  return <section className="report-block build-card" aria-labelledby="build-title">
    <header className="build-card__header">
      <div><p className="section-kicker">Level {b.level} · {b.gameVersion}</p><h2 id="build-title">{report.title}</h2><p>{report.summary}</p></div>
      <div className="badge-stack"><Badge tone={report.valid ? "good" : "bad"}>{report.valid ? "Legal build" : "Needs revision"}</Badge><Badge tone={report.confidence === "high" ? "good" : report.confidence === "medium" ? "warn" : "bad"}>{report.confidence} confidence</Badge></div>
    </header>
    <div className="build-spec"><div><span>Lineage</span><strong>{b.raceId}{b.subraceId ? ` / ${b.subraceId}` : ""}</strong></div><div><span>Classes</span><strong>{b.classes.map(c => `${c.classId} ${c.level}`).join(" / ")}</strong></div></div>
    <div className="ability-grid" aria-label="Ability scores">{abilities.map(([name, score]) => <div key={name}><span>{name.slice(0, 3)}</span><strong>{score}</strong></div>)}</div>
    {metrics.length > 0 && <dl className="metrics">{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {b.feats.length > 0 && <p className="detail-line"><span>Feats</span>{b.feats.join(", ")}</p>}
    {b.equipment.length > 0 && <p className="detail-line"><span>Core gear</span>{b.equipment.map(i => i.itemId).join(", ")}</p>}
  </section>;
}

export function CalculationTable({ rows, citations }: { rows: CalculationRow[]; citations: Citation[] }) {
  if (!rows.length) return null;
  const citationById = new Map(citations.map(citation => [citation.id, citation]));
  return <section className="report-block" aria-labelledby="calculations-title"><h3 id="calculations-title">How the numbers land</h3><div className="table-scroll"><table><thead><tr><th>Measure</th><th>Calculation</th><th>Result</th></tr></thead><tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.expression}{row.citationIds?.map(id => { const citation = citationById.get(id); return <sup key={id} title={citation?.label ?? id}>{citation ? <CitationLink citation={citation}>[{id}]</CitationLink> : `[${id}]`}</sup>; })}</td><td><strong>{row.result}</strong></td></tr>)}</tbody></table></div></section>;
}

export function AssumptionsPanel({ assumptions, warnings }: { assumptions: Assumption[]; warnings: string[] | undefined }) {
  if (!assumptions.length && !warnings?.length) return null;
  return <section className="report-block assumptions" aria-labelledby="assumptions-title"><h3 id="assumptions-title">Assumptions & limits</h3>{warnings?.map(w => <div className="mechanic-warning" role="note" key={w}><span aria-hidden="true">!</span><p><strong>Unsupported mechanic</strong>{w}</p></div>)}{assumptions.map(item => <details key={item.id}><summary><span>{item.label}</span><strong>{item.value}</strong></summary>{item.impact && <p>{item.impact}</p>}</details>)}</section>;
}

export function AcquisitionTimeline({ steps }: { steps: StructuredBuildReport["acquisition"] }) {
  if (!steps.length) return null;
  return <section className="report-block" aria-labelledby="acquisition-title"><h3 id="acquisition-title">Acquisition route</h3><ol className="timeline">{steps.map((step, index) => <li key={`${step.act}-${step.title}-${index}`}><span className="act-mark">{step.act}</span><div><h4>{step.title} {step.missable && <Badge tone="warn">Missable</Badge>}</h4>{step.location && <p>{step.location}</p>}<ul>{step.items.map(item => <li key={item}>{item}</li>)}</ul></div></li>)}</ol></section>;
}

export function CitationList({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return <section className="report-block citations" aria-labelledby="sources-title"><h3 id="sources-title">Sources</h3><ol>{citations.map(c => <li key={c.id}><span>[{c.id}]</span><div>{safeHttpsUrl(c.url) ? <CitationLink citation={c} /> : <strong>{c.label}</strong>}<p>{c.source}{c.detail ? ` — ${c.detail}` : ""}</p></div></li>)}</ol></section>;
}

export function StructuredReport({ report }: { report: StructuredBuildReport }) {
  return <div className="structured-report"><BuildCard report={report} />{report.issues.length > 0 && <section className="report-block issues"><h3>Legality checks</h3>{report.issues.map((issue, i) => <div key={`${issue.code}-${i}`} className={`issue issue--${issue.severity}`}><Badge tone={issue.severity === "error" ? "bad" : issue.severity === "warning" ? "warn" : "neutral"}>{issue.severity}</Badge><p>{issue.message}</p></div>)}</section>}<CalculationTable rows={report.calculations} citations={report.citations} /><AssumptionsPanel assumptions={report.assumptions} warnings={report.unsupportedMechanics} /><AcquisitionTimeline steps={report.acquisition} /><CitationList citations={report.citations} /></div>;
}
