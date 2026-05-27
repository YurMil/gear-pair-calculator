import type { CandidateProposal, SearchOptions } from './types';

const STANDARD_MODULES = [
  0.5, 0.8, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0, 9.0, 10.0
];

export function searchCandidates(options: SearchOptions): CandidateProposal[] {
  const {
    ratioTarget,
    centerDistanceTarget,
    centerDistanceTol = 10, // default +/- 10mm
    minTeeth = 12,
    maxTeeth = 150,
    minModule = 0.5,
    maxModule = 10.0
  } = options;

  const candidates: CandidateProposal[] = [];
  const modulesToSearch = STANDARD_MODULES.filter(m => m >= minModule && m <= maxModule);

  // We loop z1 from minTeeth to maxTeeth
  for (const m of modulesToSearch) {
    for (let z1 = minTeeth; z1 <= maxTeeth; z1++) {
      // Find the ideal z2 for the target ratio
      // z2_ideal = z1 * ratioTarget
      // We check z2 values close to z2_ideal
      const z2Ideal = z1 * ratioTarget;
      const z2Start = Math.max(minTeeth, Math.floor(z2Ideal * 0.95));
      const z2End = Math.min(maxTeeth, Math.ceil(z2Ideal * 1.05));

      for (let z2 = z2Start; z2 <= z2End; z2++) {
        const ratio = z2 / z1;
        const ratioError = Math.abs(ratio - ratioTarget) / ratioTarget;
        
        // Skip if ratio error is too high (e.g. > 15%)
        if (ratioError > 0.15) continue;

        const a = (m * (z1 + z2)) / 2;

        let aError = 0;
        if (centerDistanceTarget !== undefined) {
          aError = Math.abs(a - centerDistanceTarget);
          if (aError > centerDistanceTol) continue;
        }

        // Undercut limits (assuming alpha = 20 deg, standard ha* = 1)
        const undercutPinion = z1 < 17;
        const undercutGear = z2 < 17;

        // Calculate score: 0 to 100
        // 1. Ratio score (up to 50 pts)
        const ratioScore = Math.max(0, 50 * (1 - ratioError * 10)); // 0 error = 50 pts, 10% error = 0 pts

        // 2. Center distance score (up to 30 pts)
        let cdScore = 30;
        if (centerDistanceTarget !== undefined) {
          cdScore = Math.max(0, 30 * (1 - aError / centerDistanceTol));
        }

        // 3. Undercut penalty (up to 20 pts)
        let undercutScore = 20;
        if (undercutPinion) undercutScore -= 10;
        if (undercutGear) undercutScore -= 5;

        // 4. Prefer normal integer ratios and medium teeth counts
        // Extra alignment bonus for tooth counts that are common
        let sizeScore = 0;
        if (z1 >= 18 && z1 <= 40) sizeScore += 5; // preferred range for pinion
        if (z2 >= 20 && z2 <= 80) sizeScore += 5;

        const score = Math.round(Math.min(100, ratioScore + cdScore + undercutScore + sizeScore));

        candidates.push({
          z1,
          z2,
          module: m,
          ratio,
          ratioError: ratioError * 100, // percentage
          centerDistance: a,
          centerDistanceError: aError,
          undercutPinion,
          undercutGear,
          score,
          rank: 0,
        });
      }
    }
  }

  // Sort candidates by score descending, then by ratio error ascending
  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.ratioError - b.ratioError;
  });

  // Assign ranks and cap at 50 results
  const ranked = candidates.slice(0, 50).map((c, index) => ({
    ...c,
    rank: index + 1,
  }));

  return ranked;
}
