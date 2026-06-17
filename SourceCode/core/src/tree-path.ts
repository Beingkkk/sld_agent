export class TreePath {
  readonly segments: readonly number[];

  constructor(segments: number[]) {
    this.segments = Object.freeze([...segments]);
  }

  child(index: number): TreePath {
    return new TreePath([...this.segments, index]);
  }

  parent(): TreePath | null {
    if (this.segments.length === 0) return null;
    return new TreePath(this.segments.slice(0, -1));
  }

  equals(other: TreePath): boolean {
    if (this.segments.length !== other.segments.length) return false;
    return this.segments.every((s, i) => s === other.segments[i]);
  }

  toString(): string {
    return JSON.stringify(this.segments);
  }

  static fromString(str: string): TreePath {
    return new TreePath(JSON.parse(str));
  }

  toArray(): number[] {
    return [...this.segments];
  }
}
