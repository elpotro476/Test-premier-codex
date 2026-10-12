"use strict";
(() => {
  let data = null,
    input = null,
    plan = null,
    file = null,
    generation = 0;
  const node = (id) => document.getElementById(id);
  const guard = (fn) => async () => {
    try {
      await fn();
    } catch (e) {
      notify(e.message, true);
    }
  };
  function clear() {
    plan = null;
    node("opt-preview").hidden = true;
    node("opt-consent").checked = false;
    node("opt-save").disabled = true;
  }
  const labels = Object.fromEntries(
    OptimizedExcel.keys.map((k, i) => [
      k,
      /^(MAIN|PT\d{2})$/.test(k)
        ? "Image " + k
        : /^argument/.test(k)
          ? "Argument commercial " + k.slice(-1)
          : {
              title: "Titre commercial",
              pvc: "PVC — valeur source",
              weightSource: "Poids source avec unité",
              commercialPackaging: "Conditionnement commercial",
              countryOrigin: "Pays d’origine",
              html: "Description HTML",
            }[k] || OptimizedExcel.headers[i],
    ]),
  );
  const format = (content) =>
    OptimizedExcel.keys
      .map((k) => labels[k] + "\n" + (content[k] ?? "(vide)"))
      .join("\n\n");
  function history() {
    const p = data?.products.find((p) => p.id === node("opt-product").value);
    node("opt-history").replaceChildren(
      ...(p?.optimizedExcel || []).map((v, i) => {
        const details = document.createElement("details"),
          summary = document.createElement("summary"),
          text = document.createElement("textarea");
        summary.textContent =
          "Version " +
          (i + 1) +
          " · " +
          v.at +
          " · " +
          v.file +
          " · ligne " +
          v.row;
        text.readOnly = true;
        text.rows = 10;
        text.value =
          "Texte Excel original\n\n" +
          format(
            Object.fromEntries(
              OptimizedExcel.keys.map((k, i) => [k, v.source[i]]),
            ),
          ) +
          "\n\nContenu conservé après cet import\n\n" +
          format(v.content) +
          "\n\nValeurs du catalogue avant cet import\n\n" +
          Object.entries(v.previousValues)
            .map(
              ([id, value]) =>
                (data.attributes.find((a) => a.id === id)?.label || id) +
                "\n" +
                value,
            )
            .join("\n\n");
        details.append(summary, text);
        return details;
      }),
    );
  }
  async function refresh() {
    data = await CatalogueStore.read();
    const id = node("opt-product").value;
    node("opt-product").replaceChildren(
      new Option("Choisir un SKU", ""),
      ...data.products
        .filter((p) => p.optimizedExcel?.length)
        .map((p) => new Option(p.values.sku, p.id)),
    );
    node("opt-product").value = id;
    history();
  }
  node("opt-file").addEventListener(
    "change",
    guard(async () => {
      const token = ++generation;
      clear();
      input = null;
      file = node("opt-file").files[0];
      node("opt-settings").hidden = true;
      if (!file) return;
      const handle = await BrowserExcel.openTemplate(file);
      if (token !== generation) return;
      node("opt-sheet").replaceChildren(
        ...handle.book.sheets.map((s) => new Option(s.name, s.name)),
      );
      node("opt-settings").hidden = false;
      node("opt-file-name").textContent = file.name;
    }),
  );
  for (const id of ["opt-sheet", "opt-header"])
    node(id).addEventListener("change", () => {
      generation++;
      clear();
    });
  node("opt-analyse").addEventListener(
    "click",
    guard(async () => {
      clear();
      if (!file) throw Error("Choisissez un fichier XLSX.");
      const token = ++generation;
      const candidate = await OptimizedExcel.read(
        file,
        node("opt-sheet").value,
        Number(node("opt-header").value),
      );
      if (token !== generation) return;
      input = candidate;
      await refresh();
      if (token !== generation) return;
      plan = OptimizedExcel.plan(data, input);
      const names = {
        add: "À créer",
        update: "À mettre à jour",
        error: "Erreur — bloquée",
        unchanged: "Identique",
      };
      node("opt-summary").textContent = Object.entries(names)
        .map(
          ([k, n]) => plan.items.filter((i) => i.action === k).length + " " + n,
        )
        .join(" · ");
      node("opt-rows").replaceChildren(
        ...plan.items.map((item) => {
          const details = document.createElement("details"),
            summary = document.createElement("summary"),
            check = document.createElement("input"),
            pre = document.createElement("pre");
          check.type = "checkbox";
          check.dataset.optimizedRow = item.row;
          check.disabled = !["add", "update"].includes(item.action);
          check.checked = item.action === "add";
          check.setAttribute("aria-label", "Importer ligne " + item.row);
          check.addEventListener("click", (e) => e.stopPropagation());
          check.addEventListener("change", () => {
            node("opt-consent").checked = false;
            node("opt-save").disabled = true;
          });
          summary.append(
            check,
            document.createTextNode(
              " Ligne " +
                item.row +
                " · " +
                (item.content.sku || "SKU absent") +
                " · " +
                names[item.action],
            ),
          );
          pre.className = "source-evidence";
          pre.textContent = [
            ...item.errors,
            ...item.missing,
            ...item.changes.map(
              (c) =>
                c.field +
                "\nAvant : " +
                (c.before || "(vide)") +
                "\nAprès : " +
                c.after,
            ),
            "\nContenu Excel lu (texte intégral) :\n" + format(item.content),
          ].join("\n\n");
          details.append(summary, pre);
          return details;
        }),
      );
      node("opt-preview").hidden = false;
    }),
  );
  node("opt-consent").addEventListener("change", () => {
    node("opt-save").disabled = !plan || !node("opt-consent").checked;
  });
  node("opt-save").addEventListener(
    "click",
    guard(async () => {
      if (!plan || !node("opt-consent").checked)
        throw Error("Validation humaine obligatoire.");
      node("opt-save").disabled = true;
      const selected = Array.from(
        node("opt-rows").querySelectorAll("input:checked"),
        (n) => Number(n.dataset.optimizedRow),
      );
      const next = OptimizedExcel.apply(data, plan, selected);
      await CatalogueStore.save(next, plan.revision);
      clear();
      await refresh();
      notify("Import Excel optimisé confirmé et enregistré localement.");
    }),
  );
  node("opt-product").addEventListener("change", history);
  document
    .querySelector('[data-studio-view="optimized"]')
    .addEventListener("click", guard(refresh));
  window.addEventListener("semin-catalogue-saved", () => {
    clear();
    guard(refresh)();
  });
})();
