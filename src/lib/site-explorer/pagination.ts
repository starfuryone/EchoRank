// Portions adapted from every-app/open-seo (MIT)
//
// src/lib/site-explorer/pagination.ts
//
// Filtering, sorting and paging the Keywords and Pages tables.
//
// ── ALL OF IT HAPPENS OVER ROWS WE ALREADY BOUGHT ──────────────────────────
// This is the design decision the whole file exists to serve, and it is the
// opposite of the one the Backlinks tool makes. There, filters are pushed to
// the provider because the list is capped and filtering after a cap filters a
// pre-truncated set. Here the analysis fetches a WIDE set once — a thousand
// ranked keywords — and every subsequent question is answered from it.
//
// The reason the two differ is the shape of the data. A domain has thousands
// of ranked keywords but the useful ones are the top thousand by traffic, and
// one fetch covers every filter a customer will apply to them. A domain's
// backlinks run to millions, and "only .edu" is a question about the whole
// population rather than about the top slice.
//
// The consequence is worth stating plainly: on this tool, CHANGING A FILTER
// COSTS NOTHING. No allowance, no provider call, no waiting. That is why the
// toolbar has no Apply button and no cost warning — both would be describing
// a bill that is not being run up.
//
// PURE. No prisma, no provider, no fs — imported by the client component for
// its own preview of the same filtering, so it must stay that way.

/** Ascending or descending. */
export type SortOrder = "asc" | "desc";

export interface PageRequest {
  /** 1-based. */
  page?: number;
  pageSize?: number;
}

export interface PagedResult<Row> {
  rows: Row[];
  /** Rows matching the filter, before paging. */
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Bounds a page size to something a table can actually render. */
export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export function normalizePageSize(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  const rounded = Math.floor(value);
  return (PAGE_SIZES as readonly number[]).includes(rounded) ? rounded : DEFAULT_PAGE_SIZE;
}

/**
 * Slice a filtered, sorted set into one page.
 *
 * CLAMPS RATHER THAN EMPTIES. A page number past the end returns the LAST
 * page, not an empty table — the common way to get there is filtering while
 * on page 9 of 12, and an empty table there reads as "your filter matched
 * nothing" when in fact it matched plenty.
 */
export function paginate<Row>(rows: readonly Row[], request: PageRequest): PagedResult<Row> {
  const pageSize = normalizePageSize(request.pageSize);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(request.page ?? 1)), totalPages);
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total, page, pageSize, totalPages };
}

/**
 * Sort by one numeric or string field.
 *
 * NULL AND undefined SORT LAST IN BOTH DIRECTIONS. A keyword with no volume
 * figure is not the lowest-volume keyword, it is an unmeasured one, and
 * putting it at the top of an ascending sort would make "least searched" a
 * list of things nobody measured.
 */
export function sortRows<Row>(
  rows: readonly Row[],
  field: keyof Row,
  order: SortOrder,
): Row[] {
  const direction = order === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a[field];
    const right = b[field];
    const leftMissing = left === null || left === undefined || left === "";
    const rightMissing = right === null || right === undefined || right === "";
    if (leftMissing && rightMissing) return 0;
    if (leftMissing) return 1;
    if (rightMissing) return -1;
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * direction;
    }
    return String(left).localeCompare(String(right)) * direction;
  });
}

// ─── Keyword filters ─────────────────────────────────────────────────────────

export interface DomainKeywordFilters {
  /** Substring match on the keyword, case-insensitive. */
  query?: string;
  minVolume?: number;
  maxVolume?: number;
  /** Inclusive position band, e.g. 1..10 for "page one". */
  minPosition?: number;
  maxPosition?: number;
  /** Only keywords whose ranking URL contains this. */
  urlContains?: string;
}

export interface DomainKeywordRowShape {
  keyword: string;
  position: number;
  searchVolume: number;
  etv: number;
  url: string;
}

/** Case- and accent-insensitive contains. */
function contains(haystack: string, needle: string): boolean {
  return haystack
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .includes(
      needle.trim().toLocaleLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, ""),
    );
}

export function filterKeywords<Row extends DomainKeywordRowShape>(
  rows: readonly Row[],
  filters: DomainKeywordFilters,
): Row[] {
  return rows.filter((row) => {
    if (filters.query && !contains(row.keyword, filters.query)) return false;
    if (filters.urlContains && !contains(row.url, filters.urlContains)) return false;
    if (typeof filters.minVolume === "number" && row.searchVolume < filters.minVolume) {
      return false;
    }
    if (typeof filters.maxVolume === "number" && row.searchVolume > filters.maxVolume) {
      return false;
    }
    if (typeof filters.minPosition === "number" && row.position < filters.minPosition) {
      return false;
    }
    if (typeof filters.maxPosition === "number" && row.position > filters.maxPosition) {
      return false;
    }
    return true;
  });
}

/** Sortable columns on the Keywords tab, so a caller cannot sort by anything. */
export const KEYWORD_SORT_FIELDS = ["keyword", "position", "searchVolume", "etv"] as const;
export type KeywordSortField = (typeof KEYWORD_SORT_FIELDS)[number];

export function isKeywordSortField(value: string): value is KeywordSortField {
  return (KEYWORD_SORT_FIELDS as readonly string[]).includes(value);
}

// ─── Page filters ────────────────────────────────────────────────────────────

export interface DomainPageFilters {
  /** Substring match on the page URL. */
  query?: string;
  minKeywords?: number;
  minTraffic?: number;
}

export interface DomainPageRowShape {
  url: string;
  keywordCount: number;
  etv: number;
  topPositions: number;
}

export function filterPages<Row extends DomainPageRowShape>(
  rows: readonly Row[],
  filters: DomainPageFilters,
): Row[] {
  return rows.filter((row) => {
    if (filters.query && !contains(row.url, filters.query)) return false;
    if (typeof filters.minKeywords === "number" && row.keywordCount < filters.minKeywords) {
      return false;
    }
    if (typeof filters.minTraffic === "number" && row.etv < filters.minTraffic) return false;
    return true;
  });
}

export const PAGE_SORT_FIELDS = ["url", "keywordCount", "etv", "topPositions"] as const;
export type PageSortField = (typeof PAGE_SORT_FIELDS)[number];

export function isPageSortField(value: string): value is PageSortField {
  return (PAGE_SORT_FIELDS as readonly string[]).includes(value);
}

/**
 * Filter, sort and page in one call — the order the three must happen in.
 *
 * FILTER, THEN SORT, THEN PAGE. Any other order is wrong in a way that looks
 * right: sorting before filtering wastes work, and paging before either
 * returns page 1 of the unfiltered set with the filter applied to it, which is
 * a table that empties as you scroll.
 */
export function applyTable<Row>(
  rows: readonly Row[],
  opts: {
    filter: (rows: readonly Row[]) => Row[];
    sortField: keyof Row;
    sortOrder: SortOrder;
    page?: number;
    pageSize?: number;
  },
): PagedResult<Row> {
  const filtered = opts.filter(rows);
  const sorted = sortRows(filtered, opts.sortField, opts.sortOrder);
  return paginate(sorted, { page: opts.page, pageSize: opts.pageSize });
}
