type NameParts = {
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  displayName?: string | null | undefined;
  email?: string | null | undefined;
  userId?: string | null | undefined;
};

function normalizeNamePart(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitDisplayName(displayName?: string | null) {
  const normalized = normalizeNamePart(displayName);
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  const parts = normalized.split(" ").filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.length > 1 ? parts[parts.length - 1] ?? "" : "",
  };
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 0; i < left.length; i += 1) {
    let diagonal = previous[0]!;
    previous[0] = i + 1;

    for (let j = 0; j < right.length; j += 1) {
      const current = previous[j + 1]!;
      const cost = left[i] === right[j] ? 0 : 1;
      previous[j + 1] = Math.min(
        previous[j + 1]! + 1,
        previous[j]! + 1,
        diagonal + cost,
      );
      diagonal = current;
    }
  }

  return previous[right.length]!;
}

function namePartsMatch(left: string, right: string) {
  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  const distance = levenshteinDistance(left, right);
  if (Math.max(left.length, right.length) <= 4) {
    return distance === 1;
  }

  return distance <= 2;
}

function resolveNames(candidate: NameParts) {
  const normalizedFirst = normalizeNamePart(candidate.firstName);
  const normalizedLast = normalizeNamePart(candidate.lastName);
  if (normalizedFirst || normalizedLast) {
    return {
      firstName: normalizedFirst,
      lastName: normalizedLast,
    };
  }

  return splitDisplayName(candidate.displayName);
}

export function isLikelySameManager(left: NameParts, right: NameParts) {
  if (left.userId && right.userId && left.userId === right.userId) {
    return true;
  }

  const leftEmail = normalizeNamePart(left.email);
  const rightEmail = normalizeNamePart(right.email);
  if (leftEmail && rightEmail && leftEmail === rightEmail) {
    return true;
  }

  const leftNames = resolveNames(left);
  const rightNames = resolveNames(right);

  const firstMatches = namePartsMatch(leftNames.firstName, rightNames.firstName);
  const lastMatches = namePartsMatch(leftNames.lastName, rightNames.lastName);

  return firstMatches && lastMatches;
}
