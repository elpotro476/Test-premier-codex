"use strict";
(() => {
  const M = CatalogueModel,
    W = ProductWorkflow;
  let data = null,
    parsed = null,
    editId = null,
    plan = null,
    template = null,
    inspection = null,
    review = null,
    fileGeneration = 0;
  const mapping = {},
    required = new Set();
  const profileKey = "semin.castorama.local.profiles.v1";
  function announce(message, error = false) {
    notify(message, error);
  }
  function action(id, fn) {
    $(id).addEventListener("click", async () => {
      const b = $(id);
      b.disabled = true;
      try {
        await fn();
      } catch (e) {
        announce(e.message, true);
      } finally {
        if (id === "ob-confirm") b.disabled = !$("ob-consent").checked;
        else if (id !== "cast-export") b.disabled = false;
      }
    });
  }
  function invalidate() {
    review = null;
    $("cast-values-consent").checked = false;
    $("cast-export").disabled = true;
    $("cast-review-message").textContent =
      "Les données ont changé : relancez le contrôle avant export.";
  }
  function clearPlan() {
    plan = null;
    $("ob-confirm-panel").hidden = true;
    $("ob-consent").checked = false;
    $("ob-confirm").disabled = true;
  }
  function contents(container, values, overrides = false) {
    $(container).replaceChildren(
      ...W.enriched.map((key) => {
        const label = el(
            "label",
            key === "title"
              ? "Titre optimisé"
              : key === "html"
                ? "Description HTML"
                : "Argument commercial " + key.slice(-1),
          ),
          input = el(key === "html" ? "textarea" : "input");
        input.dataset.content = key;
        input.value = values?.[key] || "";
        input.maxLength = 100000;
        input.setAttribute(
          "aria-label",
          (overrides ? "Castorama · " : "Enrichissement · ") +
            label.textContent,
        );
        if (overrides) {
          const check = el("input");
          check.type = "checkbox";
          check.dataset.override = key;
          check.checked = Object.hasOwn(values || {}, key);
          check.setAttribute("aria-label", "Personnaliser Castorama · " + key);
          input.disabled = !check.checked;
          check.addEventListener("change", () => {
            input.disabled = !check.checked;
            clearPlan();
          });
          label.prepend(check, el("span", "Personnaliser pour Castorama"));
        }
        input.addEventListener("input", clearPlan);
        label.append(input);
        return label;
      }),
    );
  }
  function fields(values = {}, evidence = {}) {
    $("ob-source-fields").replaceChildren(
      ...OneBase.fields.map((f) => {
        const l = el("label", f.label),
          input = el(
            [
              "technical",
              "arguments",
              "shortDescription",
              "precautions",
              "storage",
              "abrasion",
            ].includes(f.id)
              ? "textarea"
              : "input",
          );
        input.dataset.source = f.id;
        input.value = values[f.id] || "";
        input.maxLength = 100000;
        input.setAttribute("aria-label", "Source corrigée · " + f.label);
        input.addEventListener("input", clearPlan);
        l.append(input);
        if (evidence[f.id]?.length) {
          const d = el("details"),
            s = el("summary", "Voir le passage source"),
            p = el("p", evidence[f.id].join("\n"));
          p.className = "source-evidence";
          d.append(s, p);
          l.append(d);
        }
        return l;
      }),
    );
  }
  function values() {
    return Object.fromEntries(
      [...$("ob-source-fields").querySelectorAll("[data-source]")].map((n) => [
        n.dataset.source,
        n.value,
      ]),
    );
  }
  function enrichment(id, overrides = false) {
    return Object.fromEntries(
      [...$(id).querySelectorAll("[data-content]")]
        .filter(
          (n) =>
            !overrides ||
            $(id).querySelector('[data-override="' + n.dataset.content + '"]')
              .checked,
        )
        .map((n) => [n.dataset.content, n.value]),
    );
  }
  function showForm(product = null) {
    editId = product?.id || null;
    parsed = null;
    clearPlan();
    $("ob-raw").value = product?.dossier?.source.raw || "";
    fields(product?.values, product?.dossier?.source.evidence);
    contents("ob-enrichment", product?.dossier?.enrichment);
    contents("ob-castorama", product?.dossier?.castorama, true);
    $("ob-editing").textContent = product
      ? "Modification de la fiche " +
        (product.values.sku || product.id) +
        " : les changements doivent être confirmés."
      : "Nouvelle fiche : aucune donnée enregistrée avant confirmation.";
    $("ob-form").hidden = false;
    $("ob-warnings").textContent = product?.dossier?.source.raw
      ? OneBase.parse(product.dossier.source.raw).warnings.join("\n")
      : "";
    $("ob-unclassified").textContent = "";
  }
  async function refresh() {
    data = await CatalogueStore.read();
    const selected = $("ob-existing").value,
      cast = $("cast-product").value;
    const options = data.products.map(
      (p) =>
        new Option(
          (p.values.sku || "Sans SKU") +
            " · " +
            (p.values.designation || "Sans désignation"),
          p.id,
        ),
    );
    $("ob-existing").replaceChildren(
      new Option("Choisir une fiche à modifier", ""),
      ...options,
    );
    $("cast-product").replaceChildren(
      new Option("Choisir un produit enregistré", ""),
      ...options.map((n) => n.cloneNode(true)),
    );
    $("ob-existing").value = selected;
    $("cast-product").value = cast;
    if (inspection) renderMapping();
    invalidate();
  }
  function currentProduct() {
    const p = data?.products.find((p) => p.id === $("cast-product").value);
    if (!p) throw Error("Choisissez un produit enregistré.");
    return p;
  }
  function settings() {
    return {
      sheet: $("cast-sheet").value,
      header: Number($("cast-header").value),
      startRow: Number($("cast-start").value),
    };
  }
  function manualValues() {
    return Object.fromEntries(
      [...$("cast-mapping").querySelectorAll("[data-manual]")]
        .filter((n) => mapping[n.dataset.manual] === "manual")
        .map((n) => [n.dataset.manual, n.value]),
    );
  }
  function proposedProduct() {
    const p = structuredClone(currentProduct());
    p.dossier = p.dossier || {
      version: 1,
      source: {
        raw: "",
        extracted: {},
        evidence: {},
        importedAt: new Date().toISOString(),
      },
      enrichment: {},
      castorama: {},
    };
    p.dossier.templateValues = {
      ...(p.dossier.templateValues || {}),
      [inspection.signature]: {
        ...(p.dossier.templateValues?.[inspection.signature] || {}),
        ...manualValues(),
      },
    };
    return p;
  }
  function renderMapping() {
    if (!inspection || !data) return;
    const p = data.products.find((p) => p.id === $("cast-product").value),
      dest = W.destinations(data);
    $("cast-mapping").replaceChildren(
      table(
        [
          "Colonne du template",
          "Source ou saisie spécifique",
          "Valeur Castorama pour ce produit",
          "Requis",
        ],
        inspection.target.map((col) => {
          const select = el("select");
          select.setAttribute("aria-label", "Mapping Castorama · " + col.label);
          select.append(
            new Option("Ne pas renseigner", ""),
            new Option("Saisie Castorama pour ce produit", "manual"),
            ...dest.map((d) => new Option(d.label, d.id)),
          );
          select.value = mapping[col.id] || "";
          const input = el("input");
          input.dataset.manual = col.id;
          input.setAttribute("aria-label", "Valeur Castorama · " + col.label);
          input.value =
            p?.dossier?.templateValues?.[inspection.signature]?.[col.id] || "";
          input.maxLength = 100000;
          input.disabled = select.value !== "manual";
          const allowed = template.options(
            settings().sheet,
            col.id,
            settings().startRow,
          );
          if (allowed?.length) {
            const list = el("datalist");
            list.id = "cast-options-" + col.id;
            allowed.slice(0, 200).forEach((v) => list.append(new Option(v, v)));
            input.setAttribute("list", list.id);
            input.after(list);
            const container = el("div");
            container.append(input, list);
            container.append(
              el(
                "small",
                allowed.length +
                  " valeurs autorisées (suggestions limitées à 200).",
              ),
            );
            input._container = container;
          }
          select.addEventListener("change", () => {
            mapping[col.id] = select.value;
            input.disabled = select.value !== "manual";
            invalidate();
          });
          input.addEventListener("input", invalidate);
          const label = el("label", undefined, "required-label"),
            checkbox = el("input");
          checkbox.type = "checkbox";
          checkbox.checked = required.has(col.id);
          checkbox.setAttribute(
            "aria-label",
            "Castorama requis · " + col.label,
          );
          checkbox.addEventListener("change", () => {
            checkbox.checked ? required.add(col.id) : required.delete(col.id);
            invalidate();
          });
          label.append(
            checkbox,
            el(
              "span",
              inspection.requirements.some((r) => r.column === col.id)
                ? "Requis dans Columns (selon catégorie)"
                : "Contrôle manuel",
            ),
          );
          return [col.label, select, input._container || input, label];
        }),
      ),
    );
  }
  function validProfiles(p) {
    if (
      !p ||
      typeof p !== "object" ||
      Array.isArray(p) ||
      Object.keys(p).length > 100
    )
      throw Error("Sauvegarde de mappings Castorama invalide.");
    for (const [name, profile] of Object.entries(p)) {
      if (
        !name.trim() ||
        name.length > 100 ||
        !profile ||
        typeof profile.signature !== "string" ||
        profile.signature.length > 30000 ||
        !profile.mapping ||
        typeof profile.mapping !== "object" ||
        Array.isArray(profile.mapping) ||
        !Array.isArray(profile.required) ||
        Object.entries(profile.mapping).some(
          ([k, v]) =>
            !/^\d+$/.test(k) ||
            typeof v !== "string" ||
            (v !== "" &&
              v !== "manual" &&
              !/^(master\.[A-Za-z0-9_-]+|content\.(title|html|argument[1-5]))$/.test(
                v,
              )),
        ) ||
        profile.required.some((k) => typeof k !== "string" || !/^\d+$/.test(k))
      )
        throw Error("Profil Castorama invalide.");
    }
    return p;
  }
  function profiles() {
    try {
      return validProfiles(
        JSON.parse(localStorage.getItem(profileKey) || "{}"),
      );
    } catch {
      throw Error(
        "Mappings Castorama illisibles : aucun remplacement automatique.",
      );
    }
  }
  function renderProfiles() {
    const p = profiles();
    $("cast-profile").replaceChildren(
      new Option("Choisir un mapping enregistré", ""),
      ...Object.keys(p).map((n) => new Option(n, n)),
    );
  }
  action("ob-new", () => showForm());
  $("ob-existing").addEventListener("change", () => {
    const p = data?.products.find((p) => p.id === $("ob-existing").value);
    if (p) showForm(p);
  });
  $("ob-raw").addEventListener("input", () => {
    parsed = null;
    clearPlan();
  });
  action("ob-analyse", () => {
    parsed = OneBase.parse($("ob-raw").value);
    fields(parsed.extracted, parsed.evidence);
    $("ob-form").hidden = false;
    $("ob-warnings").textContent = parsed.warnings.join("\n");
    $("ob-unclassified").textContent = parsed.unclassified.join("\n");
    clearPlan();
    announce(
      "Extraction locale terminée. Vérifiez les références, les passages sources et les ambiguïtés.",
    );
  });
  action("ob-demo", () => {
    showForm();
    $("ob-raw").value =
      "PRODUIT FICTIF MAT\n*Code produit*\n000000000-00001\n*EAN*\n5901234123457\n*Marque*\nMarque FICTIVE - FICTIVE\n*Catégorie*\nPeinture\n*Définition technique*\nPeinture acrylique mate intérieure et extérieure\n*Support admis*\nMurs et plafonds.\n*Conditionnement*\nSeau de démonstration — contenance à renseigner\n*Temps de séchage*\nSec : 2 h.\nRecouvrable : 6 h.\n*Les + produits 1*\nArgument fictif fourni par la source\nRéférence article : FICTIF-OB-001";
    $("ob-analyse").click();
  });
  action("ob-suggest", () => {
    contents("ob-enrichment", OneBase.suggestions(values()));
    clearPlan();
    announce(
      "Contenu préparé uniquement à partir des champs renseignés. Relisez-le ; les arguments absents restent vides.",
    );
  });
  action("ob-preview", async () => {
    data = await CatalogueStore.read();
    if (
      $("ob-raw").value &&
      !parsed &&
      $("ob-raw").value !==
        data.products.find((p) => p.id === editId)?.dossier?.source.raw
    )
      throw Error("Analysez le nouveau texte avant de prévisualiser.");
    plan = W.plan(
      data,
      parsed,
      values(),
      enrichment("ob-enrichment"),
      enrichment("ob-castorama", true),
      editId,
    );
    $("ob-changes").replaceChildren(
      table(
        ["Champ", "Avant", "Après"],
        plan.changes.map((c) => [c.field, c.before || "∅", c.after || "∅"]),
      ),
    );
    $("ob-confirm-panel").hidden = false;
    $("ob-confirm-title").textContent = plan.productId
      ? "Mettre à jour une fiche existante"
      : "Créer la fiche";
    $("ob-consent").checked = false;
    $("ob-confirm").disabled = true;
    announce("Prévisualisation prête. Aucun changement encore enregistré.");
  });
  $("ob-consent").addEventListener(
    "change",
    () => ($("ob-confirm").disabled = !$("ob-consent").checked),
  );
  action("ob-confirm", async () => {
    if (!plan || !$("ob-consent").checked)
      throw Error("Confirmez les changements avant enregistrement.");
    const next = W.apply(data, plan);
    const saved = await CatalogueStore.save(next, plan.revision);
    const p = saved.products.find((p) => p.values.sku === plan.values.sku);
    clearPlan();
    await refresh();
    if (p) {
      $("ob-existing").value = p.id;
      $("cast-product").value = p.id;
      showForm(p);
      if (inspection) renderMapping();
    }
    announce("Fiche OneBase enregistrée localement, texte original conservé.");
  });
  action("cast-demo-template", () => {
    const bytes = Uint8Array.from(atob(window.SEMIN_CASTORAMA_DEMO), (c) =>
      c.charCodeAt(0),
    );
    downloadLocal(
      new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "template-castorama-FICTIF.xlsx",
    );
  });
  $("cast-file").addEventListener("change", async (event) => {
    const f = event.target.files[0];
    if (!f) return;
    event.target.value = "";
    const generation = ++fileGeneration;
    template = null;
    inspection = null;
    invalidate();
    $("cast-prepared").hidden = true;
    $("cast-settings").hidden = true;
    $("cast-file-name").textContent = "Lecture du template en cours…";
    try {
      const opened = await CastoramaExcel.open(f);
      if (generation !== fileGeneration) return;
      template = opened;
      $("cast-file-name").textContent = f.name;
      $("cast-sheet").replaceChildren(
        ...opened.sheets.map((s) => new Option(s.name, s.name)),
      );
      $("cast-settings").hidden = false;
      announce(
        "Template lu localement. Les produits existants seront conservés.",
      );
    } catch (e) {
      announce(e.message, true);
    }
  });
  for (const id of ["cast-sheet", "cast-header"])
    $(id).addEventListener("change", () => {
      inspection = null;
      $("cast-prepared").hidden = true;
      invalidate();
    });
  $("cast-start").addEventListener("change", invalidate);
  $("cast-product").addEventListener("change", () => {
    invalidate();
    if (inspection) renderMapping();
  });
  action("cast-analyse", () => {
    if (!template) throw Error("Importez un template .xlsx.");
    const set = settings();
    inspection = template.inspect(set.sheet, set.header);
    $("cast-start").value = inspection.startRow;
    for (const k of Object.keys(mapping)) delete mapping[k];
    required.clear();
    inspection.target.forEach((c) => {
      mapping[c.id] = W.guess(c.label, data);
      if (c.required) required.add(c.id);
    });
    renderMapping();
    $("cast-prepared").hidden = false;
    $("cast-template-note").textContent =
      inspection.target.length +
      " colonnes · destination proposée ligne " +
      inspection.startRow +
      " · champs requis lus dans Columns quand cette feuille existe.";
    invalidate();
    announce(
      "Colonnes identifiées. Vérifiez le mapping et la destination ; aucun exemple produit n’est utilisé comme valeur par défaut.",
    );
  });
  action("cast-save-values", async () => {
    if (!$("cast-values-consent").checked)
      throw Error(
        "Confirmez les saisies Castorama et la variante avant enregistrement.",
      );
    if (!inspection) throw Error("Analysez le template.");
    const p = proposedProduct();
    p.dossier.variantConfirmed = true;
    const current = await CatalogueStore.read();
    if (current.revision !== data.revision)
      throw Error("Catalogue modifié : actualisez et recommencez.");
    current.products.find((x) => x.id === p.id).dossier = W.validate(p.dossier);
    current.products.find((x) => x.id === p.id).updatedAt =
      new Date().toISOString();
    current.history.unshift({
      id: M.uid(),
      at: new Date().toISOString(),
      type: "Valeurs spécifiques Castorama enregistrées",
      count: 1,
    });
    current.history = current.history.slice(0, 100);
    await CatalogueStore.save(current, data.revision);
    await refresh();
    announce("Valeurs Castorama enregistrées pour ce produit uniquement.");
  });
  action("cast-save-profile", () => {
    if (!inspection) throw Error("Analysez le template.");
    const name = $("cast-profile-name").value.trim();
    const next = {
      ...profiles(),
      [name]: {
        signature: inspection.signature,
        mapping: { ...mapping },
        required: [...required],
      },
    };
    validProfiles(next);
    localStorage.setItem(profileKey, JSON.stringify(next));
    renderProfiles();
    announce("Mapping Castorama enregistré localement, sans valeurs produits.");
  });
  $("cast-profile").addEventListener("change", () => {
    try {
      const p = profiles()[$("cast-profile").value];
      if (!p) return;
      if (!inspection || p.signature !== inspection.signature)
        throw Error(
          "Ce mapping ne correspond pas aux colonnes et à la feuille du template.",
        );
      const dest = new Set([
        "",
        "manual",
        ...W.destinations(data).map((d) => d.id),
      ]);
      if (Object.values(p.mapping).some((v) => !dest.has(v)))
        throw Error("Des attributs du mapping ne sont plus disponibles.");
      for (const k of Object.keys(mapping)) delete mapping[k];
      Object.assign(mapping, p.mapping);
      required.clear();
      p.required.forEach((k) => required.add(k));
      renderMapping();
      invalidate();
      announce("Mapping appliqué. Relancez le contrôle.");
    } catch (e) {
      announce(e.message, true);
    }
  });
  action("cast-backup-profiles", () =>
    downloadLocal(
      new Blob([JSON.stringify(profiles(), null, 2)], {
        type: "application/json",
      }),
      "semin-castorama-mappings.json",
    ),
  );
  $("cast-import-profiles").addEventListener("change", async (event) => {
    try {
      const f = event.target.files[0];
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) throw Error("Mappings limités à 2 Mo.");
      const imported = validProfiles(JSON.parse(await f.text())),
        old = profiles();
      if (Object.keys(imported).some((n) => Object.hasOwn(old, n)))
        throw Error(
          "Nom de mapping déjà utilisé : renommez le profil importé pour éviter un remplacement silencieux.",
        );
      localStorage.setItem(profileKey, JSON.stringify({ ...old, ...imported }));
      renderProfiles();
      announce("Mappings Castorama importés.");
    } catch (e) {
      announce(e.message, true);
    } finally {
      event.target.value = "";
    }
  });
  action("cast-check", async () => {
    if (!inspection) throw Error("Analysez le template.");
    const current = await CatalogueStore.read();
    if (current.revision !== data.revision) {
      await refresh();
      throw Error("Catalogue actualisé : relancez le contrôle.");
    }
    const p = proposedProduct(),
      result = template.check(
        settings(),
        [p],
        mapping,
        [...required],
        inspection.signature,
      );
    const unpersisted =
      JSON.stringify(p.dossier.templateValues) !==
      JSON.stringify(currentProduct().dossier?.templateValues || {});
    if (unpersisted && Object.keys(manualValues()).length)
      result.errors.push({
        row: settings().startRow,
        column: "Valeurs Castorama",
        message:
          "Enregistrez les saisies Castorama dans la fiche avant export.",
      });
    $("cast-errors").replaceChildren(
      table(
        ["Ligne", "Champ", "Erreur"],
        result.errors.map((e) => [e.row, e.column, e.message]),
      ),
    );
    $("cast-review").replaceChildren(
      table(
        result.target.map((c) => c.label),
        result.rows.map((r) => result.target.map((c) => r.values[c.id])),
      ),
    );
    $("cast-review-message").textContent = result.errors.length
      ? result.errors.length + " erreur(s) : export bloqué."
      : "Contrôle réussi selon les règles disponibles. Vérification humaine requise avant import marketplace.";
    review = result.errors.length
      ? null
      : {
          revision: data.revision,
          settings: settings(),
          product: structuredClone(p),
          mapping: { ...mapping },
          required: [...required],
          signature: inspection.signature,
        };
    $("cast-export").disabled = !review;
  });
  action("cast-export", async () => {
    if (!review) throw Error("Relancez le contrôle.");
    const checked = review,
      t = template;
    const current = await CatalogueStore.read();
    if (current.revision !== checked.revision)
      throw Error("Catalogue modifié depuis le contrôle : actualisez.");
    const blob = await t.exportFile(
      checked.settings,
      [checked.product],
      checked.mapping,
      checked.required,
      checked.signature,
    );
    const latest = await CatalogueStore.read();
    if (checked !== review || latest.revision !== checked.revision)
      throw Error(
        "Les données ont changé pendant l’export. Relancez le contrôle.",
      );
    downloadLocal(blob, "castorama-produits-a-verifier.xlsx");
    invalidate();
    announce(
      "Copie Excel générée. Le fichier importé et les produits existants sont conservés.",
    );
  });
  window.addEventListener("semin-catalogue-saved", () => {
    refresh().catch((e) => announce(e.message, true));
  });
  refresh().catch((e) => announce(e.message, true));
  try {
    renderProfiles();
  } catch (e) {
    announce(e.message, true);
  }
  showForm();
})();
