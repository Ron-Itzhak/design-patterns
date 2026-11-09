export type ReportFormat = "csv" | "json" | "pdf";

export interface Filter {
  readonly field: string;
  readonly value: string;
}

export interface Sort {
  readonly field: string;
  readonly direction: "asc" | "desc";
}

/** The final product: fully read-only, including nested data. */
export interface ReportRequest {
  readonly from: Date;
  readonly to: Date;
  readonly filters: readonly Filter[];
  readonly format: ReportFormat;
  readonly sort?: Sort;
  readonly compressed: boolean;
}

/** Builds a ReportRequest step by step. All validation happens in build(). */
export class ReportRequestBuilder {
  private from?: Date;
  private to?: Date;
  private format?: ReportFormat;
  private sort?: Sort;
  private compressed = false;
  private filters: Filter[] = [];

  withDateRange(from: Date, to: Date): this {
    this.from = new Date(from); // copy: later changes to the caller's Date can't leak in
    this.to = new Date(to);
    return this;
  }

  addFilter(field: string, value: string): this {
    this.filters.push({ field, value });
    return this;
  }

  withFormat(format: ReportFormat): this {
    this.format = format;
    return this;
  }

  sortBy(field: string, direction: "asc" | "desc" = "asc"): this {
    this.sort = { field, direction };
    return this;
  }

  enableCompression(): this {
    this.compressed = true;
    return this;
  }

  build(): ReportRequest {
    // 1. required fields
    if (!this.from || !this.to) throw new Error("Date range is required");
    if (!this.format) throw new Error("Format is required");

    // 2. interdependent rules
    if (this.from > this.to) throw new RangeError("Date range is inverted: from is after to");
    if (this.compressed && this.format === "pdf") {
      throw new Error("Compression is not supported for pdf (already compressed)");
    }

    // 3. copy everything mutable, then freeze (arrays AND the objects inside)
    const request: ReportRequest = {
      from: new Date(this.from),
      to: new Date(this.to),
      format: this.format,
      compressed: this.compressed,
      filters: Object.freeze(this.filters.map((f) => Object.freeze({ ...f }))),
      ...(this.sort && { sort: Object.freeze({ ...this.sort }) }),
    };
    return Object.freeze(request);
  }
}
