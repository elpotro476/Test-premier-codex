/* URL references only: no upload, image storage, proxy or hosting. */
"use strict";
window.Visuals = (() => {
  const slots = (count) => [
    "MAIN",
    ...Array.from(
      { length: count - 1 },
      (_, i) => "PT" + String(i + 1).padStart(2, "0"),
    ),
  ];
  const id = (slot) => "visual_" + slot;
  function issue(value) {
    if (!value) return "";
    if (value.length > 8000) return "URL limitée à 8 000 caractères.";
    try {
      if (/\s/.test(value)) throw Error();
      const u = new URL(value);
      if (
        !["http:", "https:"].includes(u.protocol) ||
        !u.hostname ||
        u.username ||
        u.password
      )
        throw Error();
      let path = u.pathname;
      for (let i = 0; i < 2; i++) {
        try {
          path = decodeURIComponent(path);
        } catch {
          break;
        }
      }
      if (
        /(^|\.)onebase\.fr$/i.test(u.hostname) &&
        /\/admin(?:\/|$)/i.test(path)
      )
        return "Lien d’administration OneBase refusé : utilisez une URL publique de l’image.";
      return "";
    } catch {
      return "URL HTTP ou HTTPS absolue requise, sans espace ni identifiant de connexion.";
    }
  }
  function batch(raw, current) {
    const next = { ...current },
      used = new Set();
    let sequential = 0;
    for (const line of raw
      .split(/\r\n?|\n/)
      .map((s) => s.trim())
      .filter(Boolean)) {
      const labelled = /^(MAIN|PT\d{2})\s*[:=]\s*(.+)$/i.exec(line);
      const slot = labelled
        ? labelled[1].toUpperCase()
        : slots(100)[sequential++];
      const value = labelled ? labelled[2].trim() : line;
      if (!slot || slot === "PT00" || used.has(slot))
        throw Error("Emplacement dupliqué ou limite de 100 visuels dépassée.");
      if (issue(value)) throw Error(slot + " : " + issue(value));
      used.add(slot);
      next[slot] = value;
    }
    if (!used.size) throw Error("Collez au moins une URL.");
    return next;
  }
  function guess(label) {
    const n = String(label)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    const own = /^visuel (main|pt\d{2}) url$/.exec(n);
    if (own) return id(own[1].toUpperCase());
    if (
      /^(main|main image url|main image|image principale|url image principale|image 1|image url 1|image url|main product image|main product image locator|image principale url)$/.test(
        n,
      )
    )
      return id("MAIN");
    const pt = /^(?:pt|pt )(\d{2})$/.exec(n);
    if (pt && +pt[1] > 0) return id("PT" + pt[1]);
    const number =
      /^(?:other image url|image|image url|url image|additional image|other product image locator|image secondaire) ?(\d{1,2})$/.exec(
        n,
      );
    if (number) {
      const index =
        +number[1] - (/^(other|additional|image secondaire)/.test(n) ? 0 : 1);
      if (index >= 0 && index < 100)
        return id(index ? "PT" + String(index).padStart(2, "0") : "MAIN");
    }
    return "";
  }
  function plan(data, productIds, values) {
    const keys = Object.keys(values);
    if (
      !keys.length ||
      keys.length > 100 ||
      keys.some((k) => !slots(100).includes(k))
    )
      throw Error("Emplacements invalides.");
    for (const [slot, value] of Object.entries(values))
      if (typeof value !== "string" || issue(value))
        throw Error(slot + " : " + (issue(value) || "URL invalide."));
    const ids = [...new Set(productIds)];
    if (
      !ids.length ||
      ids.some((id) => !data.products.some((p) => p.id === id && p.values.sku))
    )
      throw Error("Choisissez des fiches ayant un SKU.");
    const next = structuredClone(data),
      changes = [];
    for (const slot of keys) {
      const existing = next.attributes.find((a) => a.id === id(slot));
      if (existing && existing.type !== "text")
        throw Error("Attribut visuel incompatible : " + slot);
      if (!existing)
        next.attributes.push({
          id: id(slot),
          label: "Visuel " + slot + " · URL",
          type: "text",
          required: false,
          group: "Visuels",
        });
    }
    for (const product of next.products.filter((p) => ids.includes(p.id))) {
      for (const slot of keys) {
        const before = product.values[id(slot)] || "",
          after = values[slot];
        if (before !== after)
          changes.push({ sku: product.values.sku, slot, before, after });
        // Do not add blank values unnecessarily to existing records.
        if (after || Object.hasOwn(product.values, id(slot)))
          product.values[id(slot)] = after;
      }
      if (changes.some((c) => c.sku === product.values.sku)) {
        product.updatedAt = new Date().toISOString();
        product.status = "À contrôler";
      }
    }
    if (changes.length && next.history.length < 100)
      next.history.unshift({
        id: CatalogueModel.uid(),
        at: new Date().toISOString(),
        type: "Visuels URL confirmés",
        count: new Set(changes.map((c) => c.sku)).size,
      });
    CatalogueModel.validateSnapshot(next);
    return { revision: data.revision, next, changes };
  }
  return { slots, id, issue, batch, guess, plan };
})();
