let commandersCache = [];
let editingMatchId = "";
let editingMatchData = null;

// =========================================================
// CONTROLE DE ABAS
// =========================================================
function showTab(tabId) {
    document.querySelectorAll(".tab").forEach(tab => tab.classList.add("hidden"));
    document.getElementById(tabId).classList.remove("hidden");
}


// =========================================================
// FUNÇÃO PARA ESCAPAR TEXTO E EVITAR QUEBRAS NO HTML
// =========================================================
function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// =========================================================
// CRIA UMA LINHA DE INPUT NA TELA DE CRIAR/EDITAR COMMANDER
// =========================================================
function createInputRowHTML(value = "", type = "text") {
    const row = document.createElement("div");
    row.className = "input-row";

    row.innerHTML = `
        <input placeholder="Input name (example: turns, result, pod)" value="${escapeHtml(value)}" class="input-name">
        <select class="input-type">
            <option value="text" ${type === "text" ? "selected" : ""}>text</option>
            <option value="number" ${type === "number" ? "selected" : ""}>number</option>
            <option value="checkbox" ${type === "checkbox" ? "selected" : ""}>checkbox</option>
            <option value="scale_0_10" ${type === "scale_0_10" ? "selected" : ""}>scale_0_10</option>
            <option value="color_combo" ${type === "color_combo" ? "selected" : ""}>color_combo</option>
        </select>
        <button type="button" class="danger" onclick="this.parentElement.remove()">Remove</button>
    `;

    return row;
}

function addCommanderInputRow(value = "", type = "text") {
    const container = document.getElementById("inputsContainer");
    container.appendChild(createInputRowHTML(value, type));
}


// =========================================================
// LIMPA O FORMULÁRIO DE COMMANDER
// =========================================================
function resetCommanderForm() {
    document.getElementById("editingCommanderId").value = "";
    document.getElementById("commanderName").value = "";
    document.getElementById("inputsContainer").innerHTML = "";
    addCommanderInputRow();
    document.getElementById("commanderMessage").textContent = "";
}


// =========================================================
// PEGA OS DADOS DO FORMULÁRIO DE COMMANDER
// =========================================================
function getCommanderFormData() {
    const id = document.getElementById("editingCommanderId").value.trim();
    const name = document.getElementById("commanderName").value.trim();

    const inputs = [];

    document.querySelectorAll("#inputsContainer .input-row").forEach(row => {
        const inputName = row.querySelector(".input-name").value.trim();
        const inputType = row.querySelector(".input-type").value.trim();

        if (inputName) {
            inputs.push({
                value: inputName,
                type: inputType
            });
        }
    });

    return { id, name, inputs };
}


// =========================================================
// SALVA COMMANDER (CRIA OU EDITA)
// =========================================================
async function saveCommander() {
    const data = getCommanderFormData();

    if (!data.name) {
        document.getElementById("commanderMessage").innerHTML =
            '<span class="warning">Commander name is required.</span>';
        return;
    }

    try {
        const response = await fetch("/api/commanders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            document.getElementById("commanderMessage").innerHTML =
                '<span class="success">Commander saved successfully.</span>';

            resetCommanderForm();
            await loadCommanders();
        } else {
            document.getElementById("commanderMessage").innerHTML =
                '<span class="warning">' + escapeHtml(result.error || "Could not save commander.") + "</span>";
        }
    } catch (error) {
        document.getElementById("commanderMessage").innerHTML =
            '<span class="warning">Error saving commander.</span>';
    }
}


// =========================================================
// CARREGA TODOS OS COMMANDERS
// =========================================================
async function loadCommanders() {
    const response = await fetch("/api/commanders");
    const commanders = await response.json();

    commandersCache = commanders;

    renderCommandersList(commanders);
    renderCommanderSelects(commanders);
}


// =========================================================
// RENDERIZA LISTA DE COMMANDERS EXISTENTES
// =========================================================
function renderCommandersList(commanders) {
    const list = document.getElementById("commandersList");
    list.innerHTML = "";

    if (!commanders.length) {
        list.innerHTML = '<div class="small">No commanders yet.</div>';
        return;
    }

    commanders.forEach(commander => {
        const div = document.createElement("div");
        div.className = "commander-list-item";

        const inputsText = (commander.inputs || [])
            .map(i => `${i.value} (${i.type})`)
            .join(", ");

        div.innerHTML = `
            <div>
                <strong>${escapeHtml(commander.name)}</strong>
                <div class="small">${escapeHtml(inputsText || "No inputs")}</div>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="secondary" onclick="editCommander('${commander.id}')">Edit</button>
            </div>
        `;

        list.appendChild(div);
    });
}


// =========================================================
// PREENCHE OS SELECTS DE COMMANDERS
// =========================================================
function renderCommanderSelects(commanders) {
    const matchSelect = document.getElementById("matchCommanderSelect");
    const statsSelect = document.getElementById("statsCommanderSelect");

    matchSelect.innerHTML = '<option value="">Select a commander</option>';
    statsSelect.innerHTML = '<option value="">Select a commander</option>';

    commanders.forEach(commander => {
        const option1 = document.createElement("option");
        option1.value = commander.id;
        option1.textContent = commander.name;
        matchSelect.appendChild(option1);

        const option2 = document.createElement("option");
        option2.value = commander.id;
        option2.textContent = commander.name;
        statsSelect.appendChild(option2);
    });
}


// =========================================================
// COLOCA UM COMMANDER EXISTENTE NO FORM PARA EDIÇÃO
// =========================================================
function editCommander(id) {
    const commander = commandersCache.find(c => c.id === id);

    if (!commander) {
        return;
    }

    document.getElementById("editingCommanderId").value = commander.id;
    document.getElementById("commanderName").value = commander.name;
    document.getElementById("inputsContainer").innerHTML = "";

    if ((commander.inputs || []).length === 0) {
        addCommanderInputRow();
    } else {
        commander.inputs.forEach(input => {
            addCommanderInputRow(input.value, input.type);
        });
    }

    document.getElementById("commanderMessage").textContent = "";
    showTab("manage-commanders");
    window.scrollTo({ top: 0, behavior: "smooth" });
}


// =========================================================
// OPÇÕES DO SELECT scale_0_10
// =========================================================
function getScale010Options() {
    return ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "10+"];
}


// =========================================================
// CORES DISPONÍVEIS PARA COMBINAÇÕES
// =========================================================
function getColorOptions() {
    return ["red", "blue", "white", "black", "green", "colorless"];
}


// =========================================================
// GERA TODAS AS COMBINAÇÕES POSSÍVEIS DE CORES
// + NO PLAYER
// =========================================================
function getAllColorCombinations() {
    const colors = getColorOptions();
    const combinations = [];

    for (let mask = 1; mask < (1 << colors.length); mask++) {
        const combo = [];

        for (let i = 0; i < colors.length; i++) {
            if (mask & (1 << i)) {
                combo.push(colors[i]);
            }
        }

        combinations.push(combo.join(" "));
    }

    combinations.sort((a, b) => {
        const aCount = a.split(" ").length;
        const bCount = b.split(" ").length;

        if (aCount !== bCount) {
            return aCount - bCount;
        }

        return a.localeCompare(b);
    });

    return ["no player", ...combinations];
}


// =========================================================
// MONTA HTML DAS OPTIONS DE UM SELECT
// =========================================================
function buildSelectOptions(options) {
    return `
        <option value="">Select</option>
        ${options.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}
    `;
}


// =========================================================
// RENDERIZA OS INPUTS DO MATCH COM BASE NO COMMANDER ESCOLHIDO
// =========================================================
function getColorOptions() {
    return ["red", "blue", "white", "black", "green", "colorless"];
}

function createColorComboField(inputName) {
    const colors = getColorOptions();

    return `
        <div class="color-combo-box" data-color-combo-name="${escapeHtml(inputName)}">
            <label class="color-combo-no-player">
                <input type="checkbox" class="color-combo-no-player-checkbox" data-input-name="${escapeHtml(inputName)}">
                <span>no player</span>
            </label>

            <div class="color-combo-grid">
                ${colors.map(color => `
                    <label class="color-option">
                        <input
                            type="checkbox"
                            class="color-combo-color-checkbox"
                            data-input-name="${escapeHtml(inputName)}"
                            value="${escapeHtml(color)}"
                        >
                        <span>${escapeHtml(color)}</span>
                    </label>
                `).join("")}
            </div>
        </div>
    `;
}

function setupColorComboInteractions() {
    document.querySelectorAll(".color-combo-box").forEach(box => {
        const noPlayerCheckbox = box.querySelector(".color-combo-no-player-checkbox");
        const colorCheckboxes = box.querySelectorAll(".color-combo-color-checkbox");

        noPlayerCheckbox.addEventListener("change", () => {
            if (noPlayerCheckbox.checked) {
                colorCheckboxes.forEach(checkbox => {
                    checkbox.checked = false;
                });
            }
        });

        colorCheckboxes.forEach(checkbox => {
            checkbox.addEventListener("change", () => {
                const anyColorChecked = Array.from(colorCheckboxes).some(item => item.checked);

                if (anyColorChecked) {
                    noPlayerCheckbox.checked = false;
                }
            });
        });
    });
}

function getColorComboValue(inputName) {
    const box = document.querySelector(`.color-combo-box[data-color-combo-name="${CSS.escape(inputName)}"]`);

    if (!box) {
        return "";
    }

    const noPlayerCheckbox = box.querySelector(".color-combo-no-player-checkbox");
    const colorCheckboxes = box.querySelectorAll(".color-combo-color-checkbox");

    if (noPlayerCheckbox && noPlayerCheckbox.checked) {
        return "no player";
    }

    const selectedColors = Array.from(colorCheckboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);

    return selectedColors.join(" ");
}

function renderMatchInputs() {
    const commanderId = document.getElementById("matchCommanderSelect").value;
    const container = document.getElementById("matchInputsContainer");

    container.innerHTML = "";

    const commander = commandersCache.find(c => c.id === commanderId);

    if (!commander) {
        return;
    }

    (commander.inputs || []).forEach(input => {
        const wrapper = document.createElement("div");
        wrapper.className = "row";

        let fieldHtml = "";

        if (input.type === "number") {
            fieldHtml = `
                <input type="number" data-input-name="${escapeHtml(input.value)}" class="match-input">
            `;
        } else if (input.type === "checkbox") {
            fieldHtml = `
                <select data-input-name="${escapeHtml(input.value)}" class="match-input">
                    <option value="">Select</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                </select>
            `;
        } else if (input.type === "scale_0_10") {
            fieldHtml = `
                <select data-input-name="${escapeHtml(input.value)}" class="match-input">
                    ${buildSelectOptions(getScale010Options())}
                </select>
            `;
        } else if (input.type === "color_combo") {
            fieldHtml = createColorComboField(input.value);
        } else {
            fieldHtml = `
                <input type="text" data-input-name="${escapeHtml(input.value)}" class="match-input">
            `;
        }

        wrapper.innerHTML = `
            <div class="col">
                <div class="label">${escapeHtml(input.value)} (${escapeHtml(input.type)})</div>
                ${fieldHtml}
            </div>
        `;

        container.appendChild(wrapper);
    });
    setupColorComboInteractions();
}



// =========================================================
// SALVA A COR CORRETAMENTE
// =========================================================
function setColorComboValue(inputName, value) {
    const box = document.querySelector(`.color-combo-box[data-color-combo-name="${CSS.escape(inputName)}"]`);

    if (!box) {
        return;
    }

    const noPlayerCheckbox = box.querySelector(".color-combo-no-player-checkbox");
    const colorCheckboxes = box.querySelectorAll(".color-combo-color-checkbox");

    if (!value || value.trim() === "") {
        if (noPlayerCheckbox) {
            noPlayerCheckbox.checked = false;
        }

        colorCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        return;
    }

    const cleanedValue = value.trim().toLowerCase();

    if (cleanedValue === "no player") {
        if (noPlayerCheckbox) {
            noPlayerCheckbox.checked = true;
        }

        colorCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        return;
    }

    if (noPlayerCheckbox) {
        noPlayerCheckbox.checked = false;
    }

    const selectedParts = cleanedValue.split(" ");

    colorCheckboxes.forEach(checkbox => {
        checkbox.checked = selectedParts.includes(checkbox.value.toLowerCase());
    });
}



// =========================================================
// EDITAR UMA MATCH EXISTENTE
// =========================================================
function editMatch(matchId, commanderId, matchValues) {
    editingMatchId = matchId;
    editingMatchData = {
        commanderId: commanderId,
        values: matchValues || {}
    };

    const commanderSelect = document.getElementById("matchCommanderSelect");
    commanderSelect.value = commanderId;

    renderMatchInputs();

    const commander = commandersCache.find(c => c.id === commanderId);
    if (!commander) {
        return;
    }

    (commander.inputs || []).forEach(inputDef => {
        const inputName = inputDef.value;
        const inputType = inputDef.type;
        const savedValue = matchValues ? matchValues[inputName] : "";

        if (inputType === "color_combo") {
            setColorComboValue(inputName, String(savedValue || ""));
        } else {
            const inputElement = document.querySelector(`.match-input[data-input-name="${CSS.escape(inputName)}"]`);
            if (!inputElement) {
                return;
            }

            if (inputType === "checkbox") {
                if (savedValue === true) {
                    inputElement.value = "true";
                } else if (savedValue === false) {
                    inputElement.value = "false";
                } else {
                    inputElement.value = "";
                }
            } else {
                inputElement.value = savedValue ?? "";
            }
        }
    });

    document.getElementById("matchMessage").innerHTML =
        '<span class="warning">Editing existing match.</span>';

    showTab("add-match");
    window.scrollTo({ top: 0, behavior: "smooth" });
}



// =========================================================
// SALVA UM MATCH
// =========================================================
async function saveMatch() {
    const commanderId = document.getElementById("matchCommanderSelect").value;
    const commander = commandersCache.find(c => c.id === commanderId);

    if (!commander) {
        document.getElementById("matchMessage").innerHTML =
            '<span class="warning">Please choose a commander.</span>';
        return;
    }

    const values = {};

    (commander.inputs || []).forEach(inputDef => {
        const inputName = inputDef.value;
        const inputType = inputDef.type;

        if (inputType === "color_combo") {
            values[inputName] = getColorComboValue(inputName);
        } else {
            const inputElement = document.querySelector(`.match-input[data-input-name="${CSS.escape(inputName)}"]`);
            values[inputName] = inputElement ? inputElement.value : "";
        }
    });

    try {
        let response;

        if (editingMatchId) {
            response = await fetch(`/api/matches/${editingMatchId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    commander_id: commanderId,
                    values: values
                })
            });
        } else {
            response = await fetch("/api/matches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    commander_id: commanderId,
                    values: values
                })
            });
        }

        const result = await response.json();

        if (result.success) {
            document.getElementById("matchMessage").innerHTML =
                editingMatchId
                    ? '<span class="success">Match updated successfully.</span>'
                    : '<span class="success">Match saved successfully.</span>';

            editingMatchId = "";
            editingMatchData = null;

            document.getElementById("matchCommanderSelect").value = "";
            document.getElementById("matchInputsContainer").innerHTML = "";

            const statsCommanderSelect = document.getElementById("statsCommanderSelect");
            if (statsCommanderSelect.value === commanderId) {
                await loadStats();
            }
        } else {
            document.getElementById("matchMessage").innerHTML =
                '<span class="warning">' + escapeHtml(result.error || "Could not save match.") + "</span>";
        }
    } catch (error) {
        document.getElementById("matchMessage").innerHTML =
            '<span class="warning">Error saving match.</span>';
    }
}


// =========================================================
// CARREGA STATS DE UM COMMANDER
// =========================================================
async function loadStats() {
    const commanderId = document.getElementById("statsCommanderSelect").value;
    const summaryDiv = document.getElementById("statsSummary");
    const matchesDiv = document.getElementById("statsMatches");

    summaryDiv.innerHTML = "";
    matchesDiv.innerHTML = "";

    if (!commanderId) {
        return;
    }

    try {
        const response = await fetch(`/api/stats/${commanderId}`);
        const data = await response.json();

        if (!data.success) {
            summaryDiv.innerHTML = '<div class="warning">Could not load stats.</div>';
            return;
        }

        if (!data.stats.length) {
            summaryDiv.innerHTML = '<div class="small">No stats yet.</div>';
        } else {
            data.stats.forEach(stat => {
                const div = document.createElement("div");
                div.className = "stat-item";

                div.innerHTML = `
                    <strong>${escapeHtml(stat.input_name)}</strong>
                    <span class="small">(${escapeHtml(stat.input_type)})</span>
                    <div>${escapeHtml(stat.summary)}</div>
                    <div class="small">Games counted: ${stat.games_count}</div>
                `;

                summaryDiv.appendChild(div);
            });
        }

        if (!data.matches.length) {
            matchesDiv.innerHTML = '<div class="small">No matches yet.</div>';
        } else {
            data.matches.forEach(match => {
                const entries = Object.entries(match.values || {})
                    .map(([key, value]) => `<div><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</div>`)
                    .join("");

                const div = document.createElement("div");
                div.className = "match-item";

                const safeMatchJson = JSON.stringify(match.values || {})
                    .replaceAll("&", "&amp;")
                    .replaceAll("<", "&lt;")
                    .replaceAll(">", "&gt;")
                    .replaceAll('"', "&quot;")
                    .replaceAll("'", "&#039;");

                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
                        <div><strong>Date:</strong> ${escapeHtml(match.created_at || "")}</div>
                        <button
                            type="button"
                            class="secondary"
                            style="width:auto;"
                            onclick='editMatch(${JSON.stringify(match.id)}, ${JSON.stringify(match.commander_id)}, ${JSON.stringify(match.values || {})})'
                        >
                            Edit
                        </button>
                    </div>
                    <div style="margin-top:8px;">${entries}</div>
                `;

                matchesDiv.appendChild(div);
            });
        }
    } catch (error) {
        summaryDiv.innerHTML = '<div class="warning">Error loading stats.</div>';
    }
}


// =========================================================
// INICIA O APP
// =========================================================
async function startApp() {
    resetCommanderForm();
    await loadCommanders();
}

startApp();