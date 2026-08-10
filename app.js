(() => {
  const c = window.HUB_CONFIG;
  const $ = (s) => document.querySelector(s);

  $("#brand").textContent = c.brand;
  $("#eyebrow").textContent = c.eyebrow;
  $("#title").textContent = c.title;
  $("#tagline").textContent = c.tagline;
  $("#footer").textContent = c.footer;
  document.title = `${c.brand} — Hub`;

  const grid = $("#grid");
  const filters = $("#filters");
  const search = $("#search");
  const empty = $("#empty");

  let category = "Alle";
  let query = "";

  const categories = ["Alle", ...new Set(c.pages.map(p => p.category).filter(Boolean))];

  function renderFilters() {
    filters.replaceChildren(...categories.map(name => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = name;
      b.className = "filter";
      b.setAttribute("aria-pressed", name === category);
      b.addEventListener("click", () => {
        category = name;
        renderFilters();
        renderPages();
      });
      return b;
    }));
  }

  function matches(p) {
    const cat = category === "Alle" || p.category === category;
    const text = [p.title, p.description, p.category, p.badge]
      .filter(Boolean).join(" ").toLocaleLowerCase("da-DK");
    return cat && (!query || text.includes(query));
  }

  function card(p) {
    const a = document.createElement("a");
    a.className = "card";
    a.href = p.href;

    const top = document.createElement("div");
    top.className = "card-top";

    const icon = document.createElement("span");
    icon.className = "icon";
    icon.textContent = p.icon || "→";

    const cat = document.createElement("span");
    cat.className = "category";
    cat.textContent = p.category || "Side";

    top.append(icon, cat);

    const h3 = document.createElement("h3");
    h3.textContent = p.title;

    const desc = document.createElement("p");
    desc.textContent = p.description || "";

    const bottom = document.createElement("div");
    bottom.className = "card-bottom";

    const open = document.createElement("strong");
    open.textContent = "Åbn →";
    bottom.append(open);

    if (p.badge) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = p.badge;
      bottom.append(badge);
    }

    a.append(top, h3, desc, bottom);
    return a;
  }

  function renderPages() {
    const pages = c.pages.filter(matches);
    grid.replaceChildren(...pages.map(card));
    empty.classList.toggle("hidden", pages.length > 0);
  }

  search.addEventListener("input", () => {
    query = search.value.trim().toLocaleLowerCase("da-DK");
    renderPages();
  });

  renderFilters();
  renderPages();
})();
