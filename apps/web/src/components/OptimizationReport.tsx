import type { OptimizationReport } from "@bg3-builds/domain";

export function OptimizationReportCard({ report }: { report: OptimizationReport }) {
  const { result } = report;
  return <section className="report-block optimization-report" aria-labelledby="optimization-title">
    <p className="section-kicker">Bounded optimizer result</p>
    <h2 id="optimization-title">{report.title}</h2>
    <p>{report.summary}</p>
    <dl className="metrics">
      <div><dt>Score</dt><dd>{result.score.toFixed(2)}</dd></div>
      <div><dt>Candidates evaluated</dt><dd>{result.bounds.evaluatedCandidates} / {result.bounds.maxCandidates}</dd></div>
      <div><dt>Scope</dt><dd>Level 5 · Act 1 · ranged</dd></div>
    </dl>
    <p className="detail-line"><span>Recommended build</span>{result.build.name}</p>
    <p className="detail-line"><span>Classes</span>{result.build.classes.map(entry => `${entry.classId} ${entry.level}`).join(" / ")}</p>
    <div className="assumptions"><h3>Limits of this result</h3>
      <p>This result is bounded and does not claim a global optimum.</p>
      <ul>{result.limitations.map(limitation => <li key={limitation}>{limitation}</li>)}</ul>
    </div>
  </section>;
}
