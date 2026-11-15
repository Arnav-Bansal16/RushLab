import {
  CURRENT_SIMULATION_MODEL_SEMANTICS,
  type CompatibilityIssue,
  type CompatibilityIssueCode,
  type Festival,
  type ScenarioCompatibility,
  type SimulationResult,
} from "../../domain";

function equalValues(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => equalValues(value, right[index]))
    );
  }
  if (typeof left !== "object" || typeof right !== "object") return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    equalValues(leftKeys, rightKeys) &&
    leftKeys.every((key) => equalValues(leftRecord[key], rightRecord[key]))
  );
}

function issue(
  code: CompatibilityIssueCode,
  path: string,
  message: string,
): CompatibilityIssue {
  return { code, path, message };
}

function compareField(
  errors: CompatibilityIssue[],
  code: CompatibilityIssueCode,
  path: string,
  baseline: unknown,
  alternative: unknown,
): void {
  if (!equalValues(baseline, alternative)) {
    errors.push(issue(code, path, `${path} must match between modeled runs`));
  }
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function compareCommonFestivalAssumptions(
  baseline: Festival,
  alternative: Festival,
  errors: CompatibilityIssue[],
): void {
  const baselineEntrances = byId(baseline.entrances);
  const alternativeEntrances = byId(alternative.entrances);
  for (const id of [...baselineEntrances.keys()]
    .filter((value) => alternativeEntrances.has(value))
    .sort()) {
    compareField(
      errors,
      "festival_assumption_mismatch",
      `festival.entrances.${id}.spawnWeight`,
      baselineEntrances.get(id)!.spawnWeight,
      alternativeEntrances.get(id)!.spawnWeight,
    );
  }

  const baselineStages = byId(baseline.stages);
  const alternativeStages = byId(alternative.stages);
  for (const id of [...baselineStages.keys()]
    .filter((value) => alternativeStages.has(value))
    .sort()) {
    const left = baselineStages.get(id)!;
    const right = alternativeStages.get(id)!;
    compareField(
      errors,
      "festival_assumption_mismatch",
      `festival.stages.${id}.attraction`,
      left.attraction,
      right.attraction,
    );
    compareField(
      errors,
      "festival_assumption_mismatch",
      `festival.stages.${id}.dwellDurationOverrideSeconds`,
      left.dwellDurationOverrideSeconds,
      right.dwellDurationOverrideSeconds,
    );
  }

  const baselineAmenities = byId(baseline.amenities ?? []);
  const alternativeAmenities = byId(alternative.amenities ?? []);
  for (const id of [...baselineAmenities.keys()]
    .filter((value) => alternativeAmenities.has(value))
    .sort()) {
    const left = baselineAmenities.get(id)!;
    const right = alternativeAmenities.get(id)!;
    for (const key of [
      "type",
      "attraction",
      "dwellDurationOverrideSeconds",
    ] as const) {
      compareField(
        errors,
        "festival_assumption_mismatch",
        `festival.amenities.${id}.${key}`,
        left[key],
        right[key],
      );
    }
  }

  const baselineVendors = byId(baseline.vendors);
  const alternativeVendors = byId(alternative.vendors);
  for (const id of [...baselineVendors.keys()]
    .filter((value) => alternativeVendors.has(value))
    .sort()) {
    const left = baselineVendors.get(id)!;
    const right = alternativeVendors.get(id)!;
    for (const key of [
      "category",
      "popularity",
      "averagePrice",
      "serviceTimeSeconds",
      "inventory",
    ] as const) {
      compareField(
        errors,
        "festival_assumption_mismatch",
        `festival.vendors.${id}.${key}`,
        left[key],
        right[key],
      );
    }
  }
}

function validateProfileEntrances(
  side: "baseline" | "alternative",
  result: SimulationResult,
  errors: CompatibilityIssue[],
): void {
  const entrances = new Set(result.festival.entrances.map(({ id }) => id));
  for (const profile of [...result.attendeeProfiles].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    if (!entrances.has(profile.entranceId)) {
      errors.push(
        issue(
          "invalid_profile_entrance",
          `${side}.attendeeProfiles.${profile.id}.entranceId`,
          `attendee ${profile.id} references an entrance absent from the ${side} festival snapshot`,
        ),
      );
    }
  }
}

function warnForEntitySets(
  label: string,
  baselineIds: string[],
  alternativeIds: string[],
  warnings: CompatibilityIssue[],
  absentValue: "unavailable" | "zero" = "unavailable",
): void {
  const baseline = new Set(baselineIds);
  const alternative = new Set(alternativeIds);
  const all = [...new Set([...baseline, ...alternative])].sort();
  for (const id of all) {
    if (baseline.has(id) !== alternative.has(id)) {
      warnings.push(
        issue(
          "entity_only_on_one_side",
          `${label}.${id}`,
          absentValue === "zero"
            ? `${label} row ${id} is present on only one side; the absent sparse transition count is zero`
            : `${label} entity ${id} is present on only one side; missing raw values remain unavailable`,
        ),
      );
    }
  }
}

function transitionId(fromType: string, toType: string): string {
  return `${fromType}->${toType}`;
}

function rejectDuplicateIds(
  side: "baseline" | "alternative",
  label: string,
  ids: string[],
  errors: CompatibilityIssue[],
): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push(
        issue(
          "duplicate_result_entity",
          `${side}.${label}.${id}`,
          `${side} contains duplicate ${label} identity ${id}`,
        ),
      );
    }
    seen.add(id);
  }
}

/** Reusable fair-comparison guard for manual alternatives and ANA-02 candidates. */
export function assessScenarioCompatibility(
  baseline: SimulationResult,
  alternative: SimulationResult,
): ScenarioCompatibility {
  const errors: CompatibilityIssue[] = [];
  const warnings: CompatibilityIssue[] = [];

  for (const [side, result] of [
    ["baseline", baseline],
    ["alternative", alternative],
  ] as const) {
    if ((result as { schemaVersion?: unknown }).schemaVersion !== 1) {
      errors.push(
        issue(
          "unsupported_schema",
          `${side}.schemaVersion`,
          `${side} uses an unsupported result schema`,
        ),
      );
    }
    const festival = (result as Partial<SimulationResult>).festival;
    if (!festival) {
      errors.push(
        issue(
          "missing_festival_snapshot",
          `${side}.festival`,
          `${side} lacks the festival snapshot needed to validate modeled assumptions`,
        ),
      );
    } else if (festival.schemaVersion !== 1) {
      errors.push(
        issue(
          "unsupported_schema",
          `${side}.festival.schemaVersion`,
          `${side} uses an unsupported festival schema`,
        ),
      );
    } else if (result.festivalId !== festival.id) {
      errors.push(
        issue(
          "festival_assumption_mismatch",
          `${side}.festivalId`,
          `${side} festivalId does not match its festival snapshot`,
        ),
      );
    }
    if (result.settings.attendeeCount !== result.attendeeProfiles.length) {
      errors.push(
        issue(
          "attendee_profiles_mismatch",
          `${side}.attendeeProfiles.length`,
          `${side} attendee count does not match its profile snapshot`,
        ),
      );
    }
    rejectDuplicateIds(
      side,
      "attendeeProfiles",
      result.attendeeProfiles.map(({ id }) => id),
      errors,
    );
    rejectDuplicateIds(
      side,
      "vendorMetrics",
      result.vendorMetrics.map(({ vendorId }) => vendorId),
      errors,
    );
    rejectDuplicateIds(
      side,
      "destinationMetrics",
      result.destinationMetrics.map(({ destinationId }) => destinationId),
      errors,
    );
    rejectDuplicateIds(
      side,
      "destinationTransitions",
      result.destinationTransitions.map(({ fromType, toType }) =>
        transitionId(fromType, toType),
      ),
      errors,
    );
    const semantics = (result as Partial<SimulationResult>).modelSemantics;
    if (!semantics) {
      errors.push(
        issue(
          "missing_model_semantics",
          `${side}.modelSemantics`,
          `${side} lacks explicit model semantics`,
        ),
      );
    } else if (!equalValues(semantics, CURRENT_SIMULATION_MODEL_SEMANTICS)) {
      errors.push(
        issue(
          "model_semantics_mismatch",
          `${side}.modelSemantics`,
          `${side} model semantics are not supported by this comparison`,
        ),
      );
    }
  }

  for (const key of [
    "seed",
    "attendeeCount",
    "durationSeconds",
    "stepSeconds",
    "walkingSpeedMetersPerSecond",
  ] as const) {
    compareField(
      errors,
      "settings_mismatch",
      `settings.${key}`,
      baseline.settings[key],
      alternative.settings[key],
    );
  }
  compareField(
    errors,
    "settings_mismatch",
    "settings.behavior",
    baseline.settings.behavior,
    alternative.settings.behavior,
  );

  const baselineProfiles = [...baseline.attendeeProfiles].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const alternativeProfiles = [...alternative.attendeeProfiles].sort(
    (left, right) => left.id.localeCompare(right.id),
  );
  compareField(
    errors,
    "attendee_profiles_mismatch",
    "attendeeProfiles",
    baselineProfiles,
    alternativeProfiles,
  );

  const baselineDestinationTypes = new Map(
    baseline.destinationMetrics.map(({ destinationId, destinationType }) => [
      destinationId,
      destinationType,
    ]),
  );
  const alternativeDestinationTypes = new Map(
    alternative.destinationMetrics.map(({ destinationId, destinationType }) => [
      destinationId,
      destinationType,
    ]),
  );
  for (const destinationId of [...baselineDestinationTypes.keys()]
    .filter((id) => alternativeDestinationTypes.has(id))
    .sort()) {
    compareField(
      errors,
      "festival_assumption_mismatch",
      `destinationMetrics.${destinationId}.destinationType`,
      baselineDestinationTypes.get(destinationId),
      alternativeDestinationTypes.get(destinationId),
    );
  }

  const baselineFestival = (baseline as Partial<SimulationResult>).festival;
  const alternativeFestival = (alternative as Partial<SimulationResult>)
    .festival;
  if (baselineFestival && alternativeFestival) {
    compareCommonFestivalAssumptions(
      baselineFestival,
      alternativeFestival,
      errors,
    );
  }
  if (baselineFestival) validateProfileEntrances("baseline", baseline, errors);
  if (alternativeFestival) {
    validateProfileEntrances("alternative", alternative, errors);
  }

  warnForEntitySets(
    "vendors",
    baseline.vendorMetrics.map(({ vendorId }) => vendorId),
    alternative.vendorMetrics.map(({ vendorId }) => vendorId),
    warnings,
  );
  warnForEntitySets(
    "destinations",
    baseline.destinationMetrics.map(({ destinationId }) => destinationId),
    alternative.destinationMetrics.map(({ destinationId }) => destinationId),
    warnings,
  );
  warnForEntitySets(
    "destinationTransitions",
    baseline.destinationTransitions.map(({ fromType, toType }) =>
      transitionId(fromType, toType),
    ),
    alternative.destinationTransitions.map(({ fromType, toType }) =>
      transitionId(fromType, toType),
    ),
    warnings,
    "zero",
  );

  const vendorIds = [
    ...new Set([
      ...baseline.vendorMetrics.map(({ vendorId }) => vendorId),
      ...alternative.vendorMetrics.map(({ vendorId }) => vendorId),
    ]),
  ].sort();
  for (const vendorId of vendorIds) {
    const left = baseline.vendorMetrics.find(
      (metric) => metric.vendorId === vendorId,
    );
    const right = alternative.vendorMetrics.find(
      (metric) => metric.vendorId === vendorId,
    );
    if (left && right && (!left.missedSales || !right.missedSales)) {
      warnings.push(
        issue(
          "optional_metric_unavailable",
          `vendors.${vendorId}.missedSales`,
          `modeled missed-sale values for vendor ${vendorId} were not recorded on both sides`,
        ),
      );
    }
  }

  return {
    status: errors.length === 0 ? "compatible" : "incompatible",
    errors,
    warnings,
  };
}
