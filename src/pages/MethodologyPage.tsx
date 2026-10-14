import { PageShell } from './PageShell'

export function MethodologyPage() {
  return <PageShell title="Method" lead="How observations are collected, what the numbers mean, and what this project does not claim.">
    <section className="page-card prose">
      <h2>What we measure</h2>
      <p>Avoidable electricity use that a team member sees directly: lights, fans or air conditioners running in a space that is unoccupied. We do not measure water, waste, or whole-building consumption, and there is no meter or telemetry feed.</p>
      <h2>Formulas</h2>
      <ul>
        <li><b>Avoidable load (W)</b> = device count × watts per device. Every valid observation has this.</li>
        <li><b>Verified energy (kWh)</b> = watts × verified hours ÷ 1000. It exists only when a later revisit or shutdown time proves how long the device ran.</li>
      </ul>
      <p>A single sighting is a snapshot. It is never converted into an assumed-duration kWh figure, and loads recorded at different times are a comparison measure, not a campus-wide concurrent demand reading.</p>
      <h2>Review and publication</h2>
      <p>Observations start as private drafts, are reviewed by a second team member, and only then appear here. Photos are published only after being checked for faces, screens and identifying details.</p>
      <h2>Buildings and heights</h2>
      <p>Building outlines come from OpenStreetMap contributors. Storeys, facades and heights in the 3D model are schematic studies, not surveys; only some heights are photo-based estimates and they are labelled as such. Some outlines were corrected by eye against aerial imagery and are approximate.</p>
      <h2>Limitations</h2>
      <ul>
        <li>The audited sample is a set of buildings and time windows, not the whole campus.</li>
        <li>Appliance wattages are catalogue values, not measured.</li>
        <li>OpenStreetMap coverage is incomplete; some buildings are not drawn.</li>
        <li>This is an independent student project for a community outreach course, not an official IIT Roorkee platform.</li>
      </ul>
      <h2>Credits</h2>
      <p>Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> (ODbL). Facade studies drew on photographs published on Wikimedia Commons; see <a href="/geometry-sources.txt">geometry sources</a> for details.</p>
    </section>
  </PageShell>
}
