import type { OptimizationReport } from "@bg3-builds/domain";

export function OptimizationReportCard({ report }: { report: OptimizationReport }) {
  const { result } = report;
  return <section className="report-block optimization-report" aria-labelledby="optimization-title">
    <p className="section-kicker">Exact curated optimizer</p>
    <h2 id="optimization-title">{report.title}</h2>
    <p>{report.summary}</p>
    <dl className="metrics">
      <div><dt>Evaluated</dt><dd>{result.bounds.evaluatedCandidates} / {result.bounds.candidateSetSize}</dd></div>
      <div><dt>Returned</dt><dd>Top {result.bounds.returnedCandidates}</dd></div>
      <div><dt>Scope</dt><dd>Level 5 · Act 1 · ranged</dd></div>
    </dl>
    <ol>{result.candidates.map(candidate => <li key={`${candidate.build.id}-${candidate.policy.sharpshooter}`}>
      <strong>#{candidate.rank} {candidate.build.name}</strong>
      <p>Expected damage: attack {candidate.attack.expected.toFixed(2)} · round 1 {candidate.oneRound.expected.toFixed(2)} · 3 rounds {candidate.threeRounds.expected.toFixed(2)}</p>
      <p>Sharpshooter {candidate.policy.sharpshooter}; Archery and Extra Attack always applied. {candidate.policy.subclassResource}</p>
      <p>{candidate.provenance.map((ref, index) => <span key={ref.entityId}>{index > 0 ? " · " : ""}<a href={ref.url} rel="noreferrer">{ref.label}</a></span>)}</p>
    </li>)}</ol>
    <div className="assumptions"><h3>Scope and validation</h3>
      <p>{result.guarantee}</p>
      <p>Validated {result.validation.validCandidates}; rejected {result.validation.rejectedCandidates}. This is not a global optimum.</p>
      <ul>{result.unsupportedMechanics.map(mechanic => <li key={mechanic}>{mechanic} is unsupported and was not calculated.</li>)}</ul>
    </div>
  </section>;
}
