
const display = document.getElementById("display");
const expressionDisplay = document.getElementById("expression");
const statusMessage = document.getElementById("statusMessage");

const scientificButtons = document.getElementById("scientificButtons");
const modeToggle = document.getElementById("modeToggle");
const themeToggle = document.getElementById("themeToggle");
const soundToggle = document.getElementById("soundToggle");
const angleToggle = document.getElementById("angleToggle");
const angleMode = document.getElementById("angleMode");

const historyList = document.getElementById("historyList");
const historyCount = document.getElementById("historyCount");

let expression = "";
let justEvaluated = false;
let isScientific = false;
let isDegrees = true;
let soundEnabled = false;

let history = [];

try {
    const savedHistory = JSON.parse(
        localStorage.getItem("calculatorHistory") || "[]"
    );

    if (Array.isArray(savedHistory)) {
        history = savedHistory
            .filter(item =>
                typeof item.expression === "string" &&
                typeof item.result === "string"
            )
            .slice(0, 30);
    }
} catch {
    history = [];
}

// ------------------------------
// DISPLAY
// ------------------------------

function updateDisplay() {
    display.value = expression || "0";
}

function showMessage(message) {
    statusMessage.textContent = message;

    setTimeout(() => {
        statusMessage.textContent = "";
    }, 2200);
}

function formatResult(value) {
    if (!Number.isFinite(value)) {
        throw new Error("Invalid calculation");
    }

    if (Object.is(value, -0)) value = 0;

    return Number(value.toPrecision(12)).toString();
}

// ------------------------------
// SOUND EFFECTS
// ------------------------------

function playSound(frequency = 500) {
    if (!soundEnabled) return;

    try {
        const AudioContext =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContext) return;

        const audio = new AudioContext();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = frequency;

        gain.gain.setValueAtTime(0.035, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audio.currentTime + 0.08
        );

        oscillator.connect(gain);
        gain.connect(audio.destination);

        oscillator.start();
        oscillator.stop(audio.currentTime + 0.08);

        oscillator.onended = () => audio.close();
    } catch (error) {
        console.warn("Sound is unavailable.", error);
    }
}

soundToggle.addEventListener("click", () => {
    soundEnabled = !soundEnabled;

    soundToggle.classList.toggle("active", soundEnabled);
    soundToggle.textContent = soundEnabled ? "♫" : "♪";

    showMessage(soundEnabled ? "Sound enabled" : "Sound disabled");

    playSound(650);
});

// ------------------------------
// INPUT
// ------------------------------

function insertValue(value) {
    if (justEvaluated) {
        const startsNew = /^[0-9.]$/.test(value) ||
            /^[a-zA-Z]/.test(value) ||
            value === "(";

        if (startsNew) {
            expression = "";
        }

        justEvaluated = false;
    }

    if (expression.length >= 100) {
        showMessage("Expression limit reached");
        return;
    }

    expression += value;

    updateDisplay();
    playSound();
}

function clearCalculator() {
    expression = "";
    justEvaluated = false;

    expressionDisplay.textContent = "";
    updateDisplay();

    playSound(350);
}

function deleteLast() {
    if (justEvaluated) {
        clearCalculator();
        return;
    }

    if (expression.endsWith("sqrt(")) {
        expression = expression.slice(0, -5);
    } else if (
        ["sin(", "cos(", "tan(", "log(", "ln("]
            .some(fn => expression.endsWith(fn))
    ) {
        expression = expression.slice(0, -4);
    } else {
        expression = expression.slice(0, -1);
    }

    updateDisplay();
    playSound(400);
}

function changeSign() {
    if (!expression) {
        expression = "-";
    } else {
        expression = `-(${expression})`;
    }

    justEvaluated = false;
    updateDisplay();
}

// ------------------------------
// MATHEMATICAL EXPRESSION PARSER
// ------------------------------

function evaluateExpression(input) {

    if (!input || input.length > 100) {
        throw new Error("Invalid expression");
    }

    const tokens = input.match(
        /\d*\.?\d+(?:e[+-]?\d+)?|[a-zA-Z]+|[()+\-*/^%!]/gi
    ) || [];

    const normalized = input.replace(/\s/g, "");

    if (tokens.join("") !== normalized) {
        throw new Error("Invalid characters");
    }

    let position = 0;

    function peek() {
        return tokens[position];
    }

    function consume(expected) {
        if (peek() !== expected) {
            throw new Error("Invalid expression");
        }

        position++;
    }

    function parseExpression() {
        let value = parseTerm();

        while (peek() === "+" || peek() === "-") {
            const operator = tokens[position++];
            const right = parseTerm();

            value = operator === "+"
                ? value + right
                : value - right;
        }

        return value;
    }

    function parseTerm() {
        let value = parseUnary();

        while (peek() === "*" || peek() === "/") {
            const operator = tokens[position++];
            const right = parseUnary();

            if (operator === "/" && right === 0) {
                throw new Error("Cannot divide by zero");
            }

            value = operator === "*"
                ? value * right
                : value / right;
        }

        return value;
    }

    function parseUnary() {
        if (peek() === "+") {
            position++;
            return parseUnary();
        }

        if (peek() === "-") {
            position++;
            return -parseUnary();
        }

        return parsePower();
    }

    function parsePower() {
        let value = parsePrimary();

        if (peek() === "^") {
            position++;
            const exponent = parseUnary();
            value = Math.pow(value, exponent);
        }

        return value;
    }

    function parsePrimary() {
        let value;

        const token = peek();

        if (!token) {
            throw new Error("Incomplete expression");
        }

        if (token === "(") {
            position++;
            value = parseExpression();
            consume(")");
        } else if (/^\d/.test(token) || /^\.\d/.test(token)) {
            position++;
            value = Number(token);
        } else if (/^[a-z]+$/i.test(token)) {

            position++;

            if (token === "pi") {
                value = Math.PI;
            } else if (token === "e") {
                value = Math.E;
            } else {
                consume("(");

                const argument = parseExpression();

                consume(")");

                switch (token.toLowerCase()) {
                    case "sin":
                        value = Math.sin(
                            isDegrees
                                ? argument * Math.PI / 180
                                : argument
                        );
                        break;

                    case "cos":
                        value = Math.cos(
                            isDegrees
                                ? argument * Math.PI / 180
                                : argument
                        );
                        break;

                    case "tan": {
                        const angle = isDegrees
                            ? argument * Math.PI / 180
                            : argument;

                        if (Math.abs(Math.cos(angle)) < 1e-12) {
                            throw new Error("Undefined tangent");
                        }

                        value = Math.tan(angle);
                        break;
                    }

                    case "sqrt":
                        if (argument < 0) {
                            throw new Error("Invalid square root");
                        }

                        value = Math.sqrt(argument);
                        break;

                    case "log":
                        if (argument <= 0) {
                            throw new Error("Invalid logarithm");
                        }

                        value = Math.log10(argument);
                        break;

                    case "ln":
                        if (argument <= 0) {
                            throw new Error("Invalid logarithm");
                        }

                        value = Math.log(argument);
                        break;

                    default:
                        throw new Error("Unknown function");
                }
            }

        } else {
            throw new Error("Invalid expression");
        }

        while (peek() === "!" || peek() === "%") {
            const operator = tokens[position++];

            if (operator === "!") {
                if (
                    value < 0 ||
                    !Number.isInteger(value) ||
                    value > 170
                ) {
                    throw new Error("Invalid factorial");
                }

                let result = 1;

                for (let i = 2; i <= value; i++) {
                    result *= i;
                }

                value = result;
            } else {
                value /= 100;
            }
        }

        return value;
    }

    const result = parseExpression();

    if (position !== tokens.length) {
        throw new Error("Invalid expression");
    }

    return result;
}

// ------------------------------
// CALCULATE
// ------------------------------

function calculate() {
    if (!expression) return;

    const originalExpression = expression;

    try {
        const result = evaluateExpression(expression);
        const formattedResult = formatResult(result);

        expressionDisplay.textContent =
            originalExpression + " =";

        expression = formattedResult;
        justEvaluated = true;

        updateDisplay();

        addToHistory(originalExpression, formattedResult);

        showMessage("Calculation successful");
        playSound(750);

    } catch (error) {
        showMessage(error.message || "Invalid calculation");
        playSound(250);
    }
}

// ------------------------------
// PERCENTAGE
// ------------------------------

function applyPercentage() {
    if (!expression) return;

    try {
        const value = evaluateExpression(expression);

        expression = formatResult(value / 100);
        justEvaluated = true;

        expressionDisplay.textContent = "Percentage";
        updateDisplay();

        playSound();
    } catch (error) {
        showMessage(error.message);
    }
}

// ------------------------------
// HISTORY
// ------------------------------

function saveHistory() {
    try {
        localStorage.setItem(
            "calculatorHistory",
            JSON.stringify(history)
        );
    } catch {
        showMessage("History could not be saved");
    }
}

function addToHistory(originalExpression, result) {
    history.unshift({
        expression: originalExpression,
        result: result
    });

    history = history.slice(0, 30);

    saveHistory();
    renderHistory();
}

function renderHistory() {
    historyList.replaceChildren();

    historyCount.textContent =
        `${String(history.length).padStart(2, "0")} ITEMS`;

    if (history.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-history";

        const symbol = document.createElement("span");
        symbol.textContent = "◷";

        const title = document.createElement("p");
        title.textContent = "No calculations yet.";

        const description = document.createElement("small");
        description.textContent =
            "Your recent calculations will appear here.";

        empty.append(symbol, title, description);
        historyList.appendChild(empty);

        return;
    }

    history.forEach(item => {
        const historyItem = document.createElement("div");
        historyItem.className = "history-item";
        historyItem.tabIndex = 0;
        historyItem.setAttribute("role", "button");
        historyItem.setAttribute(
            "aria-label",
            `Use result ${item.result}`
        );

        const calculation = document.createElement("div");
        calculation.className = "history-expression";
        calculation.textContent = item.expression;

        const result = document.createElement("div");
        result.className = "history-result";
        result.textContent = "= " + item.result;

        historyItem.append(calculation, result);

        function reuseResult() {
            expression = item.result;
            justEvaluated = true;
            expressionDisplay.textContent = item.expression + " =";
            updateDisplay();
            playSound();
        }

        historyItem.addEventListener("click", reuseResult);

        historyItem.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                reuseResult();
            }
        });

        historyList.appendChild(historyItem);
    });
}

document.getElementById("clearHistory").addEventListener("click", () => {
    history = [];
    saveHistory();
    renderHistory();
    showMessage("History cleared");
});

// ------------------------------
// SCIENTIFIC MODE
// ------------------------------

modeToggle.addEventListener("click", () => {
    isScientific = !isScientific;

    scientificButtons.classList.toggle("hidden", !isScientific);

    modeToggle.innerHTML = isScientific
        ? 'STANDARD <span>−</span>'
        : 'SCIENTIFIC <span>＋</span>';

    showMessage(
        isScientific
            ? "Scientific mode enabled"
            : "Standard mode enabled"
    );

    playSound();
});

// ------------------------------
// ANGLE MODE
// ------------------------------

function updateAngleMode() {
    const mode = isDegrees ? "DEG" : "RAD";

    angleMode.textContent = mode;
    angleToggle.textContent = mode + "/RAD";
    angleToggle.textContent = isDegrees ? "DEG" : "RAD";
}

angleToggle.addEventListener("click", () => {
    isDegrees = !isDegrees;
    updateAngleMode();

    showMessage(
        isDegrees
            ? "Degree mode"
            : "Radian mode"
    );

    playSound();
});

// ------------------------------
// THEME TOGGLE
// ------------------------------

function applyTheme(theme) {
    document.body.classList.toggle(
        "light-theme",
        theme === "light"
    );

    themeToggle.textContent =
        theme === "light" ? "☾" : "☼";
}

let savedTheme = "dark";

try {
    savedTheme = localStorage.getItem("calculatorTheme") || "dark";
} catch {
    savedTheme = "dark";
}

applyTheme(savedTheme);

themeToggle.addEventListener("click", () => {
    const newTheme = document.body.classList.contains("light-theme")
        ? "dark"
        : "light";

    applyTheme(newTheme);

    try {
        localStorage.setItem("calculatorTheme", newTheme);
    } catch {
        // Theme still works for this session.
    }

    playSound();
});

// ------------------------------
// COPY RESULT
// ------------------------------

document.getElementById("copyBtn").addEventListener("click", async () => {
    const result = display.value;

    if (!result || result === "Error" || result === "0") {
        showMessage("No result to copy");
        return;
    }

    try {
        await navigator.clipboard.writeText(result);
        showMessage("Result copied successfully");
        playSound(700);
    } catch {
        showMessage("Clipboard unavailable. Select the result manually.");
    }
});

// ------------------------------
// BUTTON EVENTS
// ------------------------------

document.querySelectorAll("[data-insert]").forEach(button => {
    button.addEventListener("click", () => {
        insertValue(button.dataset.insert);
    });
});

document.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", () => {

        const action = button.dataset.action;

        switch (action) {
            case "clear":
                clearCalculator();
                break;

            case "delete":
            case "backspace":
                deleteLast();
                break;

            case "percent":
                applyPercentage();
                break;

            case "sign":
                changeSign();
                break;

            case "calculate":
                calculate();
                break;

            case "factorial":
                insertValue("!");
                break;
        }
    });
});

// ------------------------------
// KEYBOARD SUPPORT
// ------------------------------

document.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key = event.key;

    if (/^[0-9.]$/.test(key)) {
        insertValue(key);
    } else if (["+", "-", "*", "/", "(", ")", "^", "%", "!"].includes(key)) {
        insertValue(key);
    } else if (key === "Enter" || key === "=") {
        event.preventDefault();
        calculate();
    } else if (key === "Backspace") {
        deleteLast();
    } else if (key === "Escape") {
        clearCalculator();
    }
});

// INITIALIZE

updateDisplay();
renderHistory();
updateAngleMode();
