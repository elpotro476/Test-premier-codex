/* Independent from the V1 prepared state. Only a copy of the selected sheet is edited. */
"use strict";
window.CastoramaExcel = (() => {
  async function open(file) {
    const h = await BrowserExcel.openTemplate(file),
      { book, all, direct, range, colLetter, NS } = h;
    const listCache = new Map();
    function getSheet(name) {
      const s = book.sheets.find((s) => s.name === name);
      if (!s) throw Error("Feuille introuvable.");
      return s;
    }
    function list(formula, s) {
      let expression = (formula || "").replace(/^=/, "").trim(),
        cacheKey = s.name + "|" + expression;
      if (listCache.has(cacheKey)) return listCache.get(cacheKey);
      const named = book.definedNames.find(
        (n) =>
          n.name === expression &&
          (n.scope === null || Number(n.scope) === book.sheets.indexOf(s)),
      );
      if (named) expression = named.formula.replace(/^=/, "");
      let result;
      if (/^".*"$/.test(expression))
        result = expression.slice(1, -1).split(",");
      else {
        const match =
          /^(?:'((?:[^']|'')+)'|([^'!]+))!([\$A-Z0-9]+(?::[\$A-Z0-9]+)?)$/.exec(
            expression,
          );
        if (!match) return null;
        const refSheet = getSheet((match[1] || match[2]).replace(/''/g, "'")),
          bounds = range(match[3]);
        if (
          (bounds.max.row - bounds.min.row + 1) *
            (bounds.max.col - bounds.min.col + 1) >
          100000
        )
          return null;
        result = [];
        for (let r = bounds.min.row; r <= bounds.max.row; r++)
          for (let c = bounds.min.col; c <= bounds.max.col; c++) {
            const ref = colLetter(c) + r,
              cell = refSheet.cells.get(ref);
            if (cell && direct(cell, "f").length) return null;
            const v = h.cellValue(refSheet, ref);
            if (v !== null && v !== "") result.push(String(v));
          }
      }
      result = [...new Set(result)];
      listCache.set(cacheKey, result);
      return result;
    }
    function validations(s, col, row) {
      return all(s.doc, "dataValidation").filter((v) =>
        (v.getAttribute("sqref") || "")
          .split(/\s+/)
          .filter(Boolean)
          .some((ref) => {
            const b = range(ref);
            return (
              col >= b.min.col &&
              col <= b.max.col &&
              (row === null || (row >= b.min.row && row <= b.max.row))
            );
          }),
      );
    }
    function options(name, col, row) {
      const s = getSheet(name),
        v = validations(s, Number(col), row).find(
          (v) => v.getAttribute("type") === "list",
        );
      return v ? list(direct(v, "formula1")[0]?.textContent, s) : null;
    }
    function inspect(name, header) {
      const s = getSheet(name);
      if (s.maxRow > 20000)
        throw Error(
          "Choisissez la feuille de produits ; cette feuille de référence dépasse 20 000 lignes.",
        );
      const target = h.headers(name, header);
      let last = header;
      for (const [ref, cell] of s.cells)
        if (
          direct(cell, "v").length ||
          direct(cell, "is").length ||
          direct(cell, "f").length
        )
          last = Math.max(last, h.address(ref).row);
      const metadata = book.sheets.find((s) => s.name === "Columns"),
        requirements = [];
      if (metadata)
        for (let r = 2; r <= metadata.maxRow; r++) {
          const label = h.cellValue(metadata, "B" + r);
          if (!label) continue;
          const col = target.find((c) => c.label === String(label));
          if (!col) continue;
          for (let c = 5; c <= metadata.maxCol; c++)
            if (
              String(h.cellValue(metadata, colLetter(c) + r)).toUpperCase() ===
              "REQUIRED"
            )
              requirements.push({
                column: col.id,
                category: String(
                  h.cellValue(metadata, colLetter(c) + "1") || "",
                ),
              });
        }
      return {
        target,
        startRow: last + 1,
        requirements,
        signature: JSON.stringify({
          marketplace: "Castorama",
          sheet: name,
          header,
          columns: target.map((c) => [c.id, c.label]),
        }),
        preview: Array.from({ length: Math.min(s.maxRow, 5) }, (_, i) => [
          i + 1,
          ...target.map((c) =>
            h.cellValue(
              s,
              colLetter(Number(c.id)) + (i + 1),
              ["sku", "ean"].includes(c.kind),
            ),
          ),
        ]),
      };
    }
    function compare(value, a, b, op) {
      return (
        {
          between: () => value >= a && value <= b,
          notBetween: () => value < a || value > b,
          equal: () => value === a,
          notEqual: () => value !== a,
          greaterThan: () => value > a,
          lessThan: () => value < a,
          greaterThanOrEqual: () => value >= a,
          lessThanOrEqual: () => value <= a,
        }[op || "between"]?.() ?? false
      );
    }
    function check(settings, products, mapping, required, signature) {
      const s = getSheet(settings.sheet),
        { target, requirements } = inspect(settings.sheet, settings.header),
        errors = [],
        rows = [];
      const start = Number(settings.startRow),
        last = start + products.length - 1;
      const add = (row, column, message) =>
        errors.push({ row, column, message });
      if (!products.length)
        add(0, "Produits", "Sélectionnez au moins un produit enregistré.");
      if (!Number.isInteger(start) || start <= settings.header || last > 20000)
        add(
          start,
          "Destination",
          "Ligne de destination invalide (après les en-têtes, maximum 20 000).",
        );
      if (
        all(s.doc, "tableParts").length ||
        all(s.doc, "sheetProtection").length
      )
        add(
          start,
          "Template",
          "Tableau structuré ou feuille protégée : modification non prise en charge.",
        );
      const extended = [...s.doc.getElementsByTagName("*")].some(
        (n) => n.localName === "dataValidation" && n.namespaceURI !== NS,
      );
      if (extended)
        add(
          start,
          "Template",
          "Validations Excel étendues non évaluables : export bloqué.",
        );
      for (let i = 0; i < products.length; i++) {
        const p = products[i],
          row = start + i,
          values = {};
        for (const col of target) {
          const c = Number(col.id),
            key = mapping[col.id] || "";
          let v =
            key === "manual"
              ? (p.dossier?.templateValues?.[signature]?.[col.id] ?? "")
              : ProductWorkflow.value(p, key);
          if (typeof v === "string" && /^[=+\-@]/.test(v))
            add(
              row,
              col.label,
              "Valeur pouvant être interprétée comme une formule.",
            );
          const n = OneBase.norm(col.label);
          const numeric =
            ["price", "stock", "weight"].includes(col.kind) ||
            [
              "prix offre",
              "quantite offre",
              "contenance ml",
              "quantite par pack",
              "temps de sechage au toucher h",
              "surface de couverture m2",
            ].includes(n);
          if (v !== "" && numeric) {
            const number = Number(String(v).replace(",", "."));
            if (
              !Number.isFinite(number) ||
              number < 0 ||
              ((["stock"].includes(col.kind) || n === "quantite offre") &&
                !Number.isInteger(number))
            )
              add(
                row,
                col.label,
                "Nombre positif ou nul attendu (stock entier).",
              );
            else v = number;
          }
          const ean =
            col.kind === "ean" ||
            n === "ean" ||
            (n === "id produit" && mapping[col.id] === "master.ean");
          if (
            v !== "" &&
            ean &&
            !CatalogueModel.issues(
              {
                id: p.id,
                values: { sku: p.values.sku, ean: String(v) },
                status: p.status,
              },
              { attributes: [], products: [] },
            ).every((e) => e.field !== "EAN")
          )
            add(row, col.label, "EAN-13 invalide.");
          values[col.id] = v;
          const ref = colLetter(c) + row,
            cell = s.cells.get(ref);
          if (
            cell &&
            (direct(cell, "v").length ||
              direct(cell, "is").length ||
              direct(cell, "f").length)
          )
            add(
              row,
              col.label,
              ref +
                " contient déjà une valeur ou une formule. Aucune cellule existante ne sera écrasée.",
            );
          for (const merge of all(s.doc, "mergeCell")) {
            const b = range(merge.getAttribute("ref"));
            if (
              c >= b.min.col &&
              c <= b.max.col &&
              row >= b.min.row &&
              row <= b.max.row
            )
              add(
                row,
                col.label,
                "Cellule fusionnée dans la zone de destination.",
              );
          }
          const rules = validations(s, c, row),
            columnRules = validations(s, c, null).filter(
              (v) =>
                v.getAttribute("type") && v.getAttribute("type") !== "none",
            );
          if (v !== "" && columnRules.length && !rules.length)
            add(
              row,
              col.label,
              "Destination hors de la plage de validation originale.",
            );
          for (const validation of rules) {
            const type = validation.getAttribute("type") || "none",
              blank = v === "" || v === null;
            if (blank) {
              if (
                validation.getAttribute("allowBlank") !== "1" &&
                validation.getAttribute("allowBlank") !== "true" &&
                type !== "none"
              )
                add(
                  row,
                  col.label,
                  "Valeur obligatoire selon la validation Excel.",
                );
              continue;
            }
            if (type === "list") {
              const allowed = list(
                direct(validation, "formula1")[0]?.textContent,
                s,
              );
              if (!allowed)
                add(
                  row,
                  col.label,
                  "Liste Excel non évaluable : vérifier le template.",
                );
              else if (!allowed.includes(String(v)))
                add(
                  row,
                  col.label,
                  "Valeur absente de la liste autorisée du template.",
                );
            } else if (["decimal", "whole", "textLength"].includes(type)) {
              const formulas = ["formula1", "formula2"].map(
                (f) => direct(validation, f)[0]?.textContent || "",
              );
              const op = validation.getAttribute("operator") || "between";
              if (
                !/^-?\d+(?:\.\d+)?$/.test(formulas[0]) ||
                (["between", "notBetween"].includes(op) &&
                  !/^-?\d+(?:\.\d+)?$/.test(formulas[1]))
              ) {
                add(
                  row,
                  col.label,
                  "Règle Excel calculée non prise en charge.",
                );
                continue;
              }
              const number =
                type === "textLength" ? String(v).length : Number(v);
              if (
                !Number.isFinite(number) ||
                (type === "whole" && !Number.isInteger(number)) ||
                !compare(number, Number(formulas[0]), Number(formulas[1]), op)
              )
                add(
                  row,
                  col.label,
                  "Valeur incompatible avec la validation Excel.",
                );
            } else if (type !== "none")
              add(
                row,
                col.label,
                "Validation " + type + " non prise en charge : export bloqué.",
              );
          }
          if (
            (n.includes("description") || key === "content.html") &&
            v !== "" &&
            typeof v === "string" &&
            v.includes("<")
          )
            OneBase.htmlIssues(v).forEach((m) => add(row, col.label, m));
        }
        const categoryCol = target.find(
            (c) => OneBase.norm(c.label) === "categorie",
          ),
          category = categoryCol ? String(values[categoryCol.id] || "") : "";
        if (
          /\d+\s*(?:et|ou|\/)\s*\d+\s*(?:L|kg)\b/i.test(p.values.packaging || "") &&
          !p.dossier?.variantConfirmed
        )
          add(
            row,
            "Conditionnement",
            "Plusieurs contenances sources : confirmez la variante via les saisies Castorama avant export.",
          );
        if (
          OneBase.norm(p.values.family || "") === "enduit" &&
          /peinture/i.test(p.values.technical || p.values.designation || "") &&
          (!category || /enduit/i.test(category))
        )
          add(
            row,
            "Catégorie",
            "Catégorie source Enduit incohérente avec une peinture : vérifiez la catégorie Castorama.",
          );
        const req = new Set([
          ...required,
          ...requirements
            .filter(
              (r) =>
                !requirements.some((x) => x.category === category) ||
                r.category === category,
            )
            .map((r) => r.column),
        ]);
        for (const id of req)
          if (values[id] === "" || values[id] === null)
            add(
              row,
              target.find((c) => c.id === id)?.label || id,
              "Champ obligatoire manquant.",
            );
        rows.push({ row, productId: p.id, values });
      }
      for (const col of target.filter(
        (c) =>
          ["sku", "ean"].includes(c.kind) ||
          ["boutique sku", "sku offre", "ean"].includes(OneBase.norm(c.label)),
      )) {
        const seen = new Set();
        for (const r of rows) {
          const v = r.values[col.id];
          if (v === "") continue;
          if (seen.has(String(v)))
            add(
              r.row,
              col.label,
              "Identifiant dupliqué parmi les produits sélectionnés.",
            );
          seen.add(String(v));
        }
        for (const [ref, cell] of s.cells) {
          const a = h.address(ref);
          if (
            a.col !== Number(col.id) ||
            a.row <= settings.header ||
            (a.row >= start && a.row <= last) ||
            direct(cell, "f").length
          )
            continue;
          const old = h.cellValue(s, ref, true);
          if (seen.has(String(old)))
            add(a.row, col.label, "Identifiant déjà présent dans le template.");
        }
      }
      return { target, rows, errors };
    }
    async function exportFile(
      settings,
      products,
      mapping,
      required,
      signature,
    ) {
      const result = check(settings, products, mapping, required, signature);
      if (result.errors.length)
        throw Error("Corrigez les erreurs avant export.");
      const s = getSheet(settings.sheet),
        doc = s.doc.cloneNode(true),
        data = all(doc, "sheetData")[0],
        rowMap = new Map(
          direct(data, "row").map((r) => [Number(r.getAttribute("r")), r]),
        );
      const ruleRows = all(s.doc, "dataValidation")
        .flatMap((v) =>
          (v.getAttribute("sqref") || "")
            .split(/\s+/)
            .filter(Boolean)
            .map((ref) => range(ref).min.row),
        )
        .filter((r) => r > settings.header);
      const first = ruleRows.length
        ? Math.min(...ruleRows)
        : [...s.cells.keys()]
            .map(h.address)
            .filter((a) => a.row > settings.header)
            .sort((a, b) => a.row - b.row)[0]?.row || settings.startRow;
      const model = rowMap.get(first);
      for (const item of result.rows) {
        let row = rowMap.get(item.row);
        if (!row) {
          row = doc.createElementNS(NS, "row");
          if (model)
            for (const attr of model.attributes)
              if (attr.name !== "r") row.setAttribute(attr.name, attr.value);
          row.setAttribute("r", String(item.row));
          data.insertBefore(
            row,
            direct(data, "row").find(
              (n) => Number(n.getAttribute("r")) > item.row,
            ) || null,
          );
          rowMap.set(item.row, row);
        }
        for (const col of result.target) {
          const v = item.values[col.id];
          const blank = v === "" || v === null || v === undefined;
          const ref = colLetter(Number(col.id)) + item.row;
          let cell = direct(row, "c").find((n) => n.getAttribute("r") === ref);
          if (!cell) {
            cell = doc.createElementNS(NS, "c");
            cell.setAttribute("r", ref);
            const style = s.cells
              .get(colLetter(Number(col.id)) + first)
              ?.getAttribute("s");
            if (style) cell.setAttribute("s", style);
            if (blank && !style) continue;
            row.insertBefore(
              cell,
              direct(row, "c").find(
                (n) => h.address(n.getAttribute("r")).col > Number(col.id),
              ) ||
                direct(row, "extLst")[0] ||
                null,
            );
          }
          if (blank) continue;
          if (typeof v === "number") {
            cell.removeAttribute("t");
            const n = doc.createElementNS(NS, "v");
            n.textContent = String(v);
            cell.append(n);
          } else {
            cell.setAttribute("t", "inlineStr");
            const is = doc.createElementNS(NS, "is"),
              n = doc.createElementNS(NS, "t");
            n.setAttributeNS(
              "http://www.w3.org/XML/1998/namespace",
              "xml:space",
              "preserve",
            );
            n.textContent = String(v);
            is.append(n);
            cell.append(is);
          }
        }
      }
      const dimension = all(doc, "dimension")[0];
      if (dimension) {
        const b = range(dimension.getAttribute("ref"));
        dimension.setAttribute(
          "ref",
          colLetter(b.min.col) +
            b.min.row +
            ":" +
            colLetter(b.max.col) +
            Math.max(b.max.row, ...result.rows.map((r) => r.row)),
        );
      }
      const zip = await JSZip.loadAsync(book.bytes);
      zip.file(s.path, new XMLSerializer().serializeToString(doc), {
        createFolders: false,
      });
      return zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    }
    return {
      sheets: book.sheets.map((s) => ({ name: s.name, rows: s.maxRow })),
      inspect,
      options,
      check,
      exportFile,
    };
  }
  return { open };
})();
