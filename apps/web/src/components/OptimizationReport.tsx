import type { OptimizationReport } from "@bg3-builds/domain";
import { EntityLink } from "./EntityLink";

interface OptimizationReportCardProps { report: OptimizationReport }
type Candidate = OptimizationReport["result"]["candidates"][number];
type EvaluatedWindow = Candidate["windows"]["nova"];

function WindowRow({ window }: { window: EvaluatedWindow }): React.JSX.Element {
  const attacks = window.events.reduce((total, event) => total + event.count, 0);
  const resources = window.resourcesSpent.length === 0
    ? "No limited resources"
    : window.resourcesSpent.map(resource => `${resource.resource} ×${resource.amount} (${resource.recovery})`).join(", ");
  return <tr>
    <th scope="row">{window.label}</th>
    <td>{window.summary.expected.toFixed(2)}</td>
    <td>{window.summary.minimum}–{window.summary.critMax}</td>
    <td>{(window.probabilityKill * 100).toFixed(1)}%</td>
    <td>{attacks} attack{attacks === 1 ? "" : "s"}; {resources}</td>
  </tr>;
}

export function OptimizationReportCard({ report }: OptimizationReportCardProps): React.JSX.Element {
  const { result } = report;
  return <section className="report-block optimization-report" aria-labelledby="optimization-title">
    <p className="section-kicker">Exact curated optimizer</p>
    <h2 id="optimization-title">{report.title}</h2>
    <p>{report.summary}</p>
    <dl className="metrics">
      <div><dt>Evaluated</dt><dd>{result.bounds.evaluatedCandidates} / {result.bounds.candidateSetSize}</dd></div>
      <div><dt>Returned</dt><dd>Top {result.bounds.returnedCandidates}</dd></div>
      <div><dt>Scope</dt><dd>Level 5 · Act 1 · ranged</dd></div>
      <div><dt>Target HP</dt><dd>{result.request.combat.targetHitPoints}</dd></div>
    </dl>
    <ol>{result.candidates.map(candidate => <li key={`${candidate.build.id}-${candidate.policy.sharpshooter}`}>
      <strong>#{candidate.rank} {candidate.build.name}</strong>
      <div className="table-scroll"><table><thead><tr><th>Window</th><th>Expected</th><th>Min–max</th><th>Kill by end</th><th>Schedule</th></tr></thead><tbody>
        <WindowRow window={candidate.windows.singleAttack} />
        <WindowRow window={candidate.windows.opener} />
        <WindowRow window={candidate.windows.nova} />
        <WindowRow window={candidate.windows.steadyState} />
        {candidate.windows.horizons.map(({ rounds, window }) => <WindowRow key={rounds} window={window} />)}
      </tbody></table></div>
      <p>Sharpshooter {candidate.policy.sharpshooter}; Archery and Extra Attack always applied.</p>
      <ul>
        <li><strong>{candidate.windows.surprise.label}: unsupported.</strong> {candidate.windows.surprise.explanation}</li>
        <li><strong>{candidate.windows.setup.label}: unsupported.</strong> {candidate.windows.setup.explanation}</li>
      </ul>
      <p>{candidate.provenance.map((ref, index) => <span key={ref.entityId}>{index > 0 ? " · " : ""}<EntityLink href={ref.url} iconUrl={ref.iconUrl}>{ref.label}</EntityLink></span>)}</p>
    </li>)}</ol>
    <div className="assumptions"><h3>Scope and validation</h3>
      <p>{result.guarantee}</p>
      <p>Ranked by exact Nova expected damage. Validated {result.validation.validCandidates}; rejected {result.validation.rejectedCandidates}. This is not a global optimum.</p>
      <ul>{result.unsupportedMechanics.map(mechanic => <li key={mechanic}>{mechanic} is unsupported and was not calculated.</li>)}</ul>
    </div>
  </section>;
}
