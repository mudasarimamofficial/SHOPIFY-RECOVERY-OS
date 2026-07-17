export class GIDMapper {
  private map: Map<string, string> = new Map();

  /**
   * Registers a mapping between an original GID (from the backup) and the new GID (on the target store).
   */
  setMapping(oldGid: string, newGid: string) {
    if (!oldGid || !newGid) return;
    this.map.set(oldGid, newGid);
  }

  /**
   * Translates a GID. If no mapping exists, throws an error in strict mode (default).
   */
  get(oldGid: string, strict = true): string {
    const newGid = this.map.get(oldGid);
    if (!newGid && strict) {
      throw new Error(
        `Missing GID mapping for ${oldGid}. Dependency was not resolved prior to execution.`,
      );
    }
    return newGid || oldGid;
  }

  /**
   * Deeply scans an object and replaces any old GIDs with new GIDs based on the registry.
   */
  translatePayload(payload: any): any {
    if (typeof payload === "string") {
      // Very basic regex to catch simple GIDs.
      // In production, an AST or structured schema translator is safer.
      const match = payload.match(/gid:\/\/shopify\/[A-Za-z]+\/\d+/);
      if (match && this.map.has(match[0])) {
        return payload.replace(match[0], this.map.get(match[0])!);
      }
      return payload;
    }

    if (Array.isArray(payload)) {
      return payload.map((item) => this.translatePayload(item));
    }

    if (typeof payload === "object" && payload !== null) {
      const translated: any = {};
      for (const [key, value] of Object.entries(payload)) {
        // Special case: don't translate IDs that are meant to be new or omitted,
        // but typically a payload builder handles omitting the root ID.
        translated[key] = this.translatePayload(value);
      }
      return translated;
    }

    return payload;
  }

  export(): Record<string, string> {
    return Object.fromEntries(this.map.entries());
  }

  import(mappings: Record<string, string>) {
    for (const [key, val] of Object.entries(mappings)) {
      this.map.set(key, val);
    }
  }
}
