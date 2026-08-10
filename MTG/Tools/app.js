const API_BASE = "https://api.scryfall.com";
const REQUEST_GAP_MS = 550;
const MAX_RETRIES = 3;
const COLLECTION_BATCH_SIZE = 75;

const deckInput = document.querySelector("#deckInput");
const fileInput = document.querySelector("#fileInput");
const sampleButton = document.querySelector("#sampleButton");
const clearButton = document.querySelector("#clearButton");
const exportButton = document.querySelector("#exportButton");
const parsedSummary = document.querySelector("#parsedSummary");

const progressPanel = document.querySelector("#progressPanel");
const progressTitle = document.querySelector("#progressTitle");
const progressText = document.querySelector("#progressText");
const progressBar = document.querySelector("#progressBar");

const resultPanel = document.querySelector("#resultPanel");
const resultSummary = document.querySelector("#resultSummary");
const resultOutput = document.querySelector("#resultOutput");
const copyButton = document.querySelector("#copyButton");
const downloadButton = document.querySelector("#downloadButton");
const errorDetails = document.querySelector("#errorDetails");
const errorList = document.querySelector("#errorList");

const sampleDeck = `Commander
1 Márton Stromgald

Anthem//Evasion
1 Goblin War Drums
1 Shared Animosity

Ramp
1 Sol Ring
1 Fire Diamond

Removal
1 Lightning Bolt`;

let exporting = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeLine(line) {
  return line.replace(/\u00a0/g, " ").trim();
}

function parseCardLine(line) {
  // Supports:
  //   1 Card Name
  //   1x Card Name
  //   1 x Card Name
  //   1 Card Name (SET) 123
  const match = line.match(/^(\d+)\s*[xX]?\s+(.+?)\s*$/);
  if (!match) {
    return null;
  }

  const quantity = Number.parseInt(match[1], 10);
  let name = match[2].trim();

  // Common deck-export suffix: "(SET) collector-number".
  // Only remove it when it is at the end of the line.
  name = name.replace(/\s+\([A-Za-z0-9]{2,6}\)\s+[A-Za-z0-9★*+\-]+(?:\s+[A-Za-z]{2,3})?\s*$/, "");

  // Common foil marker.
  name = name.replace(/\s+\*F\*\s*$/i, "");

  if (!Number.isFinite(quantity) || quantity <= 0 || !name) {
    return null;
  }

  return { quantity, name };
}

function parseDeckWithCategories(text) {
  const entries = [];
  let currentCategory = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = normalizeLine(rawLine);

    if (!line || line.startsWith("#") || line.startsWith("//")) {
      continue;
    }

    // Ignore underline lines from a previous exporter output.
    if (/^[=\-]{3,}$/.test(line)) {
      continue;
    }

    const card = parseCardLine(line);

    if (card) {
      entries.push({
        type: "card",
        category: currentCategory,
        quantity: card.quantity,
        name: card.name,
      });
      continue;
    }

    // Any non-card text line is treated as a category header.
    currentCategory = line.replace(/:$/, "").trim();
    entries.push({
      type: "category",
      name: currentCategory,
    });
  }

  // Remove categories with no cards after them.
  return entries.filter((entry, index, all) => {
    if (entry.type !== "category") {
      return true;
    }

    for (let i = index + 1; i < all.length; i += 1) {
      if (all[i].type === "category") {
        return false;
      }
      if (all[i].type === "card") {
        return true;
      }
    }

    return false;
  });
}

function uniqueCardNames(entries) {
  const seen = new Set();
  const names = [];

  for (const entry of entries) {
    if (entry.type !== "card") continue;

    const key = entry.name.toLocaleLowerCase("en-US");
    if (!seen.has(key)) {
      seen.add(key);
      names.push(entry.name);
    }
  }

  return names;
}

function updateParsedSummary() {
  const entries = parseDeckWithCategories(deckInput.value);
  const cards = entries.filter((entry) => entry.type === "card");
  const categories = entries.filter((entry) => entry.type === "category");

  if (!deckInput.value.trim()) {
    parsedSummary.textContent = "";
    return;
  }

  const totalCopies = cards.reduce((sum, card) => sum + card.quantity, 0);
  parsedSummary.textContent =
    `${cards.length} kortlinjer · ${totalCopies} kort · ${categories.length} kategorier`;
}

async function readErrorMessage(response) {
  try {
    const payload = await response.json();
    return payload?.details || payload?.status || response.statusText || "Ukendt API-fejl";
  } catch {
    return response.statusText || "Ukendt API-fejl";
  }
}

async function fetchWithRetry(url, options = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Accept: "application/json",
          ...(options.headers || {}),
        },
      });

      if (response.ok) {
        return response;
      }

      const message = await readErrorMessage(response);

      if (response.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = Number.parseFloat(response.headers.get("Retry-After"));
        const retryMs = Number.isFinite(retryAfter)
          ? Math.max(retryAfter * 1000, REQUEST_GAP_MS)
          : REQUEST_GAP_MS * attempt * 2;

        await sleep(retryMs);
        continue;
      }

      const error = new Error(message);
      error.status = response.status;
      throw error;
    } catch (error) {
      lastError = error;

      const isHttpError = Number.isInteger(error?.status);
      const retryableHttp = error?.status === 429 || error?.status >= 500;

      if (attempt >= MAX_RETRIES || (isHttpError && !retryableHttp)) {
        throw error;
      }

      await sleep(REQUEST_GAP_MS * attempt * 2);
    }
  }

  throw lastError || new Error("Ukendt netværksfejl");
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function lookupKey(name) {
  return name.trim().toLocaleLowerCase("en-US");
}

function buildCardLookup(cards) {
  const lookup = new Map();

  for (const card of cards) {
    if (card?.name) {
      lookup.set(lookupKey(card.name), card);
    }
  }

  return lookup;
}

async function fetchExactCardsInBatches(names, onProgress) {
  const found = new Map();
  const unresolved = new Set(names.map((name) => lookupKey(name)));
  const batches = chunkArray(names, COLLECTION_BATCH_SIZE);
  let completed = 0;

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];

    if (i > 0) {
      await sleep(REQUEST_GAP_MS);
    }

    const response = await fetchWithRetry(`${API_BASE}/cards/collection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifiers: batch.map((name) => ({ name })),
      }),
    });

    const payload = await response.json();
    const batchLookup = buildCardLookup(payload.data || []);

    for (const [key, card] of batchLookup) {
      found.set(key, card);
      unresolved.delete(key);
    }

    completed += batch.length;
    onProgress?.(Math.min(completed, names.length), names.length, "Eksakte opslag");
  }

  return {
    found,
    unresolvedKeys: unresolved,
  };
}

async function fetchFuzzyCard(name) {
  const url = new URL(`${API_BASE}/cards/named`);
  url.searchParams.set("fuzzy", name);

  const response = await fetchWithRetry(url.toString());
  return response.json();
}

async function resolveCards(names, onProgress) {
  const exact = await fetchExactCardsInBatches(names, onProgress);
  const resolved = new Map(exact.found);
  const errors = new Map();

  const unresolvedNames = names.filter((name) =>
    exact.unresolvedKeys.has(lookupKey(name))
  );

  let completed = names.length - unresolvedNames.length;

  for (let i = 0; i < unresolvedNames.length; i += 1) {
    const name = unresolvedNames[i];

    // Leave a safe gap between Scryfall requests.
    await sleep(REQUEST_GAP_MS);

    try {
      const card = await fetchFuzzyCard(name);
      resolved.set(lookupKey(name), card);
    } catch (error) {
      errors.set(
        lookupKey(name),
        error?.message || `Could not resolve card name: ${name}`
      );
    }

    completed += 1;
    onProgress?.(completed, names.length, "Fuzzy-opslag");
  }

  return { resolved, errors };
}

function oracleTextFromCard(card) {
  if (typeof card?.oracle_text === "string" && card.oracle_text.trim()) {
    return card.oracle_text.trim();
  }

  if (Array.isArray(card?.card_faces)) {
    const faceTexts = card.card_faces
      .map((face) => {
        const text = typeof face?.oracle_text === "string"
          ? face.oracle_text.trim()
          : "";
        return text;
      })
      .filter(Boolean);

    if (faceTexts.length) {
      return faceTexts.join("\n//\n");
    }
  }

  return "(No Oracle text available)";
}

function formatExport(entries, resolved, errors) {
  const blocks = [];
  const missing = [];
  let foundCount = 0;
  let failedCount = 0;

  for (const entry of entries) {
    if (entry.type === "category") {
      blocks.push(entry.name);
      blocks.push("=".repeat(Math.max(3, entry.name.length)));
      continue;
    }

    const key = lookupKey(entry.name);
    const card = resolved.get(key);

    blocks.push(`${entry.quantity}x ${entry.name}`);

    if (card) {
      blocks.push(oracleTextFromCard(card));
      foundCount += 1;
    } else {
      const apiMessage = errors.get(key);
      const message = apiMessage
        ? `Could not resolve card name: ${entry.name} — ${apiMessage}`
        : `Could not resolve card name: ${entry.name}`;

      blocks.push(`(ERROR fetching oracle text: ${message})`);
      missing.push(entry.name);
      failedCount += 1;
    }

    blocks.push("");
  }

  // Avoid multiple blank lines while keeping one blank line between cards/categories.
  const text = blocks.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

  return {
    text,
    foundCount,
    failedCount,
    missing: [...new Set(missing)],
  };
}

function setProgress(done, total, phase = "Slår kort op") {
  const safeTotal = Math.max(total, 1);
  const percent = Math.max(0, Math.min(100, (done / safeTotal) * 100));

  progressTitle.textContent = `${phase}…`;
  progressText.textContent = `${Math.min(done, total)} / ${total}`;
  progressBar.style.width = `${percent}%`;
}

function setExporting(value) {
  exporting = value;
  exportButton.disabled = value;
  fileInput.disabled = value;
  sampleButton.disabled = value;
  clearButton.disabled = value;

  exportButton.textContent = value
    ? "Arbejder…"
    : "Eksportér Oracle-tekst";
}

function renderErrors(missing) {
  errorList.textContent = "";

  if (!missing.length) {
    errorDetails.classList.add("hidden");
    errorDetails.open = false;
    return;
  }

  for (const cardName of missing) {
    const item = document.createElement("li");
    item.textContent = cardName;
    errorList.appendChild(item);
  }

  errorDetails.classList.remove("hidden");
}

async function runExport() {
  if (exporting) return;

  const entries = parseDeckWithCategories(deckInput.value);
  const cards = entries.filter((entry) => entry.type === "card");

  if (!cards.length) {
    window.alert(
      "Jeg fandt ingen kortlinjer. Brug f.eks. “1 Sol Ring” eller “1x Sol Ring”."
    );
    deckInput.focus();
    return;
  }

  const names = uniqueCardNames(entries);

  setExporting(true);
  resultPanel.classList.add("hidden");
  progressPanel.classList.remove("hidden");
  setProgress(0, names.length);

  try {
    const { resolved, errors } = await resolveCards(names, setProgress);
    const result = formatExport(entries, resolved, errors);

    resultOutput.value = result.text;
    resultSummary.innerHTML = "";

    const found = document.createElement("span");
    found.className = result.failedCount === 0 ? "success" : "";
    found.textContent =
      `${result.foundCount} kortlinjer fundet`;

    resultSummary.appendChild(found);
    resultSummary.append(
      document.createTextNode(
        result.failedCount
          ? ` · ${result.failedCount} kunne ikke findes`
          : " · ingen fejl"
      )
    );

    renderErrors(result.missing);
    resultPanel.classList.remove("hidden");
    setProgress(names.length, names.length, "Færdig");
  } catch (error) {
    resultPanel.classList.remove("hidden");
    resultOutput.value = "";
    resultSummary.textContent =
      `Eksporten stoppede: ${error?.message || "Ukendt fejl"}`;
    renderErrors([]);
    progressTitle.textContent = "Fejl";
  } finally {
    setExporting(false);
  }
}

async function copyResult() {
  if (!resultOutput.value) return;

  try {
    await navigator.clipboard.writeText(resultOutput.value);
    const oldText = copyButton.textContent;
    copyButton.textContent = "Kopieret";
    setTimeout(() => {
      copyButton.textContent = oldText;
    }, 1200);
  } catch {
    resultOutput.select();
    document.execCommand("copy");
    window.getSelection()?.removeAllRanges();
  }
}

function downloadResult() {
  if (!resultOutput.value) return;

  const blob = new Blob([resultOutput.value], {
    type: "text/plain;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "exported_card_abilities.txt";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function clearAll() {
  deckInput.value = "";
  fileInput.value = "";
  resultOutput.value = "";
  parsedSummary.textContent = "";
  resultSummary.textContent = "";
  resultPanel.classList.add("hidden");
  progressPanel.classList.add("hidden");
  errorDetails.classList.add("hidden");
  errorList.textContent = "";
  progressBar.style.width = "0%";
  deckInput.focus();
}

deckInput.addEventListener("input", updateParsedSummary);

fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;

  try {
    deckInput.value = await file.text();
    updateParsedSummary();
    deckInput.focus();
  } catch {
    window.alert("Tekstfilen kunne ikke læses.");
  }
});

sampleButton.addEventListener("click", () => {
  deckInput.value = sampleDeck;
  updateParsedSummary();
  deckInput.focus();
});

clearButton.addEventListener("click", clearAll);
exportButton.addEventListener("click", runExport);
copyButton.addEventListener("click", copyResult);
downloadButton.addEventListener("click", downloadResult);

updateParsedSummary();
