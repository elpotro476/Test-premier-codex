"use strict";
(() => {
  let data = null,
    draft = {},
    count = 6,
    pending = null,
    generation = 0,
    draftRevision = null,
    refreshGeneration = 0;
  const $v = (id) => document.getElementById(id);
  const button = (text, action) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "secondary";
    b.textContent = text;
    b.addEventListener("click", action);
    return b;
  };
  function invalidate() {
    pending = null;
    $v("visual-consent").checked = false;
    $v("visual-save").disabled = true;
    $v("visual-confirm").hidden = true;
  }
  function guarded(fn) {
    return async () => {
      try {
        await fn();
      } catch (e) {
        notify(e.message, true);
      }
    };
  }
  function render() {
    generation++;
    invalidate();
    $v("visual-slots").replaceChildren(
      ...Visuals.slots(count).map((slot, index) => {
        const card = document.createElement("div");
        card.className = "card";
        const label = document.createElement("label");
        label.textContent = slot === "MAIN" ? "MAIN · Image principale" : slot;
        const input = document.createElement("input");
        input.type = "url";
        input.maxLength = 8000;
        input.dataset.visualSlot = slot;
        input.value = draft[slot] || "";
        input.setAttribute("aria-label", "URL visuel " + slot);
        const status = document.createElement("p");
        status.className = "visual-status";
        status.textContent = Visuals.issue(input.value);
        const image = document.createElement("img");
        image.alt = "Aperçu " + slot;
        image.hidden = true;
        image.referrerPolicy = "no-referrer";
        image.className = "visual-preview";
        let timer,
          request = 0;
        input.addEventListener("input", () => {
          request++;
          clearTimeout(timer);
          image.removeAttribute("src");
          image.hidden = true;
          draft[slot] = input.value.trim();
          status.textContent = Visuals.issue(draft[slot]);
          invalidate();
        });
        label.append(input);
        card.append(label, status, image);
        card.append(
          button("Afficher / contrôler", () => {
            clearTimeout(timer);
            const problem = Visuals.issue(draft[slot]);
            if (problem || !draft[slot]) {
              status.textContent = problem || "URL absente.";
              return;
            }
            const token = ++request,
              version = generation;
            status.textContent = "Chargement…";
            image.hidden = true;
            image.onload = () => {
              if (token !== request || version !== generation) return;
              clearTimeout(timer);
              image.hidden = false;
              status.textContent =
                "Image chargée dans ce navigateur. Accès public non certifié.";
            };
            image.onerror = () => {
              if (token !== request || version !== generation) return;
              clearTimeout(timer);
              status.textContent =
                "Image non chargée : réseau, protection ou lien inaccessible. Contrôle non concluant.";
            };
            timer = setTimeout(() => {
              if (token === request && version === generation) {
                request++;
                image.removeAttribute("src");
                status.textContent =
                  "Délai dépassé : accessibilité non vérifiée.";
              }
            }, 10000);
            image.src = draft[slot];
          }),
        );
        const swap = (other) => {
          [draft[slot], draft[other]] = [draft[other] || "", draft[slot] || ""];
          render();
        };
        if (index) {
          card.append(button("Définir comme principale", () => swap("MAIN")));
          card.append(
            button("Monter", () => swap(Visuals.slots(count)[index - 1])),
          );
        }
        if (index < count - 1)
          card.append(
            button("Descendre", () => swap(Visuals.slots(count)[index + 1])),
          );
        return card;
      }),
    );
  }
  function load() {
    const p = data?.products.find((p) => p.id === $v("visual-product").value);
    draft = {};
    count = 6;
    draftRevision = data?.revision;
    for (let i = 0; i < 100; i++) {
      const slot = Visuals.slots(100)[i];
      if (p?.values[Visuals.id(slot)]) {
        draft[slot] = p.values[Visuals.id(slot)];
        count = Math.max(count, i + 1);
      }
    }
    render();
  }
  async function refresh() {
    const selected = $v("visual-product").value,
      token = ++refreshGeneration;
    $v("visual-product").disabled = true;
    $v("visual-plan").disabled = true;
    invalidate();
    let snapshot;
    try {
      snapshot = await CatalogueStore.read();
    } catch (e) {
      if (token === refreshGeneration) {
        $v("visual-product").disabled = false;
        $v("visual-plan").disabled = false;
      }
      throw e;
    }
    if (token !== refreshGeneration) return false;
    data = snapshot;
    const products = data.products.filter((p) => p.values.sku);
    $v("visual-product").replaceChildren(
      new Option("Choisir un SKU", ""),
      ...products.map(
        (p) =>
          new Option(p.values.sku + " · " + (p.values.designation || ""), p.id),
      ),
    );
    $v("visual-product").value = selected;
    $v("visual-reuse").replaceChildren(
      ...products.map((p) => new Option(p.values.sku, p.id)),
    );
    invalidate();
    $v("visual-product").disabled = false;
    $v("visual-plan").disabled = false;
    return true;
  }
  $v("visual-product").addEventListener("change", load);
  $v("visual-reuse").addEventListener("change", invalidate);
  $v("visual-add").addEventListener(
    "click",
    guarded(() => {
      if (count >= 100) throw Error("Maximum : MAIN et PT01 à PT99.");
      count++;
      render();
    }),
  );
  $v("visual-batch-apply").addEventListener(
    "click",
    guarded(() => {
      draft = Visuals.batch($v("visual-batch").value, draft);
      count = Math.max(
        count,
        ...Object.keys(draft).map((k) => (k === "MAIN" ? 1 : +k.slice(2) + 1)),
      );
      render();
    }),
  );
  $v("visual-plan").addEventListener(
    "click",
    guarded(() => {
      if (data.revision !== draftRevision)
        throw Error(
          "Le catalogue a changé : choisissez à nouveau le SKU avant de préparer les modifications.",
        );
      const ids = [
        $v("visual-product").value,
        ...Array.from($v("visual-reuse").selectedOptions, (o) => o.value),
      ];
      if (!ids[0]) throw Error("Choisissez la fiche SKU à modifier.");
      const values = Object.fromEntries(
        Visuals.slots(count).map((slot) => [slot, draft[slot] || ""]),
      );
      pending = Visuals.plan(data, ids, values);
      $v("visual-changes").textContent = pending.changes.length
        ? pending.changes
            .map(
              (c) =>
                c.sku +
                " · " +
                c.slot +
                "\nAvant : " +
                (c.before || "(vide)") +
                "\nAprès : " +
                (c.after || "(vide)"),
            )
            .join("\n\n")
        : "Aucun changement de valeur.";
      $v("visual-confirm").hidden = false;
      $v("visual-consent").checked = false;
      $v("visual-save").disabled = true;
    }),
  );
  $v("visual-consent").addEventListener("change", () => {
    $v("visual-save").disabled = !pending || !$v("visual-consent").checked;
  });
  $v("visual-save").addEventListener(
    "click",
    guarded(async () => {
      if (!pending || !$v("visual-consent").checked)
        throw Error("Prévisualisation et confirmation requises.");
      $v("visual-save").disabled = true;
      await CatalogueStore.save(pending.next, pending.revision);
      await refresh();
      load();
      invalidate();
      notify("URL des visuels enregistrées localement.");
    }),
  );
  document.querySelector('[data-studio-view="visuals"]').addEventListener(
    "click",
    guarded(async () => {
      if (await refresh()) load();
    }),
  );
  window.addEventListener("semin-catalogue-saved", () => guarded(refresh)());
  render();
})();
