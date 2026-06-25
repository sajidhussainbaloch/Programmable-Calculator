/* ============================================================
   ProCalc – Full Programmable Scientific Calculator
   ============================================================ */

// ============================================================
// 1. CORE CALCULATOR ENGINE
// ============================================================

const Calc = (() => {
    'use strict';

    // --- State ---
    const state = {
        display: '0',
        expression: '',
        memory: 0,
        memSet: false,
        angleMode: 'DEG',       // 'DEG' | 'RAD' | 'GRAD'
        invMode: false,
        hypMode: false,
        history: [],
        ans: 0,
        lastOperator: null,
        lastOperand: null,
        justEvaluated: false,
        openParens: 0,
    };

    // --- DOM refs ---
    const el = {
        result: document.getElementById('result'),
        expression: document.getElementById('expression'),
        angleBadge: document.getElementById('angleBadge'),
        memBadge: document.getElementById('memBadge'),
        invBadge: document.getElementById('invBadge'),
        hypBadge: document.getElementById('hypBadge'),
        angleIndicator: document.getElementById('angleIndicator'),
        memIndicator: document.getElementById('memIndicator'),
        historyList: document.getElementById('historyList'),
        historyBar: document.getElementById('historyBar'),
        statusMessage: document.getElementById('statusMessage'),
    };

    // --- Helpers ---
    function setStatus(msg) {
        if (el.statusMessage) el.statusMessage.textContent = msg;
    }

    function updateDisplay() {
        let disp = state.display;
        if (disp.length > 14) {
            el.result.className = 'result small';
        } else if (disp.length > 20) {
            el.result.className = 'result xsmall';
        } else {
            el.result.className = 'result';
        }
        el.result.textContent = disp;
        el.expression.textContent = state.expression;

        // Badges
        el.angleBadge.textContent = state.angleMode;
        el.angleBadge.className = 'badge' + (state.angleMode !== 'DEG' ? ' active-badge' : '');
        el.memBadge.style.display = state.memSet ? 'inline' : 'none';
        el.invBadge.style.display = state.invMode ? 'inline' : 'none';
        el.hypBadge.style.display = state.hypMode ? 'inline' : 'none';
        el.angleIndicator.textContent = state.angleMode;
        el.angleIndicator.className = 'angle-indicator' + (state.angleMode !== 'DEG' ? ' active' : '');
        el.memIndicator.className = 'mem-indicator' + (state.memSet ? ' active' : '');
    }

    function formatNum(n) {
        if (!isFinite(n)) return n > 0 ? '∞' : '-∞';
        if (isNaN(n)) return 'NaN';
        // If integer-ish
        if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toString();
        const s = n.toPrecision(12);
        // Remove trailing zeros
        let r = s.replace(/\.?0+$/, '');
        // If very large/small, use exponential
        if (Math.abs(n) > 1e15 || (Math.abs(n) < 1e-10 && n !== 0)) {
            r = n.toExponential(10).replace(/\.?0+e/, 'e');
        }
        return r;
    }

    function parseDisplay(str) {
        if (!str || str === 'π' || str === 'e') {
            if (str === 'π') return Math.PI;
            if (str === 'e') return Math.E;
            return 0;
        }
        // Handle scientific notation like 1.5e3
        let s = str.replace(/,/g, '');
        const num = parseFloat(s);
        if (!isNaN(num)) return num;
        // Try evaluating as expression
        try { return evaluateExpr(s); } catch(e) { return NaN; }
    }

    function getCurrentValue() {
        return parseDisplay(state.display);
    }

    function setDisplay(val) {
        if (typeof val === 'number') {
            if (!isFinite(val)) {
                state.display = val > 0 ? '∞' : '-∞';
            } else if (isNaN(val)) {
                state.display = 'NaN';
            } else {
                state.display = formatNum(val);
            }
        } else {
            state.display = val || '0';
        }
        updateDisplay();
    }

    // --- Angle conversion ---
    function toRadians(deg) {
        if (state.angleMode === 'RAD') return deg;
        if (state.angleMode === 'GRAD') return deg * Math.PI / 200;
        return deg * Math.PI / 180;
    }

    function fromRadians(rad) {
        if (state.angleMode === 'RAD') return rad;
        if (state.angleMode === 'GRAD') return rad * 200 / Math.PI;
        return rad * 180 / Math.PI;
    }

    // --- Operations ---
    const unaryOps = {
        sin:   (x) => Math.sin(toRadians(x)),
        cos:   (x) => Math.cos(toRadians(x)),
        tan:   (x) => Math.tan(toRadians(x)),
        asin:  (x) => fromRadians(Math.asin(x)),
        acos:  (x) => fromRadians(Math.acos(x)),
        atan:  (x) => fromRadians(Math.atan(x)),
        sinh:  (x) => Math.sinh(x),
        cosh:  (x) => Math.cosh(x),
        tanh:  (x) => Math.tanh(x),
        asinh: (x) => Math.asinh(x),
        acosh: (x) => Math.acosh(x),
        atanh: (x) => Math.atanh(x),
        sqrt:  (x) => x < 0 ? NaN : Math.sqrt(x),
        cbrt:  (x) => Math.cbrt(x),
        log:   (x) => x <= 0 ? NaN : Math.log10(x),
        ln:    (x) => x <= 0 ? NaN : Math.log(x),
        exp:   (x) => Math.exp(x),
        tenx:  (x) => Math.pow(10, x),
        square:(x) => x * x,
        recip: (x) => x === 0 ? NaN : 1 / x,
        negate:(x) => -x,
        fact:  (x) => { if (x < 0 || !Number.isInteger(x)) return NaN; let r=1; for(let i=2;i<=x;i++) r*=i; return r; },
    };

    const binaryOps = {
        add:      (a,b) => a + b,
        subtract: (a,b) => a - b,
        multiply: (a,b) => a * b,
        divide:   (a,b) => b === 0 ? (a === 0 ? NaN : (a > 0 ? Infinity : -Infinity)) : a / b,
        pow:      (a,b) => Math.pow(a, b),
        mod:      (a,b) => b === 0 ? NaN : a % b,
    };

    function applyUnary(op) {
        const val = getCurrentValue();
        let fn;
        // Handle INV + trig
        if (state.invMode) {
            const invMap = { sin: 'asin', cos: 'acos', tan: 'atan', sinh: 'asinh', cosh: 'acosh', tanh: 'atanh' };
            fn = invMap[op] || op;
            state.invMode = false;
        } else {
            fn = op;
        }
        // Handle HYP
        if (state.hypMode && ['sin','cos','tan','asin','acos','atan'].includes(fn)) {
            fn = fn.replace(/^(a?)(sin|cos|tan)$/, (_, a, t) => a + t + 'h');
            state.hypMode = false;
        }
        if (!unaryOps[fn]) { setStatus('Unknown: ' + fn); return; }
        const result = unaryOps[fn](val);
        state.expression = `${fn}(${state.display})`;
        if (isNaN(result) || !isFinite(result)) {
            state.display = formatNum(result);
        } else {
            state.display = formatNum(result);
        }
        state.ans = result;
        state.justEvaluated = true;
        updateDisplay();
        setStatus(`= ${formatNum(result)}`);
    }

    function applyBinary(op) {
        const val = getCurrentValue();
        if (state.lastOperator && !state.justEvaluated) {
            // Chain: evaluate previous first
            const prev = state.lastOperand;
            const result = binaryOps[state.lastOperator](prev, val);
            state.display = formatNum(result);
            state.ans = result;
            state.lastOperand = result;
        } else {
            state.lastOperand = val;
        }
        state.expression = `${formatNum(state.lastOperand)} ${op} `;
        state.lastOperator = op;
        state.justEvaluated = false;
        updateDisplay();
        setStatus('');
    }

    function applyEquals() {
        const val = getCurrentValue();

        // Build the full expression string
        let fullExpr = '';
        if (state.expression) {
            // If expression ends with operator, append current value
            const endsWithOp = /[\+\−\×÷\^]\s*$/.test(state.expression);
            if (endsWithOp) {
                fullExpr = state.expression + state.display;
            } else if (state.justEvaluated) {
                fullExpr = state.expression;
            } else {
                fullExpr = state.expression + state.display;
            }
        } else if (state.lastOperator) {
            fullExpr = `${formatNum(state.lastOperand)} ${state.lastOperator} ${state.display}`;
        } else {
            fullExpr = state.display;
        }

        if (state.lastOperator && !state.justEvaluated) {
            // Binary operation
            const prev = state.lastOperand;
            const result = binaryOps[state.lastOperator](prev, val);
            addHistory(`${formatNum(prev)} ${state.lastOperator} ${formatNum(val)}`, formatNum(result));
            state.expression = `${formatNum(prev)} ${state.lastOperator} ${formatNum(val)} =`;
            state.display = formatNum(result);
            state.ans = result;
            state.lastOperator = null;
            state.lastOperand = null;
        } else if (state.expression || state.justEvaluated) {
            // Evaluate full expression
            try {
                const result = evaluateExpr(fullExpr);
                if (state.expression && !state.justEvaluated) {
                    addHistory(fullExpr, formatNum(result));
                }
                state.display = formatNum(result);
                state.ans = result;
                state.expression = fullExpr + ' =';
                state.lastOperator = null;
                state.lastOperand = null;
            } catch(e) {
                setStatus('Error: ' + e.message);
                return;
            }
        } else {
            // Equals with just a number — do nothing
            state.expression = state.display + ' =';
        }
        state.justEvaluated = true;
        updateDisplay();
        setStatus('');
    }

    // --- Simple expression evaluator (for parens and full expressions) ---
    function evaluateExpr(expr) {
        // Replace × ÷ with * /, remove spaces
        let s = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s/g, '');
        // Handle implicit multiplication: 2π, 3(, )4, etc.
        s = s.replace(/(\d)π/g, '$1*pi').replace(/π(\d)/g, 'pi*$1');
        s = s.replace(/(\d)\(/g, '$1*(').replace(/\)(\d)/g, ')*$1');
        s = s.replace(/π/g, `(${Math.PI})`);
        // Replace 'e' only when it's a standalone token (not part of a number like 1.5e3)
        s = s.replace(/(?<!\d)e(?!\d)/g, `(${Math.E})`);

        // Replace scientific functions
        const funcs = {
            'sin': 'Math.sin', 'cos': 'Math.cos', 'tan': 'Math.tan',
            'asin': 'Math.asin', 'acos': 'Math.acos', 'atan': 'Math.atan',
            'sinh': 'Math.sinh', 'cosh': 'Math.cosh', 'tanh': 'Math.tanh',
            'sqrt': 'Math.sqrt', 'cbrt': 'Math.cbrt',
            'log': 'Math.log10', 'ln': 'Math.log',
            'exp': 'Math.exp', 'abs': 'Math.abs',
        };
        for (const [k, v] of Object.entries(funcs)) {
            s = s.replace(new RegExp(k, 'g'), v);
        }
        s = s.replace(/\^/g, '**');

        try {
            const fn = new Function('return ' + s + ';');
            const result = fn();
            if (typeof result !== 'number') throw new Error('Invalid');
            return result;
        } catch(e) {
            throw new Error('Expression error');
        }
    }

    // --- History ---
    function addHistory(expr, result) {
        state.history.unshift({ expr, result, ts: Date.now() });
        if (state.history.length > 50) state.history.pop();
        renderHistory();
        el.historyBar.classList.add('open');
    }

    function renderHistory() {
        el.historyList.innerHTML = state.history.map(h =>
            `<div class="history-item" data-expr="${h.expr}" data-result="${h.result}">
                <span class="h-expr">${h.expr}</span>
                <span class="h-result">= ${h.result}</span>
            </div>`
        ).join('');
        // Click to recall result
        el.historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                state.display = item.dataset.result;
                updateDisplay();
            });
        });
    }

    // --- Memory ---
    function memClear() { state.memory = 0; state.memSet = false; updateDisplay(); setStatus('Memory cleared'); }
    function memRecall() { if (state.memSet) { state.display = formatNum(state.memory); updateDisplay(); setStatus('Memory recalled'); } }
    function memPlus() { state.memory += getCurrentValue(); state.memSet = true; updateDisplay(); setStatus('Added to memory'); }
    function memMinus() { state.memory -= getCurrentValue(); state.memSet = true; updateDisplay(); setStatus('Subtracted from memory'); }

    // --- Constants ---
    function insertPi() {
        if (state.justEvaluated) { state.display = '0'; state.expression = ''; state.justEvaluated = false; }
        if (state.display === '0') {
            state.display = formatNum(Math.PI);
            state.expression = 'π';
        } else {
            // Append π as multiplication
            const curr = getCurrentValue();
            state.display = formatNum(curr * Math.PI);
            state.expression = (state.expression || '') + formatNum(curr) + ' × π';
        }
        state.ans = parseFloat(state.display);
        state.justEvaluated = true;
        updateDisplay();
    }
    function insertE() {
        if (state.justEvaluated) { state.display = '0'; state.expression = ''; state.justEvaluated = false; }
        if (state.display === '0') {
            state.display = formatNum(Math.E);
            state.expression = 'e';
        } else {
            const curr = getCurrentValue();
            state.display = formatNum(curr * Math.E);
            state.expression = (state.expression || '') + formatNum(curr) + ' × e';
        }
        state.ans = parseFloat(state.display);
        state.justEvaluated = true;
        updateDisplay();
    }

    // --- Input handlers ---
    function inputDigit(d) {
        if (state.justEvaluated) {
            state.display = '0';
            state.expression = '';
            state.justEvaluated = false;
            state.lastOperator = null;
        }
        if (state.display === '0' && d !== '.') {
            state.display = d;
        } else {
            if (state.display.length >= 24) return;
            state.display += d;
        }
        updateDisplay();
    }

    function inputDecimal() {
        if (state.justEvaluated) {
            state.display = '0.';
            state.expression = '';
            state.justEvaluated = false;
            state.lastOperator = null;
            updateDisplay();
            return;
        }
        if (!state.display.includes('.')) {
            state.display += '.';
        }
        updateDisplay();
    }

    function inputClear() {
        state.display = '0';
        state.expression = '';
        state.lastOperator = null;
        state.lastOperand = null;
        state.justEvaluated = false;
        state.openParens = 0;
        updateDisplay();
        setStatus('All cleared');
    }

    function inputParen(p) {
        if (p === '(') {
            if (state.justEvaluated && state.display !== '0') {
                // Implicit multiply: 5(
                state.expression = (state.expression || '') + state.display + ' × (';
                state.display = '0';
            } else {
                state.expression += '(';
            }
            state.openParens++;
            state.justEvaluated = false;
            setStatus('');
        } else {
            if (state.openParens > 0) {
                state.expression += state.display + ')';
                state.openParens--;
                try {
                    // Try evaluating the complete expression so far
                    const full = state.expression;
                    const val = evaluateExpr(full);
                    state.display = formatNum(val);
                    state.ans = val;
                } catch(e) {
                    // If can't evaluate yet, just update display
                    state.display = '0';
                }
                state.justEvaluated = true;
            } else {
                // Insert as a regular character
                state.expression += state.display + ')';
                state.display = '0';
            }
        }
        updateDisplay();
    }

    function inputRand() {
        const val = Math.random();
        state.display = formatNum(val);
        state.expression = 'rand()';
        state.justEvaluated = true;
        state.ans = val;
        updateDisplay();
        setStatus('Random: ' + formatNum(val));
    }

    function inputEE() {
        // Enter exponent: append 'e' for scientific notation
        if (state.display.includes('e')) return;
        state.display += 'e';
        updateDisplay();
    }

    function inputBackspace() {
        if (state.justEvaluated || state.display === '0') return;
        state.display = state.display.length > 1 ? state.display.slice(0, -1) : '0';
        updateDisplay();
    }

    // --- Keyboard mapping ---
    const keyboardMap = {
        '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
        '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
        '.': 'decimal', ',': 'decimal',
        '+': 'add', '-': 'subtract', '*': 'multiply', '/': 'divide',
        'Enter': 'equals', '=': 'equals',
        'Escape': 'clear', 'Backspace': 'backspace',
        '(': 'lparen', ')': 'rparen',
        '%': 'mod', '^': 'pow',
        'p': 'pi', 'e': 'euler',
        'r': 'rand', 's': 'sin', 'c': 'cos', 't': 'tan',
        'l': 'log', 'n': 'ln',
        'q': 'square', '!': 'fact',
    };

    // --- Process action ---
    function processAction(action) {
        // Numbers
        if (/^\d$/.test(action)) { inputDigit(action); return; }

        switch (action) {
            case 'decimal': inputDecimal(); break;
            case 'backspace': inputBackspace(); break;
            case 'clear': inputClear(); break;
            case 'backspace': inputBackspace(); break;
            case 'add': case 'subtract': case 'multiply': case 'divide':
            case 'mod': case 'pow':
                applyBinary(action); break;
            case 'equals': applyEquals(); break;
            case 'lparen': inputParen('('); break;
            case 'rparen': inputParen(')'); break;

            // Unary
            case 'sin': case 'cos': case 'tan':
            case 'asin': case 'acos': case 'atan':
            case 'sinh': case 'cosh': case 'tanh':
            case 'sqrt': case 'cbrt': case 'log': case 'ln':
            case 'exp': case 'tenx': case 'square': case 'recip':
            case 'negate': case 'fact':
                applyUnary(action); break;

            // Constants
            case 'pi': insertPi(); break;
            case 'euler': insertE(); break;

            // Memory
            case 'mc': memClear(); break;
            case 'mr': memRecall(); break;
            case 'mplus': memPlus(); break;
            case 'mminus': memMinus(); break;

            // Modes
            case 'inv': state.invMode = !state.invMode; updateDisplay(); setStatus(state.invMode ? 'INV mode on' : 'INV mode off'); break;
            case 'hyp': state.hypMode = !state.hypMode; updateDisplay(); setStatus(state.hypMode ? 'HYP mode on' : 'HYP mode off'); break;
            case 'deg':
                const modes = ['DEG', 'RAD', 'GRAD'];
                const idx = (modes.indexOf(state.angleMode) + 1) % 3;
                state.angleMode = modes[idx];
                updateDisplay();
                setStatus('Angle mode: ' + state.angleMode);
                break;
            case 'rand': inputRand(); break;
            case 'EE': inputEE(); break;

            default:
                setStatus('Unknown: ' + action);
        }
    }

    // --- Button binding ---
    function initButtons() {
        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                processAction(action);
            });
        });
    }

    // --- Keyboard binding ---
    function initKeyboard() {
        document.addEventListener('keydown', (e) => {
            const key = e.key;
            // Ctrl+Shift+P to toggle sidebar
            if (e.ctrlKey && e.shiftKey && key === 'P') {
                toggleSidebar();
                e.preventDefault();
                return;
            }

            if (keyboardMap[key]) {
                processAction(keyboardMap[key]);
                e.preventDefault();
            }
            // Allow shift+8 for multiply, etc.
            if (key === '(' || key === ')') {
                processAction(key === '(' ? 'lparen' : 'rparen');
                e.preventDefault();
            }
        });
    }

    // --- History toggle ---
    function initHistory() {
        // Click on expression to toggle history
        el.expression.addEventListener('click', () => {
            el.historyBar.classList.toggle('open');
        });
        document.getElementById('clearHistoryBtn').addEventListener('click', () => {
            state.history = [];
            renderHistory();
            el.historyBar.classList.remove('open');
        });
    }

    // --- Sidebar toggle ---
    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
    }

    function initSidebar() {
        document.getElementById('menuBtn').addEventListener('click', toggleSidebar);
        document.getElementById('closeSidebar').addEventListener('click', toggleSidebar);
    }

    // --- Public API ---
    function getState() { return state; }

    // --- Init ---
    function init() {
        initButtons();
        initKeyboard();
        initHistory();
        initSidebar();
        updateDisplay();
        setStatus('Ready — press ? for help');
    }

    return { init, processAction, getState, setDisplay, formatNum, unaryOps, binaryOps, evaluateExpr, addHistory };
})();


// ============================================================
// 2. PROGRAMMABLE SCRIPTING SYSTEM
// ============================================================

const Programmer = (() => {
    'use strict';

    const editor = document.getElementById('programEditor');
    const output = document.getElementById('programOutput');
    const runBtn = document.getElementById('runProgramBtn');
    const stopBtn = document.getElementById('stopProgramBtn');
    const clearBtn = document.getElementById('clearOutputBtn');
    const progSelect = document.getElementById('programSelect');
    const saveBtn = document.getElementById('saveProgramBtn');
    const deleteBtn = document.getElementById('deleteProgramBtn');
    const libraryList = document.getElementById('libraryList');

    let running = false;
    let aborted = false;

    // --- Program storage (localStorage) ---
    function loadPrograms() {
        try {
            return JSON.parse(localStorage.getItem('procalc_programs')) || {};
        } catch { return {}; }
    }
    function savePrograms(programs) {
        localStorage.setItem('procalc_programs', JSON.stringify(programs));
    }

    function populateSelect(programs) {
        const current = progSelect.value;
        progSelect.innerHTML = '<option value="new">+ New Program…</option>';
        for (const name of Object.keys(programs).sort()) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            progSelect.appendChild(opt);
        }
        if (programs[current]) progSelect.value = current;
    }

    function loadProgram(name) {
        const programs = loadPrograms();
        if (programs[name]) {
            editor.value = programs[name];
        }
    }

    function saveCurrentProgram() {
        let name = progSelect.value;
        if (name === 'new') {
            name = prompt('Enter program name:');
            if (!name) return;
        }
        const programs = loadPrograms();
        programs[name] = editor.value;
        savePrograms(programs);
        populateSelect(programs);
        progSelect.value = name;
        setStatus('Program "' + name + '" saved');
    }

    function deleteCurrentProgram() {
        const name = progSelect.value;
        if (name === 'new') return;
        if (!confirm(`Delete program "${name}"?`)) return;
        const programs = loadPrograms();
        delete programs[name];
        savePrograms(programs);
        populateSelect(programs);
        progSelect.value = 'new';
        editor.value = '';
        setStatus('Program deleted');
    }

    // --- Library programs ---
    const libraryPrograms = {
        fibonacci: `// Fibonacci Sequence
// Generates the first N Fibonacci numbers
let n = input('How many Fibonacci numbers? ');
let a = 0;
let b = 1;
print('Fibonacci sequence:');
for(let i = 0; i < n; i++) {
    print(a);
    let t = a + b;
    a = b;
    b = t;
}
print('Done!');`,

        quadratic: `// Quadratic Equation Solver
// Solves: ax² + bx + c = 0
print('Quadratic Solver: ax² + bx + c = 0');
let a = input('Enter a: ');
let b = input('Enter b: ');
let c = input('Enter c: ');

let d = b*b - 4*a*c;
if(d < 0) {
    print('No real solutions');
} elif(d == 0) {
    let x = -b / (2*a);
    print('One solution: x =', x);
} else {
    let x1 = (-b + sqrt(d)) / (2*a);
    let x2 = (-b - sqrt(d)) / (2*a);
    print('Two solutions:');
    print('x1 =', x1);
    print('x2 =', x2);
}`,

        factorial: `// Factorial Calculator
// Computes n! for non-negative integers
let n = input('Enter n: ');
if(n < 0) {
    print('Error: n must be >= 0');
} else {
    let result = 1;
    for(let i = 2; i <= n; i++) {
        result = result * i;
    }
    print(n + '! =', result);
}`,

        primecheck: `// Prime Number Checker
// Checks if a number is prime
let n = input('Enter a number: ');
if(n < 2) {
    print(n, 'is not prime');
} else {
    let isPrime = 1;
    for(let i = 2; i <= sqrt(n); i++) {
        if(n % i == 0) {
            isPrime = 0;
            break;
        }
    }
    if(isPrime) {
        print(n, 'is prime!');
    } else {
        print(n, 'is not prime');
    }
}`,

        statistics: `// Statistics Calculator
// Computes mean, median, and standard deviation
print('Statistics Calculator');
print('Enter numbers one at a time (enter "end" to finish)');

let data = [];
let running = 1;
while(running) {
    let val = input('Enter number (or "end"): ');
    if(val == 'end') {
        running = 0;
    } else {
        data.push(val);
    }
}

let n = data.length;
if(n == 0) {
    print('No data entered');
} else {
    // Mean
    let sum = 0;
    for(let i = 0; i < n; i++) {
        sum = sum + data[i];
    }
    let mean = sum / n;

    // Median
    // Simple bubble sort
    for(let i = 0; i < n-1; i++) {
        for(let j = 0; j < n-i-1; j++) {
            if(data[j] > data[j+1]) {
                let t = data[j];
                data[j] = data[j+1];
                data[j+1] = t;
            }
        }
    }
    let median;
    if(n % 2 == 0) {
        median = (data[n/2 - 1] + data[n/2]) / 2;
    } else {
        median = data[Math.floor(n/2)];
    }

    // Standard deviation
    let variance = 0;
    for(let i = 0; i < n; i++) {
        variance = variance + (data[i] - mean)^2;
    }
    variance = variance / n;
    let stddev = sqrt(variance);

    print('Count:', n);
    print('Mean:', mean);
    print('Median:', median);
    print('Std Dev:', stddev);
    print('Min:', data[0]);
    print('Max:', data[n-1]);
}`,
    };

    // --- Interpreter ---
    class Interpreter {
        constructor() {
            this.vars = {};
            this.outputLines = [];
            this.aborted = false;
            this.inputResolve = null;
            this.paused = false;
            this.lines = [];
            this.pc = 0;
            this.funcs = {};
        }

        log(...args) {
            this.outputLines.push({ type: 'print', text: args.map(a => typeof a === 'number' ? Calc.formatNum(a) : String(a)).join(' ') });
        }

        error(msg) {
            this.outputLines.push({ type: 'error', text: 'Error: ' + msg });
        }

        info(msg) {
            this.outputLines.push({ type: 'info', text: msg });
        }

        async exec(code) {
            this.outputLines = [];
            this.vars = {};
            this.aborted = false;
            this.pc = 0;

            // Normalize line endings
            code = code.replace(/\r\n/g, '\n');
            this.lines = code.split('\n');

            // Build function map
            this.funcs = {
                'sin': Math.sin, 'cos': Math.cos, 'tan': Math.tan,
                'asin': Math.asin, 'acos': Math.acos, 'atan': Math.atan,
                'sinh': Math.sinh, 'cosh': Math.cosh, 'tanh': Math.tanh,
                'sqrt': Math.sqrt, 'cbrt': Math.cbrt,
                'log': Math.log10, 'ln': Math.log,
                'exp': Math.exp, 'abs': Math.abs,
                'floor': Math.floor, 'ceil': Math.ceil, 'round': Math.round,
                'max': Math.max, 'min': Math.min,
                'pi': () => Math.PI, 'e': () => Math.E,
            };

            // Pre-process: join multi-line blocks into single lines for easier parsing
            // Find all {...} blocks and flatten them
            let fullCode = this.flattenBlocks(code);
            this.lines = fullCode.split('\n').filter(l => l.trim() !== '');

            // Remove comments
            this.lines = this.lines.map(l => {
                const ci = l.indexOf('//');
                return ci >= 0 ? l.substring(0, ci) : l;
            }).filter(l => l.trim() !== '');

            try {
                await this.executeBlock(this.lines, 0, this.lines.length);
            } catch(e) {
                if (e === 'ABORT') {
                    this.info('Program stopped by user');
                } else {
                    this.error(e.message || String(e));
                }
            }

            this.flushOutput();
            return this.outputLines;
        }

        flattenBlocks(code) {
            // We'll handle blocks in the parser instead
            return code;
        }

        async executeBlock(lines, start, end) {
            let i = start;
            while (i < end) {
                if (this.aborted) throw 'ABORT';
                const line = lines[i].trim();

                if (!line || line.startsWith('//')) { i++; continue; }

                if (line.startsWith('if(') || line.startsWith('if (')) {
                    i = await this.executeIf(lines, i, end);
                } else if (line.startsWith('while(') || line.startsWith('while (')) {
                    i = await this.executeWhile(lines, i, end);
                } else if (line.startsWith('for(') || line.startsWith('for (')) {
                    i = await this.executeFor(lines, i, end);
                } else if (line.startsWith('else') || line.startsWith('elif')) {
                    // Skip else/elif — handled by executeIf
                    i++;
                } else if (line.startsWith('}')) {
                    // End of block, return
                    return i + 1;
                } else {
                    await this.executeStatement(line);
                    i++;
                }
            }
            return i;
        }

        async executeStatement(stmt) {
            stmt = stmt.trim();
            if (!stmt || stmt.startsWith('//')) return;

            // print(...)
            const printMatch = stmt.match(/^print\s*\((.+)\)$/);
            if (printMatch) {
                const args = this.parseArgs(printMatch[1]);
                const vals = args.map(a => this.evalExpr(a));
                this.log(...vals);
                return;
            }

            // input(prompt)
            const inputMatch = stmt.match(/^input\s*\((.+)\)$/);
            if (inputMatch) {
                const prompt = this.evalString(inputMatch[1]);
                const val = await this.getInput(prompt);
                return val;
            }

            // let x = expr
            const letMatch = stmt.match(/^let\s+([a-zA-Z_]\w*)\s*=\s*(.+)$/);
            if (letMatch) {
                const name = letMatch[1];
                const val = this.evalExpr(letMatch[2]);
                this.vars[name] = val;
                return;
            }

            // x = expr (assignment to existing var or new)
            const assignMatch = stmt.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
            if (assignMatch) {
                const name = assignMatch[1];
                const val = this.evalExpr(assignMatch[2]);
                this.vars[name] = val;
                return;
            }

            // i++ / i-- (postfix increment/decrement)
            const incMatch = stmt.match(/^([a-zA-Z_]\w*)\s*(\+\+|--)$/);
            if (incMatch) {
                const name = incMatch[1];
                if (!(name in this.vars)) throw new Error('Undefined variable: ' + name);
                const old = this.vars[name];
                this.vars[name] = incMatch[2] === '++' ? old + 1 : old - 1;
                return;
            }

            // ++i / --i (prefix increment/decrement)
            const preIncMatch = stmt.match(/^(\+\+|--)\s*([a-zA-Z_]\w*)$/);
            if (preIncMatch) {
                const name = preIncMatch[2];
                if (!(name in this.vars)) throw new Error('Undefined variable: ' + name);
                this.vars[name] = preIncMatch[1] === '++' ? this.vars[name] + 1 : this.vars[name] - 1;
                return;
            }

            // x += expr, x -= expr, etc.
            const compoundMatch = stmt.match(/^([a-zA-Z_]\w*)\s*(\+=|-=|\*=|\/=)\s*(.+)$/);
            if (compoundMatch) {
                const name = compoundMatch[1];
                if (!(name in this.vars)) throw new Error('Undefined variable: ' + name);
                const rhs = this.evalExpr(compoundMatch[3]);
                const op = compoundMatch[2];
                const ops = { '+=': (a,b) => a+b, '-=': (a,b) => a-b, '*=': (a,b) => a*b, '/=': (a,b) => a/b };
                this.vars[name] = ops[op](this.vars[name], rhs);
                return;
            }

            // break / continue
            if (stmt === 'break') throw 'BREAK';
            if (stmt === 'continue') throw 'CONTINUE';

            // Expression statement (evaluate and print)
            const val = this.evalExpr(stmt);
            if (val !== undefined) {
                this.log(val);
            }
        }

        parseArgs(s) {
            // Split by comma, respecting parentheses and strings
            const args = [];
            let depth = 0;
            let current = '';
            let inString = false;
            for (const ch of s) {
                if (inString) {
                    current += ch;
                    if (ch === "'" || ch === '"') inString = false;
                } else if (ch === '(') {
                    depth++;
                    current += ch;
                } else if (ch === ')') {
                    depth--;
                    current += ch;
                } else if (ch === ',' && depth === 0) {
                    args.push(current.trim());
                    current = '';
                } else {
                    if (ch === "'" || ch === '"') inString = true;
                    current += ch;
                }
            }
            if (current.trim()) args.push(current.trim());
            return args;
        }

        evalString(s) {
            s = s.trim();
            if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
                return s.slice(1, -1);
            }
            // Try as expression
            const val = this.evalExpr(s);
            return typeof val === 'number' ? String(val) : String(val);
        }

        evalExpr(expr) {
            if (typeof expr !== 'string') return expr;
            expr = expr.trim();
            if (expr === '') return undefined;

            // Variable lookup
            if (/^[a-zA-Z_]\w*$/.test(expr)) {
                if (expr in this.vars) return this.vars[expr];
                if (expr === 'pi') return Math.PI;
                if (expr === 'e') return Math.E;
                throw new Error('Undefined variable: ' + expr);
            }

            // String literal
            if ((expr.startsWith("'") && expr.endsWith("'")) || (expr.startsWith('"') && expr.endsWith('"'))) {
                return expr.slice(1, -1);
            }

            // Replace variables
            let s = expr;
            for (const [name, val] of Object.entries(this.vars)) {
                s = s.replace(new RegExp('\\b' + name + '\\b', 'g'), `(${typeof val === 'number' ? val : '"' + val + '"'})`);
            }

            // Replace built-in functions with Math.*
            const funcMap = {
                'sin': 'Math.sin', 'cos': 'Math.cos', 'tan': 'Math.tan',
                'asin': 'Math.asin', 'acos': 'Math.acos', 'atan': 'Math.atan',
                'sinh': 'Math.sinh', 'cosh': 'Math.cosh', 'tanh': 'Math.tanh',
                'sqrt': 'Math.sqrt', 'cbrt': 'Math.cbrt',
                'log': 'Math.log10', 'ln': 'Math.log',
                'exp': 'Math.exp', 'abs': 'Math.abs',
                'floor': 'Math.floor', 'ceil': 'Math.ceil', 'round': 'Math.round',
                'max': 'Math.max', 'min': 'Math.min',
            };
            for (const [k, v] of Object.entries(funcMap)) {
                s = s.replace(new RegExp('\\b' + k + '\\b(?=\\s*\\()', 'g'), v);
            }

            // Replace operators
            s = s.replace(/\^/g, '**');

            try {
                const fn = new Function('return ' + s + ';');
                const result = fn();
                return result;
            } catch(e) {
                throw new Error('Expression error: ' + expr);
            }
        }

        async executeIf(lines, i, end) {
            const line = lines[i].trim();
            const condMatch = line.match(/^if\s*\((.+)\)\s*\{?$/);
            if (!condMatch) { this.error('Invalid if: ' + line); return i + 1; }

            const condition = this.evalExpr(condMatch[1]);
            let blockEnd = this.findBlockEnd(lines, i, end, ['else', 'elif']);

            if (condition) {
                await this.executeBlock(lines, i + 1, blockEnd.blockEnd);
                // Skip any else/elif blocks
                return blockEnd.afterBlock;
            } else {
                // Check for elif/else
                let next = blockEnd.afterBlock;
                while (next < end) {
                    const nLine = lines[next].trim();
                    if (nLine.startsWith('elif')) {
                        const elMatch = nLine.match(/^elif\s*\((.+)\)\s*\{?$/);
                        if (!elMatch) { this.error('Invalid elif'); return next + 1; }
                        const elCond = this.evalExpr(elMatch[1]);
                        const elEnd = this.findBlockEnd(lines, next, end, ['else', 'elif']);
                        if (elCond) {
                            await this.executeBlock(lines, next + 1, elEnd.blockEnd);
                            return elEnd.afterBlock;
                        }
                        next = elEnd.afterBlock;
                    } else if (nLine.startsWith('else')) {
                        const elseEnd = this.findBlockEnd(lines, next, end, []);
                        await this.executeBlock(lines, next + 1, elseEnd.blockEnd);
                        return elseEnd.afterBlock;
                    } else {
                        return next;
                    }
                }
                return next;
            }
        }

        async executeWhile(lines, i, end) {
            const line = lines[i].trim();
            const match = line.match(/^while\s*\((.+)\)\s*\{?$/);
            if (!match) { this.error('Invalid while: ' + line); return i + 1; }
            const condExpr = match[1];
            const blockEnd = this.findBlockEnd(lines, i, end, []);

            // Safety: max iterations
            let iter = 0;
            const MAX_ITER = 10000;
            while (this.evalExpr(condExpr)) {
                if (this.aborted) throw 'ABORT';
                if (iter++ > MAX_ITER) { this.error('Loop limit exceeded (10000)'); break; }
                try {
                    await this.executeBlock(lines, i + 1, blockEnd.blockEnd);
                } catch(e) {
                    if (e === 'BREAK') break;
                    if (e === 'CONTINUE') { /* continue to next iteration */ }
                    else throw e;
                }
            }
            return blockEnd.afterBlock;
        }

        async executeFor(lines, i, end) {
            const line = lines[i].trim();
            const match = line.match(/^for\s*\(([^;]+);([^;]+);([^)]+)\)\s*\{?$/);
            if (!match) { this.error('Invalid for: ' + line); return i + 1; }

            const initExpr = match[1].trim();
            const condExpr = match[2].trim();
            const incrExpr = match[3].trim();

            const blockEnd = this.findBlockEnd(lines, i, end, []);

            // Execute init
            await this.executeStatement(initExpr);

            let iter = 0;
            const MAX_ITER = 10000;
            while (this.evalExpr(condExpr)) {
                if (this.aborted) throw 'ABORT';
                if (iter++ > MAX_ITER) { this.error('Loop limit exceeded (10000)'); break; }
                let doIncrement = true;
                try {
                    await this.executeBlock(lines, i + 1, blockEnd.blockEnd);
                } catch(e) {
                    if (e === 'BREAK') { doIncrement = false; break; }
                    if (e === 'CONTINUE') { /* do increment and continue */ }
                    else throw e;
                }
                if (doIncrement) {
                    await this.executeStatement(incrExpr);
                }
            }
            return blockEnd.afterBlock;
        }

        findBlockEnd(lines, start, end, extraTokens) {
            // Check if the start line has an opening brace
            const line = lines[start].trim();
            let openBraces = (line.match(/\{/g) || []).length;
            let closeBraces = (line.match(/\}/g) || []).length;

            if (openBraces > closeBraces) {
                // Block starts on this line
                let i = start + 1;
                while (i < end) {
                    const l = lines[i].trim();
                    openBraces += (l.match(/\{/g) || []).length;
                    closeBraces += (l.match(/\}/g) || []).length;
                    if (closeBraces >= openBraces) {
                        // Check for extra tokens (else, elif)
                        let after = i + 1;
                        while (after < end) {
                            const aLine = lines[after].trim();
                            const isExtra = extraTokens.some(t => aLine.startsWith(t));
                            if (isExtra || aLine === '}' || aLine.startsWith('}')) {
                                break;
                            }
                            // If next line is not else/elif and not just closing braces, stop
                            if (aLine && !aLine.startsWith('}') && !aLine.startsWith('//')) {
                                break;
                            }
                            after++;
                        }
                        return { blockEnd: i + 1, afterBlock: after };
                    }
                    i++;
                }
                return { blockEnd: end, afterBlock: end };
            } else {
                // Single line block (no braces)
                return { blockEnd: start + 1, afterBlock: start + 1 };
            }
        }

        async getInput(prompt) {
            return new Promise((resolve) => {
                const val = prompt(prompt + ' ');
                if (val === null || val === '') {
                    resolve(0);
                    return;
                }
                // Try number
                const num = parseFloat(val);
                if (!isNaN(num) && val.trim() !== '') {
                    resolve(num);
                } else {
                    resolve(val);
                }
            });
        }

        flushOutput() {
            output.innerHTML = this.outputLines.map(l =>
                `<div class="out-${l.type}">${l.text}</div>`
            ).join('');
            output.scrollTop = output.scrollHeight;
        }
    }

    // --- Run program ---
    async function runProgram() {
        const code = editor.value.trim();
        if (!code) { output.innerHTML = '<div class="out-info">No code to run.</div>'; return; }

        if (running) return;
        running = true;
        aborted = false;
        runBtn.textContent = '⏳ Running…';
        runBtn.disabled = true;

        output.innerHTML = '<div class="out-info">Running…</div>';

        const interp = new Interpreter();
        await interp.exec(code);

        running = false;
        runBtn.textContent = '▶ Run';
        runBtn.disabled = false;
    }

    function stopProgram() {
        aborted = true;
        running = false;
        runBtn.textContent = '▶ Run';
        runBtn.disabled = false;
        output.innerHTML += '<div class="out-info">Program stopped.</div>';
    }

    // --- Load library program ---
    function loadLibraryProgram(name) {
        if (libraryPrograms[name]) {
            editor.value = libraryPrograms[name];
            // Switch to editor tab
            document.querySelector('[data-tab="editor"]').click();
            const programs = loadPrograms();
            if (programs[name]) {
                progSelect.value = name;
            } else {
                progSelect.value = 'new';
            }
            setStatus('Loaded: ' + name);
        }
    }

    // --- Init ---
    function init() {
        // Load saved programs
        const programs = loadPrograms();
        populateSelect(programs);

        // Program select change
        progSelect.addEventListener('change', () => {
            if (progSelect.value === 'new') {
                editor.value = '';
            } else {
                loadProgram(progSelect.value);
            }
        });

        // Save/Delete
        saveBtn.addEventListener('click', saveCurrentProgram);
        deleteBtn.addEventListener('click', deleteCurrentProgram);

        // Run/Stop/Clear
        runBtn.addEventListener('click', runProgram);
        stopBtn.addEventListener('click', stopProgram);
        clearBtn.addEventListener('click', () => {
            output.innerHTML = '';
        });

        // Editor: Ctrl+Enter to run
        editor.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                runProgram();
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
                editor.selectionStart = editor.selectionEnd = start + 4;
            }
        });

        // Library clicks
        libraryList.querySelectorAll('.library-item').forEach(item => {
            item.addEventListener('click', () => {
                loadLibraryProgram(item.dataset.name);
            });
        });

        // Tab switching
        document.querySelectorAll('.program-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.program-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.program-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const panel = document.getElementById('panel' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1));
                if (panel) panel.classList.add('active');
            });
        });

        // Output initial help
        output.innerHTML = `<div class="out-info">Type a program and click Run, or load a Library example.
Ctrl+Enter to run. Tab for indentation.</div>`;
    }

    return { init, loadLibraryProgram };
})();


// ============================================================
// 3. BOOT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    Calc.init();
    Programmer.init();
    console.log('ProCalc initialized.');
});
