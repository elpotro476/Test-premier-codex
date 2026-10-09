"use strict";
window.V3Services = (() => {
  const config = window.SEMIN_V3_CONFIG;
  let session = null,
    epoch = 0,
    refreshing = null;
  const listeners = new Set();
  const signal = () => listeners.forEach((fn) => fn(session));
  class ApiError extends Error {
    constructor(message, code) {
      super(message);
      this.code = code;
    }
  }
  function configured() {
    return !!config.url && !!config.publicKey;
  }
  async function request(
    path,
    { method = "GET", body, token, headers = {} } = {},
  ) {
    if (!configured())
      throw Error(
        "Projet Supabase non configuré : utilisez la démonstration ou le guide de connexion.",
      );
    let response;
    try {
      response = await fetch(config.url + path, {
        method,
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        headers: {
          apikey: config.publicKey,
          ...(token ? { Authorization: "Bearer " + token } : {}),
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw Error(
        "Connexion au projet indisponible. Vérifiez Internet et réessayez.",
      );
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const code =
        payload?.code || payload?.error_code || String(response.status);
      const messages = {
        23505: "Ce SKU ou cet EAN est déjà réservé dans cet espace.",
        23514: "Une valeur ne respecte pas les contraintes du catalogue.",
        23502: "Un champ obligatoire est absent.",
        23503: "Référence liée invalide ou compte utilisateur inexistant.",
        40001:
          "La fiche a changé sur un autre appareil. Actualisez puis rouvrez-la.",
        42501: "Votre rôle ne permet pas cette opération.",
        22023:
          "Modification refusée : vérifiez les champs, le parent ou le dernier administrateur.",
        P0002: "Fiche introuvable dans cet espace.",
      };
      throw new ApiError(
        messages[code] ||
          (response.status === 401
            ? "Connexion expirée ou identifiants incorrects."
            : "Opération refusée par le service. Vérifiez votre configuration et vos droits."),
        code,
      );
    }
    return {
      data: payload,
      total:
        Number((response.headers.get("content-range") || "").split("/")[1]) ||
        0,
    };
  }
  function accept(payload, expectedEpoch) {
    if (expectedEpoch !== epoch) throw Error("Session terminée.");
    if (!payload?.access_token || !payload?.refresh_token || !payload?.user?.id)
      throw Error("Réponse d’authentification invalide.");
    session = {
      token: payload.access_token,
      refreshToken: payload.refresh_token,
      user: payload.user,
      expiresAt: Date.now() + (payload.expires_in || 3600) * 1000,
    };
    signal();
    return session;
  }
  function clear() {
    session = null;
    epoch++;
    signal();
  }
  async function login(email, password) {
    clear();
    const expected = epoch;
    const { data } = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email, password },
    });
    return accept(data, expected);
  }
  async function access() {
    if (!session)
      throw Error("Connectez-vous pour accéder au catalogue central.");
    if (session.expiresAt - Date.now() < 60000) {
      if (!refreshing) {
        const expected = epoch,
          refreshToken = session.refreshToken;
        refreshing = request("/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          body: { refresh_token: refreshToken },
        })
          .then(({ data }) => accept(data, expected))
          .catch((error) => {
            if (expected === epoch) clear();
            throw error;
          })
          .finally(() => (refreshing = null));
      }
      await refreshing;
    }
    if (!session) throw Error("Session terminée.");
    return session.token;
  }
  async function authorized(path, options = {}) {
    const expected = epoch;
    const token = await access();
    try {
      const result = await request(path, { ...options, token });
      if (expected !== epoch) throw Error("Session terminée.");
      return result;
    } catch (error) {
      if (
        error.code === "401" ||
        error.code === "PGRST301" ||
        error.code === "PGRST303"
      ) {
        if (expected === epoch) clear();
      }
      throw error;
    }
  }
  async function logout() {
    const token = session?.token;
    clear();
    if (token) await request("/auth/v1/logout", { method: "POST", token });
  }
  const rest = (table, query) =>
    authorized("/rest/v1/" + table + "?" + new URLSearchParams(query));
  const rpc = (name, args) =>
    authorized("/rest/v1/rpc/" + name, { method: "POST", body: args }).then(
      (r) => r.data,
    );
  const repo = {
    async spaces() {
      return (
        await rest("organizations", { select: "id,name", order: "name.asc" })
      ).data;
    },
    async membership(org) {
      return (
        (
          await rest("memberships", {
            select: "role",
            organization_id: "eq." + org,
            user_id: "eq." + session.user.id,
          })
        ).data[0]?.role || null
      );
    },
    async families(org) {
      return (
        await rest("families", {
          select: "id,label,parent_id",
          organization_id: "eq." + org,
          order: "label.asc",
          limit: "1000",
        })
      ).data;
    },
    async list(org, { search = "", archived = false, offset = 0 } = {}) {
      const q = {
        select: "*",
        organization_id: "eq." + org,
        archived_at: archived ? "not.is.null" : "is.null",
        order: "sku.asc,id.asc",
        limit: "50",
        offset: String(offset),
      };
      // Only literal alphanumerics, spaces, dash, underscore and Unicode letters are allowed in PostgREST filters.
      const term = search
        .normalize("NFC")
        .replace(/[^\p{L}\p{N} _-]/gu, "")
        .slice(0, 100)
        .replace(/[_%]/g, "");
      if (term)
        q.or = `(sku.ilike.*${term}*,ean.ilike.*${term}*,designation.ilike.*${term}*)`;
      return authorized("/rest/v1/products?" + new URLSearchParams(q), {
        headers: { Prefer: "count=exact" },
      });
    },
    save(org, product, patch) {
      return rpc("save_product", {
        p_organization: org,
        p_product: product?.id || null,
        p_expected_revision: product?.revision || null,
        p_patch: patch,
      });
    },
    archive(org, product, archived) {
      return rpc("set_product_archived", {
        p_organization: org,
        p_product: product.id,
        p_expected_revision: product.revision,
        p_archived: archived,
      });
    },
    setRole(org, user, role) {
      return rpc("set_member_role", {
        p_organization: org,
        p_user: user,
        p_role: role,
      });
    },
    async members(org) {
      return (
        await rest("memberships", {
          select: "user_id,role",
          organization_id: "eq." + org,
          order: "user_id.asc",
        })
      ).data;
    },
    async history(org) {
      return (
        await rest("audit_events", {
          select: "at,entity,entity_id,action,actor_id",
          organization_id: "eq." + org,
          order: "id.desc",
          limit: "25",
        })
      ).data;
    },
  };
  return {
    auth: {
      configured,
      login,
      logout,
      onChange(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      current: () => session,
    },
    repo,
  };
})();
