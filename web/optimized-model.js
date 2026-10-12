/* Confirmed Excel content versions. Source text is kept exactly, never interpreted as OneBase. */
"use strict";
window.OptimizedExcel = (() => {
  const headers = [
    "Titre/Désignation",
    "EAN",
    "SKU",
    "PVC",
    "STOCK",
    "Image 1/principale/MAIN",
    "Image 2/secondaire/PT01",
    "Image 3/secondaire/PT01",
    "Image 4/secondaire/PT01",
    "Image 5/secondaire/PT01",
    "Image 6/secondaire/PT01",
    "Poids",
    "Conditionnement",
    "Fabriqué/Pays d'origine",
    "PUCE/avantages marketing",
    "PUCE/avantages marketing",
    "PUCE/avantages marketing",
    "PUCE/avantages marketing",
    "PUCE/avantages marketing",
    "DESCRIPTION",
  ];
  const keys = [
    "title",
    "ean",
    "sku",
    "pvc",
    "stock",
    "MAIN",
    "PT01",
    "PT02",
    "PT03",
    "PT04",
    "PT05",
    "weightSource",
    "commercialPackaging",
    "countryOrigin",
    "argument1",
    "argument2",
    "argument3",
    "argument4",
    "argument5",
    "html",
  ];
  const attrs = {
    title: ["commercialTitle", "Titre commercial"],
    html: ["longDescription", "Description longue"],
    pvc: ["optimizedPVC", "PVC — valeur source"],
    stock: ["stock", "Stock"],
    weightSource: ["optimizedWeightSource", "Poids — valeur source Excel"],
    commercialPackaging: ["commercialPackaging", "Conditionnement commercial"],
    countryOrigin: ["countryOrigin", "Pays d’origine"],
    ean: ["ean", "EAN"],
    sku: ["sku", "SKU"],
  };
  for (const k of keys.filter((k) => /^argument/.test(k)))
    attrs[k] = ["optimized_" + k, "Excel optimisé · Argument " + k.slice(-1)];
  for (const slot of Visuals.slots(6))
    attrs[slot] = [Visuals.id(slot), "Visuel " + slot + " · URL"];
  const contentKeys = [...keys, "condition"];
  function validateArchive(archive) {
    if (!Array.isArray(archive) || archive.length > 100)
      throw Error(
        "Historique Excel optimisé invalide ou limité à 100 versions.",
      );
    for (const entry of archive) {
      if (
        !entry ||
        entry.version !== 1 ||
        typeof entry.at !== "string" ||
        typeof entry.file !== "string" ||
        entry.file.length > 300 ||
        typeof entry.sheet !== "string" ||
        typeof entry.row !== "number" ||
        !Array.isArray(entry.source) ||
        entry.source.length !== 20 ||
        entry.source.some((v) => typeof v !== "string" || v.length > 100000) ||
        !entry.content ||
        Array.isArray(entry.content) ||
        typeof entry.content !== "object" ||
        Object.entries(entry.content).some(
          ([k, v]) =>
            !contentKeys.includes(k) ||
            typeof v !== "string" ||
            v.length > 100000,
        ) ||
        entry.content.condition !== "new" ||
        !entry.previousValues ||
        typeof entry.previousValues !== "object" ||
        Array.isArray(entry.previousValues) ||
        Object.values(entry.previousValues).some(
          (v) => typeof v !== "string" || v.length > 100000,
        )
      )
        throw Error("Historique Excel optimisé invalide.");
    }
  }
  function latest(p) {
    return p.optimizedExcel?.at(-1)?.content || null;
  }
  async function read(file, sheetName, headerRow = 1) {
    const handle = await BrowserExcel.openTemplate(file);
    const sheet =
      handle.book.sheets.find((s) => s.name === sheetName) ||
      handle.book.sheets[0];
    if (!Number.isInteger(headerRow) || headerRow < 1)
      throw Error("Ligne d’en-têtes invalide.");
    const columns = handle.headers(sheet.name, headerRow);
    if (columns.length !== 20 || columns.some((c, i) => Number(c.id) !== i + 1))
      throw Error("Le modèle doit contenir exactement les 20 colonnes A à T.");
    for (let i = 0; i < 20; i++) {
      const n = CatalogueModel.normalize(columns[i].label),
        expected = CatalogueModel.normalize(headers[i]);
      if (i >= 5 && i <= 10) {
        if (!n.startsWith("image " + (i - 4) + " "))
          throw Error(
            "Colonne image inattendue en " + String.fromCharCode(65 + i),
          );
      } else if (n !== expected)
        throw Error(
          "En-tête inattendu en " +
            String.fromCharCode(65 + i) +
            " : " +
            columns[i].label,
        );
    }
    const rows = [];
    for (let row = headerRow + 1; row <= sheet.maxRow; row++) {
      const cells = keys.map((k, i) => {
        const ref = handle.colLetter
          ? handle.colLetter(i + 1) + row
          : String.fromCharCode(65 + i) + row;
        const cell = sheet.cells.get(ref);
        if (cell && handle.direct(cell, "f").length)
          throw Error(
            "Formule non acceptée dans " +
              ref +
              " : fournir la valeur explicite.",
          );
        return String(handle.cellValue(sheet, ref, i === 1 || i === 2) ?? "");
      });
      if (cells.some((v) => v.trim()))
        rows.push({
          row,
          source: cells,
          content: Object.fromEntries(keys.map((k, i) => [k, cells[i]])),
        });
    }
    if (!rows.length) throw Error("Aucune référence à importer.");
    if (rows.length > 20000) throw Error("Import limité à 20 000 références.");
    return {
      file: file.name,
      sheet: sheet.name,
      headers: columns.map((c) => c.label),
      rows,
    };
  }
  function eanValid(s) {
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
  function plan(data, input) {
    const lookup = CatalogueModel.index(data);
    const skuGroups = new Map(),
      eanGroups = new Map();
    for (const r of input.rows)
      for (const [key, map] of [
        ["sku", skuGroups],
        ["ean", eanGroups],
      ]) {
        const v = r.content[key].trim();
        if (v) map.set(v, (map.get(v) || 0) + 1);
      }
    const items = input.rows.map((r) => {
      const content = {
          ...r.content,
          sku: r.content.sku.trim(),
          ean: r.content.ean.trim(),
        },
        errors = [],
        missing = [];
      const existing = lookup.sku.get(content.sku) || [];
      if (!content.sku) errors.push("SKU obligatoire.");
      else if (
        !/^[\p{L}\p{N}][\p{L}\p{N}._/+&-]{0,79}$/u.test(content.sku) ||
        /^\d{9}-\d{5}$/.test(content.sku)
      )
        errors.push(
          "SKU commercial invalide ; ne pas utiliser la référence OneBase.",
        );
      if (skuGroups.get(content.sku) > 1)
        errors.push("SKU dupliqué dans le fichier.");
      if (content.ean && !eanValid(content.ean))
        errors.push("EAN-13 invalide.");
      if (content.ean && eanGroups.get(content.ean) > 1)
        errors.push("EAN dupliqué dans le fichier.");
      if (existing.length > 1) errors.push("SKU ambigu dans le catalogue.");
      const old = existing.length === 1 ? existing[0] : null;
      if (
        content.ean &&
        (lookup.ean.get(content.ean) || []).some((p) => p.id !== old?.id)
      )
        errors.push("Cet EAN appartient déjà à un autre SKU.");
      if (old?.values.ean && content.ean && old.values.ean !== content.ean)
        errors.push(
          "EAN différent de celui enregistré pour ce SKU : correction manuelle nécessaire.",
        );
      for (const slot of Visuals.slots(6)) {
        const issue = Visuals.issue(content[slot]);
        if (issue) errors.push(slot + " : " + issue);
      }
      if (
        content.stock.trim() &&
        (!/^\d+$/.test(content.stock.trim()) ||
          !Number.isSafeInteger(Number(content.stock)))
      )
        errors.push("Stock : entier positif ou nul requis.");
      if (!content.ean && !old?.values.ean) missing.push("EAN absent.");
      for (const k of [
        "title",
        "html",
        "argument1",
        "argument2",
        "argument3",
        "argument4",
        "argument5",
      ])
        if (!content[k].trim() && !latest(old || {})?.[k])
          missing.push(k + " absent.");
      if (!old?.values.designation)
        missing.push(
          "Désignation technique / OneBase absente de ce modèle ; le titre commercial n’est pas utilisé comme source technique.",
        );
      if (!old?.values.brand)
        missing.push(
          "Marque non fournie dans ce modèle ; compléter le catalogue si nécessaire.",
        );
      if ((old?.optimizedExcel?.length || 0) >= 100)
        errors.push(
          "Historique limité à 100 versions ; aucune version existante ne sera supprimée.",
        );
      const changes = Object.entries(content)
        .filter(
          ([k, v]) =>
            v.trim() && attrs[k] && v !== (old?.values[attrs[k][0]] || ""),
        )
        .map(([k, v]) => ({
          field: attrs[k][1],
          before: old?.values[attrs[k][0]] || "",
          after: v,
        }));
      const merged = {
        ...Object.fromEntries(
          Object.entries(attrs).map(([k, [id]]) => [k, old?.values[id] || ""]),
        ),
        ...(latest(old || {}) || {}),
        ...Object.fromEntries(
          Object.entries(content).filter(([, v]) => v.trim()),
        ),
        condition: "new",
      };
      const archiveChange =
        !old || JSON.stringify(merged) !== JSON.stringify(latest(old) || {});
      return {
        ...r,
        content,
        merged,
        errors,
        missing,
        changes,
        id: old?.id,
        action: errors.length
          ? "error"
          : !old
            ? "add"
            : changes.length || archiveChange
              ? "update"
              : "unchanged",
      };
    });
    return { revision: data.revision, input, items };
  }
  function apply(data, plan, selected) {
    if (data.revision !== plan.revision)
      throw Error("Le catalogue a changé : recommencez la prévisualisation.");
    const chosen = plan.items.filter(
      (i) => selected.includes(i.row) && ["add", "update"].includes(i.action),
    );
    if (!chosen.length)
      throw Error("Sélectionnez au moins une création ou mise à jour valide.");
    const next = structuredClone(data);
    const products = new Map(next.products.map((p) => [p.id, p])),
      changed = new Set();
    for (const [id, label] of [
      ["lotContents", "Contenu du lot"],
      ["lotTotalWeight", "Poids total du lot"],
    ])
      if (!next.attributes.some((a) => a.id === id))
        next.attributes.push({
          id,
          label,
          type: "text",
          group: "Lot",
          required: false,
        });
    for (const item of chosen) {
      let p = products.get(item.id);
      const previousValues = structuredClone(p?.values || {});
      if (!p) {
        p = {
          id: CatalogueModel.uid(),
          values: {},
          status: "À compléter",
          updatedAt: new Date().toISOString(),
        };
        next.products.push(p);
      }
      for (const [k, v] of Object.entries(item.content)) {
        if (!v.trim() || !attrs[k]) continue;
        const [id, label] = attrs[k];
        const attribute = next.attributes.find((a) => a.id === id);
        if (
          attribute &&
          attribute.type !== "text" &&
          !(k === "stock" && attribute.type === "number")
        )
          throw Error("Attribut incompatible : " + label);
        if (!attribute)
          next.attributes.push({
            id,
            label,
            type: "text",
            group: "Excel optimisé",
            required: false,
          });
        p.values[id] = v;
      }
      p.optimizedExcel = p.optimizedExcel || [];
      p.optimizedExcel.push({
        version: 1,
        at: new Date().toISOString(),
        file: plan.input.file,
        sheet: plan.input.sheet,
        row: item.row,
        source: [...item.source],
        content: item.merged,
        previousValues,
      });
      p.updatedAt = new Date().toISOString();
      p.status = "À compléter";
      changed.add(p.id);
    }
    const finalIndex = CatalogueModel.index(next);
    for (const p of next.products)
      if (
        changed.has(p.id) &&
        !CatalogueModel.issues(p, next, finalIndex).length
      )
        p.status = "À contrôler";
    if (next.history.length < 100)
      next.history.unshift({
        id: CatalogueModel.uid(),
        at: new Date().toISOString(),
        type: "Import Excel optimisé confirmé",
        count: chosen.length,
      });
    return CatalogueModel.validateSnapshot(next);
  }
  const destinations = () =>
    [
      "title",
      "html",
      "argument1",
      "argument2",
      "argument3",
      "argument4",
      "argument5",
      "pvc",
      "weightSource",
      "commercialPackaging",
      "countryOrigin",
      "conditionCastorama",
      "conditionADEO",
      "conditionAmazon",
    ].map((k) => ({
      id: "excel." + k,
      label:
        "Excel optimisé validé · " +
        ({
          title: "Titre",
          html: "Description HTML",
          pvc: "PVC — sans règle de prix",
          weightSource: "Poids source",
          commercialPackaging: "Conditionnement commercial",
          countryOrigin: "Pays d’origine",
          conditionCastorama: "État Castorama · Neuf",
          conditionADEO: "État ADEO · Neuf",
          conditionAmazon: "État Amazon · Nouveau",
        }[k] || "Argument " + k.slice(-1)),
    }));
  function value(p, key) {
    const c = latest(p);
    if (!c) return "";
    if (/^condition(?:Castorama|ADEO|Amazon)$/.test(key))
      return key === "conditionAmazon" ? "Nouveau" : "Neuf";
    return c[key] || "";
  }
  function guess(label) {
    const n = CatalogueModel.normalize(label);
    if (["pvc"].includes(n)) return "excel.pvc";
    if (["conditionnement commercial"].includes(n))
      return "excel.commercialPackaging";
    if (
      [
        "titre designation",
        "titre",
        "titre produit",
        "nom",
        "nom commercial",
        "nom produit",
        "product name",
        "item name",
        "product title",
        "commercial title",
        "title",
      ].includes(n)
    )
      return "excel.title";
    if (
      [
        "description",
        "description html",
        "product description",
        "texte description",
      ].includes(n)
    )
      return "excel.html";
    const a =
      /(?:argument|bullet point|puces avantages marketing|avantage).*?([1-5])$/.exec(
        n,
      );
    return a ? "excel.argument" + a[1] : "";
  }
  return {
    headers,
    keys,
    read,
    plan,
    apply,
    latest,
    validateArchive,
    destinations,
    value,
    guess,
  };
})();
