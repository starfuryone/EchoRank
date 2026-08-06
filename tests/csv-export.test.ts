// The shared CSV serializer.
//
// The two cases that matter most to a real user are at the top: the BOM (an
// export without it renders accented keywords as mojibake in Excel) and the
// formula guard (these tables carry scraped page titles and anchor texts, so
// a cell beginning "=" is someone else's code arriving on an analyst's laptop).
import { describe, it, expect } from "vitest";
import {
  FORMULA_TRIGGERS,
  UTF8_BOM,
  contentDisposition,
  csvFilename,
  csvHeader,
  csvRow,
  formatValue,
  guardFormula,
  quoteField,
  toCsv,
  truncationNotice,
  type CsvColumn,
} from "@/lib/csv-export";

interface Row {
  keyword: string;
  volume: number;
  checked: Date;
}

const COLUMNS: CsvColumn<Row>[] = [
  { header: "Keyword", value: (r) => r.keyword },
  { header: "Volume", value: (r) => r.volume },
  { header: "Checked", value: (r) => r.checked },
];

const ROW: Row = {
  keyword: "café near me",
  volume: 1200,
  checked: new Date("2026-08-06T12:00:00.000Z"),
};

describe("encoding and line endings", () => {
  it("starts with the UTF-8 BOM", () => {
    // Without this Excel falls back to the system codepage and every accent in
    // the file arrives mangled.
    const csv = toCsv([ROW], COLUMNS);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv.codePointAt(0)).toBe(0xfeff);
  });

  it("omits the BOM when the caller writes it itself", () => {
    // The streaming routes emit the BOM as the response's first bytes.
    expect(toCsv([ROW], COLUMNS, { bom: false }).startsWith(UTF8_BOM)).toBe(false);
  });

  it("uses CRLF between records and ends with one", () => {
    const csv = toCsv([ROW], COLUMNS, { bom: false });
    expect(csv).toBe("Keyword,Volume,Checked\r\ncafé near me,1200,2026-08-06T12:00:00.000Z\r\n");
    // No bare LF anywhere.
    expect(/[^\r]\n/.test(csv)).toBe(false);
  });

  it("round-trips accented text unchanged", () => {
    expect(toCsv([ROW], COLUMNS)).toContain("café near me");
  });
});

describe("formula-injection guard", () => {
  it("neutralises every trigger character", () => {
    for (const trigger of FORMULA_TRIGGERS) {
      const cell = `${trigger}cmd|'/c calc'!A0`;
      expect(guardFormula(cell, false)).toBe(`'${cell}`);
    }
    // Six triggers, so a new one cannot be added without updating this test.
    expect(FORMULA_TRIGGERS).toHaveLength(6);
  });

  it("guards an untrusted string that arrives through a column", () => {
    const rows = [{ ...ROW, keyword: "=HYPERLINK(\"http://evil\",\"click\")" }];
    const csv = toCsv(rows, COLUMNS, { bom: false });
    // Guarded first, then quoted because it contains a comma and quotes.
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""click"")"`);
  });

  it("does NOT mangle negative numbers", () => {
    // A blind guard would write "'-42" and turn every rank delta in the file
    // into text that will not sum or sort.
    const columns: CsvColumn<{ delta: number }>[] = [
      { header: "Delta", value: (r) => r.delta },
    ];
    expect(toCsv([{ delta: -42 }], columns, { bom: false })).toBe("Delta\r\n-42\r\n");
    expect(guardFormula("-42", true)).toBe("-42");
  });

  it("still guards a numeric-looking STRING, which could be an expression", () => {
    // "-2+3" is indistinguishable from a negative number until it evaluates.
    expect(guardFormula("-2+3", false)).toBe("'-2+3");
  });

  it("leaves an empty cell alone", () => {
    expect(guardFormula("", false)).toBe("");
  });

  it("does not guard a trigger character in the middle of a value", () => {
    expect(guardFormula("a=b", false)).toBe("a=b");
  });
});

describe("RFC 4180 quoting", () => {
  it("quotes only when the field needs it", () => {
    expect(quoteField("plain")).toBe("plain");
    expect(quoteField("has,comma")).toBe('"has,comma"');
    expect(quoteField('has"quote')).toBe('"has""quote"');
    expect(quoteField("has\nnewline")).toBe('"has\nnewline"');
    expect(quoteField("has\rcarriage")).toBe('"has\rcarriage"');
  });

  it("keeps an embedded newline inside one quoted field", () => {
    const columns: CsvColumn<{ title: string }>[] = [
      { header: "Title", value: (r) => r.title },
    ];
    const csv = toCsv([{ title: "line one\nline two" }], columns, { bom: false });
    expect(csv).toBe('Title\r\n"line one\nline two"\r\n');
  });

  it("quotes a header that needs it", () => {
    expect(csvHeader([{ header: "Rank, current", value: () => "" }])).toBe('"Rank, current"');
  });
});

describe("default formatting", () => {
  it("renders dates as ISO 8601", () => {
    expect(formatValue(new Date("2026-08-06T12:00:00Z"))).toBe("2026-08-06T12:00:00.000Z");
  });

  it("renders numbers unlocalized — no separators, dot decimal", () => {
    expect(formatValue(1234567.89)).toBe("1234567.89");
    expect(formatValue(0)).toBe("0");
  });

  it("renders null and undefined as empty, not as the word", () => {
    expect(formatValue(null)).toBe("");
    expect(formatValue(undefined)).toBe("");
  });

  it("does not emit [object Object] or an Invalid Date", () => {
    expect(formatValue({ a: 1 })).toBe('{"a":1}');
    expect(formatValue(new Date("nonsense"))).toBe("");
    expect(formatValue(Number.NaN)).toBe("");
  });

  it("honours a column's own formatter over the default", () => {
    const columns: CsvColumn<Row>[] = [
      { header: "Volume", value: (r) => r.volume, format: (v) => `${v} searches` },
    ];
    expect(csvRow(ROW, columns)).toBe("1200 searches");
  });

  it("guards a custom formatter's output too", () => {
    // A formatter is not a trust boundary; it can return a scraped string.
    const columns: CsvColumn<Row>[] = [
      { header: "Keyword", value: (r) => r.keyword, format: () => "=1+1" },
    ];
    expect(csvRow(ROW, columns)).toBe("'=1+1");
  });
});

describe("filenames and headers", () => {
  it("builds echorank-<tool>-<yyyy-mm-dd>.csv in UTC", () => {
    expect(csvFilename("rank-tracker", new Date("2026-08-06T23:30:00Z"))).toBe(
      "echorank-rank-tracker-2026-08-06.csv",
    );
  });

  it("slugifies a tool name with spaces or capitals", () => {
    expect(csvFilename("Keywords Explorer", new Date("2026-01-02T00:00:00Z"))).toBe(
      "echorank-keywords-explorer-2026-01-02.csv",
    );
  });

  it("produces an attachment disposition", () => {
    expect(contentDisposition("echorank-backlinks-2026-08-06.csv")).toBe(
      'attachment; filename="echorank-backlinks-2026-08-06.csv"',
    );
  });

  it("cannot be talked into breaking out of the header", () => {
    expect(contentDisposition('a";x="b')).toBe('attachment; filename="a;x=b"');
  });
});

describe("truncation notice", () => {
  it("says so in the file, in the first column, padded to the column count", () => {
    // A silent cut looks exactly like a complete export to whoever opens it.
    const line = truncationNotice(COLUMNS, 50000);
    // Unquoted, because the message deliberately contains no comma — the
    // padding commas after it are the empty remaining columns.
    expect(line).toBe("TRUNCATED: export limited to 50000 rows. Narrow your filters to see the rest.,,");
    expect(line.split(",")).toHaveLength(COLUMNS.length);
    expect(line).toContain("TRUNCATED");
  });
});

describe("whole documents", () => {
  it("serializes an empty result set as a header line only", () => {
    // Not an empty file: an analyst who exported a filter that matched nothing
    // should still see the columns and know the export worked.
    expect(toCsv([], COLUMNS, { bom: false })).toBe("Keyword,Volume,Checked\r\n");
  });
});
