// HELPERS

function createElement(tag, className, text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function getByPath(object, path) {
  return path.split(".").reduce((value, key) => value[key], object);
}

function setByPath(object, path, value) {
  const keys = path.split(".");
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => current[key], object);
  target[lastKey] = value;
}

function addNumericControl(section, definition, config) {
  const wrapper = createElement("div", "sim-control");
  const header = createElement("div", "sim-control-header");
  const label = createElement("label", "sim-control-label", definition.label);
  const number = createElement("input", "sim-control-number");
  const range = createElement("input", "sim-control-range");

  for (const input of [number, range]) {
    input.type = input === number ? "number" : "range";
    input.min = definition.min;
    input.max = definition.max;
    input.step = definition.step;
  }

  // Kept separately so reset restores the value that existed when the control was created.
  const defaultValue = Number(getByPath(config, definition.path));

  function apply(rawValue) {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;

    // Keeps both inputs and the underlying config synchronized to the allowed range.
    const value = Math.min(definition.max, Math.max(definition.min, parsed));
    number.value = value;
    range.value = value;
    setByPath(config, definition.path, value);
    definition.onChange?.(value);
  }

  range.addEventListener("input", () => apply(range.value));
  number.addEventListener("change", () => apply(number.value));
  apply(defaultValue);

  header.append(label, number);
  wrapper.append(header, range);
  section.append(wrapper);

  return () => apply(defaultValue);
}


// CONTROL PANEL

export function createControlPanel(config, sections, callbacks = {}) {
  const panel = createElement("div", "sim-control-panel");
  const header = createElement("div", "sim-panel-header");
  header.append(
    createElement("div", "sim-panel-title", "Paramètres de la simulation"),
    createElement(
      "div",
      "sim-panel-subtitle",
      "Clic gauche : répulsion · clic droit : attraction",
    ),
  );
  panel.append(header);

  // Each control exposes its own reset so the panel can restore all initial values uniformly.
  const resets = [];

  for (const sectionDefinition of sections) {
    const section = createElement("div", "sim-panel-section");
    section.append(
      createElement("div", "sim-panel-section-title", sectionDefinition.title),
    );

    for (const control of sectionDefinition.controls) {
      resets.push(addNumericControl(section, control, config));
    }

    panel.append(section);
  }

  const resetButton = createElement(
    "button",
    "sim-panel-button",
    "Réinitialiser les paramètres",
  );
  resetButton.type = "button";
  resetButton.addEventListener("click", () =>
    resets.forEach((reset) => reset()),
  );
  panel.append(resetButton);

  const toggle = createElement("button", "sim-ui-toggle", "⚙");
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Afficher ou cacher les paramètres");
  toggle.addEventListener("click", () => {
    const hidden = panel.classList.toggle("hidden");
    toggle.textContent = hidden ? "☰" : "⚙";
  });

  document.body.append(panel, toggle);
  callbacks.onCreated?.({ panel, toggle });

  return { panel, toggle };
}