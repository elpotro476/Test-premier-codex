/* Domain model, independent of IndexedDB and DOM: replaceable repository boundary. */
"use strict";
window.CatalogueModel = (() => {
  const FIELDS = [
    ["sku", "SKU", true],
    ["ean", "EAN", false],
    ["brand", "Marque", true],
    ["family", "Famille", false],
    ["designation", "Désignation", true],
    ["commercialTitle", "Titre commercial", false],
    ["shortDescription", "Description courte", false],
    ["longDescription", "Description longue", false],
    ["technical", "Caractéristiques techniques", false],
    ["packaging", "Conditionnement", false],
    ["weight", "Poids", false],
    ["dimensions", "Dimensions", false],
    ["images", "URLs images", false],
    ["manuals", "Notices", false],
    ["datasheets", "Fiches techniques", false],
    ["productStatus", "Statut produit", false],
  ].map(([id, label, required]) => ({
    id,
    label,
    required,
    type: "text",
    group: "Principal",
  }));
  const STATUSES = ["À compléter", "À contrôler", "Prêt à exporter", "Exporté"];
  const normalize = (value) =>
    String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const text = (value) =>
    value === null || value === undefined ? "" : String(value);
  const present = (value) => text(value).trim() !== "";
  const uid = () =>
    globalThis.crypto.randomUUID
      ? crypto.randomUUID()
      : "id-" +
        Date.now().toString(36) +
        "-" +
        Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) =>
          n.toString(16),
        ).join("");
  function empty() {
    return {
      schemaVersion: 1,
      revision: 0,
      products: [],
      attributes: structuredClone(FIELDS),
      history: [],
    };
  }
  function clone(data) {
    return structuredClone(data);
  }
  function eanValid(v) {
    const s = text(v);
    return (
      /^\d{13}$/.test(s) &&
      (Array.from(s.slice(0, 12)).reduce(
        (n, c, i) => n + Number(c) * (i % 2 ? 3 : 1),
        0,
      ) +
        Number(s[12])) %
        10 ===
        0
    );
  }
  function index(data) {
    const result = { sku: new Map(), ean: new Map() };
    for (const p of data.products)
      for (const k of ["sku", "ean"])
        if (present(p.values[k])) {
          const value = text(p.values[k]).trim();
          if (!result[k].has(value)) result[k].set(value, []);
          result[k].get(value).push(p);
        }
    return result;
  }
  function issues(product, data, lookup) {
    const result = [];
    for (const field of data.attributes) {
      const v = product.values[field.id];
      if (field.required && !present(v))
        result.push({
          field: field.label,
          message: "Information requise pour le catalogue maître",
        });
      if (
        present(v) &&
        field.type === "number" &&
        !Number.isFinite(Number(text(v).replace(",", ".")))
      )
        result.push({ field: field.label, message: "Nombre attendu" });
    }
    if (present(product.values.ean) && !eanValid(product.values.ean))
      result.push({ field: "EAN", message: "EAN-13 invalide" });
    for (const key of ["sku", "ean"])
      if (
        present(product.values[key]) &&
        (lookup
          ? lookup[key].get(text(product.values[key]).trim()) || []
          : data.products.filter(
              (p) =>
                text(p.values[key]).trim() === text(product.values[key]).trim(),
            )
        ).some((p) => p.id !== product.id)
      )
        result.push({
          field: key.toUpperCase(),
          message: "Identifiant dupliqué",
        });
    return result;
  }
  function guess(label, attributes) {
    const visual = window.Visuals?.guess(label);
    if (visual && attributes.some(a => a.id === visual)) return visual;
    const n = normalize(label);
    const match = attributes.filter((a) => normalize(a.label) === n);
    if (match.length === 1) return match[0].id;
    const aliases = {
      sku: ["reference", "reference produit", "seller sku", "ref"],
      ean: ["gtin", "ean13", "code barre", "barcode"],
      designation: ["nom", "nom produit", "product name", "item name"],
      brand: ["brand", "brand name"],
      family: ["categorie", "category", "gamme"],
      commercialTitle: ["titre", "title"],
      shortDescription: ["description"],
      longDescription: ["product description"],
      weight: ["weight", "poids kg"],
      images: ["images", "image url"],
    };
    return Object.keys(aliases).find((k) => aliases[k].includes(n)) || "";
  }
  function journal(data, type, count) {
    data.history.unshift({
      id: uid(),
      at: new Date().toISOString(),
      type,
      count,
    });
    data.history = data.history.slice(0, 100);
  }
  function planImport(data, rows, mapping, extraAttributes = []) {
    const attributes = [...data.attributes, ...extraAttributes];
    const ids = new Set(attributes.map((a) => a.id));
    const mapped = Object.values(mapping).filter(Boolean);
    if (!mapped.length) throw new Error("Associez au moins une colonne.");
    if (new Set(mapped).size !== mapped.length)
      throw new Error(
        "Deux colonnes ne peuvent pas alimenter le même attribut.",
      );
    if (mapped.some((id) => !ids.has(id)))
      throw new Error("Attribut de destination inconnu.");
    const incoming = rows.map((row) => {
      const values = {};
      for (const [column, field] of Object.entries(mapping))
        if (field) values[field] = text(row.values[column]);
      return { row: row.id, values };
    });
    const duplicates = new Set();
    for (const key of ["sku", "ean"]) {
      const groups = new Map();
      for (const row of incoming)
        if (present(row.values[key])) {
          const v = text(row.values[key]).trim();
          if (!groups.has(v)) groups.set(v, []);
          groups.get(v).push(row.row);
        }
      for (const group of groups.values())
        if (group.length > 1) group.forEach((id) => duplicates.add(id));
    }
    const lookup = index(data);
    const items = incoming.map((row) => {
      let reason = "";
      const matches = [
        ...new Set(
          ["sku", "ean"].flatMap((k) =>
            present(row.values[k])
              ? lookup[k].get(text(row.values[k]).trim()) || []
              : [],
          ),
        ),
      ];
      if (!present(row.values.sku) && !present(row.values.ean))
        reason = "SKU ou EAN nécessaire pour identifier le produit";
      else if (duplicates.has(row.row))
        reason = "SKU ou EAN dupliqué dans le fichier importé";
      else if (matches.length > 1)
        reason = "SKU et EAN correspondent à plusieurs fiches existantes";
      else if (
        matches.length === 1 &&
        present(matches[0].values.sku) &&
        present(row.values.sku) &&
        text(matches[0].values.sku).trim() !== text(row.values.sku).trim()
      )
        reason = "Cet EAN appartient déjà à une autre référence SKU";
      if (reason) return { ...row, action: "conflict", reason, changes: [] };
      const existing = matches[0];
      const changes = Object.entries(row.values)
        .filter(([key, v]) => !existing || text(existing.values[key]) !== v)
        .map(([field, after]) => ({
          field,
          label: attributes.find((a) => a.id === field).label,
          before: existing ? text(existing.values[field]) : "",
          after,
        }));
      return {
        ...row,
        action: existing ? (changes.length ? "update" : "unchanged") : "add",
        productId: existing?.id,
        changes,
      };
    });
    const targets = items.filter(
      (i) => i.action === "update" || i.action === "unchanged",
    );
    const counts = new Map();
    targets.forEach((i) =>
      counts.set(i.productId, (counts.get(i.productId) || 0) + 1),
    );
    items.forEach((i) => {
      if (i.productId && counts.get(i.productId) > 1) {
        i.action = "conflict";
        i.reason = "Plusieurs lignes tentent de modifier la même fiche";
      }
    });
    return {
      baseRevision: data.revision,
      items,
      extraAttributes,
      mapping: { ...mapping },
    };
  }
  function applyImport(data, plan, selectedRows) {
    if (plan.baseRevision !== data.revision)
      throw new Error(
        "Le catalogue a changé. Recommencez la prévisualisation.",
      );
    const items = plan.items.filter(
      (i) =>
        selectedRows.includes(i.row) && ["add", "update"].includes(i.action),
    );
    if (!items.length)
      throw new Error("Sélectionnez au moins un ajout ou une modification.");
    const next = clone(data),
      used = new Set(items.flatMap((i) => Object.keys(i.values)));
    next.attributes.push(...plan.extraAttributes.filter((a) => used.has(a.id)));
    const productMap = new Map(next.products.map((p) => [p.id, p])),
      modified = [];
    for (const item of items) {
      let product = productMap.get(item.productId);
      if (!product) {
        product = {
          id: uid(),
          values: {},
          status: "À compléter",
          updatedAt: "",
        };
        next.products.push(product);
      }
      product.values = { ...product.values, ...item.values };
      product.updatedAt = new Date().toISOString();
      modified.push(product);
    }
    const lookup = index(next);
    modified.forEach(
      (p) =>
        (p.status = issues(p, next, lookup).length
          ? "À compléter"
          : "À contrôler"),
    );
    if (next.products.length > 20000)
      throw new Error("Catalogue limité à 20 000 références.");
    journal(next, "Import catalogue confirmé", items.length);
    return next;
  }
  function editProduct(data, id, values, status) {
    if (!STATUSES.includes(status)) throw new Error("Statut inconnu.");
    const next = clone(data),
      product = next.products.find((p) => p.id === id);
    if (!product) throw new Error("Fiche introuvable.");
    for (const field of next.attributes)
      product.values[field.id] = text(values[field.id]);
    product.status = status;
    product.updatedAt = new Date().toISOString();
    const errors = issues(product, next);
    if (errors.some((e) => e.message === "Identifiant dupliqué"))
      throw new Error(
        "Ce SKU ou cet EAN est déjà utilisé par une autre fiche.",
      );
    if (errors.length && ["Prêt à exporter", "Exporté"].includes(status))
      throw new Error(
        "Corrigez les informations manquantes ou invalides avant de choisir ce statut.",
      );
    journal(next, "Fiche modifiée", 1);
    return next;
  }
  function addAttribute(data, label, type, required) {
    label = label.trim();
    if (!label || label.length > 100)
      throw new Error("Libellé requis (100 caractères maximum).");
    if (data.attributes.some((a) => normalize(a.label) === normalize(label)))
      throw new Error("Cet attribut existe déjà.");
    if (!["text", "number"].includes(type))
      throw new Error("Type d’attribut invalide.");
    if (data.attributes.length >= 250)
      throw new Error("250 attributs maximum.");
    const next = clone(data);
    next.attributes.push({
      id: "custom_" + uid(),
      label,
      type,
      required: !!required,
      group: "Attributs techniques",
    });
    journal(next, "Attribut ajouté", 1);
    return next;
  }
  function validateSnapshot(data) {
    const fail = () => {
      throw new Error(
        "Sauvegarde catalogue invalide ou version non prise en charge.",
      );
    };
    if (
      !data ||
      data.schemaVersion !== 1 ||
      !Number.isInteger(data.revision) ||
      data.revision < 0 ||
      !Array.isArray(data.products) ||
      data.products.length > 20000 ||
      !Array.isArray(data.attributes) ||
      data.attributes.length > 250 ||
      !Array.isArray(data.history)
    )
      fail();
    const attrIds = new Set();
    for (const a of data.attributes) {
      if (
        !a ||
        typeof a.id !== "string" ||
        !a.id ||
        attrIds.has(a.id) ||
        ["__proto__", "prototype", "constructor"].includes(a.id) ||
        typeof a.label !== "string" ||
        !a.label.trim() ||
        a.label.length > 100 ||
        !["text", "number"].includes(a.type) ||
        typeof a.required !== "boolean" ||
        typeof a.group !== "string"
      )
        fail();
      attrIds.add(a.id);
    }
    if (FIELDS.some((a) => !attrIds.has(a.id))) fail();
    const productIds = new Set();
    for (const p of data.products) {
      if (
        !p ||
        typeof p.id !== "string" ||
        !p.id ||
        productIds.has(p.id) ||
        !p.values ||
        Array.isArray(p.values) ||
        typeof p.values !== "object" ||
        !STATUSES.includes(p.status) ||
        typeof p.updatedAt !== "string"
      )
        fail();
      productIds.add(p.id);
      for (const [k, v] of Object.entries(p.values))
        if (!attrIds.has(k) || typeof v !== "string" || v.length > 100000)
          fail();
    }
    for (const p of data.products)
      if (p.dossier !== undefined) ProductWorkflow.validate(p.dossier);
    if (
      data.history.length > 100 ||
      data.history.some(
        (h) =>
          !h ||
          typeof h.id !== "string" ||
          typeof h.at !== "string" ||
          typeof h.type !== "string" ||
          !Number.isInteger(h.count) ||
          h.count < 0,
      )
    )
      fail();
    return clone(data);
  }
  function backup(data) {
    return {
      format: "SEMIN-MASTER-CATALOGUE",
      version: 1,
      createdAt: new Date().toISOString(),
      catalogue: validateSnapshot(data),
    };
  }
  function restore(data, backup) {
    return applyMerge(data, mergePlan(data, backup), true);
  }
  function mergePlan(data, backup) {
    validateSnapshot(data);
    if (
      !backup ||
      backup.format !== "SEMIN-MASTER-CATALOGUE" ||
      backup.version !== 1
    )
      throw new Error(
        "Ce fichier n’est pas une sauvegarde du catalogue maître.",
      );
    const incoming = validateSnapshot(backup.catalogue),
      existingById = new Map(data.products.map((p) => [p.id, p])),
      existingIndex = index(data),
      incomingIndex = index(incoming);
    const canonical = (value) =>
      JSON.stringify(value, (_, v) =>
        v && typeof v === "object" && !Array.isArray(v)
          ? Object.fromEntries(
              Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
            )
          : v,
      );
    const attributeConflicts = new Set(
      incoming.attributes
        .filter((a) =>
          data.attributes.some(
            (b) => b.id === a.id && canonical(a) !== canonical(b),
          ),
        )
        .map((a) => a.id),
    );
    const items = incoming.products.map((p) => {
      const matches = new Map();
      const sameId = existingById.get(p.id);
      if (sameId) matches.set(sameId.id, sameId);
      for (const k of ["sku", "ean"])
        if (present(p.values[k]))
          for (const q of existingIndex[k].get(p.values[k].trim()) || [])
            matches.set(q.id, q);
      let status = "Ajout",
        reason = "Nouvelle fiche — source originale conservée.";
      if (matches.size) {
        status =
          matches.size === 1 &&
          canonical([...matches.values()][0]) === canonical(p)
            ? "Identique"
            : "Conflit";
        reason =
          status === "Identique"
            ? "Fiche déjà présente, conservée."
            : "Identifiant déjà utilisé : fiche locale conservée, aucune modification.";
      } else if (
        ["sku", "ean"].some(
          (k) =>
            present(p.values[k]) &&
            (incomingIndex[k].get(p.values[k].trim()) || []).length > 1,
        )
      ) {
        status = "Conflit";
        reason =
          "Identifiant dupliqué dans la sauvegarde : aucun ajout automatique.";
      } else if (Object.keys(p.values).some((k) => attributeConflicts.has(k))) {
        status = "Conflit";
        reason =
          "Définition d’attribut différente : fiche locale et attributs conservés.";
      }
      return { product: clone(p), status, reason };
    });
    const adds = items.filter((i) => i.status === "Ajout");
    const extraAttributes = incoming.attributes.filter(
      (a) => !data.attributes.some((b) => b.id === a.id),
    );
    const plan = { baseRevision: data.revision, items, extraAttributes };
    validateSnapshot({
      ...clone(data),
      attributes: [...data.attributes, ...extraAttributes],
      products: [...data.products, ...adds.map((i) => i.product)],
    });
    return plan;
  }
  function applyMerge(data, plan, consent) {
    if (!consent)
      throw new Error("Confirmez la fusion après prévisualisation.");
    if (plan.baseRevision !== data.revision)
      throw new Error(
        "Le catalogue a changé. Recommencez la prévisualisation de fusion.",
      );
    const next = clone(data),
      adds = plan.items.filter((i) => i.status === "Ajout");
    next.attributes.push(...clone(plan.extraAttributes));
    next.products.push(...adds.map((i) => clone(i.product)));
    if (next.history.length < 100)
      journal(next, "Sauvegarde fusionnée sans écrasement", adds.length);
    return validateSnapshot(next);
  }
  return {
    FIELDS,
    STATUSES,
    index,
    empty,
    normalize,
    text,
    present,
    uid,
    issues,
    guess,
    planImport,
    applyImport,
    editProduct,
    addAttribute,
    validateSnapshot,
    backup,
    restore,
    mergePlan,
    applyMerge,
  };
})();
