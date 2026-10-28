import { describe, it, expect } from "vitest";
import { dictionaries, type Locale } from "@workspace/i18n";
import { createLiveStrings } from "./live-strings";

describe("createLiveStrings", () => {
  it("una referencia tomada una vez refleja el cambio de idioma", () => {
    let current: Locale = "en";
    const strings = createLiveStrings(() => dictionaries[current]);
    const s = strings.staffApp; // como el `const s = strings.staffApp` de las pantallas
    expect(s.credentialLogout).toBe(dictionaries.en.staffApp.credentialLogout);
    current = "es";
    expect(s.credentialLogout).toBe(dictionaries.es.staffApp.credentialLogout);
  });

  it("expone las claves del diccionario vigente", () => {
    const strings = createLiveStrings(() => dictionaries.en);
    expect(Object.keys(strings.staffApp)).toEqual(Object.keys(dictionaries.en.staffApp));
  });
});
