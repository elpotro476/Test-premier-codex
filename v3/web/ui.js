"use strict";
(() => {
  const $ = (id) => document.getElementById(id),
    D = V3Domain,
    A = V3Services.auth;
  let repo = null,
    demo = false,
    org = null,
    role = null,
    rows = [],
    families = [],
    offset = 0,
    total = 0,
    editing = null,
    generation = 0,
    loadNumber = 0;
  const roles = {
    admin: "Administrateur",
    editor: "Éditeur",
    reader: "Lecteur",
  };
  const write = () => ["admin", "editor"].includes(role);
  function node(tag, text) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function message(text, error = false) {
    $("message").textContent = text;
    $("message").classList.toggle("error", error);
  }
  function table(headers, items) {
    const t = node("table"),
      h = node("thead"),
      tr = node("tr");
    headers.forEach((v) => tr.append(node("th", v)));
    h.append(tr);
    t.append(h);
    const body = node("tbody");
    items.forEach((row) => {
      const r = node("tr");
      row.forEach((value) => {
        const td = node("td");
        td.append(
          value instanceof Node
            ? value
            : document.createTextNode(String(value ?? "")),
        );
        r.append(td);
      });
      body.append(r);
    });
    t.append(body);
    return t;
  }
  function reset() {
    generation++;
    loadNumber++;
    repo = null;
    org = null;
    role = null;
    rows = [];
    families = [];
    editing = null;
    offset = 0;
    total = 0;
    demo = false;
    $("workspace").hidden = true;
    $("session").hidden = true;
    $("login-panel").hidden = false;
    $("identity").textContent = "";
    $("space").replaceChildren();
    $("products").replaceChildren();
    $("events").replaceChildren();
    $("member-list").replaceChildren();
    $("fields").replaceChildren();
    $("family").replaceChildren();
    $("variant").value = "";
    $("password").value = "";
    $("email").value = "";
    $("member-id").value = "";
    $("member-consent").checked = false;
    $("count").textContent = "";
    $("editor").close();
    $("confirm").close();
  }
  function view(name) {
    if (
      (name === "members" && role !== "admin") ||
      (name === "history" && !write())
    )
      return;
    for (const v of ["catalogue", "history", "members"])
      $(v).hidden = v !== name;
  }
  function permissions() {
    $("role").textContent = roles[role] || "Aucun droit";
    $("create").hidden = !write();
    document.querySelector('[data-view="members"]').hidden = role !== "admin";
    document.querySelector('[data-view="history"]').hidden = !write();
    if (!write() || (!$("members").hidden && role !== "admin"))
      view("catalogue");
  }
  async function guarded(fn, button) {
    const g = generation;
    if (button) button.disabled = true;
    try {
      await fn(g);
    } catch (error) {
      if (g === generation) message(error.message, true);
    } finally {
      if (button) button.disabled = false;
    }
  }
  async function refresh() {
    if (!repo || !org) return;
    const g = generation,
      r = repo,
      o = org,
      n = ++loadNumber;
    const nextRole = await r.membership(o);
    if (g !== generation || n !== loadNumber) return;
    if (!nextRole) {
      role = null;
      permissions();
      rows = [];
      families = [];
      $("products").replaceChildren();
      $("events").replaceChildren();
      $("member-list").replaceChildren();
      $("fields").replaceChildren();
      $("editor").close();
      throw Error("Vous n’avez plus accès à cet espace.");
    }
    role = nextRole;
    permissions();
    const result = await r.list(o, {
      search: $("search").value,
      archived: $("archive-filter").value === "archived",
      offset,
    });
    if (g !== generation || n !== loadNumber) return;
    rows = result.data;
    total = result.total;
    $("products").replaceChildren(
      table(
        ["SKU", "EAN", "Désignation", "Marque", "Préparation", "Fiche"],
        rows.map((p) => {
          const b = node("button", "Ouvrir");
          b.className = "secondary";
          b.setAttribute("aria-label", "Ouvrir " + p.sku);
          b.addEventListener("click", () => open(p));
          return [
            p.sku,
            p.ean,
            p.designation,
            p.brand,
            D.statuses[p.status],
            b,
          ];
        }),
      ),
    );
    $("count").textContent =
      `${total} fiche(s) · page ${Math.floor(offset / 50) + 1} · 50 fiches par page`;
    $("previous").disabled = offset === 0;
    $("next").disabled = offset + 50 >= total;
  }
  async function chooseSpace() {
    generation++;
    org = $("space").value;
    offset = 0;
    rows = [];
    families = [];
    role = null;
    $("products").replaceChildren();
    $("events").replaceChildren();
    $("member-list").replaceChildren();
    $("editor").close();
    $("confirm").close();
    permissions();
    view("catalogue");
    if (!org) return;
    const g = generation,
      r = repo;
    const f = await r.families(org);
    if (g !== generation) return;
    families = f;
    await refresh();
  }
  async function start(r, isDemo) {
    reset();
    repo = r;
    demo = isDemo;
    const g = generation;
    const spaces = await repo.spaces();
    if (g !== generation) return;
    $("space").replaceChildren(...spaces.map((s) => new Option(s.name, s.id)));
    $("workspace").hidden = false;
    $("session").hidden = false;
    $("login-panel").hidden = true;
    $("identity").textContent = demo
      ? "DÉMONSTRATION FICTIVE · données en mémoire"
      : A.current()?.user.email || "Compte connecté";
    if (!spaces.length) {
      message(
        "Compte connecté, sans espace attribué. Contactez votre administrateur.",
        true,
      );
      return;
    }
    await chooseSpace();
    message(
      demo
        ? "Démonstration fictive active. Aucun serveur contacté."
        : "Catalogue central chargé après authentification.",
    );
  }
  function open(p = null) {
    if (!p && !write()) return;
    editing = p ? structuredClone(p) : null;
    $("editor-title").textContent = p ? "Fiche — " + p.sku : "Nouvelle fiche";
    $("editor-message").textContent = "";
    $("fields").replaceChildren(
      ...D.fields.map(([key, label, type, required]) => {
        const l = node("label", label + (required ? " *" : "")),
          input = node(type === "textarea" ? "textarea" : "input");
        input.dataset.field = key;
        input.value = p?.[key] ?? "";
        if (type !== "textarea") input.type = type;
        input.required = !!required;
        input.setAttribute("aria-label", label);
        if (type === "number") {
          input.step = key === "pack_quantity" ? "1" : "0.0001";
          input.min = key === "pack_quantity" ? "1" : "0";
        } else
          input.maxLength =
            key === "sku"
              ? 100
              : key === "ean"
                ? 13
                : key === "brand"
                  ? 150
                  : type === "textarea"
                    ? key === "short_description"
                      ? 5000
                      : 100000
                    : 500;
        input.disabled = !write() || !!p?.archived_at;
        l.append(input);
        return l;
      }),
    );
    $("family").replaceChildren(
      new Option("Non renseignée", ""),
      ...families.map((f) => new Option(f.label, f.id)),
    );
    $("family").value = p?.family_id || "";
    $("variant").value = p?.variant_of || "";
    $("status").value = p?.status || "draft";
    for (const id of ["family", "variant", "status"])
      $(id).disabled = !write() || !!p?.archived_at;
    $("save").hidden = !write() || !!p?.archived_at;
    $("archive").hidden = !write() || !p;
    $("archive").textContent = p?.archived_at ? "Restaurer" : "Archiver";
    $("revision").textContent = p
      ? "Révision " +
        p.revision +
        " · " +
        new Date(p.updated_at).toLocaleString("fr-FR")
      : "";
    $("editor").showModal();
  }
  $("close-editor").addEventListener("click", () => $("editor").close());
  $("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const email = $("email").value.trim(),
      password = $("password").value;
    $("password").value = "";
    $("login").disabled = true;
    $("demo").disabled = true;
    A.login(email, password)
      .then(() => start(V3Services.repo, false))
      .catch((error) => message(error.message, true))
      .finally(() => {
        $("login").disabled = !A.configured();
        $("demo").disabled = false;
      });
  });
  $("demo").addEventListener("click", () =>
    guarded(() => start(V3Demo(), true), $("demo")),
  );
  $("logout").addEventListener("click", () => {
    const wasDemo = demo;
    reset();
    message(
      "Déconnexion effectuée. Aucune donnée centrale conservée dans Chrome.",
    );
    if (!wasDemo)
      A.logout().catch(() =>
        message(
          "Déconnecté sur cet appareil. Révocation distante non confirmée ; contactez votre administrateur si nécessaire.",
          true,
        ),
      );
  });
  A.onChange((session) => {
    if (!session && !demo) {
      reset();
    }
  });
  $("space").addEventListener("change", () => guarded(chooseSpace));
  for (const id of ["refresh", "search-button"])
    $(id).addEventListener("click", () =>
      guarded(async () => {
        if (id === "search-button") offset = 0;
        await refresh();
      }),
    );
  $("search").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      offset = 0;
      guarded(refresh);
    }
  });
  $("archive-filter").addEventListener("change", () => {
    offset = 0;
    guarded(refresh);
  });
  $("previous").addEventListener("click", () => {
    offset = Math.max(0, offset - 50);
    guarded(refresh);
  });
  $("next").addEventListener("click", () => {
    offset += 50;
    guarded(refresh);
  });
  $("create").addEventListener("click", () => open());
  $("product-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const g = generation,
      r = repo,
      o = org,
      p = editing;
    const patch = {};
    try {
      for (const input of $("fields").querySelectorAll("[data-field]"))
        patch[input.dataset.field] =
          input.type === "number"
            ? input.value === ""
              ? null
              : Number(input.value)
            : input.value;
      patch.sku = patch.sku.trim();
      patch.ean = patch.ean.trim() || null;
      patch.family_id = $("family").value || null;
      patch.variant_of = $("variant").value.trim() || null;
      patch.status = $("status").value;
      D.validate(patch);
    } catch (error) {
      $("editor-message").textContent = error.message;
      $("editor-message").className = "error";
      return;
    }
    guarded(async () => {
      try {
        await r.save(o, p, patch);
        if (g !== generation) return;
        $("editor").close();
        await refresh();
        message(
          "Fiche enregistrée" +
            (demo ? " en mémoire fictive." : " dans PostgreSQL."),
        );
      } catch (error) {
        if (g === generation) {
          $("editor-message").textContent = error.message;
          $("editor-message").className = "error";
        }
        throw error;
      }
    }, $("save"));
  });
  $("archive").addEventListener("click", () => {
    $("confirm-title").textContent = editing.archived_at
      ? "Confirmer la restauration"
      : "Confirmer l’archivage";
    $("confirm").showModal();
  });
  $("cancel-archive").addEventListener("click", () => $("confirm").close());
  $("confirm-archive").addEventListener("click", () =>
    guarded(async (g) => {
      const r = repo,
        o = org,
        p = editing;
      await r.archive(o, p, !p.archived_at);
      if (g !== generation) return;
      $("confirm").close();
      $("editor").close();
      await refresh();
      message("Archivage / restauration enregistré.");
    }, $("confirm-archive")),
  );
  document.querySelectorAll("[data-view]").forEach((b) =>
    b.addEventListener("click", () =>
      guarded(async (g) => {
        const name = b.dataset.view;
        view(name);
        if (name === "history") {
          const events = await repo.history(org);
          if (g === generation)
            $("events").replaceChildren(
              table(
                ["Date", "Entité", "Identifiant", "Action", "Auteur"],
                events.map((e) => [
                  new Date(e.at).toLocaleString("fr-FR"),
                  e.entity,
                  e.entity_id,
                  e.action,
                  e.actor_id,
                ]),
              ),
            );
        }
        if (name === "members") {
          const members = await repo.members(org);
          if (g === generation)
            $("member-list").replaceChildren(
              table(
                ["Compte UUID", "Rôle"],
                members.map((m) => [m.user_id, roles[m.role]]),
              ),
            );
        }
      }),
    ),
  );
  $("member-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!$("member-consent").checked) return;
    guarded(async (g) => {
      await repo.setRole(
        org,
        $("member-id").value.trim(),
        $("member-role").value,
      );
      if (g !== generation) return;
      $("member-consent").checked = false;
      await refresh();
      message("Rôle enregistré côté serveur.");
    });
  });
  $("configuration").textContent = A.configured()
    ? "Projet configuré : " + SEMIN_V3_CONFIG.url
    : "Aucun projet connecté. La démonstration fictive est disponible ; suivre le guide Supabase pour préparer un environnement de développement.";
  $("login").disabled = !A.configured();
  view("catalogue");
})();
