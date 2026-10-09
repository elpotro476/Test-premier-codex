"use strict";
window.V3Domain = (() => {
  const fields = [
    ["sku", "SKU", "text", true],
    ["ean", "EAN-13 (facultatif)", "text"],
    ["designation", "Désignation", "text", true],
    ["brand", "Marque", "text", true],
    ["commercial_title", "Titre commercial", "text"],
    ["short_description", "Description courte", "textarea"],
    ["long_description", "Description longue", "textarea"],
    ["technical_description", "Caractéristiques techniques", "textarea"],
    ["dimensions", "Dimensions", "text"],
    ["weight_kg", "Poids (kg)", "number"],
    ["packaging", "Conditionnement", "text"],
    ["pack_quantity", "Quantité par conditionnement", "number"],
  ];
  const statuses = {
    draft: "À compléter",
    review: "À contrôler",
    ready: "Préparation terminée",
  };
  function validate(p) {
    if (!p.sku?.trim() || !p.designation?.trim() || !p.brand?.trim())
      throw Error("SKU, désignation et marque sont requis.");
    if (
      p.sku.trim().length > 100 ||
      p.designation.length > 500 ||
      p.brand.length > 150
    )
      throw Error(
        "SKU : 100 caractères ; désignation : 500 ; marque : 150 maximum.",
      );
    const e = p.ean?.trim();
    if (
      e &&
      (!/^\d{13}$/.test(e) ||
        (Array.from(e.slice(0, 12)).reduce(
          (n, c, i) => n + Number(c) * (i % 2 ? 3 : 1),
          0,
        ) +
          Number(e[12])) %
          10)
    )
      throw Error("EAN-13 invalide ; laissez le champ vide s’il est absent.");
    if (
      p.weight_kg !== null &&
      (!Number.isFinite(p.weight_kg) || p.weight_kg < 0)
    )
      throw Error("Poids positif ou nul attendu.");
    if (
      p.pack_quantity !== null &&
      (!Number.isInteger(p.pack_quantity) || p.pack_quantity <= 0)
    )
      throw Error("Quantité de conditionnement entière positive attendue.");
    if (!statuses[p.status]) throw Error("Statut invalide.");
    return p;
  }
  return { fields, statuses, validate };
})();
