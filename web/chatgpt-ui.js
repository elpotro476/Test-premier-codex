"use strict";
(() => {
  const W = ChatGPTWorkflow;
  let data = null,
    proposal = null,
    prepared = null;
  const selected = () =>
    data?.products.find((p) => p.id === $("gpt-product").value);
  function reset() {
    proposal = null;
    $("gpt-preview-panel").hidden = true;
    $("gpt-consent").checked = false;
    $("gpt-save").disabled = true;
    $("gpt-errors").textContent = "";
  }
  function clear() {
    reset();
    prepared = null;
    $("gpt-prompt").value = "";
    $("gpt-copy").disabled = true;
    $("gpt-json").value = "";
    history();
  }
  function display(container, content) {
    container.replaceChildren();
    if (!content) return;
    for (const [label, value] of [
      ["Titre SEO", content.titleSeo],
      ["Description HTML", content.descriptionHtml],
      ...content.arguments.map((v, i) => ["Argument commercial " + (i + 1), v]),
      ["Mots-clés", content.keywords.join(", ")],
      ...content.faqGeo.map((v, i) => [
        "FAQ GEO " + (i + 1),
        v.question + "\n" + v.answer,
      ]),
    ]) {
      const l = el("label", label),
        input = el("textarea");
      input.value = value;
      input.readOnly = true;
      input.rows = 3;
      l.append(input);
      container.append(l);
    }
  }
  function history() {
    const target = $("gpt-history");
    target.replaceChildren();
    const versions =
      selected()?.dossier?.chatgpt?.[$("gpt-market").value] || [];
    if (!versions.length) {
      target.append(
        el("p", "Aucun contenu ChatGPT validé pour cette marketplace."),
      );
      return;
    }
    for (const [i, v] of versions.entries()) {
      const d = el("details"),
        s = el(
          "summary",
          "Version " +
            (i + 1) +
            " · " +
            new Date(v.validatedAt).toLocaleString("fr-FR"),
        ),
        box = el("div");
      display(box, v.content);
      d.append(s, box);
      target.append(d);
    }
  }
  async function refresh() {
    data = await CatalogueStore.read();
    const id = $("gpt-product").value;
    $("gpt-product").replaceChildren(
      el("option", "Choisir une fiche OneBase…"),
    );
    $("gpt-product").firstChild.value = "";
    for (const p of data.products.filter((p) => p.dossier?.source.raw)) {
      const o = el("option", p.values.sku + " · " + p.values.designation);
      o.value = p.id;
      $("gpt-product").append(o);
    }
    if (data.products.some((p) => p.id === id)) $("gpt-product").value = id;
    clear();
  }
  let saving = false;
  function action(id, fn) {
    $(id).addEventListener("click", async () => {
      if (id === "gpt-save" && saving) return;
      if (id === "gpt-save") {
        saving = true;
        $(id).disabled = true;
      }
      try {
        await fn();
      } catch (e) {
        $("gpt-errors").textContent = e.message;
        notify(e.message, true);
      } finally {
        if (id === "gpt-save") {
          saving = false;
          $(id).disabled = !proposal || !$("gpt-consent").checked;
        }
      }
    });
  }
  $("gpt-product").addEventListener("change", clear);
  $("gpt-market").addEventListener("change", clear);
  $("gpt-json").addEventListener("input", reset);
  $("gpt-consent").addEventListener("change", () => {
    $("gpt-save").disabled = !proposal || !$("gpt-consent").checked;
  });
  action("gpt-prepare", async () => {
    data = await CatalogueStore.read();
    const p = selected();
    const text = W.prompt(p, $("gpt-market").value);
    prepared = {
      revision: data.revision,
      id: p.id,
      market: $("gpt-market").value,
    };
    $("gpt-prompt").value = text;
    $("gpt-copy").disabled = false;
  });
  action("gpt-copy", async () => {
    const current = await CatalogueStore.read();
    if (!prepared || current.revision !== prepared.revision)
      throw Error("Catalogue modifié : préparez de nouveau la consigne.");
    try {
      if (!navigator.clipboard?.writeText) throw Error();
      await navigator.clipboard.writeText($("gpt-prompt").value);
    } catch {
      $("gpt-prompt").focus();
      $("gpt-prompt").select();
      if (!document.execCommand("copy"))
        throw Error(
          "Copie automatique indisponible : sélectionnez la consigne et utilisez Copier.",
        );
    }
    notify("Consigne copiée. Aucun appel à ChatGPT n’a été effectué.");
  });
  action("gpt-preview", async () => {
    reset();
    data = await CatalogueStore.read();
    const p = selected();
    if (!p) throw Error("Sélectionnez un produit OneBase.");
    const result = W.parse(
      $("gpt-json").value,
      $("gpt-market").value,
      p.values.sku,
    );
    $("gpt-errors").textContent = result.errors.join("\n");
    if (result.errors.length) return;
    proposal = {
      content: result.value,
      market: $("gpt-market").value,
      id: p.id,
      revision: data.revision,
    };
    display($("gpt-fields"), result.value);
    $("gpt-missing").textContent = result.value.missingFields.length
      ? "Informations à vérifier : " + result.value.missingFields.join(", ")
      : "Aucun manque déclaré dans la réponse ; vérifiez les faits dans les sources.";
    $("gpt-preview-panel").hidden = false;
  });
  action("gpt-save", async () => {
    if (!proposal) throw Error("Recommencez la prévisualisation.");
    const snapshot = proposal,
      current = await CatalogueStore.read();
    const next = W.apply(
      current,
      snapshot.id,
      snapshot.market,
      snapshot.content,
      snapshot.revision,
      $("gpt-consent").checked,
    );
    await CatalogueStore.save(next, current.revision);
    notify(
      "Nouvelle version ChatGPT validée et enregistrée localement. Les sources et contenus existants sont conservés.",
    );
  });
  window.addEventListener("semin-catalogue-saved", () =>
    refresh().catch((e) => notify(e.message, true)),
  );
  refresh().catch((e) => notify(e.message, true));
})();
