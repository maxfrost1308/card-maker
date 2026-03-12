/**
 * Pill Picker and Tag Picker components.
 *
 * Extracted from table-view.js (REQ-021) to reduce file size and allow
 * edit-view.js to import pickers without depending on the full table module.
 *
 * Exports (re-exported by js/table-view.js for backward compatibility):
 *   createTagPicker  — free-form tags with autocomplete and create-on-type
 *   createPillPicker — click-to-toggle multi-select from a fixed options list
 *
 * Internal helpers (also exported for use by table-view.js internals):
 *   hashTagColor — deterministic color from tag value string
 *   isPillField  — true for select/multi-select fields that have options
 *   createPill   — creates a single pill <span> element
 */

// Predefined palette for hash-based tag colors
const TAG_COLORS = [
  '#6a4c93', '#2e86ab', '#c44569', '#5b7553', '#e07b00',
  '#8b1a1a', '#3c3c6e', '#b8560b', '#d4a017', '#34495e',
  '#7a5195', '#8b7355', '#e91e63', '#6b4c8a', '#7bb369',
];

/**
 * Get a consistent color for a tag value based on its name hash.
 * @param {string} value
 * @returns {string} CSS color string
 */
export function hashTagColor(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

/**
 * Returns true if the field should render as pills (select/multi-select with options).
 * @param {Object} field
 * @returns {boolean}
 */
export function isPillField(field) {
  return (field.type === 'select' || field.type === 'multi-select') && !!field.options;
}

/**
 * Create a single pill <span> element for a value.
 * Applies pillColors from the field schema if defined.
 *
 * @param {string} value
 * @param {Object} field
 * @returns {HTMLSpanElement}
 */
export function createPill(value, field) {
  const pill = document.createElement('span');
  pill.className = 'cell-pill';
  pill.textContent = value;
  if (field.pillColors && field.pillColors[value]) {
    pill.style.backgroundColor = field.pillColors[value];
    pill.style.color = '#fff';
  }
  return pill;
}

/**
 * Create a Tag Picker component for free-form tags or dynamic multi-select.
 * Provides autocomplete from existing row values and a "Create …" option for new tags.
 *
 * @param {Object} field - Schema field definition
 * @param {string[]} selectedValues - Initially selected values
 * @param {function(string[]): void} onChange - Called with new values array on change
 * @param {Object[]|null} allRows - All data rows (used to build autocomplete options for tags)
 * @returns {HTMLDivElement} wrapper with ._selectedValues property
 */
export function createTagPicker(field, selectedValues, onChange, allRows) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tag-picker';
  wrapper._selectedValues = [...selectedValues];

  // For "tags" type, compute options dynamically from all rows
  let options = field.options || [];
  if (field.type === 'tags' && allRows) {
    const sep = field.separator || '|';
    const optSet = new Set();
    for (const row of allRows) {
      const val = row[field.key];
      if (val && typeof val === 'string') {
        val.split(sep).map(v => v.trim()).filter(Boolean).forEach(v => optSet.add(v));
      }
    }
    selectedValues.forEach(v => optSet.add(v));
    options = [...optSet].sort();
  }

  const tagsContainer = document.createElement('div');
  tagsContainer.className = 'tag-picker-tags';
  wrapper.appendChild(tagsContainer);

  const inputWrap = document.createElement('div');
  inputWrap.className = 'tag-picker-input-wrap';
  const input = document.createElement('input');
  input.className = 'tag-picker-input';
  input.placeholder = field.type === 'tags' ? 'Add or create...' : 'Add...';
  input.type = 'text';
  inputWrap.appendChild(input);

  const dropdown = document.createElement('div');
  dropdown.className = 'tag-picker-dropdown';
  dropdown.hidden = true;
  inputWrap.appendChild(dropdown);
  wrapper.appendChild(inputWrap);

  function renderTags() {
    tagsContainer.innerHTML = '';
    for (const val of wrapper._selectedValues) {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      if (field.pillColors && field.pillColors[val]) {
        pill.style.backgroundColor = field.pillColors[val];
        pill.style.color = '#fff';
      } else if (field.type === 'tags') {
        pill.style.backgroundColor = hashTagColor(val);
        pill.style.color = '#fff';
      }
      const text = document.createElement('span');
      text.className = 'tag-pill-text';
      text.textContent = val;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'tag-pill-remove';
      removeBtn.type = 'button';
      removeBtn.textContent = '\u00D7';
      removeBtn.setAttribute('aria-label', `Remove ${val}`);
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        wrapper._selectedValues = wrapper._selectedValues.filter(v => v !== val);
        renderTags();
        renderDropdown();
        onChange(wrapper._selectedValues);
      });
      pill.append(text, removeBtn);
      tagsContainer.appendChild(pill);
    }
  }

  function addValue(val) {
    if (val && !wrapper._selectedValues.includes(val)) {
      wrapper._selectedValues.push(val);
      input.value = '';
      renderTags();
      renderDropdown();
      onChange(wrapper._selectedValues);
      input.focus();
    }
  }

  function renderDropdown() {
    dropdown.innerHTML = '';
    const q = input.value.toLowerCase().trim();
    const available = options.filter(opt =>
      !wrapper._selectedValues.includes(opt) &&
      (!q || opt.toLowerCase().includes(q))
    );

    // For tags type: "Create <value>" option when typed value is new
    if (
      field.type === 'tags' && q &&
      !options.some(o => o.toLowerCase() === q) &&
      !wrapper._selectedValues.some(v => v.toLowerCase() === q)
    ) {
      const createBtn = document.createElement('button');
      createBtn.className = 'tag-picker-option tag-picker-create';
      createBtn.type = 'button';
      createBtn.textContent = `Create "${input.value.trim()}"`;
      createBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        addValue(input.value.trim());
      });
      dropdown.appendChild(createBtn);
    }

    if (available.length === 0 && !dropdown.firstChild) {
      const empty = document.createElement('div');
      empty.className = 'tag-picker-empty';
      empty.textContent = q ? 'No matches' : 'All selected';
      dropdown.appendChild(empty);
    } else {
      for (const opt of available) {
        const btn = document.createElement('button');
        btn.className = 'tag-picker-option';
        btn.type = 'button';
        const pill = document.createElement('span');
        pill.className = 'cell-pill';
        pill.textContent = opt;
        if (field.pillColors && field.pillColors[opt]) {
          pill.style.backgroundColor = field.pillColors[opt];
          pill.style.color = '#fff';
        }
        btn.appendChild(pill);
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          addValue(opt);
        });
        dropdown.appendChild(btn);
      }
    }
  }

  input.addEventListener('focus', () => { renderDropdown(); dropdown.hidden = false; });
  input.addEventListener('input', () => { renderDropdown(); dropdown.hidden = false; });
  input.addEventListener('blur', () => { setTimeout(() => { dropdown.hidden = true; }, 150); });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); const val = input.value.trim(); if (val) addValue(val); }
    if (e.key === 'Escape') { dropdown.hidden = true; input.blur(); }
  });

  renderTags();
  return wrapper;
}

/**
 * Create a Pill Picker component for click-to-toggle multi-select from a fixed options list.
 *
 * @param {Object} field - Schema field definition (must have .options array)
 * @param {string[]} selectedValues - Initially selected values
 * @param {function(string[]): void} onChange - Called with new values array on change
 * @returns {HTMLDivElement} wrapper with ._selectedValues property
 */
export function createPillPicker(field, selectedValues, onChange) {
  const wrapper = document.createElement('div');
  wrapper.className = 'pill-picker';
  wrapper.setAttribute('role', 'group');
  wrapper.setAttribute('aria-label', field.label || field.key);
  wrapper._selectedValues = [...selectedValues];

  function render() {
    wrapper.innerHTML = '';
    for (const opt of field.options) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'pill-picker-pill';
      pill.textContent = opt;

      const isSelected = wrapper._selectedValues.includes(opt);
      pill.setAttribute('aria-pressed', String(isSelected));
      if (isSelected) {
        pill.classList.add('selected');
        if (field.pillColors && field.pillColors[opt]) {
          pill.style.backgroundColor = field.pillColors[opt];
          pill.style.color = '#fff';
          pill.style.borderColor = field.pillColors[opt];
        }
      }

      pill.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (wrapper._selectedValues.includes(opt)) {
          wrapper._selectedValues = wrapper._selectedValues.filter(v => v !== opt);
        } else {
          wrapper._selectedValues.push(opt);
        }
        render();
        onChange(wrapper._selectedValues);
      });

      wrapper.appendChild(pill);
    }
  }

  render();
  return wrapper;
}
