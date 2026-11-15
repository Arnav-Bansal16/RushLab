import type {
  CandidateAction,
  CandidateGeneration,
  Festival,
  IssueReport,
  LayoutCandidate,
} from "../../domain";
import { equalSnapshot } from "./equality";
import { compareIds } from "./issues";
import { validateCandidateGeometry } from "./geometry";
export const CANDIDATE_LIMIT = 4;
export const SEARCH_ATTEMPT_LIMIT = 32;

export function generateCandidates(
  festival: Festival,
  report: IssueReport,
): CandidateGeneration {
  if (
    festival.id !== report.festivalId ||
    !equalSnapshot(festival, report.festival)
  )
    throw new Error(
      "Candidate generation requires the completed report festival snapshot",
    );
  const output: CandidateGeneration = {
    candidates: [],
    attempts: 0,
    attemptLimit: SEARCH_ATTEMPT_LIMIT,
    rejectedActions: [],
    reasons: [],
    outcome: report.findings.length ? "no_legal_candidates" : "no_findings",
  };
  const seen = new Set<string>();
  const actions = report.findings.flatMap((f) => f.actions);
  for (const action of actions) {
    const reject = (
      reason: CandidateGeneration["rejectedActions"][number]["reason"],
    ) =>
      output.rejectedActions.push({
        actionId: action.id,
        reason,
        detail: `Action ${action.id}: ${reason}`,
      });
    if (output.attempts >= SEARCH_ATTEMPT_LIMIT) {
      reject("attempt_limit");
      continue;
    }
    if (output.candidates.length >= CANDIDATE_LIMIT) {
      reject("candidate_limit");
      continue;
    }
    output.attempts++;
    const snapshot = structuredClone(festival);
    const vendor = snapshot.vendors.find((v) => v.id === action.vendorId);
    if (!vendor) {
      reject("unknown_vendor");
      continue;
    }
    let change: LayoutCandidate["changes"][number];
    if (action.kind === "move") {
      change = {
        kind: "move",
        vendorId: vendor.id,
        before: structuredClone(vendor.position),
        after: structuredClone(action.position),
      };
      vendor.position = structuredClone(action.position);
    } else if (action.kind === "set_servers") {
      if (
        !Number.isSafeInteger(action.servers) ||
        action.servers < 1 ||
        action.servers > 100
      ) {
        reject("invalid_capacity");
        continue;
      }
      change = {
        kind: "set_servers",
        vendorId: vendor.id,
        before: vendor.servers,
        after: action.servers,
      };
      vendor.servers = action.servers;
    } else {
      reject("unsupported_action");
      continue;
    }
    if (equalSnapshot(change.before, change.after)) {
      reject("unchanged");
      continue;
    }
    const geometryError = validateCandidateGeometry(snapshot);
    if (geometryError) {
      reject(geometryError);
      continue;
    }
    const fingerprint = JSON.stringify(
      [...snapshot.vendors]
        .sort((a, b) => compareIds(a.id, b.id))
        .map((v) => [v.id, v.position.x, v.position.y, v.servers]),
    );
    if (seen.has(fingerprint)) {
      reject("duplicate");
      continue;
    }
    seen.add(fingerprint);
    output.candidates.push({
      id: JSON.stringify([
        "candidate",
        action.vendorId,
        change.kind,
        change.after,
      ]),
      sourceFindingIds: [...action.sourceFindingIds].sort(compareIds),
      sourceActionIds: [action.id],
      changes: [change],
      rationale: report.findings.find((f) =>
        f.actions.some((a) => a.id === action.id),
      )!.rationale,
      festival: snapshot,
    });
  }
  if (output.candidates.length) output.outcome = "generated";
  else
    output.reasons = !report.findings.length
      ? ["No supported issue thresholds were met"]
      : !actions.length
        ? ["Findings have no supported placement or server action"]
        : [...new Set(output.rejectedActions.map((r) => r.reason))]
            .sort(compareIds)
            .map((reason) => `No accepted action: ${reason}`);
  return output;
}

/** Validate an external/editable snapshot before spending simulation work on it. */
export function validateCandidateChanges(
  baseline: Festival,
  candidate: LayoutCandidate,
): string[] {
  const expected = structuredClone(baseline);
  const errors: string[] = [];
  for (const change of candidate.changes) {
    if (change.kind !== "move" && change.kind !== "set_servers") {
      errors.push("Unsupported candidate change");
      continue;
    }
    const vendor = expected.vendors.find((v) => v.id === change.vendorId);
    if (!vendor) {
      errors.push("Unknown vendor");
      continue;
    }
    const before = change.kind === "move" ? vendor.position : vendor.servers;
    if (!equalSnapshot(before, change.before))
      errors.push("Before value does not match baseline");
    const action: CandidateAction =
      change.kind === "move"
        ? {
            id: "",
            sourceFindingIds: [],
            vendorId: change.vendorId,
            kind: "move",
            position: change.after,
          }
        : {
            id: "",
            sourceFindingIds: [],
            vendorId: change.vendorId,
            kind: "set_servers",
            servers: change.after,
          };
    if (action.kind === "move")
      vendor.position = structuredClone(action.position);
    else {
      if (
        !Number.isSafeInteger(action.servers) ||
        action.servers < 1 ||
        action.servers > 100
      )
        errors.push("Invalid capacity");
      vendor.servers = action.servers;
    }
  }
  if (!equalSnapshot(expected, candidate.festival))
    errors.push("Snapshot contains undeclared changes");
  const geometry = validateCandidateGeometry(candidate.festival);
  if (geometry) errors.push(geometry);
  return errors;
}
