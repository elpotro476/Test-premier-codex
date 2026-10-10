/* Deterministic, local extraction. No service, inference of missing values or AI. */
"use strict";
window.OneBase = (() => {
  const fields = [
    [
      "sku",
      "Référence article / SKU",
      [
        "reference article",
        "ref article",
        "sku",
        "sku semin",
        "reference produit",
        "reference",
      ],
    ],
    [
      "onebaseRef",
      "Référence OneBase",
      [
        "reference onebase",
        "ref onebase",
        "identifiant onebase",
        "onebase",
        "code produit",
      ],
    ],
    ["ean", "EAN", ["ean", "ean13", "ean 13", "gtin", "code barre"]],
    ["brand", "Marque", ["marque", "brand"]],
    [
      "designation",
      "Désignation",
      ["designation", "nom produit", "produit", "nom commercial"],
    ],
    ["settingTime", "Temps de prise", ["temps de prise", "prise"]],
    ["genericPackaging", "Conditionnements génériques", ["conditionnements generiques"]],
    ["family", "Famille", ["famille", "categorie"]],
    [
      "technical",
      "Caractéristiques techniques",
      [
        "caracteristiques",
        "caracteristiques techniques",
        "fiche technique",
        "definition technique",
      ],
    ],
    [
      "composition",
      "Nature / composition",
      ["nature", "composition", "type de produit"],
    ],
    ["finish", "Aspect / finition", ["aspect", "finition"]],
    ["usage", "Usage", ["usage", "destination", "interieur exterieur"]],
    ["support", "Supports", ["supports", "support", "support admis"]],
    ["drying", "Séchage", ["sechage", "temps de sechage"]],
    ["recoat", "Recouvrable", ["recouvrable", "temps de recouvrement"]],
    [
      "abrasion",
      "Résistance à l’abrasion humide",
      ["resistance a l abrasion humide", "abrasion humide", "classe abrasion"],
    ],
    ["packaging", "Conditionnement", ["conditionnement", "emballage"]],
    ["capacity", "Contenance", ["contenance", "volume", "capacite"]],
    ["coverage", "Rendement", ["rendement", "pouvoir couvrant"]],
    ["weight", "Poids (kg)", ["poids", "poids kg"]],
    [
      "units",
      "Nombre d’unités",
      ["nombre d unites", "nombre d unite", "nombre de pieces", "unites"],
    ],
    [
      "packagingType",
      "Type de conditionnement",
      ["type de conditionnement", "type d emballage"],
    ],
    ["consumption", "Consommation", ["consommation"]],
    [
      "application",
      "Application",
      ["application", "mise en oeuvre", "mode d application"],
    ],
    [
      "filmThickness",
      "Épaisseur du film",
      ["epaisseur du film", "epaisseur d application", "epaisseur"],
    ],
    [
      "fireReaction",
      "Réaction au feu",
      ["reaction au feu", "classement au feu"],
    ],
    ["price", "Prix", ["prix", "prix ttc"]],
    ["stock", "Stock", ["stock", "quantite disponible"]],
    ["shortDescription", "Descriptif", ["descriptif", "description courte"]],
    ["storage", "Stockage", ["stockage"]],
    ["storageMonths", "Stockage en mois", ["stockage en mois"]],
    ["preparation", "Préparation des supports", ["preparation des supports"]],
    [
      "precautions",
      "Précautions d’emploi",
      ["precaution d emploi", "precautions d emploi"],
    ],
    [
      "vocClass",
      "COV (valeur source)",
      ["cov", "classement cov", "classe cov"],
    ],
    ["density", "Densité / masse volumique", ["masse volumique", "densite"]],
    ["dryExtract", "Extrait sec", ["extrait sec"]],
    ["gloss", "Brillant spéculaire", ["brillant speculaire"]],
    [
      "arguments",
      "Arguments sources",
      [
        "arguments",
        "arguments commerciaux",
        "arguments marketing",
        "avantages",
      ],
    ],
  ].map(([id, label, aliases]) => ({ id, label, aliases }));
  const norm = (s) =>
    String(s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  function parse(raw, selectedSku = "") {
    if (typeof raw !== "string" || !raw.trim())
      throw Error("Collez le texte OneBase avant de l’analyser.");
    if (raw.length > 200000)
      throw Error("Texte OneBase limité à 200 000 caractères.");
    const candidates = Object.fromEntries(fields.map((f) => [f.id, []])),
      unclassified = [],
      warnings = [],
      encountered = new Set();
    function add(id, value, evidence) {
      value = value.trim();
      if (value) candidates[id].push({ value, evidence });
    }
    let active = null,
      block = [];
    const flush = () => {
      if (active && block.length)
        add(active, block.join("\n"), block.join("\n"));
      active = null;
      block = [];
    };
    const sections = new Set([
      "argumentaire",
      "infos complementaires",
      "reglementaire",
      "infos techniques",
    ]);
    // Recognise headings independently of their presentation. The untouched raw
    // text remains the authoritative source; this tokenisation is extraction only.
    const aliases = [
      ...fields.flatMap((f) => f.aliases),
      ...sections,
      "logo marque",
      "fiche de securite",
      "sous titre 1",
      "sec",
      ...Array.from({ length: 5 }, (_, i) => `les produits ${i + 1}`),
    ];
    const accents = {
      a: "[aàâä]",
      c: "[cç]",
      e: "[eéèêë]",
      i: "[iîï]",
      o: "[oôö]",
      u: "[uùûü]",
    };
    const labelPattern = aliases
      .sort((a, b) => b.length - a.length)
      .map((a) =>
        a
          .split(" ")
          .map((w) => [...w].map((c) => accents[c] || c).join(""))
          .join("[\\s’'+-]+"),
      )
      .join("|");
    // Explicit colons and marked headings are reliable even on a single line.
    // Unmarked words inside prose are never treated as implicit new headings.
    // Tables are isolated before rubric parsing: a row must never become part
    // of the preceding technical paragraph. Only explicit column labels count.
    const variants = [], tableLines = new Set(), tableHeaders = new Set();
    const sourceLines = raw.split(/\r\n?|\n/);
    let headers = null;
    const columnId = (v) => {
      const n = norm(v);
      if (["ean", "ean13", "ean 13", "gtin"].includes(n)) return "ean";
      if (["sku", "reference article", "ref article", "code article", "reference commerciale"].includes(n)) return "sku";
      if (["designation", "libelle", "nom produit"].includes(n)) return "designation";
      if (["conditionnement", "emballage", "poids", "contenance"].includes(n)) return "packaging";
      return "";
    };
    for (let i = 0; i < sourceLines.length; i++) {
      const line = sourceLines[i];
      const cells = line.trim().replace(/^\||\|$/g, "").split(/\t|\s*;\s*|\s*\|\s*| {2,}/);
      // Browser copying can turn a table into one cell per line.
      if (cells.length === 1 && columnId(cells[0]) && !headers) {
        const vertical = [];
        let end = i;
        while (end < sourceLines.length && columnId(sourceLines[end].trim())) {
          vertical.push(columnId(sourceLines[end].trim())); end++;
        }
        if (vertical.includes("sku") && vertical.includes("ean")) {
          headers = vertical;
          tableHeaders.add(i);
          for (let j = i; j < end; j++) tableLines.add(j);
          i = end - 1; continue;
        }
      }
      let labels = cells.map(columnId);
      if (cells.length === 1) {
        const headerPattern = /désignation|designation|ean(?: ?13)?|sku|référence article|reference article|code article|conditionnement/giu;
        const tokens = [...line.matchAll(headerPattern)];
        if (tokens.length && !line.replace(headerPattern, "").trim()) labels = tokens.map(m => columnId(m[0]));
      }
      if (labels.includes("sku") && labels.includes("ean")) {
        headers = labels; tableLines.add(i); tableHeaders.add(i); continue;
      }
      if (!headers) continue;
      if (/^[- |:]+$/.test(line)) { tableLines.add(i); continue; }
      let last = i;
      if (cells.length === 1 && headers.slice(0, 3).join(",") === "designation,ean,sku") {
        const spaced = /^(.+?)\s+(\d{13})\s+(\S+)(?:\s+(.+))?$/.exec(line.trim());
        if (spaced) cells.splice(0, cells.length, ...spaced.slice(1).map(v => v || ""));
      }
      if (cells.length === 1 && headers.length > 1) {
        const vertical = sourceLines.slice(i, i + headers.length).map(v => v.trim());
        if (vertical.length === headers.length) { cells.splice(0, cells.length, ...vertical); last = i + headers.length - 1; }
      }
      const row = Object.fromEntries(headers.map((id, j) => [id, cells[j]?.trim() || ""]));
      if (!/^[\p{L}\p{N}][\p{L}\p{N}._/+&-]{0,79}$/u.test(row.sku || "") || /^\d{9}-\d{5}$/.test(row.sku || "") || !/^\d{13}$/.test(row.ean || "")) {
        if (line.trim()) headers = null;
        continue;
      }
      variants.push({sku: row.sku, ean: row.ean, designation: row.designation || "", packaging: row.packaging || "", evidence: sourceLines.slice(i, last + 1).join("\n")});
      for (let j = i; j <= last; j++) tableLines.add(j);
      i = last;
    }
    const rubricText = sourceLines.map((line, i) => tableHeaders.has(i) ? "Tableau de variantes:" : tableLines.has(i) ? "" : line).join("\n");
    let tokenText = rubricText.replace(/\*{1,2}([^*\n]{1,90})\*{1,2}/g, "\n$1:\n");
    tokenText = tokenText.replace(
      new RegExp(`(${labelPattern})[ \t]*[:：=]`, "giu"),
      (match, label, offset, text) => {
        // A lower-case suffix inside a word (e.g. « surprise: ») is not
        // a rubric. Glued headings must retain an identifiable capital.
        if (offset && /[\p{L}\p{N}]/u.test(text[offset - 1]) && label[0] === label[0].toLowerCase()) return match;
        return "\n" + label + ":";
      },
    );
    const lines = tokenText.split(/\r\n?|\n/);
    const prefixLabel = new RegExp(`^(${labelPattern})[ \t]+(.+)$`, "iu");
    const numericFields = new Set([
      "drying",
      "settingTime",
      "recoat",
      "consumption",
      "filmThickness",
      "storage",
      "storageMonths",
      "density",
      "dryExtract",
      "weight",
      "capacity",
      "coverage",
      "units",
    ]);
    let first = true;
    for (let index = 0; index < lines.length; index++) {
      let original = lines[index];
      let line = original.trim();
      if (!line) continue;
      // A label itself may wrap across two or three lines, e.g. Temps de / séchage.
      for (
        let span = 3;
        !/[:：=]/.test(line) && !aliases.includes(norm(line)) && span >= 2;
        span--
      ) {
        // A colon terminates the heading: never absorb the following rubric.
        if (lines.slice(index, index + span - 1).some((v) => /[:：=]/.test(v)))
          continue;
        const joined = lines
          .slice(index, index + span)
          .map((v) => v.trim())
          .join(" ");
        const label = joined.split(/[:：=]/, 1)[0].trim();
        if (aliases.includes(norm(label))) {
          original = lines.slice(index, index + span).join("\n");
          line = joined;
          index += span - 1;
          break;
        }
      }
      let labelled = /^([^:：=]{1,90})\s*[:：=]\s*(.*)$/.exec(line);
      if (!labelled && !aliases.includes(norm(line))) {
        const prefix = prefixLabel.exec(line);
        const candidate =
          prefix && fields.find((f) => f.aliases.includes(norm(prefix[1])));
        if (
          candidate &&
          candidate.id !== active &&
          ((numericFields.has(candidate.id) && /^\d/.test(prefix[2])) ||
            [
              "sku",
              "ean",
              "onebaseRef",
              "packaging",
              "vocClass",
              "fireReaction",
            ].includes(candidate.id) ||
            (candidate.id === "application" &&
              /^(manuelle?|airless)/i.test(prefix[2])))
        )
          labelled = prefix;
      }
      const label = labelled ? labelled[1] : line;
      let field = fields.find((f) => f.aliases.includes(norm(label)));
      if (/^les produits [1-5]$/.test(norm(label)))
        field = fields.find((f) => f.id === "arguments");
      // Sec is a sub-label of the drying block, not another independent field.
      const applicationDetail = [
        "buse",
        "pression",
        "dilution",
        "materiel",
        "airless",
        "manuelle",
        "application manuelle",
        "application airless",
        "nettoyage du materiel",
      ];
      if (
        (norm(label) === "sec" && active === "drying") ||
        (active === "application" &&
          labelled &&
          applicationDetail.includes(norm(label)))
      ) {
        block.push(line);
        continue;
      }
      if (field) {
        flush();
        active = field.id;
        encountered.add(field.id);
        if (labelled && labelled[2]) block.push(labelled[2]);
        first = false;
        continue;
      }
      if (
        sections.has(norm(line)) ||
        aliases.includes(norm(label)) ||
        labelled ||
        /^\*.*\*$/.test(original.trim())
      ) {
        flush();
        unclassified.push(original);
        first = false;
        continue;
      }
      if (/^A\d{5}\.?$/.test(line)) {
        flush();
        add("sku", line.replace(/\.$/, ""), original);
        warnings.push(
          "Référence article isolée reconnue : confirmez son association au produit.",
        );
        first = false;
        continue;
      }
      if (first && line.length < 250 && !/https?:|\[image\]/i.test(line)) {
        add("designation", line, original);
        first = false;
        continue;
      }
      first = false;
      if (active) block.push(line);
      else unclassified.push(original);
    }
    flush();
    // Conservative extraction of explicitly written paint characteristics from the original text.
    const patterns = {
      composition: /\bpeinture\s+acrylique(?:\s+mate)?\b/giu,
      finish: /\b(?:mate|mat|satinée|satiné|brillante|brillant)\b/giu,
      usage: /\bintérieure?\s*(?:\/|et|-|–)\s*extérieure?\b/giu,
      support: /\bmurs\s+et\s+plafonds\b/giu,
      drying:
        /\b(?:séchage|sec)\s*[:：]?\s*(\d+(?:[.,]\d+)?\s*(?:h(?:eures?)?|min(?:utes?)?))\b/giu,
      recoat:
        /\brecouvrable(?:\s+(?:après|en))?\s*[:：]?\s*(\d+(?:[.,]\d+)?\s*(?:h(?:eures?)?|min(?:utes?)?))\b/giu,
      abrasion:
        /\b(?:résistance\s+à\s+l['’]abrasion\s+humide\s*[:：]?\s*(?:Norme[^\n]*?:\s*)?)(classe\s+[1-5])\b/giu,
    };
    for (const [id, regex] of Object.entries(patterns)) {
      const context =
        ["finish", "composition", "usage"].includes(id) &&
        candidates.technical.length
          ? candidates.technical.map((c) => c.value).join("\n")
          : raw;
      if (!candidates[id].length)
        for (const match of context.matchAll(regex))
          add(id, match[1] || match[0], match[0]);
    }
    const extracted = {},
      evidence = {};
    for (const field of fields) {
      let entries = candidates[field.id];
      if (["technical", "arguments"].includes(field.id) && entries.length) {
        extracted[field.id] = entries.map((e) => e.value).join("\n");
        evidence[field.id] = entries.map((e) => e.evidence);
        continue;
      }
      const distinct = [...new Set(entries.map((e) => norm(e.value)))];
      if (distinct.length > 1) {
        warnings.push(
          field.label +
            " : plusieurs valeurs possibles, à choisir manuellement.",
        );
        extracted[field.id] = "";
      } else extracted[field.id] = entries[0]?.value || "";
      evidence[field.id] = entries.map((e) => e.evidence);
    }
    extracted.genericPackaging = extracted.genericPackaging || extracted.packaging;
    evidence.genericPackaging = evidence.genericPackaging.length ? evidence.genericPackaging : [...evidence.packaging];
    if (variants.length) {
      const choice = selectedSku || extracted.sku;
      const matches = variants.filter(v => v.sku === choice);
      const selected = choice ? (matches.length === 1 ? matches[0] : null) : (variants.length === 1 ? variants[0] : null);
      // Explicit identifiers in a rubric must agree with the selected table row.
      if (selected && (!extracted.ean || extracted.ean === selected.ean)) {
        for (const id of ["sku", "ean", "designation", "packaging"]) {
          if (selected[id]) { extracted[id] = selected[id]; evidence[id] = [selected.evidence]; }
        }
        if (!selected.packaging) {
          const packageMatch = /(?:sac|seau|pot|bidon|carton)s?\s+(?:de\s+)?\d+(?:[.,]\d+)?\s*(?:kg|l)\b/iu.exec(selected.designation);
          if (packageMatch) { extracted.packaging = packageMatch[0]; evidence.packaging = [selected.evidence]; }
          else extracted.packaging = "";
        }
      } else {
        for (const id of ["sku", "ean", "packaging", "weight", "capacity", "units", "packagingType"]) {
          extracted[id] = ""; evidence[id] = variants.map(v => v.evidence);
        }
        warnings.push("Tableau SKU/EAN : plusieurs variantes ou références contradictoires. Choisissez et vérifiez une ligne ; aucune variante inventée.");
      }
    }
    if (extracted.brand) {
      const m = /^Marque\s+(.+?)\s*-\s*(.+)$/i.exec(extracted.brand);
      if (m && norm(m[1]) === norm(m[2])) extracted.brand = m[2];
    }
    if (extracted.drying && /\bsec\s*:/i.test(extracted.drying)) {
      const sec = /Sec\s*:\s*([^\n.]+)/i.exec(extracted.drying);
      if (sec) extracted.drying = sec[1].trim();
    }
    if (
      extracted.packaging &&
      /\d+\s*(?:et|ou|\/)\s*\d+\s*(?:L|kg)\b/i.test(extracted.packaging)
    )
      warnings.push(
        "Plusieurs contenances dans la source : confirmer le conditionnement associé au SKU, aucune contenance choisie automatiquement.",
      );
    if (
      norm(extracted.family) === "enduit" &&
      /peinture/i.test(extracted.technical || extracted.designation)
    )
      warnings.push(
        "Incohérence source : catégorie Enduit pour une peinture. Choisir une catégorie Castorama adaptée.",
      );
    // Identifiers must be single explicit values, never the next heading or a
    // OneBase ID masquerading as a commercial reference.
    const identifierRules = {
      sku: (v) =>
        /^[\p{L}\p{N}][\p{L}\p{N}._/+&-]{0,79}$/u.test(v) &&
        !/^\d{9}-\d{5}$/.test(v) &&
        !aliases.includes(norm(v)),
      onebaseRef: (v) => /^\d{9}-\d{5}$/.test(v),
      ean: (v) => /^\d{13}$/.test(v),
    };
    for (const [id, valid] of Object.entries(identifierRules)) {
      if (extracted[id] && !valid(extracted[id])) {
        warnings.push(
          fields.find((f) => f.id === id).label +
            " : valeur non identifiable ou ambiguë, champ laissé vide. Consulter la source originale.",
        );
        extracted[id] = "";
      }
    }
    if (extracted.packaging) {
      // Only an unambiguous, explicit single package is split. Plural options
      // and ranges retain their source text and never imply a selected variant.
      const match =
        /^(?:(\d+)\s+)?(seaux?|sacs?|pots?|cartons?|bidons?)\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*kg[.]?$/iu.exec(
          extracted.packaging,
        );
      if (match) {
        const derived = {
          ...(match[1] ? { units: match[1] } : {}),
          packagingType: match[2],
          weight: match[3],
        };
        for (const [id, value] of Object.entries(derived)) {
          if (extracted[id] && norm(extracted[id]) !== norm(value)) {
            extracted[id] = "";
            warnings.push(
              fields.find((f) => f.id === id).label +
                " : conflit avec le conditionnement, à vérifier.",
            );
          } else if (!evidence[id].length) extracted[id] = value;
          evidence[id].push(extracted.packaging);
        }
        if (!extracted.units) warnings.push("Nombre d’unités absent du conditionnement : champ laissé vide, aucune quantité inventée.");
      } else if (
        !extracted.units ||
        !extracted.packagingType ||
        !extracted.weight
      ) {
        warnings.push(
          "Conditionnement : nombre d’unités, type ou poids non identifiables sans ambiguïté ; compléter uniquement depuis la source.",
        );
      }
    }
    for (const id of encountered)
      if (!extracted[id])
        warnings.push(
          fields.find((f) => f.id === id).label +
            " : rubrique vide ou ambiguë, aucune valeur inventée.",
        );
    if (!extracted.ean)
      warnings.push(
        "EAN non identifié : champ laissé vide, aucune valeur inventée.",
      );
    if (unclassified.length)
      warnings.push(
        "Passages ou rubriques non classés : consulter le texte original conservé intégralement.",
      );
    if (!extracted.sku)
      warnings.push(
        "Référence article / SKU non identifiée : ne pas utiliser automatiquement la référence OneBase.",
      );
    if (!extracted.designation)
      warnings.push(
        "Désignation non identifiée : à renseigner depuis la source.",
      );
    return { raw, extracted, evidence, warnings, unclassified, variants };
  }
  const escape = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  function htmlIssues(text) {
    if (!text) return [];
    const doc = new DOMParser().parseFromString(text, "text/html"),
      allowed = new Set([
        "P",
        "BR",
        "UL",
        "OL",
        "LI",
        "STRONG",
        "EM",
        "B",
        "I",
      ]);
    return [...doc.head.children, ...doc.body.querySelectorAll("*")].some(
      (n) => !allowed.has(n.tagName) || n.attributes.length,
    )
      ? [
          "HTML : seules les balises p, br, ul, ol, li, strong, em, b et i sans attribut sont autorisées.",
        ]
      : [];
  }
  function suggestions(values) {
    const title = [values.brand, values.designation]
      .filter(Boolean)
      .filter((v, i, a) => i === 0 || !norm(v).startsWith(norm(a[0]) + " "))
      .join(" ");
    const argumentLines = String(values.arguments || "")
      .split("\n")
      .map((v) => v.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
    const facts = fields
      .filter(
        (f) =>
          [
            "composition",
            "finish",
            "usage",
            "support",
            "drying",
            "recoat",
            "abrasion",
            "packaging",
            "capacity",
            "coverage",
          ].includes(f.id) && values[f.id],
      )
      .map((f) => f.label + " : " + values[f.id]);
    const arguments5 = argumentLines.length
      ? argumentLines.slice(0, 5)
      : facts.slice(0, 5);
    return {
      title:
        values.designation &&
        norm(values.designation).startsWith(norm(values.brand) + " ")
          ? values.designation
          : title,
      html: [
        values.designation,
        values.technical || values.shortDescription,
        values.packaging,
      ]
        .filter(Boolean)
        .map((v) => "<p>" + escape(v).replace(/\n/g, "<br>") + "</p>")
        .join("\n"),
      ...Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => [
          "argument" + (i + 1),
          arguments5[i] || "",
        ]),
      ),
    };
  }
  return { fields, norm, parse, suggestions, htmlIssues };
})();

window.ProductWorkflow = (() => {
  const enriched = [
    "title",
    "html",
    "argument1",
    "argument2",
    "argument3",
    "argument4",
    "argument5",
  ];
  function validate(d) {
    const fail = () => {
      throw Error("Dossier OneBase / Castorama invalide dans la sauvegarde.");
    };
    if (
      !d ||
      d.version !== 1 ||
      !d.source ||
      typeof d.source.raw !== "string" ||
      d.source.raw.length > 200000 ||
      typeof d.source.importedAt !== "string"
    )
      fail();
    for (const key of ["extracted", "evidence"])
      if (
        !d.source[key] ||
        typeof d.source[key] !== "object" ||
        Array.isArray(d.source[key])
      )
        fail();
    const ids = new Set(OneBase.fields.map((f) => f.id));
    for (const [k, v] of Object.entries(d.source.extracted))
      if (!ids.has(k) || typeof v !== "string" || v.length > 100000) fail();
    for (const [k, v] of Object.entries(d.source.evidence))
      if (
        !ids.has(k) ||
        !Array.isArray(v) ||
        v.length > 20000 ||
        v.some((s) => typeof s !== "string" || s.length > 200000)
      )
        fail();
    for (const key of ["enrichment", "castorama"]) {
      const obj = d[key];
      if (
        !obj ||
        typeof obj !== "object" ||
        Array.isArray(obj) ||
        Object.entries(obj).some(
          ([k, v]) =>
            !enriched.includes(k) || typeof v !== "string" || v.length > 100000,
        )
      )
        fail();
    }
    if (
      d.variantConfirmed !== undefined &&
      typeof d.variantConfirmed !== "boolean"
    )
      fail();
    if (d.templateValues !== undefined) {
      if (
        !d.templateValues ||
        typeof d.templateValues !== "object" ||
        Array.isArray(d.templateValues) ||
        Object.keys(d.templateValues).length > 10
      )
        fail();
      for (const [signature, values] of Object.entries(d.templateValues)) {
        if (
          signature.length > 30000 ||
          !values ||
          Array.isArray(values) ||
          typeof values !== "object" ||
          Object.keys(values).length > 250 ||
          Object.entries(values).some(
            ([k, v]) =>
              !/^\d+$/.test(k) || typeof v !== "string" || v.length > 100000,
          )
        )
          fail();
      }
    }
    if (d.chatgpt !== undefined) ChatGPTWorkflow.validateArchive(d.chatgpt);
    return structuredClone(d);
  }
  function plan(data, parsed, values, enrichment, castorama, productId = null) {
    const M = CatalogueModel,
      extra = OneBase.fields
        .filter((f) => !data.attributes.some((a) => a.id === f.id))
        .map((f) => ({
          id: f.id,
          label: f.label,
          type: ["price", "stock"].includes(f.id) ? "number" : "text",
          required: false,
          group: "Source OneBase",
        }));
    let p = productId ? data.products.find((p) => p.id === productId) : null;
    const matches = data.products.filter(
      (p) =>
        (values.sku && p.values.sku?.trim() === values.sku.trim()) ||
        (values.ean && p.values.ean?.trim() === values.ean.trim()),
    );
    if (matches.length > 1 || (p && matches.some((m) => m.id !== p.id)))
      throw Error(
        "Ces identifiants correspondent à plusieurs fiches : corrigez le conflit.",
      );
    p = p || matches[0];
    if (
      !productId &&
      p &&
      values.sku &&
      p.values.sku &&
      p.values.sku !== values.sku
    )
      throw Error(
        "Un identifiant appartient à un autre SKU. Vérifiez les références avant mise à jour.",
      );
    if (!values.sku?.trim())
      throw Error(
        "Référence article / SKU nécessaire pour enregistrer la fiche.",
      );
    const mapped = {};
    for (const a of [...data.attributes, ...extra])
      if (Object.hasOwn(values, a.id)) mapped[a.id] = String(values[a.id]);
    const source = parsed
      ? {
          raw: parsed.raw,
          extracted: structuredClone(parsed.extracted),
          evidence: structuredClone(parsed.evidence),
          importedAt: new Date().toISOString(),
        }
      : p?.dossier?.source || {
          raw: "",
          extracted: {},
          evidence: {},
          importedAt: new Date().toISOString(),
        };
    const dossier = validate({
      ...(p?.dossier || {}),
      version: 1,
      source,
      enrichment,
      castorama,
      templateValues: p?.dossier?.templateValues || {},
      variantConfirmed:
        !!p?.dossier?.variantConfirmed &&
        p.values.packaging === values.packaging &&
        p.values.sku === values.sku,
    });
    const changes = Object.entries(mapped)
      .filter(([k, v]) => String(p?.values[k] ?? "") !== v)
      .map(([field, after]) => ({
        field,
        before: String(p?.values[field] ?? ""),
        after,
      }));
    for (const group of ["enrichment", "castorama"])
      for (const key of enriched)
        if (
          (p?.dossier?.[group]?.[key] ?? null) !== (dossier[group][key] ?? null)
        )
          changes.push({
            field: group + "." + key,
            before: p?.dossier?.[group]?.[key] ?? "(hérité)",
            after: dossier[group][key] ?? "(hérité)",
          });
    if (parsed && parsed.raw !== p?.dossier?.source.raw)
      changes.push({
        field: "Texte OneBase original",
        before: p?.dossier?.source.raw ? "Texte source existant" : "Aucun",
        after: "Nouveau texte collé (" + parsed.raw.length + " caractères)",
      });
    return {
      revision: data.revision,
      productId: p?.id || null,
      values: mapped,
      dossier,
      extra,
      changes,
    };
  }
  function apply(data, plan) {
    const M = CatalogueModel;
    if (data.revision !== plan.revision)
      throw Error(
        "Catalogue modifié depuis la prévisualisation. Actualisez et recommencez.",
      );
    const next = M.clone ? M.clone(data) : structuredClone(data);
    next.attributes.push(...plan.extra);
    let p = next.products.find((p) => p.id === plan.productId);
    if (!p) {
      p = { id: M.uid(), values: {}, status: "À compléter", updatedAt: "" };
      next.products.push(p);
    }
    p.values = { ...p.values, ...plan.values };
    p.dossier = validate(plan.dossier);
    p.updatedAt = new Date().toISOString();
    p.status = M.issues(p, next).length ? "À compléter" : "À contrôler";
    if (M.issues(p, next).some((i) => i.message === "Identifiant dupliqué"))
      throw Error("SKU ou EAN déjà utilisé.");
    next.history.unshift({
      id: M.uid(),
      at: p.updatedAt,
      type: plan.productId ? "Fiche OneBase modifiée" : "Fiche OneBase créée",
      count: 1,
    });
    next.history = next.history.slice(0, 100);
    return M.validateSnapshot(next);
  }
  function destinations(data) {
    return [
      ...data.attributes.map((a) => ({
        id: "master." + a.id,
        label: "Catalogue · " + a.label,
      })),
      ...ChatGPTWorkflow.markets.flatMap((market) =>
        [
          "titleSeo",
          "descriptionHtml",
          "argument1",
          "argument2",
          "argument3",
          "argument4",
          "argument5",
          "keywords",
          "faqGeo",
        ].map((field) => ({
          id: "chatgpt." + market + "." + field,
          label: "ChatGPT validé · " + market + " · " + field,
        })),
      ),
      ...enriched.map((k) => ({
        id: "content." + k,
        label:
          "Castorama / enrichissement · " +
          ({ title: "Titre", html: "Description HTML" }[k] ||
            "Argument " + k.slice(-1)),
      })),
    ];
  }
  function value(product, key) {
    const [group, field] = key.split(".");
    if (group === "chatgpt") {
      const content = ChatGPTWorkflow.latest(product, field),
        attribute = key.split(".")[2];
      if (!content || content.sku !== product.values.sku) return "";
      if (/^argument[1-5]$/.test(attribute))
        return content.arguments[Number(attribute.slice(-1)) - 1];
      if (attribute === "keywords") return content.keywords.join(", ");
      if (attribute === "faqGeo") return JSON.stringify(content.faqGeo);
      return content[attribute] || "";
    }
    if (group === "master") return product.values[field] ?? "";
    if (group === "content")
      return Object.hasOwn(product.dossier?.castorama || {}, field)
        ? product.dossier.castorama[field]
        : product.dossier?.enrichment?.[field] || "";
    return "";
  }
  function guess(label, data) {
    const n = OneBase.norm(label.replace(/\*/g, ""));
    const argument =
      /(?:argument(?:s)?(?: marketing| commercial| commerciaux)?|bullet point|avantage|puces avantages marketing)\s*([1-5])$/.exec(
        n,
      );
    if (argument) return "content.argument" + argument[1];
    if (
      [
        "titre",
        "titre produit",
        "titre optimise",
        "product title",
        "nom produit",
        "nom",
      ].includes(n)
    )
      return "content.title";
    if (
      [
        "description html",
        "description produit html",
        "description",
        "product description",
        "texte description",
      ].includes(n)
    )
      return "content.html";
    const aliases = {
      "boutique sku": "sku",
      "sku offre": "sku",
      ean: "ean",
      "id produit": "ean",
      "prix offre": "price",
      "quantite offre": "stock",
      "marque d acquisition": "brand",
      "rendement en m2 l": "coverage",
      "classe d emissions de cov composes organiques volatils dans l air interieur":
        "vocClass",
    };
    if (aliases[n] && data.attributes.some((a) => a.id === aliases[n]))
      return "master." + aliases[n];
    const matched = OneBase.fields.filter(
      (f) => f.aliases.includes(n) || OneBase.norm(f.label) === n,
    );
    if (
      matched.length === 1 &&
      data.attributes.some((a) => a.id === matched[0].id)
    )
      return "master." + matched[0].id;
    const a = data.attributes.filter((a) => OneBase.norm(a.label) === n);
    return a.length === 1 ? "master." + a[0].id : "";
  }
  return { enriched, validate, plan, apply, destinations, value, guess };
})();
