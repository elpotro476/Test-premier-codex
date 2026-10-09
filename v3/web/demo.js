/* Fictitious, volatile demonstration only. No network or browser persistence. */
"use strict";
window.V3Demo = () => {
  let products = [
    {
      id: crypto.randomUUID(),
      sku: "FICTIF-V3-001",
      ean: "4006381333931",
      designation: "Produit fictif — démonstration V3",
      brand: "Marque fictive",
      commercial_title: "",
      short_description: "Exemple sans usage commercial.",
      long_description: "",
      technical_description: "",
      dimensions: "",
      weight_kg: null,
      packaging: "",
      pack_quantity: null,
      family_id: null,
      variant_of: null,
      status: "draft",
      revision: 1,
      archived_at: null,
      updated_at: new Date().toISOString(),
    },
  ];
  let events = [];
  function event(p) {
    events.unshift({
      at: new Date().toISOString(),
      entity: "products",
      entity_id: p.id,
      action: "DEMO",
      actor_id: "Compte fictif",
    });
  }
  function current(p) {
    const r = products.find((x) => x.id === p.id);
    if (!r || r.revision !== p.revision) throw Error("Conflit de révision.");
    return r;
  }
  return {
    async spaces() {
      return [{ id: "demo", name: "Démonstration fictive en mémoire" }];
    },
    async membership() {
      return "admin";
    },
    async families() {
      return [];
    },
    async list(org, { search = "", archived = false, offset = 0 } = {}) {
      const rows = products.filter(
        (p) =>
          !!p.archived_at === archived &&
          [p.sku, p.ean, p.designation].some((v) =>
            String(v || "")
              .toLowerCase()
              .includes(search.toLowerCase()),
          ),
      );
      return {
        data: structuredClone(rows.slice(offset, offset + 50)),
        total: rows.length,
      };
    },
    async save(org, p, patch) {
      V3Domain.validate(patch);
      if (
        products.some(
          (x) =>
            x.id !== p?.id &&
            (x.sku.toLowerCase() === patch.sku.toLowerCase() ||
              (patch.ean && x.ean === patch.ean)),
        )
      )
        throw Error("SKU ou EAN déjà utilisé.");
      const r = p
        ? current(p)
        : { id: crypto.randomUUID(), revision: 0, archived_at: null };
      if (r.archived_at) throw Error("Restaurez la fiche avant modification.");
      Object.assign(r, patch, {
        revision: r.revision + 1,
        updated_at: new Date().toISOString(),
      });
      if (!p) products.push(r);
      event(r);
      return structuredClone(r);
    },
    async archive(org, p, archived) {
      const r = current(p);
      r.archived_at = archived ? new Date().toISOString() : null;
      r.revision++;
      event(r);
      return structuredClone(r);
    },
    async members() {
      return [];
    },
    async setRole() {
      throw Error("Les rôles réels nécessitent un projet Supabase.");
    },
    async history() {
      return structuredClone(events);
    },
  };
};
