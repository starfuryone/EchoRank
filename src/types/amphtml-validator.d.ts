// The slice of amphtml-validator (no bundled types) that src/lib/site-crawler/amp-validator.ts uses.
declare module "amphtml-validator" {
  export interface ValidationError {
    severity: "ERROR" | "WARNING" | "UNKNOWN_SEVERITY";
    line: number;
    col: number;
    message: string;
    code: string;
  }
  export interface ValidationResult {
    status: "PASS" | "FAIL" | "UNKNOWN";
    errors: ValidationError[];
  }
  export interface Validator {
    init(): Promise<void>;
    validateString(html: string, format?: string): ValidationResult;
  }
  export function newInstance(validatorJsContents: string): Validator;
}
