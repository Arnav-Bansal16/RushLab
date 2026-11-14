import type {
  Festival,
  RunSimulation,
  SimulationResult,
  SimulationSettings,
} from "../../domain";
import { runSimulation } from "../../simulation";
import type { LayoutDocument } from "../editor/layout";
import { prepareSimulationInput } from "../editor/simulationInput";

export interface ActiveRun {
  festivalSnapshot: Festival;
  settingsSnapshot: SimulationSettings;
  result: SimulationResult;
  warnings: string[];
}
export type RunOutcome =
  | { ok: true; run: ActiveRun }
  | { ok: false; errors: string[]; warnings: string[] };
/** UI composition only. Dependency injection permits proving the engine is never called after rejection. */
export function executeRun(
  layout: LayoutDocument,
  settings: SimulationSettings,
  engine: RunSimulation = runSimulation,
): RunOutcome {
  const input = prepareSimulationInput(layout, settings);
  if (!input.ok) return input;
  // Retain snapshots independently even if an engine consumer changes its arguments.
  const festivalSnapshot = structuredClone(input.festival);
  const settingsSnapshot = structuredClone(input.settings);
  try {
    const result = engine(input.festival, input.settings);
    return {
      ok: true,
      run: {
        festivalSnapshot,
        settingsSnapshot,
        result: structuredClone(result),
        warnings: [...input.warnings],
      },
    };
  } catch (error) {
    return {
      ok: false,
      errors: [
        error instanceof Error
          ? error.message
          : "The simulation could not run.",
      ],
      warnings: [...input.warnings],
    };
  }
}
