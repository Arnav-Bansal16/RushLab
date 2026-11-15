import type { SimulationSettingsSnapshot } from "../../domain";
import { behaviorFields, behaviorLabel } from "./BehaviorControls";

/** Show engine-returned assumptions, never live form values or requested partial inputs. */
export default function ResolvedAssumptions({
  settings,
}: {
  settings: SimulationSettingsSnapshot;
}) {
  const { behavior, ...base } = settings;
  return (
    <details className="resolved-assumptions">
      <summary>Assumptions used by this run</summary>
      <p>
        These are the resolved settings saved by the engine for this completed
        run. Later edits above do not change them. Outputs are modeled
        estimates, not forecasts.
      </p>
      <dl>
        {[
          ...Object.entries(base).map(([path, value]) => ({ path, value })),
          ...behaviorFields(behavior),
        ].map(({ path, value }) => (
          <div key={path}>
            <dt>{behaviorLabel(path)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
